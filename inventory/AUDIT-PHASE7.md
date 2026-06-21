# Phase 7 — Independent Security Audit

**Auditor:** fresh session, did NOT build any of this. **Date:** 2026-06-21.
**Subject:** merged live system — `https://lucent-financial-group.github.io/Zeta/inventory/`
+ Supabase backend `mdtbgreryqddloluhdmm.supabase.co`, re-proven against the
contract in `inventory/spec.md` + `inventory/CLAUDE.md`. PROGRESS.md `[x]` marks
were treated as **claims**, re-verified from scratch with fresh observed output.

## Verdict

**No P0 or P1 security defect found.** Every gate I could execute end-to-end with
the public anon key re-proved cleanly on the live, no-proxy site. The repo is clean
of secrets (all history, all branches), `service_role` appears only in "never use
this" comments/guards, RLS is least-privilege and not bypassable from an
unauthenticated client, change_log is structurally immutable, and the shipped code
is XSS-safe by construction (zero raw-HTML sinks) behind a hardened CSP that the
live site actually serves.

**Phase 7 is NOT yet sign-off-complete** — not because anything failed, but because
a set of checks are, by the contract's own design, gated on *authenticated* live
credentials and a browser/phone. The build-time test users were intentionally
burned and are (correctly) absent from the repo, so I could not log in as
viewer/editor/admin. Those residual live re-verifies (listed in §"Owner-gated")
must be run by the owner (or with freshly-issued burnable creds handed to me)
before the box is checked. I did not mark any gate passed that I could not observe.

---

## Gate re-verification (re-proven this session)

| Gate | Re-verified? | Evidence (fresh, this session) |
|---|---|---|
| Phase 0b — reach Supabase w/ anon key | ✅ | REST reachable; anon reads HTTP 200 |
| Phase 1 — RLS on, default-deny, immutable change_log | ✅ (anon path) / structural (auth path) | anon reads all 4 tables `[]`; anon INSERT `42501`; `phase1.sql` policies read line-by-line — least-privilege, no `USING(true)`, change_log has NO insert/update/delete policy + BEFORE-trigger RAISE |
| Phase 2 — role single-source, UI==RLS | structural | role from ONE source `current_user_role()` (reads `profiles`), used by both UI (RPC) and RLS policies; per-role *live* exercise is owner-gated (no creds) |
| Phase 3 — read path | partial | gate (d) demo dashboard live = 200 + byte-identical to main; (a/b/c) DOM render/search/sort owner-gated (auth+browser) |
| Phase 4 — write path / version lock / audit | structural | `phase4.sql` adds only a version-bump trigger; no RLS change; audit trigger logs field-level before→after |
| Phase 5 — typed custom fields, XSS-safe | ✅ (static) / owner-gated (live) | `validate_custom_fields()` SECURITY DEFINER, per-type + unknown-key reject, no RLS loosening; render path = `textContent` only; 32/32 unit tests pass; live numeric/date DOM sort owner-gated |
| Phase 6 — QR + export | structural | logic libs vendored same-origin; live phone-scan + live-data export owner-gated |
| Phase 7 — hardening | ✅ | CSP hardened + served live; supabase-js vendored + SRI matches; heartbeat has no secrets; CI guard fails on broken code |

---

## The 8 targeted probes

### 1. Any secret committed anywhere, any branch, any history? — **NO**
- Scanned every commit on every ref (`git rev-list --all`) for proper JWTs
  (`eyJ…​.eyJ…​.…`) and `sb_secret_` — **zero** real tokens (the `eyJ` noise is
  base64 *image* data in `docs/research`, not credentials).
- Only embedded credential, in `lib/inventory-app.js` and the heartbeat workflow,
  is the **publishable** anon key `sb_publishable_UjTK7ZQ0…` + project URL — public
  by design, the intended low-privilege client key.
- No `.env`, no `seed.json`, no `.xlsx`, no real credential file ever added under
  `inventory/` (only proof scripts + the converter logic). `.gitignore` covers
  `_seed_tmp/` + `_proof_tmp/`. Proof harnesses read passwords from `process.env`
  only — no hardcoded password literals. The `*security_credentials.md` files are
  narrative background notes; the k8s `*secret.example.yaml` is `REPLACE_WITH_…`.

