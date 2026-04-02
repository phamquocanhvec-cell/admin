// routes/customers.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// All customer routes are admin-only

// GET /api/customers
router.get('/', authMiddleware, (req, res) => {
  const { search, status, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT c.*, n.name as preferred_nailer_name
    FROM customers c
    LEFT JOIN nailers n ON n.id = c.preferred_nailer_id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (status) { query += ' AND c.status = ?'; params.push(status); }

  query += ' ORDER BY c.total_bookings DESC, c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// GET /api/customers/:id
router.get('/:id', authMiddleware, (req, res) => {
  const customer = db.prepare(`
    SELECT c.*, n.name as preferred_nailer_name
    FROM customers c
    LEFT JOIN nailers n ON n.id = c.preferred_nailer_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Kunde nicht gefunden.' });

  // Also fetch booking history
  const bookings = db.prepare(`
    SELECT b.*, n.name as nailer_name, s.name as service_name, s.price_from
    FROM bookings b
    JOIN nailers n ON n.id = b.nailer_id
    JOIN services s ON s.id = b.service_id
    WHERE b.customer_phone = ?
    ORDER BY b.date DESC
    LIMIT 20
  `).all(customer.phone);

  res.json({ ...customer, booking_history: bookings });
});

// POST /api/customers — admin: manually add customer
router.post('/', authMiddleware, (req, res) => {
  const { first_name, last_name, phone, email, birthday, preferred_nailer_id, allergies, notes, status } = req.body;
  if (!first_name || !phone) {
    return res.status(400).json({ error: 'Vorname und Telefon erforderlich.' });
  }

  const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone);
  if (existing) return res.status(409).json({ error: 'Kunde mit dieser Nummer existiert bereits.' });

  const result = db.prepare(`
    INSERT INTO customers (first_name, last_name, phone, email, birthday, preferred_nailer_id, allergies, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name || '', phone, email || '', birthday || null,
         preferred_nailer_id || null, allergies || '', notes || '', status || 'new');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Kunde erstellt.' });
});

// PUT /api/customers/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { first_name, last_name, phone, email, birthday, preferred_nailer_id, allergies, notes, status } = req.body;
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kunde nicht gefunden.' });

  db.prepare(`
    UPDATE customers SET first_name=?, last_name=?, phone=?, email=?, birthday=?,
    preferred_nailer_id=?, allergies=?, notes=?, status=?
    WHERE id=?
  `).run(first_name, last_name, phone, email, birthday, preferred_nailer_id, allergies, notes, status, req.params.id);

  res.json({ message: 'Kunde aktualisiert.' });
});

// DELETE /api/customers/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Kunde nicht gefunden.' });
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kunde gelöscht.' });
});

module.exports = router;
