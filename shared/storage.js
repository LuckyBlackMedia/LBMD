// shared/storage.js — BlackSuite file storage abstraction.
//
// Backends supported:
//   r2    → Cloudflare R2 (env.MEDIA binding). Primary for new uploads.
//   b2    → Backblaze B2 S3-compatible API, via B2_* secrets.
//           $6/TB/mo storage, $0 egress via Cloudflare Bandwidth Alliance.
//           Use as overflow when R2 free tier (10 GB) is exceeded.
//           Secrets: B2_ENDPOINT, B2_ACCESS_KEY, B2_SECRET_KEY, B2_BUCKET,
//                    B2_REGION (default: us-west-004)
//   nas   → NAS device exposing an S3-compatible API (Synology S3 Gateway,
//           TrueNAS Minio, QNAP HBS, etc.), via NAS_* secrets.
//           Best for local backup / archive — NOT primary delivery.
//           Secrets: NAS_ENDPOINT (e.g. https://nas.yourdomain.com:9000),
//                    NAS_ACCESS_KEY, NAS_SECRET_KEY, NAS_BUCKET,
//                    NAS_REGION (default: us-east-1)
//   drive → Google Drive share URLs (legacy). Read-only passthrough proxy.
//
// Key format: "<backend>:<path>"
//   r2:deliveries/2026/foo.jpg
//   b2:deliveries/2026/foo.jpg
//   nas:deliveries/2026/foo.jpg
//   drive:1A2B3C4D5E6F-<file-id-here>
//
// Any route that proxies file content must call storage.get() and stream the
// returned body + headers back to the client — NEVER expose raw storage URLs.
//
// SigV4 signing (B2 + NAS): both use #s3Compat() which builds AWS SigV4
// Authorization inline via crypto.subtle — no external dependencies.

// ── SigV4 helpers ──────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function _sha256(data) {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  return crypto.subtle.digest('SHA-256', buf);
}

async function _sha256hex(data) {
  return Array.from(new Uint8Array(await _sha256(data))).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _hmac(keyBuf, data) {
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, typeof data === 'string' ? enc.encode(data) : data);
}

