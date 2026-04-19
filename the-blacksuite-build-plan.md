# The BlackSuite Build and Implementation Plan

## Purpose

This document is the implementation brief for Claude Code to extend the existing LBMD portal into **The BlackSuite**, a branded end-to-end client system for proofing, delivery, invoicing, and client-facing project management.

The current platform already has major pieces in place:
- Existing Cloudflare Workers backend
- Existing D1 database
- Existing client portal shell
- Existing admin dashboard shell
- Existing proofing module shell
- Existing delivery module shell
- Existing Square integration

The goal is **not** to rebuild from scratch. The goal is to retrofit and upgrade the current portal into a full self-hosted alternative to Pixieset/Bloom, with stronger branding, tighter workflow integration, and centralized admin control.

Every client-facing page should include:

> Powered by The BlackSuite

---

## Product Vision

The BlackSuite should function as a full branded client operating system for LBMD projects across:
- Photography
- Videography
- Events
- Design projects

Core lifecycle:

1. Admin creates or manages a client project.
2. Admin uploads proof assets.
3. Client reviews proofs, likes/dislikes/maybes, and leaves comments.
4. Admin reviews selections and completes edits or production work.
5. Admin uploads final deliverables.
6. Client views or streams final media directly in the portal.
7. Client downloads final files individually or as a ZIP.
8. Admin issues a branded invoice.
9. Client views a branded invoice page and pays via Square or PayPal.
10. Dashboard reflects project, delivery, and payment status in one system.

This should become a self-hosted branded alternative to Pixieset/Bloom, but more flexible because it is integrated directly into LBMD's existing infrastructure and workflows.

---

## Existing System Assumptions

Claude Code should assume the following already exist in the current codebase and should be reused where possible:

- Cloudflare Workers application entrypoint and route structure
- D1 database binding and migration system
- Existing auth/session handling for admin and clients
- Existing client records in D1
- Existing project/dashboard shell UI
- Existing proofing gallery implementation pulling from Google Drive through a Worker
- Existing final delivery flow that currently redirects clients to a folder for download
- Existing admin module for uploads/delivery management in partial form
- Existing admin reporting/dashboard shell
- Existing Square integration or helper utilities

Claude Code should inspect the current code before introducing new abstractions. Prefer extending existing patterns over inventing parallel systems.

---

## High-Level Architecture

### Storage
Use **Storj** as the primary asset storage layer for media and deliverables.

### App Layer
Continue using the existing **Cloudflare Worker** as the API and media proxy layer.

### Database
Continue using **D1** for projects, deliveries, files, selections, invoice records, and logging.

### Frontend
Continue using the existing portal/frontend stack. Replace or refine modules instead of rebuilding them.

### Core Principle
Clients should never be exposed directly to raw Storj URLs. The Worker should proxy, authorize, and stream all client-facing access so the entire experience stays branded and controlled under LBMD/The BlackSuite.

---

## Build Priorities

Recommended order of implementation:

1. Storj integration and Worker file endpoints
2. Finals delivery upgrade (current weakest client-facing experience)
3. Proofing module replacement/refinement from Google Drive to Storj-backed system
4. Admin composer/upload refinement
5. Invoicing module
6. Dashboard rewiring and analytics updates

This order minimizes risk and gives the largest UX payoff earliest.

---

# Phase 0: Discovery and Retrofit Mapping

Before building features, Claude Code should map the existing implementation.

## Step 0.1 — Audit Existing Portal Structure

Identify and document:
- Worker entry files and route files
- Existing D1 schema and client/project relationships
- Existing auth middleware and session patterns
- Existing proofing gallery code path
- Existing final delivery code path
- Existing admin upload/composer code path
- Existing dashboard widgets and data queries
- Existing Square payment integration utilities

## Step 0.2 — Create a Retrofit Map

Produce a clear mapping of:
- What can be reused as-is
- What should be replaced entirely
- What only needs endpoint rewiring
- What UI components need light enhancement
- What schema additions are needed

## Step 0.3 — Confirm Naming Conventions

Use a consistent namespace such as:
- `bs_` table prefixes for new D1 tables if needed
- `/api/bs/` for new Worker endpoints
- “The BlackSuite” branding on shared components

If the current codebase already has stronger conventions, follow those instead.

