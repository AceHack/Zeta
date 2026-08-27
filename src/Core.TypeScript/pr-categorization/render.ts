/**
 * Renders the study into a self-contained HTML dashboard and a markdown digest.
 *
 * SELF-CONTAINED IS A HARD REQUIREMENT, not a preference: the page is served
 * from the repo and must render with no network at all — no CDN script, no web
 * font, no remote image. Every chart below is inline SVG computed here.
 *
 * The page is built to be READ HONESTLY. Three things are therefore given the
 * same visual weight as the headline accuracies, because burying them is how a
 * dashboard starts lying:
 *   - the label-shuffle null, next to the models it invalidates if it moves;
 *   - the closed-form baseline, since every model is a delta against it;
 *   - the oracle floor, since under distribution shift "always predict the
 *     biggest class" is a much higher bar than the training-set majority.
 *
 * Register: `unmetered`.
 */

import type { StudyResult } from './study.ts';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Thousands separators without a locale.
 *
 * `toLocaleString('en-US')` pins the locale but still routes through ICU, whose
 * tables differ by runtime and build — so the same number can render differently
 * on two machines and the page stops being a deterministic function of the
 * statistics file. Grouping ASCII digits by hand has one answer everywhere.
 */
function group(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
}

const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
const pp = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(1)}pp`;

/** Stable colour per area: hashed hue, so a new area does not reshuffle the rest. */
function areaColor(area: string): string {
  let h = 0;
  for (let i = 0; i < area.length; i++) h = (h * 31 + area.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 52%)`;
}

