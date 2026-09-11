/**
 * room-planning.test.ts — a room is a deterministic simulation; the plan that creates rooms has to
 * be one too.
 *
 * If the planner is not deterministic, every replay seats different hats in different rooms and the
 * simulations underneath stop being comparable — the property the whole room design exists for is
 * lost one level up, in the planner nobody was looking at. So the load-bearing test is the boring
 * one: the same supply plans identically, twice.
 */

import { describe, expect, test } from "bun:test";
import { planTaskRooms, roomFor, type RoomPlanInput } from "./room-planning";

function ids(index: number): string {
  return `room-${String(index)}`;
}

function plan(over: Partial<RoomPlanInput> = {}) {
  const r = planTaskRooms({
    workId: "task-1",
    requiredHatSupply: new Map([["backend_implementer", 3]]),
    maxHatsPerRoom: 2,
    nextRoomId: ids,
    ...over,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.plan;
}

describe("THE PACKING IS DETERMINISTIC", () => {
  test("the same supply plans identically, twice", () => {
    expect(plan()).toEqual(plan());
  });

  test("SEATS ARE ORDINAL BY HAT ID, not by map insertion order", () => {
    // Two machines given the same supply must seat it the same way. A Map preserves insertion
    // order, so a planner reading it straight would seat by whoever was added first — which is a
    // property of the caller's loop, not of the organization.
    const forward = plan({
      requiredHatSupply: new Map([
        ["a_hat", 1],
        ["z_hat", 1],
      ]),
      maxHatsPerRoom: 2,
    });
    const backward = plan({
      requiredHatSupply: new Map([
        ["z_hat", 1],
        ["a_hat", 1],
      ]),
      maxHatsPerRoom: 2,
    });
    expect(forward).toEqual(backward);
    expect(forward.rooms[0]?.seats.map((s) => s.hatId)).toEqual(["a_hat", "z_hat"]);
  });

  test("ROOM IDS COME FROM THE INJECTED SEQUENCE, never minted here", () => {
    // A planner generating its own ids would be the one part of a deterministic simulation that
    // could not be replayed.
    const p = plan({ nextRoomId: (i) => `rm:${String(i * 10)}` });
    expect(p.rooms.map((r) => r.roomId)).toEqual(["rm:0", "rm:10"]);
  });
});

describe("CAPACITY IS RESPECTED AND THE COUNT IS DERIVED", () => {
  test("roomCount is ceil(seats / capacity)", () => {
    expect(plan({ requiredHatSupply: new Map([["h", 4]]), maxHatsPerRoom: 2 }).rooms).toHaveLength(2);
    expect(plan({ requiredHatSupply: new Map([["h", 5]]), maxHatsPerRoom: 2 }).rooms).toHaveLength(3);
    expect(plan({ requiredHatSupply: new Map([["h", 1]]), maxHatsPerRoom: 4 }).rooms).toHaveLength(1);
  });

  test("NO ROOM EVER EXCEEDS THE CAPACITY", () => {
    const p = plan({ requiredHatSupply: new Map([["a", 3], ["b", 4]]), maxHatsPerRoom: 3 });
    for (const room of p.rooms) expect(room.seats.length).toBeLessThanOrEqual(3);
  });

  test("NOBODY IS DROPPED — every seat in the supply is seated somewhere", () => {
    const p = plan({ requiredHatSupply: new Map([["a", 3], ["b", 4]]), maxHatsPerRoom: 3 });
    expect(p.seatCount).toBe(7);
    expect(p.rooms.reduce((n, r) => n + r.seats.length, 0)).toBe(7);
  });

  test("A CAPACITY OF ONE IS LEGAL — one hat per room is the commonest plan of all", () => {
    // A solo task. Nothing here tested it, so a bound of `< 2` instead of `< 1` refused every
    // one-hat plan and survived the whole matrix — the boundary the refusal is actually about.
    const p = plan({ requiredHatSupply: new Map([["a", 2]]), maxHatsPerRoom: 1 });
    expect(p.rooms).toHaveLength(2);
    expect(p.rooms.every((r) => r.seats.length === 1)).toBe(true);
  });

  test("a hat's wearers are numbered from one, and distinctly", () => {
    const p = plan({ requiredHatSupply: new Map([["h", 3]]), maxHatsPerRoom: 3 });
    expect(p.rooms[0]?.seats.map((s) => s.seatIndex)).toEqual([1, 2, 3]);
  });
});

describe("WHAT IT REFUSES", () => {
  test("A CAPACITY OF ZERO IS REFUSED, not treated as unlimited", () => {
    // `ceil(n / 0)` is Infinity and a room with no seats packs nothing forever. A refusal beats a
    // plan that cannot be executed.
    expect(planTaskRooms({ workId: "t", requiredHatSupply: new Map([["h", 1]]), maxHatsPerRoom: 0, nextRoomId: ids }).ok).toBe(
      false,
    );
    expect(
      planTaskRooms({ workId: "t", requiredHatSupply: new Map([["h", 1]]), maxHatsPerRoom: -1, nextRoomId: ids }).ok,
    ).toBe(false);
  });

  test("a fractional capacity is not a capacity", () => {
    expect(
      planTaskRooms({ workId: "t", requiredHatSupply: new Map([["h", 1]]), maxHatsPerRoom: 1.5, nextRoomId: ids }).ok,
    ).toBe(false);
  });

  test("a negative or fractional SUPPLY is refused rather than rounded", () => {
    expect(planTaskRooms({ workId: "t", requiredHatSupply: new Map([["h", -1]]), maxHatsPerRoom: 2, nextRoomId: ids }).ok).toBe(
      false,
    );
    expect(planTaskRooms({ workId: "t", requiredHatSupply: new Map([["h", 2.5]]), maxHatsPerRoom: 2, nextRoomId: ids }).ok).toBe(
      false,
    );
  });

  test("A SUPPLY OF NOBODY PLANS NO ROOMS — not one empty room", () => {
    // An empty room is capacity allocated for nobody, and downstream it reads as capacity that
    // exists. This is the same refusal-to-manufacture the rest of the register makes.
    expect(plan({ requiredHatSupply: new Map() }).rooms).toEqual([]);
    expect(plan({ requiredHatSupply: new Map([["h", 0]]) }).rooms).toEqual([]);
    expect(plan({ requiredHatSupply: new Map() }).seatCount).toBe(0);
  });
});

describe("reading the plan back", () => {
  test("a seat can be looked up in the room it was packed into", () => {
    const p = plan({ requiredHatSupply: new Map([["a", 2], ["b", 2]]), maxHatsPerRoom: 2 });
    expect(roomFor(p, "a", 1)?.roomId).toBe("room-0");
    expect(roomFor(p, "b", 1)?.roomId).toBe("room-1");
  });

  test("a seat that is not in the plan is not invented", () => {
    const p = plan({ requiredHatSupply: new Map([["a", 1]]), maxHatsPerRoom: 2 });
    expect(roomFor(p, "a", 2)).toBeUndefined();
    expect(roomFor(p, "b", 1)).toBeUndefined();
  });

  test("the plan names the work it was made for", () => {
    expect(plan({ workId: "task-9" }).workId).toBe("task-9");
  });
});
