/**
 * domain-ontology.test.ts — "ship checkout" must not be owned by the Hat Approval Steward.
 *
 * That is not a hypothetical. Cascading that exact goal down the full 124-hat chart produced an
 * initiative owned by governance, a project owned by capability expansion, and a task that could
 * not be staffed at all. Nothing was broken — `ownerForRung` picked by graph distance and then
 * alphabetically, because the chart says who reports to whom and never said who does what.
 *
 * So the load-bearing test is that exact cascade, and the second one is the honest limit: when the
 * owning department is genuinely unreachable from the delegating parent, the work is still staffed
 * and the miss is REPORTED rather than swallowed.
 */

import { describe, expect, test } from "bun:test";
import {
  DOMAIN_OWNER,
  Domain,
  DomainMatch,
  departmentFor,
  domainMatch,
  domainRouting,
  domainsOwnedBy,
  isDomain,
} from "./domain-ontology";
import {
  acceptGoal,
  decompose,
  ownerForRung,
  WorkState,
  WorkType,
  type Cascade,
  type CascadeNode,
} from "./goal-cascade";
import { buildOrgChart } from "./org-chart";
import { Department, SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/** The measurement that forced this module, run as a test. */
function shipCheckout(domain: Domain | undefined) {
  let cascade = { nodes: [] } as unknown as Cascade;
  const accepted = acceptGoal(cascade, chart, { workId: "goal-1", title: "ship checkout", acceptingHatId: "ceo" });
  if (!accepted.ok) throw new Error(accepted.reason);
  cascade = accepted.cascade;

  const steps: { id: string; owner: string }[] = [];
  const chain: readonly (readonly [string, string])[] = [
    ["goal-1", "init-1"],
    ["init-1", "proj-1"],
    ["proj-1", "task-1"],
  ];
  for (const [parent, id] of chain) {
    const d = decompose(cascade, chart, parent, [
      { workId: id, title: id, ...(parent === "goal-1" && domain !== undefined ? { domain } : {}) },
    ]);
    if (!d.ok) return { steps, refused: d.reason };
    cascade = d.cascade;
    steps.push({ id, owner: d.cascade.nodes.find((n) => n.workId === id)?.ownerHatId ?? "?" });
  }
  return { steps, refused: undefined, cascade };
}

describe("THE MEASUREMENT THAT FORCED THIS MODULE", () => {
  test("WITHOUT a domain, a product goal is owned by governance — and staffed by it", () => {
    // Recorded, not fixed. This is what a caller still gets by saying nothing about what the work
    // is about: "ship checkout" handed to the Hat Approval Steward because governance sorts first.
    //
    // IT NO LONGER DIES THERE, and that is a change worth stating rather than quietly dropping.
    // The ladder bends now, so capability expansion staffs the whole thing out of its own
    // contributors. Misrouted work that COMPLETES is in one way worse than misrouted work that
    // stalls — a stall is loud — which is exactly why `domainRouting` reports every fallback.
    const before = shipCheckout(undefined);
    expect(before.refused).toBeUndefined();
    expect(before.steps.map((s) => s.owner)).toEqual([
      "hat_approval_steward",
      "hat_designer",
      "hat_designer",
    ]);
    expect(before.steps.map((s) => s.owner)).not.toContain("engineering_director");
  });

  test("WITH one, it goes to engineering and staffs all the way down", () => {
    const after = shipCheckout(Domain.Implementation);
    expect(after.refused).toBeUndefined();
    expect(after.steps.map((s) => s.owner)).toEqual(["engineering_director", "engineering_manager", "tech_lead"]);
  });

  test("a DIFFERENT domain sends the same goal somewhere else entirely", () => {
    // The choice is a property of the work now, not of the alphabet.
    const qa = shipCheckout(Domain.QualityVerification);
    expect(qa.steps[0]?.owner).toBe("qa_director");
    const security = shipCheckout(Domain.Security);
    expect(security.steps[0]?.owner).toBe("security_director");
  });

  test("INHERITANCE STEERS ROUTING, not just the record — under a parent whose line forks", () => {
    // A mutation run killed nothing when inheritance stopped feeding the OWNER lookup, because the
    // engineering line below a director is single-department: every candidate matched anyway, so
    // the fixture could not tell inheritance from luck. The CTO's line forks across five
    // departments, and there the two answers differ.
    //
    // No domain: `engineering_manager` sorts before `qa_engineering_manager` at equal distance.
    // Inherited `test_automation`: QA Engineering owns it, so its manager takes the project.
    const parent: CascadeNode = {
      workId: "init-x",
      workType: WorkType.Initiative,
      title: "harden the regression suite",
      state: WorkState.Open,
      ownerHatId: "cto",
      domain: Domain.TestAutomation,
    };
    const withDomain = decompose({ nodes: [parent] }, chart, "init-x", [{ workId: "proj-x", title: "p" }]);
    if (!withDomain.ok) throw new Error(withDomain.reason);
    expect(withDomain.cascade.nodes.find((n) => n.workId === "proj-x")?.ownerHatId).toBe("qa_engineering_manager");

    const { domain: _dropped, ...noDomain } = parent;
    const without = decompose({ nodes: [noDomain] }, chart, "init-x", [{ workId: "proj-x", title: "p" }]);
    if (!without.ok) throw new Error(without.reason);
    expect(without.cascade.nodes.find((n) => n.workId === "proj-x")?.ownerHatId).toBe("engineering_manager");
  });

  test("CHILDREN INHERIT THE DOMAIN — stating it once routes the whole branch", () => {
    const after = shipCheckout(Domain.Implementation);
    if (after.cascade === undefined) throw new Error("expected a cascade");
    for (const id of ["init-1", "proj-1", "task-1"]) {
      expect(after.cascade.nodes.find((n) => n.workId === id)?.domain).toBe(Domain.Implementation);
    }
  });
});

describe("THE FALLBACK IS REPORTED, NOT SWALLOWED", () => {
  test("an unreachable owning department still staffs the work", () => {
    // A goal held by the CTO genuinely cannot delegate to a product director reporting to the CEO.
    // Refusing there would stall real work over an org-shape fact the caller cannot fix.
    const owner = ownerForRung(chart, "director", "cto", "manager", Domain.ProductDiscovery);
    expect(owner).toBeDefined();
    expect(owner?.departmentId).not.toBe(Department.ProductAndCustomerDiscovery);
  });

  test("...and `domainMatch` says the owner is OUT OF DOMAIN", () => {
    const owner = ownerForRung(chart, "director", "cto", "manager", Domain.ProductDiscovery);
    expect(domainMatch(Domain.ProductDiscovery, owner?.departmentId ?? "")).toBe(DomainMatch.OutOfDomain);
  });

  test("a reachable one matches", () => {
    const owner = ownerForRung(chart, "director", "ceo", "manager", Domain.ProductDiscovery);
    expect(owner?.id).toBe("product_director");
    expect(domainMatch(Domain.ProductDiscovery, owner?.departmentId ?? "")).toBe(DomainMatch.InDomain);
  });

  test("NO DOMAIN IS 'UNSTATED', not a miss — the caller said nothing to match against", () => {
    // Conflating them would report every domain-less cascade as a routing failure, and a signal
    // that fires on the ordinary case stops being read.
    expect(domainMatch(undefined, "anything")).toBe(DomainMatch.Unstated);
  });
});

describe("the table", () => {
  test("every domain has an owning department", () => {
    for (const d of Object.values(Domain)) expect(departmentFor(d)).toBeDefined();
    expect(Object.values(Domain)).toHaveLength(16);
  });

  test("the reverse index is DERIVED, so the two cannot disagree", () => {
    for (const d of Object.values(Domain)) {
      expect(domainsOwnedBy(departmentFor(d))).toContain(d);
    }
  });

  test("the mapping is ONE-TO-ONE today — which is why the next test needs its own table", () => {
    // Recorded because it is what makes the ordinal rule unobservable against the shipped table.
    for (const d of Object.values(Domain)) expect(domainsOwnedBy(departmentFor(d))).toHaveLength(1);
  });

  test("a department owning several domains gets them ORDINALLY, not in declaration order", () => {
    // Declaration order puts Governance first; ordinal order puts capability_expansion first. The
    // table is contrived because no shipped department owns two domains — see `domainsOwnedBy`.
    const table = { ...DOMAIN_OWNER, [Domain.CapabilityExpansion]: Department.ExecutiveBoardAndGovernance };
    expect(domainsOwnedBy(Department.ExecutiveBoardAndGovernance, table)).toEqual([
      Domain.CapabilityExpansion,
      Domain.Governance,
    ]);
  });

  test("an unknown string is caught, and prototype keys do not pass", () => {
    expect(isDomain("implementation")).toBe(true);
    expect(isDomain("vibes")).toBe(false);
    expect(isDomain("toString")).toBe(false);
  });

  test("EVERY OWNING DEPARTMENT IS ONE THIS ORGANIZATION HAS", () => {
    // A domain owned by a department nobody created routes nowhere, silently — the same defect
    // `routing-coverage.ts` exists to stop for blocker owners.
    const departments = new Set(chart.hats.map((h) => h.departmentId));
    for (const d of Object.values(Domain)) expect(departments.has(DOMAIN_OWNER[d])).toBe(true);
  });
});

describe("domainRouting reports the whole cascade, INCLUDING what said nothing", () => {
  const dept = (hatId: string) => chart.hats.find((h) => h.id === hatId)?.departmentId;

  test("a matched, a missed, and an unstated row — all three present", () => {
    const rows = domainRouting(
      [
        { workId: "a", ownerHatId: "engineering_director", domain: Domain.Implementation },
        { workId: "b", ownerHatId: "engineering_director", domain: Domain.ProductDiscovery },
        { workId: "c", ownerHatId: "engineering_director" },
      ],
      dept,
    );
    expect(rows.map((r) => r.match)).toEqual([
      DomainMatch.InDomain,
      DomainMatch.OutOfDomain,
      DomainMatch.Unstated,
    ]);
  });

  test("WORK THAT SAID NOTHING IS NOT OMITTED", () => {
    // A report that listed only the misses would show a clean sheet for an organization where no
    // work carries a domain at all — which is the exact state this module was built to end.
    const rows = domainRouting([{ workId: "c", ownerHatId: "ceo" }], dept);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.match).toBe(DomainMatch.Unstated);
  });

  test("an owner the chart does not hold is a miss, not a match", () => {
    const rows = domainRouting([{ workId: "a", ownerHatId: "ghost", domain: Domain.Implementation }], dept);
    expect(rows[0]?.ownerDepartmentId).toBe("");
    expect(rows[0]?.match).toBe(DomainMatch.OutOfDomain);
  });

  test("THE REAL CASCADE FEEDS IT — AND THE FIXED RUN STILL HAS ONE FALLBACK", () => {
    // Found by writing this test, not by predicting it. The seed's engineering line changes
    // department at the manager rung — `engineering_director` and `tech_lead` are Engineering,
    // `engineering_manager` is Engineering Management — so an implementation project has no
    // in-domain manager to go to and takes the nearest one instead.
    //
    // That is a fact about this organization's shape, not a bug in the routing, and the whole
    // reason this report exists is that before it the hop was invisible. Asserted exactly as
    // measured: two rungs in domain, ONE out, and the goal itself never said what it was about.
    const after = shipCheckout(Domain.Implementation);
    if (after.cascade === undefined) throw new Error("expected a cascade");
    const rows = domainRouting(after.cascade.nodes, dept);
    expect(rows.filter((r) => r.match === DomainMatch.OutOfDomain).map((r) => r.ownerHatId)).toEqual([
      "engineering_manager",
    ]);
    expect(rows.filter((r) => r.match === DomainMatch.InDomain).map((r) => r.ownerHatId)).toEqual([
      "engineering_director",
      "tech_lead",
    ]);
    expect(rows.filter((r) => r.match === DomainMatch.Unstated).map((r) => r.workId)).toEqual(["goal-1"]);
  });
});
