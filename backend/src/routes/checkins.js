const express = require('express');
const { body, query, validationResult } = require('express-validator');
const CheckIn = require('../models/CheckIn');
const Habit = require('../models/Habit');
const { protect } = require('../middleware/auth');
const { calculateStreak, toMidnightUTC } = require('../utils/calculateStreak');

const router = express.Router({ mergeParams: true }); // inherits :id from habits router

router.use(protect);

// ─── Helper ──────────────────────────────────────────────────────────────────

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

// ─── POST /api/habits/:id/checkin ─────────────────────────────────────────────

/**
 * Mark today (or a specific date) as done/skipped for a habit.
 *
 * Body: { status: "done"|"skipped", date?: ISO string, note?: string }
 *   - `date` defaults to today UTC if omitted.
 *   - Normalised to midnight UTC before saving.
 *
 * This endpoint is idempotent: if a check-in already exists for that date,
 * it updates it (upsert). This means the client can safely retry without
 * creating duplicate check-ins (the compound unique index on (habitId, date)
 * enforces this at the DB level, and we use findOneAndUpdate with upsert).
 *
 * After upserting, calls calculateStreak (pure function) and updates the
 * habit's currentStreak / longestStreak denormalised fields.
 */
router.post(
  '/',
  [
    body('status')
      .isIn(['done', 'skipped'])
      .withMessage('Status must be "done" or "skipped"'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('date must be a valid ISO 8601 date string'),
    body('note')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 280 })
      .withMessage('Note cannot exceed 280 characters'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { status, note } = req.body;

      // Normalise date to midnight UTC (defaults to today UTC if not provided)
      const rawDate = req.body.date ? new Date(req.body.date) : new Date();
      const checkinDate = toMidnightUTC(rawDate);

      // Verify the habit exists and belongs to the requesting user
      const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
      if (!habit) {
        return res.status(404).json({ message: 'Habit not found.' });
      }

      // Upsert the check-in (insert if new, update if already exists for this date)
      const checkIn = await CheckIn.findOneAndUpdate(
        { habitId: habit._id, date: checkinDate },
        {
          $set: {
            habitId: habit._id,
            userId: req.user._id,
            date: checkinDate,
            status,
            note: note ?? null,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      // Fetch all check-ins for this habit to recalculate the streak from scratch.
      // This is slightly more expensive than incremental calculation but is
      // correct for any check-in date (not just today) and easy to reason about.
      const allCheckIns = await CheckIn.find({ habitId: habit._id }).lean();

      const { currentStreak, longestStreak } = calculateStreak({
        checkinDate,
        frequency: habit.frequency,
        targetDaysPerWeek: habit.targetDaysPerWeek,
        habitCreatedAt: habit.createdAt,
        longestStreak: habit.longestStreak,
        allCheckIns,
      });

      // Persist updated streak values
      habit.currentStreak = currentStreak;
      habit.longestStreak = longestStreak;
      await habit.save();

      res.status(201).json({
        checkIn,
        habit: {
          _id: habit._id,
          currentStreak: habit.currentStreak,
          longestStreak: habit.longestStreak,
        },
      });
    } catch (err) {
      // Duplicate key errors are already handled by the upsert, but guard anyway
      if (err.code === 11000) {
        return res.status(409).json({ message: 'Check-in for this date already exists.' });
      }
      next(err);
    }
  }
);

// ─── GET /api/habits/:id/history ──────────────────────────────────────────────

/**
 * Get check-in history for a date range.
 * Query: ?from=2024-01-01&to=2024-01-31  (ISO date strings)
 *
 * Used by:
 *   - The contribution heatmap (fetches ~1 year of data)
 *   - The analytics page (fetches last 30 days)
 *
 * Returns an array of { date, status, note } objects, sorted ascending by date.
 */
router.get(
  '/history',
  [
    query('from').optional().isISO8601().withMessage('from must be ISO 8601'),
    query('to').optional().isISO8601().withMessage('to must be ISO 8601'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      // Verify ownership
      const habit = await Habit.findOne({ _id: req.params.id, userId: req.user._id });
      if (!habit) return res.status(404).json({ message: 'Habit not found.' });

      const filter = { habitId: habit._id };

      if (req.query.from || req.query.to) {
        filter.date = {};
        if (req.query.from) filter.date.$gte = toMidnightUTC(new Date(req.query.from));
        if (req.query.to) filter.date.$lte = toMidnightUTC(new Date(req.query.to));
      }

      const checkIns = await CheckIn.find(filter)
        .select('date status note -_id')
        .sort({ date: 1 })
        .lean();

      res.json(checkIns);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
