# Handoff: The BlackSuite — Client Portal + Unified Admin Hub

## Overview

This handoff covers two remaining build priorities for **The BlackSuite**, LBMD's branded client operating system:

1. **The BlackSuite Client-Facing Portal** — A polished, branded experience for clients to review proofs, access final deliveries, view invoices, and pay. This is the public-facing side of the system (clients never see the admin).

2. **Unified Admin Hub** — A single centralized dashboard that consolidates all existing LBMD admin tools (booking admin, client portal composer, services/links, quick notes, analytics) into one authenticated entry point. Currently these are scattered across separate HTML files; they need to be unified under one shell with sidebar navigation.

The system runs on:
- **Cloudflare Workers** (API + proxy layer)
- **D1** (SQLite database)
- **Storj** (S3-compatible asset storage, proxied through Worker — clients never get raw Storj URLs)
- **Square** (primary payments) + **PayPal** (secondary)

---

## About the Design Files

The files in `reference/` are **HTML design prototypes** — they show the intended look, layout, interactions, and content. They are NOT production code to copy directly. The task is to **recreate these designs inside the existing Cloudflare Worker + D1 codebase** using its established routing, auth, and template patterns.

Before building, Claude Code should:
1. Audit `worker/index.js` for existing route structure and auth middleware
2. Read `schema.sql` for the current D1 schema
3. Read `the-blacksuite-build-plan.md` directly from the GitHub repo: `github.com/LuckyBlackMedia/LBMD` (root level) — this is the canonical implementation brief, read it first.
4. Inspect `lbm-admin-hub.html`, `lbm-booking-admin.html`, `admin.html`, `services.html` for existing admin shell patterns to reuse and extend

---

## Fidelity

**High-fidelity.** The reference files are pixel-level design mocks with final colors, typography, spacing, hover states, and interactions. Recreate the UI as closely as possible using the existing Worker/D1 stack. Where a component or pattern already exists in the codebase, reuse and upgrade it rather than rebuilding from scratch.

---

## Design Tokens

All tokens are defined in `reference/colors_and_type.css`. Key values:

### Colors
| Token | Value | Usage |
|---|---|---|
| `--gold` | `#B8962E` | Primary brand accent — every highlighted element |
| `--gold-light` | `#D4AF5A` | Hover states |
| `--gold-dark` | `#8C6D1F` | Active/pressed |
| `--black` | `#080808` | Base background |
| `--charcoal` | `#111111` | Elevated surfaces, nav, cards |
| `--dark` | `#2A2A2A` | Inputs, panels |
| `--silver` | `#BBBBBB` | Secondary text |
| `--mid` | `#909090` | Muted labels, metadata |
| `--off-white` | `#F7F4EE` | Primary text / headings |
| `--text` | `#DDDCDA` | Body copy |
| `--border` | `rgba(184,150,46,0.15)` | Gold border (subtle) |
| `--navy` | `#0D1B33` | Featured card gradient start |
| `--error` | `#B91C1C` | Error / delete states |
| `--success` | `#6daa45` | Paid / confirmed states |

### Typography
```html
<!-- Load these in every page -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:wght@700&display=swap" rel="stylesheet">
```

| Role | Font | Weight |
|---|---|---|
| Display / Headlines | Cormorant Garamond | 400, 600, 700 + italic |
| Body / UI / Inputs | Satoshi | 300, 400, 500, 700 |
| Eyebrows / All-caps labels | Montserrat | 700 |

### Transitions
- Default: `180ms cubic-bezier(.16,1,.3,1)`
- Card hover: `translateY(-2px)` + `box-shadow: 0 4px 12px rgba(0,0,0,.4)`
- Gold underline reveal: `scaleX(0→1)` on `::after` pseudo-element

### Border Radius
- Admin/portal UI: `6px` (inputs, cards), `8px` (panels), `12–16px` (modals), `9999px` (pills)
- Marketing/client-facing: `0` (sharp — matches existing homepage)

