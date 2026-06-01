---
id: B-0980
priority: P3
status: open
title: Ace `ace registry publish` — index-generation + signing tooling (deferred from slice 6)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - B-0971
composes_with: []
tags: [ace, package-manager, registry, remote, tooling, publish, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (B-0971, shipped via #6431) implements the **consumer** side of a remote registry:
fetch + verify + cache + merge a signed index. The **producer** side — generating + signing
the index document a registry serves — exists only as the `signIndex` test helper in
`tools/ace/signing.ts`. This row tracks an `ace registry publish` command (and supporting
tooling) so an operator can build a signed index from a set of packages, bump the
`sequence`, set `issued_at`, and sign it with the registry key — the publish-side
counterpart to the consumer-side trust gates.

## Scope sketch

- `ace registry publish --packages <dir-or-list> --key <privkey> [--out index.json]
  [--prev <prior-index>]`: scan the packages, compute each `package_hash` + resolve its
  `url`, assemble `packages: name→version→{url,package_hash}`, set the new
  `sequence` to `prev.sequence + 1` (monotonic — read `--prev` to avoid accidental rollback), set `issued_at = now`,
  and `signIndex` with the registry private key.
- Refuse to publish a `sequence <= prev.sequence` (publish-side anti-rollback guard,
  mirroring the consumer gate).
- Optionally emit/refresh ETag/Last-Modified-friendly output for static hosting.
- Reuse `canonicalIndexBytes` / `signIndex` (already in `signing.ts`) so the published
  bytes are exactly what the consumer's `verifyIndexSignature` checks.

## Why deferred (operator 2026-06-01)

The consumer side is what slice 6 needed to resolve against a hosted catalog; an index can
be hand-assembled + signed with the test helper for now. First-class publish tooling is
ergonomics for registry operators, not a consumer capability gap. Operator: *"everything
we skipped lets slice off for further enhancements."*

## Composes with

- B-0971 (Ace remote registry — the consumer side this complements)
- B-0979 (TUF roles — publish tooling would target the targets/snapshot/timestamp roles)
- B-0288 (Ace DLC package manager CLI)
