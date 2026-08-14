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
};

const THRESHOLD: CheckResult = {
  totalShards: 7,
  minObsCount: 5,
  thresholdHit: true,
  gapMinutes: 3,
  gapHit: false,
};

const GAP: CheckResult = {
  totalShards: 7,
  minObsCount: 1,
  thresholdHit: false,
  gapMinutes: 40,
  gapHit: true,
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
    expect(fires).toBeGreaterThanOrEqual(0);
    expect(fires).toBeLessThanOrEqual(windows);
    // Recorded so a future reader does not have to re-derive it. This is a
    // measurement, not a gate: we do not assert the rate is below a number
    // nobody calibrated. Arming --enforce as a required check is a later
    // call that uses this number.
    const rate = fires / windows;
    console.log(
      `[no-op-cadence calibration] May 2026 18:00Z windows=${String(windows)} fires=${String(fires)} rate=${rate.toFixed(3)}`,
    );
  });
});
