import {
  blackBodyReadout,
  heatReceiptScale,
  heatReceiptsFromRows,
  heatSignals,
  summarizeHeatRows,
  temperatureReadout,
  temperatureTreatyBundle,
  type BlackBodyReadout,
  type HeatReadout,
  type HeatRow,
  type TemperatureReadout,
  type TemperatureTreatyBundle,
} from "./heat";
import type { BrowserTabCoordinatorReadout } from "../browser-node/browser-tab-coordinator";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import type { DwellerMind, LlmtvTranscript, MindPrediction, MindTemp, PhaseClockReadout } from "./darkhall-tv";
import type { DarkHallCausalHandoffReadout, DarkHallCausalReadout } from "./darkhall-causal-readout";
import type { DarkHallDatabaseReadout } from "./darkhall-database-readout";

export {
  BLACK_BODY_READOUT_SCHEMA,
  classifyHeatKind,
  HEAT_FSHARP_SURFACE,
  HEAT_RECEIPT_SCHEMA,
  HEAT_READOUT_SCHEMA,
  HEAT_SIGNAL_QSHARP_SOURCE,
  HEAT_SIGNAL_TREATY_PATH,
  HOT_TEMPERATURE_MAX_PPM,
  MAX_TEMPERATURE_PPM,
  TEMPERATURE_READOUT_SCHEMA,
  TEMPERATURE_REFERENCE_ORACLE,
  WARM_TEMPERATURE_MAX_PPM,
  blackBodyPeakFrequencyPpm,
  blackBodyRadiancePpm,
  blackBodyReadout,
  clampTemperaturePpm,
  heatReceiptFromRow,
  heatReceiptPpm,
  heatReceiptScale,
  heatReceiptsFromRows,
  heatSignals,
  heatSignalsFromKinds,
  normalizeHeatSignals,
  summarizeHeatRows,
  temperatureBand,
  temperatureReadout,
  temperatureTreatyBundle,
  thermalPpm,
  worstFidelity,
  type ChannelFidelity,
  type HeatReadout,
  type HeatReceipt,
  type HeatReceiptOutcome,
  type HeatReceiptPolicy,
  type HeatRow,
  type HeatSignal,
  type HeatSummary,
  type BlackBodyReadout,
  type TemperatureBand,
  type TemperatureReadout,
  type TemperatureTreatyBundle,
} from "./heat";

export type RoomPhase = "observe" | "choose" | "execute" | "measure" | "continue";

export type TickOutcome = "ok" | "refused" | "backpressure" | "continued";

/// One CHSH S-lane between two claimed identities (the coordination meter —
/// AntiSybil.chshS on the F# side). S travels as INTEGER MILLI (no floats in
/// the transcript bytes); |S| > 2000 convicts a common cause (Bell/CHSH bound).
export interface SLane {
  readonly a: string;
  readonly b: string;
  readonly sMilli: number;
}

/// The one-way verdict: |S| above the classical bound convicts sameness;
/// below it never acquits — "open", not "distinct".
export function sLaneVerdict(lane: SLane): "convicted" | "open" {
  return Math.abs(lane.sMilli) > 2000 ? "convicted" : "open";
}

/// Coordination bandwidth f̂ = (|S| − 2) / 2, clamped to [0, 1] — the fraction
/// of rounds a conductor's cross-setting instruction was effectively delivered.
export function coordinationBandwidth(sMilli: number): number {
  return Math.min(1, Math.max(0, (Math.abs(sMilli) - 2000) / 2000));
}

export interface ControllerCell {
  readonly cell: number;
  readonly label: string;
  readonly actionId?: string;
  readonly actionClass?: string;
  readonly gate?: string;
  readonly selected?: boolean;
  readonly enabled?: boolean;
}

export interface RoomTranscriptTick {
  readonly tick: number;
  readonly phase: RoomPhase;
  readonly event: string;
  readonly choiceCell?: number;
  readonly outcome: TickOutcome;
  readonly heat?: HeatRow;
  readonly continuation?: string;
}

export interface TravelerFrameCoordinate {
  readonly traveler: string;
  readonly phase: number;
}

export interface TranscriptTravelerFrame {
  readonly schema: "zeta.darkhall.traveler-frame.v1";
  readonly source: string;
  readonly commonPhase: number;
  readonly coordinates: readonly TravelerFrameCoordinate[];
  readonly commonDominatesRoom?: boolean;
  readonly commonDominatesHeat?: boolean;
}

export interface TranscriptContinuationReadout {
  readonly schema: "zeta.darkhall.continuation-readout.v1";
  readonly source: string;
  readonly loopId: string;
  readonly resumable: boolean;
  readonly token: string;
  readonly statePointer: string;
  readonly nextLap: number;
  readonly ticksSpent: number;
  readonly resumeBaseTick: number;
  readonly stopReason: string;
  readonly admissionFeedback: readonly string[];
}

