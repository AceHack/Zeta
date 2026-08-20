// LLMTV — the dark hall's innermost surface: what goes on in the MIND of each
// vault dweller, rendered quality-per-glyph (QPG over DPI). This is the generator
// for hall/tv/ — the homoiconic twin of darkhall-room.ts: a typed transcript in,
// deterministic zero-JS HTML out. DU cases become data-attributes; soft (value, ε)
// predictions travel as INTEGER MILLI (no floats in the transcript bytes — same
// DST byte-lock discipline as SLane.sMilli in darkhall-room.ts).
//
// The privacy split is load-bearing, not decoration (privacy-budget-is-hard-money):
// a dweller's `predictions` are REQUIRED-FOR-ROLE — the hat broadcasts them. A
// `frost` region is a PERSONAL mind-part the dweller earned permanent privacy over;
// the generator renders only its public veil label (blurred), NEVER its contents.
// Consent-first (§6): the substrate cannot emit what was frosted.

import {
  MAX_TEMPERATURE_PPM,
  heatReceiptReading,
  type ChannelFidelity,
  type HeatReceipt,
  type HeatSignal,
  type TemperatureTreatyBundle,
} from "./heat";
import type { DarkHallCausalHandoffReadout, DarkHallCausalReadout } from "./darkhall-causal-readout";

/// Attention temperature — where a prediction sits on the LLMTV salience axis.
/// hot = high-salience / rising attention, cool = settled. A DU, not a hand-coded
/// class: it renders to `data-temp`, and the CSS colors the bar off that attribute.
export type MindTemp = "hot" | "warm" | "cool";

/// One soft prediction the room holds OPEN (not collapsed): the (value, ε) pair.
/// value + epsilon travel as integer milli in [0, 1000] — deterministic bytes.
export interface MindPrediction {
  readonly label: string;
  readonly temp: MindTemp;
  readonly valueMilli: number; // soft value → bar fill
  readonly epsilonMilli: number; // ± uncertainty the prediction admits
}

/// An earned personal frost region. Only its PUBLIC veil label is ever rendered
/// (blurred, opaque). The real content is not a field here — the substrate holds
/// nothing to leak. Frost is priced privacy: hard money, socially conferred,
/// inviolable once earned.
export interface FrostRegion {
  readonly veilLabel: string;
}

/// A dweller's mind on LLMTV. `predictions` broadcast because the `hat` requires
/// them; `frost` (optional) is the personal region the dweller sealed.
export interface DwellerMind {
  readonly name: string;
  readonly role: string; // subtitle, e.g. "coding · qwen3-coder"
  readonly hat: string; // required-for-role hat, e.g. "coder hat"
  readonly predictions: readonly MindPrediction[];
  readonly live?: boolean;
  readonly frost?: FrostRegion;
  readonly frame?: number; // transcript-tick id (the still frame's number)
  readonly phaseClock?: PhaseClockReadout;
  readonly temperatureTreaty?: TemperatureTreatyBundle;
  readonly causalReadout?: DarkHallCausalReadout;
  readonly causalHandoffReadout?: DarkHallCausalHandoffReadout;
}

export type PhaseClockBasis = "seed-phase";

export const PHASE_CLOCK_SCHEMA = "zeta.darkhall.phase-clock.v1";
export const PHASE_CLOCK_BASIS = "seed-phase";

export interface PhaseClockReadout {
  readonly schema: "zeta.darkhall.phase-clock.v1";
  readonly source: string;
  readonly basis: PhaseClockBasis;
  readonly seed: string;
  readonly phase: number;
  readonly skewBoundTicks: number;
  readonly appendOnly: boolean;
  readonly travelers: number;
}

export interface LlmtvTranscript {
  readonly schema: "zeta.darkhall.llmtv.v1";
  readonly seed: string;
  readonly dwellers: readonly DwellerMind[];
  readonly phaseClock?: PhaseClockReadout;
  readonly generatedBy?: string;
}

export type LlmtvReadoutStatusKind = "live" | "cold" | "stale" | "heat";

export interface LlmtvReadoutMetric {
  readonly label: string;
  readonly value: string | number;
}

export interface LlmtvReadoutStatus {
  readonly kind: LlmtvReadoutStatusKind;
  readonly label: string;
  readonly detail: string;
  readonly source: string;
  readonly metrics: readonly LlmtvReadoutMetric[];
  readonly heatSignals?: readonly HeatSignal[];
}

export interface RenderDocumentOptions {
  readonly title?: string;
  readonly stylesheetHref?: string;
  readonly inlineCss?: string;
  readonly readoutStatus?: LlmtvReadoutStatus;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function attr(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  return ` ${name}="${escapeHtml(String(value))}"`;
}

/// Clamp to an integer milli in [0, 1000] — the transcript's quantity unit.
export function clampMilli(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1000, Math.trunc(value));
}

/// The bar fill as a CSS width percentage — value/1000 rendered to one decimal.
export function fillWidth(valueMilli: number): string {
  return `${(clampMilli(valueMilli) / 10).toFixed(1)}%`;
}

/// The soft (value ± ε) readout as ".82 ± .12" — leading zero stripped, QPG-tight.
export function softText(valueMilli: number, epsilonMilli: number): string {
  const dot2 = (m: number): string => (clampMilli(m) / 1000).toFixed(2).replace(/^0(?=\.)/, "");
  return `${dot2(valueMilli)} ± ${dot2(epsilonMilli)}`;
}

