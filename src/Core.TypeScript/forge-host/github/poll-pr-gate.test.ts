// poll-pr-gate.test.ts — fixture-driven DST coverage for the v1 single-PR
// gate query. Closes the v1 gap: task #355 promised "with fixtures" but
// the fixture set under tools/github/fixtures/ landed without a test
// runner exercising it. This file makes each fixture's expected gate
// classification a load-bearing assertion.
//
// Each fixture name encodes the scenario:
//   - clean-armed-auto-merge.json  → CLEAN gate, autoMerge: armed
//   - blocked-by-threads.json      → BLOCKED gate, unresolvedThreads > 0
//   - dirty-auto-merge-armed.json  → DIRTY gate, nextAction: rebase
//   - behind-needs-rebase.json     → DIRTY gate (BEHIND collapses to DIRTY)
//   - non-required-failure-warning.json → required-vs-non-required hardening
//   - status-context-error.json    → StatusContext ERROR maps to BLOCKED
//   - unknown-mergeability-pending-recompute.json → UNKNOWN handling
//
// The test asserts the v1 hardening contracts (per peer-review 2026-04-30):
//   1. Required-only check failures gate the merge; non-required failures
//      surface as warnings and don't change nextAction.
//   2. BEHIND mergeStateStatus collapses to DIRTY (rebase needed).
//   3. CLOSED-without-merge is terminal (nextAction: none).
//   4. unresolvedThreads count drives resolve-threads classification.
//
// Runs via `bun test tools/github/poll-pr-gate.test.ts`. Zero gh
// spawns, zero network — all data comes from on-disk fixture JSON.

import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, loadFixture, type GateReport } from "./poll-pr-gate";

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function classifyFixture(name: string): GateReport {
  return buildReport(loadFixture(resolve(FIXTURES_DIR, name)));
}

describe("clean-armed-auto-merge fixture", () => {
  // Canonical happy path — CI green, auto-merge armed, no threads.
  // The loop's verify-merge target.
  test("classifies as CLEAN with auto-merge armed", () => {
    const report = classifyFixture("clean-armed-auto-merge.json");
    expect(report.gate).toBe("CLEAN");
    expect(report.autoMerge).toBe("armed");
    expect(report.unresolvedThreads).toBe(0);
    expect(report.requiredChecks.failed).toBe(0);
    expect(report.nextAction).toBe("none");
  });
});

describe("blocked-by-threads fixture", () => {
  // The exact scenario the BLOCKED-with-green-CI wake-time bullet
  // targets: CI green, auto-merge state, but unresolved threads
  // gate the merge. The discriminating signal is unresolvedThreads > 0.
  test("classifies as BLOCKED with resolve-threads next action", () => {
    const report = classifyFixture("blocked-by-threads.json");
    expect(report.gate).toBe("BLOCKED");
    expect(report.unresolvedThreads).toBeGreaterThan(0);
    expect(report.requiredChecks.failed).toBe(0);
    expect(report.nextAction).toBe("resolve-threads");
  });
});

describe("dirty-auto-merge-armed fixture", () => {
  test("classifies as DIRTY with rebase next action", () => {
    const report = classifyFixture("dirty-auto-merge-armed.json");
    expect(report.gate).toBe("DIRTY");
    expect(report.nextAction).toBe("rebase");
  });
});

describe("behind-needs-rebase fixture", () => {
  // BEHIND mergeStateStatus collapses to DIRTY per Copilot P0 from
  // the v1 hardening — both states need a rebase before merge.
  test("BEHIND collapses to DIRTY", () => {
    const report = classifyFixture("behind-needs-rebase.json");
    expect(report.gate).toBe("DIRTY");
    expect(report.nextAction).toBe("rebase");
  });
});

describe("non-required-failure-warning fixture", () => {
  // The v1 hardening's load-bearing test case: a non-required check
  // failed, but required checks all pass. The contract is that this
  // does NOT fail the gate — it surfaces as a warning, and nextAction
  // proceeds based on required-only state.
  test("non-required failure produces warning, not gate failure", () => {
    const report = classifyFixture("non-required-failure-warning.json");
    expect(report.requiredChecks.failed).toBe(0);
    expect(report.warnings.length).toBeGreaterThan(0);
    // Warnings carry the "non-required check failed:" prefix for
    // grep-friendly downstream filtering.
    expect(report.warnings[0]).toMatch(/non-required check failed:/);
    expect(report.nextAction).not.toBe("fix-failed-checks");
  });
});

describe("status-context-error fixture", () => {
  // StatusContext-class checks (not CheckRun) expose state instead
  // of status/conclusion. ERROR + FAILURE both block; pending states
  // (PENDING, EXPECTED) are still in-progress. Per Codex P1 review.
  test("StatusContext ERROR is treated as a blocking failure", () => {
    const report = classifyFixture("status-context-error.json");
    // The fixture has at least one ERROR-state status context that
    // should normalize to a blocking conclusion.
    expect(report.requiredChecks.failed + report.checks.failed).toBeGreaterThan(0);
  });
});

describe("unknown-mergeability-pending-recompute fixture", () => {
  // GitHub computes mergeability asynchronously after a push;
  // there's a window where mergeStateStatus is UNKNOWN. The script
  // surfaces this honestly rather than guessing.
  test("UNKNOWN mergeStateStatus surfaces as UNKNOWN gate", () => {
    const report = classifyFixture("unknown-mergeability-pending-recompute.json");
    expect(report.gate).toBe("UNKNOWN");
  });
});

describe("buildReport contracts (cross-fixture invariants)", () => {
  const fixtures = [
    "clean-armed-auto-merge.json",
    "blocked-by-threads.json",
    "dirty-auto-merge-armed.json",
    "behind-needs-rebase.json",
    "non-required-failure-warning.json",
    "status-context-error.json",
    "unknown-mergeability-pending-recompute.json",
  ];

  test.each(fixtures)("%s — checks counts are non-negative integers", (name) => {
    const report = classifyFixture(name);
    for (const k of ["ok", "inProgress", "pending", "failed"] as const) {
      expect(report.checks[k]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(report.checks[k])).toBe(true);
      expect(report.requiredChecks[k]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(report.requiredChecks[k])).toBe(true);
    }
  });

  test.each(fixtures)("%s — requiredChecks counts are bounded by total checks", (name) => {
    const report = classifyFixture(name);
    // Required checks are a subset of all checks. Each per-status
    // count must be <= the total per-status count, since a required
    // check is also a check.
    for (const k of ["ok", "inProgress", "pending", "failed"] as const) {
      expect(report.requiredChecks[k]).toBeLessThanOrEqual(report.checks[k]);
    }
  });

  test.each(fixtures)("%s — nextAction is consistent with gate state", (name) => {
    const report = classifyFixture(name);
    if (report.gate === "DIRTY") expect(report.nextAction).toBe("rebase");
    if (report.state === "MERGED") expect(report.nextAction).toBe("verify-merge");
    if (report.state === "CLOSED") expect(report.nextAction).toBe("none");
    if (report.requiredChecks.failed > 0) {
      expect(report.nextAction).toBe("fix-failed-checks");
    }
  });
});
