---
id: 081KS3X9Y0008QG0R003R74B20
priority: P3
status: open
title: Tick-shard immutability CI gate — block PRs modifying historical shards after grace period
tier: substrate-engineering
effort: S
ask: substrate-honest catch from Codex P1 on PR #4534 (2026-05-21 cleanup arc)
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRMEXM0008QG0R000X1PPGC]
tags: [audit, ci-gate, immutability, hygiene-history, event-sourcing, codex-finding]
type: feature
---

# Tick-shard immutability CI gate

A CI gate that fails any PR which modifies tick shards at `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` whose file age exceeds a grace period (e.g., 24 hours from the file's first appearance on main).

## Why

Tick shards are documented as immutable Event-Sourcing-style records per [`docs/hygiene-history/ticks/README.md`](../../hygiene-history/ticks/README.md) and [`tools/hygiene/AUDIT-LIFECYCLE.md`](../../../tools/hygiene/AUDIT-LIFECYCLE.md) ("When pre-existing residue is immutable, baseline is the path"). The discipline relies on author-side recognition during cleanup work; it has no mechanical enforcement.

## Empirical anchor

The 2026-05-21 audit-baseline cleanup arc (PRs [#4524](https://github.com/Lucent-Financial-Group/Zeta/pull/4524) / [#4525](https://github.com/Lucent-Financial-Group/Zeta/pull/4525) / [#4526](https://github.com/Lucent-Financial-Group/Zeta/pull/4526) / [#4531](https://github.com/Lucent-Financial-Group/Zeta/pull/4531) / [#4533](https://github.com/Lucent-Financial-Group/Zeta/pull/4533) / partial [#4534](https://github.com/Lucent-Financial-Group/Zeta/pull/4534) before pivot) violated the immutability discipline by editing historical tick shards to fix path-depth bugs. The violation pattern was:

1. Author launches multi-PR cleanup arc without consulting `AUDIT-LIFECYCLE.md`
2. Pattern matches the §33-migration cleanup-via-edit example (mutable surface)
3. Tick shards are immutable but the pattern was misapplied
4. Codex caught the LAST PR but the first 5 merged before catch
5. Pivot via compatibility-artifact (#4534 final commit) demonstrates the correct path

A mechanical gate would catch the misapplication before merge — substrate-level prevention rather than author-side discipline alone.

## Proposed mechanism

```bash
bun tools/hygiene/audit-tick-shard-immutability.ts --enforce
```

Logic:

1. For each tick shard modified in the PR (vs `main`), look up its first appearance on `origin/main` via `git log --reverse --format=%ct --follow -- <path> | head -1`
2. If the shard is older than the grace period (e.g., 24h), fail with a substrate-honest message pointing at `AUDIT-LIFECYCLE.md` and the compatibility-artifact alternative
3. Workflow entry in `.github/workflows/gate.yml` non-required initially (informational); promote to required after a quiet period per the `AUDIT-LIFECYCLE.md` staged-rollout

## Acceptance

- [ ] `tools/hygiene/audit-tick-shard-immutability.ts` exists with `--enforce` / `--json` / `--files` flags matching the audit-tool family conventions
- [ ] Test file at `tools/hygiene/audit-tick-shard-immutability.test.ts`
- [ ] Baseline at `tools/hygiene/audit-tick-shard-immutability.baseline.json` capturing the existing violations from the 2026-05-21 cleanup arc (so the gate can land without burst-cleanup)
- [ ] CI workflow entry in `.github/workflows/gate.yml` as non-required initial check
- [ ] Self-test: the gate would have failed each of #4524–#4533 (verifying retroactive correctness)
- [ ] Grace period configurable (default 24h)

## Composes with

- [`docs/hygiene-history/ticks/README.md`](../../hygiene-history/ticks/README.md) — Event-Sourcing immutability doc
- [`tools/hygiene/AUDIT-LIFECYCLE.md`](../../../tools/hygiene/AUDIT-LIFECYCLE.md) — staged-rollout pattern this row instantiates
- [`tools/hygiene/audit-tick-shard-relative-paths.ts`](../../../tools/hygiene/audit-tick-shard-relative-paths.ts) — sibling audit tool; same authoring template
- [081KRMEXM0008QG0R000X1PPGC](./081KRMEXM0008QG0R000X1PPGC-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) — multi-Otto coordination; the same substrate-engineering layer

## Substrate-honest caveat

This row exists because the discipline failed mechanically AND author-side, and the author (me) wants the structural improvement carved into substrate rather than relying on future-me to read AUDIT-LIFECYCLE. The proposal is bounded; a small audit tool with the same shape as existing siblings.

If a maintainer reviewing this row decides the lesson is sufficient as-documented (no gate needed; author-side discipline is the floor), close as `wontfix` — the row's existence is the substrate, not the implementation.