function ppmText(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 ppm";
  return `${Math.min(MAX_TEMPERATURE_PPM, Math.trunc(value)).toString()} ppm`;
}

function ppmRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.000000";
  return (Math.min(MAX_TEMPERATURE_PPM, Math.trunc(value)) / MAX_TEMPERATURE_PPM).toFixed(6);
}

const lockSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">' +
  '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

function renderPrediction(pred: MindPrediction): string {
  return [
    `<div class="pred"`,
    attr("data-temp", pred.temp),
    attr("style", `--v:${fillWidth(pred.valueMilli)}`),
    ">",
    `<span class="lbl">${escapeHtml(pred.label)}</span>`,
    `<span class="bar"><i></i></span>`,
    `<span class="n">${escapeHtml(softText(pred.valueMilli, pred.epsilonMilli))}</span>`,
    "</div>",
  ].join("");
}

function renderRequiredBand(hat: string): string {
  return `<div class="band"><span class="k req" data-kind="required">required · ${escapeHtml(hat)}</span><span class="hr"></span></div>`;
}

function renderCausalLane(
  readout: DarkHallCausalReadout | undefined,
  handoff: DarkHallCausalHandoffReadout | undefined,
): string {
  const corrections = readout?.corrections ?? [];
  const maxCorrections = readout?.maxCorrections ?? handoff?.maxCorrections ?? 0;
  const admission = readout?.admission ?? "open";
  const feedback = readout?.feedback;
  return [
    `<div class="causal-lane"`,
    attr("data-causal-readout", readout?.schema),
    attr("data-causal-source", readout?.sourceSchema),
    attr("data-correction-admission", admission),
    attr("data-correction-count", corrections.length),
    attr("data-correction-capacity", maxCorrections),
    attr("data-correction-remaining", readout?.remainingCapacity),
    attr("data-correction-feedback", feedback?.code),
    attr("data-causal-handoff-readout", handoff?.schema),
    attr("data-causal-handoff-status", handoff?.status),
    attr("data-causal-handoff-direction", handoff?.direction),
    attr("data-causal-handoff-id", handoff?.handoffId ?? undefined),
    attr("data-causal-handoff-peer", handoff?.peerTabId ?? undefined),
    attr("data-causal-handoff-corrections", handoff?.correctionCount),
    attr("data-causal-handoff-admitted", handoff?.admittedCorrections),
    attr("data-causal-handoff-pending", handoff?.pendingHandoffs),
    attr("data-causal-handoff-capacity", handoff?.maxPendingHandoffs),
    attr("data-causal-handoff-feedback", handoff?.feedback?.code),
    ">",
    '<div class="causal-band">',
    `<span>causal corrections · ${escapeHtml(admission)}</span>`,
    `<i></i><b>${corrections.length.toString()} / ${maxCorrections.toString()}</b>`,
    "</div>",
    handoff === undefined
      ? ""
      : [
          '<div class="causal-handoff"',
          attr("data-handoff-status", handoff.status),
          attr("data-handoff-direction", handoff.direction),
          attr("data-handoff-id", handoff.handoffId ?? undefined),
          attr("data-handoff-peer", handoff.peerTabId ?? undefined),
          ">",
          `<span>handoff · ${escapeHtml(handoff.status)}</span>`,
          `<span>${escapeHtml(handoff.peerTabId ?? "no peer")}</span>`,
          `<b>${handoff.correctionCount.toString()} records · ${handoff.admittedCorrections.toString()} new · ${handoff.pendingHandoffs.toString()} / ${handoff.maxPendingHandoffs.toString()} pending</b>`,
          "</div>",
        ].join(""),
    '<ol class="causal-rows">',
    ...corrections.map(
      (correction) =>
        `<li data-source="${escapeHtml(correction.sourceTabId)}" data-sequence="${escapeHtml(correction.sequence)}"><span>${escapeHtml(correction.sourceTabId)}</span><span>${escapeHtml(correction.reinterpretsThrough)} &rarr; ${escapeHtml(correction.sequence)}</span><b>+${correction.deltaRows.toString()}</b></li>`,
    ),
    "</ol>",
    feedback === undefined || feedback === null
      ? ""
      : `<p data-severity="${feedback.severity}">${escapeHtml(feedback.code)}: ${escapeHtml(feedback.detail)}</p>`,
    "</div>",
  ].join("");
}

/// The frost pair: the "personal · frosted" band + the opaque veil. The veil shows
/// only the region's public label (blurred); its contents are never in the DOM.
function renderFrost(frost: FrostRegion): string {
  return [
    `<div class="band"><span class="k pers" data-kind="personal">personal · frosted</span><span class="hr"></span></div>`,
    `<div class="frost" data-frost="earned">`,
    `<div class="veil">${escapeHtml(frost.veilLabel)}</div>`,
    `<div class="lock">${lockSvg}&nbsp;earned · permanent</div>`,
    "</div>",
  ].join("");
}

