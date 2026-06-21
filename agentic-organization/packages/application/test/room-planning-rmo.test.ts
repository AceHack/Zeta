import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { computeRequiredHatSupply, planTaskRooms, type WorkloadItem } from "../src/rmo.ts";
import { PriorityClass } from "../src/prioritization.ts";
import { createDeterministicRoom } from "../src/room.ts";

test("planTaskRooms packs required hat seats into capacity-bounded rooms", () => {
  const supply = new Map<string, number>([
    ["backend_implementer", 3],
    ["reviewer", 2],
  ]);
  const plan = planTaskRooms(
    { workItemId: "WI-1", requiredHatSupply: supply, maxHatsPerRoom: 2 },
    { createRoomId: (seq) => `room-${String(seq).padStart(3, "0")}` },
  );
  equal(plan.totalHatSeats, 5);
  equal(plan.hatsPerRoomCap, 2);
  equal(plan.roomCount, 3); // ceil(5 / 2)
  // deterministic seating: sorted hatId order, packed by capacity
  deepEqual(
    plan.rooms.map((r) => r.hatIds),
    [
      ["backend_implementer", "backend_implementer"],
      ["backend_implementer", "reviewer"],
      ["reviewer"],
    ],
  );
});

test("planTaskRooms is driven by RMO supply demand and is replayable (DST)", () => {
  const workload: readonly WorkloadItem[] = [
    {
      workItemId: "WI-2",
      priorityClass: PriorityClass.High,
      requiredHats: ["backend_implementer", "reviewer"],
    },
  ];
  const supply = computeRequiredHatSupply(workload);
  const ctx = { createRoomId: (s: number) => `room-${s}` };
  const a = planTaskRooms({ workItemId: "WI-2", requiredHatSupply: supply, maxHatsPerRoom: 4 }, ctx);
  const b = planTaskRooms({ workItemId: "WI-2", requiredHatSupply: supply, maxHatsPerRoom: 4 }, ctx);
  deepEqual(a, b); // same inputs -> same plan
});

test("createDeterministicRoom yields a frozen clock and sequential ids", () => {
  const room = createDeterministicRoom({
    roomId: "zid-abc",
    hatIds: ["backend_implementer"],
    baseTimeMs: 0,
    stepMs: 1000,
  });
  equal(room.seamMode, "mock");
  equal(room.communicationStrategy, "english");
  equal(room.clock.now(), "1970-01-01T00:00:00.000Z");
  equal(room.clock.now(), "1970-01-01T00:00:01.000Z");
  equal(room.ids.createId("evt"), "evt-001");
  equal(room.ids.createId("evt"), "evt-002");
});

test("a room sandboxes the agent and binds a credential proxy to its OAuth identity", () => {
  const room = createDeterministicRoom({
    roomId: "zid-agent-1",
    hatIds: ["reviewer", "backend_implementer"],
    identity: { agentId: "agent-1", subject: "oauth|sub-1" },
  });
  // sandbox is on by default (none-engine in sim; bwrap in production)
  equal(room.sandbox.engine, "none");
  equal(room.sandbox.revokeOnExpiry, true);
  equal(room.identity?.subject, "oauth|sub-1");
  // observe.ts invokes the credential proxy to resolve allowed tools for the
  // identity + its hats — deterministic, sorted, one scoped grant per hat.
  const grants = room.credentialProxy.grantsFor(room.identity!, room.hatIds);
  deepEqual(grants, [
    { tool: "tool:backend_implementer", credentialScope: "scope:backend_implementer" },
    { tool: "tool:reviewer", credentialScope: "scope:reviewer" },
  ]);
});
