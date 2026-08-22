/**
 * Tests for check-no-op-cadence-pattern.ts — 081M0085XQT087G0R003W4KFS4.
 *
 * Until this file existed the detector computed the right answer and threw
 * it away (`return 0` on every path). These tests are the falsifier: a
 * planted detecting history must make `--enforce` exit 1, a healthy history
 * must not, and advisory mode must stay 0 either way.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detected,
  exitStatus,
  isMinimalObservation,
  measureThresholdFires,
  parseCli,
  runCheck,
  type CheckArgs,
  type CheckResult,
} from "./check-no-op-cadence-pattern";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

const DEFAULTS: Omit<CheckArgs, "now"> = {
  windowSize: 7,
  threshold: 5,
  gapThresholdMinutes: 15,
};

const CLEAN: CheckResult = {
  totalShards: 7,
  minObsCount: 1,
  thresholdHit: false,
  gapMinutes: 3,
  gapHit: false,
  surfaceEmpty: false,
};

const THRESHOLD: CheckResult = {
  totalShards: 7,
  minObsCount: 5,
  thresholdHit: true,
  gapMinutes: 3,
  gapHit: false,
  surfaceEmpty: false,
};

const GAP: CheckResult = {
  totalShards: 7,
  minObsCount: 1,
  thresholdHit: false,
  gapMinutes: 40,
  gapHit: true,
  surfaceEmpty: false,
};

/** The live production state as of 2026-08-14: the input surface is gone. */
const SURFACE_EMPTY: CheckResult = {
  totalShards: 0,
  minObsCount: 0,
  thresholdHit: false,
  gapMinutes: null,
  gapHit: false,
  surfaceEmpty: true,
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pipeRow(body: string): string {
  return `| 2026-08-14T12:00:00Z | grok / test | deadbeef | ${body} | extra |\n`;
}

function plant(
  root: string,
  day: string,
  hourMinute: string,
  body: string,
): void {
  const yyyy = day.slice(0, 4);
  const mm = day.slice(4, 6);
  const dd = day.slice(6, 8);
  const dir = join(root, "docs/hygiene-history/ticks", yyyy, mm, dd);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${hourMinute}Z.md`), pipeRow(body), "utf8");
}

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "no-op-cadence-"));
}

const LONG_BODY = "x".repeat(700);
const SHORT_BODY = "quiet.";

describe("parseCli", () => {
  test("no flags is advisory", () => {
    expect(parseCli([])).toEqual({ kind: "run", enforce: false });
  });

  test("recognises --enforce", () => {
    expect(parseCli(["--enforce"])).toEqual({ kind: "run", enforce: true });
  });

  test("recognises --help", () => {
    expect(parseCli(["--help"]).kind).toBe("help");
    expect(parseCli(["-h"]).kind).toBe("help");
  });

  test("MUTATION: a mistyped flag is an error, not silent advisory", () => {
    // If unknown args are ignored, `--enforec` would drop back to exit 0
    // and the original defect would return in argv form.
    const parsed = parseCli(["--enforec"]);
    expect(parsed.kind).toBe("error");
  });
});

describe("exitStatus — the check must be able to fail", () => {
  test("advisory mode is 0 on a clean result AND on a detection", () => {
    expect(exitStatus(CLEAN, false)).toBe(0);
    expect(exitStatus(THRESHOLD, false)).toBe(0);
    expect(exitStatus(GAP, false)).toBe(0);
  });

  test("MUTATION: --enforce + threshold detection is 1", () => {
    // If this ever returns 0 the detector has gone back to throwing the
    // answer away. That is the original defect.
    expect(exitStatus(THRESHOLD, true)).toBe(1);
    expect(detected(THRESHOLD)).toBe(true);
  });

  test("MUTATION: --enforce + gap detection is 1", () => {
    expect(exitStatus(GAP, true)).toBe(1);
    expect(detected(GAP)).toBe(true);
  });

  test("MUTATION: --enforce + a healthy window is still 0", () => {
    expect(exitStatus(CLEAN, true)).toBe(0);
    expect(detected(CLEAN)).toBe(false);
  });

  test("MUTATION: --enforce on an ABSENT input surface is 1, not 0", () => {
    // This is the live production state: docs/hygiene-history/ticks/ has had
    // no shard since 2026-05-29, so runCheck judges nothing. Before this,
    // that exited 0 and was indistinguishable from a clean bill of health.
    // Drop `|| result.surfaceEmpty` from exitStatus and this goes red.
    expect(exitStatus(SURFACE_EMPTY, true)).toBe(1);
    // It is NOT a "detection" — nothing was detected, the check could not run.
    expect(detected(SURFACE_EMPTY)).toBe(false);
  });

  test("advisory mode stays 0 even on an absent surface", () => {
    expect(exitStatus(SURFACE_EMPTY, false)).toBe(0);
  });
});

describe("the parse mismatch that produced the 60.4% false-positive rate", () => {
  test("MUTATION: a heading-format shard with real content is NOT minimal", () => {
    // 488 of 1209 real shards (40.4%) begin with `# Tick shard …`, so
    // `firstLine.split("|")[4]` was undefined -> "" -> length 0 < 600 ->
    // forced MINIMAL. Their median size is 3843 bytes. Restore the old
    // pipe-cell rule and this test goes red.
    const root = scratch();
    try {
      const dir = join(root, "docs/hygiene-history/ticks/2026/08/14");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "1200Z.md"),
        `# Tick shard 2026-08-14T12:00Z -- substrate cluster + razor extension\n\n${"real substantive tick content. ".repeat(120)}`,
        "utf8",
      );
      expect(isMinimalObservation(join(dir, "1200Z.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a heading-format shard that is genuinely near-empty IS minimal", () => {
    // The repair must not simply exempt heading-format shards — an empty one
    // still counts. This is the sensitivity half of the same change.
    const root = scratch();
    try {
      const dir = join(root, "docs/hygiene-history/ticks/2026/08/14");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "1300Z.md"), "# Tick shard\n\nQuiet.\n", "utf8");
      expect(isMinimalObservation(join(dir, "1300Z.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("MUTATION: explicit minimal-observation language is caught at any size", () => {
    // Delete the regex arm and this goes red. A large shard that SAYS it is
    // a minimal observation is the one signal the detector can honestly claim.
    const root = scratch();
    try {
      const dir = join(root, "docs/hygiene-history/ticks/2026/08/14");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "1400Z.md"),
        `# Tick shard\n\n${"padding ".repeat(300)}\nminimal observation — within-basin, nothing actionable.\n`,
        "utf8",
      );
      expect(isMinimalObservation(join(dir, "1400Z.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("MUTATION: the content floor is reachable, i.e. not a dead threshold", () => {
    // Guards against "made unreachable" — the floor must actually decide
    // something. Same file, floors either side of its length.
    const root = scratch();
    try {
      const dir = join(root, "docs/hygiene-history/ticks/2026/08/14");
      mkdirSync(dir, { recursive: true });
      const p = join(dir, "1500Z.md");
      writeFileSync(p, `# Tick shard\n\n${"x".repeat(500)}`, "utf8");
      expect(isMinimalObservation(p, 100)).toBe(false);
      expect(isMinimalObservation(p, 5000)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("runCheck reports an absent surface rather than a pass", () => {
  test("an empty repo yields surfaceEmpty, and --enforce fails on it", () => {
    const root = scratch();
    try {
      const result = runCheck(root, {
        ...DEFAULTS,
        now: new Date("2026-08-14T16:00:00Z"),
      });
      expect(result.surfaceEmpty).toBe(true);
      expect(result.totalShards).toBe(0);
      expect(exitStatus(result, true)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a populated window is NOT surfaceEmpty", () => {
    const root = scratch();
    try {
      plant(root, "20260814", "1600", LONG_BODY);
      const result = runCheck(root, {
        ...DEFAULTS,
        now: new Date("2026-08-14T16:05:00Z"),
      });
      expect(result.surfaceEmpty).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("isMinimalObservation", () => {
  test("a short first-line body is minimal", () => {
    const root = scratch();
    try {
      plant(root, "20260814", "1200", SHORT_BODY);
      expect(isMinimalObservation(join(root, "docs/hygiene-history/ticks/2026/08/14/1200Z.md"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a long first-line body without the observation regex is not minimal", () => {
    const root = scratch();
    try {
      plant(root, "20260814", "1200", LONG_BODY);
      expect(isMinimalObservation(join(root, "docs/hygiene-history/ticks/2026/08/14/1200Z.md"))).toBe(
        false,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("planted tick history", () => {
  test("five short shards of seven trip the threshold, and --enforce fails", () => {
    const root = scratch();
    try {
      const hours = ["1000", "1100", "1200", "1300", "1400", "1500", "1600"];
      hours.forEach((hhmm, i) => {
        plant(root, "20260814", hhmm, i < 5 ? SHORT_BODY : LONG_BODY);
      });
      const result = runCheck(root, {
        ...DEFAULTS,
        now: new Date("2026-08-14T16:05:00Z"),
      });
      expect(result.totalShards).toBe(7);
      expect(result.minObsCount).toBe(5);
      expect(result.thresholdHit).toBe(true);
      expect(result.gapHit).toBe(false);
      expect(exitStatus(result, true)).toBe(1);
      expect(exitStatus(result, false)).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("seven long recent shards do not trip either heuristic", () => {
    const root = scratch();
    try {
      for (const hhmm of ["1000", "1100", "1200", "1300", "1400", "1500", "1600"]) {
        plant(root, "20260814", hhmm, LONG_BODY);
      }
      const result = runCheck(root, {
        ...DEFAULTS,
        now: new Date("2026-08-14T16:05:00Z"),
      });
      expect(result.totalShards).toBe(7);
      expect(result.minObsCount).toBe(0);
      expect(result.thresholdHit).toBe(false);
      expect(result.gapHit).toBe(false);
      expect(exitStatus(result, true)).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a single old shard trips the gap heuristic", () => {
    const root = scratch();
    try {
      plant(root, "20260814", "1000", LONG_BODY);
      const result = runCheck(root, {
        ...DEFAULTS,
        now: new Date("2026-08-14T16:00:00Z"),
      });
      expect(result.totalShards).toBe(1);
      expect(result.gapMinutes).toBe(360);
      expect(result.gapHit).toBe(true);
      expect(result.thresholdHit).toBe(false);
      expect(exitStatus(result, true)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("calibration against real hygiene-history ticks", () => {
  test("the default threshold fires on a measured fraction of May 2026 windows, and the sample is not vacuous", () => {
    // Sample 18:00Z on each day of May 2026 — a month with dense tick history.
    // Empty days are skipped, so the denominator is "windows the heuristic
    // actually judged", not calendar days.
    const sampleNows: Date[] = [];
    for (let day = 1; day <= 31; day += 1) {
      sampleNows.push(new Date(`2026-05-${pad2(day)}T18:00:00Z`));
    }
    const { windows, fires } = measureThresholdFires(REPO_ROOT, sampleNows, DEFAULTS);
    // NON-VACUITY: a sample that found no shards is not a measurement.
    expect(windows).toBeGreaterThanOrEqual(10);
    expect(fires).toBeLessThanOrEqual(windows);
    const rate = fires / windows;
    console.log(
      `[no-op-cadence calibration] May 2026 18:00Z windows=${String(windows)} fires=${String(fires)} rate=${rate.toFixed(3)}`,
    );

    // MUTATION / REGRESSION GUARD. `expect(fires).toBeGreaterThanOrEqual(0)`
    // was the only assertion here and it is trivially true — it would have
    // passed at the measured 0.767 rate just as happily as at 0.000, so it
    // could not notice the parse mismatch it was meant to be calibrating.
    //
    // The bound below is a real falsifier: restore the old
    // `firstLine.split("|")[4] < 600` classifier and this window sample goes
    // back to 23/30 fires (0.767) and the test goes RED. 0.25 is deliberately
    // loose — it is a "the classifier has not reverted to flagging most of a
    // healthy month" guard, not a claim that 0.25 is an acceptable gate rate.
    expect(rate).toBeLessThan(0.25);
  });
});