/**
 * The words appended to a band label when the reading is not faithful.
 *
 * The band token alone cannot say this — the four tokens are a four-oracle treaty
 * and `cold` is what a blind sensor and an idle room BOTH produce. A colour
 * change alone would not say it either: `cold` already renders in the muted
 * `--txt3`, so a reader has no way to know whether the muteness means "quiet" or
 * "not measured". The text is the part an operator can actually check.
 *
 * `exact` adds nothing, so a healthy lane is unchanged.
 */
function fidelitySuffix(fidelity: ChannelFidelity | undefined): string {
  switch (fidelity) {
    case "out-of-domain":
      return " · SENSOR FAULT · no reading";
    case "saturated":
      return " · PINNED · at or above ceiling";
    case "below-resolution":
      return " · below resolution";
    case "exact":
      return "";
    // `fidelity` is OPTIONAL on the value (`heat.ts` — `readonly fidelity?:`),
    // so `undefined` reaches here whenever a producer never classified the
    // channel. It must not share the `exact` branch: an empty suffix is the
    // readout for a channel we checked and found faithful, and reusing it for
    // one we never checked is this file's own defect — the encoder saying
    // "exact" about a sensor whose state it does not know. Unreported and
    // clean are different claims, so they get different readouts.
    default:
      return " · fidelity not reported";
  }
}

function renderTemperatureMetric(label: string, kind: string, ppm: number): string {
  return [
    `<span class="temp-metric"`,
    attr("data-kind", kind),
    attr("style", `--ppm:${ppmRatio(ppm)}`),
    ">",
    `<b>${escapeHtml(label)}</b>`,
    '<span class="rail"><i></i></span>',
    `<em>${escapeHtml(ppmText(ppm))}</em>`,
    "</span>",
  ].join("");
}

function compactText(values: readonly string[], fallback: string): string {
  return values.length === 0 ? fallback : values.join(", ");
}

/**
 * The worded half of the third state.
 *
 * Colour alone cannot carry it: a quiet receipt already renders muted, so a
 * receipt that was never measured would render muted too and the eye could not
 * tell "nothing happened" from "nothing was looked at". The words are the
 * channel that separates them; the attribute is what CSS and an auditor read.
 */
function receiptReadingNote(receipt: HeatReceipt): string {
  const reading = heatReceiptReading(receipt);
  if (reading === "measured") return "";
  if (reading === "unreported") return " · signal provenance not reported";
  return ` · NOT MEASURED · ${(receipt.signalObservations ?? 0).toString()} observations — unknown, not cold`;
}

function renderHeatReceipt(receipt: HeatReceipt): string {
  const reason = compactText(receipt.reasons, compactText(receipt.heatKinds, "no detail"));

  return [
    `<span class="heat-receipt"`,
    attr("data-heat-receipt-schema", receipt.schema),
    attr("data-outcome", receipt.outcome),
    attr("data-policy", receipt.policy),
    attr("data-source", receipt.source),
    attr("data-room", receipt.roomName),
    attr("data-tick", receipt.tick),
    attr("data-signals", compactText(receipt.signals, "cold")),
    attr("data-signal-reading", heatReceiptReading(receipt)),
    attr("data-signal-source", receipt.signalSource),
    attr("data-signal-observations", receipt.signalObservations),
    attr(
      "style",
      `--heat:${ppmRatio(receipt.heatPpm)};--pressure:${ppmRatio(receipt.pressurePpm)};--storage:${ppmRatio(receipt.storagePpm)}`,
    ),
    ">",
    `<b>${escapeHtml(receipt.outcome)}</b>`,
    '<span class="receipt-rails"><i></i><i></i><i></i></span>',
    `<em>${escapeHtml(receipt.policy)}</em>`,
    `<small>${escapeHtml(reason + receiptReadingNote(receipt))}</small>`,
    "</span>",
  ].join("");
}

function renderHeatReceipts(receipts: readonly HeatReceipt[] | undefined): string {
  if (receipts === undefined || receipts.length === 0) return "";

  const outcomes = compactText(
    receipts.map((receipt) => receipt.outcome),
    "cold",
  );
  const policies = compactText(
    receipts.map((receipt) => receipt.policy),
    "unknown",
  );

  return [
    `<div class="heat-receipts"`,
    attr("data-heat-receipts", receipts.length),
    attr("data-outcomes", outcomes),
    attr("data-policies", policies),
    ">",
    ...receipts.map(renderHeatReceipt),
    "</div>",
  ].join("");
}

function renderTemperatureLane(treaty: TemperatureTreatyBundle): string {
  const temperature = treaty.temperature;
  const blackBody = treaty.blackBody;

  return [
    `<div class="temp-lane"`,
    attr("data-temperature-lane", "present"),
    attr("data-temperature-band", temperature.band),
    // Without this the lane paints a blind sensor exactly like an idle room: both
    // are `cold`, and the CSS below has no other hook to tell them apart.
    // 081M010WYE5087G0R003J89QVF §1.
    attr("data-temperature-fidelity", temperature.fidelity),
    attr("data-temperature-source", temperature.source),
    attr("data-temperature-oracle", treaty.referenceOracle),
    ">",
    '<div class="temp-band">',
    `<span>black-body · ${escapeHtml(temperature.band)}${escapeHtml(fidelitySuffix(temperature.fidelity))}</span>`,
    "<i></i>",
    "</div>",
    '<div class="temp-stack">',
    renderTemperatureMetric("temp", "temperature", temperature.temperaturePpm),
    renderTemperatureMetric("rad", "radiance", blackBody.radiancePpm),
    renderTemperatureMetric("peak", "peak-frequency", blackBody.peakFrequencyPpm),
    "</div>",
    '<div class="temp-meta">',
    `<span><b>src</b><i>${escapeHtml(temperature.source)}</i></span>`,
    `<span><b>oracle</b><i>${escapeHtml(treaty.referenceOracle)}</i></span>`,
    "</div>",
    renderHeatReceipts(treaty.heatReceipts),
    "</div>",
  ].join("");
}

