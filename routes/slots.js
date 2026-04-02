// routes/slots.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/slots?nailer_id=1&date=2025-04-01 — public
router.get('/', (req, res) => {
  const { nailer_id, date } = req.query;
  if (!nailer_id) return res.status(400).json({ error: 'nailer_id erforderlich.' });

  let query = 'SELECT * FROM slots WHERE nailer_id = ?';
  const params = [nailer_id];
  if (date) { query += ' AND date = ?'; params.push(date); }
  query += ' ORDER BY date, time';

  const slots = db.prepare(query).all(...params);
  res.json(slots);
});

// GET /api/slots/available-dates?nailer_id=1 — public, returns dates with free slots
router.get('/available-dates', (req, res) => {
  const { nailer_id } = req.query;
  if (!nailer_id) return res.status(400).json({ error: 'nailer_id erforderlich.' });

  const dates = db.prepare(`
    SELECT DISTINCT date FROM slots
    WHERE nailer_id = ? AND is_booked = 0 AND date >= date('now')
    ORDER BY date
  `).all(nailer_id);

  res.json(dates.map(r => r.date));
});

// POST /api/slots — admin: add individual slot(s)
router.post('/', authMiddleware, (req, res) => {
  const { nailer_id, date, times } = req.body;
  if (!nailer_id || !date || !times || !Array.isArray(times)) {
    return res.status(400).json({ error: 'nailer_id, date und times[] erforderlich.' });
  }

  const insert = db.prepare('INSERT OR IGNORE INTO slots (nailer_id, date, time) VALUES (?, ?, ?)');
  const insertMany = db.transaction(ts => ts.forEach(t => insert.run(nailer_id, date, t)));
  insertMany(times);

  res.status(201).json({ message: `${times.length} Slots erstellt.` });
});

// POST /api/slots/bulk — admin: generate slots for a date range
router.post('/bulk', authMiddleware, (req, res) => {
  const { nailer_id, from_date, to_date, times, skip_sunday } = req.body;
  if (!nailer_id || !from_date || !to_date || !times) {
    return res.status(400).json({ error: 'Alle Felder erforderlich.' });
  }

  const insert = db.prepare('INSERT OR IGNORE INTO slots (nailer_id, date, time) VALUES (?, ?, ?)');
  const insertMany = db.transaction(() => {
    const start = new Date(from_date);
    const end = new Date(to_date);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (skip_sunday !== false && d.getDay() === 0) continue;
      const key = d.toISOString().slice(0, 10);
      times.forEach(t => { insert.run(nailer_id, key, t); count++; });
    }
    return count;
  });

  const count = insertMany();
  res.status(201).json({ message: `${count} Slots erstellt.` });
});

// DELETE /api/slots/:id — admin: remove a single slot (if not booked)
router.delete('/:id', authMiddleware, (req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot nicht gefunden.' });
  if (slot.is_booked) return res.status(409).json({ error: 'Slot ist bereits gebucht.' });

  db.prepare('DELETE FROM slots WHERE id = ?').run(req.params.id);
  res.json({ message: 'Slot gelöscht.' });
});

// DELETE /api/slots/date — admin: remove all unbooked slots for a nailer on a date
router.delete('/date/:nailer_id/:date', authMiddleware, (req, res) => {
  const { nailer_id, date } = req.params;
  const result = db.prepare(`
    DELETE FROM slots WHERE nailer_id = ? AND date = ? AND is_booked = 0
  `).run(nailer_id, date);
  res.json({ message: `${result.changes} Slots gelöscht.` });
});

module.exports = router;
