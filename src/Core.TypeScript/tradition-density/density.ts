/**
 * density.ts — the fold from an append-only draw ledger to a **distribution**, and no verdict.
 *
 * ## Depth is recurrence. Depth is never a self-report.
 *
 * The one thing this module must get right: a target's depth is
 *
 * > **the number of DISTINCT drawn traditions that independently named it.**
 *
 * Not how many times it was mentioned (drawing `68 Computer science` twice is one tradition, not
 * two), and above all not how deep the submitter said it felt. `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`
 * records why: **Kevin Bacon is not the most connected actor** — Steiger and others outrank him;
 * he is famous because of the game. *"The named hub and the actual hub are different nodes.
 * Appointment tracks fame; emergence tracks use."* A per-draw confidence score is an appointment.
 * Let it set depth and the probe will faithfully rediscover the anchors we were already fond of,
 * which is the selection bias it exists to defeat.
 *
 * `selfReportedDepth` is therefore read **only** by {@link fameVsUse}, which exists to display the
 * gap between the two rankings — never by {@link densityOf}.
 *
 * ## Why recurrence answers the confabulation objection
 *
 * A language model asked *"does tradition X connect to Zeta?"* will find something for any X; a
 * single draw is thus uninformative, and the natural mitigation looks like pre-registration.
 * Aaron 2026-08-17: *"this is the single request/response failure — iterated density connections
 * over time is how you find the weak connections over the dense ones in an infinite iterated
 * game."* Per-draw invention scatters across targets because each draw invents afresh; genuine
 * coupling lands on the **same** target from unrelated traditions. Iteration, not pre-registration,
 * is the falsifier — which is why nothing here thresholds a single draw.
 *
 * ## What the numbers mean, and what this module refuses to say
 *
 * Aaron's expectation is a **scale-free** picture (Barabási & Albert, *Emergence of Scaling in
 * Random Networks*, Science 286, 1999): near-universal shallow connection with a few genuinely
 * dense targets. The readings:
 *
 * | observation | reading |
 * |---|---|
 * | near-universal connection, **power-law** depth | expected — the space is scale-free |
 * | depth **uniform** across targets | **vacuity** — the framework does not discriminate |
 * | everything depth-1, no dense targets | no real structure found (yet) |
 *
 * The evenness statistic below makes that inspectable; it does **not** decide it. There is no
 * threshold in this file, deliberately, on the same reasoning as `../chip9/consult-census.ts`:
 * "how uniform is too uniform" has no defensible constant, and inventing one would smuggle in the
 * hidden oracle. Report the distribution; the caller judges.
 */
import { stringCompare } from "../collation/collation";
import type { Coupling, LedgerEntry } from "./ledger";

/** Deterministic ordering helper — code-point order, never `localeCompare`. */
const byTargetName = (a: string, b: string): number => stringCompare(a, b);

/** One target's standing in the distribution. */
export interface TargetDensity {
  readonly target: string;
  /** **DEPTH** — distinct drawn traditions that named this target. The only ranking signal. */
  readonly depth: number;
  /** Total namings, including repeat draws of the same tradition. Reported for contrast with depth. */
  readonly mentions: number;
  /** The distinct tradition codes, ascending. Makes every depth auditable back to its draws. */
  readonly traditions: readonly string[];
  /** **FAME** — mentions whose submitter self-reported `"deep"`. Displayed; never ranked on. */
  readonly selfReportedDeepMentions: number;
}

export interface DensityReport {
  readonly corpus: string;
  readonly corpusVersion: string;
  /** Every ledger row, nulls included. Nulls are in every denominator here. */
  readonly draws: number;
  readonly nullDraws: number;
  readonly coupledDraws: number;
  /** Distinct traditions actually drawn — draws are with replacement, so this can be `< draws`. */
  readonly distinctTraditionsDrawn: number;
  readonly targets: readonly TargetDensity[];
}

function isNull(c: Coupling): boolean {
  return c.kind === "null";
}

/**
 * Fold the ledger into the density distribution.
 *
 * Targets are ranked by depth descending, ties broken by target name ascending — total and
 * deterministic, so the same ledger prints the same table everywhere (DST).
 */
export function densityOf(entries: readonly LedgerEntry[]): DensityReport {
  const traditionsByTarget = new Map<string, Set<string>>();
  const mentionsByTarget = new Map<string, number>();
  const fameByTarget = new Map<string, number>();

  for (const e of entries) {
    if (e.coupling.kind !== "coupled") continue;
    for (const t of e.coupling.targets) {
      const seen = traditionsByTarget.get(t.target) ?? new Set<string>();
      seen.add(e.code);
      traditionsByTarget.set(t.target, seen);
      mentionsByTarget.set(t.target, (mentionsByTarget.get(t.target) ?? 0) + 1);
      // Read here and NOWHERE else in this function's ranking path.
      if (t.selfReportedDepth === "deep") fameByTarget.set(t.target, (fameByTarget.get(t.target) ?? 0) + 1);
    }
  }

  const targets: TargetDensity[] = [...traditionsByTarget.entries()]
    .map(([target, codes]) => ({
      target,
      depth: codes.size,
      mentions: mentionsByTarget.get(target) ?? 0,
      traditions: [...codes].sort(byTargetName),
      selfReportedDeepMentions: fameByTarget.get(target) ?? 0,
    }))
    .sort((a, b) => (a.depth !== b.depth ? b.depth - a.depth : byTargetName(a.target, b.target)));

  const first = entries[0];
  return {
    corpus: first?.corpus ?? "",
    corpusVersion: first?.corpusVersion ?? "",
    draws: entries.length,
    nullDraws: entries.filter((e) => isNull(e.coupling)).length,
    coupledDraws: entries.filter((e) => !isNull(e.coupling)).length,
    distinctTraditionsDrawn: new Set(entries.map((e) => e.code)).size,
    targets,
  };
}

