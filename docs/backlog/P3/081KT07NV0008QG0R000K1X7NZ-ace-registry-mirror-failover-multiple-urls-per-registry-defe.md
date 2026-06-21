---
id: 081KT07NV0008QG0R000K1X7NZ
priority: P3
status: open
title: Ace registry mirror/failover — multiple URLs per registry (deferred from slice 6)
effort: S
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KT07NV0008QG0R000SJ34AK
composes_with: []
tags: [ace, package-manager, registry, remote, mirror, failover, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (081KT07NV0008QG0R000SJ34AK, shipped via #6431) fetches each remote registry from a **single** index
URL: a `RemoteRegistryConfig` is `{ url, key_id, max_staleness_days? }`. If that URL is
unreachable, slice 6 falls back to the local cache (or skips the remote with a warning).
This row tracks **mirror/failover**: allow a registry to declare multiple equivalent index
URLs (mirrors) so a transient outage of one mirror tries the next before degrading to cache.

## Scope sketch

- Extend `RemoteRegistryConfig` to accept an optional `mirrors: string[]` (or make `url`
  accept an array), preserving the single-URL form.
- In `fetchRemoteIndex`, on network failure of the primary, try each mirror in order
  (conditional GET against the same cache meta) before the cache-fallback/skip path.
- All mirrors must satisfy the SAME three index-trust gates (signature pinned to the
  registry's `key_id` + anti-rollback against the shared per-registry high-water +
  freshness) — a mirror is just an alternate transport for the same signed index, never
  a separate trust domain.
- Anti-rollback subtlety: mirrors may be at different `sequence`s mid-publish; the
  high-water gate already handles this (a behind mirror is refused as a rollback; try
  the next). Document the behavior.

## Why deferred (operator 2026-06-01)

Single-URL + cache-fallback is enough for the first remote-registry slice. Mirror/failover
is a resilience enhancement, not a capability gap. Operator: *"everything we skipped lets
slice off for further enhancements."*

## Composes with

- 081KT07NV0008QG0R000SJ34AK (Ace remote registry — the slice this defers from)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