---

## 1. The BlackSuite Client-Facing Portal

### Purpose
Clients log in with a unique link/token and see only their project. No admin controls visible. Every page ends with "Powered by The BlackSuite · Lucky Black Media & Design."

### Auth Pattern
- Client access via tokenized URL (e.g. `/client/:token`) or session cookie
- Worker validates token against D1 `clients` table
- No username/password for clients — magic link or token-in-URL pattern
- Admin auth remains separate (existing lock screen pattern in `lbm-admin-hub.html`)

### Client Portal Screens

---

#### Screen 1: Client Dashboard (`/client/:token`)
**Purpose:** Landing page after client authenticates. Shows all their active projects at a glance.

**Layout:**
- Full-bleed dark background (`#080808`)
- Sticky nav: `height: 60px`, `background: rgba(8,8,8,0.96)`, `backdrop-filter: blur(16px)`, `border-bottom: 1px solid rgba(184,150,46,0.15)`
  - Left: LBM monogram logo (`height: 28px`) + "The BlackSuite" in Cormorant Garamond 700 gold + "Lucky Black Media & Design" in Satoshi 9px 700 all-caps silver beneath
  - Right: Client name in Satoshi 11px silver + animated gold session dot
- Hero greeting section: `padding: 80px 32px 40px`, `max-width: 1160px`, centered
  - Eyebrow: Montserrat 9px 700 all-caps gold — "Your Projects"
  - Headline: Cormorant Garamond 32px 700 off-white — "Welcome back, [Client Name]."
  - Subline: Satoshi 13px silver — "Here's everything we're working on together."
- Project cards grid: `grid-template-columns: repeat(2, 1fr)`, `gap: 3px`
  - Each card: `background: #111111`, `border: 1px solid rgba(184,150,46,0.06)`, `border-radius: 8px`, `padding: 24px`
  - Card contents: project type label (gold eyebrow) → project name (Cormorant 22px 600 off-white) → gold 1px rule → status badge (pill) → CTA button
  - Hover: `translateY(-2px)`, `box-shadow: 0 4px 12px rgba(0,0,0,.4)`, gold bottom `::after` bar reveals
- Footer: "Powered by The BlackSuite · Lucky Black Media & Design" — Satoshi 10px mid, centered, `border-top: 1px solid rgba(255,255,255,0.03)`

---

#### Screen 2: Proofing Gallery (`/client/:token/proof/:deliveryId`)
**Purpose:** Client reviews proof images/video, marks each as Like / Maybe / Pass, leaves comments, and submits selections.

**Reference file:** See `reference/blacksuite-portal.html` → Proofing tab for the full visual pattern.

**Layout:**
- Same nav as dashboard
- Header section: `padding: 80px 32px 28px`
  - Eyebrow: "Client Proofing"
  - Title: Cormorant Garamond 32px — "[Project Name] · Proof [N]"
  - Subtitle: selection count summary ("X liked · X maybe · X passed of N")
  - Right: "Submit Selections" button — Satoshi 10px 700 all-caps, gold fill, `border-radius: 6px`, `padding: 10px 24px`
- Filter tabs: All / Liked / Maybe / Passed — pill buttons, gold active state
- Media grid: `grid-template-columns: repeat(3, 1fr)`, `gap: 3px`
  - Each cell: `background: #111111`, `border-radius: 8px`, `overflow: hidden`
  - Image area: `aspect-ratio: 4/3`, renders actual image or video poster from Storj via Worker proxy
  - Video cells: show play button overlay
  - Bottom bar: filename + 3 reaction buttons (♥ Like, ? Maybe, ✕ Pass)
    - Reaction buttons: `width: 28px`, `height: 28px`, `border-radius: 9999px`
    - Selected state: colored background + border matching reaction (gold for like, red `#B91C1C` for pass, silver for maybe)
  - Selected cell: colored border matching reaction
