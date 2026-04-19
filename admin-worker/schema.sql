-- LBM Admin Suite — D1 Schema
-- Database: lbmd-portal-db
-- Run with: wrangler d1 execute lbmd-portal-db --remote --file=schema.sql
--
-- All tables are prefixed admin_ to coexist with lbmd-portal-api tables.
-- The Worker also runs ensureSchema() lazily on first authenticated request,
-- so this file is only needed if you want to inspect or pre-seed the schema
-- outside of a Worker request.

-- ── LINKS (hub link cards) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name  TEXT    NOT NULL DEFAULT '',
  icon        TEXT    NOT NULL DEFAULT '🔗',
  label       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER
);

-- ── SERVICES (booking service types) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  duration    INTEGER NOT NULL DEFAULT 60,
  price       REAL    NOT NULL DEFAULT 0,
  max_per_day INTEGER,
  description TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER
);

-- ── BOOKINGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  date       TEXT    NOT NULL,   -- ISO date: YYYY-MM-DD
  time       TEXT    NOT NULL,   -- HH:MM
  service_id INTEGER REFERENCES admin_services(id) ON DELETE SET NULL,
  price      REAL    NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'pending',   -- pending | confirmed | cancelled
  notes      TEXT    NOT NULL DEFAULT '',
  created_at INTEGER
);

-- ── AVAILABILITY (weekly schedule, 0=Sun … 6=Sat) ────────────────────────────
CREATE TABLE IF NOT EXISTS admin_availability (
  day   INTEGER PRIMARY KEY,         -- 0–6
  open  INTEGER NOT NULL DEFAULT 1,  -- 0=closed, 1=open
  slots TEXT    NOT NULL DEFAULT '[]' -- JSON: [{start, end, note}]
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_date  ON admin_bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON admin_bookings(email);
CREATE INDEX IF NOT EXISTS idx_links_group    ON admin_links(group_name);
