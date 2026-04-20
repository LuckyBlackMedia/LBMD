// shared/storage.js — BlackSuite file storage abstraction.
//
// Backends supported:
//   r2    → Cloudflare R2 (env.MEDIA binding). Primary for new uploads.
//   storj → S3-compatible, via STORJ_* secrets. For clients who prefer Storj.
//   drive → Google Drive share URLs (legacy). Read-only passthrough proxy.
//
// Key format: "<backend>:<path>"
//   r2:deliveries/2026/foo.jpg
//   storj:deliveries/2026/foo.jpg
//   drive:1A2B3C4D5E6F-<file-id-here>
//
// Any route that proxies file content should call storage.get() and stream
// the returned body + headers back to the client — NEVER expose the raw
// Storj/R2/Drive URL.

const DRIVE_DOWNLOAD_URL = (id) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;

const DRIVE_VIEW_URL = (id) =>
  `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;

export function parseStorageKey(full) {
  if (typeof full !== 'string' || !full.includes(':')) {
    return { backend: 'r2', key: String(full || '') };
  }
  const idx = full.indexOf(':');
  return { backend: full.slice(0, idx), key: full.slice(idx + 1) };
}

export class Storage {
  /**
   * @param {object} env — worker env. Needs env.MEDIA (R2 binding) for r2,
   *                        and STORJ_* secrets for storj.
   */
  constructor(env) {
    this.env = env;
    this.r2 = env.MEDIA || null;
  }

  // ── GET ────────────────────────────────────────────────────────────────
  /**
   * Fetch an object for streaming back to a client.
   * @param {string} full — '<backend>:<key>' or plain key (assumes r2)
   * @param {object} opts — { range?: 'bytes=0-1023', ifNoneMatch?: string }
   * @returns {Promise<{ body: ReadableStream|null, status: number, headers: Headers }>}
   */
  async get(full, opts = {}) {
    const { backend, key } = parseStorageKey(full);
    if (backend === 'r2')    return this.#getR2(key, opts);
    if (backend === 'storj') return this.#getStorj(key, opts);
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
          ...(end    !== undefined && offset !== undefined
                ? { length: end - offset + 1 } : {}),
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

  async #getStorj(key, { range, ifNoneMatch } = {}) {
    // Storj offers an S3-compatible gateway. Simplest integration path is to
    // call the gateway with SigV4 signing. In Phase 1 we lean on a signed-URL
    // model so the worker isn't bundling a crypto signer for every request:
    // - If STORJ_PUBLIC_PREFIX is set (a shared-link gateway), we fetch via HTTP.
    // - Otherwise we use SigV4 headers via a minimal inline signer (future).
    //
    // Today (Storj empty) we only need the public-prefix path.
    const prefix = this.env.STORJ_PUBLIC_PREFIX;
    if (!prefix) {
      throw new Error(
        'STORJ_PUBLIC_PREFIX not configured. Set it to the Storj gateway URL ' +
        '(e.g. https://gateway.storjshare.io/<bucket>/) or wire the SigV4 signer.',
      );
    }
    const url = prefix.endsWith('/') ? prefix + key : `${prefix}/${key}`;
    const headers = new Headers();
    if (range)         headers.set('range', range);
    if (ifNoneMatch)   headers.set('if-none-match', ifNoneMatch);
    const res = await fetch(url, { headers });
    return this.#proxyResponse(res);
  }

  async #getDrive(fileId, { range, ifNoneMatch } = {}) {
    // Proxy the Drive share URL server-side. Clients never see the Drive URL.
    // Drive returns 302 → Google's CDN; follow redirects.
    const url = DRIVE_DOWNLOAD_URL(fileId);
    const headers = new Headers();
    if (range)       headers.set('range', range);
    if (ifNoneMatch) headers.set('if-none-match', ifNoneMatch);
    const res = await fetch(url, { headers, redirect: 'follow' });
    return this.#proxyResponse(res);
  }

  // Normalise a fetch() Response into our common return shape.
  #proxyResponse(res) {
    const headers = new Headers();
    for (const [k, v] of res.headers) {
      // Strip headers that would confuse the downstream client (hop-by-hop, auth).
      if (['set-cookie', 'authorization', 'content-encoding'].includes(k.toLowerCase())) continue;
      headers.set(k, v);
    }
    return { body: res.body, status: res.status, headers };
  }

  // ── PUT ────────────────────────────────────────────────────────────────
  /**
   * Upload an object. Returns the storage key written (with backend prefix).
   * @param {string} backend — 'r2' | 'storj'
   * @param {string} key — relative key (no backend prefix)
   * @param {ReadableStream|ArrayBuffer|string} body
   * @param {object} meta — { contentType?, contentLength? }
   */
  async put(backend, key, body, meta = {}) {
    if (backend === 'r2') {
      if (!this.r2) throw new Error('R2 binding MEDIA not configured');
      const httpMetadata = {};
      if (meta.contentType)   httpMetadata.contentType   = meta.contentType;
      if (meta.contentLength) httpMetadata.contentLength = meta.contentLength;
      await this.r2.put(key, body, { httpMetadata });
      return `r2:${key}`;
    }
    if (backend === 'storj') {
      throw new Error('storj put() not implemented in Phase 1 — add SigV4 signer first');
    }
    if (backend === 'drive') {
      throw new Error('drive is read-only; register the Drive file-id as a bs_files row directly');
    }
    throw new Error(`Unknown backend: ${backend}`);
  }

  // ── REMOVE ─────────────────────────────────────────────────────────────
  async remove(full) {
    const { backend, key } = parseStorageKey(full);
    if (backend === 'r2') {
      if (!this.r2) throw new Error('R2 binding MEDIA not configured');
      await this.r2.delete(key);
      return true;
    }
    if (backend === 'storj') throw new Error('storj remove() not implemented');
    if (backend === 'drive') return false; // never delete Drive files from the worker
    throw new Error(`Unknown backend: ${backend}`);
  }

  // ── SIGNED URL (stub) ──────────────────────────────────────────────────
  // For future Storj migration and potential direct-to-R2 uploads from the
  // browser. Not used in Phase 1.
  async signedUrl(/* full, ttlSeconds */) {
    throw new Error('signedUrl() not implemented in Phase 1');
  }

  // ── Helper: legacy drive_url → bs_files-shaped record ──────────────────
  // Lets the portal worker treat old client_files rows as bs_files
  // without a DB migration. Extracts a Drive file-id from the share URL.
  static legacyDriveFileFromUrl(row) {
    const url = row.drive_url || '';
    // Accepts:
    //   https://drive.google.com/file/d/<ID>/view?...
    //   https://drive.google.com/open?id=<ID>
    //   https://drive.google.com/uc?id=<ID>&...
    let id = null;
    let m = /\/file\/d\/([^/]+)/.exec(url);
    if (m) id = m[1];
    if (!id) {
      m = /[?&]id=([^&]+)/.exec(url);
      if (m) id = m[1];
    }
    if (!id) return null;
    return {
      id: row.id,
      owner_type: 'client',
      owner_id:   row.client_id,
      storage_backend: 'drive',
      storage_key:     `drive:${id}`,
      label:      row.label || row.subtitle || null,
      mime_type:  null,
      size:       null,
      created_at: null,
    };
  }
}

// Convenience helper for the 99% call site: one-liner construction.
export function storage(env) { return new Storage(env); }
