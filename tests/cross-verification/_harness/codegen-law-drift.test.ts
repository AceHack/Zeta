import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLawTests, type InterfaceIr } from "./codegen-law-tests";

const generatedLawCases = [
  {
    name: "ISemiring",
    irFile: "../zeta-ir-v2/interfaces/semiring.ir.json",
    generatedFile: "generated-semiring-laws.test.ts",
    instanceExpr: "require('../../../src/Core.TypeScript/algebra/interfaces').numberSemiring",
  },
  {
    name: "IRing",
    irFile: "../zeta-ir-v2/interfaces/ring.ir.json",
    generatedFile: "generated-ring-laws.test.ts",
    instanceExpr: "require('../../../src/Core.TypeScript/algebra/interfaces').numberSemiring",
  },
  {
    name: "IStarRing",
    irFile: "../zeta-ir-v2/interfaces/star-ring.ir.json",
    generatedFile: "generated-star-ring-laws.test.ts",
    instanceExpr: "require('../../../src/Core.TypeScript/algebra/star-ring').realRing",
  },
] as const;

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

function readIr(path: string): InterfaceIr {
  return JSON.parse(readText(path)) as InterfaceIr;
}

describe("codegen-law-tests — generated law output drift", () => {
  for (const testCase of generatedLawCases) {
    test(`${testCase.name} generated property tests are current`, () => {
      const irPath = join(import.meta.dir, testCase.irFile);
      const generatedPath = join(import.meta.dir, testCase.generatedFile);

      const regenerated = generateLawTests(readIr(irPath), testCase.instanceExpr);
      const checkedIn = readText(generatedPath);

      expect(checkedIn).toBe(regenerated);
    });
  }
});
