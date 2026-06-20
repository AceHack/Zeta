import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(join(import.meta.dir, "ZSetISA.qs"), "utf-8");

const softOperators = ["Emit", "Retract", "Branch", "Join", "JoinWeighted", "Merge", "Fold"] as const;

function operationBody(name: string): string {
  const declarationStart = source.indexOf(`operation ${name}(`);
  expect(declarationStart).toBeGreaterThanOrEqual(0);
  if (declarationStart < 0) {
    return "";
  }

  const bodyStart = source.indexOf("{", declarationStart);
  expect(bodyStart).toBeGreaterThanOrEqual(0);
  if (bodyStart < 0) {
    return "";
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }

  expect(depth).toBe(0);
  return "";
}

function expectNoTerminalReadout(name: string): void {
  const body = operationBody(name);
  expect(body).not.toMatch(/\bM\s*\(/);
  expect(body).not.toMatch(/\bMeasure\b/);
  expect(body).not.toMatch(/\bReset(?:All)?\s*\(/);
}

describe("ZSetISA Q# source treaty", () => {
  test("declares the soft Z-set operator surface", () => {
    for (const name of softOperators) {
      expect(source).toContain(`operation ${name}(`);
    }

    expect(source).toContain("MERGE/FOLD = superposition/interference merge");
    expect(source).toContain("Born collapse = sim-only");
  });

  test("keeps the primitive gate mappings byte-visible", () => {
    expect(operationBody("Emit")).toContain("Ry(theta, k);");
    expect(operationBody("Retract")).toContain("Adjoint Emit(k, theta);");
    expect(operationBody("Branch")).toContain("H(k);");
    expect(operationBody("Join")).toContain("CNOT(control, target);");
    expect(operationBody("JoinWeighted")).toContain("Controlled Ry([control], (theta, target));");
  });

  test("keeps merge and fold as interference composition, not live measurement", () => {
    const merge = operationBody("Merge");
    expect(merge).toContain("sourceA(target);");
    expect(merge).toContain("sourceB(target);");

    const fold = operationBody("Fold");
    expect(fold).toContain("for source in sources");
    expect(fold).toContain("source(target);");

    for (const name of softOperators) {
      expectNoTerminalReadout(name);
    }
  });

  test("confines measurement and reset to the sim-only verification entry point", () => {
    const verifyIdentity = operationBody("VerifyIdentity");
    expect(verifyIdentity).toContain("let r = M(q);");
    expect(verifyIdentity).toContain("let r0 = M(qs[0]);");
    expect(verifyIdentity).toContain("let r1 = M(qs[1]);");
    expect(verifyIdentity).toContain("Reset(q);");
    expect(verifyIdentity).toContain("ResetAll(qs);");
  });
});
