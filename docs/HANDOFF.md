# BlackSuite Phase 1 — Handoff

Last updated: 2026-04-20. Branch: `phase-1-bones-upgrade`.

---

## Status

### ✅ Done

| Phase | Description |
|-------|-------------|
| 0     | Consolidated working tree at `~/Documents/LBMD/`, vault helper (`bin/vault.sh`), `.gitignore`, seed commit. |
| 1-A   | BlackSuite tokens CSS at `shared/blacksuite-tokens.css` (copied to `admin-worker/css/` for ASSETS binding). |
| 1-B   | Unified admin hub shell in `admin-worker/lbm-admin-hub.html` — sidebar markup, nav, section routing with `localStorage` persistence, settings panel with password change wired to `/api/auth/change-password`. |
| 1-C   | Portal visual upgrade (`portal-worker/worker.js`) — Cormorant Garamond + Satoshi fonts, full BlackSuite token set, text monogram replacing base64 logo, `.bs-powered` footer, 2-col file grid. |
| 1-D   | `shared/storage.js` — R2 (primary) / B2 (overflow) / NAS (archive) / Drive (legacy read-only) backends; inline SigV4 signing; `legacyDriveFileFromUrl()` for existing `client_files` rows. |
| 1-E   | `bs_files` proxy routes in both workers: `/api/bs/stream/:id` + `/api/bs/download/:id`. Admin-gated in admin worker; client-token-gated (Bearer or `?t=`) in portal worker. Ownership checks + legacy Drive fallback. |
| 1-F   | PBKDF2-SHA-256 password hashing (100k iterations, 32-byte per-user salt). Format: `pbkdf2:v1:<salt-hex>:<hash-hex>`. Legacy SHA-256 rows detected on login and upgraded in-place in D1 / KV. |
| 1-G   | `shared/schema.js` — `ensureBlackSuiteSchema()` + `BS_SCHEMA_STATEMENTS` for `bs_files`, `bs_deliveries`, `bs_delivery_files`, `bs_selections`, `bs_invoices`, `bs_invoice_items`. |
| 1-I   | `docs/MIGRATION.md` (Drive → R2 runbook) and `docs/DEPLOY.md` (secrets, deploy, verify, rollback). |
| Sec   | Security hardening: XSS escaping (`esc()` + `safeUrl()`) in all four portal render functions; per-client brute-force lockout on portal login; CORS locked to specific origins on both workers. |

### ⚪ Pending

- **Deploy** — see `docs/DEPLOY.md`.
  1. `wrangler r2 bucket create lbm-blacksuite-media`
  2. Set all secrets (`wrangler secret put …`) for both workers
  3. `wrangler deploy` in `portal-worker/` then `admin-worker/`
  4. Verify endpoints (curl checks in `docs/DEPLOY.md`)
  5. `git push origin phase-1-bones-upgrade`

- **Portfolio iframe CSP** — `portfolio.myluckyblackmedia.com` needs
  `Content-Security-Policy: frame-ancestors https://admin.myluckyblackmedia.com`
  so it can be embedded in the admin hub sidebar. Touch when working on `portfolio-app`.

- **Phase 2** — booking reminders (cron), iCloud CalDAV sync, Resend email.
- **Phase 3** — Square + PayPal payment flows.
- **Drive → R2 migration** — run after deploy; see `docs/MIGRATION.md`.

---

## Storage architecture

| Tier    | Backend | Config secrets              | Purpose                          |
|---------|---------|-----------------------------|----------------------------------|
| Primary | R2      | `MEDIA` binding (wrangler.toml) | All new uploads; 10 GB free   |
| Overflow| B2      | `B2_*` secrets              | $6/TB/mo; $0 egress via CF Alliance |
| Archive | NAS     | `NAS_*` secrets             | Local backup only; not client-facing |
| Legacy  | Drive   | none                        | Read-only passthrough for existing rows |

Key format: `<backend>:<path>` (e.g. `r2:deliveries/2026/foo.zip`). No prefix → defaults to `r2`.

---

## Key paths

| Path | Description |
|------|-------------|
| `portal-worker/worker.js` | Portal worker entry + inline HTML |
| `admin-worker/worker/index.js` | Admin worker entry |
| `admin-worker/lbm-admin-hub.html` | Admin hub single-page app |
| `shared/storage.js` | Storage abstraction (R2/B2/NAS/Drive) |
| `shared/schema.js` | BlackSuite D1 schema |
| `shared/blacksuite-tokens.css` | Design tokens CSS |
| `docs/DEPLOY.md` | Deploy + secrets reference |
| `docs/MIGRATION.md` | Drive → R2 migration runbook |
| `bin/vault.sh` | Pre-edit backup helper |
| `_vault/` | Gitignored snapshots (vault output) |

---

## Security notes

- **Passwords**: PBKDF2-SHA-256, 100k iterations, 32-byte random salt per hash.
  Legacy SHA-256+static-salt rows are auto-upgraded on first login.
- **CORS**: Portal locked to `https://portal.myluckyblackmedia.com`;
  admin locked to `{admin,services}.myluckyblackmedia.com`.
- **Rate limiting**: Both admin and portal login endpoints enforce 5-attempt
  per-identifier KV lockout (15-minute TTL).
- **XSS**: All DB-sourced text rendered into innerHTML passes through `esc()`;
  all hrefs sourced from DB pass through `safeUrl()` (https-only).
- **Secrets**: Never in source. Set via `wrangler secret put`. See `docs/DEPLOY.md`.
- **Storage URLs**: Never exposed to clients. All file access goes through
  `/api/bs/stream/:id` or `/api/bs/download/:id` — worker proxies the bytes.

---

## Injection defence reminder

During Drive → R2 migration, the worker may stream file contents from Drive.
Treat those bytes as untrusted binary data — never parse or execute them.
File metadata (labels, descriptions) stored in D1 is already escaped at render time.
