// db.js — SQLite database setup using better-sqlite3
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './miyu.db';
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT    UNIQUE NOT NULL,
    password  TEXT    NOT NULL,
    created_at TEXT   DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS nailers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    specialty  TEXT    NOT NULL,
    emoji      TEXT    DEFAULT '💅',
    rating     REAL    DEFAULT 5.0,
    phone      TEXT,
    email      TEXT,
    notes      TEXT,
    color      TEXT    DEFAULT 'gold',
    status     TEXT    DEFAULT 'active',
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    price_from  REAL    NOT NULL,
    duration    INTEGER NOT NULL,
    category    TEXT    DEFAULT 'Gel',
    icon        TEXT    DEFAULT '💅',
    status      TEXT    DEFAULT 'active',
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS slots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nailer_id  INTEGER NOT NULL REFERENCES nailers(id) ON DELETE CASCADE,
    date       TEXT    NOT NULL,
    time       TEXT    NOT NULL,
    is_booked  INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(nailer_id, date, time)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref  TEXT    UNIQUE NOT NULL,
    nailer_id    INTEGER NOT NULL REFERENCES nailers(id),
    service_id   INTEGER NOT NULL REFERENCES services(id),
    slot_id      INTEGER REFERENCES slots(id),
    date         TEXT    NOT NULL,
    time         TEXT    NOT NULL,
    customer_first TEXT  NOT NULL,
    customer_last  TEXT  DEFAULT '',
    customer_phone TEXT  NOT NULL,
    customer_email TEXT  DEFAULT '',
    note         TEXT    DEFAULT '',
    status       TEXT    DEFAULT 'confirmed',
    created_at   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT    NOT NULL,
    last_name     TEXT    DEFAULT '',
    phone         TEXT    UNIQUE NOT NULL,
    email         TEXT    DEFAULT '',
    birthday      TEXT,
    preferred_nailer_id INTEGER REFERENCES nailers(id),
    allergies     TEXT    DEFAULT '',
    notes         TEXT    DEFAULT '',
    status        TEXT    DEFAULT 'new',
    total_bookings INTEGER DEFAULT 0,
    total_spent    REAL   DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
  );
`);

// ─── Seed default admin ──────────────────────────────────────────────────────

function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'miyu2024secure';
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(username, hash);
    console.log(`✓ Admin user "${username}" created`);
  }
}

// ─── Seed demo data ──────────────────────────────────────────────────────────

function seedDemoData() {
  const nailersCount = db.prepare('SELECT COUNT(*) as c FROM nailers').get().c;
  if (nailersCount > 0) return; // already seeded

  // Nailers
  const insertNailer = db.prepare(`
    INSERT INTO nailers (name, specialty, emoji, rating, phone, email, color, status)
    VALUES (@name, @specialty, @emoji, @rating, @phone, @email, @color, @status)
  `);
  const nailers = [
    { name: 'Miyu', specialty: 'Gel & Nail Art', emoji: '👩‍🎨', rating: 5.0, phone: '+49 211 111 1111', email: 'miyu@miyu-studio.de', color: 'gold', status: 'active' },
    { name: 'Linh', specialty: 'Russische Maniküre', emoji: '💎', rating: 5.0, phone: '+49 211 111 1112', email: 'linh@miyu-studio.de', color: 'rose', status: 'active' },
    { name: 'Sophie', specialty: 'Spa & Pediküre', emoji: '🌺', rating: 4.5, phone: '+49 211 111 1113', email: 'sophie@miyu-studio.de', color: 'sage', status: 'active' },
    { name: 'Hana', specialty: 'Klassisch & French', emoji: '🌸', rating: 5.0, phone: '+49 211 111 1114', email: 'hana@miyu-studio.de', color: 'lavender', status: 'active' },
  ];
  nailers.forEach(n => insertNailer.run(n));

  // Services
  const insertService = db.prepare(`
    INSERT INTO services (name, description, price_from, duration, category, icon, status)
    VALUES (@name, @description, @price_from, @duration, @category, @icon, @status)
  `);
  const services = [
    { name: 'Klassische Maniküre', description: 'Pflege, Form & Politur für perfekte Nägel.', price_from: 35, duration: 45, category: 'Naturnagel', icon: '💅', status: 'active' },
    { name: 'Gel-Maniküre', description: 'Langanhaltende Farbe mit gel Versiegelung.', price_from: 55, duration: 60, category: 'Gel', icon: '✨', status: 'active' },
    { name: 'Russische Maniküre', description: 'Präzise Cuticle-Arbeit mit professionellen Aufsätzen.', price_from: 65, duration: 75, category: 'Naturnagel', icon: '🌸', status: 'active' },
    { name: 'Pediküre Klassisch', description: 'Fusspflege, Massage & Politur.', price_from: 45, duration: 50, category: 'Pediküre', icon: '🦶', status: 'active' },
    { name: 'Spa Pediküre', description: 'Luxuriöse Fußpflege mit Peeling & Maske.', price_from: 65, duration: 80, category: 'Pediküre', icon: '🛁', status: 'active' },
    { name: 'Nail Art & Design', description: 'Einzigartiger Stil – von French bis 3D Design.', price_from: 15, duration: 30, category: 'Nail Art', icon: '🎨', status: 'active' },
  ];
  services.forEach(s => insertService.run(s));

  // Generate slots for next 30 days
  const allNailers = db.prepare('SELECT id FROM nailers').all();
  const insertSlot = db.prepare(`
    INSERT OR IGNORE INTO slots (nailer_id, date, time) VALUES (?, ?, ?)
  `);
  const times = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];
  const today = new Date();

  allNailers.forEach(nailer => {
    for (let d = 1; d <= 30; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      if (date.getDay() === 0) continue; // skip Sundays
      const key = date.toISOString().slice(0, 10);
      // Pick a random subset of times for each nailer/day
      times.filter(() => Math.random() > 0.3).forEach(time => {
        insertSlot.run(nailer.id, key, time);
      });
    }
  });

  console.log('✓ Demo data seeded (nailers, services, slots)');
}

seedAdmin();
seedDemoData();

module.exports = db;
