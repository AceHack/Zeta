import { expect, test } from "bun:test";
import { simulate, type BacklogItem, type World } from "./observe";

test("Time Travel (Z-Set Retraction)", () => {
  const itemA: BacklogItem = { id: "task_A", title: "Task A", ready: true, ambiguous: false };
  const itemB: BacklogItem = { id: "task_B", title: "Task B", ready: true, ambiguous: false };
  
  let world: World = {
    mode: "work",
    backlog: [itemA, itemB],
    history: [],
    cartography: { scopeLevel: 0, timeOffset: 0 }
  };

  // Pilot executes task A
  world = simulate(world, { 
    kind: "do_item", 
    item: itemA, 
    evaluation: { accuracy: 50, diffPixels: -1, totalPixels: 10 } 
  });

  // Task A should leave the backlog
  expect(world.backlog).toEqual([itemB]);
  expect(world.history?.length).toBe(1);
  expect(world.history![0]?.type).toBe("do_item");
  expect(world.history![0]?.item?.id).toBe("task_A");

  // Pilot executes task B with a terrible score (KPI drops to 0)
  world = simulate(world, { 
    kind: "do_item", 
    item: itemB, 
    evaluation: { accuracy: 0, diffPixels: -10, totalPixels: 10 } 
  });

  // Backlog should be empty
  expect(world.backlog).toEqual([]);
  expect(world.history?.length).toBe(2);

  // Chronologist detects the terrible score and triggers retract_time
  world = simulate(world, { kind: "retract_time", reason: "revert terrible task B" });

  // Task B is restored to the top of the backlog
  expect(world.backlog).toEqual([itemB]);
  
  // Z-Set Rule: The history ledger is appended to, not popped!
  expect(world.history?.length).toBe(3);
  expect(world.history![2]?.type).toBe("retract_time");
  expect(world.history![2]?.item?.id).toBe("task_B"); // It correctly identified B as the target to reverse

  // Chronologist decides to retract time AGAIN to undo task A as well
  world = simulate(world, { kind: "retract_time", reason: "revert task A" });

  // Task A and Task B are both back!
  expect(world.backlog).toEqual([itemA, itemB]);

  // History is safely preserved (Z-set of 2 do_items, 2 retract_times)
  expect(world.history?.length).toBe(4);
  expect(world.history![3]?.type).toBe("retract_time");
  expect(world.history![3]?.item?.id).toBe("task_A"); // B was already retracted, so it correctly targets A
});
