---
id: B-0037.1
zetaid: 081KR7JY10008QG0R0038AFS7T
priority: P2
status: closed
title: "B-0037.1 — Meta-cognition taxonomy survey doc"
created: 2026-05-10
last_updated: 2026-05-16
depends_on: []
parent: B-0037
classification: buildable-now
type: research
effort: S

---

# B-0037.1 — Meta-cognition taxonomy survey doc

**Slice of:** [B-0037](B-0037-meta-cognition-first-class-factory-discipline.md)

## What

Write `docs/research/meta-cognition-survey-2026-04-21.md` — a taxonomy
document that names the factory's implicit meta-cognitive moves as a coherent
class, classifies them by order (first / second / third / retractible-ceiling),
and surfaces them as an auditable discipline.

Content is substantially pre-crystallised in
`memory/feedback_meta_cognition_first_class_factory_discipline_backlog_meta_congnition_2026_04_21.md`
and the B-0037 row body. This child converts that memory into a canonical
research-surface doc with proper structure, cross-references, and chronology
preservation.

## Why

The three remaining B-0037 children (per-round checklist, measurables wiring,
ADR) all depend on having a named, structured taxonomy. Without this doc, those
children have no anchor to reference. This is the root dependency.

## Acceptance criteria

1. `docs/research/meta-cognition-survey-2026-04-21.md` exists and is committed.
2. Doc names all eleven implicit meta-cognitive moves identified in the memory
   file and classifies each by order (first / second / third).
3. Doc includes the "retractible ceiling" revision from Aaron's three-message
   correction arc (2026-04-21) with chronology preserved.
4. Doc includes measurables candidates table (six metrics).
5. Doc cross-references all composing memory files and docs.
6. `dotnet build -c Release` unaffected (pure doc addition).

## Out of scope (for later children)

- Per-round meta-check checklist in ROUND-HISTORY.md template (B-0037.2).
- Measurables wired into ALIGNMENT.md dashboard (B-0037.3).
- ADR for distributed-vs-concentrated framework decision (B-0037.4).

## Resolution

Closed 2026-05-16 via audit-triage discovery of substrate drift:

- **Deliverable shipped**: `docs/research/meta-cognition-survey-2026-04-21.md` (172 lines, 8 sections, all six acceptance criteria met)
- **Drift class**: #1 (pure drift) — file's revision history shows 2026-05-10 implementation landing as "B-0037.1 implementation"; the row's `status: open` was never updated
- **Acceptance verification** (zero gh, from current main):
  - ✅ File exists and is committed
  - ✅ Section 3 names all eleven implicit meta-cognitive moves classified by Order (First/Second/Third) in numbered table
  - ✅ Section 8 includes the retractible-ceiling revision from Aaron's three-message correction arc with chronology preserved
  - ✅ Section 4 includes six measurables candidates table
  - ✅ Section 7 cross-references composing memory files + docs
  - ✅ Pure doc addition — `dotnet build -c Release` unaffected
- **Surfaced by**: `tools/hygiene/audit-backlog-status-drift.ts` candidate list + manual existence + content-coverage check
- **Composes with**: parent B-0037 + siblings B-0037.2 / B-0037.3 / B-0037.4 (which remain open and depend on this row's deliverable per the survey doc's section 4 reference to B-0037.3)
