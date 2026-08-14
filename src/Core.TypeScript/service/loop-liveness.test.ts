/**
 * loop-liveness.test.ts — falsifiers for the persona-cell liveness check.
 *
 * The point of this suite is the FIRST describe block: it pins the exact
 * `launchctl print` output measured on the live machine 2026-08-14 for a
 * healthy cell and for a two-month-dead cell, and asserts the classifier
 * separates them. The predecessor (`IServiceManager.status()`) mapped both to
 * `installed-stopped`, which is why the outage ran for two months unnoticed.
 *
 * If a future refactor reintroduces the conflation, `healthy vs dead` fails.
 */

import { describe, expect, test } from "bun:test";
import { classify, isFailure, parseLaunchctlPrint, type CellFacts } from "./loop-liveness";

// Verbatim excerpts from `launchctl print gui/501/<label>` on 2026-08-14.
const HEALTHY_KIRO_PRINT = `
	path = /Users/acehack/Library/LaunchAgents/com.lucent.zeta.kiro-loop.plist
	state = not running
	program = /Users/acehack/.local/share/mise/installs/bun/1.3/bin/bun
	last exit code = 0
`;

const DEAD_OTTO_PRINT = `
	path = /Users/acehack/Library/LaunchAgents/com.lucent.zeta.otto.plist
	state = spawn scheduled
	program = /Users/acehack/.zeta/clones/otto/tools/kiro/kiro-loop-wrapper.sh
	last exit code = 78: EX_CONFIG
`;

function facts(over: Partial<CellFacts> = {}): CellFacts {
  return {
    persona: "test",
    label: "com.lucent.zeta.test-loop",
    unitFound: true,
    lastExitCode: 0,
    launchdState: "not running",
    heartbeatAgeMs: 30_000,
    staleAfterMs: 180_000,
    ...over,
  };
}

describe("the conflation that hid a two-month outage", () => {
  test("both cells report a launchd state that is NOT 'running' — the old signal is vacuous", () => {
    // This is the defect, asserted directly: the field IServiceManager keyed on
    // is identical for the healthy and the dead cell.
    expect(HEALTHY_KIRO_PRINT.includes("state = running")).toBe(false);
    expect(DEAD_OTTO_PRINT.includes("state = running")).toBe(false);
  });

  test("healthy vs dead: the exit code separates what the state did not", () => {
    const healthy = parseLaunchctlPrint(HEALTHY_KIRO_PRINT);
    const dead = parseLaunchctlPrint(DEAD_OTTO_PRINT);

    expect(healthy.lastExitCode).toBe(0);
    expect(dead.lastExitCode).toBe(78);

    expect(classify(facts({ lastExitCode: healthy.lastExitCode })).verdict).toBe("healthy");
    expect(classify(facts({ lastExitCode: dead.lastExitCode })).verdict).toBe("failing");
  });

  test("the dead cell's reason names EX_CONFIG so the operator sees the cause", () => {
    const report = classify(facts({ lastExitCode: 78 }));
    expect(report.reason).toContain("78");
    expect(report.reason).toContain("EX_CONFIG");
  });
});

describe("parseLaunchctlPrint", () => {
  test("reads the state line verbatim", () => {
    expect(parseLaunchctlPrint(DEAD_OTTO_PRINT).launchdState).toBe("spawn scheduled");
    expect(parseLaunchctlPrint(HEALTHY_KIRO_PRINT).launchdState).toBe("not running");
  });

  test("absent fields are undefined, never defaulted to a passing value", () => {
    const parsed = parseLaunchctlPrint("nothing useful here");
    expect(parsed.lastExitCode).toBeUndefined();
    expect(parsed.launchdState).toBeUndefined();
  });
});

describe("classify", () => {
  test("a unit launchd cannot find is not-installed, not a failure", () => {
    const report = classify(facts({ unitFound: false }));
    expect(report.verdict).toBe("not-installed");
    expect(isFailure([report])).toBe(false);
  });

  test("installed but never wrote a heartbeat is stale", () => {
    expect(classify(facts({ heartbeatAgeMs: undefined })).verdict).toBe("stale");
  });

  test("a heartbeat older than the stale window is stale", () => {
    expect(classify(facts({ heartbeatAgeMs: 180_001 })).verdict).toBe("stale");
  });

  test("a heartbeat inside the stale window is healthy", () => {
    expect(classify(facts({ heartbeatAgeMs: 179_999 })).verdict).toBe("healthy");
  });

  test("a nonzero exit code beats a fresh heartbeat — proximate cause wins", () => {
    // A cell can have a stale-but-present heartbeat from before it broke. The
    // exit code is the actionable fact, so it must be reported first.
    const report = classify(facts({ lastExitCode: 78, heartbeatAgeMs: 1_000 }));
    expect(report.verdict).toBe("failing");
    expect(report.reason).toContain("exit code");
  });

  test("an unparsed exit code does not silently pass as healthy when stale", () => {
    expect(classify(facts({ lastExitCode: undefined, heartbeatAgeMs: undefined })).verdict).toBe("stale");
  });
});

describe("isFailure", () => {
  test("failing and stale are failures; healthy and not-installed are not", () => {
    expect(isFailure([classify(facts({ lastExitCode: 78 }))])).toBe(true);
    expect(isFailure([classify(facts({ heartbeatAgeMs: undefined }))])).toBe(true);
    expect(isFailure([classify(facts())])).toBe(false);
    expect(isFailure([classify(facts({ unitFound: false }))])).toBe(false);
  });

  test("one dead cell among healthy ones still fails the run", () => {
    const reports = [
      classify(facts({ persona: "kiro" })),
      classify(facts({ persona: "otto", lastExitCode: 78 })),
      classify(facts({ persona: "codex", unitFound: false })),
    ];
    expect(isFailure(reports)).toBe(true);
  });

  test("an empty roster is not a pass-by-vacuity signal for a caller", () => {
    // isFailure([]) is false by construction; the CLI must therefore never be
    // the only guard. Pinned so the vacuity is explicit rather than assumed.
    expect(isFailure([])).toBe(false);
  });
});
