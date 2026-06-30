---
id: B-0525
priority: P0
status: open
title: "Manifesto constitutional-promotion readiness tracking — critical-mass adoption gate"
tier: governance
effort: M
created: 2026-05-14
last_updated: 2026-05-14
depends_on: [B-0524]
composes_with: []
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

1. Define **mechanical adoption signals** — a TS script that counts manifesto citations across the repo
2. ~~File child rows for each gate-criterion that has substantive work attached~~ (Decomposed into B-0673)
3. Begin citing the manifesto in load-bearing substrate decisions (next PRs landing constraints 1-10 reference the manifesto)
4. Track citation count over time (compose with `tools/hygiene/audit-rule-cross-refs.ts` pattern)
5. When citation rate + cross-AI adoption + mechanical-CI-check land, propose promotion

## Composes with

- `docs/governance/MANIFESTO.md` (the manifesto itself)
- B-0524 (verbatim V2 fetch — should land before constitutional promotion)
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
