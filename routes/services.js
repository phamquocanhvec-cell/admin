// routes/services.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/services — public, used by booking page
router.get('/', (req, res) => {
  const services = db.prepare(`
    SELECT * FROM services WHERE status = 'active' ORDER BY category, name
  `).all();
  res.json(services);
});

// GET /api/services/all — admin, includes inactive
router.get('/all', authMiddleware, (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY category, name').all();
  res.json(services);
});

// GET /api/services/:id
router.get('/:id', (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!service) return res.status(404).json({ error: 'Service nicht gefunden.' });
  res.json(service);
});

// POST /api/services — admin only
router.post('/', authMiddleware, (req, res) => {
  const { name, description, price_from, duration, category, icon, status } = req.body;
  if (!name || !price_from || !duration) {
    return res.status(400).json({ error: 'Name, Preis und Dauer sind erforderlich.' });
  }

  const result = db.prepare(`
    INSERT INTO services (name, description, price_from, duration, category, icon, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', price_from, duration, category || 'Gel', icon || '💅', status || 'active');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Service erstellt.' });
});

// PUT /api/services/:id — admin only
router.put('/:id', authMiddleware, (req, res) => {
  const { name, description, price_from, duration, category, icon, status } = req.body;
  const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Service nicht gefunden.' });

  db.prepare(`
    UPDATE services SET name=?, description=?, price_from=?, duration=?, category=?, icon=?, status=?
    WHERE id=?
  `).run(name, description, price_from, duration, category, icon, status, req.params.id);

  res.json({ message: 'Service aktualisiert.' });
});

// DELETE /api/services/:id — admin only
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Service nicht gefunden.' });

  // Soft delete
  db.prepare("UPDATE services SET status = 'inactive' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Service deaktiviert.' });
});

module.exports = router;