- Comment drawer: clicking a cell opens a side panel or modal with per-file comment input
- Submit flow: "Submit Selections" posts to `/api/bs/submit-selections`, marks delivery as submitted in D1, shows confirmation state
- Auto-save: reactions POST to `/api/bs/select` on every click (no manual save needed)

---

#### Screen 3: Finals Delivery (`/client/:token/delivery/:deliveryId`)
**Purpose:** Client views and downloads final edited files. Photos in grid, videos inline.

**Reference file:** See `reference/blacksuite-portal.html` → Delivery tab.

**Layout:**
- Header: delivery title + "Download All (ZIP)" button (gold fill, right-aligned)
- Delivery note block: `background: rgba(184,150,46,0.06)`, `border: 1px solid rgba(184,150,46,0.15)`, `border-radius: 8px`, `padding: 14px 18px` — shows admin's note to client
- Expiry banner (if `expires_at` set): warm amber banner above note — "This delivery expires on [date]."
- Photo grid: `grid-template-columns: repeat(3, 1fr)`, `gap: 3px`
  - Each: actual image proxied from Storj via Worker, `aspect-ratio: 4/3`, `object-fit: cover`
  - Hover: overlay with download icon
  - Click: opens lightbox/fullscreen modal with keyboard nav (←→)
- Video section (below photo grid): list layout
  - Each row: `background: #111111`, `border-radius: 8px`, `padding: 16px 20px`
  - Left: play icon in gold bg square → filename + size
  - Right: Download button (pill outline gold)
  - Inline playback: clicking play loads video player in an expanded state (HTML5 `<video>` tag, src = Worker proxy URL with range request support)
- ZIP download: Worker streams ZIP on demand via `/api/bs/delivery/:id/zip`
- Footer: "Powered by The BlackSuite" as always

---

#### Screen 4: Invoice (`/client/:token/invoice/:invoiceId`)
**Purpose:** Client views a branded invoice and pays via Square or PayPal.

**Layout:**
- Clean, printable layout — `max-width: 760px`, centered, `padding: 60px 48px`
- Header: LBM lockup logo (left) + "INVOICE" in Cormorant Garamond 48px 700 gold (right)
- Meta row: Invoice # · Date Issued · Due Date — Satoshi 11px silver
- Gold 1px rule divider
- Bill To block: client name, company, email — Satoshi body
- Line items table:
  - Header row: Description / Qty / Rate / Amount — Montserrat 8px 700 all-caps gold
  - Each row: Satoshi 13px, `border-bottom: 1px solid rgba(255,255,255,0.04)`
  - Subtotal / Tax / **Total** rows at bottom — Total in Cormorant Garamond 24px 600 gold
- Deposit/balance section (if applicable): shows deposit paid + remaining balance
- Payment note: Satoshi 12px silver italic — "Payment processed securely via Square / PayPal"
- CTA: large "Pay Now — $X,XXX" button — full-width, gold fill, Montserrat 11px 700, `padding: 16px`
  - Links to Square checkout URL stored in D1 (`payment_link` field)
- "Download / Print Invoice" secondary link
- Footer: "Powered by The BlackSuite · Lucky Black Media & Design · Est. 2013"

---

## 2. Unified Admin Hub

### Purpose
Replace the current scattered admin files (`lbm-admin-hub.html`, `lbm-booking-admin.html`, `admin.html`, `services.html`) with a single authenticated shell that surfaces all tools from a persistent sidebar.

### Reference Files
- `reference/lbm-admin-hub-current.html` — current hub (link grid pattern to reuse)
- `reference/blacksuite-portal.html` → Admin Hub tab — upgraded visual pattern
- The existing lock screen from `lbm-admin-hub.html` should be reused as-is (it already works)

### Auth
- Reuse existing password lock screen from `lbm-admin-hub.html`
- Session stored in `localStorage` (existing pattern)
- Recovery code flow already implemented — keep it

### Layout Shell

