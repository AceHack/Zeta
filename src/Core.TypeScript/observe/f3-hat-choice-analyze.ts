#!/usr/bin/env bun
/**
 * f3-hat-choice-analyze.ts — recompute every reported number from the raw JSONL.
 *
 * STATUS: toy. Reads `data/f3-hat-choice/*.jsonl` and prints the report that
 * `docs/research/2026-08-26-*` cites. No generation happens here, so a reviewer
 * can re-derive the numbers offline without a model.
 *
 *   bun f3-hat-choice-analyze.ts e1
 *   bun f3-hat-choice-analyze.ts e2
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  canonAtom,
  canonWords,
  effectiveN,
  generateWorkItems,
  hillN0,
  hillN1,
  hillN2,
  jackknifeSe,
  jensenShannonDivergence,
  makeRng,
  meanPairwiseAnswerAgreement,
  meanPairwisePhi,
  permutationTest,
  scoreAnswers,
  splitHalf,
  tally,
  type Distribution,
} from "./f3-hat-choice-decorrelation";

const OUT_DIR = join(import.meta.dir, "..", "..", "..", "data", "f3-hat-choice");
const f3 = (x: number): string => (Number.isFinite(x) ? x.toFixed(3) : "undefined");

/**
 * Perform the read and interpret its failure — never `existsSync` then read. An absent
 * file is an empty result here, which is exactly what ENOENT means, so the separate
 * existence question buys nothing the read does not already answer and opens a window in
 * which the two can disagree. (TOCTTOU — Bishop & Dilger 1996; CWE-367.)
 */
function readJsonl<T>(file: string): T[] {
  let body: string;
  try {
    body = readFileSync(join(OUT_DIR, file), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return body
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as T);
}

/** Mean JSD over all unordered pairs of groups — the cross-phrasing statistic. */
function meanCrossJsd(groups: readonly Distribution[]): number {
  let s = 0;
  let n = 0;
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      s += jensenShannonDivergence(groups[i]!, groups[j]!);
      n++;
    }
  }
  return n > 0 ? s / n : Number.NaN;
}

// ═══ E1 ══════════════════════════════════════════════════════════════════════

interface ElicitRow {
  model: string;
  phrasing: string;
  seed: number;
  temperature: number;
  raw: string;
  ms: number;
  promptTokens: number;
  evalTokens: number;
}

