/**
 * drift-dashboard/render.ts — the surface a human actually looks at.
 *
 * The rendering is not decoration; it is the second half of the requirement. Aaron
 * 2026-08-22: *"the more mechanical the better"* — an unknown that is displayed but
 * not DISTINGUISHED has not been surfaced. A live instance from the same day: a scan
 * printed 16 workflows with no runs on main, the reader acted on the 4 reds, and the
 * 16 sat as an undifferentiated grey block. The instrument found them; the
 * presentation buried them.
 *
 * So: red first (oldest first), unknowns second with their AGE in the row and the
 * oldest silence in the headline, and green last and collapsed. Coverage is in the
 * headline, never in a corner — "I could not see 59 of 81" has to read at least as
 * loud as "3 failed".
 *
 * Pure functions over the report: no I/O, no clock, no fetch. Markdown is the primary
 * surface because it is readable in a terminal AND in a `git diff`
 * (`.claude/rules/no-binary-in-proof-lineage.md` — the verification substrate is text);
 * the HTML is one self-contained file with no external assets and no CDN, so it works
 * from a `git clone` at a tag with no package manager present
 * (`.claude/rules/clone-at-tag-stays-sufficient.md`).
 */

import type { DashboardReport, DashboardRow } from "./fold.ts";
import { headline, humanDuration } from "./fold.ts";

function silenceCell(row: DashboardRow): string {
  return row.silenceSeconds === null ? "**NEVER observed**" : humanDuration(row.silenceSeconds);
}

function detailOf(row: DashboardRow): string {
  const v = row.verdict;
  const parts: string[] = [];
  if (v.kind !== "green" && v.kind !== "running") parts.push(cellText(v.detail));
  // The annotation, and it must be visible on the row rather than implied: this is the
  // last CONCLUDED verdict and a newer run is in flight. It is not "probably fine now".
  if (row.recheckInFlight) parts.push("**recheck in flight — this is the last CONCLUDED verdict, not a current one**");
  // The reconciling line. Without it, this dashboard and a hand-rolled scanner report
  // different colours for the same lane and a reader has no way to see which evidence
  // each one used.
  if (row.supersededBy !== undefined) {
    const sup = row.supersededBy;
    parts.push(
      `**awaiting scheduled confirmation** — ${cellText(sup.detail)} at ${sup.observedAt}, NEWER than the verdict above. ` +
        "The verdict reports the DECLARED (scheduled) path, which is the stronger claim: a hand-run proves the code, not the cadence. " +
        "This row clears when the next scheduled run passes.",
    );
  }
  if (row.undeclared) parts.push("**no source declared this check in this pass**");
  return parts.filter((p) => p !== "").join(" · ");
}

/**
 * Escape one cell of EXTERNAL text — a producer's detail, an expectation's
 * declaration, a check's id. Data, never markup.
 *
 * Three things, and the ORDER is the correctness argument:
 *   1. `\` first. An escape function that does not escape its own escape character is
 *      defeatable: `\|` would become `\\|` — an escaped backslash followed by a BARE
 *      pipe, which ends the cell and shifts every column after it. CodeQL flagged
 *      exactly this on the first run of this PR (`js/incomplete-sanitization`, high),
 *      and it was right.
 *   2. `|` — would end the cell. GFM resolves `\|` before code spans, so this is
 *      correct inside backticks too.
 *   3. `*` — a cron like `7 17 * * 0` contains `* *`, which Markdown reads as an
 *      emphasis span and markdownlint rejects (MD037). A generated artifact that
 *      cannot pass the repo's own lint cannot be committed, so the generator owns it.
 *      Skipped inside code spans, where no backslash should reach a reader.
 *
 * Text this file formats DELIBERATELY does not come through here — `**NEVER observed**`
 * is markup we meant, and escaping it would break the one row that must not be missed.
 * That is why `table` no longer escapes anything: the caller says which kind it has.
 */
