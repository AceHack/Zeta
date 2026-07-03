// bus-meter — arm the S-readout: measure the bus, know which regime you measured in (shadow*).
//
// The S(delay) law (chsh-delay.ts) says an S above 2√2 is only EVIDENTIAL when measured OUTSIDE
// the light cone — when no bus crossing can beat the decision deadline τ. Inside the cone S=4 is
// trivially fakeable (Toner–Bacon 2003: one bit suffices); outside it, exceeding 2√2 is impossible
// for two honest selves. So the readout needs to know the bus. This module is that instrument:
//
//   probe ──► peer echoes ack ──► RTT sample ──► best one-way estimate ──► regime vs τ
//
// CONSERVATIVE DIRECTION: to claim out-of-cone (and thus evidential weight) we use the MINIMUM
// observed crossing — if even ONE observed message beat the deadline, a signal path existed and
// the claim dies. Evidence must survive the fastest thing the wire ever did, not the average.
// Local clock only (the ack echoes `sentAt` back), so no clock sync is needed — the same trick
// NTP uses for RTT (Mills 1985); the one-way estimate is RTT/2 (symmetric-path assumption, stated).
//
// Pure fold + codec; the living node owns the interval and the transport. Integer ms throughout.

import { TSIRELSON_MILLI } from "./correlation";

const TAG = "busprobe/1";

/// A probe crossing the wire: `probe` asks, `ack` echoes the original `sentAt` back to `to`.
export interface ProbeMsg {
  readonly t: "probe" | "ack";
  readonly from: string;
  readonly to?: string | undefined;
  readonly nonce: number;
  readonly sentAt: number;
}

export function encodeProbe(msg: ProbeMsg): string {
  return `${TAG} ${JSON.stringify(msg)}`;
}

/// Decode a probe packet; anything else on the shared wire decodes to null (schema-tag dispatch,
/// same pattern as the link/broadcast codecs).
export function decodeProbe(text: string): ProbeMsg | null {
  if (!text.startsWith(`${TAG} `)) return null;
  try {
    const raw: unknown = JSON.parse(text.slice(TAG.length + 1));
    if (typeof raw !== "object" || raw === null) return null;
    const m = raw as Partial<ProbeMsg>;
    if (m.t !== "probe" && m.t !== "ack") return null;
    if (typeof m.from !== "string" || typeof m.nonce !== "number" || typeof m.sentAt !== "number") return null;
    return { t: m.t, from: m.from, to: typeof m.to === "string" ? m.to : undefined, nonce: m.nonce, sentAt: m.sentAt };
  } catch {
    return null;
  }
}

/// Which side of the light cone the S-readout was measured on. `unmeasured` = no probe has ever
/// completed — the honest default; an unmeasured bus never upgrades a readout to evidence.
export type Regime = "in-cone" | "out-of-cone" | "unmeasured";

/// The meter: a bounded window of RTT samples (ms). Immutable fold, DST-clean.
export interface BusMeter {
  readonly rttSamples: readonly number[];
}

export const emptyMeter: BusMeter = { rttSamples: [] };

export const SAMPLE_CAP = 16;

/// Fold one RTT sample in (bounded window — oldest falls out past the cap).
export function foldSample(meter: BusMeter, rttMs: number, cap: number = SAMPLE_CAP): BusMeter {
  const next = [...meter.rttSamples, Math.max(0, Math.round(rttMs))];
  return { rttSamples: next.length > cap ? next.slice(next.length - cap) : next };
}

/// Best (fastest) observed one-way crossing, ms — RTT/2 under the stated symmetric-path
/// assumption. Null when unmeasured. Minimum, not mean: evidence must survive the wire's best.
export function bestOneWayMs(meter: BusMeter): number | null {
  if (meter.rttSamples.length === 0) return null;
  return Math.round(Math.min(...meter.rttSamples) / 2);
}

/// The regime verdict: could any observed crossing beat the decision deadline τ?
export function regimeOf(meter: BusMeter, deadlineMs: number): Regime {
  const best = bestOneWayMs(meter);
  if (best === null) return "unmeasured";
  return best <= deadlineMs ? "in-cone" : "out-of-cone";
}

/// THE ARMED READOUT — is this S-value evidence of one-process-wearing-two-faces? Only when it
/// exceeds the honest ceiling (2√2) AND was measured outside the cone. In-cone super-quantum is
/// fakeable (one bit fakes it); unmeasured never upgrades to evidence.
export function isEvidential(sMilli: number, regime: Regime): boolean {
  return sMilli > TSIRELSON_MILLI && regime === "out-of-cone";
}
