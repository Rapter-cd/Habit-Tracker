require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const checkinRoutes = require('./routes/checkins');
const groupRoutes = require('./routes/groups');
const analyticsRoutes = require('./routes/analytics');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(morgan('dev')); // HTTP request logger

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/habits/:id/checkin', checkinRoutes); // nested: POST /api/habits/:id/checkin
app.use('/api/habits/:id/history', checkinRoutes); // nested: GET /api/habits/:id/history
app.use('/api/groups', groupRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health-check — useful for Render's zero-downtime checks
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── 404 catch-all ───────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ─── Global error handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app; // exported for supertest in Phase 3
