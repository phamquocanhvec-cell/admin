// server.js — MIYU Nail Studio Backend
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security ────────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow Google Fonts in served HTML
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || '*'
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiter for booking and auth endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Body Parsing ────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (serve frontend) ──────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use('/api', apiLimiter);
app.use('/api/auth', strictLimiter, require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/nailers', require('./routes/nailers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/customers', require('./routes/customers'));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MIYU Nail Studio API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── SPA Fallback ────────────────────────────────────────────────────────────
// Serve index.html for any non-API route (for client-side routing)

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => {
    if (err) next(err);
  });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Ein Fehler ist aufgetreten.'
      : err.message
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌸 MIYU Nail Studio API running on http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`   Booking page: http://localhost:${PORT}/`);
  console.log(`   API docs: http://localhost:${PORT}/api/health\n`);
});
