/**
 * agent-roster.test.ts — a hat can run out of people, and that is the whole point.
 *
 * The behaviour these pin replaces one where `agentsFromChart` minted an agent per hat, so every
 * hat had exactly one willing wearer forever and no staffing decision could ever be refused. Each
 * test below is a way for the answer to be NO, because a pool that cannot be exhausted is not a
 * pool and the supply decision computed against it was ceremony.
 */

import { describe, expect, test } from "bun:test";
import {
  assignableAgents,
  hatSupply,
  hatsHeldBy,
  mayProvision,
  maxWearersOf,
  rosterFromChart,
  wearersOf,
  type AgentRoster,
} from "./agent-roster";
import { BindingPhase, type HatBinding } from "./hat-binding";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HAT = "backend_implementer";
const OTHER = "frontend_implementer";

const roster = (...agents: AgentRoster["agents"]): AgentRoster => ({ agents: [...agents] });

const binding = (over: Partial<HatBinding> & { hatId: string; wearerAgentId: string }): HatBinding => ({
  bindingId: `b-${over.hatId}-${over.wearerAgentId}`,
  phase: BindingPhase.Active,
  boundAtMs: 0,
  warmupEndsMs: 0,
  activatedAtMs: 0,
  expiresMs: 1_000_000,
  ...over,
});

describe("A HAT CAN RUN OUT OF PEOPLE", () => {
  test("an agent the roster never heard of is refused, not invented", () => {
    // The old behaviour: an agent existed because a hat existed. Nothing could be short-staffed.
    const verdict = mayProvision({
      roster: roster(), bindings: [], chart, agentId: "agent-nobody", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("not on the roster");
  });

  test("an agent on the roster but NOT provisioned for this hat is refused", () => {
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [OTHER] }),
      bindings: [], chart, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("not provisioned");
  });

  test("a hat AT CAPACITY refuses the next taker, and says the numbers", () => {
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT] }, { agentId: "bo", eligibleHatIds: [HAT] }),
      bindings: [binding({ hatId: HAT, wearerAgentId: "bo" })],
      chart, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("at capacity");
  });

  test("an agent already holding its limit is refused a SECOND hat", () => {
    // A person wears one hat at a time unless the roster says otherwise. Without this an agent
    // could be counted as available on every hat simultaneously, which is the infinite pool again
    // wearing a roster's clothes.
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT, OTHER] }),
      bindings: [binding({ hatId: OTHER, wearerAgentId: "ada" })],
      chart, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("limit");
  });

  test("an agent cleared for two hats at once MAY hold both", () => {
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT, OTHER], concurrentHats: 2 }),
      bindings: [binding({ hatId: OTHER, wearerAgentId: "ada" })],
      chart, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(true);
  });

  test("a COOLING agent is refused its own hat back until the cooldown passes", () => {
    const cooled = binding({ hatId: HAT, wearerAgentId: "ada", phase: BindingPhase.Released, cooldownUntilMs: 500 });
    const during = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT] }),
      bindings: [cooled], chart, agentId: "ada", hatId: HAT, nowMs: 100,
    });
    expect(during.ok).toBe(false);
    const after = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT] }),
      bindings: [cooled], chart, agentId: "ada", hatId: HAT, nowMs: 600,
    });
    expect(after.ok).toBe(true);
  });

  test("a provisioned, free agent on an empty hat IS allowed — the refusals are not blanket", () => {
    // Without this the suite would pass with a function that refuses everything, which is the
    // vacuity class inverted: a gate that cannot open.
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT] }),
      bindings: [], chart, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(true);
  });
});

describe("THE BENCH IS ENUMERABLE — you can ask WHO, not only whether", () => {
  test("assignableAgents lists exactly those who could take the hat now", () => {
    const r = roster(
      { agentId: "ada", eligibleHatIds: [HAT] },
      { agentId: "bo", eligibleHatIds: [HAT] },
      { agentId: "cy", eligibleHatIds: [OTHER] },
    );
    expect(assignableAgents({ roster: r, bindings: [], chart, hatId: HAT, nowMs: 0 })).toEqual(["ada", "bo"]);
  });

  test("an UNSTAFFABLE hat returns an empty bench, which is a real answer", () => {
    const r = roster({ agentId: "cy", eligibleHatIds: [OTHER] });
    expect(assignableAgents({ roster: r, bindings: [], chart, hatId: HAT, nowMs: 0 })).toEqual([]);
  });

  test("hatSupply separates who HOLDS it, who COULD, and who is blocked and why", () => {
    const r = roster(
      { agentId: "ada", eligibleHatIds: [HAT] },
      { agentId: "bo", eligibleHatIds: [HAT] },
    );
    const supply = hatSupply({
      roster: r, bindings: [binding({ hatId: HAT, wearerAgentId: "bo" })], chart, hatId: HAT, nowMs: 0,
    });
    expect(supply.maxWearers).toBe(1);
    expect(supply.wearers).toEqual(["bo"]);
    expect(supply.available).toEqual([]);
    // The blocked list is what makes a staffing refusal diagnosable instead of merely true.
    expect(supply.blocked.map((b) => b.agentId)).toEqual(["ada", "bo"]);
    expect(supply.blocked[0]?.reason).toContain("at capacity");
  });
});

describe("CAPACITY IS THE HAT'S OWN PROPERTY", () => {
  test("a hat with maxWearers 2 admits a second wearer", () => {
    const wide = { ...chart, byId: new Map(chart.byId) };
    const hat = chart.byId.get(HAT);
    expect(hat).toBeDefined();
    wide.byId.set(HAT, { ...hat!, maxWearers: 2 });
    expect(maxWearersOf(wide.byId.get(HAT)!)).toBe(2);
    const verdict = mayProvision({
      roster: roster({ agentId: "ada", eligibleHatIds: [HAT] }, { agentId: "bo", eligibleHatIds: [HAT] }),
      bindings: [binding({ hatId: HAT, wearerAgentId: "bo" })],
      chart: wide, agentId: "ada", hatId: HAT, nowMs: 0,
    });
    expect(verdict.ok).toBe(true);
  });

  test("absent maxWearers means ONE, matching what the binding rules already enforced", () => {
    expect(maxWearersOf(chart.byId.get(HAT)!)).toBe(1);
  });
});

describe("THE OLD BEHAVIOUR IS STILL AVAILABLE, BUT NAMED", () => {
  test("rosterFromChart gives one agent per IC hat, and says that is what it is", () => {
    const derived = rosterFromChart(chart);
    expect(derived.agents.length).toBeGreaterThan(0);
    for (const a of derived.agents) {
      expect(a.eligibleHatIds).toHaveLength(1);
      expect(a.label).toContain("no scarcity");
    }
    // Every hat staffable, always — which is exactly the condition that made supply ceremonial.
    const first = derived.agents[0]!;
    expect(assignableAgents({ roster: derived, bindings: [], chart, hatId: first.eligibleHatIds[0]!, nowMs: 0 }))
      .toEqual([first.agentId]);
  });
});

describe("counting helpers say what they count", () => {
  test("wearersOf excludes terminal bindings; hatsHeldBy is per agent", () => {
    const bindings = [
      binding({ hatId: HAT, wearerAgentId: "ada" }),
      binding({ hatId: HAT, wearerAgentId: "gone", phase: BindingPhase.Released }),
      binding({ hatId: OTHER, wearerAgentId: "ada" }),
    ];
    expect(wearersOf(bindings, HAT).map((b) => b.wearerAgentId)).toEqual(["ada"]);
    expect(hatsHeldBy(bindings, "ada").map((b) => b.hatId)).toEqual([HAT, OTHER]);
  });
});
