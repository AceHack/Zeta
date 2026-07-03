import { heatSignals, summarizeHeatRows, type HeatReadout, type HeatRow } from "./heat";

export {
  classifyHeatKind,
  HEAT_FSHARP_SURFACE,
  HEAT_READOUT_SCHEMA,
  HEAT_SIGNAL_QSHARP_SOURCE,
  HEAT_SIGNAL_TREATY_PATH,
  heatSignals,
  heatSignalsFromKinds,
  normalizeHeatSignals,
  summarizeHeatRows,
  type HeatReadout,
  type HeatRow,
  type HeatSignal,
  type HeatSummary,
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

export interface RoomRunTranscript {
  readonly schema: "zeta.darkhall.room-ui.v1";
  readonly roomName: string;
  readonly seed: string;
  readonly controller: readonly ControllerCell[];
  readonly ticks: readonly RoomTranscriptTick[];
  readonly heatRows: readonly HeatRow[];
  readonly heatReadout?: HeatReadout;
  readonly sLanes?: readonly SLane[];
  readonly generatedBy?: string;
}

export interface RenderDocumentOptions {
  readonly title?: string;
  readonly stylesheetHref?: string;
  readonly inlineCss?: string;
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

export function renderDarkHallRoomHtml(transcript: RoomRunTranscript): string {
  const cells = normalizeControllerCells(transcript.controller);
  const heat = transcript.heatReadout ?? summarizeHeatRows(transcript.heatRows);
  const generatedBy = transcript.generatedBy ?? "source-owned transcript";

  return [
    `<section class="zeta-room"`,
    attr("data-schema", transcript.schema),
    attr("data-room", transcript.roomName),
    attr("data-heat", heat.heatRejected > 0 ? "hot" : "cold"),
    attr("data-heat-readout", transcript.heatReadout?.schema),
    attr("data-heat-treaty", transcript.heatReadout?.qsharpTreaty),
    attr("data-qsharp-source", transcript.heatReadout?.qsharpSource),
    ">",
    '<header class="zeta-room-header">',
    `<h1>${escapeHtml(transcript.roomName)}</h1>`,
    `<p>${escapeHtml(generatedBy)} · seed ${escapeHtml(transcript.seed)}</p>`,
    '<dl class="zeta-room-summary">',
    `<div><dt>ticks</dt><dd>${transcript.ticks.length.toString()}</dd></div>`,
    `<div><dt>heat</dt><dd>${heat.heatRejected.toString()}</dd></div>`,
    `<div><dt>pressure</dt><dd>${heat.backpressured.toString()}</dd></div>`,
    `<div><dt>signals</dt><dd>${escapeHtml(heat.signals.join(", ") || "cold")}</dd></div>`,
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