function barChart(
  counts: Readonly<Record<string, number>>,
  total: number,
): string {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return `<div class="bars">${rows
    .map(([area, n]) => {
      const w = (n / max) * 100;
      return `<div class="bar-row">
      <span class="bar-label">${esc(area)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${w.toFixed(2)}%;background:${areaColor(area)}"></span></span>
      <span class="bar-value">${group(n)} <em>${pct(n / total)}</em></span>
    </div>`;
    })
    .join('')}</div>`;
}

/** Line chart of the unlabellable rate over time. */
function trendChart(trend: StudyResult['unlabellableTrend']): string {
  const pts = trend.filter((t) => t.month !== 'unknown' && t.total >= 10);
  if (pts.length < 2) return '<p class="muted">not enough months to plot</p>';
  const W = 760;
  const H = 200;
  const P = 38;
  const maxRate = Math.max(0.05, ...pts.map((p) => p.rate));
  const x = (i: number): number => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (r: number): number => H - P - (r / maxRate) * (H - 2 * P);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(' ');
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const yy = y(maxRate * f);
      return `<line x1="${P}" y1="${yy.toFixed(1)}" x2="${W - P}" y2="${yy.toFixed(1)}" class="grid"/>
      <text x="${P - 6}" y="${(yy + 4).toFixed(1)}" class="axis" text-anchor="end">${pct(maxRate * f, 0)}</text>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Share of PRs with no parseable area, by month">
    ${grid}
    <path d="${path}" class="line"/>
    ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.rate).toFixed(1)}" r="3.5" class="dot"><title>${esc(p.month)}: ${pct(p.rate)} of ${p.total} PRs unlabellable</title></circle>`).join('')}
    ${pts.map((p, i) => (i % Math.ceil(pts.length / 8) === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - P + 16}" class="axis" text-anchor="middle">${esc(p.month)}</text>` : '')).join('')}
  </svg>`;
}

/** Stacked area chart: share of each area by month. */
function stackChart(trend: StudyResult['areaTrend'], areas: readonly string[]): string {
  const pts = trend.filter((t) => t.month !== 'unknown');
  const withTotals = pts
    .map((p) => ({ month: p.month, counts: p.counts, total: Object.values(p.counts).reduce((s, n) => s + n, 0) }))
    .filter((p) => p.total >= 10);
  if (withTotals.length < 2) return '<p class="muted">not enough months to plot</p>';
  const W = 760;
  const H = 260;
  const P = 38;
  const x = (i: number): number => P + (i * (W - 2 * P)) / (withTotals.length - 1);
  const y = (f: number): number => H - P - f * (H - 2 * P);
  // Order areas by overall volume so the big bands sit at the bottom.
  const totals: Record<string, number> = {};
  for (const p of withTotals) for (const [a, n] of Object.entries(p.counts)) totals[a] = (totals[a] ?? 0) + n;
  const ordered = areas.filter((a) => totals[a]).sort((a, b) => totals[b]! - totals[a]!);
  const cum = withTotals.map(() => 0);
  const bands: string[] = [];
  for (const area of ordered) {
    const lower = [...cum];
    withTotals.forEach((p, i) => {
      cum[i]! += (p.counts[area] ?? 0) / p.total;
    });
    const up = withTotals.map((_, i) => `${x(i).toFixed(1)},${y(cum[i]!).toFixed(1)}`).join(' L');
    const down = withTotals
      .map((_, i) => i)
      .reverse()
      .map((i) => `${x(i).toFixed(1)},${y(lower[i]!).toFixed(1)}`)
      .join(' L');
    bands.push(
      `<path d="M${up} L${down} Z" fill="${areaColor(area)}" opacity="0.86"><title>${esc(area)}</title></path>`,
    );
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Share of merged PRs by area, by month">
    ${bands.join('')}
    ${withTotals.map((p, i) => (i % Math.ceil(withTotals.length / 8) === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - P + 16}" class="axis" text-anchor="middle">${esc(p.month)}</text>` : '')).join('')}
  </svg>
  <div class="legend">${ordered.map((a) => `<span class="chip"><i style="background:${areaColor(a)}"></i>${esc(a)}</span>`).join('')}</div>`;
}

function verdict(s: StudyResult): { headline: string; body: string } {
  const base = s.models.find((m) => m.name.startsWith('closed-form'));
  const forest = s.models.find((m) => m.name === 'random forest');
  const bnn = s.models.find((m) => m.name.startsWith('BNN'));
  const bnnVsForest = s.pairwise.find((p) => p.modelA.startsWith('BNN') && p.modelB === 'random forest');
  if (!base || !forest || !bnn || !bnnVsForest) return { headline: 'incomplete', body: '' };
  const bnnWins = bnnVsForest.favours === 'a';
  const headline = bnnWins
    ? 'The BNN earns its place — but only under distribution shift.'
    : 'The BNN does not beat the forest. Both beat the baseline.';
  const body = bnnWins
    ? `On this split the BNN scores ${pct(bnn.accuracy)} against the forest's ${pct(forest.accuracy)}
       (McNemar p = ${bnnVsForest.pValue.toExponential(1)}, ${bnnVsForest.b} vs ${bnnVsForest.c} discordant).
       Both beat the closed-form parse at ${pct(base.accuracy)}. Under an i.i.d. random split the
       two models are statistically indistinguishable — so what the BNN buys is graceful
       degradation when the fleet's mix of work changes, not raw discriminative power.`
    : `The BNN scores ${pct(bnn.accuracy)} and the forest ${pct(forest.accuracy)}; McNemar
       p = ${bnnVsForest.pValue.toFixed(2)} does not separate them. Both beat the closed-form
       parse at ${pct(base.accuracy)}, which is the comparison that matters.`;

  // THE QUALIFICATION THAT MUST TRAVEL WITH THE HEADLINE. Both models beat the
  // baseline on ACCURACY and lose to it on MACRO-F1, because accuracy rewards
  // serving the big areas and macro-F1 weights every area equally. A parse can
  // nail a rare area exactly (`governance:` -> governance) where a model
  // trained on this distribution almost never predicts one. Reporting the
  // accuracy win without this would be true and misleading in the same breath.
  const best = bestByMacroF1(s);
  const caveat =
    best && base.macroF1 > best.macroF1
      ? ` One qualification, and it belongs beside the headline rather than in a column:
          on <strong>macro-F1</strong> the baseline is still ahead — ${pct(base.macroF1)} against
          ${pct(best.macroF1)} for the best model (${esc(best.name)}). Accuracy rewards serving
          the large areas; macro-F1 weights all ${s.corpus.areas.length} equally, and a parse can
          hit a rare area exactly where a model fitted to this distribution almost never predicts
          one. So the models are better at guessing where a PR probably went, and no better at
          the tail.`
      : '';
  return { headline, body: body + caveat };
}

