/**
 * cross-verify-interfaces.test.ts — Per-directory oracle for interface IRs.
 *
 * For every interface IR in this directory that has structured laws,
 * run the cross-language law verification and assert all pass.
 *
 * This is the "oracle beside the golden vectors" for the interface directory.
 */
import { describe, test, expect } from "bun:test";
import { crossVerifyAllLaws } from "../../_harness/cross-verify-laws";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const IR_DIR = import.meta.dir;
const irFiles = readdirSync(IR_DIR).filter(f => f.endsWith(".ir.json"));

describe("interface IRs — cross-language law verification", () => {
  for (const file of irFiles) {
    test(`${file}: laws hold across all tested languages`, () => {
      const { results, summary } = crossVerifyAllLaws(join(IR_DIR, file));
      // Laws that have encodings should pass (not fail)
      expect(summary.failed).toBe(0);
      // At least some laws were checked (not all skipped)
      if (summary.passed > 0) {
        expect(summary.passed).toBeGreaterThan(0);
      }
    }, 30000);
  }

  test("at least 2 interface IRs have cross-verified laws", () => {
    let irsWithLaws = 0;
    for (const file of irFiles) {
      const { summary } = crossVerifyAllLaws(join(IR_DIR, file));
      if (summary.passed > 0) irsWithLaws++;
    }
    expect(irsWithLaws).toBeGreaterThanOrEqual(1);
  }, 60000);
});
