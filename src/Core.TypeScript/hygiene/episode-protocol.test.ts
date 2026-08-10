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

  test("clean trigger pushes ONE retraction with the re-land recipe verbatim (Riven-2)", () => {
    const r = step("ep1", IDLE, brk());
    expect(r.state.kind).toBe("attempted");
    expect(r.command).toMatchObject({ kind: "push_retraction", breakSha: "abc123" });
    if (r.command.kind === "push_retraction") {
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
  test("a flapping detector cannot re-trigger a second retraction in an episode", () => {
    const { state, commands } = replay("ep1", [brk(), brk(), brk({ candidateShas: ["zzz999"] })]);
    expect(state.kind).toBe("attempted");
    expect(commands.filter((c) => c.kind === "push_retraction")).toHaveLength(1);
  });

  test("replay determinism: same events ⇒ identical state and command trace", () => {
    const events: EpisodeEvent[] = [brk(), { kind: "push_result", tick: 11, pushed: true }, { kind: "post_push_gate", tick: 12, pass: true }];
    expect(replay("ep1", events)).toEqual(replay("ep1", events));
  });
});

describe("stand down on early heal (Vera-2, sovereign form)", () => {
  test("sweep_healed while attempted stands down — no double-patch", () => {
    const { state, commands } = replay("ep1", [brk(), { kind: "sweep_healed", tick: 12 }]);
    expect(state.kind).toBe("closed_healed");
    expect(commands[1]!.kind).toBe("none");
  });
});

describe("vector-touching retractions (Lior, sovereign form)", () => {
  test("refuse to human hands — a bot cannot self-grant the vector ack", () => {
    const r = step("ep1", IDLE, brk({ touchesVectorContracts: true }));
    expect(r.state.kind).toBe("refused");
    expect(r.command.kind).toBe("file_findings_and_stop");
  });
});

describe("push and post-push outcomes (sovereign closure)", () => {
  test("push failure refuses — never retry", () => {
    const { state, commands } = replay("ep1", [brk(), { kind: "push_result", tick: 11, pushed: false }]);
    expect(state.kind).toBe("refused");
    expect(commands[1]!.kind).toBe("file_findings_and_stop");
  });

  test("the retraction that breaks the build refuses itself — no oscillation", () => {
    const { state, commands } = replay("ep1", [
      brk(),
      { kind: "push_result", tick: 11, pushed: true },
      { kind: "post_push_gate", tick: 12, pass: false },
    ]);
    expect(state.kind).toBe("refused");
    expect(commands[2]!.kind).toBe("file_findings_and_stop");
  });

  test("full happy path lands, then human_cleared resets to idle", () => {
    const { state } = replay("ep1", [
      brk(),
      { kind: "push_result", tick: 11, pushed: true },
      { kind: "post_push_gate", tick: 12, pass: true },
      { kind: "human_cleared", tick: 13 },
    ]);
    expect(state).toEqual(IDLE);
  });
});
