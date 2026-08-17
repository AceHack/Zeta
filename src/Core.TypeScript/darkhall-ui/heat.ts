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

/**
 * How badly each fidelity misleads a reader about magnitude — the severity order
 * used to combine fidelities across a composition.
 *
 * Declared rather than inferred, because the ordering is a judgement and a reader
 * is entitled to see it:
 *
 *   - `exact` (0) — the channel round-trips the input's ordering.
 *   - `below-resolution` (1) — a BOUNDED loss: the true value lies in a known
 *     interval below a declared floor. The reader is misled by at most that floor.
 *   - `saturated` (2) — an UNBOUNDED loss above a declared ceiling. Worse than
 *     `below-resolution` because no bound can be put on what was hidden.
 *   - `out-of-domain` (3) — worst: there was no measurement at all. Every other
 *     value still describes a reading; this one describes its absence.
 */
export const FIDELITY_SEVERITY: Readonly<Record<ChannelFidelity, number>> = {
  exact: 0,
  "below-resolution": 1,
  saturated: 2,
  "out-of-domain": 3,
};

/**
 * The worst fidelity in a set — how a composed reading inherits its inputs' faults.
 *
 * **Why this exists.** 081M00TYT8N087G0R003MPMRX9 gave each encoder a fidelity
 * channel but did not make the channel survive COMPOSITION. A caller that runs a
 * lossy accessor and then builds a readout from its output destroys the fault one
 * call before the readout is constructed, and the readout then reports `exact` —
 * which is worse than reporting nothing, because it positively asserts a
 * faithfulness no instrument established. A fidelity field that can only ever say
 * `exact` is a check that cannot fail.
 *
 * Idempotent, commutative and associative (a max over a total order), so it is a
 * fold over a SET of inputs — order of arrival cannot change a rendered verdict.
 * That is the noninterference / idempotency discipline applied to the fault
 * channel itself.
 */
export function worstFidelity(values: readonly ChannelFidelity[]): ChannelFidelity {
  let worst: ChannelFidelity = "exact";
  for (const value of values) {
    if (FIDELITY_SEVERITY[value] > FIDELITY_SEVERITY[worst]) worst = value;
  }
  return worst;
}

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

/**
 * Where a receipt's `signals` set came from.
 *
 * `reported` — the producer put a `signals` array on the wire. An EMPTY reported
 * array is a genuine measured zero: a channel that exists and said nothing.
 *
 * `inferred` — there was no `signals` key at all, so {@link heatSignals}
 * reconstructed one from `heatKinds` and the counters. When those are also empty
 * the reconstruction consumed NO evidence, and the resulting `[]` is not a
 * measurement of anything.
 */
export type HeatSignalSource = "reported" | "inferred";

/**
 * The third state, in the vocabulary the bus snapshot uses for the same problem.
 *
 * `measured` · `unknown` · `unreported`. Deliberately NOT two states: a reading
 * with zero observations is not the healthy one.
 */
export type HeatSignalReading = "measured" | "unknown" | "unreported";

/**
 * A signal set together with the denominator it was folded from.
 *
 * `081M01400RZ087G0R000PS3VJG`. {@link heatSignals} returns `[]` for BOTH a
 * producer that reported an empty signal set and a producer with no signal
 * channel at all, and the receipt then published `signals: []` either way — so
 * "observed nothing" and "observed zero" were byte-identical on the wire and the
 * rails rendered the un-measured case with the word `cold`, i.e. as health.
 *
 * `observations` is the denominator that makes the zero CHECKABLE rather than
 * asserted: it is the number of evidence items the set was folded from.
 *
 *   - `reported`: the length of the array the producer handed over. `0` here is
 *     a real zero — the channel was read and was empty.
 *   - `inferred`: `heatKinds.length` plus one for each counter that fired, i.e.
 *     exactly the inputs {@link heatSignals} consulted. `0` here means the
 *     inference ran on nothing.
 *
 * **Stated injectivity property:** `(source, observations)` separates the four
 * cases that previously shared one `[]` — reported-empty, reported-nonempty,
 * inferred-with-evidence, inferred-from-nothing. Neither field alone does:
 * `observations = 0` occurs under both sources, and `source = reported` occurs at
 * every observation count.
 */
