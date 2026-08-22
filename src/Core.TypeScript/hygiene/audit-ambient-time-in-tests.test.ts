// THE FALSIFIER for audit-ambient-time-in-tests.ts.
//
// Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, a guard with no test that fails
// without it is unmetered -- and an enforcement check is exactly the kind of artefact that
// looks like a control while constraining nothing. So every claim the audit makes is paired
// here with an input that makes it go red, and the two directions of the ratchet are pinned
// separately because they are separate failures.
//
// The scanner is exercised through `scanSource` on synthetic sources rather than by writing
// real violating test files into the tree: a file that violates the rule on disk would be
// found by the audit itself, which is a check eating its own falsifier.

import { beforeAll, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { scanSource, splitArgs, isZeroDelay, audit, loadAllowlist, ALLOWLIST_PATH } from "./audit-ambient-time-in-tests";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

describe("the detector goes red on the class it exists to catch", () => {
  it("FALSIFIER: a deliberately-introduced ambient-time test is detected", () => {
    // This is the shape that broke six PRs: an in-memory test sequenced by a real delay.
    const deliberate = `
      import { test, expect } from "bun:test";
      test("looks fine, is not", async () => {
        let done = false;
        queueMicrotask(() => { done = true; });
        await new Promise((r) => setTimeout(r, 50));
        expect(done).toBe(true);
      });
    `;
    const hits = scanSource(deliberate);
    expect(hits.length).toBe(1);
    expect(hits[0]!.callee).toBe("setTimeout");
    expect(hits[0]!.delay).toBe("50");
  });

  it("FALSIFIER: Bun.sleep with a non-zero argument is detected", () => {
    const hits = scanSource(`await Bun.sleep(300);`);
    expect(hits.length).toBe(1);
    expect(hits[0]!.callee).toBe("Bun.sleep");
  });

  it("FALSIFIER: setInterval with a non-zero period is detected", () => {
    const hits = scanSource(`const h = setInterval(tick, 25);`);
    expect(hits.length).toBe(1);
    expect(hits[0]!.callee).toBe("setInterval");
  });

  it("FALSIFIER: a non-literal delay is detected, because a variable is not a zero", () => {
    // `sleep(ms)` helpers hide behind a parameter. The audit refuses to assume it is zero.
    const hits = scanSource(`const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));`);
    expect(hits.length).toBe(1);
    expect(hits[0]!.delay).toBe("ms");
  });

  it("FALSIFIER: the delay hidden behind a nested call with its own commas is still found", () => {
    // The reason this is a paren-balancing scanner and not a regex. A regex taking the text
    // up to the first comma reads the delay here as `() => f(x` and cannot judge it.
    const hits = scanSource(`setTimeout(() => f(x, 1), 50);`);
    expect(hits.length).toBe(1);
    expect(hits[0]!.delay).toBe("50");
  });

  it("a commented-out wall clock is still a wall clock waiting to return", () => {
    // Deliberate, and the same choice DeterminismLint.Tests.fs makes for src/Core: comments
    // are scanned. Prose in this repo therefore says "a `setTimeout` of 50ms", never the call.
    const hits = scanSource(`// await new Promise((r) => setTimeout(r, 50));`);
    expect(hits.length).toBe(1);
  });
});

describe("the detector does NOT fire on the correct patterns", () => {
  it("a zero-delay yield is allowed -- it is deterministic in TURNS", () => {
    expect(scanSource(`await new Promise((r) => setTimeout(r, 0));`)).toEqual([]);
    expect(scanSource(`setTimeout(resolve, 0);`)).toEqual([]);
  });

  it("an omitted delay is a yield, not a delay", () => {
    expect(scanSource(`setTimeout(() => { done = true; });`)).toEqual([]);
  });

  it("an INJECTED fake scheduler is the model answer, not the defect", () => {
    // discovery/* already does this. Property syntax is not a call.
    const injected = `
      const scheduler = {
        setInterval: (ms: number, fn: () => void) => { fired.push(ms); return () => {}; },
        setTimeout: (fn: () => void, ms: number) => { fn(); return 1; },
      };
    `;
    expect(scanSource(injected)).toEqual([]);
  });

  it("a regex that merely MENTIONS the identifier is not a call", () => {
    expect(scanSource(`expect(doc).not.toMatch(/setInterval|requestAnimationFrame/u);`)).toEqual([]);
  });

  it("a longer identifier that happens to end in the callee name is not the callee", () => {
    expect(scanSource(`mySetTimeout(fn, 50); wrapped.setTimeout(fn, 50);`)).toEqual([]);
  });
});

describe("unit: the argument splitter", () => {
  it("balances nested parens, brackets and braces", () => {
    const src = `f(a, g(b, c), [d, e], { k: v }, 9)`;
    const args = splitArgs(src, src.indexOf("("));
    expect(args?.length).toBe(5);
    expect(args?.[4]?.trim()).toBe("9");
  });

  it("does not split on a comma inside a string", () => {
    const src = `f("a,b", 3)`;
    const args = splitArgs(src, src.indexOf("("));
    expect(args?.length).toBe(2);
    expect(args?.[1]?.trim()).toBe("3");
  });

  it("returns null rather than guessing when the call is unbalanced", () => {
    expect(splitArgs("f(a, b", 1)).toBeNull();
  });

  it("only the literal zero counts as a zero", () => {
    expect(isZeroDelay("0")).toBe(true);
    expect(isZeroDelay(" 0 ")).toBe(true);
    expect(isZeroDelay("0.0")).toBe(true);
    expect(isZeroDelay("ZERO")).toBe(false);
    expect(isZeroDelay("0 + 50")).toBe(false);
    expect(isZeroDelay(undefined)).toBe(false);
  });
});

// ---- the ratchet, which is the half an allowlist usually gets wrong --------------------

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "ambient-time-audit-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

describe("the allowlist is a ratchet and cannot silently swallow a new violation", () => {
  const ONE = `await new Promise((r) => setTimeout(r, 50));\n`;
  const TWO = ONE + `await new Promise((r) => setTimeout(r, 10));\n`;

  it("an unallowlisted violation fails", () => {
    const dir = fixture({ "a/x.test.ts": ONE });
    try {
      const r = audit(dir, []);
      expect(r.unallowed.length).toBe(1);
      expect(r.unallowed[0]!.path).toBe("a/x.test.ts");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an allowlisted violation at the pinned count passes", () => {
    const dir = fixture({ "a/x.test.ts": ONE });
    try {
      const r = audit(dir, [{ path: "a/x.test.ts", callee: "setTimeout", count: 1, reason: "x".repeat(40) }]);
      expect(r.unallowed).toEqual([]);
      expect(r.countDrift).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("THE POINT: a SECOND violation hiding behind a justified one fails on the count pin", () => {
    // This is the failure mode a plain path-allowlist -- and every inline `// nosemgrep` or
    // `// eslint-disable-next-line` -- reports as green. It is the reason this check is a
    // registry file and not a Semgrep rule.
    const dir = fixture({ "a/x.test.ts": TWO });
    try {
      const r = audit(dir, [{ path: "a/x.test.ts", callee: "setTimeout", count: 1, reason: "x".repeat(40) }]);
      expect(r.unallowed).toEqual([]); // the PATH is allowed...
      expect(r.countDrift.length).toBe(1); // ...and it still fails.
      expect(r.countDrift[0]).toContain("occurs 2 time(s), the allowlist pins 1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the ratchet bites in the OTHER direction too: a stale row fails", () => {
    // A row that has stopped constraining anything is not harmless -- it is an exemption
    // nobody has to argue for, waiting for the next violation to reuse it.
    const dir = fixture({ "a/x.test.ts": ONE });
    try {
      const r = audit(dir, [{ path: "a/x.test.ts", callee: "setTimeout", count: 2, reason: "x".repeat(40) }]);
      expect(r.countDrift.length).toBe(1);
      expect(r.countDrift[0]).toContain("stale row");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a row naming a file that no longer exists fails", () => {
    const dir = fixture({ "a/x.test.ts": ONE });
    try {
      const r = audit(dir, [
        { path: "a/x.test.ts", callee: "setTimeout", count: 1, reason: "x".repeat(40) },
        { path: "a/gone.test.ts", callee: "setTimeout", count: 1, reason: "x".repeat(40) },
      ]);
      expect(r.deadRows.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a row with no real reason is refused at load time", () => {
    const dir = fixture({ "registry/wall-clock-test-allowlist.json": JSON.stringify([{ path: "a", callee: "setTimeout", count: 1, reason: "because" }]) });
    try {
      expect(() => loadAllowlist(dir)).toThrow(/at least 40 characters/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a missing registry refuses to pass rather than defaulting to empty", () => {
    const dir = fixture({ "a/x.test.ts": ONE });
    try {
      expect(() => loadAllowlist(dir)).toThrow(/is missing/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the live tree", () => {
  // ONE SCAN, IN A HOOK WITH A DECLARED BUDGET -- not two scans inside two 5,000 ms tests.
  //
  // Both assertions below are about the same tree at the same instant, so scanning it twice
  // bought nothing and put the cost inside the assertions. bun's per-test cap is 5,000 ms,
  // never declared (`bunfig.toml` explains at length that its `[test] timeout` key is inert),
  // and a breach is reported by the test's NAME:
  //
  //     (fail) main is clean: every wall-clock in a test file is named and counted
  //
  // -- which reads as "the tree is dirty" and sends a reader looking for an unnamed clock
  // that does not exist. MEASURED 2026-08-22: this file timed out at exactly that line on the
  // fleet's machine while CI passed the same assertion on the same commit in 89 ms. The cause
  // is the host -- Microsoft Defender real-time protection authorises every file open per
  // (process, file), so the first pass over the tracked tree in a fresh process costs ~17.5 s
  // there and ~350 ms thereafter. Nothing in the tree was wrong.
  //
  // The budget is 120,000 ms, inherited from `lint-no-culture-sensitive-collation.test.ts`
  // for the same whole-tree class rather than tuned to a host. A machine slow enough to
  // breach it still fails -- reported honestly as a slow hook, not as a dirty tree.
  let live: ReturnType<typeof audit>;
  beforeAll(() => {
    live = audit(repoRoot, loadAllowlist(repoRoot));
  }, 120_000);

  it("main is clean: every wall-clock in a test file is named and counted", () => {
    expect(live.unallowed).toEqual([]);
    expect(live.countDrift).toEqual([]);
    expect(live.deadRows).toEqual([]);
  });

  it("LIVENESS: the scan actually reached the tree", () => {
    // "Checked 0 files" must never read as success. If this number collapses, the enumeration
    // broke and every other assertion in this file became vacuous at the same instant.
    expect(live.scannedFiles).toBeGreaterThan(500);
  });

  it("every allowlist row carries a reason a reviewer could refuse", () => {
    for (const row of loadAllowlist(repoRoot)) {
      expect(row.reason.trim().length).toBeGreaterThanOrEqual(40);
      expect(row.count).toBeGreaterThanOrEqual(1);
    }
    expect(ALLOWLIST_PATH).toBe("registry/wall-clock-test-allowlist.json");
  });
});
