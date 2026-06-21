# Ace — untrusted-input `packageHash` hardening (design)

> Trust-core hardening follow-up for the Ace package manager (081KR2E4K0008QG0R002YE3MMD), surfaced by the
> 8.1/8.2 final reviews and confirmed against current `origin/main` 2026-06-03. The
> `packageHash` primitive (8.2) throws (via `canonicalBytes` → `toTagged`) on a malformed
> field — a non-safe-integer (e.g. a float) or a lone UTF-16 surrogate. `resolve.ts`'s
> **dependency** site already mapped that throw to a styled `invalid-package` refusal; the
> sibling untrusted-input sites did **not**, so the same malformed input surfaced as the
> generic `ace: fatal: <internal message>` catch-all (the entry-point `.catch`) — an
> internal-error channel, not a domain refusal. This slice closes that gap. No behaviour
> change for well-formed packages; bugfix-class hardening, not a new feature.

## Goal

A malformed **untrusted** package (float / lone-surrogate field) must refuse with a
clean, styled domain message — `invalid-package` (resolve) / `ace: … refused: …` /
`ace: registry add: …` (CLI) and a deterministic exit code — never escape as
`ace: fatal:`, which is reserved for genuinely-unexpected internal faults. The trust
core already has the correct pattern at one site (`resolve.ts` dep); this slice adds a
shared throw-safe helper and guards every untrusted-input `packageHash` reach.

## The gap (confirmed against `origin/main` 2026-06-03)

`packageHash(pkg)` throws on a malformed field. Untrusted-input reaches (the **root**
package is untrusted in every install/update; **deps/nodes** are untrusted fetched JSON):

| Reach | Site | Path | Pre-fix surface |
|---|---|---|---|
| root | `resolve.ts:43` `packageHash(root)` | default graph install / update | throw escapes `resolve()` → `main()` → `ace: fatal:` |
| root | `lockfile.ts:80` `verifyRootMatchesLock` | `install --frozen` (runs **before** any ace.ts guard) | throw escapes → `ace: fatal:` |
| root | `lockfile.ts:92` `buildLeafLockfile` | **leaf** (no-deps) default install + update lock write | throw escapes → `ace: fatal:` |
| root | `lockfile.ts:43` `buildLockfile` root | graph install / update lock write | reached only after resolve already hashed the root (defense-in-depth) |
| dep | `lockfile.ts:39` `buildLockfile` dep | graph lock write | reached only after resolve already hashed each dep (defense-in-depth) |
| dep | `resolve.ts` dep `packageHash(dep)` | graph resolve | **already guarded** (try/catch → invalid-package) — the pattern to mirror |
| root | registry-add `packageHash(pkg)` | `ace registry add` (no `--hash`) | shape-guarded object-ness **only** → throw escapes → `ace: fatal:` |
| node | frozen-node `packageHash(np)` (×2) | `install --frozen` fetched nodes | shape-guarded object-ness **only** → throw escapes → `ace: fatal:` |
| node | `preflightGraph` `packageHash(node)` | install + update | defense-in-depth (resolve catches root/dep upstream) |

**Correction to an earlier draft of this doc:** the leaf (no-deps) install path is *not*
`packageHash`-free. Its integrity/extract step uses only `content_hash`, but its **lockfile
write** goes through `buildLeafLockfile`, which computes `packageHash(root)` — so a
malformed leaf root reaches `packageHash` and must be guarded.

Two **overconfident comments** to correct: the frozen-node and registry-add shape-guards
both claim their object-ness check prevents a `packageHash` throw. It does not —
object-ness says nothing about field *values*; a float/lone-surrogate field still throws
past them. The comments now state the real division: object-ness guard covers shape;
`safePackageHash` covers the field-value throw.

## Decisions (this spec locks them)

1. **Centralize the throw→reason mapping** in `tools/ace/package-hash.ts` as
   `safePackageHash(pkg): { ok: true; hash } | { ok: false; reason }` — one `try/catch`
   that maps the `toTagged` throw to a reason string. `packageHash` itself is unchanged
   (trusted callers keep it). This is the `Result<T, TFeedback>` shape at primitive scope:
   the malformed-field outcome becomes a *value* the caller must handle, not an escaping
   exception.