export interface HeatSignalEvidence {
  readonly signals: readonly HeatSignal[];
  readonly source: HeatSignalSource;
  readonly observations: number;
}

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
  /**
   * The faithfulness of `heatPpm` / `pressurePpm` / `storagePpm`, one per rail.
   *
   * `081M01400RZ087G0R000PS3VJG`: the receipt rails painted a blind counter as
   * a genuine zero. `heatReceiptFromRow` encoded through {@link heatReceiptPpm},
   * which discards the `fidelity` {@link heatReceiptScale} had already computed,
   * so `heatRejected: NaN` and `heatRejected: 0` both rendered `heatPpm: 0` and
   * no reader could separate them.
   *
   * **Three keys, not one folded `fidelity`**, deliberately. The receipt
   * publishes three independent counters, so a fold to the worst of them would
   * be a fresh non-injective encoder — `(exact, exact, out-of-domain)` and
   * `(out-of-domain, out-of-domain, out-of-domain)` would render identically —
   * which is the exact defect class this lane has spent the week removing. One
   * fidelity per independently-encoded channel value.
   *
   * **Optional, with the same declared absent-reading** as
   * `TemperatureReadout.fidelity`: absence means *not reported*, never *fine*.
   * Read through {@link reportedFidelity}. Optional rather than required
   * because `zeta.heat.receipt.v1` is published and instances without these
   * keys already exist — see
   * `docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md`.
   */
  readonly heatFidelity?: ChannelFidelity;
  readonly pressureFidelity?: ChannelFidelity;
  readonly storageFidelity?: ChannelFidelity;
  /**
   * Where `signals` came from, and how many observations backed it.
   *
   * `081M01400RZ087G0R000PS3VJG`: the receipt rails painted a blind counter as a
   * genuine zero. `signals: []` was published both by a producer that reported an
   * empty signal set and by one with no signal channel at all, and the renderer
   * labelled both `cold` — the un-measured case wearing the healthy word.
   *
   * **Two keys, not one folded verdict**, because neither is derivable from the
   * other: `signalObservations = 0` occurs under both sources, and
   * `signalSource = "reported"` occurs at every observation count. A single
   * folded field would be a fresh non-injective encoder, which is the defect
   * class this lane exists to remove.
   *
   * **OPTIONAL, with a declared absent-reading.** `zeta.heat.receipt.v1` is a
   * published id and instances without these keys already exist, so a required
   * key would be `v2`. Absence reads `"unreported"` — never `"measured"`. Read
   * through {@link heatReceiptReading}, never by testing the field directly.
   *
   * Policy — a published `vN` acquires a new field ONLY as an optional key with a
   * declared absent-reading; a required key is `vN+1` — is PR #10742, which was
   * still open when this landed. Its decision record
   * (`docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md`)
   * arrives with it; this comment is the pointer until then.
   */
  readonly signalSource?: HeatSignalSource;
  readonly signalObservations?: number;
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
   *
   * **OPTIONAL, and the `?` is load-bearing** — see
   * `docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md`.
   * `zeta.temperature.readout.v1` is a PUBLISHED id: instances of it already
   * exist without this key (every transcript `src/Core/Heat.fs` emitted before
   * the key was added, and the `temperatureCases` of the Q# treaty). PR #10722
   * declared it REQUIRED here while F#'s record kept eight fields, which made
   * this type FALSE about its own wire format — `JSON.parse(fsharpTranscript)`
   * yields `fidelity === undefined` while the type asserts one of four string
   * literals. Optional is what makes the type true.
   *
   * **Absent-reading, declared:** absence means *this producer did not report*,
   * NEVER *this producer reports the channel is faithful*. Read it through
   * {@link reportedFidelity} rather than testing it directly, so that
   * `undefined` cannot be mistaken for `exact` — the exact conflation that
   * `081M01400RZ087G0R000PS3VJG` is about.
   */
  readonly fidelity?: ChannelFidelity;
}

/**
 * What an absent `fidelity` reads as.
 *
 * A published schema's optional key needs a declared absent-reading or the
 * optionality is a dodge: a reader that treats "not reported" as "fine" has
 * reintroduced the fault the key was added to fix, one level up. This is the
 * same refusal as `TemperatureBandReading.verdict` and
 * `society-heat-readout.ts` `declareBand` publishing `"indeterminate"` rather
 * than a band its evidence cannot support.
 */
export const UNREPORTED_FIDELITY = "unreported";

export type ReportedFidelity = ChannelFidelity | typeof UNREPORTED_FIDELITY;

/**
 * Read an optional fidelity as a total value.
 *
 * **The invariant, and it is the whole point:** the result is `"exact"` if and
 * only if the producer said `"exact"`. An absent value becomes
 * `"unreported"` — a fifth token that is distinguishable from all four
 * measured ones, so no renderer, operator or agent can cite a faithfulness
 * nothing measured.
 */
