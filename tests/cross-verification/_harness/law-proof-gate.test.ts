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
                 "zset-isa.ir.json", "gset.ir.json", "zset.ir.json",
                 "bounded-gset.ir.json", "bounded-zset.ir.json", "heat-sink.ir.json",
                 "database.ir.json"];
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

  test("proof test files actually PASS when executed (assert-don't-skip)", () => {
    // Collect unique proof files referenced by proven laws
    const proofFiles = new Set<string>();
    for (const iface of interfaces) {
      for (const law of iface.laws) {
        if (law.status === "proven" && law.proof) {
          const [filePath] = law.proof.split(":");
          if (filePath.endsWith(".test.ts")) proofFiles.add(filePath);
        }
      }
    }

    // Run each proof file and assert it passes
    const { execSync } = require("node:child_process");
    for (const file of proofFiles) {
      const fullPath = join(REPO_ROOT, file);
      if (!existsSync(fullPath)) continue;
      try {
        execSync(`bun test ${fullPath}`, {
          encoding: "utf-8",
          timeout: 30000,
          cwd: REPO_ROOT,
          stdio: "pipe",
        });
      } catch (e: any) {
        // If test fails, this gate fails — the proof doesn't hold
        throw new Error(`Proof test file FAILS: ${file}\n${(e.stdout || e.stderr || "").slice(0, 200)}`);
      }
    }
    expect(proofFiles.size).toBeGreaterThan(0);
  }, 60000);
});