---

# Phase 1: Storj Integration Foundation

This phase is the core infrastructure swap from Google Drive/folder delivery to self-hosted branded storage and delivery.

## Goal

Replace Drive-backed asset access with Storj-backed asset storage, proxied through the Worker.

## Step 1.1 — Storj Setup

Claude Code should expect environment variables/secrets for:
- `STORJ_ACCESS_KEY`
- `STORJ_SECRET_KEY`
- `STORJ_ENDPOINT`
- `STORJ_BUCKET`

Recommended bucket concept:
- One main bucket for BlackSuite media/deliverables

Recommended key structure:
- `clientId/projectId/proof/fileId-filename`
- `clientId/projectId/final/fileId-filename`
- Optional subfolders for thumbnails/posters if needed

## Step 1.2 — Storj Helper Layer

Create a reusable utility module for S3-compatible Storj access.

It should support:
- Upload object
- Get object/stream object
- Delete object
- List objects if needed
- Range request pass-through for media streaming
- Presigned upload support only if truly useful; otherwise direct Worker proxy upload is acceptable

Implementation notes:
- Use native `fetch`
- Use AWS Signature V4 signing compatible with Workers
- Avoid introducing large SDK dependencies if current code style prefers lightweight utilities

## Step 1.3 — Worker Media Access Pattern

All client-facing file/media access should use Worker routes, not direct Storj links.

Needed route categories:
- Upload endpoint(s)
- Delivery file listing endpoint
- Media stream endpoint
- Download endpoint
- ZIP endpoint
- Delete endpoint

The Worker should:
- Validate access rights
- Read file metadata from D1
- Resolve Storj key
- Proxy the file or stream to the client
- Preserve appropriate content-type/content-length/accept-ranges headers where possible

## Step 1.4 — D1 File Metadata Model

Add or refine database support for:
- Projects
- Deliveries
- Files
- Selections/comments
- Download logs

Recommended structure:

### `bs_projects`
Fields:
- `id`
- `client_id`
- `type` (`photography`, `videography`, `event`, `design`)
- `name`
- `status`
- `created_at`

### `bs_deliveries`
Fields:
- `id`
- `project_id`
- `stage` (`proof`, `final`)
- `note`
- `expires_at`
- `published`
- `created_at`

### `bs_files`
Fields:
- `id`
- `delivery_id`
- `storj_key`
- `filename`
- `mimetype`
- `size`
- `sort_order`
- `created_at`

### `bs_selections`
Fields:
- `id`
- `file_id`
- `client_id`
- `reaction` (`like`, `pass`, `maybe`)
- `comment`
- `created_at`

### `bs_download_log`
Fields:
- `id`
- `file_id`
- `client_id`
- `downloaded_at`

Claude Code should adapt table structure to the existing schema if there is already a project/files model in place.

## Step 1.5 — Migration Strategy

If the current proofing system depends on Google Drive folder IDs and Drive file IDs:
- Preserve old references temporarily during migration
- Do not break current production proofing until Storj-backed replacement is verified
- Add compatibility mapping where necessary for staged rollout

---

# Phase 2: Upgrade Finals Delivery Module

This is the highest-impact user-facing upgrade because the current implementation redirects users to a folder for download.

## Goal

Replace folder-style final delivery with a branded in-portal viewing and download experience.

## Requirements

### Client Delivery Experience
The final delivery page should support:
- Direct photo viewing in a polished gallery/grid
- Inline video playback without redirect
- Download individual files
- Download all files as ZIP
- Delivery note/message
- Expiry messaging/countdown
- Clear branding
- “Powered by The BlackSuite” footer

## Step 2.1 — Replace Redirect Flow

Find the current final-delivery action that sends users to a folder and replace it with a dedicated final delivery view.

That view should be tied to a delivery record in D1.

## Step 2.2 — Build Final Delivery Components

Refine or create the following UI components:
- `DeliveryHeader`
- `DeliveryNote`
- `MediaGrid`
- `PhotoLightbox`
- `VideoPlayer`
- `DownloadAllBar`
- `ExpiryBanner`
- `BlackSuiteFooter`

## Step 2.3 — Photo Handling

Photo support should include:
- Thumbnails/grid display
- Fullscreen lightbox/modal
- Keyboard navigation if current stack supports it
- Per-file download action
- Strong mobile usability

