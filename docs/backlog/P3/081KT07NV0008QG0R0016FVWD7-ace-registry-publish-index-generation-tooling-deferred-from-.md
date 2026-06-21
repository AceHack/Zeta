---
id: 081KT07NV0008QG0R0016FVWD7
priority: P3
status: closed
title: Ace `ace registry publish` — index-generation + signing tooling (deferred from slice 6)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KT07NV0008QG0R000SJ34AK
composes_with: []
tags: [ace, package-manager, registry, remote, tooling, publish, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (081KT07NV0008QG0R000SJ34AK, shipped via #6431) implements the **consumer** side of a remote registry:
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

## Resolution (2026-06-01 — slice 6.1 core shipped via PR #6439, merge `2d662dbb`)

Core `ace registry publish` shipped. Spec: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice6.1-registry-publish-design.md` (spec PR #6434).

**Shipped:**

- `ace registry publish --packages <dir> --base-url <url> --key <pem> [--out index.json]` —
  scans `<dir>` for `*.json` packages, derives each `url = <base-url>/<name>-<version>.json`
  + `package_hash = packageHash(pkg)`, assembles + Ed25519-signs the index, sets `issued_at`,
  auto-bumps `sequence` from an existing `--out` (read as prev), and **round-trip self-verifies**
  (consumer `parseIndex` + `verifyIndexSignature` under the signing key's own public key)
  before writing — never writes a non-self-verifying index.
- **Publish-side anti-rollback:** refuses to auto-bump from an existing `--out` whose
  signature does not verify under `--key`, and refuses an unparseable `--out` (no silent
  sequence reset that would look like a rollback to consumers).
- **Input-validation hardening** (skip+warn any package that would fail on a consumer, so a
  self-verified index can't point at an un-installable package): non-Ed25519 `--key` refused;
  `content_hash` required + must match `files`; basename must equal `<name>-<version>.json`;
  reserved prototype-key identities (`__proto__`/`constructor`/`prototype`) rejected;
  URL-unsafe name/version characters rejected; `dependencies` must be a well-formed array of
  valid `AceDependency` edges; every `files` value must be a string; unsafe file paths
  (`../`/absolute) rejected by reusing the consumer's `validatePackagePaths`.
- **Deterministic output:** packages sorted by `(name, version)` so re-publishing yields a
  byte-stable `index.json`.
- Surfaces: `tools/ace/registry-publish.ts` (pure module) + `ace.ts` `registry publish`
  handler + `signing.ts` `publicKeyInfoFromPrivatePem` + `.claude/skills/ace/SKILL.md`
  publish section + unit + e2e tests.

**Slice 6.2 (#6462, merged 2026-06-01) shipped three of the four deferred items** — spec
`docs/agendas/ace-package-manager/2026-06-01-ace-cli-slice6.2-publish-enhancements-design.md`
(spec PR #6456):

- Per-package `url` override — optional top-level `url` field (publish-only; excluded from
  `package_hash`; relaxes the `<name>-<version>.json` filename guard for that package).
- Multi-directory input — comma-separated `--packages a,b,c` (scan + merge; per-dir
  readability required; cross-dir duplicate `name@version` is a hard error).
- Explicit `--sequence <n>` override (positive integer; anti-rollback-gated — the
  formerly-dead guard is now live).
- ETag / Last-Modified sidecar — **dropped** (not deferred-again): the consumer already does
  HTTP conditional-GET and 6.1's deterministic output yields a stable host ETag, so there is
  nothing for the producer to emit.

**Still deferred (separate rows):**

- Incremental index → 081KT07NV0008QG0R001PHV1ND; full TUF role separation → 081KT07NV0008QG0R001K340B3; key rotation / multi-signer
  → 081KT07NV0008QG0R000GGW5E6 (already rowed).

## Composes with

- 081KT07NV0008QG0R000SJ34AK (Ace remote registry — the consumer side this complements)
- 081KT07NV0008QG0R001K340B3 (TUF roles — publish tooling would target the targets/snapshot/timestamp roles)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
