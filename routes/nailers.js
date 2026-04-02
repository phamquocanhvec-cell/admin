// routes/nailers.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/nailers — public
router.get('/', (req, res) => {
  const nailers = db.prepare(`
    SELECT id, name, specialty, emoji, rating, color, status
    FROM nailers WHERE status = 'active' ORDER BY name
  `).all();
  res.json(nailers);
});

// GET /api/nailers/all — admin, full data
router.get('/all', authMiddleware, (req, res) => {
  const nailers = db.prepare('SELECT * FROM nailers ORDER BY name').all();

  // Attach booking counts
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM bookings
    WHERE nailer_id = ? AND status != 'cancelled'
  `);
  const result = nailers.map(n => ({
    ...n,
    booking_count: stmt.get(n.id).count
  }));
  res.json(result);
});

// GET /api/nailers/:id
router.get('/:id', (req, res) => {
  const nailer = db.prepare('SELECT * FROM nailers WHERE id = ?').get(req.params.id);
  if (!nailer) return res.status(404).json({ error: 'Nailer nicht gefunden.' });
  res.json(nailer);
});

// POST /api/nailers — admin only
router.post('/', authMiddleware, (req, res) => {
  const { name, specialty, emoji, phone, email, notes, color, status } = req.body;
  if (!name || !specialty) {
    return res.status(400).json({ error: 'Name und Spezialgebiet erforderlich.' });
  }

  const result = db.prepare(`
    INSERT INTO nailers (name, specialty, emoji, phone, email, notes, color, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, specialty, emoji || '💅', phone || '', email || '', notes || '', color || 'gold', status || 'active');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Nailer erstellt.' });
});

// PUT /api/nailers/:id — admin only
router.put('/:id', authMiddleware, (req, res) => {
  const { name, specialty, emoji, phone, email, notes, color, status } = req.body;
  const existing = db.prepare('SELECT id FROM nailers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nailer nicht gefunden.' });

  db.prepare(`
    UPDATE nailers SET name=?, specialty=?, emoji=?, phone=?, email=?, notes=?, color=?, status=?
    WHERE id=?
  `).run(name, specialty, emoji, phone, email, notes, color, status, req.params.id);

  res.json({ message: 'Nailer aktualisiert.' });
});

// DELETE /api/nailers/:id — admin only (soft delete)
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM nailers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nailer nicht gefunden.' });

  db.prepare("UPDATE nailers SET status = 'inactive' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Nailer deaktiviert.' });
});

module.exports = router;
