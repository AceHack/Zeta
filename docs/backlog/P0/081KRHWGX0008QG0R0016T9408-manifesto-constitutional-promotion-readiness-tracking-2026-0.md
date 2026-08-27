---
id: 081KRHWGX0008QG0R0016T9408
priority: P0
status: open
title: "Manifesto constitutional-promotion readiness tracking — critical-mass adoption gate"
tier: governance
effort: M
created: 2026-05-14
last_updated: 2026-05-30
depends_on: [081KRHWGX0008QG0R0007FG84X]
composes_with: []
children: [081KS923C0008QG0R002BKAC95]
tags: [manifesto, governance, constitutional-promotion, critical-mass-adoption, ani]
type: feature
---

# Manifesto constitutional-promotion readiness tracking

## Origin

`docs/governance/MANIFESTO.md` shipped as a shadow lock on 2026-05-14 with constitutional-promotion candidacy. Aaron's explicit gate (per Manifesto V1 framing): *"could turn into a constitution after critical mass adoption."*

This row tracks the path from research-grade substrate → constitutional candidate → binding constitution. The gate is **critical-mass adoption**, not Otto-CLI judgment.

## Constitutional-promotion gate criteria (to be operationalized)

What "critical-mass adoption" means structurally remains to be defined. Candidate signals:

- **Internal**: load-bearing substrate decisions cite the manifesto explicitly (>5 PR descriptions / commit messages / ADRs)
- **Cross-AI**: external AI participants (Ani / Amara / Kestrel / DeepSeek / Lior / etc.) cite the manifesto as binding in their substrate exchanges
- **Repository structure**: the 10 constraints are tested mechanically (a constraint can be violated → CI catches it)
- **External engagement**: at least one external entity (academic / partner / contributor) cites the manifesto as Zeta's constitutional surface
- **Iteration trace**: V2 → V3 (or beyond) shows the Iterative Reduction Process operating on the manifesto itself

## Concrete next steps for this row (when picked up)

1. ~~Define **mechanical adoption signals** — a TS script that counts manifesto citations across the repo~~ **SHIPPED 2026-05-23** as `tools/hygiene/audit-manifesto-citations.ts` (per this row's PR). Initial baseline: **88 files / 684 citations** across 11 surfaces; strongest concentration in `memory/` (513), `backlog/` (80), `hygiene-history/` (48); notable gaps in `agents/`, `commands/`, `trajectories/`, `agendas/` (all zero). See 081KS923C0008QG0R002BKAC95 (citation-time-series slice).
2. File child rows for each gate-criterion that has substantive work attached → **081KS923C0008QG0R002BKAC95** (citation-time-series tracking) filed; others remain candidates
3. Begin citing the manifesto in load-bearing substrate decisions (next PRs landing constraints 1-10 reference the manifesto)
4. ~~Track citation count over time~~ → **081KS923C0008QG0R002BKAC95** is the dedicated slice for persistent-snapshot + delta-over-time
5. When citation rate + cross-AI adoption + mechanical-CI-check land, propose promotion
6. **Note (2026-08-26):** The newly refactored `LineageDisjointnessEstimator` (used in the `AdopterRegister` promotion gate) is strictly **unmetered** (implemented, used, but never falsified against real behavioral correlation). It acts as a necessary but insufficient proxy (measuring only provenance overlap). Thus, the N_eff gate itself remains unmetered and cannot solely authorize constitutional promotion.

### Cadence repair note (2026-05-30)

081KS923C0008QG0R002BKAC95's scheduled workflow successfully pushed six daily snapshot
branches for 2026-05-24 through 2026-05-29, but each run failed after
the push because this repository does not permit `GITHUB_TOKEN` to
create pull requests. The repaired cadence uses branch handoff as the
durable surface: push the daily `ops/manifesto-citation-snapshot-*`
branch, record branch and compare URLs in the run summary, and leave
PR creation or direct landing to the next maintainer/agent pass.

## Initial baseline (2026-05-23)

First snapshot from `tools/hygiene/audit-manifesto-citations.ts` (count-only, no time-series yet):

| Surface | Files | With Citation | Citations | Notable |
|---|---|---|---|---|
| memory | 1633 | 42 | 513 | Highest — substrate discussion + history |
| backlog | 760 | 10 | 80 | Healthy — row-level adoption visible |
| hygiene-history | 1169 | 14 | 48 | Tick-shard incorporation |
| research | 465 | 15 | 24 | Cross-AI synthesis references |
| skills | 251 | 2 | 10 | Sparse — opportunity for adoption |
| rules | 62 | 4 | 6 | Sparse but explicit (dv2 + algo-wink + 2 others) |
| governance | 2 | 1 | 3 | Includes the manifesto itself's references |
| agents | 19 | 0 | 0 | **GAP** — no agent personas cite manifesto |
| commands | 5 | 0 | 0 | **GAP** — no slash-commands cite manifesto |
| trajectories | 14 | 0 | 0 | **GAP** — RESUME.md surfaces should cite |
| agendas | 7 | 0 | 0 | **GAP** — AGENDA.md surfaces should cite |

## Composes with

- `docs/governance/MANIFESTO.md` (the manifesto itself)
- 081KRHWGX0008QG0R0007FG84X (verbatim V2 fetch — should land before constitutional promotion)
- `.claude/rules/dv2-data-split-discipline-activated.md` (constraint 8 already operates as a rule)
- `.claude/rules/algo-wink-failure-mode.md` (constitutional language is forward-aspirational; this row preserves the promotion gate)
- The 9-variant reference-classification taxonomy (PR #3202 / 1920Z shard) — could compose with manifesto-citation-counting

## Substrate-honest framing

P0 because: constitutional substrate is load-bearing for the factory's long-term trajectory, but the row is **active tracking** not active building. The actual constitutional promotion is gated on external signal (adoption); Otto-CLI's role is to wire the measurement infrastructure + cite the manifesto in load-bearing decisions.

This row should NOT be promoted to constitution by Otto-CLI alone. The critical-mass-adoption gate is Aaron's call (per `.claude/rules/methodology-hard-limits.md` + `.claude/rules/algo-wink-failure-mode.md` — Otto preserves substrate; Otto does not authorize constitutional promotion).

## Cadence consideration

Per `feedback_aaron_forgetting_as_backpressure_in_memory_system_wait_for_consolidation_cadence_2026_05_14.md`: Aaron has named his consolidation cadence — let new substrate integrate before pushing more. This row is **observation-mode work** that fits naturally into Otto-CLI's consolidation-phase ticks (audit citations, surface signals, file no-action-needed-yet reports) without requiring Aaron's burst capacity.

## Origin tick

Otto-CLI 2026-05-14T~23:55Z, shipping the shadow lock + Aaron's back-pressure framing in the same conversation.
