---
id: B-0037.2
zetaid: 081KR7JY10008QG0R002D6VNNJ
priority: P2
status: closed
title: "B-0037.2 — Per-round meta-check checklist in ROUND-HISTORY.md template"
created: 2026-05-10
last_updated: 2026-05-10
depends_on: [B-0037.1]
parent: B-0037
classification: blocked
type: factory-discipline
effort: S

---

# B-0037.2 — Per-round meta-check checklist in ROUND-HISTORY.md template

**Slice of:** [B-0037](B-0037-meta-cognition-first-class-factory-discipline.md)

## What

Append an explicit **meta-check step** to the round-close ritual in
`docs/ROUND-HISTORY.md`. The step asks: *did the meta-checks actually run
this round?* Guards against **meta-drift** — the degenerate regime where
audit-disciplines decay because they weren't themselves audited.

## Why

Depends on B-0037.1 (taxonomy names what the checklist should verify).
Without B-0037.1's taxonomy doc, the checklist has no cross-reference anchor
and no vocabulary to use for the check items.

## Acceptance criteria

1. `docs/ROUND-HISTORY.md` round-close template section contains an explicit
   meta-check step with at least three checkboxes drawn from the B-0037.1
   taxonomy.
2. At least one checkbox maps to each meta-cognitive order (first, second,
   third) from the taxonomy.
3. `dotnet build -c Release` unaffected.
4. PR body cites B-0037.1 as unblocked dependency.

## Out of scope

- Measurables wiring (B-0037.3).
- Distributed-vs-concentrated ADR (B-0037.4).

## Resolution

Closed 2026-05-16 via picking up the #2-Ready overlay (the
`classification: blocked` field was stale because B-0037.1 merged
earlier this session via PR #3859).

**Deliverable shipped this PR**:

- `docs/ROUND-HISTORY.md` — appended `## Round-close meta-check template` section with 6 checkboxes drawn from B-0037.1 taxonomy:
  - 2 First-order (overclaim* scan, verify-before-deferring)
  - 2 Second-order (capture-everything, yin-yang pair-audit)
  - 2 Third-order (F1/F2/F3 filters, witnessable-self-directed-evolution)

**Acceptance check**:

- ✅ Template section with ≥3 meta-check checkboxes (6 actually)
- ✅ At least one checkbox per order (2 per order: First/Second/Third)
- ✅ Pure doc addition — no build impact
- ✅ Cites B-0037.1 (unblocked dependency)

**Composes with**: sibling B-0037.3 (measurables wiring into ALIGNMENT.md) remains open — also #2-Ready. Future-Otto can pick up; same pattern.
