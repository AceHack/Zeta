#!/usr/bin/env bun
/**
 * log-store-retention.ts — how much of the unified log survives a crash, for
 * how long, and the hole no post-hoc tool can fill.
 *
 * THE TWO MEASUREMENTS THIS MODULE EXISTS TO CARRY
 * ---------------------------------------------------------------------------
 *
 * **1. The blackout.** macOS's `logd` buffers in memory and flushes to
 * `/var/db/diagnostics/Persist/*.tracev3` periodically. Whatever has not been
 * flushed when the machine dies is gone — it never reached a disk. Measured on
 * `AceHacks-Mac-Studio` for the 2026-08-24 08:17 crash:
 *
 *     last persisted log line   2026-08-24 08:16:36
 *     panic (NVRAM panicmedic)  2026-08-24 08:16:59.664
 *     next boot (kern.boottime) 2026-08-24 08:17:16
 *                               -------------------------
 *     BLACKOUT                  23.6 seconds, unrecoverable
 *
 * The same shape at the 07:40 crash: last line `07:39:37`, boot `07:41`.
 *
 * This is the result that decides the design. `log collect` run at boot DOES
 * recover the previous boot's log — that part of the brief's premise is
 * CONFIRMED, and the store is world-readable so it needs no `sudo` — but it
 * recovers it only up to the last flush. The final ~20-30 seconds, which is
 * precisely the interval in which the machine was dying, is not in any archive
 * because it was never written. No amount of collecting fixes that. The only
 * way to have those seconds is to have written them yourself, durably, while
 * they were happening. That is what the vitals heartbeat does.
 *
 * **2. The ring.** `Persist/` is a fixed-size ring (509 MB, 55 files, ~10 MB
 * each on this machine). Files roll faster under load, so the retention window
 * SHRINKS exactly when the machine is in the state you want to investigate:
 *
 *     overnight/idle    ~3.8 files/hour     ->  ~14 h of history
 *     under agent load  ~13 files/hour      ->  ~3.9 h of history
 *
 * A crash investigated four hours later is a crash whose evidence has already
 * been overwritten by the investigation's own machine. That is the mechanism
 * behind "the unified log store is EMPTY for the pre-reboot windows" — the
 * store was not empty, it had rolled.
 *
 * PURE. Every function here takes numbers and returns numbers, so all of the
 * above is checkable without a reboot.
 */

export interface RingObservation {
  /** Total bytes the Persist ring is holding. */
  readonly ringBytes: number;
  /** Number of .tracev3 files in the ring. */
  readonly fileCount: number;
  /** Wall-clock seconds between the oldest and newest file mtime. */
  readonly spanSeconds: number;
}

/**
 * Bytes per second the log store is currently accumulating. This is the number
 * that determines how long you have to investigate.
 */
export function ringFillRateBytesPerSecond(o: RingObservation): number | null {
  if (o.spanSeconds <= 0) return null;
  return o.ringBytes / o.spanSeconds;
}

/**
 * Hours of history the ring will hold at the observed fill rate. Returns null
 * rather than Infinity when nothing is being written — "unbounded" is a claim
 * this cannot make from an idle sample.
 */
export function retentionHours(o: RingObservation): number | null {
  const rate = ringFillRateBytesPerSecond(o);
  if (rate === null || rate <= 0) return null;
  return o.ringBytes / rate / 3600;
}

export interface BlackoutInput {
  /** Epoch ms of the last log line that reached disk. */
  readonly lastPersistedMs: number;
  /** Epoch ms of the panic, from NVRAM panicmedic. */
  readonly panicMs: number;
  /** Epoch ms of the boot that followed, from `kern.boottime`. */
  readonly bootMs: number;
}

export interface Blackout {
  /** Seconds of machine-alive time whose log never reached disk. */
  readonly unloggedSeconds: number;
  /** Seconds the machine was down (panic -> boot). */
  readonly downSeconds: number;
  /**
   * False when the panic timestamp precedes the last persisted line, which
   * means the decode or the clock is wrong and the numbers must not be used.
   */
  readonly coherent: boolean;
}

export function computeBlackout(i: BlackoutInput): Blackout {
  const unloggedSeconds = (i.panicMs - i.lastPersistedMs) / 1000;
  const downSeconds = (i.bootMs - i.panicMs) / 1000;
  return {
    unloggedSeconds,
    downSeconds,
    // Both must be non-negative in a coherent account: the machine cannot
    // panic before its last log line, nor boot before it panicked. A negative
    // value is a decode error wearing a plausible number, and reporting it as
    // a measurement is the failure this repo is built against.
    coherent: unloggedSeconds >= 0 && downSeconds >= 0,
  };
}

export interface CaptureCostInput {
  /** Bytes one vitals line occupies, including the newline. */
  readonly vitalsLineBytes: number;
  /** Vitals samples per second. */
  readonly vitalsHz: number;
  /** Bytes of a single .logarchive AFTER symbol-catalog deduplication. */
  readonly archiveBytesDeduped: number;
  /** Archives captured per day. */
  readonly archivesPerDay: number;
  /** Fixed bytes held by the bounded error-log ring. */
  readonly errorRingBytes: number;
  /** Bytes of one slow-probe snapshot, compressed. */
  readonly snapshotBytes: number;
  /** Snapshots per day. */
  readonly snapshotsPerDay: number;
}

export interface CaptureCost {
  readonly vitalsBytesPerDay: number;
  readonly archiveBytesPerDay: number;
  readonly snapshotBytesPerDay: number;
  /** Not per-day: a ceiling the ring never exceeds. */
  readonly errorRingBytesFixed: number;
  readonly growingBytesPerDay: number;
  /** Steady-state total at `retentionDays`, including the fixed ring. */
  steadyStateBytes(retentionDays: number): number;
}

/**
 * The disk bill, stated before the harness is installed rather than discovered
 * after. A capture whose cost was never estimated is not one this role ships.
 */
export function captureCost(i: CaptureCostInput): CaptureCost {
  const vitalsBytesPerDay = i.vitalsLineBytes * i.vitalsHz * 86400;
  const archiveBytesPerDay = i.archiveBytesDeduped * i.archivesPerDay;
  const snapshotBytesPerDay = i.snapshotBytes * i.snapshotsPerDay;
  const growingBytesPerDay = vitalsBytesPerDay + archiveBytesPerDay + snapshotBytesPerDay;
  return {
    vitalsBytesPerDay,
    archiveBytesPerDay,
    snapshotBytesPerDay,
    errorRingBytesFixed: i.errorRingBytes,
    growingBytesPerDay,
    steadyStateBytes(retentionDays: number): number {
      return growingBytesPerDay * retentionDays + i.errorRingBytes;
    },
  };
}

/** Render a byte count the way a cost estimate should read. */
export function humanBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.abs(n);
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const sign = n < 0 ? "-" : "";
  return `${sign}${v < 10 ? v.toFixed(2) : v.toFixed(1)}${units[u]}`;
}
