// llmtv-broadcast — the society's minds on the mesh, strictly one-way (shadow*).
//
// Aaron 2026-07-02: the LLMTV centerpiece, wired live — "the whole society broadcasts
// at once, over Reticulum: self-certifying, no central broadcaster, anyone on the mesh
// watches the whole society predict at once." This is the transport behind the still
// frame that darkhall-tv.ts renders. It rides the same substrate as discovery-beacon.ts
// (transport-agnostic core, injected port, TEXT wire, DST-replayable) and adds the two
// properties LLMTV requires:
//
//   1. NONINTERFERENCE (§13) — the picture is ONE-WAY OUT. A source PUBLISHES frames; a
//      viewer FOLDS them. There is no viewer→source message in the wire vocabulary at
//      all — watching a mind cannot steer it, structurally, not by convention. Feedback
//      (if any) takes its own declared channel, never this one.
//   2. FROST AT THE MEMBRANE (privacy-budget-is-hard-money) — a source's mind is projected
//      through `frostStrip` before it can be published. Required-for-role predictions
//      broadcast; a frosted personal region contributes only its PUBLIC veil label, never
//      its predictions. The `BroadcastMind` type cannot even hold frosted content, so the
//      substrate has nothing to leak. Open by default (unfrosted personal shares); frost
//      is the earned, inviolable exception.
//
// Disciplines: pure core (nowMs injected, no ambient clock); TEXT wire (JSON, no binary
// in the proof lineage); LWW-by-seq viewer fold (idempotent §12, order-independent →
// DST-replayable §7); scale-free (1 source and N fold on the same path §1).

import {
  PHASE_CLOCK_BASIS,
  PHASE_CLOCK_SCHEMA,
  type MindTemp,
  type DwellerMind,
  type LlmtvTranscript,
  type PhaseClockReadout,
} from "../darkhall-ui/darkhall-tv";
import {
  BLACK_BODY_READOUT_SCHEMA,
  HEAT_FSHARP_SURFACE,
  HEAT_RECEIPT_SCHEMA,
  HEAT_READOUT_SCHEMA,
  HEAT_SIGNAL_QSHARP_SOURCE,
  HEAT_SIGNAL_TREATY_PATH,
  TEMPERATURE_READOUT_SCHEMA,
  type TemperatureBand,
  type TemperatureTreatyBundle,
} from "../darkhall-ui/heat";

/// A broadcasting source — self-certifying: it carries its own ZetaId, so a frame needs
/// no central broadcaster to vouch for it (the zid IS the certificate; a name is a label).
export interface BroadcastSource {
  readonly zid: string;
  readonly name: string;
}

/// One soft prediction on the wire — the same (value, ε) as darkhall-tv, integer milli.
export interface BroadcastPrediction {
  readonly label: string;
  readonly temp: MindTemp;
  readonly valueMilli: number;
  readonly epsilonMilli: number;
}

/// The PUBLISHED projection of a mind — what crosses the membrane. It can hold
/// required-for-role predictions and, at most, a frost MARKER (the public veil label).
/// It has no field for frosted content: the type is the guarantee.
export interface BroadcastMind {
  readonly role: string;
  readonly hat: string;
  readonly predictions: readonly BroadcastPrediction[];
  readonly frostMarker?: { readonly veilLabel: string };
  readonly temperatureTreaty?: TemperatureTreatyBundle;
}

/// The SOURCE-side mind — the private form, before the membrane. `required` always
/// broadcasts. `personal` is the dweller's own region: if `frosted`, its predictions are
/// withheld (only the veil label survives); if not, they broadcast (glass-halo default).
export interface SourceMind {
  readonly role: string;
  readonly hat: string;
  readonly required: readonly BroadcastPrediction[];
  readonly temperatureTreaty?: TemperatureTreatyBundle;
  readonly personal?: {
    readonly frosted: boolean;
    readonly veilLabel: string;
    readonly predictions: readonly BroadcastPrediction[];
  };
}