export function renderDweller(mind: DwellerMind, seed: string): string {
  const frame = mind.frame;
  const live = mind.live ?? true;
  const temperatureTreaty = mind.temperatureTreaty;
  const temperature = temperatureTreaty?.temperature;
  const blackBody = temperatureTreaty?.blackBody;
  const heatReceipts = temperatureTreaty?.heatReceipts;
  const phaseClock = mind.phaseClock;
  const causalReadout = mind.causalReadout;
  const causalHandoffReadout = mind.causalHandoffReadout;
  const temperatureFeedback =
    temperatureTreaty === undefined || temperatureTreaty.referenceFeedback.length === 0
      ? undefined
      : temperatureTreaty.referenceFeedback.join(" ");

  return [
    `<div class="tv"`,
    attr("data-dweller", mind.name),
    attr("data-live", live ? "true" : "false"),
    attr("data-frosted", mind.frost ? "true" : "false"),
    attr("data-phase-clock", phaseClock?.schema),
    attr("data-phase-clock-basis", phaseClock?.basis),
    attr("data-phase", phaseClock?.phase),
    attr("data-phase-skew-bound", phaseClock?.skewBoundTicks),
    attr("data-phase-travelers", phaseClock?.travelers),
    attr("data-phase-append-only", phaseClock?.appendOnly === undefined ? undefined : String(phaseClock.appendOnly)),
    attr("data-temperature-treaty", temperatureTreaty?.qsharpTreaty),
    attr("data-temperature-qsharp-source", temperatureTreaty?.qsharpSource),
    attr("data-temperature-oracle", temperatureTreaty?.referenceOracle),
    attr("data-temperature-feedback", temperatureFeedback),
    attr("data-temperature-ppm", temperature?.temperaturePpm),
    attr("data-temperature-band", temperature?.band),
    attr("data-temperature-fidelity", temperature?.fidelity),
    attr("data-black-body-readout", blackBody?.schema),
    attr("data-black-body-radiance", blackBody?.radiancePpm),
    attr("data-black-body-peak-frequency", blackBody?.peakFrequencyPpm),
    attr("data-heat-receipts", heatReceipts === undefined ? undefined : heatReceipts.length),
    attr("data-causal-readout", causalReadout?.schema),
    attr("data-correction-admission", causalReadout?.admission),
    attr("data-correction-count", causalReadout?.corrections.length),
    attr("data-correction-capacity", causalReadout?.maxCorrections),
    attr("data-causal-handoff-readout", causalHandoffReadout?.schema),
    attr("data-causal-handoff-status", causalHandoffReadout?.status),
    attr("data-causal-handoff-direction", causalHandoffReadout?.direction),
    attr("data-causal-handoff-id", causalHandoffReadout?.handoffId ?? undefined),
    attr("data-causal-handoff-peer", causalHandoffReadout?.peerTabId ?? undefined),
    attr("data-causal-handoff-corrections", causalHandoffReadout?.correctionCount),
    attr("data-causal-handoff-admitted", causalHandoffReadout?.admittedCorrections),
    attr("data-causal-handoff-pending", causalHandoffReadout?.pendingHandoffs),
    attr("data-causal-handoff-capacity", causalHandoffReadout?.maxPendingHandoffs),
    attr("data-causal-handoff-feedback", causalHandoffReadout?.feedback?.code),
    ">",
    `<div class="tv-head">`,
    `<div class="who">${escapeHtml(mind.name)} <small>${escapeHtml(mind.role)}</small></div>`,
    live ? `<div class="live">live</div>` : "",
    "</div>",
    `<div class="mind">`,
    renderRequiredBand(mind.hat),
    ...mind.predictions.map(renderPrediction),
    causalReadout === undefined && causalHandoffReadout === undefined
      ? ""
      : renderCausalLane(causalReadout, causalHandoffReadout),
    temperatureTreaty === undefined ? "" : renderTemperatureLane(temperatureTreaty),
    mind.frost ? renderFrost(mind.frost) : "",
    "</div>",
    `<div class="tv-foot"><span>seed ${escapeHtml(seed)}</span>${frame === undefined ? "" : `<span>frame ${frame}</span>`}${phaseClock === undefined ? "" : `<span>phase ${phaseClock.phase.toString()}</span>`}</div>`,
    "</div>",
  ].join("");
}

/// The society grid — every dweller's LLMTV tiled. Scale-free: one dweller and N
/// dwellers run the SAME path (`dwellers.map`); the grid IS the map, no special case.
export function renderLlmtvGrid(transcript: LlmtvTranscript): string {
  const phaseClock = transcript.phaseClock;

  return [
    `<div class="grid"`,
    attr("data-schema", transcript.schema),
    attr("data-dwellers", transcript.dwellers.length),
    attr("data-phase-clock", phaseClock?.schema),
    attr("data-phase-clock-basis", phaseClock?.basis),
    attr("data-phase", phaseClock?.phase),
    attr("data-phase-skew-bound", phaseClock?.skewBoundTicks),
    ">",
    ...transcript.dwellers.map((d) => renderDweller(d, transcript.seed)),
    "</div>",
  ].join("");
}

