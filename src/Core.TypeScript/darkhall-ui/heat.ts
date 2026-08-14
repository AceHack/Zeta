export type HeatSignal =
  | "forgotten"
  | "backpressure"
  | "denied"
  | "storage-error"
  | "invalid"
  | "expired"
  | "stale"
  | "other";

export const HEAT_READOUT_SCHEMA = "zeta.heat.readout.v1";
export const HEAT_RECEIPT_SCHEMA = "zeta.heat.receipt.v1";
export const TEMPERATURE_READOUT_SCHEMA = "zeta.temperature.readout.v1";
export const BLACK_BODY_READOUT_SCHEMA = "zeta.blackbody.readout.v1";
export const HEAT_SIGNAL_TREATY_PATH = "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json";
export const HEAT_SIGNAL_QSHARP_SOURCE = "src/Core.QSharp.ReferenceOracle/HeatSignals.qs";
export const HEAT_FSHARP_SURFACE = "src/Core/Heat.fs";
export const TEMPERATURE_REFERENCE_ORACLE = "fsharp-blackbody-reference";
export const MAX_TEMPERATURE_PPM = 1_000_000;
export const WARM_TEMPERATURE_MAX_PPM = 333_333;
export const HOT_TEMPERATURE_MAX_PPM = 666_666;

export type TemperatureBand = "cold" | "warm" | "hot" | "critical";

// ─────────────────────────────────────────────────────────────────────────────
// Encoder faithfulness — 081M00TYT8N087G0R003MPMRX9
//
// An encoder is a function `data -> channel`. It LIES when it is non-injective
// on its declared domain: two different data states produce the same reading and
// no reader can tell them apart. Every encoder below therefore carries a STATED
// DOMAIN and a STATED INJECTIVITY PROPERTY, and where a channel genuinely cannot
// represent its domain the loss is reported as a value (`ChannelFidelity`)
// rather than silently absorbed.
//
// Anchor: Tufte, *The Visual Display of Quantitative Information* (1983) — the
// lie factor, (effect shown) / (effect in data), which should be 1.0.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a ppm channel value may fail to faithfully represent the input it encodes.
 *
 * This is the *declaration* half of the injectivity discipline: a saturating or
 * quantising encoder is honest exactly when it says so. `exact` is the only
 * value that asserts the channel round-trips the input's ordering.
 */
export type ChannelFidelity = "exact" | "saturated" | "below-resolution" | "out-of-domain";

export type HeatReceiptOutcome =
  | "cold"
  | "paid"
  | "backpressure"
  | "forgotten"
  | "denied"
  | "storage-error"
  | "invalid"
  | "expired"
  | "stale"
  | "other";

export type HeatReceiptPolicy = "no-forget" | "bounded-forget" | "host-export" | "unknown";

export interface HeatRow {
  readonly tick: number;
  readonly roomName: string;
  readonly heatRejected: number;
  readonly backpressured: number;
  readonly storageErrors: number;
  readonly heatKinds: readonly string[];
  readonly signals?: readonly string[];
  readonly reasons: readonly string[];
}

export interface HeatSummary {
  readonly rows: number;
  readonly heatRejected: number;
  readonly backpressured: number;
  readonly storageErrors: number;
  readonly heatKinds: readonly string[];
  readonly signals: readonly HeatSignal[];
}

export interface HeatReadout extends HeatSummary {
  readonly schema: typeof HEAT_READOUT_SCHEMA;
  readonly qsharpTreaty: typeof HEAT_SIGNAL_TREATY_PATH;
  readonly qsharpSource: typeof HEAT_SIGNAL_QSHARP_SOURCE;
  readonly reasons: readonly string[];
}

export interface HeatReceipt {
  readonly schema: typeof HEAT_RECEIPT_SCHEMA;
  readonly source: string;
  readonly tick: number;
  readonly roomName: string;
  readonly outcome: HeatReceiptOutcome;
  readonly policy: HeatReceiptPolicy;
  readonly heatPpm: number;
  readonly pressurePpm: number;
  readonly storagePpm: number;
  readonly signals: readonly HeatSignal[];
  readonly heatKinds: readonly string[];
  readonly reasons: readonly string[];
}

