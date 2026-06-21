---
id: 081KRQ1AB0008QG0R001BPDBHT
priority: P1
status: closed
title: Alignment-clause drift detector tool and workflow
tier: substrate-foundational-discipline
effort: S
ask: Aaron 2026-04-21 (decomposed from 081KQ3HBZ0008QG0R002S674CG)
created: 2026-05-16
last_updated: 2026-05-29
decomposition: leaf
depends_on: [081KQ3HBZ0008QG0R002S674CG]
composes_with: [docs/ALIGNMENT.md]
tags: [ai-ethics, ai-safety, alignment, drift-detector, alignment-clause]
type: friction-reducer
---

# 081KRQ1AB0008QG0R001BPDBHT — Alignment-clause drift detector tool and workflow (P1)

## Origin

Decomposed from 081KQ3HBZ0008QG0R002S674CG (AI ethics + safety research track) to provide an atomic, implementable target for the alignment-clause drift detector mechanism.

## What this row owns

If a clause in `docs/ALIGNMENT.md` is about to be weakened or removed via the renegotiation protocol, this track generates the impact-survey across factory surfaces that touch the clause. Answers "who depends on this clause, and what breaks if it moves?" before the renegotiation is accepted.

Specifically, it requires building a script under `tools/` that can parse `docs/ALIGNMENT.md` and check other files (like personas, memory files, active backlog items) for references to HC-N, SD-N, or DIR-N clauses, providing a report of the blast radius of a change.

## Acceptance Criteria

- A script (e.g., `tools/alignment/detect-clause-drift.ts`) is created.
- The script correctly identifies cross-references to ALIGNMENT clauses across the repository.
- A workflow is established for using the tool before ALIGNMENT.md renegotiation is accepted.

## Owner / effort

- **Owner:** Alignment-auditor (Sova).
- **Effort:** S.

## Resolution (2026-05-29)

All three acceptance criteria met:

1. **Script created** — `tools/alignment/detect-clause-drift.ts` (shipped to
   `origin/main` prior to this close) walks the working tree for references to
   alignment clauses (HC-1..HC-7, SD-1..SD-9, DIR-1..DIR-5).
2. **Cross-references correctly identified** — `tools/alignment/detect-clause-drift.test.ts`
   (4 tests, green) verifies the clause matcher (word-boundary + bounded numeric
   ranges, no false positives on out-of-range IDs) and the per-clause reference map.
3. **Workflow established** — `tools/alignment/README.md` now documents the
   `detect-clause-drift.ts` tool in the script table and adds a
   "Pre-renegotiation impact-survey workflow" section: before any `docs/ALIGNMENT.md`
   clause weaken/remove is accepted, run `audit_clause_drift.ts` (names WHAT changed)
   then `detect-clause-drift.ts <CLAUSE>` (surveys WHO references it — the blast
   radius), then decide each referencing surface explicitly. The survey informs the
   renegotiation; it does not gate it (measurement, not enforcement).

The two clause tools compose on orthogonal axes: `audit_clause_drift.ts` is the
*temporal* diff (between two git refs), `detect-clause-drift.ts` is the *spatial*
survey (across the working tree). Criterion 3 was the gap this PR closed — the
spatial tool existed but was not wired into the documented pre-renegotiation
procedure.