## Step 2.4 — Video Handling

Video support should include:
- Inline HTML5 playback
- Range request support for scrubbing/seek
- Poster thumbnail if available
- No redirect to third-party storage page
- Download button for original file

## Step 2.5 — ZIP Download

Provide a delivery-wide ZIP download option.

Implementation options:
- Stream ZIP on demand via Worker using a zip library compatible with Workers
- Or create/stage ZIP assets if that proves more reliable for large deliveries

Claude Code should choose the most stable approach for the current stack and expected file sizes.

## Step 2.6 — Expiry Logic

If a delivery has an expiry date:
- Show it clearly in the UI
- Enforce it in the Worker
- Return a branded expired state instead of a generic error

---

# Phase 3: Replace and Expand Proofing Module

The current proofing module already exists and pulls from Google Drive via Worker. It allows clients to like/dislike and comment. This should be adapted into the Storj-backed BlackSuite proofing flow.

## Goal

Replace the Drive-backed proofing source and expand the UX to better support client review across photography, video, event, and design projects.

## Step 3.1 — Replace File Source

Swap all Google Drive folder/file loading logic for D1 + Storj-backed file records.

The UI shell can remain if well-structured, but data should come from:
- Delivery record lookup
- Files table lookup
- Selections table lookup

## Step 3.2 — Expand Reaction Model

The current like/dislike flow should become:
- Like
- Pass
- Maybe

This gives a more flexible proofing process closer to creative review workflows.

## Step 3.3 — Maintain and Improve Comments

Retain per-file comment capability.

Enhancements to consider:
- Better placement/visibility of comment input
- Clear display of existing comments
- Optional admin reply support if easy to add within the existing system

## Step 3.4 — Add Proofing UX Improvements

Enhance the existing module with:
- Selection counter
- Filter tabs (All, Liked, Maybe, Passed, Commented)
- Bulk actions where appropriate
- “Submit Selections” flow
- Auto-save to D1
- Better mobile layout if current module is weak on smaller screens

## Step 3.5 — Add Completion State

Once the client finishes proofing, the system should support:
- A completion action/button
- Marking the proof stage as submitted
- Exposing the result in the admin dashboard

## Step 3.6 — Support Mixed Media Types

Proofing should work not just for still photos but also for:
- Short video clips
- Design comps/images
- Event recap assets

Claude Code should inspect the current viewer and make it flexible enough for mixed media.

---

# Phase 4: Refine Admin Upload and Delivery Composer

The admin shell is partially established. This phase adapts it to the full BlackSuite workflow.

## Goal

Make admin upload, project setup, and delivery publishing cohesive and centered inside one portal workflow.

## Step 4.1 — Project and Delivery Management

Admin should be able to:
- Select an existing client
- Create or select a project
- Set project type
- Create a proof delivery or final delivery
- Add a delivery note
- Set an expiry date
- Save as draft or publish

## Step 4.2 — Storj Upload Flow

The admin uploader should:
- Support drag-and-drop and file picker
- Upload directly into Storj via Worker
- Attach files to the correct delivery record
- Show upload progress
- Validate allowed file types
- Support large files reliably, especially for video

If chunked or multipart upload is needed for large assets, Claude Code should implement that at this stage or design the uploader to support it.

## Step 4.3 — Delivery File Management

Admin should be able to:
- Reorder files
- Remove files
- Replace files
- Preview files
- Distinguish proof files vs final files

## Step 4.4 — Preview as Client

A preview mode should allow admin to see the final proofing or delivery page as the client would see it before publishing.

## Step 4.5 — Fit Existing Workflow

Since the goal is centralization, Claude Code should optimize for the existing LBMD admin flow rather than forcing a brand-new workflow.

Prefer:
- Extending current admin screens
- Upgrading form structure and actions
- Reusing current navigation and dashboard entry points

---

# Phase 5: Invoicing System

A branded invoice system should be added as part of The BlackSuite.

## Goal

Clients should see a branded invoice page from LBMD/The BlackSuite, while actual payment is processed through Square or PayPal.

This preserves brand consistency without requiring a custom payment processor.

## Core Invoice Flow