2. **Guard the untrusted ROOT once, at command entry.** The root flows through several
   `packageHash`-using helpers depending on the path (`resolve`, `verifyRootMatchesLock`,
   `buildLockfile`, `buildLeafLockfile`, `preflightGraph`), and the frozen-path
   `verifyRootMatchesLock` runs *before* any per-path guard. So `safePackageHash(pkg)` is
   applied **once at the top of the `install` and `update` command handlers** — right after
   the shape + signature gates, before any graph/leaf/frozen branch — refusing a malformed
   root as `invalid-package` (`install` exit 1 / `update` exit 1) before any helper hashes
   it. (`lockfile.ts` stays a trusted-input module: its callers validate first.)

3. **Guard the untrusted DEPS / NODES at their sites.** `resolve` already guards each
   fetched dep (kept; the inline `try/catch` refactored to `safePackageHash`). The frozen
   fetched-node path computes the hash **once** via `safePackageHash` (reused for the pin
   check and the store-key collision check). `preflightGraph` maps a throw to its
   `string | null` channel (defense-in-depth — `resolve` already catches a bad root/dep in
   the default + update flows).

4. **registry-add** uses `safePackageHash` → `ace: registry add: invalid package — <reason>`,
   exit **65** (the path's existing malformed-input code).

5. **Correct the two overconfident shape-guard comments.**

6. **No `packageHash` value / signature / identity-semantics change.** Only the failure
   path for malformed untrusted input changes (generic `fatal:` → styled refusal). Every
   existing well-formed assertion stays green. (The root may be hashed more than once on a
   path — entry guard + a downstream helper — which is acceptable: install/update is not a
   hot path and correctness/uniformity beats threading a precomputed hash through every
   helper signature.)

## Testing (assert-don't-skip)

- **Unit — `package-hash.test.ts`:** `safePackageHash` ok-hash matches `packageHash` for a
  well-formed package; not-ok (reason mentions "safe integer" / "lone surrogate") for a
  float field and a lone-surrogate field.
- **Behavioural — `resolve.test.ts`:** a root with a float / lone-surrogate manifest field
  → `await resolve(badRoot, …)` returns `invalid-package` (pre-fix it *threw* → the `await`
  rejects → falsifying).
- **Behavioural — `ace.test.ts`:**
  - `ace registry add <name> <ver> <float-field-pkg>` → `await main([...])` returns `65`
    (pre-fix `main()` *threw* → rejects → falsifying).
  - `ace install <leaf-no-deps float-field root> --allow-no-signature` → `await main([...])`
    returns `1` (pre-fix `main()` *threw* through `buildLeafLockfile` → rejects →
    falsifying). This exercises the early root guard covering the `buildLeafLockfile` reach.
- **Coverage honesty:** the frozen-path root (`verifyRootMatchesLock`) and frozen fetched
  nodes are guarded (entry root-guard + frozen-node `safePackageHash`) and covered by the
  unit test + the early-guard tests; a dedicated `--frozen` malformed-root fixture (needs a
  matching on-disk lock) is not added — the early entry guard refuses the malformed root
  before `verifyRootMatchesLock` runs, so the lock-fixture path is redundant for this
  property. `buildLockfile` (graph) is defense-in-depth (inputs pre-validated by resolve).
  Stated, not silently skipped.
- **Gates:** `bun test tools/ace/` green (371 pass); `bun --bun tsc --noEmit -p tsconfig.json`
  exit 0; pure-LF; markdownlint on this doc.

## Scope / YAGNI

In scope: the `safePackageHash` helper + unit tests; the early root guard at install/update
entry; dep/node/registry/preflight/frozen-node site guards; two comment corrections;
behavioural tests for the reachable surfaces. Out of scope: changing `packageHash`
semantics or the signature / content-hash mechanisms; modifying `lockfile.ts` (it stays a
trusted-input helper — callers validate); wiring `bun test tools/ace/` + cross-verify into
CI (the still-standing separate follow-up); slice 8.4 index-verify (the next feature slice,
separately gated).

## Files touched

- `tools/ace/package-hash.ts` — add `safePackageHash` + `SafePackageHash` (no change to `packageHash`).
- `tools/ace/package-hash.test.ts` — `safePackageHash` unit tests.
- `tools/ace/resolve.ts` — root + dep sites → `safePackageHash`.
- `tools/ace/resolve.test.ts` — malformed-root behavioural tests.
- `tools/ace/ace.ts` — early root guard in `install` + `update`; registry-add / frozen-node / `preflightGraph` → `safePackageHash`; frozen-root reuses the entry hash; two comment corrections.
- `tools/ace/ace.test.ts` — registry-add + leaf-default malformed-root behavioural tests.
- (`tools/ace/lockfile.ts` — unchanged; its `packageHash` callers now validate untrusted input first.)
