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
}

export interface LlmtvTranscript {
  readonly schema: "zeta.darkhall.llmtv.v1";
  readonly seed: string;
  readonly dwellers: readonly DwellerMind[];
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
}

export interface RenderDocumentOptions {
  readonly title?: string;
  readonly stylesheetHref?: string;
  readonly inlineCss?: string;
  readonly readoutStatus?: LlmtvReadoutStatus;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

export function renderDweller(mind: DwellerMind, seed: string): string {
  const frame = mind.frame;
  const live = mind.live ?? true;

  return [
    `<div class="tv"`,
    attr("data-dweller", mind.name),
    attr("data-live", live ? "true" : "false"),
    attr("data-frosted", mind.frost ? "true" : "false"),
    ">",
    `<div class="tv-head">`,
    `<div class="who">${escapeHtml(mind.name)} <small>${escapeHtml(mind.role)}</small></div>`,
    live ? `<div class="live">live</div>` : "",
    "</div>",
    `<div class="mind">`,
    renderRequiredBand(mind.hat),
    ...mind.predictions.map(renderPrediction),
    mind.frost ? renderFrost(mind.frost) : "",
    "</div>",
    `<div class="tv-foot"><span>seed ${escapeHtml(seed)}</span>${frame === undefined ? "" : `<span>frame ${frame}</span>`}</div>`,
    "</div>",
  ].join("");
}

/// The society grid — every dweller's LLMTV tiled. Scale-free: one dweller and N
/// dwellers run the SAME path (`dwellers.map`); the grid IS the map, no special case.
export function renderLlmtvGrid(transcript: LlmtvTranscript): string {
  return [
    `<div class="grid"`,
    attr("data-schema", transcript.schema),
    attr("data-dwellers", transcript.dwellers.length),
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

  return [
    `<section class="readout"`,
    attr("data-readout-status", status.kind),
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
    :root {
      --ground:#0b0f19; --hall:#0c0c10; --panel:#12131a; --scan:#141821;
      --line:#232a3d; --line2:#2f3850;
      --txt:#e8ecf6; --txt2:#8b96b4; --txt3:#565f7d;
      --c-hot:#9a8ce6;     /* violet: high salience / hot attention (vocab: LLMTV hot end) */
      --c-warm:#e8b566;    /* amber: rising */
      --c-cool:#5ec8c2;    /* teal: settled */
      --c-ok:#5dbf9a; --c-warn:#e0a24a; --c-bad:#e0746a;
      --mono:'Space Mono',ui-monospace,'SF Mono',Menlo,monospace;
      --disp:'Space Grotesk',system-ui,sans-serif;
      --body:'Inter',system-ui,sans-serif;
      color-scheme:dark;
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
    '<html lang="en">',
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
