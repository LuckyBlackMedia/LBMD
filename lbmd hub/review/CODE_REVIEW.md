# LBM Admin Suite — Code Review Package
## For Claude / Developer Review

---

## Files in This Package

| File | Purpose |
|---|---|
| `lbm-admin-hub.html` | Admin command center — branded link hub with add/edit/delete cards |
| `lbm-booking-admin.html` | Booking management — services, availability, clients, KPIs |
| `CODE_REVIEW.md` | This file |

---

## Architecture Overview

Both files are **self-contained single-page HTML applications** — no framework, no build step, no external API calls. Designed for deployment on Cloudflare Pages alongside a future Cloudflare Worker + D1 backend.

### Shared Patterns
- **Inline CSS** using custom properties (design tokens): `--gold`, `--charcoal`, `--navy`, etc.
- **Vanilla ES6 JS** — closures, arrow functions, template literals
- **No localStorage / sessionStorage** — all state is in-memory (required for sandboxed iframe compatibility)
- **Auth module** `LBM_AUTH` — shared IIFE in both files (see Security section below)

---

## Security Layer — `LBM_AUTH` Module

Located at the top of the `<script>` block in both files.

### Current Implementation (Client-Side Prototype)
```
LBM_AUTH = (() => { ... })()  // IIFE — encapsulates all auth state
```

### Features Implemented
- **Rate limiting**: 5 failed attempts triggers a 15-minute lockout
- **Session timeout**: 4-hour auto-expiry with activity reset on click/keydown/mousemove
- **Recovery code**: Offline backup key (`LBM-RCVR-8472`) bypasses password, triggers password-change prompt
- **Password change validation**: min 8 chars, confirm match, cannot reuse recovery code
- **Brute force UI**: lockout bar visible, login button disabled during cooldown

### Known Limitations (Intentional for Prototype)
```javascript
// TODO: These must be addressed before production deployment:

// 1. PASSWORD IS PLAINTEXT IN SOURCE
//    Current: CONFIG.password = 'lbm2024admin'
//    Fix: Hash with bcrypt on a Cloudflare Worker. Store hash in D1.
//         POST /api/auth/login → validate hash → return signed JWT (jose library)

// 2. RECOVERY CODE IS PLAINTEXT IN SOURCE
//    Current: CONFIG.recoveryCode = 'LBM-RCVR-8472'
//    Fix: Store hashed recovery code in D1. Worker validates hash.
//         Generate new recovery code after each use.

// 3. SESSION IS IN-MEMORY ONLY
//    Current: sessionExpires = Date.now() + 4h
//    Fix: Use HttpOnly cookie with JWT. CF Worker validates on each request.
//         Pattern: Worker middleware checks Authorization header or cookie.

// 4. RATE LIMITING IS CLIENT-SIDE
//    Current: attempts counter in JS closure
//    Fix: CF Worker rate limiting via KV or D1. IP-based lockout.
//         Cloudflare also has native rate limiting rules at the WAF level.

// 5. BOTH FILES SHARE SAME PASSWORD
//    Current: Same CONFIG.password string copied in both files
//    Fix: Single auth Worker endpoint. Both pages POST to same /api/auth/login.
```

---

## Data Flow

```
User interaction
      │
      ▼
  DOM events  ──►  JS state (links[], bookings[], services[], availData[])
                         │
                         ▼
                   renderAll() / renderBookings() etc.
                         │
                         ▼
                    DOM update

NOTE: No persistence between page loads. All data resets on refresh.
TODO: Wire render functions to CF Worker fetch() calls:
  GET  /api/bookings       → renderBookings(data)
  POST /api/bookings       → addBooking()
  PUT  /api/bookings/:id   → confirmBk() / cancelBk()
  DELETE /api/bookings/:id → deleteBk()
```

---

## Areas for Code Review

### 1. Consistency Checks
- [ ] Both files use `LBM_AUTH` — verify IIFE is identical in both
- [ ] `showToast()` function duplicated — candidate for a shared utility
- [ ] `DAYS` / `DAY_FULL` arrays defined in booking only — fine as-is
- [ ] CSS custom properties consistent across both files (both use same token names)
- [ ] Modal open/close pattern: hub uses `closeModal()`, booking uses `closeModal(id)` — **inconsistency to fix**
- [ ] Hub links to `booking-admin.html` in one place, `lbm-booking-admin.html` in another — **verify and unify**

### 2. Accessibility
- [ ] All modal `<div>`s should be `role="dialog"` with `aria-modal="true"` and `aria-labelledby`
- [ ] Lock screen inputs need `aria-describedby` pointing to error elements
- [ ] Toggle switches need `aria-checked` state sync
- [ ] All icon-only buttons (`✕`, `✏️`) need `aria-label`
- [ ] Focus trap inside open modals (Tab should cycle within modal)
- [ ] Skip link missing on both pages

### 3. Performance
- [ ] `renderAll()` in hub re-renders the entire DOM on every card add/edit/delete
      → Candidate for targeted DOM updates instead of full re-render
- [ ] `renderBookings()` called multiple times in `refreshAll()` — debounce candidate
- [ ] `setInterval` for session timer: store reference, clear on lockout ✓ (done)

### 4. JavaScript Quality
- [ ] `deleteCard(event, globalIdx)` uses array index which shifts on delete — use stable `id` field instead
- [ ] `editingIndex` global in hub — should be scoped inside a module
- [ ] `event` passed implicitly in `showPanel(id)` — should be explicit parameter
- [ ] Service `id` counter (`nextSvcId`, `nextBkId`) resets on page load — use UUID for stability
- [ ] `updateSlotData()` silently fails if elements not found — add null check logging

### 5. Production Readiness Checklist
- [ ] Move `CONFIG.password` and `CONFIG.recoveryCode` to CF Worker + D1
- [ ] Add CSP headers via `_headers` file on CF Pages
- [ ] Add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`
- [ ] Wire all data arrays to CF Worker API endpoints
- [ ] Add input sanitization before rendering user-supplied strings into innerHTML
      (currently: `link.label`, `link.desc`, `b.name` etc. rendered directly)
      Fix: use `textContent` for user data OR sanitize with DOMPurify

---

## Suggested Cloudflare Headers File (`_headers`)

```
/lbm-admin-hub.html
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com; font-src https://api.fontshare.com https://fonts.gstatic.com;

/lbm-booking-admin.html
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Recovery Code Instructions (Print & Store Offline)

```
╔══════════════════════════════════════╗
║  LBM Admin Recovery Code             ║
║                                      ║
║  Code:   LBM-RCVR-8472               ║
║                                      ║
║  Use if you forget your admin        ║
║  password. Enter on the lock screen  ║
║  via "Forgot access code?" link.     ║
║                                      ║
║  After use: immediately change       ║
║  password in Settings.               ║
║                                      ║
║  Store this offline only.            ║
║  Do NOT save in browser/email.       ║
╚══════════════════════════════════════╝
```

---

## Quick Start for Code Review

1. Open both HTML files in a browser side-by-side
2. Password: `lbm2024admin`  |  Recovery: `LBM-RCVR-8472`
3. Search for `// TODO` in both files — all production gaps are flagged inline
4. Search for `// REVIEW` for specific sections flagged for discussion

---
*Package generated: April 2026 — myluckyblackmedia.com*