export interface TemperatureReadout {
  readonly schema: typeof TEMPERATURE_READOUT_SCHEMA;
  readonly source: string;
  readonly temperaturePpm: number;
  readonly band: TemperatureBand;
  readonly heatPpm: number;
  readonly uncertaintyPpm: number;
  readonly pressurePpm: number;
  readonly attentionPpm: number;
  /**
   * Whether the four input channels were representable at all.
   *
   * `out-of-domain` means at least one input was not a `[0, MAX_TEMPERATURE_PPM]`
   * integer — including `NaN` and `Infinity`, both of which the clamp silently
   * turned into `0`, i.e. into `cold`. A dead sensor read as a calm room; this
   * field is what separates the two.
   */
  readonly fidelity: ChannelFidelity;
}

export interface BlackBodyReadout {
  readonly schema: typeof BLACK_BODY_READOUT_SCHEMA;
  readonly source: string;
  readonly temperaturePpm: number;
  readonly radiancePpm: number;
  readonly peakFrequencyPpm: number;
}

export interface TemperatureTreatyBundle {
  readonly heatReadoutSchema: typeof HEAT_READOUT_SCHEMA;
  readonly heatReceiptSchema?: typeof HEAT_RECEIPT_SCHEMA;
  readonly temperatureReadoutSchema: typeof TEMPERATURE_READOUT_SCHEMA;
  readonly blackBodyReadoutSchema: typeof BLACK_BODY_READOUT_SCHEMA;
  readonly qsharpTreaty: typeof HEAT_SIGNAL_TREATY_PATH;
  readonly qsharpSource: typeof HEAT_SIGNAL_QSHARP_SOURCE;
  readonly fsharpSurface: typeof HEAT_FSHARP_SURFACE;
  readonly referenceOracle: string;
  readonly referenceFeedback: readonly string[];
  readonly temperature: TemperatureReadout;
  readonly blackBody: BlackBodyReadout;
  readonly heatReceipts?: readonly HeatReceipt[];
}

function distinct<T>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

export function classifyHeatKind(kind: string): HeatSignal {
  const normalized = kind.toLowerCase();

  if (normalized.includes("forgotten") || normalized.includes("forget") || normalized.includes("prune")) {
    return "forgotten";
  }

  if (normalized.includes("backpressure")) {
    return "backpressure";
  }

  if (normalized.includes("denied") || normalized.includes("reject")) {
    return "denied";
  }

  if (normalized.includes("storage")) {
    return "storage-error";
  }

  if (normalized.includes("invalid") || normalized.includes("decode") || normalized.includes("parse")) {
    return "invalid";
  }

  if (normalized.includes("expired") || normalized.includes("expire") || normalized.includes("ttl")) {
    return "expired";
  }

  if (normalized.includes("stale")) {
    return "stale";
  }

  return "other";
}

export function heatSignalsFromKinds(kinds: readonly string[]): readonly HeatSignal[] {
  return distinct(kinds.map(classifyHeatKind));
}

function normalizeHeatSignal(signal: string): HeatSignal {
  switch (signal) {
    case "forgotten":
    case "backpressure":
    case "denied":
    case "storage-error":
    case "invalid":
    case "expired":
    case "stale":
    case "other":
      return signal;
    default:
      return "other";
  }
}

export function normalizeHeatSignals(signals: readonly string[] | undefined): readonly HeatSignal[] | undefined {
  return signals === undefined ? undefined : distinct(signals.map(normalizeHeatSignal));
}

export function heatSignals(row: HeatRow): readonly HeatSignal[] {
  const supplied = normalizeHeatSignals(row.signals);
  if (supplied !== undefined) {
    return supplied;
  }

  const inferred: HeatSignal[] = [...heatSignalsFromKinds(row.heatKinds)];

  if (row.backpressured > 0 && !inferred.includes("backpressure") && !inferred.includes("denied")) {
    inferred.push("backpressure");
  }

  if (row.storageErrors > 0 && !inferred.includes("storage-error")) {
    inferred.push("storage-error");
  }

  return distinct(inferred);
}

export function summarizeHeatRows(rows: readonly HeatRow[]): HeatSummary {
  return {
    rows: rows.length,
    heatRejected: rows.reduce((sum, row) => sum + row.heatRejected, 0),
    backpressured: rows.reduce((sum, row) => sum + row.backpressured, 0),
    storageErrors: rows.reduce((sum, row) => sum + row.storageErrors, 0),
    heatKinds: distinct(rows.flatMap((row) => row.heatKinds)),
    signals: distinct(rows.flatMap(heatSignals)),
  };
}