function cellText(s: string): string {
  // ONE chain per segment, and the backslash comes FIRST in it. Written this way on
  // purpose: the ordering is now a property of the expression rather than a claim in a
  // comment, so neither a reader nor a static analyser has to carry the invariant
  // across a `split`/`map` boundary to see that the escape character is escaped
  // before anything that uses it. Two earlier shapes of this function each shipped a
  // real hole here and CodeQL caught both.
  const escapeSegment = (part: string, insideCodeSpan: boolean): string => {
    const structural = part.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
    // `*` is emphasis, and only outside a code span — a cron like `7 17 * * 0` would
    // otherwise be read as an emphasis span and rejected by markdownlint (MD037).
    return insideCodeSpan ? structural : structural.replace(/\*/g, "\\*");
  };
  return s
    .split("`")
    .map((part, i) => escapeSegment(part, i % 2 === 1))
    .join("`")
    .replace(/\n/g, " ");
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return "_none_\n";
  const head = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |`;
  return `${head}\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`;
}

/** The committed markdown artifact. */
export function renderMarkdown(report: DashboardReport): string {
  const c = report.counts;
  const cov = report.coverage;
  const by = (kind: DashboardRow["band"]): readonly DashboardRow[] => report.rows.filter((r) => r.band === kind);

  const out: string[] = [];
  out.push("# Zeta drift dashboard\n");
  out.push(`> **${headline(report)}**\n`);
  out.push(
    "A check that was never observed must never render identically to a check that passed.",
    "`Unknown` is a first-class verdict here and can never aggregate into green: an unobserved",
    "check is an unbounded number of unknown failures, so it is ranked ABOVE green and BY AGE.\n",
  );
  out.push("| | |", "|---|---|");
  out.push(`| ref | \`${report.ref}\` |`);
  out.push(`| pass at | ${report.at} |`);
  out.push(`| producers | ${report.sources.length === 0 ? "_none_" : report.sources.join(", ")} |`);
  out.push(`| roster | ${cov.known} known checks — ${cov.expected} expected to report on this ref, ${cov.onDemand} on-demand, ${cov.retired} retired |`);
  out.push(`| coverage | **${cov.observed} / ${cov.expected}**${cov.shortfall > 0 ? ` — **SHORTFALL ${cov.shortfall}**` : ""} |`);
  out.push("");

  if (report.sourceErrors.length > 0) {
    out.push(`## Producer failures — ${report.sourceErrors.length}\n`);
    out.push("A producer that could not answer is an **absence of evidence**, never an all-clear.\n");
    for (const e of report.sourceErrors) out.push(`- ${e}`);
    out.push("");
  }

  out.push(`## RED — ${c.red}\n`);
  out.push("Oldest first: a check red since the 16th outranks one red five minutes ago.\n");
  out.push(table(["check", "red for", "expectation", "detail"], by("red").map((r) => [
    `\`${cellText(r.checkId)}\``, silenceCell(r), r.expectation.kind, detailOf(r),
  ])));

  out.push(`\n## FLAPPING — ${c.flapping}\n`);
  out.push("Recent CONCLUDED runs contain both passes and failures, and the newest passed. Its own");
  out.push("state because neither neighbour is honest: green would launder a 90% claim as a 100%");
  out.push("one, and red would make an oscillating lane permanently red until the alarm is muted.");
  out.push("A lane whose next verdict is a coin flip has no colour, so it gets its own.\n");
  out.push(table(["check", "expectation", "detail"], by("flapping").map((r) => [
    `\`${cellText(r.checkId)}\``, r.expectation.kind, detailOf(r),
  ])));

  out.push(`\n## UNKNOWN — ${c.unknown}\n`);
  out.push("**Longest silence first.** Silence that persists is the strongest signal and the easiest");
  out.push("to habituate to, so it is aged rather than listed. `never-observed` sorts above every");
  out.push("finite silence, because that is what infinite silence is.\n");
  out.push("The `why unknown` column is load-bearing — five reasons, and they are NOT interchangeable:");
  out.push("`never-observed` (no data has ever existed) · `not-observed-this-pass` (data may exist; this");
  out.push("pass could not see it — today's bug wears this one's clothes) · `registered-but-absent` (the");
  out.push("producer declares the check and its definition is missing from the repository) ·");
  out.push("`expectation-unknown` (cannot tell whether it should run at all) · `source-error` (we failed");
  out.push("to ask, which is not the same as a correct silence).\n");
  out.push(table(["check", "silent for", "why unknown", "expectation", "detail"], by("unknown").map((r) => [
    `\`${cellText(r.checkId)}\``,
    silenceCell(r),
    r.verdict.kind === "unknown" ? r.verdict.reason : "",
    r.expectation.kind,
    detailOf(r),
  ])));

  out.push(`\n## Not yet due — ${c["not-yet-due"]}\n`);
  out.push("Declared, correct, and **not yet owed a verdict** — its definition has not existed for a");
  out.push("full period. Its own state on purpose: calling it green claims a verdict nobody gave, and");
  out.push("calling it red cries wolf on every scheduled check anyone adds, which gets the alarm muted.\n");
  out.push(table(["check", "expectation", "detail"], by("not-yet-due").map((r) => [
    `\`${cellText(r.checkId)}\``, r.expectation.kind, detailOf(r),
  ])));

  if (c.running > 0 || c.skipped > 0) {
    out.push(`\n## Running (${c.running}) / skipped (${c.skipped})\n`);
    out.push(table(["check", "state", "detail"], [...by("running"), ...by("skipped")].map((r) => [
      `\`${cellText(r.checkId)}\``, r.band, detailOf(r),
    ])));
  }

  out.push(`\n## Not applicable — ${c["not-applicable"]}\n`);
  out.push("Declared to fire only on request, so silence on this ref is **correct**. Listed, not");
  out.push("hidden, and deliberately not called green — a distinction laundered is a distinction lost.\n");
  out.push("<details><summary>show</summary>\n");
  out.push(table(["check", "expectation"], by("not-applicable").map((r) => [`\`${cellText(r.checkId)}\``, cellText(r.expectation.detail)])));
  out.push("\n</details>\n");

  out.push(`\n## Green — ${c.green}\n`);
  out.push("<details><summary>show</summary>\n");
  out.push(table(["check", "verdict age", "expectation"], by("green").map((r) => [
    `\`${cellText(r.checkId)}\``, silenceCell(r), r.expectation.kind,
  ])));
  out.push("\n</details>\n");

  out.push("\n---\n");
  out.push("Generated by `bun src/Core.TypeScript/drift-dashboard/cli.ts`. The roster lives at");
  out.push("`db/drift-dashboard/roster.json` — a new check appearing and a known check vanishing are");
  out.push("both events you can see in a `git diff`. A vanished check keeps its slot and keeps being");
  out.push("counted; retirement is written by hand, with a reason, and by nothing else.\n");
  // Collapse runs of blank lines: the section builders each end with their own blank
  // line, and markdownlint (MD012) refuses two in a row. A generated artifact that
  // cannot pass the repo's own lint cannot be committed, so the generator owns this.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Machine-readable artifact for other tools. Text, diffable, no schema surprises. */
