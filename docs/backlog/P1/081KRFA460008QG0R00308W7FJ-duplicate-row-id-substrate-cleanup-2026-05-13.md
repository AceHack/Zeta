---
id: 081KRFA460008QG0R00308W7FJ
priority: P1
status: closed
closed: 2026-05-14
title: "Duplicate row-ID substrate cleanup — resolve the 12 collisions surfaced by audit-duplicate-row-ids.ts"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-14
depends_on: []
composes_with: []
tags: [substrate-hygiene, backlog, ID-collision, audit-finding, multi-Otto-coordination]
type: friction-reducer
---

# 081KRFA460008QG0R00308W7FJ — Duplicate row-ID substrate cleanup

## Origin

Filed 2026-05-13 after the same-tick discovery: while resolving the
081KRFA460008QG0R001SXP0C2 ID collision (PR #3053), an inline audit (`find docs/backlog
| awk` over each row's `id:` field) revealed **12 additional
duplicate-ID groups** across the backlog directory. The audit tool
`tools/bg/audit-duplicate-row-ids.ts` was shipped alongside this
row (same PR) to mechanize the check going forward.

## What the audit reports

```
$ bun tools/bg/audit-duplicate-row-ids.ts
audit-duplicate-row-ids: 12 duplicate-ID group(s) found across 559 rows:
  081KRA5AR0008QG0R001JVT5FX: forge-cli-ollama-research-slice (P2) vs -xs-riven (P2)
  081KDVJT3E008QG0R003GV8BHV: lost-substrate-3-bucket-classification-taxonomy vs ts-worktree-survey-atomic-riven
  081KDVJT3E008QG0R00183ME0R: ts-orphan-branch-survey-atomic-riven vs worktree-branch-delta-audit
  081KDVJT3E008QG0R000P3YGTX: closed-not-merged-pr-scan vs ts-closed-pr-survey-atomic-riven
  081KDVJT3E008QG0R002GGF22P: cadence-and-hygiene-history-hook vs ts-draft-pr-aged-survey-atomic-riven
  081KR2E4K0008QG0R000ARCH0X: durable-computation-checkpoint-interface (P1) vs contributor-compliance-core (P2)
  081KR2E4K0008QG0R001733JTN: pages-seo-metadata-jsonld (P1) vs contributor-compliance-cross-reference (P2)
  081KR2E4K0008QG0R0015BCPF7: pages-sitemap-robots (P1) vs t1-t2-self-audit-trajectories (P2)
  081KR50HA0008QG0R001NNPEXC: alignment-proof-primitive-ladder (P1) vs t4-t5-onboarding-drift-trajectories (P2)
  081KRA5AR0008QG0R000Y6102S: wallet-immune-system-vaccine (P1) vs amara-persona-bootstrap (P2) vs peer-call-ts-audit (P2) [3-way]
  081KRA5AR0008QG0R0035N4S6C: amara-ts-core-openai-api (P2) vs peer-call-persona-loader (P2)
  081KRA5AR0008QG0R000C3P8KP: amara-ts-readme-update-courier (P2) vs grok-ts-persona-flag (P2)
```

## Collision-class taxonomy

Two distinct collision patterns visible:

1. **Cross-priority namespace bleed** (`081KR2E4K0008QG0R000ARCH0X..081KR50HA0008QG0R001NNPEXC`): Otto-on-CLI
   filed P1 rows in the 0370 range (durable / SEO / sitemap /
   alignment) while a parallel agent filed P2 rows in the same
   range (contributor-compliance, trajectory-audit). The same
   pattern produced the 081KRFA460008QG0R001SXP0C2 P1+P2 collision resolved by PR #3053.

2. **Within-priority concurrent decomposition** (`081KRA5AR0008QG0R001JVT5FX`,
   `081KDVJT3E008QG0R003GV8BHV-4`, `081KRA5AR0008QG0R000Y6102S-0411`): Two agents (likely Riven + Otto)
   decomposed adjacent atomic sub-row series simultaneously and
   landed on overlapping sub-row numbers. Most are 2026-05-10/11
   timeframe — pre-claim-acquire-rule (PR #3032 landed 2026-05-13).

## Resolution per collision

For each colliding group, apply the substrate-honest rule (per
PR #3053's resolution):

1. **If one of the colliding rows has external references** (PR
   commits, sibling-row composes_with, etc.) → KEEP that one with
   its original ID.
2. **If both are unreferenced** → keep the one that was filed
   first (per git log on the directory).
3. **Renumber the other** to the next-free ID with
   `renumbered_from: B-NNNN` + reason in the frontmatter.
4. **Update all cross-references** to the renumbered row.

This is bounded mechanical work: 12 groups × ~5 minutes each =
~60 minutes total. Can be done atomically (one PR per group) or
bundled (one PR for the full sweep).

## Acceptance criteria

- [x] Each of the 12 colliding groups resolved — all 12 groups
      renumbered across PRs #3056–#3073; sweep complete 2026-05-14.
- [x] `bun tools/bg/audit-duplicate-row-ids.ts` exits 0 — verified
      2026-05-14: "561 rows with id field, no duplicate IDs", exit 0.
- [x] All cross-references updated — renumbered rows carry
      `renumbered_from` provenance in frontmatter; cross-refs patched.
- [x] `docs/BACKLOG.md` regenerated — updated in this close PR.

## Why P1

Silently-overwriting substrate state is high-severity hygiene risk.
A consumer of `id: 081KRA5AR0008QG0R000Y6102S` gets one of THREE files depending on
load order; the implicit "primary key" guarantee that every other
substrate consumer relies on is broken. The audit tool surfaces
the symptoms; this row tracks the cleanup.

## Composes with

- PR #3053 (the 081KRFA460008QG0R001SXP0C2 resolution that surfaced the broader pattern)
- PR shipping `tools/bg/audit-duplicate-row-ids.ts` (same as this
  row's filing PR)
- `.claude/rules/claim-acquire-before-worktree-work.md` — coordination
  discipline that would have prevented most of these had it been
  in force during the 05-10/11 timeframe

## Future work

- CI wiring (separate slice): `tools/bg/audit-duplicate-row-ids.ts`
  added as a required-check job so future collisions block merge.
- Mechanize "next-free-ID" lookup in row-creation tooling so manual
  ID selection doesn't drift.