```
┌─────────────────────────────────────────────────────┐
│  NAV BAR (sticky, 60px)                             │
│  [Logo] The BlackSuite · Admin    [Session ●] [Lock]│
├──────────┬──────────────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA                       │
│ 220px    │  (scrollable, max-width 1160px)          │
│          │                                          │
│ Dashboard│                                          │
│ Projects │                                          │
│ Proofing │                                          │
│ Delivery │                                          │
│ Invoices │                                          │
│ Booking  │                                          │
│ Links    │                                          │
│ Services │                                          │
│ Settings │                                          │
└──────────┴──────────────────────────────────────────┘
```

**Sidebar specs:**
- `width: 220px`, fixed, full-height
- `background: #080808`, `border-right: 1px solid rgba(184,150,46,0.10)`
- Each nav item: `padding: 10px 16px`, `border-radius: 6px`, Satoshi 11px 700 all-caps silver
  - Active: `background: rgba(184,150,46,0.10)`, `color: #B8962E`, left gold border `3px solid #B8962E`
  - Hover: `color: #B8962E`, subtle bg tint
- Section dividers: Montserrat 8px 700 all-caps gold label (e.g. "CLIENT WORK", "TOOLS")
- Bottom of sidebar: "Powered by The BlackSuite" in 9px mid

### Unified Admin Sections

| Section | Source | Notes |
|---|---|---|
| **Dashboard** | New | Project status, invoice summary, activity feed (from portal reference) |
| **Projects** | `admin.html` | Project list + create flow |
| **Proofing** | `admin.html` | Admin view of client selections, comments |
| **Delivery** | `admin.html` | Upload finals, publish delivery, manage files |
| **Invoices** | New (from portal reference) | Invoice builder + status tracker |
| **Booking** | `lbm-booking-admin.html` | Embed or port existing booking admin UI |
| **Links** | `lbm-admin-hub.html` | Existing link grid with add/edit/delete |
| **Services** | `services.html` | Services page editor |
| **Settings** | New | Password change, system config |

### Dashboard Section (inside unified hub)
Reuse the Dashboard screen from `reference/blacksuite-portal.html`:
- 4 stat cards: Active Projects / Proofing Pending / Outstanding $ / Month Revenue
- Active projects list (2-col grid of project cards)
- Activity feed (recent client actions)
- Quick Notes textarea (existing from `lbm-admin-hub.html`)

### Invoice Builder (new)
Admin form to create/edit invoices:
- Client selector (dropdown from D1)
- Project link (optional)
- Line items: dynamic add/remove rows — Description / Qty / Rate fields
- Tax toggle + rate input
- Deposit vs full payment toggle
- Payment processor: Square / PayPal radio
- Due date picker
- Note textarea (shown to client on invoice page)
- Save as Draft / Send to Client actions

---

## Interactions & Behavior

### Proofing
- Reactions auto-save to D1 via `POST /api/bs/select` on every click
- Filter tabs re-render grid client-side (no page reload)
- "Submit Selections" → confirmation modal → `POST /api/bs/submit-selections` → success state
- Lightbox: keyboard ← → navigation, ESC to close, swipe on mobile

### Delivery
- Images lazy-load via Intersection Observer
- Lightbox same pattern as proofing
- Video: HTML5 `<video>` with `preload="metadata"`, poster from Storj thumbnail key
- Range requests: Worker must pass through `Accept-Ranges`, `Content-Range` headers for scrubbing
- ZIP: triggered by `GET /api/bs/delivery/:id/zip`, Worker streams response

### Invoice
- "Pay Now" opens Square/PayPal URL in same tab (or new tab — confirm with LBMD)
- After payment, webhook updates D1 invoice status → invoice page shows "Paid" state

### Admin Hub Auth
- Lock screen covers entire viewport at `z-index: 1000`
- Correct password → `localStorage.setItem('lbm_auth', hash)` → main UI reveals
- Lock button re-engages lock screen
- Session dot pulses (gold, 2s animation) while authenticated

