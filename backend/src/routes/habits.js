const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Habit = require('../models/Habit');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All habit routes require authentication
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

/** Ensure the habit belongs to the requesting user; returns the doc or null. */
const findOwnedHabit = async (habitId, userId) =>
  Habit.findOne({ _id: habitId, userId });

/** Lazy Evaluation: Recalculate streaks dynamically based on current date */
const refreshHabitStreaks = async (habits) => {
  if (!habits || habits.length === 0) return;
  const { calculateStreak, toMidnightUTC } = require('../utils/calculateStreak');
  const CheckIn = require('../models/CheckIn');
  
  const habitIds = habits.map(h => h._id);
  const allCheckIns = await CheckIn.find({ habitId: { $in: habitIds } }).lean();
  
  const checkInsByHabit = {};
  for (const ci of allCheckIns) {
    const hid = ci.habitId.toString();
    if (!checkInsByHabit[hid]) checkInsByHabit[hid] = [];
    checkInsByHabit[hid].push(ci);
  }

  const today = toMidnightUTC(new Date());
  const savePromises = [];

  for (const habit of habits) {
    const habitCheckIns = checkInsByHabit[habit._id.toString()] || [];
    const { currentStreak, longestStreak } = calculateStreak({
      checkinDate: today,
      frequency: habit.frequency,
      targetDaysPerWeek: habit.targetDaysPerWeek,
      habitCreatedAt: habit.createdAt,
      longestStreak: habit.longestStreak,
      allCheckIns: habitCheckIns,
    });

    if (habit.currentStreak !== currentStreak || habit.longestStreak !== longestStreak) {
      habit.currentStreak = currentStreak;
      habit.longestStreak = longestStreak;
      savePromises.push(habit.save());
    }
  }

  if (savePromises.length > 0) {
    await Promise.all(savePromises);
  }
};

// ─── POST /api/habits ─────────────────────────────────────────────────────────

/**
 * Create a new habit.
 * Body: { name, category?, frequency?, targetDaysPerWeek? }
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Habit name is required'),
    body('category').optional().trim(),
    body('frequency')
      .optional()
      .isIn(['daily', 'weekly'])
      .withMessage('Frequency must be "daily" or "weekly"'),
    body('targetDaysPerWeek')
      .optional()
      .isInt({ min: 1, max: 7 })
      .withMessage('targetDaysPerWeek must be between 1 and 7'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { name, category, frequency, targetDaysPerWeek } = req.body;

      const habit = await Habit.create({
        userId: req.user._id,
        name,
        ...(category && { category }),
        ...(frequency && { frequency }),
        ...(targetDaysPerWeek !== undefined && { targetDaysPerWeek }),
      });

      res.status(201).json(habit);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/habits ──────────────────────────────────────────────────────────

/**
 * Get all habits for the logged-in user.
 * Query: ?includeArchived=true  (default: exclude archived)
 */
router.get(
  '/',
  [
    query('includeArchived')
      .optional()
      .isBoolean()
      .withMessage('includeArchived must be true or false'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const filter = { userId: req.user._id };
      if (req.query.includeArchived !== 'true') {
        filter.archived = false;
      }

      const habits = await Habit.find(filter).sort({ createdAt: -1 });
      await refreshHabitStreaks(habits);
      res.json(habits);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/habits/:id ──────────────────────────────────────────────────────

/**
 * Get a single habit by ID (must belong to the requesting user).
 */
router.get('/:id', async (req, res, next) => {
  try {
    const habit = await findOwnedHabit(req.params.id, req.user._id);
    if (!habit) return res.status(404).json({ message: 'Habit not found.' });
    
    await refreshHabitStreaks([habit]);
    res.json(habit);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/habits/:id ────────────────────────────────────────────────────

/**
 * Edit a habit — name, category, targetDaysPerWeek, or archived flag.
 * Body: { name?, category?, targetDaysPerWeek?, archived? }
 *
 * Note: `frequency` is intentionally not patchable after creation — changing
 * it would make existing check-in history ambiguous for streak calculation.
 * Users should archive and recreate the habit if they want a different frequency.
 */
router.patch(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('category').optional().trim(),
    body('targetDaysPerWeek')
      .optional()
      .isInt({ min: 1, max: 7 })
      .withMessage('targetDaysPerWeek must be between 1 and 7'),
    body('archived')
      .optional()
      .isBoolean()
      .withMessage('archived must be a boolean'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const habit = await findOwnedHabit(req.params.id, req.user._id);
      if (!habit) return res.status(404).json({ message: 'Habit not found.' });

      const { name, category, targetDaysPerWeek, archived } = req.body;
      if (name !== undefined) habit.name = name;
      if (category !== undefined) habit.category = category;
      if (targetDaysPerWeek !== undefined) habit.targetDaysPerWeek = targetDaysPerWeek;
      if (archived !== undefined) habit.archived = archived;

      await habit.save();
      res.json(habit);
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /api/habits/:id ───────────────────────────────────────────────────

/**
 * Hard-delete a habit and all its check-ins.
 * For soft-delete (hide from dashboard), use PATCH with { archived: true }.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const habit = await findOwnedHabit(req.params.id, req.user._id);
    if (!habit) return res.status(404).json({ message: 'Habit not found.' });

    // Also delete all check-ins for this habit (referential integrity)
    // CheckIn model is required lazily to avoid circular-require at boot time
    const CheckIn = require('../models/CheckIn');
    await CheckIn.deleteMany({ habitId: habit._id });

    await habit.deleteOne();
    res.json({ message: 'Habit and all its check-ins deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
