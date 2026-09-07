import { describe, expect, test } from "bun:test";
import {
  buildOrgChart,
  directReportsOf,
  hatsAtLevel,
  LEVELS_SENIOR_FIRST,
  nearestSupervisorAtOrAbove,
  outranks,
  reportsUpTo,
  supervisorChainOf,
  supervisorOf,
  type OrgHat,
} from "./org-chart";
import { SEED_HATS } from "./org-seed";

const chartOrThrow = (hats: readonly OrgHat[]) => {
  const r = buildOrgChart(hats);
  if (!r.ok) throw new Error(`expected a valid chart, got: ${r.reason}`);
  return r.chart;
};

const seed = chartOrThrow(SEED_HATS);

describe("levels are ordered, and the order is derived", () => {
  test("senior first, board to IC", () => {
    expect(LEVELS_SENIOR_FIRST).toEqual([
      "executive_board",
      "c_suite",
      "director",
      "manager",
      "lead",
      "individual_contributor",
    ]);
  });

  test("outranks is strict — a level does not outrank itself", () => {
    expect(outranks("c_suite", "director")).toBe(true);
    expect(outranks("director", "c_suite")).toBe(false);
    // Strictness is what makes peer C-suite edges legal below. If this were >=, the CTO reporting
    // to the CEO would be rejected and the seed would not build.
    expect(outranks("c_suite", "c_suite")).toBe(false);
  });
});

describe("the chart refuses what is not an organization", () => {
  const ok: OrgHat = { id: "root", name: "Root", level: "executive_board", departmentId: "d" };

  test("no hats", () => {
    const r = buildOrgChart([]);
    expect(r.ok).toBe(false);
  });

  test("a duplicate id", () => {
    const r = buildOrgChart([ok, { ...ok, name: "Impostor" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("duplicate");
  });

  test("a dangling supervisor", () => {
    const r = buildOrgChart([ok, { id: "a", name: "A", level: "director", departmentId: "d", reportsTo: "ghost" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not a hat");
  });

  test("two roots are two organizations", () => {
    const r = buildOrgChart([ok, { ...ok, id: "root2" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("2 root hats");
  });

  test("a hat may not report to someone it outranks", () => {
    const r = buildOrgChart([
      ok,
      { id: "ic", name: "IC", level: "individual_contributor", departmentId: "d", reportsTo: "root" },
      { id: "dir", name: "Dir", level: "director", departmentId: "d", reportsTo: "ic" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("which it outranks");
  });

  test("a PEER CYCLE is caught, and only the reach-the-root walk can catch it", () => {
    // `a` and `b` are the same level, so the level rule passes. Neither is a root, but `root` is —
    // so `roots.length === 1` passes too. Both edges resolve. Every check except the walk is happy
    // with an organization containing a two-hat loop that no signal can ever escape.
    const r = buildOrgChart([
      ok,
      { id: "a", name: "A", level: "c_suite", departmentId: "d", reportsTo: "b" },
      { id: "b", name: "B", level: "c_suite", departmentId: "d", reportsTo: "a" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("does not reach the root");
  });
});

describe("the seed is a real organization", () => {
  test("it builds, with the board as the single root", () => {
    expect(seed.rootId).toBe("executive_board_member");
  });

  test("every level is populated — a chain with a missing rung proves nothing", () => {
    for (const level of LEVELS_SENIOR_FIRST) {
      expect(hatsAtLevel(seed, level).length).toBeGreaterThan(0);
    }
  });

  test("the C-suite reports to itself, and that is the reference shape", () => {
    expect(supervisorOf(seed, "cto")?.id).toBe("ceo");
    expect(seed.byId.get("cto")?.level).toBe("c_suite");
    expect(seed.byId.get("ceo")?.level).toBe("c_suite");
    expect(supervisorOf(seed, "chief_architect")?.id).toBe("cto");
  });

  test("the root has no supervisor", () => {
    expect(supervisorOf(seed, "executive_board_member")).toBeUndefined();
  });
});

describe("the chain is the routing primitive", () => {
  test("a dev reaches the board through named hats", () => {
    const chain = supervisorChainOf(seed, "backend_implementer");
    expect(chain).toEqual([
      "backend_implementer",
      "tech_lead",
      "engineering_manager",
      "engineering_director",
      "cto",
      "ceo",
      "executive_board_member",
    ]);
  });

  test("an unknown hat has no chain — not a chain of one", () => {
    // Returning `[hatId]` for an unknown hat would make every routing question answerable for hats
    // that do not exist, which is how a typo becomes a silent self-escalation.
    expect(supervisorChainOf(seed, "not_a_hat")).toEqual([]);
  });

  test("reportsUpTo follows the line and refuses to cross it", () => {
    expect(reportsUpTo(seed, "backend_implementer", "cto")).toBe(true);
    expect(reportsUpTo(seed, "backend_implementer", "coo")).toBe(false);
    // Reflexive: a hat is inside its own line of responsibility.
    expect(reportsUpTo(seed, "cto", "cto")).toBe(true);
  });

  test("direct reports are direct only", () => {
    const ids = directReportsOf(seed, "tech_lead").map((h) => h.id);
    expect(ids.sort()).toEqual(["backend_implementer", "frontend_implementer"]);
    // THE PROPERTY, not the census. The director's direct reports grew when the seed did, and an
    // exact list would have failed for a reason that is not about directness at all — what matters
    // is that a hat two rungs down is supervised transitively and NOT reported directly.
    const direct = directReportsOf(seed, "engineering_director").map((h) => h.id);
    expect(direct).toContain("engineering_manager");
    expect(direct).not.toContain("backend_implementer");
    expect(reportsUpTo(seed, "backend_implementer", "engineering_director")).toBe(true);
  });
});

describe("escalation routing", () => {
  test("a dev's nearest director is its own, not another department's", () => {
    expect(nearestSupervisorAtOrAbove(seed, "backend_implementer", "director")?.id).toBe("engineering_director");
  });

  test("escalating past the director reaches the C-suite", () => {
    expect(nearestSupervisorAtOrAbove(seed, "backend_implementer", "c_suite")?.id).toBe("cto");
  });

  test("a hat is never handed its own escalation", () => {
    // The engineering director asking for a director-level decision must go UP, not to itself.
    // Returning self here is the shape that turns an escalation into a no-op reporting success.
    const target = nearestSupervisorAtOrAbove(seed, "engineering_director", "director");
    expect(target?.id).not.toBe("engineering_director");
    expect(target?.id).toBe("cto");
  });

  test("nothing is above the board, so the board escalates to nobody", () => {
    expect(nearestSupervisorAtOrAbove(seed, "executive_board_member", "executive_board")).toBeUndefined();
  });
});
