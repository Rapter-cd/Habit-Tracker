const express = require('express');
const Habit = require('../models/Habit');
const CheckIn = require('../models/CheckIn');
const { protect } = require('../middleware/auth');
const { toMidnightUTC } = require('../utils/calculateStreak');

const router = express.Router();
router.use(protect);

// ─── GET /api/analytics/summary ───────────────────────────────────────────────

/**
 * Return a summary for the logged-in user over the last 30 days:
 *   - overallCompletionRate: % of expected check-ins that were "done"
 *   - bestHabit:  habit with the highest completion rate (last 30d)
 *   - worstHabit: habit with the lowest completion rate (last 30d)
 *   - totalActiveStreaks: count of habits with currentStreak > 0
 *   - activeHabits: total number of non-archived habits
 */
router.get('/summary', async (req, res, next) => {
  try {
    const thirtyDaysAgo = toMidnightUTC(new Date(Date.now() - 30 * 86_400_000));
    const habits = await Habit.find({ userId: req.user._id, archived: false }).lean();

    if (!habits.length) {
      return res.json({
        overallCompletionRate: 0,
        bestHabit: null,
        worstHabit: null,
        totalActiveStreaks: 0,
        activeHabits: 0,
      });
    }

    const habitIds = habits.map((h) => h._id);

    // Fetch all "done" check-ins in the last 30 days for the user's habits
    const checkIns = await CheckIn.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      status: 'done',
      date: { $gte: thirtyDaysAgo },
    }).lean();

    // Build a lookup: habitId → done count
    const doneByHabit = {};
    for (const ci of checkIns) {
      const key = ci.habitId.toString();
      doneByHabit[key] = (doneByHabit[key] || 0) + 1;
    }

    // Per-habit stats
    const habitStats = habits.map((h) => {
      const expected = h.frequency === 'daily' ? 30 : h.targetDaysPerWeek * 4;
      const done = doneByHabit[h._id.toString()] || 0;
      const rate = expected > 0 ? Math.round((done / expected) * 100) : 0;
      return { _id: h._id, name: h.name, completionRate: rate, expected, done };
    });

    // Overall rate
    const totalExpected = habitStats.reduce((s, h) => s + h.expected, 0);
    const totalDone = habitStats.reduce((s, h) => s + h.done, 0);
    const overallCompletionRate = totalExpected
      ? Math.round((totalDone / totalExpected) * 100)
      : 0;

    // Best & worst habits (ignore habits with no expected days — shouldn't happen)
    const sorted = [...habitStats].sort((a, b) => b.completionRate - a.completionRate);
    const bestHabit = sorted[0] || null;
    const worstHabit = sorted[sorted.length - 1] || null;

    const totalActiveStreaks = habits.filter((h) => h.currentStreak > 0).length;

    res.json({
      overallCompletionRate,
      bestHabit,
      worstHabit,
      totalActiveStreaks,
      activeHabits: habits.length,
      habitStats, // full breakdown for the bar chart
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/analytics/heatmap/:habitId ──────────────────────────────────────

/**
 * Return check-in data formatted for the heatmap component.
 * Returns one full year of data (last 365 days) by default.
 * Response: Array<{ date: string (YYYY-MM-DD), status: "done"|"skipped"|null }>
 *
 * "null" status means no check-in recorded for that day.
 * The frontend renders each date as a cell regardless of whether a check-in
 * exists — this allows it to draw the full year grid with empty cells.
 */
router.get('/heatmap/:habitId', async (req, res, next) => {
  try {
    // Verify ownership
    const habit = await Habit.findOne({
      _id: req.params.habitId,
      userId: req.user._id,
    });
    if (!habit) return res.status(404).json({ message: 'Habit not found.' });

    const to = toMidnightUTC(new Date());
    const from = toMidnightUTC(new Date(Date.now() - 364 * 86_400_000));

    const checkIns = await CheckIn.find({
      habitId: habit._id,
      date: { $gte: from, $lte: to },
    })
      .select('date status')
      .lean();

    // Build a date → status lookup
    const byDate = {};
    for (const ci of checkIns) {
      const key = toMidnightUTC(ci.date).toISOString().slice(0, 10);
      byDate[key] = ci.status;
    }

    // Emit one record per day in the range (365 days)
    const result = [];
    let cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({ date: key, status: byDate[key] || null });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/analytics/completion-over-time ──────────────────────────────────

/**
 * Return daily completion rate over the last 30 days for Recharts line chart.
 * Response: Array<{ date: string, completionRate: number }>
 *
 * completionRate = (habits with a "done" check-in that day) / (total active habits) * 100
 */
router.get('/completion-over-time', async (req, res, next) => {
  try {
    const thirtyDaysAgo = toMidnightUTC(new Date(Date.now() - 29 * 86_400_000));
    const today = toMidnightUTC(new Date());

    const habits = await Habit.find({ userId: req.user._id, archived: false }).lean();
    if (!habits.length) return res.json([]);

    const habitIds = habits.map((h) => h._id);

    const checkIns = await CheckIn.find({
      userId: req.user._id,
      habitId: { $in: habitIds },
      status: 'done',
      date: { $gte: thirtyDaysAgo, $lte: today },
    })
      .select('date habitId')
      .lean();

    // Group done check-ins by date
    const doneByDay = {};
    for (const ci of checkIns) {
      const key = toMidnightUTC(ci.date).toISOString().slice(0, 10);
      if (!doneByDay[key]) doneByDay[key] = new Set();
      doneByDay[key].add(ci.habitId.toString());
    }

    // Build one record per day
    const result = [];
    let cursor = new Date(thirtyDaysAgo);
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      const done = doneByDay[key] ? doneByDay[key].size : 0;
      const rate = Math.round((done / habits.length) * 100);
      result.push({ date: key, completionRate: rate });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
