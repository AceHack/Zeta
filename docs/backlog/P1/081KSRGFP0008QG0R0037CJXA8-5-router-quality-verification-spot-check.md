---
id: 081KSRGFP0008QG0R0037CJXA8
priority: P1
status: open
title: "Router-quality verification — spot-check 10 carved skill descriptions"
created: 2026-05-29
last_updated: 2026-05-29
parent: 081KR50HA0008QG0R002ZNFQBZ
depends_on: []
classification: buildable-now
decomposition: atomic
type: friction-reducer
tags: [skill-routing, verification, carved-sentence]
---

# 081KSRGFP0008QG0R0037CJXA8 — Router-quality verification

Closes acceptance criterion #4 of the 081KR50HA0008QG0R002ZNFQBZ umbrella, the only
acceptance criterion still open. The bulk carving shipped (257/257
descriptions ≤150 chars, single-line, boilerplate-free) and the
durable audit gate landed via 081KR50HA0008QG0R002ZNFQBZ.4 (PR #6029). What remains is
confirming the carved sentences actually route correctly — a length
cap does not by itself prove a description still triggers the right
match.

## Work scope

Spot-check at least 10 carved skill descriptions by asking the router
(`Skill` tool description-matching) with a representative task for each
and confirming the correct skill is matched. Spread the sample across
categories so the check is not all from one batch:

- 2-3 infra/storage skills (e.g. elasticsearch-expert, vector-database-expert)
- 2-3 reviewer/auditor skills (e.g. spec-zealot, harsh-critic / code-review-zero-empathy)
- 2-3 data/AI skills (e.g. llm-systems-expert, probability-and-bayesian-inference-expert)
- 2-3 remaining (governance/ops/math)

For each: state the representative task, the expected skill, and the
matched skill. A mismatch means that description was carved too far
and needs a routing-term added back (carve, do not re-bloat).

## Acceptance criteria

- [ ] ≥10 skills spot-checked across ≥4 categories, results recorded
  in the PR body (task → expected → matched).
- [ ] Any mismatch surfaced is fixed by adding the missing routing
  term to that one description (single-line, still ≤150 chars per the
  081KR50HA0008QG0R002ZNFQBZ.4 gate).
- [ ] Re-run `bun tools/hygiene/audit-skill-description-length.ts`
  after any fix — still `0 errors`.

## Out of scope

- Skill body changes (descriptions only).
- The ≤120-char preferred tightening (that is 081KSRGFP0008QG0R002SV9GGY).
- CI wiring of the audit (that is 081KSRGFP0008QG0R00059AM3C).

## Composes with

- 081KR50HA0008QG0R002ZNFQBZ (umbrella) — this child closes its acceptance #4.
- 081KR50HA0008QG0R002ZNFQBZ.4 — the shipped audit gate this verification runs against.
- `tools/hygiene/audit-skill-description-length.ts` — re-run after fixes.