function receiptOutcome(signals: readonly HeatSignal[], row: HeatRow): HeatReceiptOutcome {
  if (signals.includes("storage-error")) return "storage-error";
  if (signals.includes("denied")) return "denied";
  if (signals.includes("backpressure")) return "backpressure";
  if (signals.includes("forgotten")) return "forgotten";
  if (signals.includes("invalid")) return "invalid";
  if (signals.includes("expired")) return "expired";
  if (signals.includes("stale")) return "stale";
  if (signals.includes("other")) return "other";
  if (row.heatRejected > 0) return "paid";
  return "cold";
}

function receiptPolicy(signals: readonly HeatSignal[]): HeatReceiptPolicy {
  if (signals.includes("storage-error")) return "host-export";
  if (signals.includes("forgotten")) return "bounded-forget";
  if (signals.includes("backpressure") || signals.includes("denied")) return "no-forget";
  return "unknown";
}

/**
 * The declared ceiling of the heat-receipt channel, in units.
 *
 * Was an implicit `16`: with a linear encoder over a `1_000_000` ppm channel,
 * every count from 16 upward rendered as exactly `1_000_000`. Measured on
 * `origin/main@f63307c17`: 24 collisions over units `1..40`, and lie factors
 * `LF(16->32) = 0.5000`, `LF(16->100) = 0.1600`, `LF(16->1000) = 0.0160`
 * against Tufte's ideal of 1.0.
 *
 * `65_536` is the largest POWER OF TWO at which the `log1p` protocol below is
 * still injective on the integers, verified exhaustively rather than estimated:
 * at `65_536` the image is `65_537` of `65_537` and the tightest realised
 * consecutive gap is exactly `1` ppm (between units `45_256` and `45_257`); at
 * `131_072` injectivity fails outright (image `121_755` of `131_073`). Larger
 * non-power-of-two ceilings up to ~`88_000` are also injective; `65_536` is
 * chosen for legibility. 2^4 -> 2^16.
 */
export const HEAT_RECEIPT_CEILING_UNITS = 65_536;

/**
 * The declared reading protocol for the heat-receipt channel.
 *
 * `log1p`: `ppm = round(MAX * ln(1 + units) / ln(1 + ceilingUnits))`. The reader
 * integrates LOGARITHMICALLY — equal ppm steps are equal *ratios* of units, not
 * equal counts. A linear reading of this channel has a lie factor != 1 BY
 * CONSTRUCTION, which is why the protocol is named in the value rather than left
 * to the reader to assume.
 *
 * Chosen over a wider linear channel because heat counts are open-ended: any
 * linear ceiling is an arbitrary number that saturates, whereas `log1p` spends
 * its resolution where the data is (small counts) and still separates 11 from
 * 1000 from 100_000.
 */
export const HEAT_RECEIPT_PROTOCOL = "log1p";

/**
 * A heat count encoded onto the ppm channel, carrying its own faithfulness.
 *
 * **Stated domain:** `units` in the non-negative integers; `ceilingUnits` in the
 * positive integers.
 *
 * **Stated injectivity property:** `units -> ppm` is INJECTIVE on the integers
 * `[0, ceilingUnits]` (verified exhaustively by test, not asserted). Above
 * `ceilingUnits` the channel saturates and says so via `fidelity: "saturated"`,
 * so a consumer can distinguish "exactly at the ceiling" from "at or above the
 * ceiling" — the distinction the old encoder destroyed. Outside the domain the
 * result is `fidelity: "out-of-domain"`, which is what separates a genuine
 * `0 units` from `NaN` / `Infinity` / `-5` / `0.5`, all four of which the old
 * encoder mapped to the same `0`.
 */
export interface HeatReceiptScale {
  readonly units: number;
  readonly ppm: number;
  readonly fidelity: ChannelFidelity;
  readonly ceilingUnits: number;
  readonly protocol: typeof HEAT_RECEIPT_PROTOCOL;
}

export function heatReceiptScale(units: number, maxUnits = HEAT_RECEIPT_CEILING_UNITS): HeatReceiptScale {
  const ceilingUnits =
    Number.isInteger(maxUnits) && maxUnits >= 1 ? maxUnits : HEAT_RECEIPT_CEILING_UNITS;

  if (!Number.isInteger(units) || units < 0) {
    return { units, ppm: 0, fidelity: "out-of-domain", ceilingUnits, protocol: HEAT_RECEIPT_PROTOCOL };
  }

  if (units > ceilingUnits) {
    return { units, ppm: MAX_TEMPERATURE_PPM, fidelity: "saturated", ceilingUnits, protocol: HEAT_RECEIPT_PROTOCOL };
  }

  const ppm = Math.round((MAX_TEMPERATURE_PPM * Math.log1p(units)) / Math.log1p(ceilingUnits));
  return { units, ppm, fidelity: "exact", ceilingUnits, protocol: HEAT_RECEIPT_PROTOCOL };
}

