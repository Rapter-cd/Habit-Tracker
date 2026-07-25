const mongoose = require('mongoose');

/**
 * Habit Model
 *
 * Represents a single trackable habit belonging to one user.
 *
 * Design decisions:
 * - `frequency` enum keeps options explicit; future "monthly" support just
 *   adds to the enum without schema migration.
 * - `targetDaysPerWeek` is only meaningful when frequency === "weekly"; the
 *   streak calculation function ignores it for daily habits.
 * - `currentStreak` and `longestStreak` are stored (denormalised) on the
 *   document so leaderboard/summary queries are O(1) reads, not aggregations.
 * - `archived` (soft-delete) lets users hide habits without losing history.
 */
const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Habit must belong to a user'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: [100, 'Habit name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
      maxlength: [40, 'Category cannot exceed 40 characters'],
    },
    frequency: {
      type: String,
      enum: {
        values: ['daily', 'weekly'],
        message: 'Frequency must be either "daily" or "weekly"',
      },
      default: 'daily',
    },
    // Only used when frequency === "weekly": how many days per week must be
    // checked in for the week to count as "completed".
    targetDaysPerWeek: {
      type: Number,
      min: [1, 'Target must be at least 1 day per week'],
      max: [7, 'Target cannot exceed 7 days per week'],
      default: 3,
    },
    // Denormalised streak values — updated by the check-in endpoint.
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Soft-delete: archived habits are hidden from the dashboard by default
    // but their check-in history is preserved.
    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model('Habit', habitSchema);
