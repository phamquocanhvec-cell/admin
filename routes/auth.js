// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
  }

  const valid = bcrypt.compareSync(password, admin.password);
  if (!valid) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
  }

  const token = signToken({ id: admin.id, username: admin.username });
  res.json({ token, username: admin.username });
});

// GET /api/auth/me — verify token
router.get('/me', authMiddleware, (req, res) => {
  res.json({ id: req.admin.id, username: req.admin.username });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Beide Felder erforderlich.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(401).json({ error: 'Aktuelles Passwort falsch.' });
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, req.admin.id);
  res.json({ message: 'Passwort erfolgreich geändert.' });
});

module.exports = router;