function renderReadoutMetric(metric: LlmtvReadoutMetric): string {
  return [
    '<span class="readout-metric">',
    `<b>${escapeHtml(metric.label)}</b>`,
    `<i>${escapeHtml(String(metric.value))}</i>`,
    "</span>",
  ].join("");
}

function renderReadoutStatus(status: LlmtvReadoutStatus | undefined): string {
  if (status === undefined) return "";

  const heatSignals = status.heatSignals && status.heatSignals.length > 0 ? status.heatSignals.join(" ") : "cold";

  return [
    `<section class="readout"`,
    attr("data-readout-status", status.kind),
    attr("data-heat-signals", heatSignals),
    attr("data-source", status.source),
    ">",
    '<div class="readout-head">',
    '<span class="readout-dot"></span>',
    `<span class="readout-label">${escapeHtml(status.label)}</span>`,
    `<span class="readout-source">${escapeHtml(status.source)}</span>`,
    "</div>",
    `<p>${escapeHtml(status.detail)}</p>`,
    '<div class="readout-metrics">',
    ...status.metrics.map(renderReadoutMetric),
    "</div>",
    "</section>",
  ].join("");
}

const societyBlock = [
  '<div class="society">',
  '<div class="lbl">The society — all minds at once</div>',
  '<div class="broadcast">',
  "Every dweller's LLMTV is a <b>transcript tick</b> (deterministic, replayable — this is a still frame of a rewindable broadcast, not a lossy feed). The full settlement's channels tile here and <b>broadcast over Reticulum</b>: self-certifying, no central broadcaster, anyone on the mesh watches the whole society predict at once. Watching a mind cannot steer it — the picture is one-way; feedback takes its own declared channel (§13 noninterference). And no watcher can force a frost open: <b>privacy is hard money — earned only when others attest you added value to them, and never confiscated.</b> This is the centerpiece: not a dashboard of what happened, a live window into what every mind expects next, shared — by consent.",
  "</div>",
  "</div>",
].join("");

/// The full LLMTV surface: the lede, the society grid, and the broadcast block —
/// everything inside the page's <div class="wrap">, minus the document shell.
export function renderLlmtvHtml(
  transcript: LlmtvTranscript,
  readoutStatus: LlmtvReadoutStatus | undefined = undefined,
): string {
  return [
    '<div class="crumb"><a href="../">← the dark hall</a> &nbsp;·&nbsp; <a href="../vault/">the vault</a></div>',
    "<h1>LLMTV</h1>",
    '<p class="lede">What goes on in the <b>mind of each vault dweller</b> — not its body in the cutaway, its <b>predictions</b>. Rendered quality-per-glyph so a glance reads meaning, not pixels. Each bar is a soft forecast: fill is the value, empty is the uncertainty it admits. A dweller broadcasts what its <b>hat requires</b> — take the role, share those parts — and earns <b>permanent frost</b> over what\'s personal. Frost is priced privacy: <b>hard money, earned only when others attest you added value to them, and never taken away.</b> The whole society broadcasts at once, over Reticulum — the future, watched together, in real time.</p>',
    '<span class="oneway">one-way out · metered at the membrane · no back-channel through the picture</span>',
    renderReadoutStatus(readoutStatus),
    renderLlmtvGrid(transcript),
    societyBlock,
    '<footer>LLMTV = QPG over DPI · the watch surface (universal/television.md) · minds nested inside <a href="../vault/">the vault</a> inside the settlement · frames are 5-minute bounded superdeterministic updates</footer>',
  ].join("\n");
}