1. Admin creates an invoice in BlackSuite.
2. Invoice is linked to a client and optionally a project.
3. Client receives a branded invoice page.
4. Client clicks Pay Now.
5. Payment is completed through Square or PayPal.
6. BlackSuite updates invoice status after payment.

## Step 5.1 — D1 Invoice Tables

Recommended tables:

### `bs_invoices`
Fields:
- `id`
- `client_id`
- `project_id`
- `status` (`draft`, `sent`, `viewed`, `partial`, `paid`, `overdue`)
- `subtotal`
- `tax`
- `total`
- `deposit_amount`
- `deposit_paid`
- `balance_paid`
- `due_date`
- `payment_processor` (`square`, `paypal`)
- `payment_link`
- `payment_reference`
- `note`
- `created_at`
- `sent_at`
- `paid_at`

### `bs_invoice_items`
Fields:
- `id`
- `invoice_id`
- `description`
- `quantity`
- `rate`
- `amount`

Adapt to existing billing schema if one already exists.

## Step 5.2 — Admin Invoice Builder

Admin should be able to:
- Create draft invoice
- Select client
- Link optional project
- Add line items
- Add tax
- Configure deposit vs full balance
- Choose Square or PayPal
- Save/send

## Step 5.3 — Branded Invoice Page

Client-facing invoice page should include:
- LBMD branding
- The BlackSuite branding/footer
- Invoice number and date
- Due date
- Client details
- Itemized charges
- Subtotal/tax/total
- Deposit/balance breakdown if relevant
- Pay Now action
- Optional downloadable/printable version

## Step 5.4 — Square Integration

Since Square is already part of the ecosystem, it should be primary.

Claude Code should:
- Reuse existing Square helpers if available
- Generate payment links or checkout sessions tied to invoice totals
- Store returned payment URL/reference in D1

## Step 5.5 — PayPal Integration

PayPal should be secondary but supported.

Claude Code should:
- Generate a payment approval URL or order flow
- Store references and status mapping in D1

## Step 5.6 — Payment Status Sync

Add webhook handlers or equivalent status sync for:
- Square payment completion
- PayPal payment completion

Invoice statuses should automatically update in D1.

## Step 5.7 — Invoice Dashboard

Admin invoice dashboard should support:
- Draft
- Sent
- Viewed
- Partial
- Paid
- Overdue

Also useful:
- Outstanding balance summary
- Recently paid invoices
- Revenue totals

---

# Phase 6: Dashboard Rewiring and Reporting

The dashboard shell exists already and only needs its inner workings updated to match the new BlackSuite data model.

## Goal

Make the dashboard the command center for proofing, delivery, storage, and invoices.

## Step 6.1 — Project Status Widgets

Dashboard should display:
- Active projects
- Proofing pending
- Proofing submitted
- Finals ready
- Finals delivered

## Step 6.2 — Selection Activity

Dashboard should show:
- Clients with completed selections
- Selection counts by project
- Comment activity
- Need-review indicators

## Step 6.3 — Delivery Activity

Dashboard should show:
- Final deliveries sent
- Downloads activity
- Expiring deliveries

## Step 6.4 — Storage Visibility

If practical, show Storj usage stats so storage use is visible from admin.

## Step 6.5 — Invoice Visibility

Dashboard should show:
- Outstanding invoices
- Paid invoices
- Overdue invoices
- Current month totals

## Step 6.6 — Activity Feed

Useful feed items:
- Client submitted proof selections
- Client downloaded finals
- Invoice viewed
- Invoice paid
- Delivery expiring soon

---

# API and Route Planning

Claude Code should add or refine BlackSuite API routes in a consistent route file/module.

Recommended endpoint groups:

## Storage / Files
- `POST /api/bs/upload`
- `GET /api/bs/delivery/:deliveryId/files`
- `GET /api/bs/stream/:fileId`
- `GET /api/bs/download/:fileId`
- `GET /api/bs/delivery/:deliveryId/zip`
- `DELETE /api/bs/file/:fileId`

## Proofing
- `POST /api/bs/select`
- `POST /api/bs/submit-selections`
- `GET /api/bs/selections/:projectId`

## Projects / Deliveries
- `POST /api/bs/project`
- `POST /api/bs/delivery`
- `PATCH /api/bs/delivery/:id`
- `PATCH /api/bs/file-order`