/**
 * The ppm channel alone, for callers that only render the number.
 *
 * Prefer {@link heatReceiptScale}: this accessor cannot tell a saturated reading
 * from an exact one, nor an out-of-domain input from a true zero. It is faithful
 * only over the integers `[0, HEAT_RECEIPT_CEILING_UNITS]`.
 */
export function heatReceiptPpm(units: number, maxUnits = HEAT_RECEIPT_CEILING_UNITS): number {
  return heatReceiptScale(units, maxUnits).ppm;
}

export function heatReceiptFromRow(
  row: HeatRow,
  options: { readonly source?: string; readonly maxUnits?: number } = {},
): HeatReceipt {
  const signals = heatSignals(row);

  return {
    schema: HEAT_RECEIPT_SCHEMA,
    source: options.source ?? row.roomName,
    tick: row.tick,
    roomName: row.roomName,
    outcome: receiptOutcome(signals, row),
    policy: receiptPolicy(signals),
    heatPpm: heatReceiptPpm(row.heatRejected, options.maxUnits),
    pressurePpm: heatReceiptPpm(row.backpressured, options.maxUnits),
    storagePpm: heatReceiptPpm(row.storageErrors, options.maxUnits),
    signals,
    heatKinds: row.heatKinds,
    reasons: row.reasons,
  };
}

export function heatReceiptsFromRows(
  rows: readonly HeatRow[],
  options: { readonly source?: string; readonly maxUnits?: number } = {},
): readonly HeatReceipt[] {
  return rows.map((row) => heatReceiptFromRow(row, options));
}

export function clampTemperaturePpm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_TEMPERATURE_PPM, Math.trunc(value));
}

/**
 * Whether a value offered to the band classifier was inside the treaty domain.
 *
 * The four band TOKENS are a four-oracle treaty
 * (`src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json` `temperatureBands`,
 * `src/Core/Heat.fs` `TemperatureBand`, `HeatSignals.qs`), so the band set cannot
 * be widened here unilaterally. The verdict is the *separable* channel that
 * carries what the four tokens cannot.
 */
export type TemperatureDomainVerdict = "in-range" | "over-ceiling" | "out-of-domain";

/**
 * A band together with whether the band means anything.
 *
 * **Stated domain:** `observed` is any `number`; the treaty domain is the
 * integers `[0, MAX_TEMPERATURE_PPM]`.
 *
 * **Stated injectivity property:** the band alone is — deliberately — a 4-way
 * quantiser, so it is non-injective BY DESIGN, and the quantisation is declared
 * and bounded (measured over `0..1_000_000`: cold 1, warm 333_333, hot 333_333,
 * critical 333_334). What was NOT declared, and is the actual defect, is that
 * the classifier absorbed everything outside the treaty domain into a band that
 * looks like a measurement:
 *
 *   - `temperatureBand(NaN)` -> `"cold"`
 *   - `temperatureBand(Infinity)` -> `"cold"`
 *   - `temperatureBand(-1)` -> `"cold"`
 *   - `temperatureBand(2_000_000)` -> `"critical"`, indistinguishable from `700_000`
 *
 * The first three are fail-DANGEROUS: a broken or absent sensor renders as a calm
 * room. The property this type restores is that **no out-of-domain input shares a
 * `(band, verdict)` cell with an in-range input** — so `cold/in-range` (idle) and
 * `cold/out-of-domain` (blind) are separable, which is the whole point.
 *
 * Same shape as the existing refusal in
 * `src/Core.TypeScript/planning/society-heat-readout.ts` `declareBand`, which
 * publishes `"indeterminate"` rather than a band its evidence cannot support.
 */
export interface TemperatureBandReading {
  readonly band: TemperatureBand;
  readonly verdict: TemperatureDomainVerdict;
  /** The clamped, in-treaty-domain value the band was actually computed from. */
  readonly ppm: number;
  /** Exactly what was handed in, before clamping. */
  readonly observed: number;
}

