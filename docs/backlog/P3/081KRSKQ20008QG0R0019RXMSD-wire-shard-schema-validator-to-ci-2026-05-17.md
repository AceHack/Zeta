---
id: 081KRSKQ20008QG0R0019RXMSD
priority: P3
status: open
title: Wire tick-shard schema validator into gate.yml (non-required → required)
created: 2026-05-17
last_updated: 2026-05-17
depends_on: [081KRMEXM0008QG0R002HBY56V]
parent: 081KRMEXM0008QG0R002HBY56V
type: factory-hygiene
decomposition: atomic
---

# 081KRSKQ20008QG0R0019RXMSD — Wire tick-shard schema validator into gate.yml

**Priority:** P3 (non-blocking — validator is advisory until shards are compliant).
**Filed:** 2026-05-17.
**Filed by:** Otto-CLI.
**Effort:** S (single workflow edit + sweep cycle).
**Parent:** [081KRMEXM0008QG0R002HBY56V](../P2/081KRMEXM0008QG0R002HBY56V-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md) Recommendation "Later" item.

## What

`tools/hygiene/check-tick-history-shard-schema.ts` validates that every tick shard's first non-empty line is a 6-column pipe-row matching the path/filename timestamp. Today the validator exists but is NOT wired into any CI workflow (`grep -rn "check-tick-history-shard-schema" .github/workflows/` returns 0 matches).

Per 081KRMEXM0008QG0R002HBY56V's Recommendation:

> **Later** (separate row): wire the validator into CI's `gate.yml` as a non-required check first, promote to required after a sweep cycle.

This row tracks that work.

## Why this matters

The 081KRMEXM0008QG0R002HBY56V cycle landed two pieces of substrate on main today (2026-05-17):

- [PR #3990](https://github.com/Lucent-Financial-Group/Zeta/pull/3990) — `tools/hygiene/add-pipe-row-header.ts` (the retrofit tool + 28 unit tests)
- [PR #4004](https://github.com/Lucent-Financial-Group/Zeta/pull/4004) — README hybrid-pattern endorsement

What is STILL missing: a CI gate that catches new shards that don't follow the schema. Without it, future shards can re-introduce the drift (the same failure mode that produced 359 violations in the first place — well-intentioned authors writing H1-first without realizing the schema validator existed).

## Acceptance

- [ ] **Slice 1 (this row, P3): wire validator as non-required check** in `.github/workflows/gate.yml`. Job runs on every PR that touches `docs/hygiene-history/ticks/**.md`. Non-required means CI surfaces the violation but does not block merge. Provides observability without enforcement.
- [ ] **Slice 2 (separate row, after Slice 1 + bulk-retrofit lands): promote to required check**. Pre-requisite: 0 existing violations on `main` (so the required check passes on every PR touching shards). Bulk retrofit (running `tools/hygiene/add-pipe-row-header.ts --write` on all 359 non-compliant shards) is the precondition.

## Why P3, not P2

The drift is non-blocking today (validator unwired). The reverse-drift risk (new shards re-introducing violations) is real but slow — the operational cost is "a few new violations per week until detected." Filing as P3 because:

- P0/P1 reserved for blocking issues
- P2 reserved for clear value-multiplier substrate (081KRMEXM0008QG0R002HBY56V itself was P2 because it's the parent row covering the whole drift)
- This row is the gate-wiring slice — meaningful but not urgent

If reviewer triage promotes to P2 that's fine.

## Composes with

- [`docs/backlog/P2/081KRMEXM0008QG0R002HBY56V-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md`](../P2/081KRMEXM0008QG0R002HBY56V-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md) (parent)
- [`tools/hygiene/check-tick-history-shard-schema.ts`](../../../tools/hygiene/check-tick-history-shard-schema.ts) (the validator to wire)
- [`tools/hygiene/add-pipe-row-header.ts`](../../../tools/hygiene/add-pipe-row-header.ts) (the retrofit tool; bulk-run is precondition for Slice 2)
- [`.github/workflows/gate.yml`](../../../.github/workflows/gate.yml) (target workflow)
- [`docs/hygiene-history/ticks/README.md`](../../hygiene-history/ticks/README.md) (schema docs; updated in PR #4004)

## Not in scope

- The bulk-retrofit `--write` run across all 359 non-compliant shards. That is the precondition for Slice 2 (promote-to-required) but should be its OWN row (huge PR; separate review cost). Candidate name: `B-NNNN-shard-pipe-row-bulk-retrofit-run-2026-05-17.md`.
- Migrating pre-2026-04-29 legacy single-row-format shards. Per 081KRMEXM0008QG0R002HBY56V: those stay in legacy format as historical record.
