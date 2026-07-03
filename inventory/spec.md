# Inventory System — Specification

> **PIVOT 2026-07-02 (owner decision, Aaron): git IS the database.** The Supabase backend below is
> RETIRED before launch: the seeded project went unreachable/paused on the free tier, and the owners
> chose an open git-native register instead — one ZetaId-keyed file per item under `items/`
> (see `items/README.md`), git history as the immutable change log, GitHub permissions as roles,
> `items.json` as the generated read-model for the static viewer. Current data source: the paper
> register (photo transcription incoming). The Supabase-era spec below is preserved as lineage —
> its data model, status enum, and QR/export requirements carry forward; its auth/RLS/Postgres
> machinery does not. The 1,107-line `lib/inventory-app.js` is legacy pending the lean read-only
> viewer (workitem filed).


## Definition of done

A logged-in user sees the seeded inventory on the Zeta site. Viewers can search/sort; Editors can
edit, add, and archive items; Admins can additionally add typed custom fields that appear on every
item and manage users. Every change is written to an immutable who/what/when log. QR labels print
and resolve to item records. Nothing sensitive lives in the public repo. Runs at $0, on any device.

## Architecture

Static tab (HTML/CSS/JS, standalone file) on GitHub Pages → Supabase (Auth + Postgres + RLS + auto
REST API). Client holds ONLY the anon key. All data + the service_role key live server-side and are
never committed.

## Data model

- items: id (stable surrogate PK, NEVER reused/renumbered), name, brand, model_pn, qty, device_type,

category/section, status (enum), location, assignment_purpose, notes, value, serial, is_archived,
custom_fields (JSONB), version (int, optimistic locking), created_at, updated_at.

- field_definitions: key, label, type (text|number|date|dropdown|boolean), options[], required,

is_active, created_by, created_at. Adding a row = the field appears on ALL items. "Removing" a
field = set is_active=false (preserve existing values + history); never hard-delete a definition
that has data.

- change_log: id, item_id, actor (auth.uid()), action, field, old_value, new_value, timestamp.

Trigger-written. INSERT/SELECT policies only — NO update/delete.

- profiles: user_id, display_name, role (viewer|editor|admin).

## Roles (single source of truth)

Role is stored in profiles AND made available to RLS — either via a custom access-token (JWT) claim,
or via RLS policies that read the role through a SECURITY DEFINER function / join to profiles. The
UI role check and the RLS policies MUST read the same source and never diverge. (Phase 2 verifies
RLS sees the correct role per user.)

## Status enum

Active/In Use · In Storage · Needs Attention · In Repair · Retired(Archived) · Disposed · Missing.

## Security / RLS (intent — least privilege, default deny, NO permissive policies)

- Every table RLS-ON. With RLS on and no policy = inaccessible (the safe default we want).
- items: SELECT = any authenticated user; INSERT/UPDATE = editor + admin; archive via is_archived

(no hard delete); pair every UPDATE policy with a SELECT policy.

- field_definitions: SELECT = authenticated; INSERT/UPDATE/DELETE = admin only.
- change_log: INSERT via trigger context + SELECT (editor/admin; viewer NOT by default); NO

update/delete policy → immutable.

- profiles: self-read; role management = admin.
- Validate custom_fields values app-side against field_definitions types.
- EXTERNAL CHECK (owner/auditor-run, not self-certified): from an UNAUTHENTICATED request with only

the anon key, each sensitive table (items, field_definitions, change_log, profiles) must return
NOTHING.

## Auth / sessions

- Email/password via Supabase Auth; admin creates accounts now (self-service/invite is a designed-for

future addition, not built in v1).

- Trust decisions use getUser()/verified claims. Short access-token lifetime; auto-refresh; never log

tokens. Sign-out ends the session and clears in-memory/rendered data. Sessions end on sign-out /
password change / inactivity / max lifetime.

## Features

- Search (partial, case-insensitive) + multi-column sort + filter across core AND custom fields.

(Search/sort MUST include custom fields; excluding them = a Phase 5 gate failure.)

- Edit / add / archive items with confirmation + optimistic locking (version check); un-archive (undo).
- Typed dynamic custom fields (CENTERPIECE): admin adds a typed field → appears on all items; values

in JSONB (GIN-indexed); typed inputs; type-validated; searchable/sortable; XSS-safe render.

- Immutable change log: global view + per-item history; field-level before→after; UTC stored,

local displayed.

- QR labels: encode each item's stable ID → scanning opens its record (after login); printable label

sheets; client-side QR generation.

- Export inventory (CSV/JSON) anytime (also the free-tier backup path); import round-trips

(including unicode/comma/quote edge cases).

- Attention dashboard (items flagged Needs Attention).
- Reconciliation: mark item "verified on date" (optional, supports physical audits).

## Permission matrix

| Capability | Viewer | Editor | Admin |
| view/search/sort | yes | yes | yes |
| edit item values | no | yes | yes |
| add / archive items | no | yes | yes |
| add/edit custom field definitions | no | no | yes |
| manage users/roles | no | no | yes |
| view change log | no (default) | yes | yes |
| export | yes | yes | yes |
| hard delete | no | no | avoid (archive instead) |

## Seed data

Import the cleaned 210-item list (stable IDs 1–211, #8 retired/not renumbered; carry Status, Notes,
Sources; keep "Needs Attention" as a filter). Import via a STAGING check: validate expected row count
and spot-check ≥5 records against the source before finalizing; abort + report on mismatch. The
import must NOT use the service_role key.

## Non-functional

Mobile-first responsive; matches site style; basic a11y; graceful "backend waking up…" state (free-
tier cold start); passes existing CI/semgrep; $0 hosting (a scheduled anon-level read-only heartbeat
prevents the 7-day pause; no secrets in that Action).

## Acceptance

Each PROGRESS.md phase has explicit pass/fail GATEs + VERIFY methods. "Done" only when all gates pass
AND the independent Auditor (Phase 7) signs off AND the owner-run external checks pass.
