import { describe, expect, test } from "bun:test";
import { checkTlcModelRegistry, cfgDisablesDeadlock, repoRoot } from "./lint-tlc-model-registry";
import { loadTlcRegistry } from "../formal-verification/tlc-invocation";

describe("TLC model registry", () => {
  test("every .cfg on disk is claimed by exactly one pinned model", () => {
    const problems = checkTlcModelRegistry(repoRoot());
    expect(problems).toEqual([]);
  });

  test("the registry is non-empty and every gate-tier model names a module and a config", () => {
    const registry = loadTlcRegistry(repoRoot());
    expect(registry.models.length).toBeGreaterThan(40);
    const gate = registry.models.filter((m) => m.tier === "gate");
    expect(gate.length).toBeGreaterThan(40);
    for (const model of gate) {
      expect(model.module.length).toBeGreaterThan(0);
      expect(model.config.endsWith(".cfg")).toBe(true);
    }
  });

  test("every model records what its deadlock check is worth", () => {
    const registry = loadTlcRegistry(repoRoot());
    for (const model of registry.models) {
      expect(["off-cfg", "on-vacuous", "on"]).toContain(model.deadlock);
    }
  });

  test("at least one model is recorded as on-vacuous, so the field is not decorative", () => {
    // QuorumCollateral and WagerSolvency stutter, so their deadlock checks cannot
    // fail and neither makes a deadlock-freedom claim. If this ever reads zero the
    // field has stopped being filled in honestly.
    const registry = loadTlcRegistry(repoRoot());
    const vacuous = registry.models.filter((m) => m.deadlock === "on-vacuous");
    expect(vacuous.length).toBeGreaterThan(0);
  });
});

describe("cfgDisablesDeadlock", () => {
  test("sees a real declaration", () => {
    expect(cfgDisablesDeadlock("SPECIFICATION Spec\nCHECK_DEADLOCK FALSE\n")).toBe(true);
  });

  test("does NOT see a commented rationale mentioning it", () => {
    // The four QuorumPhase configs carry a comment explaining the declaration
    // directly above the declaration. A checker that matched the comment would
    // report agreement it had not verified.
    expect(cfgDisablesDeadlock("\\* CHECK_DEADLOCK FALSE -- added after CI went red\nSPECIFICATION Spec\n")).toBe(false);
  });

  test("does not fire on CHECK_DEADLOCK TRUE", () => {
    expect(cfgDisablesDeadlock("CHECK_DEADLOCK TRUE\n")).toBe(false);
  });
});