export interface RoomRunTranscript {
  readonly schema: "zeta.darkhall.room-ui.v1";
  readonly roomName: string;
  readonly seed: string;
  readonly controller: readonly ControllerCell[];
  readonly ticks: readonly RoomTranscriptTick[];
  readonly heatRows: readonly HeatRow[];
  readonly heatReadout?: HeatReadout;
  readonly temperatureReadout?: TemperatureReadout;
  readonly blackBodyReadout?: BlackBodyReadout;
  readonly temperatureTreaty?: TemperatureTreatyBundle;
  readonly travelerFrame?: TranscriptTravelerFrame;
  readonly phaseClock?: PhaseClockReadout;
  readonly continuationReadout?: TranscriptContinuationReadout;
  readonly causalReadout?: DarkHallCausalReadout;
  readonly causalHandoffReadout?: DarkHallCausalHandoffReadout;
  readonly browserTabReadout?: BrowserTabCoordinatorReadout;
  readonly browserTransportReadout?: BrowserTabTransportReadout;
  readonly databaseReadout?: DarkHallDatabaseReadout;
  readonly sLanes?: readonly SLane[];
  readonly generatedBy?: string;
}

export interface RenderDocumentOptions {
  readonly title?: string;
  readonly stylesheetHref?: string;
  readonly inlineCss?: string;
}

export interface RoomTranscriptLlmtvOptions {
  readonly name?: string;
  readonly role?: string;
  readonly hat?: string;
  readonly live?: boolean;
  readonly generatedBy?: string;
}

const controllerSize = 16;
const heatLaneMax = 16;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function attr(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  return ` ${name}="${escapeHtml(String(value))}"`;
}

function clampHeat(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(heatLaneMax, Math.trunc(value));
}

function heatRatio(value: number): string {
  return (clampHeat(value) / heatLaneMax).toFixed(4);
}

export function normalizeControllerCells(cells: readonly ControllerCell[]): readonly ControllerCell[] {
  const byCell = new Map<number, ControllerCell>();

  for (const cell of cells) {
    if (Number.isInteger(cell.cell) && cell.cell >= 0 && cell.cell < controllerSize && !byCell.has(cell.cell)) {
      byCell.set(cell.cell, cell);
    }
  }

  return Array.from({ length: controllerSize }, (_, cell) => byCell.get(cell) ?? { cell, label: "" });
}

function renderControllerCell(cell: ControllerCell): string {
  const enabled = cell.enabled ?? cell.label.length > 0;
  let state = "empty";
  if (enabled) state = "ready";
  if (cell.selected) state = "selected";
  const label = cell.label.length > 0 ? escapeHtml(cell.label) : "&nbsp;";
  const actionId = cell.actionId ?? "";
  const contents = [
    `<span class="zeta-room-cell-index">${cell.cell.toString().padStart(2, "0")}</span>`,
    `<span class="zeta-room-cell-label">${label}</span>`,
    actionId.length > 0 ? `<span class="zeta-room-cell-action">${escapeHtml(actionId)}</span>` : "",
  ].join("");
  const control =
    actionId.length === 0
      ? contents
      : [
          '<button type="button" class="zeta-room-cell-input"',
          attr("data-controller-cell", cell.cell),
          attr("data-action-id", actionId),
          attr("aria-label", `${cell.label} (${actionId})`),
          attr("aria-keyshortcuts", cell.cell.toString(16).toUpperCase()),
          enabled ? "" : " disabled",
          ">",
          contents,
          "</button>",
        ].join("");

  return [
    `<li class="zeta-room-cell"`,
    attr("data-cell", cell.cell),
    attr("data-state", state),
    attr("data-selected", cell.selected === true ? "true" : undefined),
    attr("data-gate", cell.gate),
    attr("data-action-class", cell.actionClass),
    ">",
    control,
    "</li>",
  ].join("");
}

function renderHeatRow(row: HeatRow): string {
  const signals = heatSignals(row).join(" ");
  const style = [
    `--heat-rejected:${heatRatio(row.heatRejected)}`,
    `--heat-backpressure:${heatRatio(row.backpressured)}`,
    `--heat-storage:${heatRatio(row.storageErrors)}`,
  ].join(";");
  const kinds = row.heatKinds.length > 0 ? row.heatKinds.join(", ") : "cold";
  const reasons = row.reasons.length > 0 ? row.reasons.join(" | ") : "no heat";

  return [
    `<li class="zeta-heat-row"`,
    attr("data-tick", row.tick),
    attr("data-signals", signals),
    attr("style", style),
    ">",
    `<span class="zeta-heat-row-tick">${row.tick.toString()}</span>`,
    `<span class="zeta-heat-row-lane zeta-heat-row-lane-rejected"></span>`,
    `<span class="zeta-heat-row-lane zeta-heat-row-lane-backpressure"></span>`,
    `<span class="zeta-heat-row-lane zeta-heat-row-lane-storage"></span>`,
    `<span class="zeta-heat-row-kind">${escapeHtml(kinds)}</span>`,
    `<span class="zeta-heat-row-reason">${escapeHtml(reasons)}</span>`,
    "</li>",
  ].join("");
}

function renderSLane(lane: SLane): string {
  const verdict = sLaneVerdict(lane);
  const bandwidth = coordinationBandwidth(lane.sMilli).toFixed(4);
  const s = (lane.sMilli / 1000).toFixed(3);

  return [
    `<li class="zeta-s-lane"`,
    attr("data-a", lane.a),
    attr("data-b", lane.b),
    attr("data-verdict", verdict),
    attr("style", `--s-bandwidth:${bandwidth}`),
    ">",
    `<span class="zeta-s-lane-pair">${escapeHtml(lane.a)} · ${escapeHtml(lane.b)}</span>`,
    `<span class="zeta-s-lane-bar"></span>`,
    `<span class="zeta-s-lane-value">S ${escapeHtml(s)}</span>`,
    `<span class="zeta-s-lane-verdict">${verdict}</span>`,
    "</li>",
  ].join("");
}