/**
 * Best macro-F1 among the models that are actually candidates — excluding the
 * baseline itself and the majority-class floor, which are reference points
 * rather than proposals.
 *
 * Shared by the HTML and the markdown ON PURPOSE. They previously each picked
 * their own "best model" and disagreed (24.2% vs 27.7%) while describing the
 * same run — two surfaces of one study quoting different numbers is the
 * stale-artifact defect in miniature.
 */
function bestByMacroF1(s: StudyResult): StudyResult['models'][number] | undefined {
  return s.models
    .filter((m) => !m.name.startsWith('closed-form') && !m.name.startsWith('majority'))
    .reduce<StudyResult['models'][number] | undefined>(
      (a, b) => (a && a.macroF1 >= b.macroF1 ? a : b),
      undefined,
    );
}

export function renderHtml(s: StudyResult): string {
  const v = verdict(s);
  const nullMax = Math.max(...s.nulls.map((n) => n.accuracy));
  const nullClean = nullMax <= s.baseline.majorityClassAccuracy + 0.05;

  const modelRows = s.models
    .map((m) => {
      const isBase = m.name.startsWith('closed-form');
      return `<tr class="${isBase ? 'is-baseline' : ''}">
      <td class="name">${esc(m.name)}${m.notes ? `<span class="note">${esc(m.notes)}</span>` : ''}</td>
      <td class="num">${pct(m.accuracy)}<span class="ci">${pct(m.accuracyCi95[0], 0)}–${pct(m.accuracyCi95[1], 0)}</span></td>
      <td class="num ${m.deltaVsBaseline > 0 ? 'pos' : m.deltaVsBaseline < 0 ? 'neg' : ''}">${isBase ? '—' : pp(m.deltaVsBaseline)}</td>
      <td class="num">${pct(m.macroF1)}</td>
      <td class="num">${pct(m.accuracyWhereBaselineSpeaks)}</td>
      <td class="num strong">${pct(m.accuracyWhereBaselineAbstains)}</td>
    </tr>`;
    })
    .join('');

  const nullRows = s.nulls
    .map(
      (m) => `<tr class="is-null">
      <td class="name">${esc(m.name)}${m.notes ? `<span class="note">${esc(m.notes)}</span>` : ''}</td>
      <td class="num">${pct(m.accuracy)}</td><td class="num">—</td>
      <td class="num">${pct(m.macroF1)}</td><td class="num">—</td><td class="num">—</td>
    </tr>`,
    )
    .join('');

  const pairRows = s.pairwise
    .map(
      (p) => `<tr>
      <td class="name">${esc(p.modelA)}<span class="note">vs ${esc(p.modelB)}</span></td>
      <td class="num">${p.b}</td><td class="num">${p.c}</td>
      <td class="num">${p.pValue < 1e-4 ? p.pValue.toExponential(1) : p.pValue.toFixed(4)}</td>
      <td class="num">${p.favours === 'neither' ? '<span class="muted">no difference</span>' : `<strong>${esc(p.favours === 'a' ? p.modelA : p.modelB)}</strong>`}</td>
    </tr>`,
    )
    .join('');

  const disagreeRows = s.disagreement.examples
    .slice(0, 25)
    .map((e) => {
      const areas = Object.entries(e.areaCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([a, n]) => `${esc(a)}:${n}`)
        .join(' ');
      return `<tr>
      <td class="num"><a href="https://github.com/Lucent-Financial-Group/Zeta/pull/${e.pr}">#${e.pr}</a></td>
      <td class="title">${esc(e.title)}<span class="note">${esc(e.headRef)} &middot; ${areas}</span></td>
      <td><span class="tag" style="--c:${areaColor(e.declared)}">${esc(e.declared)}</span></td>
      <td><span class="tag" style="--c:${areaColor(e.measured)}">${esc(e.measured)}</span></td>
      <td class="num">${e.confidence.toFixed(2)}</td>
    </tr>`;
    })
    .join('');

  const pairSummary = s.disagreement.topPairs
    .slice(0, 12)
    .map(
      (p) =>
        `<tr><td><span class="tag" style="--c:${areaColor(p.declared)}">${esc(p.declared)}</span></td>
         <td class="arrow">&rarr;</td>
         <td><span class="tag" style="--c:${areaColor(p.measured)}">${esc(p.measured)}</span></td>
         <td class="num">${p.n}</td></tr>`,
    )
    .join('');

  return `<title>PR Area Statistics</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{
  --bg:#fbfbfa; --fg:#1a1a19; --muted:#6b6b66; --line:#e3e2de; --card:#ffffff;
  --pos:#1a7f4b; --neg:#b3261e; --accent:#3d5afe; --warn:#8a6d00; --warn-bg:#fff8e1;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#131315; --fg:#e8e8e6; --muted:#9a9a94; --line:#2c2c30; --card:#1a1a1d;
  --pos:#4ade80; --neg:#f87171; --accent:#8ba2ff; --warn:#facc15; --warn-bg:#2a2410;
}}
:root[data-theme="dark"]{
  --bg:#131315; --fg:#e8e8e6; --muted:#9a9a94; --line:#2c2c30; --card:#1a1a1d;
  --pos:#4ade80; --neg:#f87171; --accent:#8ba2ff; --warn:#facc15; --warn-bg:#2a2410;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);margin:0;padding:2rem 1.25rem 5rem;
  font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}
.wrap{max-width:920px;margin:0 auto}
h1{font-size:1.7rem;margin:0 0 .25rem;letter-spacing:-.02em}
h2{font-size:1.1rem;margin:2.75rem 0 .5rem;letter-spacing:-.01em}
h2:first-of-type{margin-top:2rem}
p{margin:.5rem 0}
.sub{color:var(--muted);font-size:.9rem;margin-bottom:1.5rem}
.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem 1.15rem;margin:.75rem 0}
.verdict{border-left:3px solid var(--accent)}
.verdict h3{margin:0 0 .4rem;font-size:1.05rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;margin:1rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.7rem .85rem}
.stat b{display:block;font-size:1.45rem;font-family:var(--mono);letter-spacing:-.02em}
.stat span{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:.88rem;min-width:560px}
th,td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
td.num,th.num{text-align:right;font-family:var(--mono);white-space:nowrap}
td.name{font-weight:500}
.note{display:block;color:var(--muted);font-weight:400;font-size:.76rem;margin-top:.15rem}
.ci{display:block;color:var(--muted);font-size:.7rem}
.pos{color:var(--pos)}.neg{color:var(--neg)}
tr.is-baseline{background:color-mix(in srgb,var(--accent) 7%,transparent)}
tr.is-null td{color:var(--muted);font-style:italic}
td.strong{font-weight:700}
.tag{display:inline-block;padding:.1rem .45rem;border-radius:4px;font-size:.76rem;font-family:var(--mono);
  background:color-mix(in srgb,var(--c) 18%,transparent);border:1px solid var(--c);white-space:nowrap}
.arrow{color:var(--muted);padding:0 .2rem}
.bars{display:flex;flex-direction:column;gap:.3rem}
.bar-row{display:grid;grid-template-columns:120px 1fr 110px;align-items:center;gap:.6rem;font-size:.83rem}
.bar-label{font-family:var(--mono);font-size:.78rem}
.bar-track{background:color-mix(in srgb,var(--fg) 7%,transparent);border-radius:3px;height:15px;overflow:hidden}
.bar-fill{display:block;height:100%;border-radius:3px}
.bar-value{text-align:right;font-family:var(--mono);font-size:.78rem}
.bar-value em{color:var(--muted);font-style:normal}
.chart{width:100%;height:auto;display:block;margin:.5rem 0}
.grid{stroke:var(--line)}
line.grid{stroke:var(--line);stroke-width:1}
.line{fill:none;stroke:var(--accent);stroke-width:2}
.dot{fill:var(--accent)}
.axis{fill:var(--muted);font-size:10px;font-family:var(--mono)}
.legend{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem}
.chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-family:var(--mono);color:var(--muted)}
.chip i{width:9px;height:9px;border-radius:2px;display:inline-block}
.callout{background:var(--warn-bg);border:1px solid color-mix(in srgb,var(--warn) 45%,transparent);
  border-radius:8px;padding:.8rem 1rem;margin:.75rem 0;font-size:.88rem}
.callout b{color:var(--warn)}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.85em;background:color-mix(in srgb,var(--fg) 7%,transparent);
  padding:.08em .32em;border-radius:3px}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
</style>
<div class="wrap">
<h1>PR area statistics</h1>
<p class="sub">
  ${group(s.corpus.prsTotal)} merged pull requests &middot;
  ${s.corpus.areas.length} areas &middot;
  split: <strong>${esc(s.corpus.splitKind)}</strong>${s.corpus.splitAtIso ? ` at ${esc(s.corpus.splitAtIso.slice(0, 10))}` : ''} &middot;
  generated <time datetime="${esc(s.generatedAtIso)}">${esc(s.generatedAtIso.replace('T', ' ').slice(0, 16))}Z</time>
</p>

<div class="card verdict">
  <h3>${esc(v.headline)}</h3>
  <p>${v.body}</p>
</div>

<div class="callout">
  <b>How to read every number here.</b> The label is the <strong>measured</strong> area, derived
  from the file paths a PR actually changed. The features a model may see are the
  <strong>declared</strong> side only — title prose, branch, author, timing. Two different
  sources, so this is a prediction task and not a restatement. Every model is reported as a
  delta against the closed-form parse, never on its own.
</div>

<h2>Does the pipeline leak?</h2>
<p>
  The same pipeline is retrained on <strong>permuted labels</strong>. If it still learns, every
  other number on this page is void.
  ${
    nullClean
      ? `The null lands at ${pct(nullMax)}, against a majority-class floor of
         ${pct(s.baseline.majorityClassAccuracy)} — i.e. it degenerates to guessing the biggest
         class, which is exactly what a clean pipeline does. <strong>No leak.</strong>`
      : `<strong style="color:var(--neg)">The null scores ${pct(nullMax)}, above the
         ${pct(s.baseline.majorityClassAccuracy)} floor — treat every number below as suspect.</strong>`
  }
</p>

<h2>Models</h2>
<div class="scroll"><table>
<thead><tr>
  <th>model</th><th class="num">accuracy</th><th class="num">&Delta; vs baseline</th>
  <th class="num">macro&nbsp;F1</th><th class="num">where baseline speaks</th>
  <th class="num">where baseline abstains</th>
</tr></thead>
<tbody>${modelRows}${nullRows}</tbody>
</table></div>
<p class="muted">
  The last column is the point. The closed form scores <strong>0%</strong> there by construction —
  it has nothing to say about ${pct(s.baseline.unlabellable)} of PRs — so any accuracy in that
  column is work no amount of parsing could do. Oracle floor for this test set
  (always predict <code>${esc(s.baseline.testMajorityArea)}</code>):
  <strong>${pct(s.baseline.testMajorityOracleAccuracy)}</strong>.
</p>

<h2>Is the difference between two models real?</h2>
<p class="muted">
  McNemar's exact test on the paired disagreements. Marginal confidence intervals are the wrong
  tool here — the models are scored on the same PRs, so only the items where they disagree
  (<em>b</em> and <em>c</em>) carry the comparison.
</p>
<div class="scroll"><table>
<thead><tr><th>comparison</th><th class="num">A right, B wrong</th><th class="num">A wrong, B right</th><th class="num">p</th><th class="num">favours</th></tr></thead>
<tbody>${pairRows}</tbody>
</table></div>

<h2>Where the declared area disagrees with the diff</h2>
<p>
  <strong>${group(s.disagreement.n)}</strong> PRs
  (${pct(s.disagreement.rate)} of those carrying a parseable area) changed files that sit
  somewhere other than where the title says. This set is the product: the closed form cannot
  produce it at all, because it never looks at a diff.
</p>
<div class="grid" style="grid-template-columns:1fr 1fr">
<div class="card"><h3 style="font-size:.85rem;margin:0 0 .5rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Most common mismatches</h3>
<div class="scroll"><table style="min-width:0"><tbody>${pairSummary}</tbody></table></div></div>
<div class="card"><h3 style="font-size:.85rem;margin:0 0 .5rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Reading them</h3>
<p class="muted" style="font-size:.83rem">
A mismatch is not a mistake. Most are the fleet's conventions disagreeing with its directory
layout — <code>society:</code> ticks that write telemetry, <code>ferry:</code> notes that land in
<code>docs/research</code>, <code>deps:</code> bumps that touch workflows rather than the lockfile.
Naming the pattern is the useful output; assigning blame would be reading intent into a path.
</p></div>
</div>
<div class="scroll"><table>
<thead><tr><th class="num">PR</th><th>title</th><th>declared</th><th>measured</th><th class="num">conf.</th></tr></thead>
<tbody>${disagreeRows}</tbody>
</table></div>

<h2>How much of the corpus is unlabellable?</h2>
<div class="grid">
  <div class="stat"><b>${pct(s.baseline.coverage)}</b><span>parseable area</span></div>
  <div class="stat"><b>${pct(s.baseline.unlabellable)}</b><span>no area at all</span></div>
  <div class="stat"><b>${pct(s.baseline.accuracyOnCovered)}</b><span>correct when parsed</span></div>
  <div class="stat"><b>${group((s.baseline.sourceCounts['type-only'] ?? 0))}</b><span>type but no area</span></div>
</div>
<p class="muted">
  <code>type-only</code> means a title declared a <em>kind</em> of change (<code>feat:</code>,
  <code>fix:</code>) and no area, and the branch did not supply one either. That is a fact about
  the convention, not a limitation of the parser.
</p>
${trendChart(s.unlabellableTrend)}

<h2>What the fleet actually works on</h2>
${barChart(s.corpus.areaCounts, s.corpus.prsTotal)}
<h2>...and how that has moved</h2>
${stackChart(s.areaTrend, s.corpus.areas)}

<h2>Clusters are not categories</h2>
<div class="grid">
  <div class="stat"><b>${s.clustering.adjustedRandIndex.toFixed(3)}</b><span>adjusted Rand index</span></div>
  <div class="stat"><b>${s.clustering.nullAdjustedRandIndex.toFixed(3)}</b><span>ARI against shuffled labels</span></div>
  <div class="stat"><b>${s.clustering.normalizedMutualInfo.toFixed(3)}</b><span>normalised mutual info</span></div>
  <div class="stat"><b>${s.clustering.k}</b><span>k</span></div>
</div>
<p class="muted">
  k-means returns a <em>partition</em>; the taxonomy is a <em>labelling</em>, and no amount of
  agreement turns one into the other. ARI is chance-corrected precisely so that running with
  ${s.clustering.k} clusters cannot flatter itself by producing ${s.clustering.k} groups. At
  ${s.clustering.adjustedRandIndex.toFixed(3)} against a null of
  ${s.clustering.nullAdjustedRandIndex.toFixed(3)}, the unsupervised structure is real but weak,
  and it is <strong>not</strong> the area taxonomy. The
  ${pct(s.clustering.majorityMapAccuracy)} figure you get by naming each cluster with its
  majority label is a supervised ceiling, not a clustering result.
</p>

<footer>
  <p>
    Register: <strong>toy / unmetered</strong>. The taxonomy is a hand-authored convention, not a
    measured partition of the repo; the models are standard algorithms with no claim of novelty.
    Generated by <code>src/Core.TypeScript/pr-categorization/</code> from
    <code>docs/github/prs/manifest.jsonl</code> and the git history.
  </p>
  <p>
    Feature space: ${s.config.featureDim} dimensions over ${s.config.featureGroups.join(', ')} &middot;
    forest ${s.config.forest.nTrees} trees &middot; BNN ${s.config.bnn.passes}-pass ADF probit, one-vs-rest &middot;
    train ${group(s.corpus.trainN)} / test ${group(s.corpus.testN)}
  </p>
</footer>
</div>
`;
}