/** Share of draws that named nothing. `NaN` on an empty ledger — no rate exists over zero draws. */
export function nullRate(r: DensityReport): number {
  return r.draws === 0 ? Number.NaN : r.nullDraws / r.draws;
}

/**
 * **Pielou's evenness** `J' = H' / ln(S)` over the depth distribution (Pielou, *The measurement of
 * diversity in different types of biological collections*, J. Theoret. Biol. 13, 1966; `H'` is
 * Shannon 1948). In `[0, 1]`: `1` is perfectly uniform depth, lower is concentrated.
 *
 * Parameter-free — `S` is the observed target count and `ln` is not a tuning knob, so this
 * introduces no gating constant. `NaN` when fewer than two targets exist: with `S < 2`, `ln(S) = 0`
 * and evenness is undefined, and returning `1` there would report "perfectly uniform" for a
 * measurement that never ran.
 *
 * It is a **descriptive statistic, not a test.** `J'` near 1 is the vacuity *reading*, and how near
 * is near enough is the caller's call.
 */
export function evenness(r: DensityReport): number {
  const depths = r.targets.map((t) => t.depth);
  const s = depths.length;
  if (s < 2) return Number.NaN;
  const total = depths.reduce((a, b) => a + b, 0);
  if (total === 0) return Number.NaN;
  const h = depths.reduce((acc, d) => {
    if (d === 0) return acc;
    const p = d / total;
    return acc - p * Math.log(p);
  }, 0);
  return h / Math.log(s);
}

/** The rank-frequency table: `(rank, depth)` descending. Inspect it for the power-law shape by eye. */
export function rankFrequency(r: DensityReport): readonly { readonly rank: number; readonly depth: number; readonly target: string }[] {
  return r.targets.map((t, i) => ({ rank: i + 1, depth: t.depth, target: t.target }));
}

/**
 * The **fame-vs-use gap**, made mechanical.
 *
 * Kendall's tau-a (Kendall, *A New Measure of Rank Correlation*, Biometrika 30, 1938) between the
 * self-reported "deep" counts (**fame**) and measured recurrence depth (**use**), over targets.
 * `tau = (C - D) / (n(n-1)/2)`; ties in either variable contribute to neither `C` nor `D`.
 *
 * This is a **display**, never an input: nothing in `densityOf` consults it. Its value is that a
 * large gap is exactly the Kevin Bacon finding — the target everyone *called* deep is not the
 * target the draws kept landing on. `NaN` for fewer than two targets.
 */
export interface FameVsUse {
  readonly concordant: number;
  readonly discordant: number;
  readonly tau: number;
}

export function fameVsUse(r: DensityReport): FameVsUse {
  const ts = r.targets;
  let c = 0;
  let d = 0;
  for (const [i, a] of ts.entries()) {
    for (const b of ts.slice(i + 1)) {
      const use = Math.sign(a.depth - b.depth);
      const fame = Math.sign(a.selfReportedDeepMentions - b.selfReportedDeepMentions);
      if (use === 0 || fame === 0) continue;
      if (use === fame) c++;
      else d++;
    }
  }
  const n = ts.length;
  return { concordant: c, discordant: d, tau: n < 2 ? Number.NaN : (c - d) / ((n * (n - 1)) / 2) };
}

// ── presentation ────────────────────────────────────────────────────────────────────────────────

function fmt(x: number): string {
  return Number.isNaN(x) ? "n/a (undefined at this sample size)" : x.toFixed(4);
}

/** Human-readable report. Prints numbers and their readings; states no verdict. */
export function formatReport(r: DensityReport): string {
  const lines: string[] = [];
  lines.push(`corpus:            ${r.corpus} ${r.corpusVersion}`);
  lines.push(`draws:             ${String(r.draws)}  (distinct traditions drawn: ${String(r.distinctTraditionsDrawn)})`);
  lines.push(`coupled / null:    ${String(r.coupledDraws)} / ${String(r.nullDraws)}   null rate ${fmt(nullRate(r))}`);
  lines.push(`distinct targets:  ${String(r.targets.length)}`);
  lines.push(`evenness (J'):     ${fmt(evenness(r))}   1 = uniform depth (vacuity reading), lower = concentrated`);
  const fu = fameVsUse(r);
  lines.push(`fame vs use tau:   ${fmt(fu.tau)}   (concordant ${String(fu.concordant)}, discordant ${String(fu.discordant)}) — displayed, never ranked on`);
  lines.push("");
  lines.push("rank  depth  mentions  self-deep  target");
  // Rank is the position in `r.targets`, which `rankFrequency` also reads — one ordering, one source.
  for (const [i, t] of r.targets.entries()) {
    lines.push(
      `${String(i + 1).padStart(4)}  ${String(t.depth).padStart(5)}  ${String(t.mentions).padStart(8)}  ${String(t.selfReportedDeepMentions).padStart(9)}  ${t.target}  [${t.traditions.join(" ")}]`,
    );
  }
  lines.push("");
  lines.push("No verdict is attached. Uniform depth reads as vacuity; a power-law tail reads as scale-free");
  lines.push("structure; all-depth-1 reads as no structure found yet. Which of those this is, is the caller's call.");
  return lines.join("\n");
}
