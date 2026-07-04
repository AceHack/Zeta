---
id: 081KVP3GYW108QG0R003V7E6VT
type: task
state: closed
priority: P1
slug: threshold-shamir-k-of-n-at-each-ca-identity-root-true-never
title: "Threshold (Shamir k-of-n) at each CA/identity root — true never-single-key / ∅-blast-radius (math team refuted per-user-CA-alone; relocates SPOF to N single keys) (2026-06-21)"
created: 2026-06-21T22:06:25.153Z
depends_on: []
composes_with: ["081KVNXBR4S08QG0R0015DHBBN", "081KVNTNTDQ08QG0R0017NBBWB"]
---

# Threshold (Shamir k-of-n) at each CA/identity root — true never-single-key / ∅-blast-radius

## Carved sentence

> Per-user CA alone does NOT remove the identity single-point-of-failure — the math team (Soraya,
> 2026-06-21) proved it RELOCATES/partitions it to N per-principal single keys. To actually achieve
> **never-single-key / ∅-blast-radius at the identity layer**, add **threshold (Shamir k-of-n)** at
> each CA/identity root (per-user roots AND the CA crown jewel).

## Done (reference oracle slice)

- **✅ `tools/setup/persona-keys/shamir.ts`** — GF(257) byte-wise Shamir split/combine; k-of-n threshold
- **✅ `shamir.test.ts`** — round-trip, subset reconstruction, property trials
- **✅ Harness gap-closed assertion** in `onboarding-roundtrip.test.ts`
- **✅ `ca-shamir-custody.ts` + `ca-shamir-cli.ts`** — split/combine LOCAL CA private key into k-of-n shares; wired from `ca-cli.ts` (`--shamir`) and `rotate-cli.ts` (`--confirm --shamir`)
- **✅ BP-16 formal leg** — `src/Core/Shamir.fs` + `Shamir.CrossVerify.Tests.fs` (Z3 k=2/k=3 Lagrange unsat, FsCheck round-trip + field inverses, golden seed shared with TS)
- **✅ Alloy `IdentityReissuable`** — `src/Core.Alloy/specs/IdentityReissuable.als` (single-key orphan `run`, threshold recovery `run`, shares/live-key imply reissuable `check`); wired into `Alloy.Runner.Tests.fs` with `TrustGraph.als`

## Deferred (follow-on slices)

- FROST/threshold-MPC for live signing without reassembly (agent-native-key-custody design)

## Anchors

Shamir 1979; findings doc `docs/research/2026-06-21-math-team-FINDINGS-ca-teardown-per-user-ca-relocates-spof-…`
