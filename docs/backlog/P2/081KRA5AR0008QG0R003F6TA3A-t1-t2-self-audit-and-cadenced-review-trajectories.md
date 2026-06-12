---
id: B-0454
zetaid: 081KRA5AR0008QG0R003F6TA3A
priority: P2
status: open
title: Encode T1 self-audit + T2 cadenced review (TS-preferred tooling + trajectory packet)
tier: factory-hygiene
effort: S
ask: Cadence surface per B-0092 (T3 deferred)
created: 2026-05-11
last_updated: 2026-05-14
parent: B-0092
depends_on: [B-0452]
composes_with: [B-0090]
renumbered_from: B-0372
renumbered_reason: "ID collision with B-0372 P1 (pages-sitemap-robots-ai-crawler-policy). Part of the P2 contributor-compliance set renumbered as a unit: B-0370→B-0452, B-0371→B-0453, B-0372→B-0454, B-0373→B-0455. Internal depends_on B-0370 remapped to B-0452. Substrate-cleanup tracked in B-0451."
tags: [contributor-compliance, trajectory, T1, T2, TS, renumbered]
decomposition: atomic
classification: buildable-now
---

# B-0454 — T1 + T2 trajectory encoding (renumbered from B-0372)

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