---

## State Management

### Client Portal
- `clientToken` — from URL param, validated server-side on every request
- `deliveryId` / `invoiceId` — from URL params
- `selections` — local React/JS state, synced to D1 on every reaction click
- `filter` — local state only (All / Liked / Maybe / Passed)

### Admin Hub
- `activeSection` — sidebar selection, persisted to `localStorage`
- `authState` — `localStorage` hash, checked on load
- `quickNotes` — `localStorage`, auto-save on blur
- All project/client/invoice data fetched from D1 via Worker API on section mount

---

## API Endpoints Needed

From `the-blacksuite-build-plan.md` — these should be added to `worker/index.js`:

```
# Client portal
GET  /client/:token                    → client dashboard
GET  /client/:token/proof/:deliveryId  → proofing gallery
GET  /client/:token/delivery/:deliveryId → finals delivery
GET  /client/:token/invoice/:invoiceId → invoice view

# Proofing API
POST /api/bs/select                    → save reaction {fileId, reaction}
POST /api/bs/submit-selections         → mark proof as submitted

# Delivery API
GET  /api/bs/stream/:fileId            → proxy file from Storj
GET  /api/bs/download/:fileId          → force-download file
GET  /api/bs/delivery/:id/zip          → stream ZIP of all delivery files

# Invoice API
POST /api/bs/invoice                   → create invoice
PATCH /api/bs/invoice/:id              → update invoice
GET  /api/bs/invoice/:id              → get invoice data
POST /api/bs/invoice/:id/payment-link  → generate Square/PayPal link

# Webhooks
POST /api/bs/webhooks/square           → payment status sync
POST /api/bs/webhooks/paypal           → payment status sync
```

---

## Assets

All logo files are in `reference/assets/`:
- `logo-monogram.png` — primary mark (use in nav)
- `logo-badge.png` — heritage circle seal (use in client-facing hero/footer)
- `logo-lockup.png` — full wordmark (use in invoice header, admin footer)

These should be moved to the Worker's static assets or served from Storj under a permanent public path.

---

## Files in This Package

```
reference/
  blacksuite-portal.html     ← MAIN REFERENCE: full portal UI kit
                               (Dashboard, Proofing, Delivery, Invoices, Admin Hub tabs)
  marketing-website.html     ← Marketing site reference (Homepage, Services, Work, Contact)
  lbm-admin-hub-current.html ← Current admin hub (link grid, lock screen, notes — reuse these)
  colors_and_type.css        ← All design tokens (colors, type, spacing, radius, shadows)
  assets/
    logo-monogram.png
    logo-badge.png
    logo-lockup.png
```

**Also in the main LBMD repo (already imported):**
```
worker/index.js              ← Cloudflare Worker — add new routes here
schema.sql                   ← D1 schema — extend with bs_ tables
lbm-booking-admin.html       ← Booking admin to unify
admin.html                   ← Admin shell to unify
services.html                ← Services page to unify
the-blacksuite-build-plan.md ← Full phased implementation brief (READ THIS FIRST)
```

---

## Implementation Notes

1. **Read `the-blacksuite-build-plan.md` first** — it is the canonical implementation brief covering all 6 phases in detail.
2. **Do not rebuild from scratch.** Reuse existing Worker routes, auth patterns, and D1 queries wherever possible.
3. **Clients never see raw Storj URLs.** All media must be proxied through the Worker.
4. **"Powered by The BlackSuite"** must appear on every client-facing page — subtle footer, 10px mid color.
5. **Mobile matters.** Client portal especially must work well on phones — clients will open deliveries and proof galleries on mobile.
6. **The unified admin hub** should absorb `lbm-admin-hub.html`, `lbm-booking-admin.html`, `admin.html`, and `services.html` — not replace them all at once. Build the shell first, embed existing pages in iframes or port them section by section.
7. **Invoice page** should be printable — add `@media print` styles that hide nav and show a clean black-on-white invoice layout.
