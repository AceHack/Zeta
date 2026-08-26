/**
 * Falsifiers for the resource-class register.
 *
 * The register's whole value is that a `binding` claim carries evidence someone
 * can re-run. So the load-bearing test here is the VACUITY guard: a verdict with
 * an empty evidence string must be refused, because an evidence field nothing
 * checks decays into decoration.
 * (`.claude/rules/numerology-vs-number-theory.md` — a claim nothing can refute is
 * not a claim.)
 */

import { describe, it, expect } from "bun:test";
import {
  RESOURCE_CLASSES,
  RESOURCE_REGISTER,
  assertNever,
  isAllocatable,
  verdictIsWitnessed,
  type MeasuredVerdict,
  type ResourceClass,
} from "./resource-class.ts";

describe("the closed set", () => {
  it("the registry covers every variant exactly once", () => {
    expect(new Set(RESOURCE_CLASSES).size).toBe(RESOURCE_CLASSES.length);
    expect(RESOURCE_CLASSES).toHaveLength(4);
  });

  it("every class has a register row", () => {
    for (const c of RESOURCE_CLASSES) {
      expect(RESOURCE_REGISTER[c]).toBeDefined();
    }
    expect(Object.keys(RESOURCE_REGISTER)).toHaveLength(RESOURCE_CLASSES.length);
  });

  it("assertNever throws rather than returning a wrong answer", () => {
    expect(() => assertNever("nope" as never, "test")).toThrow();
  });
});

describe("vacuity guard on verdicts", () => {
  it("every shipped verdict is witnessed", () => {
    for (const c of RESOURCE_CLASSES) {
      expect(verdictIsWitnessed(RESOURCE_REGISTER[c].verdict)).toBe(true);
    }
  });

  it("refuses a binding claim with no evidence", () => {
    const empty: MeasuredVerdict = { kind: "binding", evidence: "   " };
    expect(verdictIsWitnessed(empty)).toBe(false);
  });

  it("refuses a not-binding claim with no evidence", () => {
    expect(verdictIsWitnessed({ kind: "not-binding", evidence: "" })).toBe(false);
  });

  it("refuses an unmeasured row that does not say what would settle it", () => {
    expect(verdictIsWitnessed({ kind: "unmeasured", needs: "" })).toBe(false);
  });

  it("every class names the measurement that settles it, measured or not", () => {
    for (const c of RESOURCE_CLASSES) {
      expect(RESOURCE_REGISTER[c].settledBy.trim().length).toBeGreaterThan(0);
      expect(RESOURCE_REGISTER[c].conservation.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the measured claims, pinned", () => {
  it("exactly one class is currently binding, and it is the window", () => {
    const binding = RESOURCE_CLASSES.filter(
      (c) => RESOURCE_REGISTER[c].verdict.kind === "binding",
    );
    expect(binding).toEqual(["window"]);
  });

  it("mutex is honestly unmeasured rather than assumed fine", () => {
    expect(RESOURCE_REGISTER.mutex.verdict.kind).toBe("unmeasured");
  });

  it("stock is the only bankable class", () => {
    const bankable = RESOURCE_CLASSES.filter((c) => RESOURCE_REGISTER[c].bankable);
    expect(bankable).toEqual(["stock"]);
  });
});

describe("allocatable vs paceable", () => {
  it("only a bankable resource can be allocated", () => {
    for (const c of RESOURCE_CLASSES) {
      // The design claim: allocatability and bankability are the same property.
      // If they ever diverge, the planner is offering a plan it cannot honour.
      expect(isAllocatable(c)).toBe(RESOURCE_REGISTER[c].bankable);
    }
  });

  it("is total over the closed set", () => {
    for (const c of RESOURCE_CLASSES) {
      expect(typeof isAllocatable(c)).toBe("boolean");
    }
  });

  it("throws on a value outside the union rather than defaulting", () => {
    expect(() => isAllocatable("invented" as ResourceClass)).toThrow();
  });
});
