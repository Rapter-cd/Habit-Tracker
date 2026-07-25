'use strict';

/**
 * Unit tests for calculateStreak.js
 * ─────────────────────────────────────────────────────────────────────────────
 * These tests run against the pure function only — no database, no HTTP.
 * Run with: npm test
 *
 * Test coverage:
 *   Daily habits:
 *     ✓ First check-in ever → streak = 1
 *     ✓ Continuing a streak (yesterday was done)
 *     ✓ Breaking a streak (gap of one day)
 *     ✓ Long streak (multi-day)
 *     ✓ Same-day duplicate (idempotent — same result)
 *     ✓ longestStreak never decreases after a break
 *     ✓ Day before habit creation is ignored (no false break)
 *
 *   Weekly habits:
 *     ✓ Current week hits target → streak = 1
 *     ✓ Two consecutive weeks hit target → streak = 2
 *     ✓ Previous week missed target → streak resets to 1
 *     ✓ Partial week (below target) → streak = 0
 */

const { calculateStreak, toMidnightUTC } = require('../src/utils/calculateStreak');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a midnight-UTC Date for an ISO date string.
 * @param {string} iso  e.g. "2024-01-15"
 * @returns {Date}
 */
const d = (iso) => toMidnightUTC(new Date(iso));

/**
 * Build an array of "done" check-in objects from ISO date strings.
 * @param {string[]} dates
 * @returns {Array<{date: Date, status: 'done'}>}
 */
const doneList = (dates) => dates.map((iso) => ({ date: d(iso), status: 'done' }));

/**
 * Default habit metadata used across tests (creation date in the past).
 */
const HABIT_CREATED = d('2024-01-01');
const BASE_PARAMS = {
  frequency: 'daily',
  targetDaysPerWeek: 3,
  habitCreatedAt: HABIT_CREATED,
  longestStreak: 0,
};

// ─── Daily habit tests ────────────────────────────────────────────────────────

