---
id: B-0037.4
zetaid: 081KR7JY10008QG0R001J11M38
priority: P2
status: open
title: "B-0037.4 — ADR for distributed-vs-concentrated meta-cognition framework"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0037.1, B-0037.2, B-0037.3]
parent: B-0037
classification: blocked
type: decision
effort: S

---

# B-0037.4 — ADR for distributed-vs-concentrated meta-cognition framework

**Slice of:** [B-0037](B-0037-meta-cognition-first-class-factory-discipline.md)

## What

Write an ADR under `docs/DECISIONS/` that formally records the framework
decision: **distributed meta-cognition** (current state — every persona/skill
carries its own meta-layer) vs. **concentrated meta-cognition** (alternative —
a dedicated meta-cognitive persona role synthesises across the roster).

Pre-commit from the B-0037 row body: keep **distributed** until evidence says
otherwise. The ADR records *why*, not *what*.

## Why

Depends on B-0037.1 (taxonomy clarifies what's distributed), B-0037.2
(checklist reveals whether distribution is working), and B-0037.3 (measurables
surface evidence that might justify concentration). The ADR closes the loop
from survey → measurement → decision.

Requires Aaron sign-off before any concentration is proposed, per the B-0037
row body: *"pre-commit: distributed until evidence says otherwise. Decision
gate: Aaron sign-off if concentration ever proposed."*

## Acceptance criteria

1. ADR file exists under `docs/DECISIONS/` with date prefix.
2. ADR records both options (distributed / concentrated) and their trade-offs
   using the F1/F2/F3 three-filter discipline.
3. ADR records decision as **distributed**, with the evidence threshold that
   would trigger revisit.
4. ADR cross-references B-0037.1 taxonomy, B-0037.2 checklist, B-0037.3
   measurables, and the yin-yang pair-audit memory
   (`feedback_yin_yang_unification_plus_harmonious_division_paired_invariant.md`).
5. `dotnet build -c Release` unaffected.

## Out of scope

- Any change to the distributed status quo (that requires Aaron sign-off +
  new ADR row).
- Implementation of a concentrated meta-cognitive persona (WONT-DO for now).
