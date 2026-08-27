// loop-registry.test.ts — the falsifiers.
//
// Two properties carry this module, and both are easy to assert vacuously.
//
//   1. EXIT IS THE AGENT'S ALONE. A test that only checks "the agent can leave" passes on an
//      implementation where anyone can evict anyone. The falsifier has to be the REFUSAL of a
//      third-party deregistration, not the acceptance of a self-deregistration.
//   2. BOUNDED MEANS IT STOPS BY ITSELF. A test that enrols and immediately asks "is it active"
//      never exercises exhaustion at all, and would pass on an unbounded implementation. The
//      falsifier is a tick number PAST the budget with nothing else happening.
//
// The third property is the one the module exists for: a deregistered agent and an exhausted agent
// are BOTH silent, and the registry must say which is which.

import { describe, expect, test } from "bun:test";
import {
  activeAgents,
  foldLoopRegistry,
  refusalReason,
  shouldTick,
  type LoopEvent,
} from "./loop-registry.ts";

const enrol = (loop: string, agent: string, tick: number, ticks: number): LoopEvent => ({
  kind: "enrol",
  loop,
  subject: agent,
  actor: agent,
  tick,
  ticks,
});

describe("exit belongs to the agent alone", () => {
  test("an agent may deregister ITSELF", () => {
    const events: LoopEvent[] = [
      enrol("agent-heartbeat", "otto", 0, 100),
      { kind: "deregister", loop: "agent-heartbeat", subject: "otto", actor: "otto", tick: 5, reason: "focusing on the cluster build" },
    ];
    const state = foldLoopRegistry(events, 6);
    expect(state.enrolments[0]?.status).toBe("deregistered");
    expect(state.enrolments[0]?.endedReason).toBe("focusing on the cluster build");
    expect(shouldTick(state, "agent-heartbeat", "otto")).toBe(false);
  });

  test("NOBODY ELSE MAY — a peer deregistering another agent is REFUSED", () => {
    // This is the invariant. Same shape as the privacy budget: spend / stake / never confiscate.
    // An implementation that simply honoured every `deregister` would pass the test above and fail
    // this one, which is why the refusal is the real falsifier.
    const events: LoopEvent[] = [
      enrol("agent-heartbeat", "otto", 0, 100),
      { kind: "deregister", loop: "agent-heartbeat", subject: "otto", actor: "riven", tick: 5, reason: "otto seems busy" },
    ];
    const state = foldLoopRegistry(events, 6);
    expect(state.enrolments[0]?.status).toBe("active");
    expect(shouldTick(state, "agent-heartbeat", "otto")).toBe(true);
    expect(state.refused[0]?.why).toMatch(/may not deregister .* exit belongs to the agent alone/);
  });

  test("a human maintainer is not an exception — the check is actor != subject, full stop", () => {
    // Deliberate. A maintainer override would be the whole invariant with a door in it, and the
    // door is what gets used. A maintainer who wants a loop stopped stops the DRIVER, which is a
    // different and visible act.
    expect(
      refusalReason({ kind: "deregister", loop: "l", subject: "otto", actor: "AceHack", tick: 1, reason: "cost" }),
    ).toMatch(/exit belongs to the agent alone/);
  });

  test("an anonymous exit is refused — a reasonless departure looks exactly like a fault", () => {
    // Under `exactOptionalPropertyTypes`, an ABSENT key and an explicit `undefined` are different
    // things and only the former is legal here. That is the honest encoding anyway: a deregister
    // event with no reason field is what an agent that omitted it actually produces.
    const base = { kind: "deregister", loop: "l", subject: "otto", actor: "otto", tick: 1 } as const;
    expect(refusalReason(base)).toMatch(/requires a reason/);
    for (const reason of ["", "   "]) {
      expect(refusalReason({ ...base, reason })).toMatch(/requires a reason/);
    }
  });
});

describe("bounded means it stops by itself, with no intelligence involved", () => {
  test("an enrolment past its budget is `exhausted` with NOTHING else in the log", () => {
    // The safety property. No deregistration, no scheduler action, no agent noticing — the budget
    // simply ends. An unbounded implementation would report `active` here.
    const state = foldLoopRegistry([enrol("drift-sweep", "otto", 0, 10)], 10);
    expect(state.enrolments[0]?.status).toBe("exhausted");
    expect(shouldTick(state, "drift-sweep", "otto")).toBe(false);
  });

  test("still active one tick BEFORE the budget ends — the boundary is not off by one", () => {
    const state = foldLoopRegistry([enrol("drift-sweep", "otto", 0, 10)], 9);
    expect(state.enrolments[0]?.status).toBe("active");
  });

  test("an unbounded enrolment cannot be expressed — the budget is required", () => {
    // The type permits omitting `ticks`; the guard is what makes bounded non-optional.
    expect(refusalReason({ kind: "enrol", loop: "l", subject: "otto", actor: "otto", tick: 0 })).toMatch(
      /requires an explicit tick budget — loops are bounded/,
    );
    expect(
      refusalReason({ kind: "enrol", loop: "l", subject: "otto", actor: "otto", tick: 0, ticks: 0 }),
    ).toMatch(/not a positive integer/);
  });

  test("renewal extends, and does NOT backdate into ticks that already passed", () => {
    // Renewing a lapsed enrolment from its old expiry would silently grant a budget that was
    // already spent — the loop would appear to run for ticks nobody actually served.
    const events: LoopEvent[] = [enrol("l", "otto", 0, 10), { kind: "renew", loop: "l", subject: "otto", actor: "otto", tick: 50, ticks: 10 }];
    const state = foldLoopRegistry(events, 55);
    expect(state.enrolments[0]?.expiresAtTick).toBe(60);
    expect(state.enrolments[0]?.status).toBe("active");
  });
});

