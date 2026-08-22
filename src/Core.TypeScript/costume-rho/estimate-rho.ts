#!/usr/bin/env bun
/**
 * estimate-rho.ts — within-family vs cross-family error correlation, with the verdict criteria
 * fixed BEFORE the numbers are looked at.
 *
 * ── PRE-REGISTERED READINGS (stated here so the design cannot only produce the encouraging answer)
 *
 * W = mean tetrachoric rho-hat over WITHIN-FAMILY pairs   (same model weights, different persona)
 * X = mean tetrachoric rho-hat over CROSS-FAMILY pairs    (different model weights)
 * D = W - X, with a cluster-bootstrap 95% CI (clusters = item strata, so content dependence is
 *     respected rather than assumed away)
 *
 *   COSTUMES      CI_low(D) >  0.15   personas leave a pair materially more correlated than
 *                                     switching model family does. Persona differentiation is not
 *                                     a substitute for distinct weights; buying decorrelation costs
 *                                     RAM. (Corroborating, not required: W high in absolute terms.)
 *   GENUINE       CI(D) contained in [-0.10, +0.10]   personas decorrelate about as well as distinct
 *                                     model families. Surprising, and it would make phase 2 cheap.
 *   INCONCLUSIVE  anything else — the CI spans both readings. SAY SO, and report the n that would
 *                                     settle it. An honest null with a power calculation is a real
 *                                     result; a confident number from thin data is not.
 *
 * Degeneracy guards that OVERRIDE the above (the task failed, not the society):
 *   - any agent with error variance ~0 (never wrong / always wrong) -> its rho is undefined, excluded
 *   - c-hat <= 0.5 for most agents -> below-chance jurors; Condorcet runs backwards, report first
 *
 * ── ESTIMATOR: tetrachoric, never phi. See tetrachoric.ts for why, and validate.ts for the measured
 * demonstration (phi under-reports true rho by 21%-66% on this repo's own generative model).
 * ── BOUNDARY: compared against `rhoStarAlgebraic(N) = (N-3)/(3(N-1))`, NEVER `findRhoStar`, which
 * bisects a non-monotone predicate and under-reports by 2.8x at N=8, c=0.65 (re-verified in validate.ts).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { effectiveSampleSizeHAC, neweyWestBandwidth, phi, tableOf, tetrachoric } from "./tetrachoric";

interface Response {
  agent: string; model: string; persona: string; itemId: string;
  predictedKilled: boolean; truth: boolean; error: 0 | 1; fallback: boolean; raw: string; ms: number;
}
interface Item { id: string; stratum: string; killed: boolean }

function argValue(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
}

function splitmix64(seed: bigint): () => number {
  let s = seed & 0xffffffffffffffffn;
  return () => {
    s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z >> 11n) / 2 ** 53;
  };
}

const mean = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const quantile = (a: readonly number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
};

function analyse(
  agents: readonly string[],
  errByAgent: ReadonlyMap<string, readonly number[]>,
  idx: readonly number[],
  familyOf: ReadonlyMap<string, string>,
): { within: number[]; cross: number[]; pairs: { a: string; b: string; rho: number; kind: string }[] } {
  const within: number[] = [], cross: number[] = [];
  const pairs: { a: string; b: string; rho: number; kind: string }[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i]!, b = agents[j]!;
      const ea = idx.map((t) => errByAgent.get(a)![t]!);
      const eb = idx.map((t) => errByAgent.get(b)![t]!);
      const r = tetrachoric(tableOf(ea, eb));
      if (!r.defined || Number.isNaN(r.rho)) continue;
      const kind = familyOf.get(a) === familyOf.get(b) ? "within" : "cross";
      (kind === "within" ? within : cross).push(r.rho);
      pairs.push({ a, b, rho: r.rho, kind });
    }
  }
  return { within, cross, pairs };
}

function main(): number {
  const root = process.cwd();
  const respPath = argValue("--responses", "db/costume-rho/responses.jsonl");
  const itemsPath = argValue("--items", "db/costume-rho/items.jsonl");
  const excludeFallback = process.argv.includes("--exclude-fallback");
  const B = Number(argValue("--boot", "2000"));

  // `--models a,b` restricts the panel. Used to produce the PRIMARY estimate over the families that
  // actually emit a judgment, after the raw-index guard below identifies the ones that do not. A
  // constant responder's rho is a fact about position bias, and averaging it into W or X reports
  // that artefact as if it were a property of personas or of weights.
  const modelFilter = argValue("--models", "");
  const keep = modelFilter.length > 0 ? new Set(modelFilter.split(",")) : null;

  const responses: Response[] = readFileSync(join(root, respPath), "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Response)
    .filter((r) => keep === null || keep.has(r.model));
  const items: Item[] = readFileSync(join(root, itemsPath), "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Item);
  if (keep !== null) console.log(`\n[filter] restricted to models: ${[...keep].join(", ")}`);

  const agents = [...new Set(responses.map((r) => r.agent))].sort();
  const familyOf = new Map(agents.map((a) => [a, a.split("|")[0]!]));

  // Items every agent answered (paired observations are what rho requires).
  const perAgent = new Map<string, Map<string, Response>>();
  for (const a of agents) perAgent.set(a, new Map());
  for (const r of responses) perAgent.get(r.agent)!.set(r.itemId, r);
  let common = items.map((i) => i.id).filter((id) => agents.every((a) => perAgent.get(a)!.has(id)));

  let fallbackDropped = 0;
  if (excludeFallback) {
    const before = common.length;
    common = common.filter((id) => agents.every((a) => !perAgent.get(a)!.get(id)!.fallback));
    fallbackDropped = before - common.length;
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const strata = common.map((id) => itemById.get(id)!.stratum);
  const errByAgent = new Map<string, number[]>(
    agents.map((a) => [a, common.map((id) => perAgent.get(a)!.get(id)!.error as number)]),
  );

  const n = common.length;
  const N = agents.length;
  const fallbackRate = responses.filter((r) => r.fallback).length / responses.length;

  console.log(`\n═══ SETUP ═══`);
  console.log(`agents N = ${N}   shared scored items n = ${n}   families = ${[...new Set(familyOf.values())].join(", ")}`);
  console.log(`base rate (mutants actually killed) = ${(items.filter((i) => i.killed).length / items.length).toFixed(3)}`);
  console.log(`harness fallback rate (model emitted no parseable index; production scores index 0) = ${(fallbackRate * 100).toFixed(2)}%`);
  if (excludeFallback) console.log(`--exclude-fallback: dropped ${fallbackDropped} items touched by any fallback`);

  // ── Competence ────────────────────────────────────────────────────────────────────────────────
  console.log(`\n═══ COMPETENCE c-hat (per agent, binomial 95% CI) ═══`);
  let degenerate = 0, belowChance = 0, degenerateRaw = 0;
  for (const a of agents) {
    const e = errByAgent.get(a)!;
    const c = 1 - mean(e);
    const se = Math.sqrt(Math.max(c * (1 - c), 1e-12) / n);
    if (c <= 0.5) belowChance++;
    const sd = Math.sqrt(mean(e.map((x) => (x - mean(e)) ** 2)));
    if (sd < 1e-9) degenerate++;
    // DEGENERACY IS MEASURED ON THE RAW EMITTED INDEX, NOT ON predictedKilled.
    // Own error, 2026-08-16: the first version of this guard tested `predictedKilled`, which the
    // per-item option-order permutation makes look varied even for an agent that emits the SAME
    // index every time. It passed llama3.1:8b as a healthy agent while that agent answered "1" on
    // 200/200 items. A guard that a constant responder walks through is not a guard.
    const rawCounts = new Map<string, number>();
    for (const id of common) {
      const k = perAgent.get(a)!.get(id)!.raw.trim();
      rawCounts.set(k, (rawCounts.get(k) ?? 0) + 1);
    }
    const topRaw = [...rawCounts.entries()].sort((u, v) => v[1] - u[1])[0]!;
    const constancy = topRaw[1] / n;
    if (constancy > 0.95) degenerateRaw++;
    console.log(
      `  ${a.padEnd(22)} c = ${c.toFixed(3)} ± ${(1.96 * se).toFixed(3)}` +
        `   error sd = ${sd.toFixed(3)}   modal raw index "${topRaw[0]}" on ${(constancy * 100).toFixed(1)}% of items` +
        `${constancy > 0.95 ? "   *** CONSTANT RESPONDER — emits no judgment ***" : ""}`,
    );
  }
  if (degenerate > 0) console.log(`  !! ${degenerate} agent(s) have ~zero error variance — their rho is undefined and they are excluded from pairs.`);
  if (degenerateRaw > 0) {
    console.log(
      `  !! ${degenerateRaw}/${N} agent(s) emit the SAME option index on >95% of items. Their apparent error\n` +
        `     variance comes from the per-item option permutation, not from judgment, so every rho-hat\n` +
        `     involving them measures POSITION BIAS. Two constant responders with the same modal index are\n` +
        `     correlated ~+1 and with opposite modal indices ~-1, in both cases for reasons that have\n` +
        `     nothing to do with personas or weights. This OVERRIDES the contrast verdict below.`,
    );
  }
  if (belowChance > N / 2) console.log(`  !! ${belowChance}/${N} agents are at or below chance. Condorcet runs BACKWARDS here; the rho question is secondary.`);

  // ── Point estimates ───────────────────────────────────────────────────────────────────────────
  const full = analyse(agents, errByAgent, common.map((_, t) => t), familyOf);
  const W = full.within.length ? mean(full.within) : NaN;
  const X = full.cross.length ? mean(full.cross) : NaN;
  const D = W - X;

  console.log(`\n═══ PAIRWISE TETRACHORIC rho-hat (full matrix, never only the mean) ═══`);
  for (const p of full.pairs.sort((u, v) => v.rho - u.rho)) {
    console.log(`  ${p.kind.padEnd(6)} ${p.a.padEnd(22)} ${p.b.padEnd(22)} rho = ${p.rho >= 0 ? " " : ""}${p.rho.toFixed(4)}`);
  }

  // ── n_eff (Bartlett-windowed HAC on the pair's own error-product series) ───────────────────────
  const neffs: number[] = [];
  for (const p of full.pairs) {
    const ea = errByAgent.get(p.a)!, eb = errByAgent.get(p.b)!;
    const series = ea.map((v, t) => v * eb[t]!);
    neffs.push(effectiveSampleSizeHAC(series, neweyWestBandwidth(series.length)));
  }
  const nEff = neffs.length ? Math.min(...neffs) : n;
  console.log(`\n  n_eff (AntiSybil.effectiveSampleSizeHAC on the error-product series): min ${nEff.toFixed(1)} / median ${quantile(neffs, 0.5).toFixed(1)} of n = ${n}`);

  // ── Cluster bootstrap (clusters = item strata) ────────────────────────────────────────────────
  const stratumList = [...new Set(strata)];
  const byStratum = new Map<string, number[]>();
  strata.forEach((s, t) => { if (!byStratum.has(s)) byStratum.set(s, []); byStratum.get(s)!.push(t); });
  const rnd = splitmix64(4n);
  const Ws: number[] = [], Xs: number[] = [], Ds: number[] = [];
  for (let b = 0; b < B; b++) {
    const idx: number[] = [];
    for (let s = 0; s < stratumList.length; s++) {
      const pick = stratumList[Math.floor(rnd() * stratumList.length)]!;
      idx.push(...byStratum.get(pick)!);
    }
    const res = analyse(agents, errByAgent, idx, familyOf);
    if (res.within.length === 0 || res.cross.length === 0) continue;
    const w = mean(res.within), x = mean(res.cross);
    Ws.push(w); Xs.push(x); Ds.push(w - x);
  }
  const ci = (a: number[]): [number, number] => [quantile(a, 0.025), quantile(a, 0.975)];
  const [wl, wh] = ci(Ws), [xl, xh] = ci(Xs), [dl, dh] = ci(Ds);

  console.log(`\n═══ RESULT (${B} cluster-bootstrap resamples, clusters = ${stratumList.length} item strata) ═══`);
  console.log(`  WITHIN-family rho-hat  W = ${W.toFixed(4)}   95% CI [${wl.toFixed(4)}, ${wh.toFixed(4)}]   (${full.within.length} pairs)`);
  console.log(`  CROSS-family  rho-hat  X = ${X.toFixed(4)}   95% CI [${xl.toFixed(4)}, ${xh.toFixed(4)}]   (${full.cross.length} pairs)`);
  console.log(`  CONTRAST               D = ${D.toFixed(4)}   95% CI [${dl.toFixed(4)}, ${dh.toFixed(4)}]`);

  // phi reported ONLY as the attenuated lower bound it is
  const phiW: number[] = [], phiX: number[] = [];
  for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
    const t = tableOf(errByAgent.get(agents[i]!)!, errByAgent.get(agents[j]!)!);
    const p = phi(t);
    if (!Number.isNaN(p)) (familyOf.get(agents[i]!) === familyOf.get(agents[j]!) ? phiW : phiX).push(p);
  }
  console.log(`  [phi, ATTENUATED LOWER BOUND only — not the estimator] within ${mean(phiW).toFixed(4)}, cross ${mean(phiX).toFixed(4)}`);

  // ── Verdict ───────────────────────────────────────────────────────────────────────────────────
  const rhoStarAlgebraic = (m: number): number => (m <= 3 ? 0 : (m - 3) / (3 * (m - 1)));
  console.log(`\n═══ VERDICT (criteria fixed before the numbers) ═══`);
  let verdict: string;
  if (degenerate > 0 && degenerate >= N - 1) verdict = "TASK DEGENERATE — error variance vanished; the task failed, not the society";
  else if (dl > 0.15) verdict = "COSTUMES — personas leave pairs materially more correlated than distinct model families do";
  else if (dl >= -0.10 && dh <= 0.10) verdict = "GENUINE — personas decorrelate about as well as distinct model families";
  else verdict = "INCONCLUSIVE — the CI spans both readings";
  console.log(`  ${verdict}`);
  console.log(`  (D CI = [${dl.toFixed(4)}, ${dh.toFixed(4)}]; COSTUMES needs CI_low > 0.15; GENUINE needs CI within [-0.10, 0.10])`);

  console.log(`\n═══ ABSOLUTE READING vs the majority-vote boundary ═══`);
  console.log(`  rhoStarAlgebraic(N=${N}) = ${rhoStarAlgebraic(N).toFixed(4)}   rhoStarAlgebraic(3) = 0.0000 (the production roster's size)`);
  const soc = Math.max(W, X);
  console.log(`  worst-case society rho-hat = ${soc.toFixed(4)} ${soc > 1 / 3 ? "> 1/3 -> N_eff < 3 at ANY N; more runners cannot fix correlation" : "<= 1/3"}`);

  // ── Power ─────────────────────────────────────────────────────────────────────────────────────
  const seD = Math.sqrt(mean(Ds.map((d) => (d - mean(Ds)) ** 2)));
  console.log(`\n═══ POWER ═══`);
  console.log(`  bootstrap SE(D) = ${seD.toFixed(4)} at n = ${n} shared items`);
  for (const target of [0.30, 0.20, 0.15, 0.10]) {
    // n needed so that 1.96*SE < target (SE scales as 1/sqrt(n))
    const need = Math.ceil(n * (1.96 * seD / target) ** 2);
    console.log(`  to resolve a contrast of ${target.toFixed(2)} at 95% (1.96*SE < ${target.toFixed(2)}): n >= ${need} shared items` +
      `  (= ${need * N} model calls at N = ${N})`);
  }
  return 0;
}

if (import.meta.main) process.exit(main());