export function temperatureBandReading(temperaturePpm: number): TemperatureBandReading {
  const ppm = clampTemperaturePpm(temperaturePpm);
  const band: TemperatureBand =
    ppm === 0 ? "cold" : ppm <= WARM_TEMPERATURE_MAX_PPM ? "warm" : ppm <= HOT_TEMPERATURE_MAX_PPM ? "hot" : "critical";

  const verdict: TemperatureDomainVerdict = !Number.isInteger(temperaturePpm)
    ? "out-of-domain"
    : temperaturePpm < 0
      ? "out-of-domain"
      : temperaturePpm > MAX_TEMPERATURE_PPM
        ? "over-ceiling"
        : "in-range";

  return { band, verdict, ppm, observed: temperaturePpm };
}

/**
 * The band token alone, for the four-oracle treaty surface.
 *
 * Value-identical to the pre-fix encoder, deliberately: the tokens are locked
 * across TypeScript, F# and Q#. Prefer {@link temperatureBandReading} — this
 * accessor cannot tell an idle room from a blind one.
 */
export function temperatureBand(temperaturePpm: number): TemperatureBand {
  return temperatureBandReading(temperaturePpm).band;
}

export function thermalPpm(heatPpm: number, uncertaintyPpm: number, pressurePpm: number): number {
  return Math.max(clampTemperaturePpm(heatPpm), clampTemperaturePpm(uncertaintyPpm), clampTemperaturePpm(pressurePpm));
}

export function temperatureReadout(input: {
  readonly source: string;
  readonly heatPpm: number;
  readonly uncertaintyPpm: number;
  readonly pressurePpm: number;
  readonly attentionPpm: number;
}): TemperatureReadout {
  const heatPpm = clampTemperaturePpm(input.heatPpm);
  const uncertaintyPpm = clampTemperaturePpm(input.uncertaintyPpm);
  const pressurePpm = clampTemperaturePpm(input.pressurePpm);
  const attentionPpm = clampTemperaturePpm(input.attentionPpm);
  const temperaturePpm = thermalPpm(heatPpm, uncertaintyPpm, pressurePpm);

  // The clamp above is lossy and was silent. Report what it absorbed: an
  // out-of-domain input (NaN / Infinity / negative / non-integer) became `0` and
  // therefore `cold`, which is the fail-dangerous direction.
  const verdicts = [input.heatPpm, input.uncertaintyPpm, input.pressurePpm, input.attentionPpm].map(
    (value) => temperatureBandReading(value).verdict,
  );
  const fidelity: ChannelFidelity = verdicts.includes("out-of-domain")
    ? "out-of-domain"
    : verdicts.includes("over-ceiling")
      ? "saturated"
      : "exact";

  return {
    schema: TEMPERATURE_READOUT_SCHEMA,
    source: input.source,
    temperaturePpm,
    band: temperatureBand(temperaturePpm),
    heatPpm,
    uncertaintyPpm,
    pressurePpm,
    attentionPpm,
    fidelity,
  };
}

/**
 * The least temperature whose radiance is representable as at least 1 ppm.
 *
 * Measured, not derived from the source: `blackBodyRadiancePpm(31_622) === 0`
 * and `blackBodyRadiancePpm(31_623) === 1`. Every temperature in `1..31_622`
 * — 31_622 distinct states, 3.1622% of the scale — renders as radiance `0`,
 * identical to a genuinely cold room.
 *
 * This floor is NOT a bug in the arithmetic and cannot be fixed by removing the
 * `floor` calls: a fourth-power law (Stefan-Boltzmann) over a six-decade input
 * needs twenty-four decades of output range, and the channel has six. At
 * `T = 31_623` the true radiance is `(T/MAX)^4 * MAX` = 1.0 ppm exactly; below
 * that it is genuinely sub-ppm. The information is destroyed by the CHANNEL
 * WIDTH, so the honest move is to declare the floor, not to widen a value that
 * three other oracles byte-lock (`src/Core/Heat.fs` `BlackBodyReadout.radiancePpm`
 * computes the identical integer double-floor in `int64`).
 */
export const BLACK_BODY_RADIANCE_FLOOR_PPM = 31_623;