describe("chosen silence is distinguishable from broken silence", () => {
  test("both agents are silent; the registry says WHY for each", () => {
    // The reason this module exists. Without it these two are the same observation — absence — and
    // an absent agent that chose to leave gets investigated as an outage, while an absent agent
    // that is genuinely wedged gets excused as a choice. Both errors are expensive.
    const events: LoopEvent[] = [
      enrol("agent-heartbeat", "otto", 0, 5),
      enrol("agent-heartbeat", "riven", 0, 100),
      { kind: "deregister", loop: "agent-heartbeat", subject: "riven", actor: "riven", tick: 3, reason: "handing this lane to lumen" },
    ];
    const state = foldLoopRegistry(events, 10);
    const byAgent = Object.fromEntries(state.enrolments.map((e) => [e.agent, e]));

    expect(byAgent["otto"]?.status).toBe("exhausted");
    expect(byAgent["otto"]?.endedReason).toMatch(/tick budget ended at 5; not renewed/);
    expect(byAgent["riven"]?.status).toBe("deregistered");
    expect(byAgent["riven"]?.endedReason).toBe("handing this lane to lumen");

    // Neither ticks — but the fleet can tell an outage from a decision.
    expect(activeAgents(state, "agent-heartbeat")).toEqual([]);
  });

  test("an exhausted enrolment names its reason rather than leaving the quiet mysterious", () => {
    const state = foldLoopRegistry([enrol("l", "otto", 0, 3)], 99);
    expect(state.enrolments[0]?.endedReason).not.toBeNull();
  });
});

describe("re-enrolment is the agent's move, never a peer's", () => {
  test("an agent may return after leaving", () => {
    const events: LoopEvent[] = [
      enrol("l", "otto", 0, 10),
      { kind: "deregister", loop: "l", subject: "otto", actor: "otto", tick: 2, reason: "busy" },
      enrol("l", "otto", 20, 10),
    ];
    const state = foldLoopRegistry(events, 21);
    expect(state.enrolments[0]?.status).toBe("active");
  });

  test("a peer may NOT re-enrol an agent that left — that is conscription by paperwork", () => {
    const events: LoopEvent[] = [
      enrol("l", "otto", 0, 10),
      { kind: "deregister", loop: "l", subject: "otto", actor: "otto", tick: 2, reason: "busy" },
      { kind: "enrol", loop: "l", subject: "otto", actor: "riven", tick: 20, ticks: 10 },
    ];
    const state = foldLoopRegistry(events, 21);
    expect(state.enrolments[0]?.status).toBe("deregistered");
    expect(state.refused[0]?.why).toMatch(/may not re-enrol/);
  });

  test("`renew` cannot resurrect a departed agent either — the same door, differently named", () => {
    const events: LoopEvent[] = [
      enrol("l", "otto", 0, 10),
      { kind: "deregister", loop: "l", subject: "otto", actor: "otto", tick: 2, reason: "busy" },
      { kind: "renew", loop: "l", subject: "otto", actor: "otto", tick: 3, ticks: 10 },
    ];
    const state = foldLoopRegistry(events, 4);
    expect(state.enrolments[0]?.status).toBe("deregistered");
    expect(state.refused[0]?.why).toMatch(/only otto may re-enrol/);
  });
});

describe("the fold refuses rather than throws, and is replayable", () => {
  test("a malformed event is recorded as a refusal and the fold CONTINUES", () => {
    // A throw here would let one bad row stop the whole fleet's dispatch — the refusal has to be
    // data so the driver still ticks everyone else.
    const events: LoopEvent[] = [
      { kind: "enrol", loop: "", subject: "otto", actor: "otto", tick: 0, ticks: 5 },
      enrol("l", "riven", 0, 5),
    ];
    const state = foldLoopRegistry(events, 1);
    expect(state.refused).toHaveLength(1);
    expect(activeAgents(state, "l")).toEqual(["riven"]);
  });

  test("no wall clock — the same events at the same `now` fold identically", () => {
    // §13 noninterference. A `Date.now()` anywhere in the fold would make two nodes disagree about
    // who is enrolled, which is the divergence `local-time-never-enters-the-shared-fold` forbids.
    const events: LoopEvent[] = [enrol("l", "otto", 0, 10), enrol("l", "riven", 0, 3)];
    expect(JSON.stringify(foldLoopRegistry(events, 5))).toBe(JSON.stringify(foldLoopRegistry(events, 5)));
  });

  test("ordering is ordinal, not locale-dependent", () => {
    const events: LoopEvent[] = [enrol("l", "Zed", 0, 9), enrol("l", "alice", 0, 9), enrol("l", "Bob", 0, 9)];
    // Ordinal: uppercase sorts before lowercase. A locale collator would interleave them.
    expect(activeAgents(foldLoopRegistry(events, 1), "l")).toEqual(["Bob", "Zed", "alice"]);
  });
});
