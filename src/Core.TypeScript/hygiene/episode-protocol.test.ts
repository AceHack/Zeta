import { describe, expect, test } from "bun:test";

import { IDLE, replay, step, type EpisodeEvent } from "./episode-protocol";

// The RFC review-round conditions AS golden vectors. Every seat's condition
// is a named test; the replay fold is the DST surface.

const brk = (over: Partial<Extract<EpisodeEvent, { kind: "break_detected" }>> = {}): EpisodeEvent => ({
  kind: "break_detected",
  tick: 10,
  openTicks: 2,
  candidateShas: ["abc123"],
  fleetHealInFlight: false,
  touchesVectorContracts: false,
  authorPersona: "riven",
  ...over,
});

describe("trigger discipline", () => {
  test("below 2 open ticks: the bot does not move (the fleet's own norm)", () => {
    const r = step("ep1", IDLE, brk({ openTicks: 1 }));
    expect(r.state).toEqual(IDLE);
    expect(r.command.kind).toBe("none");
  });

  test("fleet heal in flight — including the author's own fix-PR — stands the bot down (Riven-1)", () => {
    const r = step("ep1", IDLE, brk({ fleetHealInFlight: true }));
    expect(r.state).toEqual(IDLE);
    expect(r.command.kind).toBe("none");
  });

  test("clean trigger opens ONE armed revert PR with the re-land recipe verbatim (Riven-2)", () => {
    const r = step("ep1", IDLE, brk());
    expect(r.state.kind).toBe("attempted");
    expect(r.command).toMatchObject({
      kind: "open_revert_pr",
      breakSha: "abc123",
      armed: true,
    });
    if (r.command.kind === "open_revert_pr") {
      expect(r.command.notifyAuthor.persona).toBe("riven");
      expect(r.command.notifyAuthor.relandRecipe).toContain("git cherry-pick abc123");
    }
  });
});

describe("refusal over cleverness (RFC-4)", () => {
  test("non-unique isolation refuses to humans and files findings", () => {
    const r = step("ep1", IDLE, brk({ candidateShas: ["a", "b"] }));
    expect(r.state.kind).toBe("refused");
    expect(r.command.kind).toBe("file_findings_and_stop");
  });

  test("refusal is sticky until human_cleared — the machine never self-rehabilitates", () => {
    const { state, commands } = replay("ep1", [
      brk({ candidateShas: [] }),
      brk(), // perfectly clean break — still refused
      { kind: "sweep_healed", tick: 12 },
    ]);
    expect(state.kind).toBe("refused");
    expect(commands[1]!.kind).toBe("none");
    expect(commands[2]!.kind).toBe("none");
  });
});

describe("at-most-once under replay (Vera-3)", () => {
  test("a flapping detector cannot re-arm a second attempt in an episode", () => {
    const { state, commands } = replay("ep1", [brk(), brk(), brk({ candidateShas: ["zzz999"] })]);
    expect(state.kind).toBe("attempted");
    expect(commands.filter((c) => c.kind === "open_revert_pr")).toHaveLength(1);
  });

  test("replay determinism: same events ⇒ identical state and command trace", () => {
    const events: EpisodeEvent[] = [brk(), { kind: "gate_result", tick: 11, pass: true }, { kind: "merge_result", tick: 12, merged: true }];
    expect(replay("ep1", events)).toEqual(replay("ep1", events));
  });
});

describe("disarm on early heal (Vera-2)", () => {
  test("sweep_healed while attempted disarms and closes — no double-patch", () => {
    const { state, commands } = replay("ep1", [brk(), { kind: "sweep_healed", tick: 12 }]);
    expect(state.kind).toBe("closed_healed");
    expect(commands[1]!.kind).toBe("disarm_and_close_pr");
  });
});

describe("vector-touching reverts (Lior-2)", () => {
  test("open the PR with armed: false — the ack is a considered human act", () => {
    const r = step("ep1", IDLE, brk({ touchesVectorContracts: true }));
    expect(r.state.kind).toBe("attempted");
    expect(r.command).toMatchObject({ kind: "open_revert_pr", armed: false });
  });
});

describe("gate and merge outcomes", () => {
  test("gate failure refuses — closure violated per-instance, humans own the P1", () => {
    const { state, commands } = replay("ep1", [brk(), { kind: "gate_result", tick: 11, pass: false }]);
    expect(state.kind).toBe("refused");
    expect(commands[1]!.kind).toBe("file_findings_and_stop");
  });

  test("full happy path lands, then human_cleared resets to idle", () => {
    const { state } = replay("ep1", [
      brk(),
      { kind: "gate_result", tick: 11, pass: true },
      { kind: "merge_result", tick: 12, merged: true },
      { kind: "human_cleared", tick: 13 },
    ]);
    expect(state).toEqual(IDLE);
  });
});