/// The inline CSS for the self-contained hall/tv/ page. Ported verbatim from the
/// design surface; the ONLY structural change from hand-authored is that the DU
/// temperature drives the bar color via [data-temp=...] instead of a hand-coded
/// class — the homoiconic discipline (the case IS the attribute).
export const LLMTV_INLINE_CSS = `
    /* BASE — the shared spine every language inherits (state-color DU + type). Meaning, never
       chrome. See docs/design/design-language-base-corporate-sovereign.md. */
    :root {
      --txt:#e8ecf6; --txt2:#8b96b4; --txt3:#565f7d;
      --c-hot:#9a8ce6;     /* violet: high salience / hot / sealed (state DU) */
      --c-warm:#e8b566;    /* amber: working / rising */
      --c-cool:#5ec8c2;    /* teal: settled / active */
      --c-ok:#5dbf9a; --c-warn:#e0a24a; --c-bad:#e0746a;  /* red = attention/live */
      --mono:'Space Mono',ui-monospace,'SF Mono',Menlo,monospace;
      --disp:'Space Grotesk',system-ui,sans-serif;
      --body:'Inter',system-ui,sans-serif;
      color-scheme:dark;
    }
    /* SOVEREIGN — the liminal language's chrome (a mind governing itself). LLMTV is a Sovereign
       surface. Swapped by one attribute; the case IS the attribute. */
    [data-language="sovereign"] {
      --ground:#0b0f19; --hall:#0c0c10; --panel:#12131a; --scan:#141821;
      --line:#232a3d; --line2:#2f3850;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--body); color:var(--txt); background:var(--hall);
      background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px); }
    a { color:var(--c-cool); }
    .wrap { max-width:74rem; margin:0 auto; padding:1.75rem 1.25rem 5rem; }
    .crumb { font-family:var(--mono); font-size:0.66rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--txt3); }
    h1 { font-family:var(--disp); font-size:1.7rem; margin:0.4rem 0 0.3rem; }
    .lede { color:var(--txt2); max-width:50rem; margin:0.5rem 0 0; font-size:0.9rem; }
    .lede b { color:var(--txt); }
    .oneway { font-family:var(--mono); font-size:0.62rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-cool); border:1px solid var(--line2); border-radius:999px; padding:3px 10px; display:inline-block; margin-top:0.9rem; }

    .readout { margin-top:1rem; border:1px solid var(--line2); border-radius:10px; padding:0.85rem 0.95rem;
      background:linear-gradient(180deg, rgba(94,200,194,0.035), rgba(255,255,255,0.01)); position:relative; overflow:hidden; }
    .readout::after { content:""; position:absolute; left:0; right:0; top:0; height:1px; opacity:0.65;
      background:linear-gradient(90deg, transparent, currentColor, transparent); }
    .readout-head { display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap; font-family:var(--mono);
      font-size:0.62rem; letter-spacing:0.14em; text-transform:uppercase; }
    .readout-dot { width:0.5rem; height:0.5rem; border-radius:50%; background:currentColor; box-shadow:0 0 9px currentColor; flex:0 0 auto; }
    .readout-label { color:var(--txt); }
    .readout-source { color:var(--txt3); letter-spacing:0.08em; }
    .readout p { margin:0.45rem 0 0; color:var(--txt2); font-size:0.78rem; line-height:1.55; }
    .readout-metrics { display:flex; flex-wrap:wrap; gap:0.45rem; margin-top:0.65rem; }
    .readout-metric { display:inline-flex; align-items:baseline; gap:0.35rem; border:1px solid var(--line);
      border-radius:6px; padding:0.22rem 0.45rem; font-family:var(--mono); font-size:0.62rem; color:var(--txt2); }
    .readout-metric b { color:var(--txt3); font-weight:400; letter-spacing:0.1em; text-transform:uppercase; }
    .readout-metric i { color:var(--txt); font-style:normal; }
    [data-readout-status="live"] { color:var(--c-bad); }
    [data-readout-status="cold"] { color:var(--txt3); }
    [data-readout-status="stale"] { color:var(--c-warm); }
    [data-readout-status="heat"] { color:var(--c-bad); }
    .readout[data-heat-signals]:not([data-heat-signals="cold"]) { box-shadow:0 0 0 1px color-mix(in srgb, currentColor 35%, transparent); }

    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(17rem,1fr)); gap:1rem; margin-top:1.75rem; }
    .tv { border:1px solid var(--line); border-radius:12px; background:var(--panel); overflow:hidden; }
    .tv-head { display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.85rem; border-bottom:1px solid var(--line); background:var(--scan); }
    .tv-head .who { font-family:var(--disp); font-weight:600; font-size:0.92rem; }
    .tv-head .who small { font-family:var(--mono); font-weight:400; color:var(--txt3); font-size:0.62rem; letter-spacing:0.1em; display:block; }
    .live { font-family:var(--mono); font-size:0.58rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--c-bad); display:flex; align-items:center; gap:5px; }
    .live::before { content:""; width:7px; height:7px; border-radius:50%; background:var(--c-bad); box-shadow:0 0 7px 1px var(--c-bad); animation:pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }

    /* the mind: QPG — every glyph is a prediction, weight = attention temperature */
    .mind { padding:0.85rem; font-family:var(--mono); font-size:0.78rem; line-height:1.75; }
    .mind .row { display:flex; gap:0.6rem; align-items:baseline; }
    .mind .t { color:var(--txt3); font-size:0.66rem; flex-shrink:0; width:2.6rem; }
    .mind .p { color:var(--txt2); }
    .mind .p b { color:var(--txt); font-weight:400; }
    /* prediction confidence bar — the soft (value, ε): fill = value, the rest is uncertainty */
    .pred { display:flex; align-items:center; gap:0.5rem; margin:0.15rem 0; }
    .pred .lbl { flex:1; color:var(--txt); }
    .pred .bar { width:6.5rem; height:0.5rem; border:1px solid var(--line2); border-radius:3px; overflow:hidden; flex-shrink:0; position:relative; }
    .pred .bar i { position:absolute; inset:0; width:var(--v); display:block; }
    .pred .n { font-family:var(--mono); font-size:0.66rem; color:var(--txt2); width:3.2rem; text-align:right; flex-shrink:0; }
    [data-temp="hot"] i { background:var(--c-hot); } [data-temp="warm"] i { background:var(--c-warm); } [data-temp="cool"] i { background:var(--c-cool); }
    /* region tags: what a role REQUIRES (broadcast) vs what's PERSONAL */
    .band { display:flex; align-items:center; gap:0.4rem; margin:0.55rem 0 0.15rem; }
    .band .k { font-family:var(--mono); font-size:0.56rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--txt3); }
    .band .k.req { color:var(--c-warm); } .band .k.pers { color:var(--c-cool); }
    .band .hr { flex:1; height:1px; background:var(--line); }
    .causal-lane { margin:0.7rem -0.85rem 0; padding:0.62rem 0.85rem 0; border-top:1px solid var(--line); }
    .causal-lane[data-correction-admission="backpressure"] { border-top-color:var(--c-hot); }
    .causal-band { display:flex; align-items:center; gap:0.4rem; font-family:var(--mono); font-size:0.56rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-cool); }
    .causal-lane[data-correction-admission="backpressure"] .causal-band { color:var(--c-hot); }
    .causal-band i { flex:1; height:1px; background:currentColor; opacity:0.45; }
    .causal-band b { color:currentColor; font-weight:400; white-space:nowrap; }
    .causal-handoff { display:grid; grid-template-columns:minmax(4.6rem,0.8fr) minmax(0,1.2fr) auto; gap:0.35rem; align-items:center; margin-top:0.45rem; padding-left:0.4rem; border-left:2px solid var(--c-cool); color:var(--txt2); font-size:0.56rem; }
    .causal-handoff span { min-width:0; overflow-wrap:anywhere; }
    .causal-handoff b { color:var(--c-cool); font-weight:400; white-space:nowrap; }
    .causal-handoff[data-handoff-status="backpressured"], .causal-handoff[data-handoff-status="heat"] { border-left-color:var(--c-hot); }
    .causal-handoff[data-handoff-status="backpressured"] b, .causal-handoff[data-handoff-status="heat"] b { color:var(--c-hot); }
    .causal-rows { display:grid; gap:0.25rem; margin:0.45rem 0 0; padding:0; list-style:none; }
    .causal-rows li { display:grid; grid-template-columns:minmax(3rem,0.7fr) minmax(0,1.4fr) minmax(2rem,0.35fr); gap:0.35rem; color:var(--txt2); font-size:0.56rem; }
    .causal-rows li span { min-width:0; overflow-wrap:anywhere; }
    .causal-rows li b { color:var(--txt); font-weight:400; text-align:right; }
    .causal-lane p { margin:0.45rem 0 0; color:var(--c-hot); font-family:var(--mono); font-size:0.54rem; line-height:1.35; overflow-wrap:anywhere; }
    /* temperature treaty: information-temperature and black-body reference readout, visible from attrs */
    .temp-lane { --thermal:var(--c-cool); margin:0.7rem -0.85rem 0; padding:0.62rem 0.85rem 0; border-top:1px solid var(--line); color:var(--thermal); }
    .temp-lane[data-temperature-band="cold"] { --thermal:var(--txt3); }
    .temp-lane[data-temperature-band="warm"] { --thermal:var(--c-warm); }
    .temp-lane[data-temperature-band="hot"] { --thermal:var(--c-hot); }
    .temp-lane[data-temperature-band="critical"] { --thermal:var(--c-bad); }
    /* fidelity OVERRIDES band colour: an unfaithful reading must not be painted as
       a measurement. Declared after the band rules so it wins on specificity ties.
       A blind sensor and an idle room are both cold; only this tells them apart. */
    .temp-lane[data-temperature-fidelity="out-of-domain"] { --thermal:var(--c-bad); border-top-color:var(--c-bad); }
    .temp-lane[data-temperature-fidelity="out-of-domain"] .temp-band span { font-weight:700; }
    .temp-lane[data-temperature-fidelity="out-of-domain"] .rail i { opacity:0.25; }
    .temp-lane[data-temperature-fidelity="saturated"] { --thermal:var(--c-hot); }
    .temp-lane[data-temperature-fidelity="below-resolution"] { --thermal:var(--txt2); }
    .temp-band { display:flex; align-items:center; gap:0.4rem; font-family:var(--mono); font-size:0.56rem; letter-spacing:0.14em; text-transform:uppercase; }
    .temp-band span { color:currentColor; white-space:nowrap; }
    .temp-band i { flex:1; height:1px; background:linear-gradient(90deg, currentColor, transparent); opacity:0.55; }
    .temp-stack { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0.35rem; margin-top:0.48rem; }
    .temp-metric { min-width:0; display:grid; gap:0.16rem; font-family:var(--mono); }
    .temp-metric b { font-size:0.54rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--txt3); font-weight:400; }
    .temp-metric .rail { height:0.38rem; border:1px solid var(--line2); border-radius:3px; overflow:hidden; position:relative; background:rgba(255,255,255,0.018); }
    .temp-metric .rail i { position:absolute; inset:0; width:calc(var(--ppm) * 100%); background:currentColor; display:block; }
    .temp-metric em { font-style:normal; font-size:0.56rem; color:var(--txt2); overflow-wrap:anywhere; line-height:1.25; }
    .temp-meta { display:flex; flex-wrap:wrap; gap:0.25rem 0.65rem; margin-top:0.5rem; font-family:var(--mono); font-size:0.55rem; color:var(--txt3); }
    .temp-meta span { min-width:0; display:inline-flex; gap:0.28rem; align-items:baseline; }
    .temp-meta b { font-weight:400; letter-spacing:0.12em; text-transform:uppercase; }
    .temp-meta i { font-style:normal; color:var(--txt2); overflow-wrap:anywhere; }
    .heat-receipts { display:grid; gap:0.35rem; margin-top:0.55rem; }
    .heat-receipt { display:grid; grid-template-columns:minmax(4rem,0.65fr) minmax(3.2rem,0.55fr) minmax(4.6rem,0.75fr) minmax(0,1.35fr);
      gap:0.35rem; align-items:center; min-width:0; border:1px solid color-mix(in srgb, currentColor 28%, var(--line));
      border-radius:6px; padding:0.32rem 0.38rem; background:rgba(255,255,255,0.018); font-family:var(--mono); }
    .heat-receipt b { min-width:0; color:var(--txt); font-size:0.55rem; font-weight:400; letter-spacing:0.1em; text-transform:uppercase; overflow-wrap:anywhere; }
    .receipt-rails { display:grid; gap:0.1rem; }
    .receipt-rails i { height:0.17rem; border-radius:99px; background:var(--line2); position:relative; overflow:hidden; }
    .receipt-rails i::before { content:""; position:absolute; inset:0; width:0; background:currentColor; }
    .receipt-rails i:nth-child(1)::before { width:calc(var(--heat) * 100%); }
    .receipt-rails i:nth-child(2)::before { width:calc(var(--pressure) * 100%); opacity:0.76; }
    .receipt-rails i:nth-child(3)::before { width:calc(var(--storage) * 100%); opacity:0.54; }
    .heat-receipt em { min-width:0; font-style:normal; color:var(--txt3); font-size:0.53rem; overflow-wrap:anywhere; }
    .heat-receipt small { min-width:0; color:var(--txt2); font-size:0.53rem; line-height:1.25; overflow-wrap:anywhere; }
    /* UNKNOWN = zero observations. A quiet receipt is ALREADY muted, so muteness cannot
       carry "not measured" — the rails are struck through and the note says it in words. */
    .heat-receipt[data-signal-reading="unknown"] { border-style:dashed; }
    .heat-receipt[data-signal-reading="unknown"] .receipt-rails i {
      background:repeating-linear-gradient(135deg, var(--line2) 0 3px, transparent 3px 6px); }
    .heat-receipt[data-signal-reading="unknown"] small { color:var(--txt); }
    /* FROST: personal mind-parts a dweller earned permanent privacy over — priced privacy,
       never decoration; the blur means content withheld, its permanence = earned + inviolable */
    .frost { position:relative; margin:0.2rem 0; border:1px solid var(--line2); border-radius:6px; overflow:hidden;
      background:repeating-linear-gradient(115deg, rgba(94,200,194,0.06) 0 8px, rgba(94,200,194,0.02) 8px 16px); }
    .frost .veil { padding:0.55rem 0.7rem; filter:blur(4px); opacity:0.5; color:var(--txt2); font-family:var(--mono); font-size:0.72rem; user-select:none; pointer-events:none; }
    .frost .lock { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:0.4rem;
      font-family:var(--mono); font-size:0.6rem; letter-spacing:0.1em; color:var(--c-cool); text-transform:uppercase; }
    .frost .lock svg { width:11px; height:11px; }
    .tv-foot { padding:0.5rem 0.85rem; border-top:1px solid var(--line); font-family:var(--mono); font-size:0.6rem; color:var(--txt3); letter-spacing:0.06em; display:flex; justify-content:space-between; }

    .society { margin-top:2.5rem; }
    .society .lbl { font-family:var(--mono); font-size:0.66rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--txt3); margin-bottom:0.8rem; }
    .broadcast { border:1px dashed var(--line2); border-radius:12px; padding:1.1rem 1.25rem; color:var(--txt2); font-size:0.85rem; background:linear-gradient(180deg, rgba(94,200,194,0.03), transparent); }
    .broadcast b { color:var(--txt); }
    footer { margin-top:3rem; padding-top:1.25rem; border-top:1px solid var(--line); font-family:var(--mono); font-size:0.7rem; color:var(--txt3); }
    @media (prefers-reduced-motion: reduce) { .live::before { animation:none; } }
  `;

export function renderLlmtvDocument(transcript: LlmtvTranscript, options: RenderDocumentOptions = {}): string {
  const title = options.title ?? "Zeta — LLMTV (the society's minds, broadcast)";
  const head =
    options.inlineCss === undefined && options.stylesheetHref === undefined
      ? `<style>${LLMTV_INLINE_CSS}</style>`
      : options.inlineCss !== undefined
        ? `<style>${options.inlineCss}</style>`
        : `<link rel="stylesheet" href="${escapeHtml(options.stylesheetHref as string)}">`;

  return [
    "<!DOCTYPE html>",
    '<html lang="en" data-language="sovereign">',
    "<head>",
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(title)}</title>`,
    '<meta name="description" content="LLMTV: what goes on in the mind of each vault dweller, rendered quality-per-glyph. Live future predictions, the whole society at once, over Reticulum." />',
    '<meta property="og:title" content="Zeta — LLMTV" />',
    '<meta property="og:url" content="https://lucent-financial-group.github.io/Zeta/hall/tv/" />',
    head,
    "</head>",
    "<body>",
    '<div class="wrap">',
    renderLlmtvHtml(transcript, options.readoutStatus),
    "</div>",
    "</body>",
    "</html>",
  ].join("\n");
}
