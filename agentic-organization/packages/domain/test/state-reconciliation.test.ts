import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkItemState, WorkItemType } from "../src/work-item-state-machine.ts";
import {
  GateOwner,
  RUN_PHASE_FOR_STATE,
  STATE_RECONCILIATION,
  TypeSpecificRuleKind,
  reconcileState,
  runPhaseForState,
  typeSpecificRulesFor,
} from "../src/state-reconciliation.ts";

const ALL_STATES: readonly WorkItemState[] = Object.values(WorkItemState);

describe("state reconciliation table", () => {
  test("has exactly 8 rows — one per WorkItemState, no dupes, no missing", () => {
    equal(STATE_RECONCILIATION.length, 8);
    equal(ALL_STATES.length, 8);

    const seen = new Set(STATE_RECONCILIATION.map((row) => row.workItemState));
    // no dupes
    equal(seen.size, STATE_RECONCILIATION.length);
    // no missing — every WorkItemState appears
    const missing = ALL_STATES.filter((state) => !seen.has(state));
    deepEqual(missing, []);
  });

  test("every row carries a valid GateOwner value", () => {
    const owners = new Set<string>(Object.values(GateOwner));
    const invalid = STATE_RECONCILIATION.filter((row) => !owners.has(row.gateOwner));
    deepEqual(invalid, []);
  });

  test("created maps to the Backlog UI column and done maps to the Done column", () => {
    equal(reconcileState(WorkItemState.Created)?.uiColumn, "Backlog");
    equal(reconcileState(WorkItemState.Done)?.uiColumn, "Done");
  });

  test("done is owned by the release manager gate", () => {
    equal(reconcileState(WorkItemState.Done)?.gateOwner, GateOwner.ReleaseManager);
  });

  test("reconcileState round-trips every state to a row with that state", () => {
    for (const state of ALL_STATES) {
      const row = reconcileState(state);
      ok(row);
      equal(row.workItemState, state);
    }
  });

  test("reconcileState returns the same object held in the table", () => {
    for (const row of STATE_RECONCILIATION) {
      equal(reconcileState(row.workItemState), row);
    }
  });
});

describe("observe.ts run-phase binding", () => {
  test("RUN_PHASE_FOR_STATE covers all 8 states", () => {
    const keys = Object.keys(RUN_PHASE_FOR_STATE);
    equal(keys.length, 8);
    const missing = ALL_STATES.filter((state) => !Object.hasOwn(RUN_PHASE_FOR_STATE, state));
    deepEqual(missing, []);
  });

  test("runPhaseForState(Done) maps to the terminal observe phase 'completed'", () => {
    equal(runPhaseForState(WorkItemState.Done), "completed");
  });

  test("runPhaseForState matches RUN_PHASE_FOR_STATE for every state", () => {
    for (const state of ALL_STATES) {
      equal(runPhaseForState(state), RUN_PHASE_FOR_STATE[state]);
    }
  });

  test("blocked maps to the observe 'blocked' phase and review to 'awaiting_review'", () => {
    equal(runPhaseForState(WorkItemState.Blocked), "blocked");
    equal(runPhaseForState(WorkItemState.Review), "awaiting_review");
  });
});

describe("type-specific lifecycle rules", () => {
  test("Defect rules include the triage-evidence and assigned-engineer rules", () => {
    const rules = typeSpecificRulesFor(WorkItemType.Defect);

    const triageEvidence = rules.find(
      (rule) => rule.fromState === WorkItemState.Triage && rule.toState === WorkItemState.Ready,
    );
    ok(triageEvidence);
    ok(/evidence/i.test(triageEvidence.requirement));

    const assignedEngineer = rules.find(
      (rule) => rule.fromState === WorkItemState.Ready && rule.toState === WorkItemState.InProgress,
    );
    ok(assignedEngineer);
    ok(/assigned engineer/i.test(assignedEngineer.requirement));
    ok(/scheduled/i.test(assignedEngineer.requirement));
  });

  test("Defect rules include the cannot-skip-intake rule", () => {
    const rules = typeSpecificRulesFor(WorkItemType.Defect);
    const noSkip = rules.find(
      (rule) => rule.fromState === WorkItemState.Created && rule.toState === WorkItemState.Intake,
    );
    ok(noSkip);
    ok(/intake/i.test(noSkip.requirement));
  });

  test("Task rules are a (possibly empty) subset of Defect rules", () => {
    const defectRequirements = new Set(
      typeSpecificRulesFor(WorkItemType.Defect).map((rule) => rule.requirement),
    );
    const taskRules = typeSpecificRulesFor(WorkItemType.Task);
    const notSubset = taskRules.filter((rule) => !defectRequirements.has(rule.requirement));
    deepEqual(notSubset, []);
    // Tasks carry no type-specific overlay in V0.
    deepEqual(taskRules, []);
  });

  test("TypeSpecificRuleKind enumerates the three defect rule classes", () => {
    deepEqual(Object.values(TypeSpecificRuleKind).sort(), [
      "no_skip_intake",
      "requires_assigned_engineer_and_schedule",
      "requires_triage_evidence",
    ]);
  });
});
