---
id: 081KVP3GYW108QG0R003V7E6VT
type: task
state: backlog
priority: P1
slug: threshold-shamir-k-of-n-at-each-ca-identity-root-true-never
title: "Threshold (Shamir k-of-n) at each CA/identity root — true never-single-key / ∅-blast-radius (math team refuted per-user-CA-alone; relocates SPOF to N single keys) (2026-06-21)"
created: 2026-06-21T22:06:25.153Z
depends_on: []
composes_with: ["081KVNXBR4S08QG0R0015DHBBN", "081KVNTNTDQ08QG0R0017NBBWB"]
---

# Threshold (Shamir k-of-n) at each CA/identity root — true never-single-key / ∅-blast-radius (math team refuted per-user-CA-alone; relocates SPOF to N single keys) (2026-06-21)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KVP3GYW108QG0R003V7E6VT-*.md` glob. -->

## Carved sentence

> Per-user CA alone does NOT remove the identity single-point-of-failure — the math team (Soraya,
> 2026-06-21) proved it RELOCATES/partitions it to N per-principal single keys. To actually achieve
> **never-single-key / ∅-blast-radius at the identity layer**, add **threshold (Shamir k-of-n)** at
> each CA/identity root (per-user roots AND the CA crown jewel). This is Aaron's "1-of-2 seeds /
> N-of-M" intuition applied to the CA roots, not just seeds.

## Detail

- **Why:** Claim 4 of the toy-model review FAILED ("removes" → actually "relocates"); each principal
  still has exactly one forging key. Threshold k-of-n removes the single forging key.
- **Where:** each per-user CA root + the CA trust root; ties to ai-sovereignty-path N-of-M HSM.
- **Prove:** `IdentityReissuable` / never-single-key — **Alloy** path-existence (with/without shares)
  + **Z3 (QF_BV/QF_LIA)** for the k-of-n share arithmetic (+ FsCheck for reconstruction). P0 → ≥2 tools.
- **Anchors:** Shamir 1979 (secret sharing), threshold signatures. Findings doc:
  `docs/research/2026-06-21-math-team-FINDINGS-ca-teardown-per-user-ca-relocates-spof-…`.
