import { equal, throws } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WorkItemState,
  WorkItemType,
  assertInitialWorkItemState,
  assertWorkItemTransition,
  createInitialWorkItemState,
} from "../src/work-item-state-machine.ts";

describe("work item state machine", () => {
  test("new work starts in the typed created state", () => {
    equal(createInitialWorkItemState(), WorkItemState.Created);
  });

  test("allows only explicit typed lifecycle transitions", () => {
    assertDoesNotThrow(() => assertWorkItemTransition(WorkItemState.Created, WorkItemState.Intake));
    assertDoesNotThrow(() => assertWorkItemTransition(WorkItemState.Intake, WorkItemState.Triage));
    assertDoesNotThrow(() => assertWorkItemTransition(WorkItemState.Triage, WorkItemState.Ready, {
      hasRequiredEvidence: true,
      hasTriageFields: true,
    }));
    assertDoesNotThrow(() => assertWorkItemTransition(WorkItemState.Ready, WorkItemState.InProgress, {
      assignedEngineerHatAssignmentId: "hat-assignment-engineer-001",
      scheduledWorkBlockId: "schedule-block-001",
    }));

    throws(
      () => assertWorkItemTransition(WorkItemState.Created, WorkItemState.Ready),
      /illegal work item transition/,
    );
  });

  test("defects cannot start outside the created state", () => {
    assertDoesNotThrow(() => assertInitialWorkItemState(WorkItemType.Defect, WorkItemState.Created));

    throws(
      () => assertInitialWorkItemState(WorkItemType.Defect, WorkItemState.Ready),
      /defect work items must start in created/,
    );
  });

  test("defects cannot enter ready until triage fields and required evidence exist", () => {
    throws(
      () => assertWorkItemTransition(WorkItemState.Triage, WorkItemState.Ready, {
        workItemType: WorkItemType.Defect,
        hasRequiredEvidence: true,
        hasTriageFields: false,
      }),
      /defect ready transition requires triage fields/,
    );

    throws(
      () => assertWorkItemTransition(WorkItemState.Triage, WorkItemState.Ready, {
        workItemType: WorkItemType.Defect,
        hasRequiredEvidence: false,
        hasTriageFields: true,
      }),
      /defect ready transition requires evidence/,
    );
  });

  test("defects cannot enter in progress until an engineer is assigned and scheduled", () => {
    throws(
      () => assertWorkItemTransition(WorkItemState.Ready, WorkItemState.InProgress, {
        workItemType: WorkItemType.Defect,
        assignedEngineerHatAssignmentId: "",
        scheduledWorkBlockId: "schedule-block-001",
      }),
      /defect in_progress transition requires assigned engineer/,
    );

    throws(
      () => assertWorkItemTransition(WorkItemState.Ready, WorkItemState.InProgress, {
        workItemType: WorkItemType.Defect,
        assignedEngineerHatAssignmentId: "hat-assignment-engineer-001",
        scheduledWorkBlockId: " ",
      }),
      /defect in_progress transition requires scheduled work block/,
    );
  });
});

function assertDoesNotThrow(action: () => void): void {
  action();
}
