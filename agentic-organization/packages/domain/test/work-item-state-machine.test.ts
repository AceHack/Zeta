import { equal, throws } from "node:assert/strict";
import { describe, test } from "node:test";

import { WorkItemState, assertWorkItemTransition, createInitialWorkItemState } from "../src/work-item-state-machine.ts";

describe("work item state machine", () => {
  test("new work starts in the typed new state", () => {
    equal(createInitialWorkItemState(), WorkItemState.New);
  });

  test("allows only explicit typed lifecycle transitions", () => {
    assertDoesNotThrow(() => assertWorkItemTransition(WorkItemState.New, WorkItemState.Triage));

    throws(() => assertWorkItemTransition(WorkItemState.New, WorkItemState.Approved), /illegal work item transition/);
  });
});

function assertDoesNotThrow(action: () => void): void {
  action();
}