function renderTick(tick: RoomTranscriptTick): string {
  const heatSignalsText = tick.heat ? heatSignals(tick.heat).join(" ") : "cold";
  const continuation = tick.continuation ? `<code>${escapeHtml(tick.continuation)}</code>` : "";

  return [
    `<li class="zeta-room-tick"`,
    attr("data-phase", tick.phase),
    attr("data-outcome", tick.outcome),
    attr("data-choice-cell", tick.choiceCell),
    attr("data-heat-signals", heatSignalsText),
    ">",
    `<span class="zeta-room-tick-index">${tick.tick.toString()}</span>`,
    `<span class="zeta-room-tick-phase">${escapeHtml(tick.phase)}</span>`,
    `<span class="zeta-room-tick-event">${escapeHtml(tick.event)}</span>`,
    continuation,
    "</li>",
  ].join("");
}

function continuationStatus(readout: TranscriptContinuationReadout): "resumable" | "blocked" | "closed" {
  if (readout.resumable) return "resumable";
  if (readout.admissionFeedback.length > 0) return "blocked";
  return "closed";
}

function renderContinuationReadout(readout: TranscriptContinuationReadout | undefined): string {
  if (readout === undefined) return "";

  const status = continuationStatus(readout);
  const feedback = readout.admissionFeedback.length > 0 ? readout.admissionFeedback.join(", ") : "none";
  const token = readout.token.length > 0 ? readout.token : "none";

  return [
    `<section class="zeta-room-continuation"`,
    attr("aria-label", "Continuation readout"),
    attr("data-continuation-readout", readout.schema),
    attr("data-continuation-status", status),
    attr("data-continuation-loop", readout.loopId),
    attr("data-continuation-stop", readout.stopReason),
    attr("data-continuation-next-lap", readout.nextLap),
    attr("data-continuation-resume-base-tick", readout.resumeBaseTick),
    ">",
    "<dl>",
    `<div><dt>resume</dt><dd>${status}</dd></div>`,
    `<div><dt>stop</dt><dd>${escapeHtml(readout.stopReason)}</dd></div>`,
    `<div><dt>next lap</dt><dd>${readout.nextLap.toString()}</dd></div>`,
    `<div><dt>base tick</dt><dd>${readout.resumeBaseTick.toString()}</dd></div>`,
    `<div><dt>feedback</dt><dd>${escapeHtml(feedback)}</dd></div>`,
    `<div><dt>token</dt><dd><code>${escapeHtml(token)}</code></dd></div>`,
    "</dl>",
    "</section>",
  ].join("");
}

function renderCausalReadout(
  readout: DarkHallCausalReadout | undefined,
  handoff: DarkHallCausalHandoffReadout | undefined,
): string {
  if (readout === undefined && handoff === undefined) return "";

  const corrections = readout?.corrections ?? [];
  const maxCorrections = readout?.maxCorrections ?? handoff?.maxCorrections ?? 0;
  const admission = readout?.admission ?? "open";
  const feedback = readout?.feedback;

  return [
    `<section class="zeta-room-causality"`,
    attr("aria-label", "Causal correction readout"),
    attr("data-causal-readout", readout?.schema),
    attr("data-execution-direction", readout?.executionDirection),
    attr("data-append-only", readout?.appendOnly),
    attr("data-rewrites-history", readout?.rewritesHistory),
    attr("data-correction-count", corrections.length),
    attr("data-correction-capacity", maxCorrections),
    attr("data-correction-remaining", readout?.remainingCapacity),
    attr("data-correction-admission", admission),
    attr("data-correction-feedback", feedback?.code),
    attr("data-causal-handoff-readout", handoff?.schema),
    attr("data-causal-handoff-status", handoff?.status),
    attr("data-causal-handoff-direction", handoff?.direction),
    attr("data-causal-handoff-peer", handoff?.peerTabId ?? undefined),
    attr("data-causal-handoff-corrections", handoff?.correctionCount),
    attr("data-causal-handoff-admitted", handoff?.admittedCorrections),
    attr("data-causal-handoff-pending", handoff?.pendingHandoffs),
    attr("data-causal-handoff-capacity", handoff?.maxPendingHandoffs),
    attr("data-causal-handoff-feedback", handoff?.feedback?.code),
    ">",
    '<header class="zeta-causal-header">',
    "<h2>causal corrections</h2>",
    `<p>${corrections.length.toString()} / ${maxCorrections.toString()} retained · ${escapeHtml(admission)}</p>`,
    "</header>",
    handoff === undefined
      ? ""
      : [
          '<div class="zeta-causal-handoff"',
          attr("data-handoff-status", handoff.status),
          attr("data-handoff-direction", handoff.direction),
          attr("data-handoff-id", handoff.handoffId ?? undefined),
          attr("data-handoff-peer", handoff.peerTabId ?? undefined),
          ">",
          "<span>peer handoff</span>",
          `<strong>${escapeHtml(handoff.status)} · ${escapeHtml(handoff.direction)}</strong>`,
          `<span>${escapeHtml(handoff.peerTabId ?? "no peer")} · ${handoff.correctionCount.toString()} records · ${handoff.admittedCorrections.toString()} new · ${handoff.pendingHandoffs.toString()} / ${handoff.maxPendingHandoffs.toString()} pending</span>`,
          handoff.feedback === null ? "" : `<code>${escapeHtml(handoff.feedback.code)}</code>`,
          "</div>",
        ].join(""),
    '<ol class="zeta-causal-corrections">',
    ...corrections.map((correction) =>
      [
        '<li class="zeta-causal-correction"',
        attr("data-correction-source", correction.sourceTabId),
        attr("data-correction-sequence", correction.sequence),
        attr("data-reinterprets-through", correction.reinterpretsThrough),
        attr("data-delta-rows", correction.deltaRows),
        ">",
        `<span>source ${escapeHtml(correction.sourceTabId)}</span>`,
        `<span>history ${escapeHtml(correction.reinterpretsThrough)}</span>`,
        `<span>correction ${escapeHtml(correction.sequence)}</span>`,
        `<span>delta ${correction.deltaRows.toString()}</span>`,
        "</li>",
      ].join(""),
    ),
    "</ol>",
    feedback === undefined || feedback === null
      ? ""
      : `<p class="zeta-causal-feedback" data-severity="${feedback.severity}">${escapeHtml(feedback.code)}: ${escapeHtml(feedback.detail)}</p>`,
    "</section>",
  ].join("");
}