/// THE MEMBRANE. Project a source mind to what may be published. Frosted personal
/// predictions are DROPPED here — they never reach the wire — leaving only the public
/// veil label. Unfrosted personal predictions are appended (open by default). This is the
/// only door mind-state crosses to the mesh; everything published went through it.
export function frostStrip(mind: SourceMind): BroadcastMind {
  const predictions: BroadcastPrediction[] = [...mind.required];
  const base =
    mind.temperatureTreaty === undefined
      ? { role: mind.role, hat: mind.hat, predictions }
      : { role: mind.role, hat: mind.hat, predictions, temperatureTreaty: mind.temperatureTreaty };
  if (mind.personal && !mind.personal.frosted) {
    predictions.push(...mind.personal.predictions);
  }
  if (mind.personal && mind.personal.frosted) {
    return { ...base, frostMarker: { veilLabel: mind.personal.veilLabel } };
  }
  return base;
}

/// The broadcast wire vocabulary. TWO messages, both source→mesh. There is deliberately
/// NO viewer→source variant: that absence is the noninterference guarantee (§13).
export type BroadcastMessage =
  | {
      readonly t: "frame";
      readonly source: BroadcastSource;
      readonly seq: number;
      readonly frameNo: number;
      readonly mind: BroadcastMind;
      readonly phaseClock?: PhaseClockReadout;
    }
  | { readonly t: "dark"; readonly source: BroadcastSource; readonly seq: number };

const SCHEMA = "zeta.llmtv.broadcast.v1";

export interface PublishFrameOptions {
  readonly phaseClock?: PhaseClockReadout;
  readonly phaseClockSeed?: string;
  readonly phaseClockSource?: string;
}

/// A channel a viewer is watching — the latest frame heard from one source, with the tick
/// it arrived (for TTL / going-dark).
export interface Channel {
  readonly source: BroadcastSource;
  readonly seq: number;
  readonly frameNo: number;
  readonly mind: BroadcastMind;
  readonly phaseClock?: PhaseClockReadout;
  readonly lastSeenMs: number;
}

export type ChannelTable = ReadonlyMap<string, Channel>;

/// Publish a frame: project the source mind through the membrane, then wrap it. The only
/// way to build a "frame" message — you cannot hand-assemble one around a SourceMind.
export function publishFrame(
  source: BroadcastSource,
  seq: number,
  frameNo: number,
  mind: SourceMind,
  options: PublishFrameOptions = {},
): BroadcastMessage {
  const base = { t: "frame" as const, source, seq, frameNo, mind: frostStrip(mind) };
  const phaseClock =
    options.phaseClock ??
    (options.phaseClockSeed === undefined
      ? undefined
      : phaseClockForFrame(options.phaseClockSource ?? source.zid, options.phaseClockSeed, frameNo));
  return phaseClock === undefined ? base : { ...base, phaseClock };
}

