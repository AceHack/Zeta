import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

// Source-text structural oracle for the DBSP operator set mirrored into Q#
// (DbspOperators.qs). No QDK execution — same discipline as zset-isa.test.ts:
// the committed Q# source IS the reference; this asserts the surface + that each
// operator's weight action is grounded in the Zeta.Algebra tier.
const source = readFileSync(join(import.meta.dir, "DbspOperators.qs"), "utf-8");

function functionBody(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, i);
    }
  }
  return "";
}

const operators = [
  "DbspRelay",
  "DbspFilterKeep",
  "DbspRekeyWeight",
  "DbspIntegrate",
  "DbspJoinWeights",
  "DbspRetract",
  "DbspDistinctCross",
] as const;

describe("DBSP operator set — Q# reference oracle mirror", () => {
  test("declares the full operator surface (linear + non-linear + bilinear + sink)", () => {
    for (const op of operators) {
      expect(source).toContain(`function ${op}(`);
    }
  });

  test("grounds each operator's weight action in the Zeta.Algebra tier", () => {
    expect(source).toContain("open Zeta.Algebra");
    expect(functionBody("DbspIntegrate")).toContain("SemiringAdd"); // I = ⊕
    expect(functionBody("DbspJoinWeights")).toContain("SemiringMul"); // bilinear ⊗
    expect(functionBody("DbspRetract")).toContain("RingNegate"); // additive inverse
    expect(functionBody("DbspFilterKeep")).toContain("SemiringZero"); // drop = Zero
    expect(functionBody("DbspRelay")).toContain("return w"); // identity
    expect(functionBody("DbspRekeyWeight")).toContain("return w"); // weight-preserving
  });

  test("distinct emits only boundary crossings (+1 / -1 / 0)", () => {
    const body = functionBody("DbspDistinctCross");
    expect(body).toContain("wasPositive");
    expect(body).toContain("nowPositive");
    // no terminal measurement/collapse in a pure weight function
    expect(body).not.toMatch(/\bM\s*\(/);
    expect(body).not.toMatch(/\bMeasure\b/);
  });
});