function renderBrowserTabReadout(
  readout: BrowserTabCoordinatorReadout | undefined,
  transport: BrowserTabTransportReadout | undefined,
): string {
  if (readout === undefined) return "";

  const localState = readout.tabs.find((tab) => tab.tabId === readout.localTabId)?.state ?? "untracked";
  const heatCount = readout.feedback.filter((feedback) => feedback.severity === "heat").length;
  const pressureCount = readout.feedback.length - heatCount;
  const liveCount = readout.liveness.liveTabIds.length;
  const liveRatio = readout.tabs.length === 0 ? 0 : liveCount / readout.tabs.length;
  const style = [
    `--browser-tab-count:${readout.tabs.length.toString()}`,
    `--browser-live-count:${liveCount.toString()}`,
    `--browser-live-ratio:${liveRatio.toFixed(4)}`,
    `--browser-feedback-count:${readout.feedback.length.toString()}`,
  ].join(";");

  return [
    `<section class="zeta-room-browser"`,
    attr("aria-label", "Browser node continuity"),
    attr("data-browser-tab-readout", readout.schema),
    attr("data-browser-node", readout.nodeId),
    attr("data-browser-local-tab", readout.localTabId),
    attr("data-browser-local-state", localState),
    attr("data-browser-availability", readout.liveness.availability),
    attr("data-browser-continuity", readout.liveness.continuity),
    attr("data-browser-checkpoint", readout.liveness.checkpoint),
    attr("data-browser-alive", readout.liveness.zetaAlive),
    attr("data-browser-feedback", readout.feedback.length),
    attr("data-browser-transport-readout", transport?.schema),
    attr("data-browser-transport", transport?.selected),
    attr("style", style),
    ">",
    '<header class="zeta-browser-header">',
    "<h2>Browser node</h2>",
    `<p>${escapeHtml(readout.liveness.availability)} · ${escapeHtml(readout.liveness.continuity)}</p>`,
    "</header>",
    '<dl class="zeta-browser-summary">',
    `<div><dt>node</dt><dd>${escapeHtml(readout.nodeId)}</dd></div>`,
    `<div><dt>tabs</dt><dd>${readout.tabs.length.toString()}</dd></div>`,
    `<div><dt>live</dt><dd>${liveCount.toString()}</dd></div>`,
    `<div><dt>checkpoint</dt><dd>${escapeHtml(readout.liveness.checkpoint)}</dd></div>`,
    `<div><dt>transport</dt><dd>${escapeHtml(transport?.selected ?? "unknown")}</dd></div>`,
    `<div><dt>pressure</dt><dd>${pressureCount.toString()}</dd></div>`,
    `<div><dt>heat</dt><dd>${heatCount.toString()}</dd></div>`,
    '<div class="zeta-browser-meter" aria-hidden="true"></div>',
    "</dl>",
    '<ol class="zeta-browser-tabs">',
    ...readout.tabs.map((tab) =>
      [
        '<li class="zeta-browser-tab"',
        attr("data-tab", tab.tabId),
        attr("data-state", tab.state),
        attr("data-local", tab.tabId === readout.localTabId),
        ">",
        `<span class="zeta-browser-tab-id">${escapeHtml(tab.tabId)}</span>`,
        `<span class="zeta-browser-tab-state">${escapeHtml(tab.state)}</span>`,
        "</li>",
      ].join(""),
    ),
    "</ol>",
    "</section>",
  ].join("");
}

