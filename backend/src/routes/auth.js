const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Generate a signed JWT for a user.
 * Expires in 7 days — long enough to avoid constant re-logins on the free tier,
 * short enough to limit exposure if a token leaks.
 */
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

/** Extract express-validator errors and return early if any exist. */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true; // "has errors"
  }
  return false;
};

// ─── POST /api/auth/register ─────────────────────────────────────────────────

/**
 * Register a new user.
 * Body: { name, email, password }
 * Returns: { token, user }
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { name, email, password } = req.body;

      // Check for existing account before hashing (saves bcrypt work on dupe)
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: 'An account with that email already exists.' });
      }

      // Password is hashed by the pre-save hook in User.js
      const user = await User.create({ name, email, password });

      const token = signToken(user._id);

      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Log in with email + password.
 * Body: { email, password }
 * Returns: { token, user }
 *
 * Note: We use a single generic error message for wrong email OR wrong password
 * to avoid user enumeration attacks.
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { email, password } = req.body;

      // Explicitly re-select password (excluded by default in schema)
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }

      const token = signToken(user._id);

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Return the currently authenticated user's profile.
 * Protected — requires a valid JWT in the Authorization header.
 */
router.get('/me', protect, async (req, res) => {
  // req.user is attached by the protect middleware
  const user = req.user;
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    groups: user.groups,
    createdAt: user.createdAt,
  });
});

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────

/**
 * Update the authenticated user's name or avatar URL.
 * Body: { name?, avatar? }
 * Protected.
 */
router.patch(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('avatar')
      .optional({ nullable: true })
      .isURL()
      .withMessage('Avatar must be a valid URL'),
  ],
  async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const { name, avatar } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (avatar !== undefined) updates.avatar = avatar;

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
