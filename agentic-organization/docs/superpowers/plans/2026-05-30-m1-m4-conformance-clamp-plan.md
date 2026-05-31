# M1/M4 Conformance And Clamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first orchestration-moat phase: a pure ledger conformance checker plus property coverage for the legal-transition clamps.

**Architecture:** Add `packages/application/src/conformance.ts` as a pure classifier over `OrgEvent` records. It validates replayable transition events against the existing domain state machines and reports skipped, conformant, and nonconformant records without throwing. Add focused unit tests first, then wire a worker lane and a KIND proof script that runs the checker against live Cockroach `org_events`.

**Tech Stack:** TypeScript, native `node --experimental-strip-types`, NodeNext ESM, `node:test`, existing domain DUs and Cockroach adapters.

---

## Task 1: Pure Conformance Checker

**Files:**

- Create: `packages/application/src/conformance.ts`
- Test: `packages/application/test/conformance.test.ts`
- Modify: `packages/application/src/index.ts`

- [ ] **Step 1: Write failing tests**
  - Test that legal work-item, memory, change-control, doc, and graph transitions are conformant.
  - Test that an illegal transition returns a nonconformity with event id, kind, subject id, from/to state, legal target states, and reason.
  - Test that non-transition events are skipped, not failed.

- [ ] **Step 2: Run targeted test and verify RED**
  - Run: `node --experimental-strip-types --test packages/application/test/conformance.test.ts`
  - Expected: module-not-found or missing export failure for `replayLedger`.

- [ ] **Step 3: Implement minimal checker**
  - Classify events by `OrgEventKind`.
  - Use existing pure clamps: `baseLegalNextStates`, `legalMemoryTransitions`, `legalChangeSetTransitions`, `legalDocTransitions`, `legalConfidencePromotions`.
  - Return data, never throw for malformed historical events.

- [ ] **Step 4: Run targeted test and verify GREEN**
  - Run: `node --experimental-strip-types --test packages/application/test/conformance.test.ts`
  - Expected: pass.

### Task 2: Clamp Property Tests

**Files:**

- Modify: `packages/domain/test/work-item.test.ts`
- Modify: `packages/domain/test/change-control.test.ts`
- Modify: `packages/domain/test/memory-state-machine.test.ts`
- Modify: `packages/domain/test/document-intelligence.test.ts`
- Modify: `packages/domain/test/knowledge-graph.test.ts`

- [ ] **Step 1: Write failing safety/property assertions**
  - Every enum value returns an array from its legal function.
  - Terminal states return no next states.
  - Gated work transitions are represented as legal-but-gated, not absent.
  - Unsatisfied review stages cannot approve.

- [ ] **Step 2: Run targeted domain tests**
  - Run: `node --experimental-strip-types --test packages/domain/test/*.test.ts`
  - Expected: pass after any missing invariant is implemented or the test is corrected to existing behavior.

### Task 3: Worker Lane And KIND Proof

**Files:**

- Modify: `apps/workers/src/org-cadence-lanes.ts`
- Modify: `apps/workers/test/org-cadence-lanes.test.ts`
- Create: `deploy/run-conformance.ts`

- [ ] **Step 1: Add failing lane/proof tests**
  - Worker lane reports conformance counts and fails open by surfacing degraded evidence instead of crashing the worker.
  - Proof script prints JSON with `PROOF: "PASS"` only when all checked transitions conform.

- [ ] **Step 2: Implement lane and proof script**
  - Read `org_events` via the existing Cockroach executor path.
  - Run `replayLedger`.
  - Emit a deterministic report suitable for NORTH_STAR.

### Task 4: Verification, Docs, Review, Commit

**Files:**

- Modify: `docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md`
- Optionally modify: `docs/ORCHESTRATION_MOAT_ROADMAP.md` if implementation reveals a deeper deterministic capability.

- [ ] **Step 1: Run verification**
  - `npm run typecheck`
  - `npm test`
  - Rebuild/load/restart KIND worker.
  - Run `deploy/run-conformance.ts` against in-cluster Cockroach with `PROOF: "PASS"`.

- [ ] **Step 2: Review and commit**
  - Run subagent review on the diff if the tool is available.
  - Apply high-confidence findings with tests.
  - Commit with `Co-Authored-By: Codex <noreply@openai.com>`.