function renderDatabaseReadout(readout: DarkHallDatabaseReadout | undefined): string {
  if (readout === undefined) return "";

  const pressureCount = readout.feedback.filter((feedback) => feedback.severity === "backpressure").length;
  const heatCount = readout.feedback.length - pressureCount;
  const style = [
    `--database-row-count:${readout.rows.length.toString()}`,
    `--database-feedback-count:${readout.feedback.length.toString()}`,
  ].join(";");

  return [
    `<section class="zeta-room-database"`,
    attr("aria-label", "Database readout"),
    attr("data-database-readout", readout.schema),
    attr("data-database-source", readout.sourceSchema),
    attr("data-database-node", readout.nodeId),
    attr("data-database-executor", readout.executorId),
    attr("data-database-executor-kind", readout.executorKind),
    attr("data-database-revision", readout.revision),
    attr("data-database-admission", readout.admission),
    attr("data-database-rows", readout.rows.length),
    attr("data-database-feedback", readout.feedback.length),
    attr("style", style),
    ">",
    '<header class="zeta-database-header">',
    "<h2>Database</h2>",
    `<p>revision ${readout.revision.toString()} · ${escapeHtml(readout.admission)}</p>`,
    "</header>",
    '<dl class="zeta-database-summary">',
    `<div><dt>node</dt><dd>${escapeHtml(readout.nodeId)}</dd></div>`,
    `<div><dt>executor</dt><dd>${escapeHtml(readout.executorId)}</dd></div>`,
    `<div><dt>runtime</dt><dd>${escapeHtml(readout.executorKind)}</dd></div>`,
    `<div><dt>accepted</dt><dd>${readout.accepted.toString()}</dd></div>`,
    `<div><dt>duplicates</dt><dd>${readout.duplicates.toString()}</dd></div>`,
    `<div><dt>next</dt><dd>${readout.nextDeltaIndex.toString()}</dd></div>`,
    `<div><dt>pressure</dt><dd>${pressureCount.toString()}</dd></div>`,
    `<div><dt>heat</dt><dd>${heatCount.toString()}</dd></div>`,
    "</dl>",
    `<ol class="zeta-database-rows" data-empty="${String(readout.rows.length === 0)}">`,
    ...readout.rows.map((row) =>
      [
        '<li class="zeta-database-row"',
        attr("data-row-key", row.rowKey),
        attr("data-row-weight", row.weight),
        ">",
        '<button type="button" class="zeta-database-row-select"',
        attr("data-database-row-select", "true"),
        attr("data-row-key", row.rowKey),
        attr("aria-label", `Load ${row.rowKey} into the row command editor`),
        ">",
        `<code class="zeta-database-row-key">${escapeHtml(row.rowKey)}</code>`,
        `<span class="zeta-database-row-payload">${escapeHtml(row.payload)}</span>`,
        `<span class="zeta-database-row-weight">${row.weight > 0 ? "+" : ""}${row.weight.toString()}</span>`,
        "</button>",
        "</li>",
      ].join(""),
    ),
    "</ol>",
    ...(readout.rows.length === 0 ? ['<p class="zeta-database-empty">no materialized rows</p>'] : []),
    ...(readout.feedback.length === 0
      ? []
      : [
          '<ol class="zeta-database-feedback">',
          ...readout.feedback.map((feedback) =>
            [
              '<li class="zeta-database-feedback-row"',
              attr("data-severity", feedback.severity),
              attr("data-code", feedback.code),
              ">",
              `<code>${escapeHtml(feedback.code)}</code>`,
              `<span>${escapeHtml(feedback.detail)}</span>`,
              "</li>",
            ].join(""),
          ),
          "</ol>",
        ]),
    "</section>",
  ].join("");
}

function treatyFromReadouts(
  temperature: TemperatureReadout,
  blackBody: BlackBodyReadout | undefined,
): TemperatureTreatyBundle {
  if (blackBody === undefined) {
    return temperatureTreatyBundle({ temperature });
  }

  return temperatureTreatyBundle({ temperature, blackBody });
}

function countMilli(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1000, Math.trunc(value) * Math.floor(1000 / heatLaneMax));
}

function tempFromBand(band: TemperatureReadout["band"] | undefined): MindTemp {
  switch (band) {
    case "critical":
    case "hot":
      return "hot";
    case "warm":
      return "warm";
    case "cold":
    default:
      return "cool";
  }
}

function observedPhase(transcript: RoomRunTranscript): number {
  const tickPhase = transcript.ticks.reduce((phase, tick) => Math.max(phase, tick.tick), 0);
  const heatPhase = transcript.heatRows.reduce((phase, row) => Math.max(phase, row.tick), 0);

  return Math.max(tickPhase, heatPhase, transcript.travelerFrame?.commonPhase ?? 0);
}

function phaseSkewBound(phase: number, coordinates: readonly TravelerFrameCoordinate[]): number {
  return coordinates.reduce((skew, coordinate) => Math.max(skew, Math.abs(phase - coordinate.phase)), 0);
}

function phaseClockReadout(transcript: RoomRunTranscript): PhaseClockReadout {
  if (transcript.phaseClock !== undefined) return transcript.phaseClock;

  const frame = transcript.travelerFrame;
  const phase = frame?.commonPhase ?? observedPhase(transcript);
  const source = frame?.source ?? transcript.generatedBy ?? "RoomRunTranscript";
  const coordinates = frame?.coordinates ?? [];

  return {
    schema: "zeta.darkhall.phase-clock.v1",
    source,
    basis: "seed-phase",
    seed: transcript.seed,
    phase,
    skewBoundTicks: phaseSkewBound(phase, coordinates),
    appendOnly: true,
    travelers: coordinates.length,
  };
}

function selectedControllerCells(transcript: RoomRunTranscript): number {
  return normalizeControllerCells(transcript.controller).filter((cell) => cell.selected === true).length;
}