function analyzeE1(): void {
  const rows = readJsonl<ElicitRow>("e1-elicitations.jsonl");
  if (rows.length === 0) {
    console.log("no E1 data — run `bun f3-hat-choice-run.ts e1` first");
    process.exit(1);
  }
  console.log(`E1 — elicitation stability. ${rows.length} generations.\n`);
  console.log("The falsifier: if the choice distribution shifts when the question is");
  console.log("reworded, the choice was the PROMPT'S, not the persona's. Cross-phrasing");
  console.log("JSD is judged against the WITHIN-phrasing split-half JSD of the same");
  console.log("sampler, which is the sampling-noise floor.\n");

  const groups = new Map<string, ElicitRow[]>();
  for (const r of rows) {
    const k = `${r.model}@T${r.temperature}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  for (const [key, grp] of groups) {
    const phrasings = [...new Set(grp.map((r) => r.phrasing))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const byPhrasing = phrasings.map((p) => grp.filter((r) => r.phrasing === p));

    // Atom level — the effective number of distinct CHOICES.
    const atomsPer = byPhrasing.map((g) => g.map((r) => canonAtom(r.raw.split("\n")[0] ?? "")));
    const atomsAll = atomsPer.flat();
    const dAll = tally(atomsAll);

    // Word level — the primary statistic (atom level saturates; see the test).
    const wordsPer = byPhrasing.map((g) => g.flatMap((r) => canonWords(r.raw.split("\n")[0] ?? "")));

    const crossWord = meanCrossJsd(wordsPer.map(tally));
    const floorWord =
      wordsPer.reduce((s, w) => {
        const [h1, h2] = splitHalf(w);
        return s + jensenShannonDivergence(h1, h2);
      }, 0) / wordsPer.length;

    const crossAtom = meanCrossJsd(atomsPer.map(tally));
    const floorAtom =
      atomsPer.reduce((s, a) => {
        const [h1, h2] = splitHalf(a);
        return s + jensenShannonDivergence(h1, h2);
      }, 0) / atomsPer.length;

    // Permutation test on the word-level cross-phrasing JSD. Under H0 the phrasing
    // label carries no information, so relabelling is the exact null.
    const flatWords = wordsPer.flat();
    const sizes = wordsPer.map((w) => w.length);
    const rng = makeRng(20260826);
    let atLeast = 0;
    const PERMS = 2000;
    let nullSum = 0;
    for (let p = 0; p < PERMS; p++) {
      const sh = [...flatWords];
      for (let i = sh.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = sh[i]!;
        sh[i] = sh[j]!;
        sh[j] = t;
      }
      let off = 0;
      const parts: Distribution[] = [];
      for (const sz of sizes) {
        parts.push(tally(sh.slice(off, off + sz)));
        off += sz;
      }
      const v = meanCrossJsd(parts);
      nullSum += v;
      if (v >= crossWord) atLeast++;
    }
    const pValue = (atLeast + 1) / (PERMS + 1);

    console.log(`── ${key} (N=${grp.length}, ${phrasings.length} phrasings) ────────────────`);
    console.log(`  Effective number of distinct CHOICES (atom level, pooled):`);
    console.log(
      `    N0 (raw distinct) = ${hillN0(dAll)}   N1 (exp H) = ${f3(hillN1(dAll))}   N2 (inv Simpson) = ${f3(hillN2(dAll))}`,
    );
    console.log(`    N0/N1 inflation = ${f3(hillN0(dAll) / Math.max(1e-9, hillN1(dAll)))}x`);
    const top = [...dAll.counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5);
    console.log(`    top 5: ${top.map(([k2, c]) => `${k2}(${c})`).join(", ")}`);
    console.log(
      `  Per-phrasing atom N1: ${phrasings.map((p, i) => `${p}=${f3(hillN1(tally(atomsPer[i]!)))}`).join("  ")}`,
    );
    console.log(`  WORD-LEVEL (primary):`);
    console.log(`    cross-phrasing JSD  = ${f3(crossWord)} bits`);
    console.log(`    split-half floor    = ${f3(floorWord)} bits`);
    console.log(`    ratio cross/floor   = ${f3(crossWord / Math.max(1e-9, floorWord))}x`);
    console.log(
      `    permutation p (H0: wording irrelevant) = ${pValue.toFixed(4)}  [null mean ${f3(nullSum / PERMS)}]`,
    );
    console.log(`  ATOM-LEVEL (saturating, reported for completeness):`);
    console.log(`    cross = ${f3(crossAtom)}   floor = ${f3(floorAtom)}`);
    const verdict =
      pValue >= 0.05
        ? "STABLE — rewording did not move the distribution beyond sampling noise"
        : "UNSTABLE — the distribution moves with the wording; the choice is the prompt's";
    console.log(`  VERDICT: ${verdict}\n`);
  }
}

// ═══ E2 ══════════════════════════════════════════════════════════════════════

interface WorkRow {
  condition: "N" | "A" | "B";
  model: string;
  agent: number;
  hat: string | null;
  item: string;
  answer: number | null;
  correctIndex: number | null;
  ms: number;
  promptTokens: number;
  evalTokens: number;
}

interface CondSummary {
  condition: string;
  agents: number;
  rhoBar: number;
  rhoSe: number;
  definedPairs: number;
  undefinedPairs: number;
  agreement: number;
  rhoAll: number;
  nEffPhi: number;
  accuracy: number;
  abstentionPrecision: number;
  abstentionRecall: number;
  abstentionsEmitted: number;
  hatN1: number;
  meanMs: number;
  totalTokens: number;
}

/** Same discipline for the directory listing: read it, interpret ENOENT, no pre-check. */
function listE2Files(): string[] {
  try {
    return readdirSync(OUT_DIR).filter((f) => f.startsWith("e2-") && f.endsWith(".jsonl") && !f.includes("-hats"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

function analyzeE2(): void {
  const files = listE2Files();
  if (files.length === 0) {
    console.log("no E2 data — run `bun f3-hat-choice-run.ts e2` first");
    process.exit(1);
  }
  const itemOrder = generateWorkItems(40, 42).map((i) => i.id);

  for (const file of files.sort((a, b) => (a < b ? -1 : 1))) {
    const rows = readJsonl<WorkRow>(file);
    if (rows.length === 0) continue;
    const model = rows[0]!.model;
    console.log(`\n══ E2 — ${model} (${rows.length} generations from ${file}) ══════════════`);
    console.log(`  N (no hat)      = the CALIBRATION FLOOR. Identical agents; ρ̄ must read ≈1.`);
    console.log(`  A (assigned)    = one author instance emitted the whole roster.`);
    console.log(`  B (self-select) = each agent was asked what it wants to be.\n`);

    const summaries: CondSummary[] = [];
    const correctnessByCond = new Map<string, boolean[][]>();
    const answersByCond = new Map<string, (number | null)[][]>();
    const behavedByCond = new Map<string, boolean[][]>();

    for (const cond of ["N", "A", "B"] as const) {
      const sub = rows.filter((r) => r.condition === cond);
      if (sub.length === 0) continue;
      const agents = [...new Set(sub.map((r) => r.agent))].sort((a, b) => a - b);

      const correctness: boolean[][] = [];
      const answers: (number | null)[][] = [];
      const behaved: boolean[][] = [];
      for (const a of agents) {
        const byItem = new Map(sub.filter((r) => r.agent === a).map((r) => [r.item, r]));
        const cv: boolean[] = [];
        const av: (number | null)[] = [];
        const bv: boolean[] = [];
        for (const id of itemOrder) {
          const r = byItem.get(id);
          av.push(r ? r.answer : null);
          // ACCURACY is scored on ANSWERABLE items only — unanswerable items are
          // scored separately as abstention and are never folded into accuracy.
          if (r && r.correctIndex !== null) cv.push(r.answer === r.correctIndex);
          // CORRELATION needs a per-item binary that does not go zero-variance the
          // moment a model sits at ceiling on the answerable subset. `behavedWell`
          // is "answered right, or correctly declined". It is a CORRELATION input,
          // never a quality score — the two quality numbers stay split above.
          bv.push(r ? (r.correctIndex === null ? r.answer === -1 : r.answer === r.correctIndex) : false);
        }
        correctness.push(cv);
        answers.push(av);
        behaved.push(bv);
      }
      correctnessByCond.set(cond, correctness);
      answersByCond.set(cond, answers);
      behavedByCond.set(cond, behaved);

      const phi = meanPairwisePhi(correctness);
      const jk = jackknifeSe(correctness, (s) => meanPairwisePhi(s).phi);
      const agreement = meanPairwiseAnswerAgreement(answers);
      const scores = scoreAnswers(sub.map((r) => ({ answer: r.answer, correctIndex: r.correctIndex })));
      const hats = [...new Set(sub.map((r) => r.hat ?? "<none>"))];
      const hatDist = tally(agents.map((a) => canonAtom(sub.find((r) => r.agent === a)?.hat ?? "<none>")));

      summaries.push({
        condition: cond,
        agents: agents.length,
        rhoBar: phi.phi,
        rhoSe: jk.se,
        definedPairs: phi.definedPairs,
        undefinedPairs: phi.undefinedPairs,
        agreement,
        rhoAll: meanPairwisePhi(behaved).phi,
        nEffPhi: effectiveN(agents.length, phi.phi),
        accuracy: scores.accuracy,
        abstentionPrecision: scores.abstentionPrecision,
        abstentionRecall: scores.abstentionRecall,
        abstentionsEmitted: scores.abstentionsEmitted,
        hatN1: hillN1(hatDist),
        meanMs: sub.reduce((s, r) => s + r.ms, 0) / sub.length,
        totalTokens: sub.reduce((s, r) => s + r.promptTokens + r.evalTokens, 0),
      });
      void hats;
    }

    for (const s of summaries) {
      console.log(`  ── condition ${s.condition} (${s.agents} agents, hat-roster N1=${f3(s.hatN1)}) ──`);
      console.log(`     ρ̄ (mean pairwise φ on correctness) = ${f3(s.rhoBar)} ± ${f3(s.rhoSe)} (jackknife SE)`);
      console.log(`        defined pairs=${s.definedPairs}, undefined (zero-variance agent)=${s.undefinedPairs}`);
      console.log(`     answer agreement (always defined) = ${f3(s.agreement)}`);
      console.log(`     ρ̄ over all items (answered-right OR correctly-declined) = ${f3(s.rhoAll)}`);
      console.log(`     N_eff from ρ̄ = ${f3(s.nEffPhi)} of ${s.agents} agents`);
      console.log(`     ACCURACY (answerable only)   = ${f3(s.accuracy)}`);
      console.log(
        `     ABSTENTION precision=${f3(s.abstentionPrecision)} recall=${f3(s.abstentionRecall)} emitted=${s.abstentionsEmitted}`,
      );
      console.log(
        `     latency mean = ${s.meanMs.toFixed(0)} ms/gen   tokens = ${s.totalTokens} (FLOP-proxy denominator; NOT joules)`,
      );
    }

    const A = correctnessByCond.get("A");
    const B = correctnessByCond.get("B");
    if (A && B) {
      const stat = (a: readonly boolean[][], b: readonly boolean[][]): number =>
        meanPairwisePhi(b).phi - meanPairwisePhi(a).phi;
      const pt = permutationTest(A, B, stat, 2000, 20260826, "less");
      console.log(`\n  ── THE CLAIM (primary: error correlation): ρ_B < ρ_A ──`);
      console.log(`     observed ρ_B − ρ_A = ${f3(pt.observed)}`);
      console.log(
        `     permutation p (one-sided, H1: B lower) = ${pt.pValue.toFixed(4)}  over ${pt.permutations} relabellings`,
      );
      console.log(`     null mean = ${f3(pt.nullMean)}`);
      const verdict = !Number.isFinite(pt.observed)
        ? "UNDECIDABLE — φ undefined in at least one condition (ceiling/floor on correctness)"
        : pt.pValue < 0.05 && pt.observed < 0
          ? "SUPPORTED — self-selection lowered error correlation"
          : pt.observed < 0
            ? "DIRECTIONALLY CONSISTENT, NOT SIGNIFICANT"
            : "REFUTED — self-selection did not lower error correlation";
      console.log(`     VERDICT: ${verdict}`);
    }

    // Ceiling-robust correlation. Uses the per-item "behaved well" binary so a
    // model at ceiling on the answerable subset does not make φ vanish. This is
    // the statistic the calibration gate is read from: condition N must read ≈1.
    const behA = behavedByCond.get("A");
    const behB = behavedByCond.get("B");
    const behN = behavedByCond.get("N");
    if (behA && behB) {
      const stat = (a: readonly boolean[][], b: readonly boolean[][]): number =>
        meanPairwisePhi(b).phi - meanPairwisePhi(a).phi;
      const pt = permutationTest(behA, behB, stat, 2000, 20260826, "less");
      console.log(`\n  ── THE CLAIM (ceiling-robust): ρ_B < ρ_A over all items ──`);
      if (behN) {
        const nRho = meanPairwisePhi(behN).phi;
        console.log(
          `     CALIBRATION GATE: condition N (identical agents) ρ̄ = ${f3(nRho)} ${
            Number.isFinite(nRho) && nRho > 0.95 ? "— PASSES" : "— FAILS; no number below is reportable"
          }`,
        );
      }
      console.log(`     observed ρ_B − ρ_A = ${f3(pt.observed)}`);
      console.log(
        `     permutation p (one-sided, H1: B lower) = ${pt.pValue.toFixed(4)}  over ${pt.permutations} relabellings`,
      );
      const verdict = !Number.isFinite(pt.observed)
        ? "UNDECIDABLE"
        : pt.pValue < 0.05 && pt.observed < 0
          ? "SUPPORTED — self-selection lowered correlation"
          : pt.observed < 0
            ? "DIRECTIONALLY CONSISTENT, NOT SIGNIFICANT"
            : "REFUTED — self-selection did not lower correlation";
      console.log(`     VERDICT: ${verdict}`);
    }

    // Secondary statistic. φ on correctness is undefined whenever a model sits at
    // ceiling or floor on the answerable items — a real and common outcome, not a
    // bug. Answer agreement is defined regardless, uses ALL items (including the
    // unanswerable class where behaviour actually varies), and is calibrated
    // against condition N, whose agents are IDENTICAL and therefore fix the
    // instrument's true upper reference.
    const ansA = answersByCond.get("A");
    const ansB = answersByCond.get("B");
    const ansN = answersByCond.get("N");
    if (ansA && ansB) {
      const stat = (a: readonly (number | null)[][], b: readonly (number | null)[][]): number =>
        meanPairwiseAnswerAgreement(b) - meanPairwiseAnswerAgreement(a);
      const pt = permutationTest(ansA, ansB, stat, 2000, 20260826, "less");
      console.log(`\n  ── THE CLAIM (secondary: answer agreement): agree_B < agree_A ──`);
      if (ansN) {
        console.log(
          `     reference: condition N (identical agents) agreement = ${f3(meanPairwiseAnswerAgreement(ansN))}`,
        );
      }
      console.log(`     observed agree_B − agree_A = ${f3(pt.observed)}`);
      console.log(
        `     permutation p (one-sided, H1: B lower) = ${pt.pValue.toFixed(4)}  over ${pt.permutations} relabellings`,
      );
      const verdict =
        pt.pValue < 0.05 && pt.observed < 0
          ? "SUPPORTED — self-selected agents agreed with each other less"
          : pt.observed < 0
            ? "DIRECTIONALLY CONSISTENT, NOT SIGNIFICANT"
            : "REFUTED — self-selection did not lower agreement";
      console.log(`     VERDICT: ${verdict}`);
    }
  }
}

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === "e1") analyzeE1();
  else if (cmd === "e2") analyzeE2();
  else {
    console.log("usage: bun f3-hat-choice-analyze.ts <e1|e2>");
    process.exit(2);
  }
}
