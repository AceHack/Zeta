import {
  blackBodyReadout,
  heatReceiptPpm,
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
import type { DwellerMind, LlmtvTranscript, MindPrediction, MindTemp, PhaseClockReadout } from "./darkhall-tv";

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
  heatReceiptsFromRows,
  heatSignals,
  heatSignalsFromKinds,
  normalizeHeatSignals,
  summarizeHeatRows,
  temperatureBand,
  temperatureReadout,
  temperatureTreatyBundle,
  thermalPpm,
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
  readonly browserTabReadout?: BrowserTabCoordinatorReadout;
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

  return [
    `<li class="zeta-room-cell"`,
    attr("data-cell", cell.cell),
    attr("data-state", state),
    attr("data-selected", cell.selected === true ? "true" : undefined),
    attr("data-gate", cell.gate),
    attr("data-action-class", cell.actionClass),
    ">",
    `<span class="zeta-room-cell-index">${cell.cell.toString().padStart(2, "0")}</span>`,
    `<span class="zeta-room-cell-label">${label}</span>`,
    actionId.length > 0 ? `<span class="zeta-room-cell-action">${escapeHtml(actionId)}</span>` : "",
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

function renderBrowserTabReadout(readout: BrowserTabCoordinatorReadout | undefined): string {
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
  const sourceTemperature =
    transcript.temperatureTreaty?.temperature ??
    transcript.temperatureReadout ??
    temperatureReadout({
      source: transcript.roomName,
      heatPpm: heatReceiptPpm(heat.heatRejected),
      uncertaintyPpm: heatReceiptPpm(heat.storageErrors),
      pressurePpm: heatReceiptPpm(heat.backpressured),
      attentionPpm: heatReceiptPpm(selectedControllerCells(transcript)),
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
            temp: continuation.resumable ? "warm" : continuation.admissionFeedback.length > 0 ? "hot" : "cool",
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
  const continuationStatusValue = continuation === undefined ? undefined : continuationStatus(continuation);
  const browser = transcript.browserTabReadout;
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
    attr("data-browser-tab-readout", browser?.schema),
    attr("data-browser-node", browser?.nodeId),
    attr("data-browser-local-tab", browser?.localTabId),
    attr("data-browser-local-state", browserLocalState),
    attr("data-browser-availability", browser?.liveness.availability),
    attr("data-browser-continuity", browser?.liveness.continuity),
    attr("data-browser-alive", browser?.liveness.zetaAlive),
    attr("data-browser-feedback", browser?.feedback.length),
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
    `<div><dt>signals</dt><dd>${escapeHtml(heat.signals.join(", ") || "cold")}</dd></div>`,
    ...(browser === undefined
      ? []
      : [
          `<div><dt>tabs</dt><dd>${browser.tabs.length.toString()}</dd></div>`,
          `<div><dt>live tabs</dt><dd>${browser.liveness.liveTabIds.length.toString()}</dd></div>`,
        ]),
    "</dl>",
    "</header>",
    '<section class="zeta-room-controller" aria-label="Dark Hall controller readout">',
    '<ol class="zeta-room-grid">',
    ...cells.map(renderControllerCell),
    "</ol>",
    "</section>",
    '<section class="zeta-room-heat" aria-label="Heat board">',
    '<ol class="zeta-heat-board">',
    ...transcript.heatRows.map(renderHeatRow),
    "</ol>",
    "</section>",
    renderContinuationReadout(continuation),
    renderBrowserTabReadout(browser),
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