/** Compact markdown digest for the step summary and the committed doc. */
export function renderMarkdown(s: StudyResult): string {
  const v = verdict(s);
  const L: string[] = [];
  L.push('# PR area statistics');
  L.push('');
  L.push(`_${group(s.corpus.prsTotal)} merged PRs · ${s.corpus.areas.length} areas · ${s.corpus.splitKind} split · generated ${s.generatedAtIso}_`);
  L.push('');
  L.push(`**${v.headline}**`);
  L.push('');
  L.push('| model | accuracy | Δ vs baseline | macro F1 | where baseline abstains |');
  L.push('|---|---:|---:|---:|---:|');
  for (const m of s.models) {
    L.push(`| ${m.name} | ${pct(m.accuracy)} | ${m.name.startsWith('closed-form') ? '—' : pp(m.deltaVsBaseline)} | ${pct(m.macroF1)} | ${pct(m.accuracyWhereBaselineAbstains)} |`);
  }
  for (const m of s.nulls) {
    L.push(`| _${m.name}_ | ${pct(m.accuracy)} | — | ${pct(m.macroF1)} | — |`);
  }
  L.push('');
  L.push(`Label-shuffle null: ${pct(Math.max(...s.nulls.map((n) => n.accuracy)))} against a majority-class floor of ${pct(s.baseline.majorityClassAccuracy)}.`);
  L.push('');
  L.push('| comparison | b | c | p | favours |');
  L.push('|---|---:|---:|---:|---|');
  for (const p of s.pairwise) {
    L.push(`| ${p.modelA} vs ${p.modelB} | ${p.b} | ${p.c} | ${p.pValue < 1e-4 ? p.pValue.toExponential(1) : p.pValue.toFixed(4)} | ${p.favours === 'neither' ? 'no difference' : p.favours === 'a' ? p.modelA : p.modelB} |`);
  }
  L.push('');
  L.push(`- Coverage: ${pct(s.baseline.coverage)} parseable, ${pct(s.baseline.unlabellable)} unlabellable.`);
  L.push(`- Disagreement set: ${group(s.disagreement.n)} PRs (${pct(s.disagreement.rate)} of parseable).`);
  L.push(`- k-means ARI ${s.clustering.adjustedRandIndex.toFixed(3)} (null ${s.clustering.nullAdjustedRandIndex.toFixed(3)}) — clusters are not the taxonomy.`);
  {
    // The accuracy win and the macro-F1 loss are one finding, not two, and the
    // digest must not carry only the flattering half. Same selection as the
    // HTML verdict, via the shared helper, so the two surfaces cannot quote
    // different "best model" numbers for the same run.
    const base = s.models.find((m) => m.name.startsWith('closed-form'));
    const best = bestByMacroF1(s);
    if (base && best && base.macroF1 > best.macroF1) {
      L.push(
        `- **Macro-F1 goes the other way**: baseline ${pct(base.macroF1)} vs ${pct(best.macroF1)} ` +
          `for the best model (${best.name}). The models win on accuracy by serving the large ` +
          `areas; they are no better on the tail.`,
      );
    }
  }
  L.push('');
  return L.join('\n');
}
