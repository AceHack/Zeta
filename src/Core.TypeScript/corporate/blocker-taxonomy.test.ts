/**
 * blocker-taxonomy.test.ts — a generic `blocked` state is too weak.
 *
 * That is `ANTI_STALL_PRIORITY_RUNTIME.md`'s own criticism, and the tests here are the two halves
 * of answering it: a classified blocker must reach a hat that can ACT on that kind, and an
 * unclassified one must still reach somebody — the supervisor whose job the triage is.
 *
 * The failure this replaces is quiet: routing every blocker up the chain sent a credential problem
 * and a missing architecture to the same manager, who could act on neither, and the organization
 * looked like it had routed both.
 */

import { describe, expect, test } from "bun:test";
import {
  BLOCKER_POLICY,
  BlockerKind,
  isBlockerKind,
  ownersFor,
  resolutionFor,
  routeBlocker,
} from "./blocker-taxonomy";
import { buildOrgChart } from "./org-chart";
import { Department, SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const ALL = Object.values(BlockerKind);

describe("EVERY KIND ROUTES, and to somebody who can act on it", () => {
  test("all fifteen types resolve to a hat in this chart", () => {
    // A type with no reachable owner is one whose blockers sit in a queue forever, and it would be
    // invisible: the signal sends, the organization believes it routed.
    for (const kind of ALL) {
      expect(routeBlocker(chart, kind, "backend_implementer")).toBeDefined();
    }
  });

  test("DIFFERENT KINDS REACH DIFFERENT HATS — the whole point of typing them", () => {
    const targets = new Set(ALL.map((k) => routeBlocker(chart, k, "backend_implementer")?.id));
    // Not fifteen distinct — several kinds legitimately share an owner — but nowhere near one.
    expect(targets.size).toBeGreaterThan(6);
  });

  test("a credential problem reaches security, not the reporter's manager", () => {
    expect(routeBlocker(chart, BlockerKind.SecurityBlocked, "backend_implementer")?.id).toBe("security_engineer");
  });

  test("a missing design reaches an architect", () => {
    expect(routeBlocker(chart, BlockerKind.ArchitectureMissing, "backend_implementer")?.id).toBe("solution_architect");
  });

  test("a budget problem reaches finance, which is nowhere near the reporting line", () => {
    expect(routeBlocker(chart, BlockerKind.BudgetExceeded, "backend_implementer")?.id).toBe("cfo");
  });

  test("HAT SUPPLY GOES TO THE RMO FIRST — asking a manager for supply it does not hold forwards it", () => {
    expect(routeBlocker(chart, BlockerKind.HatSupplyExhausted, "backend_implementer")?.id).toBe("rmo_office");
  });
});

describe("owner order is load-bearing", () => {
  test("MOST SPECIFIC FIRST — an engineer before a director", () => {
    // Escalating before asking spends the more senior hat's attention on something the first one
    // could have answered.
    const owners = ownersFor(chart, BlockerKind.SecurityBlocked).map((h) => h.id);
    expect(owners.indexOf("security_engineer")).toBeLessThan(owners.indexOf("security_director"));
  });

  test("the chart's order is the POLICY's order, not the chart's own", () => {
    for (const kind of ALL) {
      const policy = BLOCKER_POLICY[kind].ownerHatIds.filter((id) => chart.byId.has(id));
      expect(ownersFor(chart, kind).map((h) => h.id)).toEqual(policy);
    }
  });

  test("A HAT IS NEVER ROUTED ITS OWN BLOCKER", () => {
    // A no-op reporting success. The next owner in the list takes it instead.
    const target = routeBlocker(chart, BlockerKind.SecurityBlocked, "security_engineer");
    expect(target?.id).toBe("security_director");
  });
});

describe("ABSENT HATS ARE SKIPPED, never assumed", () => {
  test("an organization without the first owner routes to the next one it has", () => {
    const smaller = buildOrgChart(SEED_HATS.filter((h) => h.id !== "security_engineer"));
    if (!smaller.ok) throw new Error(smaller.reason);
    expect(routeBlocker(smaller.chart, BlockerKind.SecurityBlocked, "backend_implementer")?.id).toBe(
      "security_director",
    );
  });

  test("...and one with NONE of them refuses rather than inventing a target", () => {
    // The caller falls back to the supervisor only for an UNCLASSIFIED blocker. A classified one
    // with no owner here is a real gap in the organization, and reporting it as routed would hide
    // that the chart has nobody for a whole category of problem.
    // Removing the two owners also strands everyone who reported to them, so the whole security
    // department goes — a chart with a dangling `reportsTo` is refused by `buildOrgChart`, which is
    // its own correct behaviour and not what this test is about.
    const none = buildOrgChart(SEED_HATS.filter((h) => h.departmentId !== Department.SecurityAndCompliance));
    if (!none.ok) throw new Error(none.reason);
    expect(routeBlocker(none.chart, BlockerKind.SecurityBlocked, "backend_implementer")).toBeUndefined();
  });
});

describe("the table is total and says what resolving looks like", () => {
  test("every kind has owners and a resolution path", () => {
    for (const kind of ALL) {
      expect(BLOCKER_POLICY[kind].ownerHatIds.length).toBeGreaterThan(0);
      // The owner is told what resolving it looks like rather than handed a problem and left to
      // infer the shape of the answer.
      expect(resolutionFor(kind).trim()).not.toBe("");
    }
  });

  test("every row's key agrees with its own kind — a copy-pasted row is a real risk here", () => {
    for (const kind of ALL) expect(BLOCKER_POLICY[kind].kind).toBe(kind);
  });

  test("AN UNKNOWN TYPE IS CAUGHT, not coerced", () => {
    expect(isBlockerKind("security_blocked")).toBe(true);
    expect(isBlockerKind("not_a_blocker")).toBe(false);
    // Prototype keys must not pass — `hasOwnProperty` rather than `in`.
    expect(isBlockerKind("toString")).toBe(false);
    expect(isBlockerKind("constructor")).toBe(false);
  });

  test("the doc's fifteen are all here", () => {
    expect(ALL).toHaveLength(15);
  });
});