### 2. `service_role` referenced? — **only in "never use this" contexts**
Every occurrence is a cautionary comment ("NEVER place the service_role/secret key
here"), documentation, or a *guard that rejects such keys*
(`seed-import.ts:133`: aborts if the key looks like service_role/secret). No usage.

### 3. RLS bypassable from an unauthenticated client? — **NO**
Live unauthenticated anon REST (public key as `apikey` + `Bearer`, no user session):
```
items             -> HTTP 200  []
profiles          -> HTTP 200  []
field_definitions -> HTTP 200  []
change_log        -> HTTP 200  []
anon count (Prefer: count=exact): items */0 · change_log */0   (zero rows, no leak)
anon INSERT items -> {"code":"42501", "...violates row-level security..."} HTTP 401
anon rpc current_user_role -> {"code":"42501","permission denied for function"} HTTP 401
probe users/auth/secrets/api_keys/settings -> HTTP 404 (no stray exposed tables)
```
Every sensitive table returns **zero rows** to an unauthenticated client.

### 4. RLS least-privilege? — **YES, no `USING(true)`**
Read `phase1.sql` policies explicitly. Each is scoped to a specific role AND
operation via `current_user_role()`:
- `items`: SELECT viewer/editor/admin · INSERT/UPDATE editor/admin · **no DELETE**.
- `field_definitions`: SELECT all-roles · INSERT/UPDATE/DELETE admin-only.
- `change_log`: SELECT editor/admin only (viewer excluded) · **no INSERT/UPDATE/DELETE**.
- `profiles`: self-read · admin-read-all · admin-update; no client INSERT/DELETE.
No `USING (true)` / `with check (true)` ships anywhere. The only `using(true)` in the
tree is `phase2_rls_brokenfix.sql`'s deliberately-permissive `_tmp_permissive_update`
policy created **inside a `BEGIN…ROLLBACK`** as a negative control, plus assertion
text in proof files checking for *zero* permissive policies. phase4/phase5 add **no**
policy, no GRANT/REVOKE.

### 5. change_log immutable? — **structurally guaranteed; anon path observed**
Two independent layers in `phase1.sql`: (1) RLS exposes **no** UPDATE/DELETE policy →
0 rows mutable by any client; (2) `change_log_immutable` BEFORE UPDATE/DELETE trigger
`raise exception 'change_log is immutable'` — fires even for the privileged owner.
Observed: anon PATCH/DELETE on `change_log` → HTTP 204 with **0 rows affected**
(RLS filters every row before the trigger is reached; nothing changes).
*Owner-gated:* the authenticated editor/admin UPDATE/DELETE attempts (each must be
refused) require live creds — see §Owner-gated. The structural guarantee is airtight.

### 6. Custom-field XSS-safe? — **safe by construction; live injection owner-gated**
- Shipped JS has **zero** raw-HTML sinks: `grep` for
  `innerHTML|outerHTML|insertAdjacentHTML|document.write|eval|new Function` across
  `lib/*.js` + `index.html` = **none**. 76 `textContent` writes; custom field values
  AND labels both reach the DOM via `textContent` / `CF.displayText` → `textContent`.
- CSP (served live) has `script-src 'self'` with **no** `'unsafe-inline'`/`'unsafe-eval'`
  and no CDN, so even an injected inline handler cannot execute.
- DB defense-in-depth: `validate_custom_fields()` rejects unknown keys and type
  mismatches; a stored `<script>` payload is kept verbatim **as a JSON string** and
  rendered inert.
- *Owner-gated:* injecting `<script>`/`<img onerror=>` as a live field name+value and
  observing inert render needs auth+browser. (Build proved it via Playwright;
  structurally it cannot execute given the above.)

### 7. UI role checks == RLS enforcement? — **single source; live per-role owner-gated**
Role lives in exactly one place — `profiles.role`, read through the SECURITY DEFINER
`current_user_role()` function — and **both** the UI (via RPC) and the RLS policies
read that same function. There is no second divergent role store. The UI's hidden
buttons are cosmetic; the DB is the gate. *Owner-gated:* exercising every write op per
viewer/editor/admin via both UI and REST with each role's JWT requires live creds.

### 8. Deployed CSP == repo claim? — **YES**
Live `https://…/Zeta/inventory/` is **byte-identical** to `origin/main`
(sha256 `de83190e…`, 9563 bytes). Served CSP:
```
default-src 'self'; script-src 'self'; style-src 'self';
connect-src 'self' https://mdtbgreryqddloluhdmm.supabase.co;
img-src 'self' data:; base-uri 'none'; object-src 'none'; form-action 'none';
```
All scripts same-origin `lib/*.js`; only off-origin reference is the Supabase host
(in connect-src). supabase-js carries SRI `sha384-JWEyvHh+…` which **matches** the
computed hash of the vendored file on disk and on the live server. All 6 live lib/css
assets = HTTP 200 + byte-identical to main. `phase7-csp-proof.ts` = 15/15 PASS, and
**fails (3 checks) on a copy with `'unsafe-inline'`+CDN reintroduced** (green ≠
verified discipline holds).

---

## Structural / history check (Auditor brief)

All gated-phase key artifacts exist on `origin/main` (`git cat-file -e`): phase1/4/5
SQL, custom-fields.js, inventory-app.js, vendored supabase-js + qrcode, index.html,
inventory.css, heartbeat workflow — all **PRESENT**. Visible main history is a clean
linear progression (…Phase 6 → Phase 7 Part 1 `#8815`) with no force-rewind in the
inventory window. The historical PR #6445 rewind noted in PROGRESS.md is resolved:
Phase 5's artifacts are confirmed present on main today. The admin-secret-consuming
`inventory-phase5-proof.yml` has been **removed** from main; no remaining workflow
references the `INVENTORY_ADMIN` secret.

---

## Owner-gated residual checks (cannot self-certify — require live auth creds / device)

By design the build burned every test credential and keeps none in the public repo,
so I cannot authenticate. To **complete** Phase 7 sign-off, the owner (or burnable
creds issued to a follow-up auditor session) must run, on the live site, with raw
observed output:

1. **Authenticated change_log immutability (probe 5):** as editor AND admin, attempt
   `UPDATE` and `DELETE` on a real change_log row → each refused (0 rows / trigger error).
2. **Live XSS (probe 6):** sign in as admin, add a custom field whose **name** is
   `<img src=x onerror=…>` and whose **value** is `<script>…</script>` on an item;
   load the page → confirm inert render (no execution).
3. **Per-role UI-vs-API parity (probe 7):** for viewer/editor/admin, every write op via
   UI and via REST with that role's JWT → UI-hide and DB-refusal agree.
4. **Phase 3 (a/b/c):** rendered row count === 210; 3 searches + 3 sorts correct;
   phone-viewport render.
5. **Phase 5 live re-verify:** editor write accepted + viewer write DB-refused; numeric
   custom field sorts 9<10<100 (not lexicographic) and date sorts chronologically, in
   the live DOM.
6. **Phase 6 live re-verify:** physical phone QR-scan deep-links post-login (and leaks
   nothing signed-out); live-data CSV/JSON export round-trips; export available to a viewer.

## Owner actions still outstanding (from the Residual Risk Register — confirm before launch)

- **Rotate/delete** `editor@gmail.com` + `viewer@gmail.com` + the admin password/secret
  (chat-burned during the build), then run `phase7-credential-burn-verify.ts` to confirm
  each is dead. I could not verify rotation (no access to the old passwords).
- **Run** `sql/phase7-proof-residue-cleanup.sql` (EXPORT first) to remove proof-residue
  items 216/225/226/227/228 + inactive `p5_*` defs.
- **Automated data backup** remains consciously deferred (anon can't read under
  default-deny; a backup needs an authenticated secret in CI). Heartbeat (no secrets)
  ships and handles only the free-tier pause. Revisit trigger documented.

## Minor observations (not blocking; P2/informational)

- **CSP is `<meta>`-only.** GitHub Pages serves static files and cannot set response
  headers, so `frame-ancestors` / `X-Frame-Options` cannot be applied — the app has no
  clickjacking defense. Low risk (login-gated, RLS-protected, no sensitive action is a
  single GET), but worth noting for the threat model. No action required for v1.
- The publishable anon key + project URL are intentionally public; documenting here so a
  future reader does not mistake them for a leak.

---

*Method: all evidence above was observed fresh this session via direct `curl` to the
live no-proxy site + Supabase REST, `git` history scans across all refs, line-by-line
reads of the SQL/JS, and runs of the repo's own proof harnesses (incl. a broken-code
regression check). No prior recorded evidence was trusted.*
