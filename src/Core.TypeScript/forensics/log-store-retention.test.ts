import { describe, expect, test } from "bun:test";

import {
  captureCost,
  computeBlackout,
  humanBytes,
  retentionHours,
  ringFillRateBytesPerSecond,
} from "./log-store-retention.ts";

describe("computeBlackout — the 23.6 seconds no archive can recover", () => {
  /**
   * All three numbers measured on AceHacks-Mac-Studio for the 2026-08-24 08:17
   * crash. The last persisted log line came from the Persist ring; the panic
   * from NVRAM panicmedic; the boot from `sysctl kern.boottime`.
   */
  const REAL = {
    lastPersistedMs: Date.parse("2026-08-24T12:16:36.000Z"),
    panicMs: Date.parse("2026-08-24T12:16:59.664Z"),
    bootMs: Date.parse("2026-08-24T12:17:16.285Z"),
  };

  test("reproduces the measured blackout and downtime", () => {
    const b = computeBlackout(REAL);
    expect(b.coherent).toBe(true);
    expect(b.unloggedSeconds).toBeCloseTo(23.664, 2);
    expect(b.downSeconds).toBeCloseTo(16.621, 2);
  });

  test("the blackout is LONGER than the downtime — the machine spent more time dying than rebooting", () => {
    const b = computeBlackout(REAL);
    expect(b.unloggedSeconds).toBeGreaterThan(b.downSeconds);
  });

  test("a panic before the last log line is INCOHERENT, not a small negative number", () => {
    const b = computeBlackout({
      lastPersistedMs: REAL.panicMs + 5000,
      panicMs: REAL.panicMs,
      bootMs: REAL.bootMs,
    });
    expect(b.coherent).toBe(false);
  });

  test("a boot before the panic is INCOHERENT too", () => {
    const b = computeBlackout({
      lastPersistedMs: REAL.lastPersistedMs,
      panicMs: REAL.panicMs,
      bootMs: REAL.panicMs - 1,
    });
    expect(b.coherent).toBe(false);
  });
});

describe("retention — the window shrinks exactly when you need it", () => {
  /** The ring as observed at 08:31 on 2026-08-24: 55 files, 509 MB. */
  const idleSpan = { ringBytes: 509 * 1024 * 1024, fileCount: 55, spanSeconds: 14.48 * 3600 };
  /** The same ring measured over the loaded window only (05:45 -> 08:31). */
  const loadedSpan = { ringBytes: 509 * 1024 * 1024, fileCount: 55, spanSeconds: 3.9 * 3600 };

  test("idle retention is ~14 h, loaded retention is ~4 h", () => {
    expect(retentionHours(idleSpan)).toBeCloseTo(14.48, 1);
    expect(retentionHours(loadedSpan)).toBeCloseTo(3.9, 1);
  });

  test("load roughly triples the fill rate", () => {
    const idle = ringFillRateBytesPerSecond(idleSpan) ?? 0;
    const loaded = ringFillRateBytesPerSecond(loadedSpan) ?? 0;
    expect(loaded / idle).toBeGreaterThan(3);
  });

  test("an idle sample yields null, never Infinity — 'unbounded' is a claim it cannot make", () => {
    expect(retentionHours({ ringBytes: 0, fileCount: 0, spanSeconds: 0 })).toBeNull();
    expect(ringFillRateBytesPerSecond({ ringBytes: 1, fileCount: 1, spanSeconds: 0 })).toBeNull();
  });

  test("the four-hour figure is why an investigation 'hours later' finds nothing", () => {
    const hours = retentionHours(loadedSpan) ?? 0;
    // The 08:17 crash was investigated at ~08:30 (inside the window, evidence
    // present) and the 21:35 crash was looked at the next morning (outside it).
    expect(hours).toBeLessThan(11);
  });
});

describe("captureCost — the bill, stated before installation", () => {
  const c = captureCost({
    vitalsLineBytes: 420,
    vitalsHz: 1,
    archiveBytesDeduped: 90 * 1024 * 1024,
    archivesPerDay: 4,
    errorRingBytes: 64 * 1024 * 1024,
    snapshotBytes: 512 * 1024,
    snapshotsPerDay: 96,
  });

  test("vitals at 1 Hz is tens of megabytes a day, not gigabytes", () => {
    expect(c.vitalsBytesPerDay).toBe(420 * 86400);
    expect(c.vitalsBytesPerDay / (1024 * 1024)).toBeLessThan(40);
  });

  test("archives dominate the growing cost", () => {
    expect(c.archiveBytesPerDay).toBeGreaterThan(c.vitalsBytesPerDay);
    expect(c.archiveBytesPerDay).toBeGreaterThan(c.snapshotBytesPerDay);
  });

  test("the error ring is a CEILING, so it does not appear in the per-day figure", () => {
    expect(c.growingBytesPerDay).toBe(
      c.vitalsBytesPerDay + c.archiveBytesPerDay + c.snapshotBytesPerDay,
    );
    expect(c.steadyStateBytes(0)).toBe(c.errorRingBytesFixed);
  });

  test("seven days of retention stays comfortably inside 5 GB", () => {
    expect(c.steadyStateBytes(7)).toBeLessThan(5 * 1024 * 1024 * 1024);
  });

  test("MUTANT: an undeduplicated archive blows the budget", () => {
    // 524 MB per archive is what `log collect` writes before the symbol
    // catalog is cloned away. Four a day for a week is over 14 GB.
    const naive = captureCost({
      vitalsLineBytes: 420,
      vitalsHz: 1,
      archiveBytesDeduped: 524 * 1024 * 1024,
      archivesPerDay: 4,
      errorRingBytes: 64 * 1024 * 1024,
      snapshotBytes: 512 * 1024,
      snapshotsPerDay: 96,
    });
    expect(naive.steadyStateBytes(7)).toBeGreaterThan(14 * 1024 * 1024 * 1024);
    expect(naive.steadyStateBytes(7) / c.steadyStateBytes(7)).toBeGreaterThan(4);
  });
});

describe("humanBytes", () => {
  test("renders at sensible precision", () => {
    expect(humanBytes(1024)).toBe("1.00KB");
    expect(humanBytes(524 * 1024 * 1024)).toBe("524.0MB");
    expect(humanBytes(0)).toBe("0.00B");
  });
});
