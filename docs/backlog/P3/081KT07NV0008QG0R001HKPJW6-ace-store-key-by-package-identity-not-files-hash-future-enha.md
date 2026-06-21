---
id: 081KT07NV0008QG0R001HKPJW6
priority: P3
status: open
title: "Ace store keyed by package identity (not files-hash) — future enhancement, only if same-files-different-identity arises"
created: 2026-06-01
last_updated: 2026-06-01
depends_on: [081KR2E4K0008QG0R002YE3MMD]
classification: deferred-until-needed
decomposition: atomic
owners: [developer-experience-engineer]
type: feature
---

# 081KT07NV0008QG0R001HKPJW6 — Ace store keyed by package identity (future enhancement)

## Trigger / origin

Surfaced during the slice-4 (inline-URL dependency resolution) spec review
(Codex P1 on PR #6341). The slice-4 resolver keys package identity on the
**full-package hash** (`package_hash` = sha256 of manifest+signature+files), so
two genuinely-distinct packages that ship byte-identical files (same slice-2
`content_hash`, different `package_hash`) are correctly NOT deduped. But the
slice-1/2 store keys each install directory by the files-only `content_hash`
(`tools/ace/store.ts`: `dir = <store>/<content_hash with ':'→'-'>`), so two such
distinct packages would collide on disk.

## Decision taken in slice 4 (the operator 2026-06-01): refuse, don't re-key

The operator confirmed **no current Ace shape needs this**: on main today the
manifest has **no** `dependencies` field, there are **zero** dependency graphs,
zero `.ace` packages, and every install is single-package keyed by `content_hash`
— the collision cannot occur until slice 4 ships dependency graphs AND someone
creates two distinct packages with byte-identical files (pathological).

So slice 4 takes the **minimal, strict, no-shipped-code-change** path
(**option B**): the install **preflight refuses `store-collision`** when two
resolved nodes share a `content_hash` but differ in `package_hash`. Slices 1-3
store behavior is untouched.

This row captures **option A** as a deferred future enhancement.

## The enhancement (option A) — re-key the store by package identity

Change the content-addressed store from **files-hash-addressed** to
**package-identity-addressed**:

- `installPackage` extracts to `<store>/<package_hash with ':'→'-'>/` (the full
  package identity) instead of `<content_hash>/` (files-only).
- `listInstalled` / `verify` key off the `package_hash` directory.
- Files MAY still be content-addressed + shared underneath for dedup (optional;
  the simplest version just gives each distinct package its own dir).

With option A the store can hold two distinct packages with identical files, so
the slice-4 `store-collision` refusal can be relaxed (the strict→permissive
flip the slice-4 spec anticipated).

## Acceptance (when/if built)

- [ ] A real need exists: a genuine dependency graph wants two distinct packages
      (different name/manifest) shipping byte-identical files. (If this never
      arises, this row stays deferred indefinitely — that is the expected
      outcome.)
- [ ] `installPackage` keys the install dir by `package_hash`; `listInstalled` /
      `verify` updated to match; store tests updated.
- [ ] The slice-4 `store-collision` preflight refusal is relaxed (no longer
      needed once the store distinguishes identity).
- [ ] Migration note: the store dir-key changes; since Ace is pre-release with no
      deployed store data, no data migration is required — but document the
      layout change.

## Why P3 / deferred-until-needed

The triggering scenario (two distinct packages, byte-identical files) is
pathological — different packages rarely ship identical files. Slice 4's strict
`store-collision` refusal is the correct, honest behavior until a real need
appears. Building option A speculatively would re-architect shipped slices 1-3
store behavior for a case that may never occur (YAGNI).

## Composes with

- 081KR2E4K0008QG0R002YE3MMD (Ace package manager) — parent
- Ace slice-4 design spec (`docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice4-inline-url-dependency-resolution-design.md`) — the `store-collision` preflight this would relax
- `tools/ace/store.ts` (`installPackage` dir-key) — the code option A would change
- Ace slice 5 (registry) — if/when registry resolution lands, identity-keyed store may become more relevant
