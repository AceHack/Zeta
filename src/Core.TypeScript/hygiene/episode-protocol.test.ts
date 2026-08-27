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
  // Defaulted TRUE so every pre-existing case below still exercises the guard
  // it was written for. The attribution gate has its own cases in
  // "attribution discipline"; leaving it false here would make the older
  // tests pass for the new reason instead of the one they name — a falsifier
  // satisfied by an EARLIER guard, which is the exact defect this suite exists
  // to catch.
  attributable: true,
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

// ── ATTRIBUTION DISCIPLINE (added 2026-08-26) ────────────────────────────────
//
// Every guard above is about UNIQUENESS or AT-MOST-ONCE. None was about
// attribution. Uniqueness is a property of the commit GRAPH; attribution is a
// property of the FAILURE — and an infrastructure outage produces a perfectly
// unique isolation with a completely wrong answer.
//
// MEASURED, not hypothetical: during the 2026-08-26 `www.gnupg.org:443`
// outage, `git log d4e39a78..c3addd47` was exactly one commit, and that commit
// was #15683 — a GraphQL-transport hygiene lint, causally unrelated to a TLS
// fetch failure. Every guard in the machine was satisfied.

describe("attribution discipline", () => {
  test("REFUSES a unique, otherwise-clean candidate when the red is not attributable to it", () => {
    // The gnupg.org case in miniature: unique isolation, no fleet heal, two
    // open ticks, no vector contracts touched — every pre-existing guard SAYS
    // GO. Only attribution stops it.
    const r = step("ep1", IDLE, brk({ attributable: false }));
    expect(r.state.kind).toBe("refused");
    expect(r.command.kind).toBe("file_findings_and_stop");
    expect("reason" in r.command ? r.command.reason : "").toContain("not attributable");
  });

  test("the refusal is what STOPS the retraction, not merely what labels it", () => {
    // The load-bearing assertion. A refusal that still emitted push_retraction
    // would be a letter of apology attached to the revert.
    const r = step("ep1", IDLE, brk({ attributable: false }));
    expect(r.command.kind).not.toBe("push_retraction");
  });

  test("CONTROL: the identical event with attributable=true does retract", () => {
    // Without this control the case above proves nothing — a machine that
    // refused everything would pass it. This pins that attribution is the ONLY
    // difference between the two outcomes.
    const r = step("ep1", IDLE, brk({ attributable: true }));
    expect(r.command.kind).toBe("push_retraction");
  });

  test("the attribution refusal is STICKY — a later attributable tick does not revive it", () => {
    // Refusals here are cleared by a human, never by the next tick looking
    // more convincing. Otherwise a flapping deriver re-arms the actuator.
    const first = step("ep1", IDLE, brk({ attributable: false }));
    const second = step("ep1", first.state, brk({ attributable: true }));
    expect(second.state.kind).toBe("refused");
    expect(second.command.kind).not.toBe("push_retraction");
  });

  test("attribution is checked on the REPLAY fold too, not only the live step", () => {
    const { state, commands } = replay("ep1", [brk({ attributable: false })]);
    expect(state.kind).toBe("refused");
    expect(commands.some((c) => c.kind === "push_retraction")).toBe(false);
  });
});
