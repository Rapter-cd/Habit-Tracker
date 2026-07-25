const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

/**
 * Group Model
 *
 * Represents a social accountability group.
 *
 * Design decisions:
 * - `inviteCode` is an 8-character nanoid generated at creation time.
 *   Short enough to share easily (copy-paste, type manually), unique enough
 *   that brute-force guessing is impractical (nanoid has ~1.7 trillion combos
 *   for 8 alpha-numeric characters).
 * - `members` is an array of User ObjectIds. For this scale (small social
 *   groups) a simple array is fine. For large groups we'd use a separate
 *   GroupMembership collection.
 * - The creator is automatically added to `members` in the route handler.
 */
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [80, 'Group name cannot exceed 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    inviteCode: {
      type: String,
      unique: true,
      // Generated in the pre-validate hook below so it's always set
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

/**
 * Auto-generate a unique invite code before validation if not already set.
 * nanoid(8) gives us 8-character alphanumeric IDs.
 */
groupSchema.pre('validate', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = nanoid(8);
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
