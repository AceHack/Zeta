---
title: State Reconciliation Table
canonical_name: Agentic Organization
status: v0
ideas: [2]
extends:
  - NORTH_STAR_ALIGNMENT_CHECKPOINT.md
  - WORK_AND_RELEASE_MANAGEMENT_OS.md
composes_with:
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./DOC_FRONTMATTER_CONVENTION.md
code_anchors:
  - ../packages/domain/src/state-reconciliation.ts
  - ../packages/domain/src/work-item-state-machine.ts
  - ../packages/application/src/observe.ts
supersedes: []
---

# State Reconciliation Table

North Star priority #2 ("State Name Divergence"): work-item state is named
differently across the Work OS, the V0 schema, the UI, the event names, and now
`observe.ts`. This is the **single authoritative mapping** so those surfaces stop
diverging — and the North Star names it as the *gate on adding more commands*,
which is why it is the first slice.

Implemented in `packages/domain/src/state-reconciliation.ts` (14 tests).

## The table

One row per real `WorkItemState`. The mapping is held as a
`Record<WorkItemState, StateReconciliationRow>` so it is **compile-exhaustive**:
adding a `WorkItemState` is a type error until a row is supplied (OCP — a new
state breaks the build, not just a runtime test).

| WorkItemState | Conceptual Work OS | UI column | Event | Gate owner |
|---|---|---|---|---|
| `created` | Captured | Backlog | `work_item.state_changed` | none |
| `intake` | Intake | Backlog | `work_item.state_changed` | none |
| `triage` | Triage | Triage | `work_item.state_changed` | Engineering Manager |
| `ready` | Ready | Ready | `work_item.state_changed` | Engineering Manager |
| `in_progress` | In Progress | In Progress | `work_item.state_changed` | none |
| `blocked` | Blocked | Blocked | `work_item.state_changed` | Engineering Manager |
| `review` | In Review | Review | `work_item.state_changed` | Code Reviewer |
| `done` | Done | Done | `work_item.state_changed` | Release Manager |

`eventName` is uniformly `work_item.state_changed` because that is the real
`AgenticEventType` emitted on any state transition — per-state event names are
not part of the vocabulary, so inventing them would *create* the divergence the
table exists to remove. `gateOwner` is an explicit `GateOwner` DU
(none / engineering_manager / code_reviewer / qa_reviewer / release_manager), not
a free string, so gate ownership is enumerable.

## observe.ts binding

`RUN_PHASE_FOR_STATE` maps each `WorkItemState` to the `observe.ts`
`RunLifecyclePhase` string it corresponds to. The domain package holds the phase
strings *literally* (not by importing the application package) to preserve the
dependency direction (domain ⊀ application); a test asserts all 8 states are
covered.

| WorkItemState | RunLifecyclePhase | Why |
|---|---|---|
| created / intake / triage | `observing` | not yet actionable by a run; the loop is watching for legal moves |
| ready | `composing` | a selectable work item exists; the composer plans |
| in_progress | `executing` | side-effecting work is happening |
| blocked | `blocked` | direct |
| review | `awaiting_review` | a reviewer is awaited |
| done | `completed` | terminal success |

This is the seam slice 4 uses to drive `observe()` from a real work item's state.

## Generic vs type-specific rules

The **generic** transitions (apply to every type) stay in
`work-item-state-machine.ts` — this module does not re-implement enforcement. It
adds only the **type-specific overlay** as an explicit `TypeSpecificRule` DU
(`no_skip_intake` / `requires_triage_evidence` /
`requires_assigned_engineer_and_schedule`), mirroring
`assertDefectTransitionRequirements`. `typeSpecificRulesFor(Defect)` returns the
3 defect rules; `typeSpecificRulesFor(Task)` is the empty subset.

## Review

Built and reviewed through the 3-lens board (correctness / SOLID /
architecture-adherence). Adopted finding: the reconciliation set was an array
(documented but not compile-enforced); converted to a
`Record<WorkItemState, …>` so exhaustiveness is checked by the compiler.

## Status

Implemented and tested (14 tests; full suite 360 green; tsc clean). Next: slice 2
(`decide_gate`) consumes the `GateOwner` column; slice 4 consumes
`RUN_PHASE_FOR_STATE`.