/**
 * Radiance with its representability declared.
 *
 * **Stated domain:** integers `[0, MAX_TEMPERATURE_PPM]`.
 *
 * **Stated injectivity property:** deliberately NOT injective, and bounded —
 * measured over the whole domain, `1_000_001` temperatures produce `515_562`
 * distinct radiance values. The loss is integer-floor quantisation of a
 * fourth-power law and is declared in two parts:
 *   - `fidelity: "below-resolution"` for `0 < T < BLACK_BODY_RADIANCE_FLOOR_PPM`,
 *     where the channel reports `0` but the radiance is not zero;
 *   - `fidelity: "exact"` for `T = 0` (radiance genuinely zero) and for
 *     `T >= BLACK_BODY_RADIANCE_FLOOR_PPM`, where the reading is monotone
 *     non-decreasing in `T`.
 *
 * A reader may therefore never confuse "cold" with "too faint to encode".
 */
export interface BlackBodyRadianceReading {
  readonly temperaturePpm: number;
  readonly radiancePpm: number;
  readonly fidelity: ChannelFidelity;
  readonly floorPpm: typeof BLACK_BODY_RADIANCE_FLOOR_PPM;
}

export function blackBodyRadianceReading(temperaturePpm: number): BlackBodyRadianceReading {
  const radiancePpm = blackBodyRadiancePpm(temperaturePpm);
  const inDomain =
    Number.isInteger(temperaturePpm) && temperaturePpm >= 0 && temperaturePpm <= MAX_TEMPERATURE_PPM;

  const fidelity: ChannelFidelity = !inDomain
    ? "out-of-domain"
    : temperaturePpm > 0 && temperaturePpm < BLACK_BODY_RADIANCE_FLOOR_PPM
      ? "below-resolution"
      : "exact";

  return { temperaturePpm, radiancePpm, fidelity, floorPpm: BLACK_BODY_RADIANCE_FLOOR_PPM };
}

/**
 * Radiance on the ppm channel alone — value-identical to the pre-fix encoder,
 * because `src/Core/Heat.fs` and the Q# reference oracle byte-lock these values.
 *
 * Prefer {@link blackBodyRadianceReading}: this accessor reports `0` both for a
 * cold room and for every temperature below
 * {@link BLACK_BODY_RADIANCE_FLOOR_PPM}, and cannot distinguish them.
 */
export function blackBodyRadiancePpm(temperaturePpm: number): number {
  const temperature = clampTemperaturePpm(temperaturePpm);
  const square = Math.floor((temperature * temperature) / MAX_TEMPERATURE_PPM);
  return Math.floor((square * square) / MAX_TEMPERATURE_PPM);
}

export function blackBodyPeakFrequencyPpm(temperaturePpm: number): number {
  return clampTemperaturePpm(temperaturePpm);
}

export function blackBodyReadout(input: { readonly source: string; readonly temperaturePpm: number }): BlackBodyReadout {
  const temperaturePpm = clampTemperaturePpm(input.temperaturePpm);

  return {
    schema: BLACK_BODY_READOUT_SCHEMA,
    source: input.source,
    temperaturePpm,
    radiancePpm: blackBodyRadiancePpm(temperaturePpm),
    peakFrequencyPpm: blackBodyPeakFrequencyPpm(temperaturePpm),
  };
}

export function temperatureTreatyBundle(input: {
  readonly temperature: TemperatureReadout;
  readonly blackBody?: BlackBodyReadout;
  readonly referenceOracle?: string;
  readonly referenceFeedback?: readonly string[];
  readonly heatReceipts?: readonly HeatReceipt[];
}): TemperatureTreatyBundle {
  const blackBody =
    input.blackBody ?? blackBodyReadout({ source: input.temperature.source, temperaturePpm: input.temperature.temperaturePpm });

  return {
    heatReadoutSchema: HEAT_READOUT_SCHEMA,
    ...(input.heatReceipts === undefined ? {} : { heatReceiptSchema: HEAT_RECEIPT_SCHEMA, heatReceipts: input.heatReceipts }),
    temperatureReadoutSchema: TEMPERATURE_READOUT_SCHEMA,
    blackBodyReadoutSchema: BLACK_BODY_READOUT_SCHEMA,
    qsharpTreaty: HEAT_SIGNAL_TREATY_PATH,
    qsharpSource: HEAT_SIGNAL_QSHARP_SOURCE,
    fsharpSurface: HEAT_FSHARP_SURFACE,
    referenceOracle: input.referenceOracle ?? TEMPERATURE_REFERENCE_ORACLE,
    referenceFeedback: input.referenceFeedback ?? [],
    temperature: input.temperature,
    blackBody,
  };
}
