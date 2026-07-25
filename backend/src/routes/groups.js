const express = require('express');
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const Habit = require('../models/Habit');
const CheckIn = require('../models/CheckIn');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { toMidnightUTC } = require('../utils/calculateStreak');

const router = express.Router();
router.use(protect);

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

// ─── Leaderboard scoring helper ───────────────────────────────────────────────

/**
 * Compute the leaderboard score for a user: their 30-day habit completion %.
 *
 * Design decision: We use 30-day completion % rather than raw current streak
 * because:
 *   1. It's fairer to new members who haven't had time to build long streaks.
 *   2. It rewards consistent effort over a period, not just recency.
 *   3. It's easy to explain: "what % of your habit days did you complete?"
 *
 * Formula:
 *   score = (total "done" check-ins in last 30 days) /
 *           (total expected check-ins in last 30 days) * 100
 *
 * "Expected" = sum over active habits of:
 *   - daily:  30 days
 *   - weekly: targetDaysPerWeek * 4 weeks (approx)
 *
 * @param {string} userId
 * @returns {Promise<number>} 0–100
 */
const computeScore = async (userId) => {
  const thirtyDaysAgo = toMidnightUTC(new Date(Date.now() - 30 * 86_400_000));

  const habits = await Habit.find({ userId, archived: false }).lean();
  if (!habits.length) return 0;

  // Expected check-ins per habit in 30 days
  const expected = habits.reduce((sum, h) => {
    if (h.frequency === 'daily') return sum + 30;
    return sum + h.targetDaysPerWeek * 4;
  }, 0);

  if (expected === 0) return 0;

  const habitIds = habits.map((h) => h._id);
  const doneCount = await CheckIn.countDocuments({
    userId,
    habitId: { $in: habitIds },
    status: 'done',
    date: { $gte: thirtyDaysAgo },
  });

  return Math.round((doneCount / expected) * 100);
};

// ─── POST /api/groups ─────────────────────────────────────────────────────────

/**
 * Create a new group. Creator is automatically added as a member.
 * Body: { name, description? }
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('description').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { name, description } = req.body;
      const group = await Group.create({
        name,
        description: description || '',
        createdBy: req.user._id,
        members: [req.user._id],
      });

      // Add group to user's groups array
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { groups: group._id } });

      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/groups/join ────────────────────────────────────────────────────

/**
 * Join a group using an invite code.
 * Body: { inviteCode }
 */
router.post(
  '/join',
  [body('inviteCode').trim().notEmpty().withMessage('inviteCode is required')],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const group = await Group.findOne({ inviteCode: req.body.inviteCode });
      if (!group) {
        return res.status(404).json({ message: 'No group found with that invite code.' });
      }

      // Idempotent: don't add if already a member
      const alreadyMember = group.members.some(
        (m) => m.toString() === req.user._id.toString()
      );
      if (alreadyMember) {
        return res.status(200).json({ message: 'You are already a member.', group });
      }

      group.members.push(req.user._id);
      await group.save();

      await User.findByIdAndUpdate(req.user._id, { $addToSet: { groups: group._id } });

      res.json(group);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/groups/:id ──────────────────────────────────────────────────────

/**
 * Get group details: info + each member's name, avatar, and current streak summary.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).populate(
      'members',
      'name email avatar'
    );
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    // Verify requesting user is a member
    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Not a member of this group.' });

    // Attach per-member streak summary
    const membersWithStats = await Promise.all(
      group.members.map(async (member) => {
        const habits = await Habit.find({ userId: member._id, archived: false })
          .select('currentStreak longestStreak name')
          .lean();

        const totalCurrentStreak = habits.reduce((s, h) => s + h.currentStreak, 0);
        const activeHabits = habits.length;

        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          avatar: member.avatar,
          totalCurrentStreak,
          activeHabits,
        };
      })
    );

    res.json({
      _id: group._id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      members: membersWithStats,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/groups/:id/leaderboard ─────────────────────────────────────────

/**
 * Return members ranked by 30-day completion %.
 * Includes rank position (1-indexed) for trophy badge display.
 */
router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).populate('members', 'name avatar email');
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const isMember = group.members.some(
      (m) => m._id.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(403).json({ message: 'Not a member of this group.' });

    // Compute scores in parallel
    const scored = await Promise.all(
      group.members.map(async (member) => ({
        _id: member._id,
        name: member.name,
        avatar: member.avatar,
        email: member.email,
        score: await computeScore(member._id),
      }))
    );

    // Sort descending by score, then alphabetically as tiebreaker
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    // Attach rank (1-based)
    const ranked = scored.map((m, i) => ({ ...m, rank: i + 1 }));

    res.json(ranked);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/groups/:id/leave ───────────────────────────────────────────────

/**
 * Leave a group. If the creator leaves, another member becomes the new creator.
 * If no members remain, the group is deleted.
 */
router.post('/:id/leave', async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });

    const isMember = group.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (!isMember) return res.status(400).json({ message: 'You are not a member.' });

    // Remove user from group
    group.members = group.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );

    // Remove group from user's profile
    await User.findByIdAndUpdate(req.user._id, { $pull: { groups: group._id } });

    if (group.members.length === 0) {
      await group.deleteOne();
      return res.json({ message: 'You were the last member — group has been deleted.' });
    }

    // Transfer ownership if creator left
    if (group.createdBy.toString() === req.user._id.toString()) {
      group.createdBy = group.members[0];
    }

    await group.save();
    res.json({ message: 'You have left the group.', group });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