async function _hmacHex(keyBuf, data) {
  return Array.from(new Uint8Array(await _hmac(keyBuf, data))).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _sigV4Headers(method, url, { accessKey, secretKey, region, service = 's3', range, ifNoneMatch } = {}) {
  const u = new URL(url);
  const now = new Date();
  const amzDate  = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStr  = amzDate.slice(0, 8);

  const canonicalUri     = u.pathname.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/') || '/';
  const canonicalQuery   = u.searchParams.toString();
  const payloadHash      = 'UNSIGNED-PAYLOAD';

  const hdrObj = { host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (range)       hdrObj['range']        = range;
  if (ifNoneMatch) hdrObj['if-none-match'] = ifNoneMatch;

  const signedList    = Object.keys(hdrObj).sort();
  const canonHeaders  = signedList.map(k => `${k}:${hdrObj[k]}`).join('\n') + '\n';
  const signedHeaders = signedList.join(';');

  const canonReq  = [method, canonicalUri, canonicalQuery, canonHeaders, signedHeaders, payloadHash].join('\n');
  const reqHash   = await _sha256hex(canonReq);
  const credScope = `${dateStr}/${region}/${service}/aws4_request`;
  const strToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${reqHash}`;

  const sigKey = await _hmac(
    await _hmac(
      await _hmac(
        await _hmac(enc.encode(`AWS4${secretKey}`), dateStr),
        region
      ),
      service
    ),
    'aws4_request'
  );
  const signature = await _hmacHex(sigKey, strToSign);

  const headers = new Headers();
  for (const [k, v] of Object.entries(hdrObj)) headers.set(k, v);
  headers.set('authorization',
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope},SignedHeaders=${signedHeaders},Signature=${signature}`);
  return headers;
}

// ── Drive helpers ──────────────────────────────────────────────────────────

const DRIVE_DOWNLOAD_URL = (id) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;

// ── Key parser ─────────────────────────────────────────────────────────────

export function parseStorageKey(full) {
  if (typeof full !== 'string' || !full.includes(':')) {
    return { backend: 'r2', key: String(full || '') };
  }
  const idx = full.indexOf(':');
  return { backend: full.slice(0, idx), key: full.slice(idx + 1) };
}

// ── Storage class ──────────────────────────────────────────────────────────

export class Storage {
  /**
   * @param {object} env — worker env.
   *   R2:  env.MEDIA (R2 binding)
   *   B2:  env.B2_ENDPOINT, B2_ACCESS_KEY, B2_SECRET_KEY, B2_BUCKET, B2_REGION
   *   NAS: env.NAS_ENDPOINT, NAS_ACCESS_KEY, NAS_SECRET_KEY, NAS_BUCKET, NAS_REGION
   */
  constructor(env) {
    this.env = env;
    this.r2  = env.MEDIA || null;
  }

  // ── GET ──────────────────────────────────────────────────────────────────

  async get(full, opts = {}) {
    const { backend, key } = parseStorageKey(full);
    if (backend === 'r2')    return this.#getR2(key, opts);
    if (backend === 'b2')    return this.#s3Compat(this.#b2Config(), key, opts);
    if (backend === 'nas')   return this.#s3Compat(this.#nasConfig(), key, opts);
    if (backend === 'drive') return this.#getDrive(key, opts);
    throw new Error(`Unknown storage backend: ${backend}`);
  }

  async #getR2(key, { range, ifNoneMatch } = {}) {
    if (!this.r2) throw new Error('R2 binding MEDIA not configured');
    const r2opts = {};
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        const offset = m[1] === '' ? undefined : Number(m[1]);
        const end    = m[2] === '' ? undefined : Number(m[2]);
        r2opts.range = {
          ...(offset !== undefined ? { offset } : {}),
          ...(end !== undefined && offset !== undefined ? { length: end - offset + 1 } : {}),
        };
      }
    }
    if (ifNoneMatch) r2opts.onlyIf = { etagDoesNotMatch: ifNoneMatch };

    const obj = await this.r2.get(key, r2opts);
    if (!obj) return { body: null, status: 404, headers: new Headers() };

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('accept-ranges', 'bytes');
    if (obj.range) {
      const total = obj.size;
      const start = obj.range.offset || 0;
      const end   = (obj.range.offset || 0) + (obj.range.length || obj.size) - 1;
      headers.set('content-range', `bytes ${start}-${end}/${total}`);
      headers.set('content-length', String(obj.range.length || 0));
      return { body: obj.body, status: 206, headers };
    }
    headers.set('content-length', String(obj.size));
    return { body: obj.body, status: 200, headers };
  }

  // Shared GET path for B2 and NAS (both S3-compatible).
  async #s3Compat(cfg, key, { range, ifNoneMatch } = {}) {
    const url = `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key}`;
    const headers = await _sigV4Headers('GET', url, {
      accessKey: cfg.accessKey, secretKey: cfg.secretKey,
      region: cfg.region, range, ifNoneMatch,
    });
    const res = await fetch(url, { headers });
    return this.#proxyResponse(res);
  }

  async #getDrive(fileId, { range, ifNoneMatch } = {}) {
    const url     = DRIVE_DOWNLOAD_URL(fileId);
    const headers = new Headers();
    if (range)       headers.set('range', range);
    if (ifNoneMatch) headers.set('if-none-match', ifNoneMatch);
    const res = await fetch(url, { headers, redirect: 'follow' });
    return this.#proxyResponse(res);
  }

  #proxyResponse(res) {
    const headers = new Headers();
    for (const [k, v] of res.headers) {
      if (['set-cookie', 'authorization', 'content-encoding'].includes(k.toLowerCase())) continue;
      headers.set(k, v);
    }
    return { body: res.body, status: res.status, headers };
  }

  // ── PUT ──────────────────────────────────────────────────────────────────

  async put(backend, key, body, meta = {}) {
    if (backend === 'r2') {
      if (!this.r2) throw new Error('R2 binding MEDIA not configured');
      const httpMetadata = {};
      if (meta.contentType)   httpMetadata.contentType   = meta.contentType;
      if (meta.contentLength) httpMetadata.contentLength = meta.contentLength;
      await this.r2.put(key, body, { httpMetadata });
      return `r2:${key}`;
    }
    if (backend === 'b2')  return this.#putS3Compat(this.#b2Config(),  key, body, meta);
    if (backend === 'nas') return this.#putS3Compat(this.#nasConfig(), key, body, meta);
    if (backend === 'drive') throw new Error('drive is read-only');
    throw new Error(`Unknown backend: ${backend}`);
  }

  async #putS3Compat(cfg, key, body, { contentType, contentLength } = {}) {
    const url     = `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key}`;
    const headers = await _sigV4Headers('PUT', url, {
      accessKey: cfg.accessKey, secretKey: cfg.secretKey, region: cfg.region,
    });
    if (contentType)   headers.set('content-type',   contentType);
    if (contentLength) headers.set('content-length', String(contentLength));
    const res = await fetch(url, { method: 'PUT', headers, body });
    if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${await res.text()}`);
    const prefix = cfg === this.#b2Config() ? 'b2' : 'nas';
    return `${prefix}:${key}`;
  }

  // ── REMOVE ───────────────────────────────────────────────────────────────

  async remove(full) {
    const { backend, key } = parseStorageKey(full);
    if (backend === 'r2') {
      if (!this.r2) throw new Error('R2 binding MEDIA not configured');
      await this.r2.delete(key);
      return true;
    }
    if (backend === 'b2')  return this.#removeS3Compat(this.#b2Config(),  key);
    if (backend === 'nas') return this.#removeS3Compat(this.#nasConfig(), key);
    if (backend === 'drive') return false; // never delete Drive files from the worker
    throw new Error(`Unknown backend: ${backend}`);
  }

  async #removeS3Compat(cfg, key) {
    const url     = `${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key}`;
    const headers = await _sigV4Headers('DELETE', url, {
      accessKey: cfg.accessKey, secretKey: cfg.secretKey, region: cfg.region,
    });
    const res = await fetch(url, { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed: ${res.status}`);
    return true;
  }

  // ── CONFIG BUILDERS ──────────────────────────────────────────────────────

  #b2Config() {
    const e = this.env;
    if (!e.B2_ENDPOINT || !e.B2_ACCESS_KEY || !e.B2_SECRET_KEY || !e.B2_BUCKET) {
      throw new Error('B2 not configured. Set B2_ENDPOINT, B2_ACCESS_KEY, B2_SECRET_KEY, B2_BUCKET secrets.');
    }
    return {
      endpoint:  e.B2_ENDPOINT,
      accessKey: e.B2_ACCESS_KEY,
      secretKey: e.B2_SECRET_KEY,
      bucket:    e.B2_BUCKET,
      region:    e.B2_REGION || 'us-west-004',
    };
  }

  #nasConfig() {
    const e = this.env;
    if (!e.NAS_ENDPOINT || !e.NAS_ACCESS_KEY || !e.NAS_SECRET_KEY || !e.NAS_BUCKET) {
      throw new Error(
        'NAS not configured. Set NAS_ENDPOINT (e.g. https://nas.yourdomain.com:9000), ' +
        'NAS_ACCESS_KEY, NAS_SECRET_KEY, NAS_BUCKET secrets. ' +
        'Enable S3-compatible API on your NAS: Synology S3 Gateway, TrueNAS Minio, or QNAP HBS.',
      );
    }
    return {
      endpoint:  e.NAS_ENDPOINT,
      accessKey: e.NAS_ACCESS_KEY,
      secretKey: e.NAS_SECRET_KEY,
      bucket:    e.NAS_BUCKET,
      region:    e.NAS_REGION || 'us-east-1',
    };
  }

  // ── SIGNED URL (stub) ────────────────────────────────────────────────────
  async signedUrl(/* full, ttlSeconds */) {
    throw new Error('signedUrl() not implemented in Phase 1');
  }

  // ── Helper: legacy drive_url → bs_files-shaped record ───────────────────
  static legacyDriveFileFromUrl(row) {
    const url = row.drive_url || '';
    let id = null;
    let m  = /\/file\/d\/([^/]+)/.exec(url);
    if (m) id = m[1];
    if (!id) {
      m = /[?&]id=([^&]+)/.exec(url);
      if (m) id = m[1];
    }
    if (!id) return null;
    return {
      id:              row.id,
      owner_type:      'client',
      owner_id:        row.client_id,
      storage_backend: 'drive',
      storage_key:     `drive:${id}`,
      label:           row.label || row.subtitle || null,
      mime_type:       null,
      size:            null,
      created_at:      null,
    };
  }
}

// Convenience helper for the 99% call site.
export function storage(env) { return new Storage(env); }
