const mongoose = require('mongoose');

/**
 * CheckIn Model
 *
 * Records a single day's check-in for a habit.
 *
 * Design decisions:
 * - `date` is stored as a JS Date normalised to midnight UTC (T00:00:00.000Z).
 *   This is enforced in the route handler before saving. Storing time-free dates
 *   as midnight UTC ensures the compound unique index (habitId + date) is
 *   reliable regardless of the server's local timezone.
 * - The compound unique index prevents duplicate check-ins for the same habit
 *   on the same day (idempotent POST behaviour).
 * - `status` enum: "done" counts toward streaks; "skipped" marks intentional
 *   rest days and does NOT break a streak (streak logic treats them like gaps
 *   for daily habits — see calculateStreak.js for details).
 */
const checkInSchema = new mongoose.Schema(
  {
    habitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: [true, 'CheckIn must reference a habit'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CheckIn must reference a user'],
      index: true,
    },
    // Stored as midnight UTC — do NOT store time component
    date: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['done', 'skipped'],
        message: 'Status must be "done" or "skipped"',
      },
      required: [true, 'Check-in status is required'],
    },
    // Optional note the user can attach to a check-in
    note: {
      type: String,
      trim: true,
      maxlength: [280, 'Note cannot exceed 280 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound unique index: one check-in per habit per day.
 * The `date` stored as midnight UTC makes this reliable across timezones.
 */
checkInSchema.index({ habitId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CheckIn', checkInSchema);
