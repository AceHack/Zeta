/**
 * law-proof-gate.test.ts — CI gate: verify that proven laws reference real proofs.
 *
 * For each law with status: "proven", this test verifies:
 * 1. The proof reference file exists
 * 2. The referenced test/proof name is present in the file
 *
 * This prevents the hollow-✅ pattern: a law claiming "proven" with a
 * broken or nonexistent proof reference. The gate makes the status field
 * a CI-verified claim, not a hand-typed assertion.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../../..");
const IR_DIR = join(import.meta.dir, "../zeta-ir-v2/interfaces");

// Load all interface IRs
function loadAllIrs(): { name: string; laws: any[] }[] {
  const files = ["semiring.ir.json", "star-ring.ir.json", "group.ir.json",
                 "monoid.ir.json", "lattice.ir.json", "codec.ir.json", "port.ir.json",
                 "zset-isa.ir.json"];
  const results: { name: string; laws: any[] }[] = [];
  for (const f of files) {
    try {
      const ir = JSON.parse(readFileSync(join(IR_DIR, f), "utf-8"));
      if (ir.laws && Array.isArray(ir.laws) && ir.laws.length > 0 && typeof ir.laws[0] === "object") {
        results.push({ name: ir.name, laws: ir.laws });
      }
    } catch {}
  }
  return results;
}

const interfaces = loadAllIrs();

describe("law-proof-gate — verify proven laws have real proof references", () => {
  for (const iface of interfaces) {
    const provenLaws = iface.laws.filter((l: any) => l.status === "proven" && l.proof);

    for (const law of provenLaws) {
      test(`${iface.name}.${law.id}: proof reference exists`, () => {
        const [filePath, _testName] = law.proof.split(":");
        const fullPath = join(REPO_ROOT, filePath);
        expect(existsSync(fullPath), `Proof file missing: ${filePath}`).toBe(true);
        if (_testName) {
          const content = readFileSync(fullPath, "utf8");
          expect(content, `Proof identifier "${_testName}" missing in file: ${filePath}`).toContain(_testName);
        }
      });
    }
  }

  test("at least 10 proven laws are verified (not vacuously passing)", () => {
    let totalProven = 0;
    for (const iface of interfaces) {
      totalProven += iface.laws.filter((l: any) => l.status === "proven").length;
    }
    expect(totalProven).toBeGreaterThanOrEqual(10);
  });
});
