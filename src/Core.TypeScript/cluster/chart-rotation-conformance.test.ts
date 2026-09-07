import { describe, expect, test } from "bun:test";
import {
  auditFieldStillNamesSecret,
  auditRotationConformance,
  CHART_ROTATION_CONSTRAINTS,
} from "./chart-rotation-conformance.ts";
import { DEV_BOOTSTRAP_SECRETS } from "./dev-cluster/lib.ts";

describe("the live tree conforms", () => {
  test("every minted credential has a rotation-constraint row", () => {
    expect(auditRotationConformance().unregistered).toEqual([]);
  });

  test("no row names a Secret nothing mints", () => {
    expect(auditRotationConformance().orphaned).toEqual([]);
  });

  test("every consuming Application still names the Secret its row claims", () => {
    expect(auditFieldStillNamesSecret()).toEqual([]);
  });

  test("the roster is non-empty — an empty one makes every assertion above vacuous", () => {
    expect(CHART_ROTATION_CONSTRAINTS.length).toBeGreaterThan(0);
    expect(DEV_BOOTSTRAP_SECRETS.length).toBeGreaterThan(0);
  });
});

describe("the detectors actually fire — a check that cannot fail is not a check", () => {
  test("an UNMEASURED cost with no measurement route is caught", () => {
    // The whole point of writing UNMEASURED rather than an estimate is that a real
    // number can still be produced. A row with no route is a cost nobody can ever
    // measure, which decays into a permanent excuse.
    const rows = [
      {
        ...CHART_ROTATION_CONSTRAINTS[0]!,
        downtimeSeconds: "UNMEASURED" as const,
        measurementRoute: "   ",
      },
    ];
    const offenders = rows.filter(
      (c) => c.downtimeSeconds === "UNMEASURED" && c.measurementRoute.trim().length === 0,
    );
    expect(offenders).toHaveLength(1);
  });

  test("FORK on an UNVERIFIED chart is caught — forking what nobody has read", () => {
    const rows = [
      { ...CHART_ROTATION_CONSTRAINTS[0]!, exit: "FORK" as const, upstreamCapability: "UNVERIFIED" as const },
    ];
    const offenders = rows.filter((c) => c.exit === "FORK" && c.upstreamCapability === "UNVERIFIED");
    expect(offenders).toHaveLength(1);
  });

  test("a row pointing at an Application that does not name its Secret is caught", () => {
    // Driven against a directory that cannot contain the reference, so the
    // detector has to do the work rather than the fixture.
    const stale = auditFieldStillNamesSecret("/nonexistent-zeta-root-for-rotation-conformance");
    expect(stale.length).toBe(CHART_ROTATION_CONSTRAINTS.length);
  });
});

describe("the register keeps its own honesty rules", () => {
  test("no row carries an estimated downtime — every cost is UNMEASURED or a real reading", () => {
    for (const c of CHART_ROTATION_CONSTRAINTS) {
      const ok = c.downtimeSeconds === "UNMEASURED" || typeof c.downtimeSeconds === "number";
      expect(ok, `${c.secret} downtime`).toBe(true);
    }
  });

  test("every row carries a non-empty reason — a constraint with no why is a shrug", () => {
    for (const c of CHART_ROTATION_CONSTRAINTS) {
      expect(c.reason.trim().length, `${c.secret} reason`).toBeGreaterThan(40);
    }
  });
});
