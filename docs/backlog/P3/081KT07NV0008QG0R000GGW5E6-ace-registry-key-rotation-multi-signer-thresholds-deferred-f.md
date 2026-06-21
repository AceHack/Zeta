---
id: 081KT07NV0008QG0R000GGW5E6
priority: P3
status: open
title: Ace registry per-registry key rotation + multi-signer thresholds (deferred from slice 6)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KT07NV0008QG0R000SJ34AK
composes_with: []
tags: [ace, package-manager, registry, remote, security, key-rotation, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (081KT07NV0008QG0R000SJ34AK, shipped via #6431) pins each remote registry to a **single** ed25519
`key_id`: the index `signature.key_id` must equal the pinned key AND be in the trust store.
There is no story for **rotating** that key (a compromised/expired registry key requires a
manual `ace registry remote rm` + re-`add` with the new key, with no continuity), and no
**multi-signer threshold** (M-of-N signers for high-value registries). This row tracks both.

## Scope sketch

- **Rotation**: allow a registry to advertise a successor key, signed by the current key
  (a signed key-rotation record), so a consumer can roll the pin forward automatically
  within a trust chain — without a window where neither key is accepted. Anti-rollback on
  the rotation chain (can't downgrade to a retired key).
- **Multi-signer thresholds**: `RemoteRegistryConfig.key_ids: string[]` + `threshold: n` —
  the index carries multiple signatures and `verifyIndex` requires `>= threshold` valid
  signatures from distinct pinned keys (defense against single-key compromise).
- Both extend `verifyIndex`'s signature gate; the anti-rollback + freshness gates are
  unchanged. Introduce `format_version: 2` for the multi-signature index shape.

## Why deferred (operator 2026-06-01)

Single-key pinning is the right first step (mandatory pin closes the conflated-authority
gap per Codex #6424 P1). Rotation + thresholds are operational-maturity hardening for
long-lived / high-value registries. Operator: *"everything we skipped lets slice off for
further enhancements."*

## Composes with

- 081KT07NV0008QG0R000SJ34AK (Ace remote registry — single-key pin this extends)
- 081KT07NV0008QG0R001K340B3 (full TUF role separation — root role owns rotation; this is the focused subset)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