export function renderJson(report: DashboardReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

const BAND_COLOR: Record<DashboardRow["band"], string> = {
  red: "#c62828",
  flapping: "#b34700",
  unknown: "#8e6c00",
  running: "#1565c0",
  "not-yet-due": "#4a4a6a",
  skipped: "#546e7a",
  "not-applicable": "#455a64",
  green: "#2e7d32",
};

/**
 * Self-contained HTML. No external assets, no CDN, no fonts, no scripts fetched —
 * one file that opens from a checkout with nothing installed.
 */
export function renderHtml(report: DashboardReport): string {
  const c = report.counts;
  const cov = report.coverage;
  const rowsHtml = report.rows
    .map((r) => {
      const v = r.verdict;
      const why = v.kind === "unknown" ? v.reason : v.kind;
      const detail = detailOf(r);
      return `<tr class="${r.band}"><td><code>${escapeHtml(r.checkId)}</code></td><td class="band"><span class="dot" style="background:${BAND_COLOR[r.band]}"></span>${r.band}</td><td>${escapeHtml(why)}</td><td class="age">${r.silenceSeconds === null ? "<b>NEVER</b>" : escapeHtml(humanDuration(r.silenceSeconds))}</td><td>${escapeHtml(r.expectation.kind)}</td><td class="detail">${escapeHtml(detail)}</td></tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Zeta drift dashboard — ${escapeHtml(report.ref)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 :root{color-scheme:dark}
 body{background:#111;color:#ddd;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:24px}
 h1{font-size:18px;margin:0 0 4px}
 .headline{font-size:16px;font-weight:700;padding:10px 14px;border-radius:6px;margin:12px 0;background:${report.ok ? "#14331a" : "#3a1414"};border:1px solid ${report.ok ? "#2e7d32" : "#c62828"}}
 .meta{color:#999;margin-bottom:16px}
 .meta b{color:#ddd}
 table{border-collapse:collapse;width:100%}
 th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #262626;vertical-align:top}
 th{color:#888;font-weight:400;position:sticky;top:0;background:#111}
 .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
 tr.red td{background:#241111}
 tr.flapping td{background:#2a1b0d}
 tr.unknown td{background:#241f11}
 tr.green{opacity:.45}
 tr.green:hover,tr\\.not-applicable:hover{opacity:1}
 .age{white-space:nowrap}
 .detail{color:#aaa}
 .note{color:#888;max-width:76ch;margin:12px 0}
</style></head><body>
<h1>Zeta drift dashboard</h1>
<div class="headline">${escapeHtml(headline(report))}</div>
<p class="note">A check that was never observed must never render identically to a check that passed.
<b>Unknown</b> is a first-class verdict and can never aggregate into green — it is ranked above green and
<b>by age</b>, because silence that persists is the strongest signal and the easiest to habituate to.</p>
<div class="meta">
 <b>ref</b> ${escapeHtml(report.ref)} · <b>pass</b> ${escapeHtml(report.at)} · <b>producers</b> ${escapeHtml(report.sources.join(", ") || "none")}<br>
 <b>roster</b> ${cov.known} known · ${cov.expected} expected on this ref · ${cov.onDemand} on-demand · ${cov.retired} retired<br>
 <b>coverage</b> ${cov.observed}/${cov.expected}${cov.shortfall > 0 ? ` — SHORTFALL ${cov.shortfall}` : ""} ·
 <b>red</b> ${c.red} · <b>flapping</b> ${c.flapping} · <b>unknown</b> ${c.unknown} · <b>not-yet-due</b> ${c["not-yet-due"]} · <b>green</b> ${c.green}
</div>
<table><thead><tr><th>check</th><th>verdict</th><th>why</th><th>age</th><th>expectation</th><th>detail</th></tr></thead>
<tbody>
${rowsHtml}
</tbody></table>
</body></html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
