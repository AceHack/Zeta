/**
 * room-runtime.test.ts — a room is judged by its own tests, and an untested room does not pass.
 *
 * The load-bearing case is the empty check list. "Nothing failed" and "nothing was checked" look
 * identical from outside, and every defect this system has hunted is an instance of that confusion.
 */

import { describe, expect, test } from "bun:test";
import {
  isReplayable,
  renderVerdict,
  runAcceptance,
  seatRoom,
  SeamFidelity,
  type AcceptanceCheck,
  type OccupiedRoom,
  type RoomSeam,
} from "./room-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import type { AgentRoster } from "./agent-roster";
import type { PlannedRoom } from "./room-planning";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HAT = "backend_implementer";
const roster: AgentRoster = { agents: [{ agentId: "ada", eligibleHatIds: [HAT] }] };
const planned: PlannedRoom = { roomId: "room-1", seats: [{ hatId: HAT, seatIndex: 1 }] };
const mockSeams: readonly RoomSeam[] = [
  { name: "git", fidelity: SeamFidelity.Mock, describes: "in-memory repository" },
  { name: "clock", fidelity: SeamFidelity.Mock, describes: "fixed at 0" },
];

const seat = (over: Partial<Parameters<typeof seatRoom>[0]> = {}) =>
  seatRoom({
    planned, workId: "task-1", roster, bindings: [], chart,
    seams: mockSeams, nowMs: 0, agentForHat: () => "ada", ...over,
  });

const room = (): OccupiedRoom => {
  const r = seat();
  if (!r.ok) throw new Error(r.reason);
  return r.room;
};

const check = (name: string, passed: boolean): AcceptanceCheck => ({
  name, asserts: `that ${name} holds`,
  run: async () => ({ passed, detail: passed ? "held" : "did not hold" }),
});

describe("A ROOM WITH NO ACCEPTANCE CRITERIA CANNOT PASS", () => {
  test("an empty check list is REFUSED, and says why that is not the same as passing", async () => {
    const verdict = await runAcceptance(room(), []);
    expect(verdict.accepted).toBe(false);
    expect(verdict.refusal).toContain("not the same as nothing failing");
    expect(verdict.outcomes).toEqual([]);
  });

  test("a room that runs its checks and passes them IS accepted — the refusal is not blanket", async () => {
    const verdict = await runAcceptance(room(), [check("blob write", true), check("idempotent", true)]);
    expect(verdict.accepted).toBe(true);
    expect(verdict.outcomes).toHaveLength(2);
    expect(verdict.refusal).toBeUndefined();
  });

  test("EVERY check must pass — one failure rejects the room", async () => {
    const verdict = await runAcceptance(room(), [check("a", true), check("b", false), check("c", true)]);
    expect(verdict.accepted).toBe(false);
    expect(verdict.outcomes.filter((o) => !o.passed).map((o) => o.name)).toEqual(["b"]);
  });

  test("a check that THROWS is a FAILED check, not an absent one", async () => {
    // Swallowing the exception into "no result" erases the check exactly as an empty list does.
    const boom: AcceptanceCheck = {
      name: "explodes", asserts: "nothing",
      run: async () => { throw new Error("the fixture is missing"); },
    };
    const verdict = await runAcceptance(room(), [boom]);
    expect(verdict.accepted).toBe(false);
    expect(verdict.outcomes[0]?.passed).toBe(false);
    expect(verdict.outcomes[0]?.detail).toContain("the fixture is missing");
  });
});

describe("A ROOM IS SEATED BY AGENTS THAT MAY ACTUALLY WEAR ITS HATS", () => {
  test("it seats a provisioned agent", () => {
    const r = seat();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.room.occupants).toEqual([{ hatId: HAT, agentId: "ada" }]);
  });

  test("an agent that may NOT wear the hat is refused, naming the reason", () => {
    // Otherwise the room produces work attributed to authority nobody holds.
    const r = seat({ roster: { agents: [{ agentId: "bo", eligibleHatIds: [] }] }, agentForHat: () => "bo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not provisioned");
  });

  test("a seat with nobody offered is refused, not left empty", () => {
    const r = seat({ agentForHat: () => undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no agent offered");
  });

  test("a room with no seats is refused", () => {
    const r = seat({ planned: { roomId: "empty", seats: [] } });
    expect(r.ok).toBe(false);
  });
});

describe("REPLAYABILITY IS DERIVED FROM THE SEAMS, NEVER CLAIMED", () => {
  test("all seams mocked means replayable", () => {
    expect(isReplayable(mockSeams)).toBe(true);
    expect(room().replayable).toBe(true);
  });

  test("ONE real seam and the room is not replayable", () => {
    const mixed = [...mockSeams, { name: "http", fidelity: SeamFidelity.Real, describes: "live API" }];
    expect(isReplayable(mixed)).toBe(false);
    const r = seat({ seams: mixed });
    expect(r.ok && r.room.replayable).toBe(false);
  });

  test("NO seams is not replayable either — nobody looked for the boundaries", () => {
    // "We found no IO" and "there is none" are different claims, and only one of them was made.
    expect(isReplayable([])).toBe(false);
  });
});

describe("the verdict says what was checked, not only whether it passed", () => {
  test("an accepted room reports the count and its fidelity", async () => {
    const line = renderVerdict(await runAcceptance(room(), [check("a", true)]));
    expect(line).toContain("ACCEPTED");
    expect(line).toContain("1/1");
    expect(line).toContain("replayable");
  });

  test("a refused room shows the refusal rather than a score", async () => {
    expect(renderVerdict(await runAcceptance(room(), []))).toContain("REFUSED");
  });

  test("a rejected room names the checks that failed", async () => {
    const line = renderVerdict(await runAcceptance(room(), [check("blob write", false)]));
    expect(line).toContain("REJECTED");
    expect(line).toContain("blob write");
  });
});
