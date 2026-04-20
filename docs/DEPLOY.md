# BlackSuite Deploy Guide

Branch: `phase-1-bones-upgrade`  
Workers: `lbmd-portal-api` (portal) · `lbm-admin-api` (admin)  
Database: `lbmd-portal-db` (D1, shared)  
Storage: `lbm-blacksuite-media` (R2)  
Sessions: KV namespace `006815380b47486c8c47928265161ae2`

---

## Prerequisites

```bash
npm install -g wrangler       # if not already installed
wrangler login                # browser OAuth with the CF account
wrangler whoami               # confirm: 7b69eaaaea3389e222f85ef951327c45
```

---

## 1. Create R2 bucket (once)

```bash
wrangler r2 bucket create lbm-blacksuite-media
```

Verify it appears in the Cloudflare dashboard under R2 → Buckets.

---

## 2. Set secrets

Secrets are never stored in source. Set them once per worker per environment.
Re-run `wrangler secret put` any time you rotate a value.

### Portal worker (`portal-worker/`)

```bash
cd portal-worker

# Required for Phase 1
wrangler secret put ADMIN_PASSWORD      # admin login password for /admin panel

# Required if using B2 overflow (optional — provision when R2 > 10 GB)
wrangler secret put B2_ENDPOINT        # e.g. https://s3.us-west-004.backblazeb2.com
wrangler secret put B2_ACCESS_KEY
wrangler secret put B2_SECRET_KEY
wrangler secret put B2_BUCKET
wrangler secret put B2_REGION          # default: us-west-004

# Required if using NAS archive tier (optional)
wrangler secret put NAS_ENDPOINT       # e.g. https://nas.yourdomain.com:9000
wrangler secret put NAS_ACCESS_KEY
wrangler secret put NAS_SECRET_KEY
wrangler secret put NAS_BUCKET
wrangler secret put NAS_REGION         # default: us-east-1
```

### Admin worker (`admin-worker/`)

```bash
cd admin-worker

# Phase 1 — required
wrangler secret put ADMIN_PASSWORD     # admin login password
wrangler secret put RECOVERY_CODE      # one-time recovery code (keep in vault)

# Phase 2 — required for email + calendar
wrangler secret put ICLOUD_APPLE_ID
wrangler secret put ICLOUD_APP_PASSWORD
wrangler secret put RESEND_API_KEY
wrangler secret put ADMIN_EMAIL

# Phase 3 — required for payments
wrangler secret put SQUARE_ACCESS_TOKEN
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET

# Optional overflow storage (same as portal)
wrangler secret put B2_ENDPOINT
wrangler secret put B2_ACCESS_KEY
wrangler secret put B2_SECRET_KEY
wrangler secret put B2_BUCKET
wrangler secret put B2_REGION
```

---

## 3. Deploy

```bash
# Portal worker
cd /path/to/LBMD/portal-worker
wrangler deploy

# Admin worker
cd /path/to/LBMD/admin-worker
wrangler deploy
```

Expected output: `Published lbmd-portal-api` / `Published lbm-admin-api` with the
route URLs. If deploy fails with a binding error, check that the R2 bucket exists
and the KV namespace IDs in `wrangler.toml` match the CF dashboard.

---

## 4. Verify

```bash
# Portal: should return 200 with HTML
curl -s -o /dev/null -w "%{http_code}" https://portal.myluckyblackmedia.com/

# Admin: should return 200 with HTML
curl -s -o /dev/null -w "%{http_code}" https://admin.myluckyblackmedia.com/

# API health: should return JSON
curl -s https://portal.myluckyblackmedia.com/api/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"clientId":"nonexistent","password":"test"}'
# Expected: {"error":"Incorrect access code."}  (not a 500)
```

---

## 5. Push to GitHub

```bash
cd /path/to/LBMD
git remote add origin git@github.com:LuckyBlackMedia/LBMD.git
git push -u origin phase-1-bones-upgrade
```

---

## Vault discipline

Before editing any live secret or config file, vault it first:

```bash
bin/vault.sh path/to/sensitive-file.js
```

The vault copies the file to `_vault/<YYYY-MM-DD>/...` (gitignored). This provides
a local snapshot before destructive edits. Never commit files from `_vault/`.

---

## Rollback

Cloudflare keeps the previous deployed version. To roll back:

```bash
# List recent deployments
wrangler deployments list --name lbmd-portal-api

# Roll back to a specific deployment ID
wrangler rollback <deployment-id> --name lbmd-portal-api
```

Or just re-deploy from the last good git commit:

```bash
git checkout <good-commit>
wrangler deploy
```

---

## D1 schema

Both workers call `ensureBlackSuiteSchema(env.DB)` on every boot — it runs
`CREATE TABLE IF NOT EXISTS` for all BlackSuite tables, so the schema is always
up to date without a separate migration step.

If you need to inspect the live database:

```bash
wrangler d1 execute lbmd-portal-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Post-deploy checklist

- [ ] Both workers return 200 on root URL
- [ ] Admin login works at `https://admin.myluckyblackmedia.com`
- [ ] Portal login works with a known test client
- [ ] `/api/bs/stream/<id>` proxies a file from R2
- [ ] R2 bucket visible in CF dashboard
- [ ] Branch pushed to GitHub
- [ ] `RECOVERY_CODE` stored securely (vault + password manager)
