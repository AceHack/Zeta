import { equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import {
  WorkBatchState,
  assertWorkBatchTransition,
  isTerminalWorkBatch,
  legalNextBatchStates,
} from "../src/index.ts";

test("the batch lifecycle advances created → … → active → completion_check → done", () => {
  const path: WorkBatchState[] = [
    WorkBatchState.Created, WorkBatchState.Scoped, WorkBatchState.CapacityPlanned,
    WorkBatchState.Scheduled, WorkBatchState.Active, WorkBatchState.CompletionCheck, WorkBatchState.Done,
  ];
  for (let i = 0; i < path.length - 1; i += 1) {
    assertWorkBatchTransition(path[i]!, path[i + 1]!); // must not throw
  }
});

test("active ⇄ partially_blocked is legal (work keeps moving while some is blocked)", () => {
  assertWorkBatchTransition(WorkBatchState.Active, WorkBatchState.PartiallyBlocked);
  assertWorkBatchTransition(WorkBatchState.PartiallyBlocked, WorkBatchState.Active);
});

test("illegal transitions throw", () => {
  throws(() => assertWorkBatchTransition(WorkBatchState.Created, WorkBatchState.Done));
  throws(() => assertWorkBatchTransition(WorkBatchState.Done, WorkBatchState.Active));
});

test("done is terminal", () => {
  ok(isTerminalWorkBatch(WorkBatchState.Done));
  equal(legalNextBatchStates(WorkBatchState.Done).length, 0);
});
