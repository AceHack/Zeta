---
id: B-0979
priority: P3
status: open
title: Ace registry full TUF role separation — root/targets/snapshot/timestamp (deferred from slice 6)
effort: L
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - B-0971
composes_with: []
tags: [ace, package-manager, registry, remote, security, tuf, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (B-0971, shipped via #6431) ships a **pragmatic subset** of registry-index trust:
a single ed25519-signed index with (1) a mandatory per-registry key pin, (2) monotonic-
`sequence` anti-rollback, and (3) two-sided `issued_at` freshness. This covers the
rollback / DoS / version-steering threats B-0971 named, with ONE signing key per registry.
This row tracks the **full TUF (The Update Framework) role separation** — distinct
`root` / `targets` / `snapshot` / `timestamp` roles, each with their own keys + thresholds +
rotation ceremonies — for registries that need defense against single-key compromise.

## Scope sketch

- **root**: the trust anchor that delegates + rotates the other role keys (rarely used,
  offline-held, threshold-signed).
- **targets**: signs the package catalog (the slice-6 index ≈ a single-role targets).
- **snapshot**: signs the set of current metadata versions (prevents mix-and-match of
  old + new metadata).
- **timestamp**: short-lived signature proving freshness (a finer-grained freshness gate
  than slice-6's `issued_at` max-staleness).
- Map slice-6's `sequence`/`issued_at`/pin onto the targets+snapshot+timestamp roles
  without breaking the existing `format_version: 1` index (introduce `format_version: 2`).
- Key rotation (B-0981) is a sub-concern of the root role here; the two rows compose.

## Why deferred (operator 2026-06-01)

Full TUF is the gold standard but heavyweight (multiple key ceremonies, role infra). The
slice-6 subset (signed index + sequence + freshness + mandatory pin) defends the named
threats now; full role separation is a later hardening for high-value registries.
Operator: *"everything we skipped lets slice off for further enhancements."*

## Composes with

- B-0971 (Ace remote registry — the slice this defers from)
- B-0981 (per-registry key rotation / multi-signer thresholds — root-role sub-concern)
- B-0978 (incremental index — snapshot/timestamp roles interact)
- B-0288 (Ace DLC package manager CLI)
