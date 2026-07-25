const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model
 *
 * Stores authentication credentials and profile data.
 * Password is automatically hashed before save via a pre-save hook.
 * Avatar is stored as a URL string — no file uploads; users paste a URL
 * in Settings (design decision: keeps the backend stateless, no S3 needed).
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned by default in queries
    },
    // URL to an avatar image — optional, URL-only (no uploads)
    avatar: {
      type: String,
      default: null,
    },
    // Groups this user belongs to
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

/**
 * Pre-save hook: hash the password if it was modified.
 * bcryptjs with salt rounds = 12 (good balance of security vs. speed).
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Instance method: compare a plain-text password against the stored hash.
 * Usage: const isMatch = await user.comparePassword(plainText);
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
