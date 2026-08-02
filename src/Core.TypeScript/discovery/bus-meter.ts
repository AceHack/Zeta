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
// CAVEAT (b) FIX — asymmetric-path budget deltaMaxMs (Option 3, 2026-08-02):
// min(RTT)/2 is unsound for asymmetric planetary orbits (Earth→Mars ≠ Mars→Earth by orbital
// phase). The conservative fix widens the cone: `out-of-cone` is only declared when
// bestOneWayMs > deadlineMs + deltaMaxMs. At deltaMaxMs=0 (terrestrial default) the behavior
// is identical to the old code. For a planetary deployment, supply the worst-case one-way
// asymmetry for the link (e.g., ~190 ms for Earth–Mars at opposition). Conservative direction:
// suppresses some true out-of-cone evidence rather than manufacturing false convictions.
// `regimeOf` now accepts an optional `deltaMaxMs` (default 0). `regimeOfTerrestrial` is the
// zero-delta convenience alias for all existing call sites.
//
// TRANSCENDENTAL-REFINEMENT POLICY — TSIRELSON_MILLI boundary (Lumen, 2026-08-02):
// TSIRELSON_MILLI = 2828 is a truncated integer approximation of 2√2 × 1000 = 2828.427...
// The boundary comparison in `isEvidential` uses the integer constant, which means S values
// in (2828, 2828.427...) milli are classified as superquantum by the integer but are actually
// at or below Tsirelson's exact bound. Policy decision (Lumen):
//   - The integer 2828 is the OPERATIONAL boundary for all integer-milli readouts. Since
//     the readout pipeline uses Math.round() throughout, no real S value can land in the
//     gap (2828, 2828.427...) after rounding — it rounds to either 2828 or 2829.
//   - The exact transcendental value 2*Math.sqrt(2)*1000 is exported as TSIRELSON_EXACT_MILLI
//     for use in continuous-domain comparisons (e.g., float-valued S from simulation).
//   - `isEvidential` and `classify` use the integer constant (operational boundary).
//   - `isEvidentialExact` uses the exact transcendental for simulation/test contexts.
// This is NOT a bug in the integer constant; it is a policy that the integer pipeline is
// the operational one and the exact value is the simulation/verification reference.
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
///
/// Note: This raw estimate is used internally. For regime decisions on asymmetric links,
/// use `regimeOf` with a non-zero `deltaMaxMs` (the caveat (b) budget).
export function bestOneWayMs(meter: BusMeter): number | null {
  if (meter.rttSamples.length === 0) return null;
  return Math.round(Math.min(...meter.rttSamples) / 2);
}

/// The regime verdict: could any observed crossing beat the decision deadline τ?
///
/// Caveat (b) fix (Option 3 — widen-cone-by-δ_max):
/// `out-of-cone` is only declared when `bestOneWayMs > deadlineMs + deltaMaxMs`.
/// At `deltaMaxMs = 0` (default) the behavior is identical to the old code.
/// For a planetary deployment, supply the worst-case one-way asymmetry for the link
/// (e.g., ~190 ms for Earth–Mars at opposition, ~29 ms for a typical Earth–Mars transit).
export function regimeOf(meter: BusMeter, deadlineMs: number, deltaMaxMs: number = 0): Regime {
  const best = bestOneWayMs(meter);
  if (best === null) return "unmeasured";
  // Widen the cone by deltaMaxMs: require best > deadline + deltaMaxMs to convict out-of-cone.
  // At deltaMaxMs = 0 this is identical to the old `best <= deadlineMs → in-cone`.
  return best <= deadlineMs + Math.max(0, deltaMaxMs) ? "in-cone" : "out-of-cone";
}

/// Convenience alias: `regimeOf` with `deltaMaxMs = 0` (terrestrial default, backward-compat).
/// Use this at all existing call sites — it preserves the old signature and semantics exactly.
export function regimeOfTerrestrial(meter: BusMeter, deadlineMs: number): Regime {
  return regimeOf(meter, deadlineMs, 0);
}

/// THE ARMED READOUT — is this S-value evidence of one-process-wearing-two-faces? Only when it
/// exceeds the honest ceiling (2√2) AND was measured outside the cone. In-cone super-quantum is
/// fakeable (one bit fakes it); unmeasured never upgrades to evidence.
///
/// Uses the integer TSIRELSON_MILLI = 2828 (the operational boundary for integer-milli readouts).
/// See TRANSCENDENTAL-REFINEMENT POLICY in the module header.
export function isEvidential(sMilli: number, regime: Regime): boolean {
  return sMilli > TSIRELSON_MILLI && regime === "out-of-cone";
}

/// Exact transcendental Tsirelson boundary: 2√2 × 1000 = 2828.427...
/// Use this for continuous-domain comparisons (simulation, float-valued S from quantum circuits).
/// For integer-milli readouts, use TSIRELSON_MILLI = 2828 (the operational boundary).
/// See TRANSCENDENTAL-REFINEMENT POLICY in the module header.
export const TSIRELSON_EXACT_MILLI: number = 2 * Math.sqrt(2) * 1000;

/// THE ARMED READOUT (exact transcendental boundary) — same as `isEvidential` but uses the
/// exact 2√2×1000 boundary instead of the integer 2828. Use in simulation/verification contexts
/// where S is a continuous float (e.g., from `BellTest.chshOf` or `BipartiteMachZehnder`).
export function isEvidentialExact(sMilli: number, regime: Regime): boolean {
  return sMilli > TSIRELSON_EXACT_MILLI && regime === "out-of-cone";
}
