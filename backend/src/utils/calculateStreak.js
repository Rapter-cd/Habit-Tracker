/**
 * calculateStreak.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, side-effect-free streak calculation function.
 *
 * Separated from route handlers so it can be:
 *   1. Unit-tested independently (see tests/calculateStreak.test.js)
 *   2. Reasoned about in isolation — no database calls, no HTTP concerns
 *   3. Explained clearly in a technical interview
 *
 * Timezone policy (design decision):
 *   All dates are expected as midnight UTC (i.e., stored with toMidnightUTC).
 *   The helper below normalises any incoming Date to midnight UTC so the
 *   arithmetic is always in whole days, not milliseconds that drift with DST.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Normalise a Date (or date string) to midnight UTC on that calendar day.
 * This is the canonical form for all dates in the system.
 *
 * @param {Date|string} date
 * @returns {Date} midnight UTC
 */
const toMidnightUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Return the midnight-UTC Date for N days before the given date.
 *
 * @param {Date} date  - reference midnight-UTC date
 * @param {number} n   - how many days to go back
 * @returns {Date}
 */
const daysAgo = (date, n) => new Date(date.getTime() - n * 86_400_000);

/**
 * Get the ISO calendar week identifier (Mon-Sun) for a date.
 * Returns a string like "2024-W03" — year + ISO week number.
 *
 * Design decision: we use ISO weeks (Mon–Sun) rather than rolling 7-day
 * windows for weekly habits. This aligns with how most habit apps work and
 * makes the UX predictable ("this week" means Mon–Sun in the user's mental
 * model).
 *
 * @param {Date} date
 * @returns {string}  e.g. "2024-W03"
 */
const isoWeekKey = (date) => {
  const d = new Date(date);
  // Move to Thursday of the current ISO week to correctly determine the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculate the current and longest streak for a habit after a new check-in.
 *
 * This function is PURE — it never mutates its inputs and makes no I/O calls.
 * Call it with all existing check-ins for the habit (including the new one)
 * and it returns the updated streak values.
 *
 * @param {object} params
 * @param {Date}   params.checkinDate    - The date being checked in (midnight UTC)
 * @param {string} params.frequency      - "daily" | "weekly"
 * @param {number} params.targetDaysPerWeek - Only used for "weekly" frequency
 * @param {Date}   params.habitCreatedAt - Used to detect "first ever check-in"
 * @param {number} params.longestStreak  - The habit's current longestStreak value
 * @param {Array<{date: Date, status: string}>} params.allCheckIns
 *   All check-ins for this habit (may include the new one), any order.
 *   Each element must have: date (Date), status ("done"|"skipped").
 *
 * @returns {{ currentStreak: number, longestStreak: number }}
 */
const calculateStreak = ({
  checkinDate,
  frequency,
  targetDaysPerWeek,
  habitCreatedAt,
  longestStreak: prevLongest,
  allCheckIns,
}) => {
  const today = toMidnightUTC(checkinDate);

  // ── DAILY HABIT ────────────────────────────────────────────────────────────
  if (frequency === 'daily') {
    return calculateDailyStreak({ today, habitCreatedAt, prevLongest, allCheckIns });
  }

  // ── WEEKLY HABIT ───────────────────────────────────────────────────────────
  return calculateWeeklyStreak({ today, targetDaysPerWeek, prevLongest, allCheckIns });
};

// ─── Daily streak ─────────────────────────────────────────────────────────────

/**
 * Daily streak algorithm.
 *
 * Walk backwards day-by-day from `today`, counting consecutive "done" days.
 * Stop as soon as we find a day that:
 *   - Has no "done" check-in AND
 *   - Is on or after the habit's creation date (days before creation are
 *     ignored — you can't miss a habit before it existed)
 *
 * Rules from spec:
 *   1. First check-in ever → currentStreak = 1
 *   2. Yesterday was "done" → streak += 1
 *   3. Yesterday was missed (no "done") → streak resets to 1
 *   4. longestStreak = max(prevLongest, currentStreak) — never decreases
 */
const calculateDailyStreak = ({ today, habitCreatedAt, prevLongest, allCheckIns }) => {
  // Build a Set of days with "done" status for O(1) lookups.
  // Keys are ISO date strings like "2024-01-15".
  const doneDays = new Set(
    allCheckIns
      .filter((c) => c.status === 'done')
      .map((c) => toMidnightUTC(c.date).toISOString().slice(0, 10))
  );

  const creationDay = toMidnightUTC(habitCreatedAt);

  // Today must be "done" for a streak to exist at all (the caller should only
  // invoke this after a "done" check-in, but we guard defensively).
  const todayKey = today.toISOString().slice(0, 10);
  if (!doneDays.has(todayKey)) {
    return { currentStreak: 0, longestStreak: prevLongest };
  }

  let streak = 1; // today counts
  let cursor = daysAgo(today, 1); // start checking yesterday

  while (cursor >= creationDay) {
    const key = cursor.toISOString().slice(0, 10);
    if (doneDays.has(key)) {
      streak += 1;
      cursor = daysAgo(cursor, 1);
    } else {
      // Gap found — streak ends here
      break;
    }
  }

  const currentStreak = streak;
  const longestStreak = Math.max(prevLongest, currentStreak);
  return { currentStreak, longestStreak };
};

// ─── Weekly streak ────────────────────────────────────────────────────────────

/**
 * Weekly streak algorithm.
 *
 * Design decision: "streak" for weekly habits = consecutive ISO calendar weeks
 * (Mon–Sun) where the user hit `targetDaysPerWeek` "done" check-ins.
 *
 * Algorithm:
 *   1. Group all "done" check-ins by ISO week key.
 *   2. Count "done" days per week.
 *   3. Walk backwards from the current week, counting consecutive "completed"
 *      weeks (weeks where done count >= targetDaysPerWeek).
 *   4. Stop at the first non-completed week.
 */
const calculateWeeklyStreak = ({ today, targetDaysPerWeek, prevLongest, allCheckIns }) => {
  // Count done days per ISO week
  const donePerWeek = new Map();
  for (const ci of allCheckIns) {
    if (ci.status !== 'done') continue;
    const wk = isoWeekKey(toMidnightUTC(ci.date));
    donePerWeek.set(wk, (donePerWeek.get(wk) || 0) + 1);
  }

  const currentWeekKey = isoWeekKey(today);

  // Current week must have met the target for a streak to register
  const currentWeekDone = donePerWeek.get(currentWeekKey) || 0;
  if (currentWeekDone < targetDaysPerWeek) {
    return { currentStreak: 0, longestStreak: prevLongest };
  }

  let streak = 1;
  // Walk back week by week (7 days at a time from Monday of current week)
  let cursorDate = daysAgo(today, 7);

  // Safety limit: don't scan more than 5 years of history
  const limit = 260;
  for (let i = 0; i < limit; i++) {
    const wk = isoWeekKey(cursorDate);
    const done = donePerWeek.get(wk) || 0;
    if (done >= targetDaysPerWeek) {
      streak += 1;
      cursorDate = daysAgo(cursorDate, 7);
    } else {
      break;
    }
  }

  const currentStreak = streak;
  const longestStreak = Math.max(prevLongest, currentStreak);
  return { currentStreak, longestStreak };
};

// ─── Export helpers (needed by tests) ────────────────────────────────────────

module.exports = { calculateStreak, toMidnightUTC, isoWeekKey };