## Invoices
- `POST /api/bs/invoice`
- `PATCH /api/bs/invoice/:id`
- `GET /api/bs/invoice/:id`
- `POST /api/bs/invoice/:id/payment-link`

## Webhooks
- `POST /api/bs/webhooks/square`
- `POST /api/bs/webhooks/paypal`

Claude Code should align route naming with the existing router conventions.

---

# Frontend and UX Guidance

## Client-Facing Design Direction

The system should feel premium, minimal, and branded.

Principles:
- Keep LBMD visually front and center
- Add “Powered by The BlackSuite” consistently but subtly
- No third-party storage UI exposure
- No clunky raw folder views
- Strong mobile experience
- Faster and cleaner than the old Drive-based flow

## Admin-Facing Design Direction

Priorities:
- Centralized workflow
- Minimal context switching
- Clear stage/status visibility
- Fast upload and publishing workflows
- Reuse current admin shell/navigation where possible

## Pixieset/Bloom Benchmark

The goal is to match or exceed the following experience categories:
- Branded galleries
- Client proofing
- Mixed media delivery
- Final download experience
- Clear project presentation
- Professional invoice presentation

But improve on them by offering:
- One unified portal
- Mixed project-type support
- Full brand control
- No recurring platform subscription

---

# Suggested Implementation Order for Claude Code

## Session 1 — Discovery and Retrofit Map
- Audit current implementation
- Map existing modules to planned BlackSuite structure
- Identify reuse vs replacement targets

## Session 2 — D1 Schema and Storj Utility Layer
- Add schema/migrations
- Build Storj helper
- Add secrets/config integration

## Session 3 — Worker File Endpoints
- Upload
- List files
- Stream/download
- Delete
- ZIP

## Session 4 — Finals Delivery Upgrade
- Replace folder redirect
- Build branded delivery page
- Add inline video/photo viewing and downloads

## Session 5 — Proofing Module Upgrade
- Replace Drive-backed logic
- Add maybe state, filters, counters, submit flow
- Ensure comment handling is robust

## Session 6 — Admin Composer Refinement
- Upgrade upload flow
- Project/delivery setup
- Reordering/replacement/publish logic

## Session 7 — Invoicing Module
- D1 invoice tables
- Invoice builder
- Branded invoice page
- Square/PayPal link generation

## Session 8 — Payment Sync
- Webhooks
- Invoice status updates
- Dashboard metrics integration

## Session 9 — Dashboard Rewire
- Storage/project/invoice widgets
- Activity feed
- Proofing and delivery status summaries

## Session 10 — Polish and Migration Cleanup
- Remove leftover Drive-specific dependencies where safe
- Clean legacy code paths
- Verify branding consistency
- Test all client/admin flows end-to-end

---

# Important Implementation Rules for Claude Code

1. **Do not rebuild from scratch unless necessary.** Reuse the current shells and patterns.
2. **Replace Google Drive incrementally.** Avoid breaking production flows until Storj-backed paths are tested.
3. **Keep client-facing delivery fully branded.** Never expose raw third-party storage UI.
4. **Support mixed media well.** This system must serve photos, videos, event media, and design files.
5. **Optimize for the existing LBMD workflow.** The admin side should centralize work, not complicate it.
6. **Treat the invoice system as part of the same suite.** It should feel native, not bolted on.
7. **Preserve one source of truth in D1.** Projects, deliveries, files, selections, downloads, and invoices should all reconcile cleanly.
8. **Respect large-file realities.** Video and event deliverables can be large, so upload/stream/download architecture must be resilient.
9. **Prioritize Mod 3 early.** Finals delivery is the biggest client-facing pain point and should be upgraded quickly after the Storj foundation is in place.
10. **Every client-facing page should reinforce The BlackSuite identity.**

---

# End State Definition

The project is successful when:

- Proofing no longer depends on Google Drive
- Finals no longer redirect to folders
- Clients can view photos and play videos directly in the portal
- Admin uploads and manages deliveries from one centralized backend
- Clients can receive branded invoices and pay via Square or PayPal
- Dashboard status reflects projects, selections, deliveries, and invoices in one place
- The entire experience feels like a premium branded LBMD system powered by The BlackSuite