function roomTemperatureTreaty(
  transcript: RoomRunTranscript,
  heat: HeatReadout | ReturnType<typeof summarizeHeatRows>,
) {
  // Encode via `heatReceiptScale`, NOT the lossy `heatReceiptPpm` accessor: the
  // scale carries whether the count was in-domain, and that fact is destroyed by
  // the accessor. Feeding the accessor's output straight into `temperatureReadout`
  // made a blind counter (NaN / Infinity / negative) arrive as a plain `0` and be
  // reported back as `fidelity: "exact"` — a dead sensor rendered as a calm room,
  // with a field actively asserting the reading was faithful.
  // 081M010WYE5087G0R003J89QVF §1.
  const heatScale = heatReceiptScale(heat.heatRejected);
  const uncertaintyScale = heatReceiptScale(heat.storageErrors);
  const pressureScale = heatReceiptScale(heat.backpressured);
  const attentionScale = heatReceiptScale(selectedControllerCells(transcript));

  const sourceTemperature =
    transcript.temperatureTreaty?.temperature ??
    transcript.temperatureReadout ??
    temperatureReadout({
      source: transcript.roomName,
      heatPpm: heatScale.ppm,
      uncertaintyPpm: uncertaintyScale.ppm,
      pressurePpm: pressureScale.ppm,
      attentionPpm: attentionScale.ppm,
      upstreamFidelity: [
        heatScale.fidelity,
        uncertaintyScale.fidelity,
        pressureScale.fidelity,
        attentionScale.fidelity,
      ],
    });
  const sourceBlackBody = transcript.temperatureTreaty?.blackBody ?? transcript.blackBodyReadout;

  return temperatureTreatyBundle({
    temperature: sourceTemperature,
    blackBody:
      sourceBlackBody ??
      blackBodyReadout({ source: sourceTemperature.source, temperaturePpm: sourceTemperature.temperaturePpm }),
    ...(transcript.temperatureTreaty?.referenceOracle === undefined
      ? {}
      : { referenceOracle: transcript.temperatureTreaty.referenceOracle }),
    ...(transcript.temperatureTreaty?.referenceFeedback === undefined
      ? {}
      : { referenceFeedback: transcript.temperatureTreaty.referenceFeedback }),
    heatReceipts: heatReceiptsFromRows(transcript.heatRows, { source: transcript.roomName }),
  });
}

function continuationTemperature(readout: TranscriptContinuationReadout): MindTemp {
  if (readout.resumable) return "warm";
  return readout.admissionFeedback.length > 0 ? "hot" : "cool";
}

function roomPredictions(
  transcript: RoomRunTranscript,
  heat: HeatReadout | ReturnType<typeof summarizeHeatRows>,
  temperature: TemperatureReadout,
): readonly MindPrediction[] {
  const temp = tempFromBand(temperature.band);
  const backpressureTicks = transcript.ticks.filter((tick) => tick.outcome === "backpressure").length;
  const refusedTicks = transcript.ticks.filter((tick) => tick.outcome === "refused").length;
  const continuation = transcript.continuationReadout;
  const continuationPrediction: MindPrediction[] =
    continuation === undefined
      ? []
      : [
          {
            label: "continuation",
            temp: continuationTemperature(continuation),
            valueMilli: continuation.resumable ? 1000 : 0,
            epsilonMilli: countMilli(continuation.admissionFeedback.length),
          },
        ];

  return [
    {
      label: "heat receipts",
      temp,
      valueMilli: countMilli(heat.heatRejected),
      epsilonMilli: countMilli(heat.storageErrors),
    },
    {
      label: "backpressure",
      temp: heat.backpressured > 0 ? "hot" : "cool",
      valueMilli: countMilli(heat.backpressured),
      epsilonMilli: countMilli(backpressureTicks),
    },
    {
      label: "room progress",
      temp: refusedTicks > 0 ? "warm" : "cool",
      valueMilli: countMilli(transcript.ticks.length),
      epsilonMilli: countMilli(refusedTicks),
    },
    ...continuationPrediction,
  ];
}

export function roomTranscriptToLlmtv(
  transcript: RoomRunTranscript,
  options: RoomTranscriptLlmtvOptions = {},
): LlmtvTranscript {
  const heat = transcript.heatReadout ?? summarizeHeatRows(transcript.heatRows);
  const temperatureTreaty = roomTemperatureTreaty(transcript, heat);
  const phaseClock = phaseClockReadout(transcript);
  const frame = phaseClock.phase;
  const baseMind: DwellerMind = {
    name: options.name ?? transcript.roomName,
    role: options.role ?? "room runtime",
    hat: options.hat ?? "room readout",
    live: options.live ?? true,
    predictions: roomPredictions(transcript, heat, temperatureTreaty.temperature),
    phaseClock,
    temperatureTreaty,
    ...(transcript.causalReadout === undefined ? {} : { causalReadout: transcript.causalReadout }),
    ...(transcript.causalHandoffReadout === undefined ? {} : { causalHandoffReadout: transcript.causalHandoffReadout }),
  };
  const mind = { ...baseMind, frame };

  return {
    schema: "zeta.darkhall.llmtv.v1",
    seed: transcript.seed,
    dwellers: [mind],
    phaseClock,
    generatedBy: options.generatedBy ?? `${transcript.generatedBy ?? "RoomRunTranscript"} -> llmtv`,
  };
}

