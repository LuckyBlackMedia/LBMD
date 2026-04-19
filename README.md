# LBMD — Lucky Black Media & Design

Consolidated working repo for **The BlackSuite**: client-facing portal + unified admin hub, powered by Cloudflare Workers + D1 + R2 (+ Storj).

## Subsystems

| Path | Purpose | Deployed as |
|---|---|---|
| `admin-worker/` | Admin API + admin HTML assets | `admin.myluckyblackmedia.com`, `services.myluckyblackmedia.com` |
| `portal-worker/` | Client portal worker (inline HTML + API) | `portal.myluckyblackmedia.com` |
| `portfolio-app/` | (symlink) React portfolio + admin | `portfolio.myluckyblackmedia.com` |
| `blacksuite/` | Design handoff reference (read-only) | — |
| `shared/` | `storage.js`, `schema.js`, `blacksuite-tokens.css` — imported by both workers | — |
| `images/blacksuite/` | Logo assets (monogram, badge, lockup) | served as static assets |
| `website/` | Marketing site HTML (homepage, contact, etc.) — future work | — |
| `docs/` | Security review, migration runbook, deploy instructions | — |
| `bin/vault.sh` | Pre-edit snapshot helper | — |
| `_vault/` | Local timestamped backups of every modified file (gitignored) | — |

## Workflow

1. Branch per phase (`phase-1-bones-upgrade`, `phase-2-delivery`, …)
2. Before editing any file: `bin/vault.sh <file>`
3. Commit with `[P<phase>-<deliverable>]` prefix (e.g. `[P1-B] hub sidebar shell`)
4. Push branch → PR → merge to `main` after verification
5. Secrets never committed — use `wrangler secret put`

See `docs/DEPLOY.md` for deploy steps, `docs/SECURITY_REVIEW.md` for auth posture, `docs/MIGRATION.md` for Drive → R2/Storj plan.
