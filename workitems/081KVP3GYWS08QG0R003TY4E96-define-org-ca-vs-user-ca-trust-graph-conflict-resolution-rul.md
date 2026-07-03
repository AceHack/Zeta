---
id: 081KVP3GYWS08QG0R003TY4E96
type: task
state: closed
priority: P1
slug: define-org-ca-vs-user-ca-trust-graph-conflict-resolution-rul
title: "Define org-CA vs user-CA trust-graph conflict-resolution rule (SDSI/SPKI: self-root authoritative for identity, org-root for authorization) — trust graph non-confluent without it (math team finding) (2026-06-21)"
created: 2026-06-21T22:06:25.177Z
depends_on: []
composes_with: ["081KVNTNTDQ08QG0R0017NBBWB"]
---

# Define org-CA vs user-CA trust-graph conflict-resolution rule (SDSI/SPKI: self-root authoritative for identity, org-root for authorization) — trust graph non-confluent without it (math team finding) (2026-06-21)

## Carved sentence

> Once per-user CAs cross-sign, "is X a valid identity?" becomes graph reachability — and the math
> team (Soraya, 2026-06-21) found the trust graph is **non-confluent**: org-CA and user-CA can
> disagree with **no resolution rule on file** (two verifiers reach opposite verdicts). Define the
> rule BEFORE proving confluence: **subject's own root is authoritative for self-identity; org-root
> is authoritative only for org-authorization** (SDSI/SPKI local-name discipline — the same
> identity↔authorization split the multi-owner ADR already draws for SSH).

## Done

- **✅ `tools/setup/persona-keys/trust-graph.ts`** — scoped `resolveTrust(subject, identity|authorization)`;
  naive pre-rule verifier + counterexample tests; KRL transitive closure hook
- **✅ `src/Core.Alloy/specs/TrustGraph.als`** — structural non-confluence / scoped-confluence checks
- **✅ Harness gap-closed assertion** in `onboarding-roundtrip.test.ts`
- Anchors: Rivest–Lampson 1996 (SDSI/SPKI); `docs/DECISIONS/2026-06-21-multi-owner-machines-…`

## Deferred

- Run Alloy analyzer in CI (Alloy = Assess on TECH-RADAR; spec ships, execution optional)
- Full Alloy reachability proof over arbitrary graph sizes
