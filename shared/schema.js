// shared/schema.js — BlackSuite D1 schema.
//
// Imported by both workers (admin-worker/worker/index.js and portal-worker/worker.js).
// Idempotent: safe to call on every worker boot. Uses CREATE TABLE IF NOT EXISTS
// so existing rows are never touched.
//
// Called from each worker's existing ensureSchema() right after its own admin_*
// or clients tables are created, so foreign-key references resolve.

export const BS_SCHEMA_STATEMENTS = [
  // ── bs_files ───────────────────────────────────────────────────────────
  // Canonical file registry. `storage_backend` + `storage_key` together tell
  // storage.js how to stream/download. `owner_type` + `owner_id` keep the
  // table reusable across deliveries, proofs, invoices, future types.
  `CREATE TABLE IF NOT EXISTS bs_files (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     owner_type      TEXT    NOT NULL,                -- 'client' | 'delivery' | 'project' | 'invoice'
     owner_id        INTEGER NOT NULL,
     storage_backend TEXT    NOT NULL DEFAULT 'r2',    -- 'r2' | 'storj' | 'drive'
     storage_key     TEXT    NOT NULL,                 -- e.g. 'deliveries/2026/foo.jpg' or a Drive file-id
     label           TEXT    DEFAULT NULL,
     mime_type       TEXT    DEFAULT NULL,
     size            INTEGER DEFAULT NULL,
     created_at      INTEGER DEFAULT (strftime('%s','now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bs_files_owner ON bs_files(owner_type, owner_id)`,

  // ── bs_deliveries ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bs_deliveries (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     client_id   INTEGER NOT NULL,
     title       TEXT    NOT NULL,
     note        TEXT    DEFAULT NULL,
     status      TEXT    NOT NULL DEFAULT 'draft',   -- 'draft' | 'published' | 'expired'
     expires_at  INTEGER DEFAULT NULL,
     created_at  INTEGER DEFAULT (strftime('%s','now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bs_deliveries_client ON bs_deliveries(client_id)`,

  // ── bs_delivery_files ─ many-to-many linking table ─────────────────────
  `CREATE TABLE IF NOT EXISTS bs_delivery_files (
     delivery_id INTEGER NOT NULL,
     file_id     INTEGER NOT NULL,
     sort_order  INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (delivery_id, file_id)
   )`,

  // ── bs_selections ─ proofing reactions + comments ──────────────────────
  // Upserted on client reaction. One row per (client, file).
  `CREATE TABLE IF NOT EXISTS bs_selections (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     client_id  INTEGER NOT NULL,
     file_id    INTEGER NOT NULL,
     reaction   TEXT    NOT NULL,                    -- 'like' | 'maybe' | 'pass'
     comment    TEXT    DEFAULT NULL,
     updated_at INTEGER DEFAULT (strftime('%s','now')),
     UNIQUE (client_id, file_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bs_selections_file ON bs_selections(file_id)`,

  // ── bs_invoices ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bs_invoices (
     id                    INTEGER PRIMARY KEY AUTOINCREMENT,
     client_id             INTEGER NOT NULL,
     project_ref           TEXT    DEFAULT NULL,
     number                TEXT    NOT NULL,         -- human-facing invoice number e.g. INV-2026-0001
     subtotal              REAL    NOT NULL DEFAULT 0,
     tax                   REAL    NOT NULL DEFAULT 0,
     total                 REAL    NOT NULL DEFAULT 0,
     deposit_paid          REAL    NOT NULL DEFAULT 0,
     balance_due           REAL    NOT NULL DEFAULT 0,
     status                TEXT    NOT NULL DEFAULT 'draft', -- 'draft' | 'sent' | 'paid' | 'overdue'
     due_date              TEXT    DEFAULT NULL,     -- ISO yyyy-mm-dd
     note                  TEXT    DEFAULT NULL,
     payment_link_square   TEXT    DEFAULT NULL,
     payment_link_paypal   TEXT    DEFAULT NULL,
     created_at            INTEGER DEFAULT (strftime('%s','now'))
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bs_invoices_number ON bs_invoices(number)`,
  `CREATE INDEX IF NOT EXISTS idx_bs_invoices_client ON bs_invoices(client_id)`,

  // ── bs_invoice_items ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS bs_invoice_items (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     invoice_id  INTEGER NOT NULL,
     description TEXT    NOT NULL,
     qty         REAL    NOT NULL DEFAULT 1,
     rate        REAL    NOT NULL DEFAULT 0,
     amount      REAL    NOT NULL DEFAULT 0,
     sort_order  INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_bs_invoice_items_invoice ON bs_invoice_items(invoice_id)`,
];

/**
 * Ensure all BlackSuite tables + indexes exist on the given D1 database.
 * Safe to call on every cold start. Returns a boolean indicating success.
 *
 * @param {D1Database} db
 */
export async function ensureBlackSuiteSchema(db) {
  for (const sql of BS_SCHEMA_STATEMENTS) {
    await db.prepare(sql).run();
  }
  return true;
}