export function reportedFidelity(fidelity: ChannelFidelity | undefined): ReportedFidelity {
  return fidelity ?? UNREPORTED_FIDELITY;
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

/**
 * The signal set together with its provenance and denominator.
 *
 * Value-identical to {@link heatSignals} on the `signals` field — the fold is
 * unchanged — but it also reports the two facts the fold was discarding.
 */
export function heatSignalEvidence(row: HeatRow): HeatSignalEvidence {
  const supplied = normalizeHeatSignals(row.signals);
  if (supplied !== undefined) {
    // The channel exists and was read. `[]` here is a measurement whose value is
    // zero, and the denominator is what the producer actually handed over
    // (before normalisation and de-duplication — it is the size of the evidence,
    // not the size of the conclusion).
    return { signals: supplied, source: "reported", observations: row.signals?.length ?? 0 };
  }

  const inferred: HeatSignal[] = [...heatSignalsFromKinds(row.heatKinds)];

  if (row.backpressured > 0 && !inferred.includes("backpressure") && !inferred.includes("denied")) {
    inferred.push("backpressure");
  }

  if (row.storageErrors > 0 && !inferred.includes("storage-error")) {
    inferred.push("storage-error");
  }

  // Exactly the inputs the branch above consulted — `heatKinds`, plus one per
  // counter that fired. When this is `0` the reconstruction ran on nothing.
  const observations =
    row.heatKinds.length + (row.backpressured > 0 ? 1 : 0) + (row.storageErrors > 0 ? 1 : 0);

  return { signals: distinct(inferred), source: "inferred", observations };
}

/**
 * The signal set alone, for callers that only render the tokens.
 *
 * Value-identical to the pre-fix encoder, deliberately. Prefer
 * {@link heatSignalEvidence}: this accessor cannot tell a producer that reported
 * an empty signal set from one that has no signal channel at all.
 */
export function heatSignals(row: HeatRow): readonly HeatSignal[] {
  return heatSignalEvidence(row).signals;
}

/**
 * How to read a receipt's signal set — the third state made explicit.
 *
 * The absent-reading is CONSERVATIVE and that is the load-bearing half: a
 * receipt minted before these keys existed reads `"unreported"`, never
 * `"measured"`. Without that clause optionality would just move the original
 * fault up one level — a field that can only ever say "fine".
 */
export function heatReceiptReading(receipt: HeatReceipt): HeatSignalReading {
  if (receipt.signalSource === undefined || receipt.signalObservations === undefined) {
    return "unreported";
  }

  if (receipt.signalSource === "reported") return "measured";

  return receipt.signalObservations > 0 ? "measured" : "unknown";
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
  const ceilingUnits = Number.isInteger(maxUnits) && maxUnits >= 1 ? maxUnits : HEAT_RECEIPT_CEILING_UNITS;

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
  const evidence = heatSignalEvidence(row);
  const signals = evidence.signals;

  // Encode through `heatReceiptScale`, not `heatReceiptPpm`. The accessor
  // computes the fidelity and then throws it away, which is how a blind counter
  // came to render as a genuine zero (081M01400RZ087G0R000PS3VJG).
  const heat = heatReceiptScale(row.heatRejected, options.maxUnits);
  const pressure = heatReceiptScale(row.backpressured, options.maxUnits);
  const storage = heatReceiptScale(row.storageErrors, options.maxUnits);

  return {
    schema: HEAT_RECEIPT_SCHEMA,
    source: options.source ?? row.roomName,
    tick: row.tick,
    roomName: row.roomName,
    outcome: receiptOutcome(signals, row),
    policy: receiptPolicy(signals),
    heatPpm: heat.ppm,
    pressurePpm: pressure.ppm,
    storagePpm: storage.ppm,
    signals,
    heatKinds: row.heatKinds,
    reasons: row.reasons,
    heatFidelity: heat.fidelity,
    pressureFidelity: pressure.fidelity,
    storageFidelity: storage.fidelity,
    signalSource: evidence.source,
    signalObservations: evidence.observations,
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
  /**
   * Fidelities already established UPSTREAM, for callers that encoded their
   * inputs before handing them over.
   *
   * This is an argument, not a schema field: `TemperatureReadout`'s shape is
   * unchanged. It exists because the ppm values a caller passes may already have
   * been through a lossy accessor — `heatReceiptPpm(NaN)` is `0`, and by the time
   * that `0` arrives here it is indistinguishable from a genuine idle room. Since
   * this function cannot recover what it was never told, a caller that DOES know
   * must be able to say so, and the readout takes the worst of what it can see
   * and what it is told (`worstFidelity`).
   *
   * Omitting it is safe but not free: the readout then reports only the faults
   * visible in its own four arguments.
   */
  readonly upstreamFidelity?: readonly ChannelFidelity[];
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
  const ownFidelity: ChannelFidelity = verdicts.includes("out-of-domain")
    ? "out-of-domain"
    : verdicts.includes("over-ceiling")
      ? "saturated"
      : "exact";

  // A composed reading is only as faithful as its worst input. Without this fold
  // the readout would report `exact` for a caller that already knew its input was
  // NaN — asserting a faithfulness nothing measured.
  const fidelity = worstFidelity([ownFidelity, ...(input.upstreamFidelity ?? [])]);

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
  const inDomain = Number.isInteger(temperaturePpm) && temperaturePpm >= 0 && temperaturePpm <= MAX_TEMPERATURE_PPM;

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

export function blackBodyReadout(input: {
  readonly source: string;
  readonly temperaturePpm: number;
}): BlackBodyReadout {
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
    input.blackBody ??
    blackBodyReadout({ source: input.temperature.source, temperaturePpm: input.temperature.temperaturePpm });

  return {
    heatReadoutSchema: HEAT_READOUT_SCHEMA,
    ...(input.heatReceipts === undefined
      ? {}
      : { heatReceiptSchema: HEAT_RECEIPT_SCHEMA, heatReceipts: input.heatReceipts }),
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
