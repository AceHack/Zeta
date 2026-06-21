---
id: 081KRA5AR0008QG0R003F6TA3A
priority: P2
status: open
title: Encode T1 self-audit + T2 cadenced review (TS-preferred tooling + trajectory packet)
tier: factory-hygiene
effort: S
ask: Cadence surface per 081KQ8P5D0008QG0R003ZF64GG (T3 deferred)
created: 2026-05-11
last_updated: 2026-05-14
parent: 081KQ8P5D0008QG0R003ZF64GG
depends_on: [081KRA5AR0008QG0R0029YWXYW]
composes_with: [081KQ8P5D0008QG0R0002TN22C]
renumbered_from: 081KR2E4K0008QG0R0015BCPF7
renumbered_reason: "ID collision with 081KR2E4K0008QG0R0015BCPF7 P1 (pages-sitemap-robots-ai-crawler-policy). Part of the P2 contributor-compliance set renumbered as a unit: 081KR2E4K0008QG0R000ARCH0X→081KRA5AR0008QG0R0029YWXYW, 081KR2E4K0008QG0R001733JTN→081KRA5AR0008QG0R0004P7SWS, 081KR2E4K0008QG0R0015BCPF7→081KRA5AR0008QG0R003F6TA3A, 081KR50HA0008QG0R001NNPEXC→081KRA5AR0008QG0R0033TJSAF. Internal depends_on 081KR2E4K0008QG0R000ARCH0X remapped to 081KRA5AR0008QG0R0029YWXYW. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [contributor-compliance, trajectory, T1, T2, TS, renumbered]
decomposition: atomic
classification: buildable-now
---

# 081KRA5AR0008QG0R003F6TA3A — T1 + T2 trajectory encoding (renumbered from 081KR2E4K0008QG0R0015BCPF7)

## Scope (atomic, TS first)

- T1: Pre-commit audit helper (TS script under tools/hygiene/ or .claude/hooks, regex for insider terms, manual-inspect guidance).
- T2: Weekly/monthly review packet (doc in docs/trajectories/ or memory/ + schedule note; 3-bucket CLEAN/NEEDS-REWORD/NEEDS-REDACTION).
- Prefer TS/Bun over bash per Rule 0.
- T3 (CI lint) explicitly out of scope (sibling row).

## Acceptance

- [ ] T1 runnable TS tool or hook exists.
- [ ] T2 cadence documented + added to weekly schedule.
- [ ] No PR auto-block; inspection only.

## Why S atomic

Lowest-cost trajectories first; re-decomp if script grows.