/// TEXT wire (JSON, no binary in the proof lineage) with a schema tag.
export function encode(msg: BroadcastMessage): string {
  return JSON.stringify({ schema: SCHEMA, msg });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMindTemp(value: unknown): value is MindTemp {
  return value === "hot" || value === "warm" || value === "cool";
}

function isBroadcastSource(value: unknown): value is BroadcastSource {
  const record = asRecord(value);
  return record !== null && typeof record.zid === "string" && typeof record.name === "string";
}

function isBroadcastPrediction(value: unknown): value is BroadcastPrediction {
  const record = asRecord(value);
  return (
    record !== null &&
    typeof record.label === "string" &&
    isMindTemp(record.temp) &&
    isFiniteNumber(record.valueMilli) &&
    isFiniteNumber(record.epsilonMilli)
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTemperatureBand(value: unknown): value is TemperatureBand {
  return value === "cold" || value === "warm" || value === "hot" || value === "critical";
}

function isHeatSignal(value: unknown): boolean {
  return (
    value === "forgotten" ||
    value === "backpressure" ||
    value === "denied" ||
    value === "storage-error" ||
    value === "invalid" ||
    value === "expired" ||
    value === "stale" ||
    value === "other"
  );
}

function isHeatReceiptOutcome(value: unknown): boolean {
  return (
    value === "cold" ||
    value === "paid" ||
    value === "backpressure" ||
    value === "forgotten" ||
    value === "denied" ||
    value === "storage-error" ||
    value === "invalid" ||
    value === "expired" ||
    value === "stale" ||
    value === "other"
  );
}

function isHeatReceiptPolicy(value: unknown): boolean {
  return value === "no-forget" || value === "bounded-forget" || value === "host-export" || value === "unknown";
}

/**
 * The optional signal-provenance pair, validated on VALUE rather than presence.
 *
 * Optionality buys compatibility at the cost of key-set enforcement: a producer
 * that quietly stops emitting these keys is indistinguishable from one that
 * never did, and no key-set check can see it. So the obligation moves here — no
 * obligation to be PRESENT, a full obligation to be CORRECT when present.
 *
 * The pair is checked JOINTLY on purpose. `heatReceiptReading` returns
 * `"unreported"` when either half is missing, so a half-present pair would read
 * as "not reported" while looking, to a human reading the JSON, like it had been
 * reported. Either both or neither.
 */
function isHeatSignalProvenance(record: Record<string, unknown>): boolean {
  const source = record.signalSource;
  const observations = record.signalObservations;

  if (source === undefined && observations === undefined) return true;
  if (source === undefined || observations === undefined) return false;

  return (
    (source === "reported" || source === "inferred") &&
    isFiniteNumber(observations) &&
    Number.isInteger(observations) &&
    observations >= 0
  );
}

function isHeatReceipt(value: unknown): boolean {
  const record = asRecord(value);
  return (
    record !== null &&
    isHeatSignalProvenance(record) &&
    record.schema === HEAT_RECEIPT_SCHEMA &&
    typeof record.source === "string" &&
    isFiniteNumber(record.tick) &&
    typeof record.roomName === "string" &&
    isHeatReceiptOutcome(record.outcome) &&
    isHeatReceiptPolicy(record.policy) &&
    isFiniteNumber(record.heatPpm) &&
    isFiniteNumber(record.pressurePpm) &&
    isFiniteNumber(record.storagePpm) &&
    Array.isArray(record.signals) &&
    record.signals.every(isHeatSignal) &&
    isStringArray(record.heatKinds) &&
    isStringArray(record.reasons)
  );
}

function isTemperatureTreatyBundle(value: unknown): value is TemperatureTreatyBundle {
  const record = asRecord(value);
  const temperature = asRecord(record?.temperature);
  const blackBody = asRecord(record?.blackBody);
  const receiptsValid =
    record?.heatReceipts === undefined
      ? record?.heatReceiptSchema === undefined
      : record?.heatReceiptSchema === HEAT_RECEIPT_SCHEMA &&
        Array.isArray(record.heatReceipts) &&
        record.heatReceipts.every(isHeatReceipt);

  return (
    record !== null &&
    temperature !== null &&
    blackBody !== null &&
    receiptsValid &&
    record.heatReadoutSchema === HEAT_READOUT_SCHEMA &&
    record.temperatureReadoutSchema === TEMPERATURE_READOUT_SCHEMA &&
    record.blackBodyReadoutSchema === BLACK_BODY_READOUT_SCHEMA &&
    record.qsharpTreaty === HEAT_SIGNAL_TREATY_PATH &&
    record.qsharpSource === HEAT_SIGNAL_QSHARP_SOURCE &&
    record.fsharpSurface === HEAT_FSHARP_SURFACE &&
    typeof record.referenceOracle === "string" &&
    isStringArray(record.referenceFeedback) &&
    temperature.schema === TEMPERATURE_READOUT_SCHEMA &&
    typeof temperature.source === "string" &&
    isFiniteNumber(temperature.temperaturePpm) &&
    isTemperatureBand(temperature.band) &&
    isFiniteNumber(temperature.heatPpm) &&
    isFiniteNumber(temperature.uncertaintyPpm) &&
    isFiniteNumber(temperature.pressurePpm) &&
    isFiniteNumber(temperature.attentionPpm) &&
    blackBody.schema === BLACK_BODY_READOUT_SCHEMA &&
    typeof blackBody.source === "string" &&
    isFiniteNumber(blackBody.temperaturePpm) &&
    isFiniteNumber(blackBody.radiancePpm) &&
    isFiniteNumber(blackBody.peakFrequencyPpm)
  );
}

function isBroadcastMind(value: unknown): value is BroadcastMind {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.role !== "string" ||
    typeof record.hat !== "string" ||
    !Array.isArray(record.predictions) ||
    !record.predictions.every(isBroadcastPrediction)
  ) {
    return false;
  }

  if (record.frostMarker === undefined) {
    return record.temperatureTreaty === undefined || isTemperatureTreatyBundle(record.temperatureTreaty);
  }

  const frostMarker = asRecord(record.frostMarker);
  return (
    frostMarker !== null &&
    typeof frostMarker.veilLabel === "string" &&
    (record.temperatureTreaty === undefined || isTemperatureTreatyBundle(record.temperatureTreaty))
  );
}

function normalizePhase(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

export function phaseClockFromPhases(
  source: string,
  seed: string,
  phases: readonly number[],
): PhaseClockReadout | undefined {
  if (phases.length === 0) return undefined;
  const coordinates = phases.map(normalizePhase);
  const phase = coordinates.reduce((max, value) => Math.max(max, value), 0);
  const skewBoundTicks = coordinates.reduce((max, value) => Math.max(max, Math.abs(phase - value)), 0);
  return {
    schema: PHASE_CLOCK_SCHEMA,
    source,
    basis: PHASE_CLOCK_BASIS,
    seed,
    phase,
    skewBoundTicks,
    appendOnly: true,
    travelers: coordinates.length,
  };
}

export function phaseClockForFrame(source: string, seed: string, frameNo: number): PhaseClockReadout {
  return phaseClockFromPhases(source, seed, [frameNo])!;
}

export function phaseClockFromChannels(
  table: ChannelTable,
  seed: string,
  source = "llmtv-broadcast",
): PhaseClockReadout | undefined {
  return phaseClockFromPhases(
    source,
    seed,
    Array.from(table.values()).map((channel) => channel.frameNo),
  );
}

function isPhaseClockReadout(value: unknown): value is PhaseClockReadout {
  const record = asRecord(value);
  return (
    record !== null &&
    record.schema === PHASE_CLOCK_SCHEMA &&
    typeof record.source === "string" &&
    record.basis === PHASE_CLOCK_BASIS &&
    typeof record.seed === "string" &&
    isFiniteNumber(record.phase) &&
    isFiniteNumber(record.skewBoundTicks) &&
    typeof record.appendOnly === "boolean" &&
    isFiniteNumber(record.travelers)
  );
}

function isBroadcastMessage(value: unknown): value is BroadcastMessage {
  const record = asRecord(value);
  if (record === null || !isBroadcastSource(record.source) || !isFiniteNumber(record.seq)) {
    return false;
  }

  if (record.t === "dark") {
    return true;
  }

  return (
    record.t === "frame" &&
    isFiniteNumber(record.frameNo) &&
    isBroadcastMind(record.mind) &&
    (record.phaseClock === undefined || isPhaseClockReadout(record.phaseClock))
  );
}

/// Guarded decode — foreign / malformed / wrong-schema input returns null, never throws.
export function decode(text: string): BroadcastMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (record === null || record.schema !== SCHEMA) {
    return null;
  }

  return isBroadcastMessage(record.msg) ? record.msg : null;
}

function upsert(table: ChannelTable, channel: Channel): ChannelTable {
  const next = new Map(table);
  next.set(channel.source.zid, channel);
  return next;
}

/// The pure viewer fold: accept one inbound frame into the channel table. LWW-BY-SEQ — a
/// frame only supersedes if its seq is strictly newer, so re-delivery and out-of-order
/// arrival both converge to the same final table (idempotent §12; order-independent →
/// DST-replayable §7). `dark` retires a source when its going-dark seq is at least the
/// last frame's. `nowMs` injected — no ambient clock. Keyed by zid — the society grid.
export function observeBroadcast(table: ChannelTable, msg: BroadcastMessage, nowMs: number): ChannelTable {
  const key = msg.source.zid;
  const current = table.get(key);
  switch (msg.t) {
    case "frame":
      if (current && msg.seq <= current.seq) return table; // stale or duplicate — no-op
      return upsert(table, {
        source: msg.source,
        seq: msg.seq,
        frameNo: msg.frameNo,
        mind: msg.mind,
        ...(msg.phaseClock === undefined ? {} : { phaseClock: msg.phaseClock }),
        lastSeenMs: nowMs,
      });
    case "dark": {
      if (!current || msg.seq < current.seq) return table; // stale going-dark — keep the newer frame
      const next = new Map(table);
      next.delete(key);
      return next;
    }
  }
}

/// Drop channels unheard for longer than `ttlMs` — a source that stops broadcasting goes
/// dark on its own (pure; `nowMs` injected, the caller ticks it).
export function expireChannels(table: ChannelTable, nowMs: number, ttlMs: number): ChannelTable {
  const next = new Map<string, Channel>();
  for (const [k, c] of table) if (nowMs - c.lastSeenMs <= ttlMs) next.set(k, c);
  return next;
}

/// Bridge the live channel table back to a darkhall-tv transcript, so the SAME homoiconic
/// generator renders the live society grid that renders the still frame. Sources sort by
/// zid for a deterministic tile order (DST). Frosted channels carry their veil label
/// forward; unfrosted ones render no frost region.
export function toLlmtvTranscript(table: ChannelTable, seed: string): LlmtvTranscript {
  const channels = Array.from(table.values()).sort((a, b) =>
    a.source.zid < b.source.zid ? -1 : a.source.zid > b.source.zid ? 1 : 0,
  );
  const transcriptPhaseClock = phaseClockFromPhases(
    "llmtv-broadcast",
    seed,
    channels.map((channel) => channel.frameNo),
  );
  const dwellers: DwellerMind[] = channels
    .map((c) => {
      const phaseClock =
        c.phaseClock?.seed === seed ? c.phaseClock : phaseClockForFrame(c.phaseClock?.source ?? c.source.zid, seed, c.frameNo);
      const base = {
        name: c.source.name,
        role: c.mind.role,
        hat: c.mind.hat,
        predictions: c.mind.predictions,
        live: true,
        frame: c.frameNo,
        phaseClock,
      };
      const withTreaty =
        c.mind.temperatureTreaty === undefined ? base : { ...base, temperatureTreaty: c.mind.temperatureTreaty };
      return c.mind.frostMarker ? { ...withTreaty, frost: { veilLabel: c.mind.frostMarker.veilLabel } } : withTreaty;
    });
  const base = { schema: "zeta.darkhall.llmtv.v1" as const, seed, generatedBy: "llmtv-broadcast", dwellers };
  return transcriptPhaseClock === undefined ? base : { ...base, phaseClock: transcriptPhaseClock };
}

/// The injected transport port — the ONE declared channel a frame crosses (§13). `publish`
/// is source→mesh; `onFrame` is mesh→viewer. They are SEPARATE and neither returns to the
/// other: a source cannot hear a viewer through this port, a viewer cannot address a source.
/// One-way by construction. UDP/Reticulum/DHT impls plug in here; the core imports no socket.
export interface BroadcastTransport {
  publish(text: string): void;
  onFrame(handler: (text: string, from: string) => void): void;
}
