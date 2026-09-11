/**
 * routing-coverage.test.ts — the falsifier for a claim that was made without one.
 *
 * "The chart is a subset, therefore blocker routings are falling back" was written into this
 * register's own decision record and was FALSE — the 29-hat seed resolved every policy owner,
 * because the policies had been written against the hats that existed. It was plausible, it was
 * about a deliberately silent mechanism, and nobody could have contradicted it without this.
 *
 * So the load-bearing test is the seed's own coverage: zero gaps, asserted, so the next person to
 * believe something about routing has a number to check it against.
 */

import { describe, expect, test } from "bun:test";
import { BLOCKER_POLICY, BlockerKind, routeBlocker } from "./blocker-taxonomy";
import { buildOrgChart, type OrgHat } from "./org-chart";
import { Department, SEED_HATS } from "./org-seed";
import { ObservationState } from "./observation-ledger";
import { RoutingGap, routingCoverage, routingObservations } from "./routing-coverage";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/**
 * A chart missing some hats AND everyone beneath them.
 *
 * Removing a supervisor alone leaves its reports with a dangling `reportsTo`, which `buildOrgChart`
 * refuses — correctly, and for a reason that has nothing to do with what these tests are about. The
 * subtree goes with it, which is also what actually happens when an organization loses a branch.
 */
function chartWithout(drop: (h: OrgHat) => boolean) {
  const gone = new Set(SEED_HATS.filter(drop).map((h) => h.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const h of SEED_HATS) {
      if (!gone.has(h.id) && h.reportsTo !== undefined && gone.has(h.reportsTo)) {
        gone.add(h.id);
        grew = true;
      }
    }
  }
  const r = buildOrgChart(SEED_HATS.filter((h) => !gone.has(h.id)));
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
}

describe("THE SEED NAMES ONLY HATS IT HAS", () => {
  test("ZERO routing gaps — the number the claim should have been checked against", () => {
    const coverage = routingCoverage(chart);
    expect(coverage.findings).toEqual([]);
    expect(coverage.absentOwners).toEqual([]);
    expect(coverage.policiesChecked).toBe(Object.values(BlockerKind).length);
  });

  test("every policy row is checked on every call — this sweep has no partial mode", () => {
    // A coverage check that could itself be skipped would need its own coverage check.
    //
    // Asserted against the TABLE rather than a number: `toBe(15)` was a census of today's policy
    // and would have to be edited alongside every new blocker kind, which is the same
    // count-the-organization mistake the seed expansion just cost four fixtures to fix.
    expect(routingCoverage(chart).policiesChecked).toBe(Object.keys(BLOCKER_POLICY).length);
  });

  test("HONEST LIMITS — two mutants survive this file, and both are equivalent TODAY", () => {
    // Recorded rather than papered over, because each stops being equivalent at a knowable moment.
    //
    //  1. Deleting the `missing.length === 0` fast path changes nothing: a complete row reaches
    //     the first-owner check and that check passes, so no finding is pushed either way. It is a
    //     short-circuit, not a guard.
    //  2. Hardcoding `policiesChecked` as `15` is invisible while the table has fifteen rows. The
    //     assertion above is what makes it fail the moment a sixteenth is added — which is the
    //     only moment it would matter.
    expect(Object.keys(BLOCKER_POLICY)).toHaveLength(15);
  });

  test("and every kind actually routes somewhere", () => {
    for (const kind of Object.values(BlockerKind)) {
      expect(routeBlocker(chart, kind, "backend_implementer")).toBeDefined();
    }
  });
});

describe("A DEGRADED ROUTING IS A FINDING, not a success", () => {
  test("losing the FIRST owner is reported even though routing still succeeds", () => {
    // This is the silent case. `ownersFor` skips the absent specialist and the security director
    // answers instead — correct behaviour, and a fact nobody could see until now.
    const noEngineer = chartWithout((h) => h.id === "security_engineer");
    const coverage = routingCoverage(noEngineer);
    const finding = coverage.findings.find((f) => f.policy === BlockerKind.SecurityBlocked);
    expect(finding?.gap).toBe(RoutingGap.FirstOwnerAbsent);
    expect(finding?.reaches).toBe("security_director");
    expect(finding?.detail).toContain("should reach 'security_engineer'");
    // Routing still works. That is exactly why it needed reporting.
    expect(routeBlocker(noEngineer, BlockerKind.SecurityBlocked, "backend_implementer")).toBeDefined();
  });

  test("losing a LATER owner is not a degraded routing — the policy's first choice still answers", () => {
    // Otherwise every trimmed chart reports gaps and the signal stops meaning anything.
    // `hat_supply_exhausted` names rmo_office, engineering_manager, tpm — dropping the last leaves
    // the first two, so the policy's own preference is still honoured.
    const noTpm = chartWithout((h) => h.id === "tpm");
    const coverage = routingCoverage(noTpm);
    expect(coverage.findings.find((f) => f.policy === BlockerKind.HatSupplyExhausted)).toBeUndefined();
    // ...but the absent hat is still named, because it IS absent.
    expect(coverage.absentOwners).toContain("tpm");
  });

  test("LOSING EVERY OWNER IS UNROUTABLE, and that is the expensive one", () => {
    const noSecurity = chartWithout((h) => h.departmentId === Department.SecurityAndCompliance);
    const finding = routingCoverage(noSecurity).findings.find((f) => f.policy === BlockerKind.SecurityBlocked);
    expect(finding?.gap).toBe(RoutingGap.Unroutable);
    expect(finding?.reaches).toBeUndefined();
    expect(routeBlocker(noSecurity, BlockerKind.SecurityBlocked, "backend_implementer")).toBeUndefined();
  });

  test("absent owners are ORDINAL and de-duplicated, so two runs report identically", () => {
    const thin = chartWithout((h) => h.departmentId === Department.SecurityAndCompliance);
    const absent = routingCoverage(thin).absentOwners;
    expect([...absent].sort()).toEqual([...absent]);
    expect(new Set(absent).size).toBe(absent.length);
  });

  test("findings are ordinal by policy", () => {
    const thin = chartWithout(
      (h) => h.departmentId === Department.SecurityAndCompliance || h.departmentId === Department.QaAndVerification,
    );
    const policies = routingCoverage(thin).findings.map((f) => f.policy);
    expect([...policies].sort()).toEqual([...policies]);
    expect(policies.length).toBeGreaterThan(1);
  });
});

describe("IT REPORTS THROUGH THE SAME LEDGER AS EVERYTHING ELSE", () => {
  test("always observed — this question needs only the chart", () => {
    // Manufacturing a blind spot here would be looking thorough at the cost of being accurate.
    const obs = routingObservations(chart);
    expect(obs[0]?.state).toBe(ObservationState.Observed);
    expect(obs[0]?.findings).toBe(0);
  });

  test("a degraded chart shows up as findings in that one entry", () => {
    const obs = routingObservations(chartWithout((h) => h.id === "security_engineer"));
    expect(obs[0]?.findings).toBe(1);
  });
});

describe("THE POLICY TABLE ITSELF", () => {
  test("EVERY OWNER IT NAMES IS A HAT THIS ORGANIZATION HAS", () => {
    // The direct form of the same assertion, so a policy row that names a hat nobody ever created
    // fails here rather than degrading quietly at runtime.
    for (const kind of Object.values(BlockerKind)) {
      for (const id of BLOCKER_POLICY[kind].ownerHatIds) {
        expect(chart.byId.has(id)).toBe(true);
      }
    }
  });
});