export function renderDarkHallRoomHtml(transcript: RoomRunTranscript): string {
  const cells = normalizeControllerCells(transcript.controller);
  const heat = transcript.heatReadout ?? summarizeHeatRows(transcript.heatRows);
  const sourceTemperature = transcript.temperatureTreaty?.temperature ?? transcript.temperatureReadout;
  const sourceBlackBody = transcript.temperatureTreaty?.blackBody ?? transcript.blackBodyReadout;
  const inferredBlackBody =
    sourceBlackBody ??
    (sourceTemperature === undefined
      ? undefined
      : blackBodyReadout({ source: sourceTemperature.source, temperaturePpm: sourceTemperature.temperaturePpm }));
  const temperatureTreaty =
    transcript.temperatureTreaty ??
    (sourceTemperature === undefined ? undefined : treatyFromReadouts(sourceTemperature, inferredBlackBody));
  const temperature = temperatureTreaty?.temperature ?? sourceTemperature;
  const blackBody =
    temperatureTreaty?.blackBody ??
    inferredBlackBody ??
    (temperature === undefined
      ? undefined
      : blackBodyReadout({ source: temperature.source, temperaturePpm: temperature.temperaturePpm }));
  const temperatureFeedback =
    temperatureTreaty === undefined || temperatureTreaty.referenceFeedback.length === 0
      ? undefined
      : temperatureTreaty.referenceFeedback.join(" ");
  const travelerFrame = transcript.travelerFrame;
  const phaseClock = phaseClockReadout(transcript);
  const continuation = transcript.continuationReadout;
  const causality = transcript.causalReadout;
  const causalHandoff = transcript.causalHandoffReadout;
  const continuationStatusValue = continuation === undefined ? undefined : continuationStatus(continuation);
  const browser = transcript.browserTabReadout;
  const browserTransport = transcript.browserTransportReadout;
  const database = transcript.databaseReadout;
  const browserLocalState = browser?.tabs.find((tab) => tab.tabId === browser.localTabId)?.state ?? undefined;
  const generatedBy = transcript.generatedBy ?? "source-owned transcript";

  return [
    `<section class="zeta-room"`,
    attr("data-schema", transcript.schema),
    attr("data-room", transcript.roomName),
    attr("data-heat", heat.heatRejected > 0 ? "hot" : "cold"),
    attr("data-heat-readout", transcript.heatReadout?.schema),
    attr("data-heat-treaty", transcript.heatReadout?.qsharpTreaty),
    attr("data-qsharp-source", transcript.heatReadout?.qsharpSource),
    attr("data-temperature-readout", temperature?.schema),
    attr("data-temperature-treaty", temperatureTreaty?.qsharpTreaty),
    attr("data-temperature-qsharp-source", temperatureTreaty?.qsharpSource),
    attr("data-temperature-oracle", temperatureTreaty?.referenceOracle),
    attr("data-temperature-feedback", temperatureFeedback),
    attr("data-temperature-ppm", temperature?.temperaturePpm),
    attr("data-temperature-band", temperature?.band),
    // The band alone cannot distinguish an idle room from a blind one — both read
    // `cold`. The fidelity attribute is what makes the difference visible on the
    // surface rather than merely present in the value. 081M010WYE5087G0R003J89QVF §1.
    attr("data-temperature-fidelity", temperature?.fidelity),
    attr("data-black-body-readout", blackBody?.schema),
    attr("data-black-body-radiance", blackBody?.radiancePpm),
    attr("data-black-body-peak-frequency", blackBody?.peakFrequencyPpm),
    attr("data-traveler-frame", travelerFrame?.schema),
    attr("data-traveler-phase", travelerFrame?.commonPhase),
    attr("data-phase-clock", phaseClock.schema),
    attr("data-phase-clock-basis", phaseClock.basis),
    attr("data-phase", phaseClock.phase),
    attr("data-phase-skew-bound", phaseClock.skewBoundTicks),
    attr("data-phase-append-only", phaseClock.appendOnly),
    attr("data-continuation-readout", continuation?.schema),
    attr("data-continuation-status", continuationStatusValue),
    attr("data-continuation-loop", continuation?.loopId),
    attr("data-continuation-stop", continuation?.stopReason),
    attr("data-continuation-next-lap", continuation?.nextLap),
    attr("data-continuation-resume-base-tick", continuation?.resumeBaseTick),
    attr("data-causal-readout", causality?.schema),
    attr("data-execution-direction", causality?.executionDirection),
    attr("data-rewrites-history", causality?.rewritesHistory),
    attr("data-correction-count", causality?.corrections.length),
    attr("data-correction-capacity", causality?.maxCorrections),
    attr("data-correction-remaining", causality?.remainingCapacity),
    attr("data-correction-admission", causality?.admission),
    attr("data-correction-feedback", causality?.feedback?.code),
    attr("data-causal-handoff-readout", causalHandoff?.schema),
    attr("data-causal-handoff-status", causalHandoff?.status),
    attr("data-causal-handoff-direction", causalHandoff?.direction),
    attr("data-causal-handoff-id", causalHandoff?.handoffId ?? undefined),
    attr("data-causal-handoff-peer", causalHandoff?.peerTabId ?? undefined),
    attr("data-causal-handoff-corrections", causalHandoff?.correctionCount),
    attr("data-causal-handoff-admitted", causalHandoff?.admittedCorrections),
    attr("data-causal-handoff-pending", causalHandoff?.pendingHandoffs),
    attr("data-causal-handoff-capacity", causalHandoff?.maxPendingHandoffs),
    attr("data-causal-handoff-feedback", causalHandoff?.feedback?.code),
    attr("data-browser-tab-readout", browser?.schema),
    attr("data-browser-node", browser?.nodeId),
    attr("data-browser-local-tab", browser?.localTabId),
    attr("data-browser-local-state", browserLocalState),
    attr("data-browser-availability", browser?.liveness.availability),
    attr("data-browser-continuity", browser?.liveness.continuity),
    attr("data-browser-alive", browser?.liveness.zetaAlive),
    attr("data-browser-feedback", browser?.feedback.length),
    attr("data-browser-transport-readout", browserTransport?.schema),
    attr("data-browser-transport", browserTransport?.selected),
    attr("data-database-readout", database?.schema),
    attr("data-database-node", database?.nodeId),
    attr("data-database-executor", database?.executorId),
    attr("data-database-executor-kind", database?.executorKind),
    attr("data-database-revision", database?.revision),
    attr("data-database-admission", database?.admission),
    attr("data-database-rows", database?.rows.length),
    attr("data-database-feedback", database?.feedback.length),
    ">",
    '<header class="zeta-room-header">',
    `<h1>${escapeHtml(transcript.roomName)}</h1>`,
    `<p>${escapeHtml(generatedBy)} · seed ${escapeHtml(transcript.seed)}</p>`,
    '<dl class="zeta-room-summary">',
    `<div><dt>ticks</dt><dd>${transcript.ticks.length.toString()}</dd></div>`,
    `<div><dt>heat</dt><dd>${heat.heatRejected.toString()}</dd></div>`,
    `<div><dt>pressure</dt><dd>${heat.backpressured.toString()}</dd></div>`,
    `<div><dt>temperature</dt><dd>${(temperature?.temperaturePpm ?? 0).toString()}</dd></div>`,
    `<div><dt>radiance</dt><dd>${(blackBody?.radiancePpm ?? 0).toString()}</dd></div>`,
    `<div><dt>frame</dt><dd>${phaseClock.phase.toString()}</dd></div>`,
    `<div><dt>skew</dt><dd>${phaseClock.skewBoundTicks.toString()}</dd></div>`,
    `<div><dt>resume</dt><dd>${escapeHtml(continuationStatusValue ?? "none")}</dd></div>`,
    ...(causality === undefined
      ? []
      : [
          `<div><dt>direction</dt><dd>${escapeHtml(causality.executionDirection)}</dd></div>`,
          `<div><dt>corrections</dt><dd>${causality.corrections.length.toString()}</dd></div>`,
        ]),
    ...(causalHandoff === undefined ? [] : [`<div><dt>handoff</dt><dd>${escapeHtml(causalHandoff.status)}</dd></div>`]),
    `<div><dt>signals</dt><dd>${escapeHtml(heat.signals.join(", ") || "cold")}</dd></div>`,
    ...(browser === undefined
      ? []
      : [
          `<div><dt>tabs</dt><dd>${browser.tabs.length.toString()}</dd></div>`,
          `<div><dt>live tabs</dt><dd>${browser.liveness.liveTabIds.length.toString()}</dd></div>`,
        ]),
    ...(database === undefined
      ? []
      : [
          `<div><dt>db revision</dt><dd>${database.revision.toString()}</dd></div>`,
          `<div><dt>db rows</dt><dd>${database.rows.length.toString()}</dd></div>`,
        ]),
    "</dl>",
    "</header>",
    '<section class="zeta-room-controller" aria-label="Dark Hall controller readout">',
    '<ol class="zeta-room-grid">',
    ...cells.map(renderControllerCell),
    "</ol>",
    "</section>",
    `<section class="zeta-room-heat" data-empty="${String(transcript.heatRows.length === 0)}" aria-label="Heat board">`,
    '<ol class="zeta-heat-board">',
    ...transcript.heatRows.map(renderHeatRow),
    "</ol>",
    ...(transcript.heatRows.length === 0 ? ['<p class="zeta-room-cold">cold</p>'] : []),
    "</section>",
    renderContinuationReadout(continuation),
    renderCausalReadout(causality, causalHandoff),
    renderBrowserTabReadout(browser, browserTransport),
    renderDatabaseReadout(database),
    ...(transcript.sLanes && transcript.sLanes.length > 0
      ? [
          '<section class="zeta-room-coordination" aria-label="Coordination board (CHSH S-lanes; above 2 convicts a common cause)">',
          '<ol class="zeta-s-board">',
          ...transcript.sLanes.map(renderSLane),
          "</ol>",
          "</section>",
        ]
      : []),
    '<section class="zeta-room-transcript" aria-label="Room transcript">',
    "<ol>",
    ...transcript.ticks.map(renderTick),
    "</ol>",
    "</section>",
    "</section>",
  ].join("");
}

export function renderDarkHallRoomDocument(transcript: RoomRunTranscript, options: RenderDocumentOptions = {}): string {
  const title = options.title ?? `${transcript.roomName} room`;
  const stylesheet =
    options.inlineCss === undefined
      ? `<link rel="stylesheet" href="${escapeHtml(options.stylesheetHref ?? "./darkhall-room.css")}">`
      : `<style>${options.inlineCss}</style>`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    stylesheet,
    "</head>",
    "<body>",
    renderDarkHallRoomHtml(transcript),
    "</body>",
    "</html>",
  ].join("\n");
}
