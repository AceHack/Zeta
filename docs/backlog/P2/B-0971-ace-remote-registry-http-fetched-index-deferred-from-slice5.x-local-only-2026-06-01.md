---
id: B-0971
priority: P2
status: open
title: Ace remote registry — HTTP-fetched registry index (deferred from slice 5.x local-only registry)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - B-0288
composes_with: []
tags: [ace, package-manager, registry, remote, http, deferred-enhancement]
---

## What this row proposes

Today the Ace registry (slice 5.1) is **local only**: a bundled `tools/ace/registry.json`
(ships `{}`) unioned with a user `~/.ace/registry.json`, mapping
`name → version → {url, package_hash}`. This row tracks a **remote registry**: fetch a
registry index over HTTP(S) so a name+range can resolve against a shared, hosted catalog
rather than only locally-registered entries.

## Scope sketch

- A registry source list (`~/.ace/registries.json` or similar): ordered remote index
  URLs + the local user/bundled registries, with a precedence rule (local overrides
  remote, mirroring the existing bundled∪user override).
- Fetch + cache the remote index (content-addressed cache; honor HTTP caching headers).
- The fetched index entries still carry `{url, package_hash}` so slice-5.1's full
  verify (content-hash + package-hash pin + identity + signature) is unchanged — a
  remote index is untrusted metadata; the package itself is still pinned + verified.
- Provenance/signing of the registry index itself. The per-package hash pin + signature
  gate protects the **integrity + authenticity** of installed bytes, but an untrusted
  index can still influence **availability + version selection** — omit newer versions to
  force a downgrade to an older validly-signed (possibly-vulnerable) release, point at
  dead URLs (DoS), or steer the solver's version pick. Index provenance/signing + an
  anti-rollback/freshness signal are therefore needed in addition to the per-package gate.

## Why deferred (operator 2026-06-01)

Local registry is enough to build + test the semver solver (slice 5.2). Remote fetch +
index trust is a separable concern. Operator: *"everything we skipped lets slice off
for further enhancements."*

## Composes with

- Slice 5.1 registry data layer (`tools/ace/store.ts`)
- B-0863 (one-liner curl install repository — a sibling remote-distribution concern)
- B-0288 (Ace DLC package manager CLI)
