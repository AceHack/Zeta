import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const GATE_PATH = join(REPO_ROOT, ".github", "workflows", "gate.yml");
const workflow = readFileSync(GATE_PATH, "utf8");
const BUN_ACTION = "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6";

// DERIVED, NOT RESTATED. This file used to assert the literal `bun-version: "1.3.13"`.
// That made it a SECOND restatement of a pin whose single declared source is `mise.lock`
// -- and restatements drift: measured 2026-09-13, the lock said 1.3.14 while 54 of the 55
// `bun-version:` keys under `.github/` said something else, this test's literal among
// them. A test that hardcodes the value it is checking cannot notice that the value moved;
// it can only force the tree to keep agreeing with a number nobody re-derived.
//
// The INTENT here is "these narrow jobs pin bun rather than reaching for install.sh", and
// that intent is independent of which version is pinned. So read the version from the lock
// and assert agreement with it. `audit-bun-pin-parity.ts` is the checker that holds every
// other restatement to the same source.
const LOCKED_BUN = ((): string => {
  const lock = readFileSync(join(REPO_ROOT, "mise.lock"), "utf8");
  const m = /\[\[tools\.bun\]\]\s*\n(?:[^[\n]*\n)*?\s*version\s*=\s*"([^"]+)"/u.exec(lock);
  if (m?.[1] === undefined) throw new Error("mise.lock declares no bun version — the pin has no source to check against");
  return m[1];
})();

function jobBlock(jobId: string): string {
  const start = workflow.indexOf(`  ${jobId}:\n`);
  if (start < 0) throw new Error(`missing gate job ${jobId}`);
  const next = workflow.slice(start + 1).search(/^  [A-Za-z0-9_-]+:\n/m);
  return next < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
}

describe("narrow JavaScript gate jobs", () => {
  const jobs = [
    "lint-bash-retirement-inventory",
    "lint-tick-history-order",
    "test-typescript-hermetic",
  ] as const;

  for (const jobId of jobs) {
    test(`FALSIFIER: ${jobId} refuses heavyweight setup regression`, () => {
      const block = jobBlock(jobId);
      expect(block).toContain(BUN_ACTION);
      expect(block).toContain(`bun-version: "${LOCKED_BUN}"`);
      expect(block).toContain("bun install --frozen-lockfile");
      expect(block).not.toContain("./tools/setup/install.sh");
    });
  }

  test("FALSIFIER: hermetic timeout holds the measured 18-20min suite", () => {
    // 2026-09-04: timeout-minutes: 20 cancelled the floor job mid-suite
    // (run 33833532558, bun test 19m47s). A silent revert to 20 reopens that
    // red: cancelled reads as FAIL, rerun-cancelled-gate will not heal a
    // second attempt, and auto-merge sits blocked.
    const block = jobBlock("test-typescript-hermetic");
    const match = /^    timeout-minutes: (\d+)$/m.exec(block);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(30);
  });
});
