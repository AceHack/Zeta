---
id: B-0029.7
zetaid: 081KR50HA0008QG0R002TZ34SF
priority: P2
status: open
title: "B-0029.7 — Measurement design: self-sustaining loop closure (does the funding → time-budget → output feedback loop close?)"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0029
depends_on: [B-0029.1, B-0029.2, B-0029.3, B-0029.5, B-0029.6]
classification: blocked-on-B-0029.1+B-0029.2+B-0029.3+B-0029.5+B-0029.6
type: research
effort: M
decomposition: atomic
---

# B-0029.7 — Self-sustaining loop closure measurement design

**Slice of:** [B-0029](B-0029-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md)

## What

Design the measurement framework that answers: **does the funding → time-budget → output loop actually close?**

The Superfluid AI thesis depends on a feedback loop:
```
substrate output → economic value → revenue → Aaron's time → more substrate output → ...
```

This row designs the observable-variable set that distinguishes "loop is closing" from "loop is not closing" — the falsifiable test of B-0029's core thesis.

Deliverable: `docs/research/B-0029.7-loop-closure-measurement-design.md`

## Acceptance criteria

- [ ] `docs/research/B-0029.7-loop-closure-measurement-design.md` committed
- [ ] Each active funding surface (from B-0029.1-B-0029.6 findings) has at least one measurable proxy for revenue-flow
- [ ] Aaron's time-budget observable: what signals indicate that funding actually freed time? (session length, frequency, focus-depth proxy)
- [ ] "Graduation criteria" defined for B-0029 umbrella closure: what does "self-sustaining" mean measurably?
- [ ] Minimum viable measurement cadence: how often to check each metric?
- [ ] The "Superfluid AI" phase-transition threshold: at what revenue level does the loop become genuinely self-sustaining vs supplemental?

## Why blocked on the upstream rows

The measurement design depends on which surfaces are actually activated (B-0029.2 setup + B-0029.3 grants + B-0029.5 SaaS + B-0029.6 licensing). Designing metrics before knowing which surfaces are live would produce phantom measurements for surfaces that never activate.

B-0029.4 (trading path reframe) is a maintenance row and does not block this row.

## Out of scope

- Does NOT implement any tracking infrastructure (this is design-only)
- Does NOT evaluate which funding surfaces to pursue (upstream rows do that)
- Does NOT commit to any specific revenue target (design surface only)

## Effort sizing

M — synthesis across 5 upstream research docs; measurement framework design; one output doc.