describe('Daily habit — calculateStreak', () => {
  // ── Test 1: First check-in ever ────────────────────────────────────────────
  test('first check-in ever → currentStreak = 1, longestStreak = 1', () => {
    const checkinDate = d('2024-03-01');
    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      allCheckIns: [{ date: checkinDate, status: 'done' }],
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  // ── Test 2: Continuing a streak ────────────────────────────────────────────
  test('yesterday was done → currentStreak increments', () => {
    const checkinDate = d('2024-03-10');
    const checkIns = doneList(['2024-03-08', '2024-03-09', '2024-03-10']);

    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      longestStreak: 2,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  // ── Test 3: Long streak ────────────────────────────────────────────────────
  test('7-day consecutive streak → currentStreak = 7', () => {
    const dates = [
      '2024-03-01', '2024-03-02', '2024-03-03', '2024-03-04',
      '2024-03-05', '2024-03-06', '2024-03-07',
    ];
    const checkinDate = d('2024-03-07');
    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      allCheckIns: doneList(dates),
    });

    expect(result.currentStreak).toBe(7);
    expect(result.longestStreak).toBe(7);
  });

  // ── Test 4: Breaking a streak ──────────────────────────────────────────────
  test('one-day gap breaks streak → currentStreak resets to 1', () => {
    // Had a 3-day streak, missed 2024-03-09, checks in on 2024-03-10
    const checkinDate = d('2024-03-10');
    const checkIns = doneList(['2024-03-06', '2024-03-07', '2024-03-08', '2024-03-10']);

    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      longestStreak: 3,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(1);
    // longestStreak must NOT decrease
    expect(result.longestStreak).toBe(3);
  });

  // ── Test 5: longestStreak never decreases ──────────────────────────────────
  test('longestStreak is preserved after a streak break', () => {
    const checkinDate = d('2024-06-01');
    const checkIns = doneList(['2024-06-01']); // just today, no history

    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      longestStreak: 30, // user had a 30-day streak before
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(30); // unchanged
  });

  // ── Test 6: Same-day idempotency ───────────────────────────────────────────
  test('checking in twice on the same day → same streak result (idempotent)', () => {
    const checkinDate = d('2024-03-05');
    const checkIns = doneList(['2024-03-04', '2024-03-05']);

    const first = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    // Simulate calling again with the same check-in list (no duplicates in DB
    // due to unique index, but the function should be stable regardless)
    const second = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      longestStreak: first.longestStreak,
      allCheckIns: checkIns,
    });

    expect(first.currentStreak).toBe(second.currentStreak);
    expect(first.longestStreak).toBe(second.longestStreak);
  });

  // ── Test 7: Days before habit creation are ignored ─────────────────────────
  test('no check-ins before habit creation → no false streak break', () => {
    // Habit created 2024-03-01. First check-in is exactly on creation day.
    // There's no "missed day" before creation, so streak should be 1.
    const checkinDate = d('2024-03-01');
    const result = calculateStreak({
      ...BASE_PARAMS,
      habitCreatedAt: d('2024-03-01'),
      checkinDate,
      allCheckIns: [{ date: checkinDate, status: 'done' }],
    });

    expect(result.currentStreak).toBe(1);
  });

  // ── Test 8: "skipped" check-ins do not count toward streak ─────────────────
  test('"skipped" check-in breaks a daily streak', () => {
    const checkinDate = d('2024-03-05');
    const checkIns = [
      { date: d('2024-03-03'), status: 'done' },
      { date: d('2024-03-04'), status: 'skipped' }, // skipped day = gap
      { date: d('2024-03-05'), status: 'done' },
    ];

    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    // Mar 4 was skipped, so streak on Mar 5 = 1
    expect(result.currentStreak).toBe(1);
  });

  // ── Test 9: Check-in status is "done" for streak — guard if not done ───────
  test('checking in with status "skipped" → currentStreak = 0', () => {
    const checkinDate = d('2024-03-05');
    const checkIns = [
      { date: d('2024-03-03'), status: 'done' },
      { date: d('2024-03-04'), status: 'done' },
      { date: d('2024-03-05'), status: 'skipped' }, // today is skipped
    ];

    const result = calculateStreak({
      ...BASE_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(0);
  });
});

// ─── Weekly habit tests ───────────────────────────────────────────────────────

describe('Weekly habit — calculateStreak', () => {
  const WEEKLY_PARAMS = {
    frequency: 'weekly',
    targetDaysPerWeek: 3,
    habitCreatedAt: d('2024-01-01'),
    longestStreak: 0,
  };

  // ── Test 10: Current week hits target → streak = 1 ─────────────────────────
  test('current week meets targetDaysPerWeek → streak = 1', () => {
    // Week of 2024-01-15 (Mon) to 2024-01-21 (Sun)
    const checkinDate = d('2024-01-17'); // Wednesday
    const checkIns = doneList(['2024-01-15', '2024-01-16', '2024-01-17']); // 3 done this week

    const result = calculateStreak({
      ...WEEKLY_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  // ── Test 11: Two consecutive weeks → streak = 2 ────────────────────────────
  test('two consecutive completed weeks → streak = 2', () => {
    const checkinDate = d('2024-01-24'); // Wednesday of week 2
    const checkIns = doneList([
      // Week 1: Jan 15-21
      '2024-01-15', '2024-01-16', '2024-01-17',
      // Week 2: Jan 22-28
      '2024-01-22', '2024-01-23', '2024-01-24',
    ]);

    const result = calculateStreak({
      ...WEEKLY_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  // ── Test 12: Previous week missed target → streak resets to 1 ──────────────
  test('previous week missed target → currentStreak = 1 (not 2)', () => {
    const checkinDate = d('2024-01-24');
    const checkIns = doneList([
      // Week 1: only 2 done (below target of 3) — this week is NOT completed
      '2024-01-15', '2024-01-16',
      // Week 2: 3 done — completed
      '2024-01-22', '2024-01-23', '2024-01-24',
    ]);

    const result = calculateStreak({
      ...WEEKLY_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(1);
  });

  // ── Test 13: Partial current week (below target) → streak = 0 ─────────────
  test('current week has fewer done days than target → streak = 0', () => {
    const checkinDate = d('2024-01-17');
    const checkIns = doneList(['2024-01-15', '2024-01-17']); // only 2, target is 3

    const result = calculateStreak({
      ...WEEKLY_PARAMS,
      checkinDate,
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(0);
  });

  // ── Test 14: Weekly longestStreak preserved after break ────────────────────
  test('weekly longestStreak is preserved after break', () => {
    const checkinDate = d('2024-01-17');
    const checkIns = doneList(['2024-01-15', '2024-01-16', '2024-01-17']); // streak = 1

    const result = calculateStreak({
      ...WEEKLY_PARAMS,
      checkinDate,
      longestStreak: 8, // had an 8-week streak before
      allCheckIns: checkIns,
    });

    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(8); // not overwritten
  });
});
