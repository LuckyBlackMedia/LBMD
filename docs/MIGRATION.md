# BlackSuite Migration — Google Drive → R2

This runbook covers moving legacy client files from Google Drive to Cloudflare R2
so they are served through the BlackSuite storage proxy instead of raw Drive URLs.

## Background

Older portal clients have files stored in `client_files.drive_url` (Google Drive share
links). The new schema uses `bs_files` rows with `storage_backend = 'r2'` and a
`storage_key` like `deliveries/2026/<filename>`. Until a file is migrated the workers
fall back to `Storage.legacyDriveFileFromUrl()` and proxy through Drive — that path
remains in production but Drive imposes rate limits and requires signed-in sessions for
some files.

## Key format

| Backend | Example key stored in `bs_files.storage_key` |
|---------|-----------------------------------------------|
| R2      | `r2:deliveries/2026/smith-wedding-finals.zip` |
| B2      | `b2:deliveries/2026/smith-wedding-finals.zip` |
| Drive   | `drive:1A2B3C4D5EF...` (legacy, read-only)    |

Prefix is parsed by `parseStorageKey()` in `shared/storage.js`. Omitting the prefix
defaults to `r2`.

## Suggested R2 key layout

```
deliveries/<year>/<client-id>-<slug>.<ext>
proofs/<year>/<client-id>-<slug>.<ext>
invoices/<year>/<client-id>-<number>.<ext>
```

## Step-by-step

### 1. Identify files to migrate

```sql
-- All legacy Drive files still in client_files
SELECT id, client_id, label, drive_url
FROM   client_files
WHERE  drive_url IS NOT NULL
ORDER  BY client_id;
```

Cross-reference with `bs_files` to avoid re-migrating anything already there:

```sql
SELECT cf.id, cf.client_id, cf.label, cf.drive_url
FROM   client_files cf
LEFT JOIN bs_files bf
       ON bf.owner_type = 'client'
      AND bf.owner_id   = cf.client_id
      AND bf.storage_backend != 'drive'
WHERE  cf.drive_url IS NOT NULL
  AND  bf.id IS NULL;
```

### 2. Download from Drive

Drive export URL: `https://drive.google.com/uc?export=download&id=<file-id>`

Extract the file-id from the share URL:
- `/file/d/<id>/view` → capture `<id>`
- `?id=<id>` query param → capture `<id>`

`Storage.legacyDriveFileFromUrl(row)` does this extraction — you can call it from a
migration script to get the `drive:<id>` storage key, then call `storage.get()` to
stream the body.

### 3. Upload to R2

```js
const storage = new Storage(env);

// Example: migrate one client_files row to R2
async function migrateFile(env, cfRow) {
  const fake = Storage.legacyDriveFileFromUrl(cfRow);
  if (!fake) throw new Error('Could not parse Drive URL: ' + cfRow.drive_url);

  const { body, status } = await storage.get(fake.storage_key);
  if (status !== 200 || !body) throw new Error('Drive fetch failed: ' + status);

  const year    = new Date().getFullYear();
  const slug    = cfRow.label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || String(cfRow.id);
  const ext     = cfRow.mime_type?.split('/').pop() || 'bin';
  const r2Key   = `deliveries/${year}/${cfRow.client_id}-${slug}.${ext}`;

  const r2StorageKey = await storage.put('r2', r2Key, body, {
    contentType: cfRow.mime_type || 'application/octet-stream',
  });

  // Insert into bs_files
  await env.DB.prepare(`
    INSERT INTO bs_files (owner_type, owner_id, storage_backend, storage_key, label, mime_type)
    VALUES ('client', ?, 'r2', ?, ?, ?)
  `).bind(cfRow.client_id, r2Key, cfRow.label || null, cfRow.mime_type || null).run();

  return r2StorageKey; // 'r2:deliveries/2026/...'
}
```

### 4. Verify the proxy

After inserting the `bs_files` row, verify the file streams correctly:

```
GET /api/bs/stream/<bs_files.id>       (admin token)
GET /api/bs/stream/<bs_files.id>?t=<portal-token>   (client token)
```

Both workers return the R2 object body with correct `Content-Type` and
`Content-Disposition` headers. The admin worker also supports `Range` requests for
video scrubbing.

### 5. Retire the Drive URL (optional)

Once all clients confirm access, you can NULL out `client_files.drive_url`:

```sql
UPDATE client_files SET drive_url = NULL WHERE id = ?;
```

The legacy fallback in both workers will simply skip the row. Do **not** delete Drive
files until you have confirmed R2 delivery is working for every client — Drive is the
backup until you're sure.

## Bulk migration script

For a full migration run, expose a one-off admin endpoint or run locally with
`wrangler dev` + `curl`. Do not migrate more than ~50 files per invocation to stay
within Cloudflare Worker CPU limits.

## Checklist

- [ ] R2 bucket `lbm-blacksuite-media` created
- [ ] Both workers deployed with `MEDIA` binding pointing to the bucket
- [ ] Run the identification query above; note total count
- [ ] Migrate files in batches of 50 or fewer
- [ ] Spot-check 3–5 migrated files via the `/api/bs/stream/` proxy
- [ ] Confirm client portals load without Drive redirect errors
- [ ] NULL out `drive_url` for migrated rows after client sign-off
- [ ] Monitor R2 usage in Cloudflare dashboard (free tier: 10 GB storage, 1M Class A ops/mo)
