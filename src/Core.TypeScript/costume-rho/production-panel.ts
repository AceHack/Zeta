#!/usr/bin/env bun
/**
 * production-panel.ts — the rho-hat that prices the LIVE fleet, which `estimate-rho.ts` cannot
 * report for structural reasons.
 *
 * WHY THIS EXISTS AND WHAT IT IS NOT. `estimate-rho.ts` answers "do personas decorrelate as well
 * as weights?" — a WITHIN vs CROSS contrast, which needs both sets non-empty. The production
 * roster is a different shape: `.github/workflows/agent-heartbeat.yml` gives each lane its own
 * model family (alexa=qwen2.5:0.5b, otto=llama3.2:1b, soraya=gemma2:2b) and
 * `resolveParticipant` hands the chooser NO persona, so the live lanes differ in WEIGHTS ONLY.
 * The matching panel is therefore N = 3, one agent per family, persona held FIXED — and every
 * pair in it is cross-family. `estimate-rho.ts` skips any bootstrap resample whose `within` set
 * is empty (estimate-rho.ts:~205), so on this panel it would emit NaN. That is a correct refusal
 * for the contrast question and the wrong tool for this one.
 *
 * The estimator is IMPORTED from `tetrachoric.ts`, never reimplemented: same latent-normal
 * estimator, same Haldane-Anscombe correction, same cluster bootstrap over item strata. This file
 * changes the PANEL, never the measurement.
 *
 * HONEST LIMIT, stated because it biases the answer and would not feel wrong. Production injects
 * no persona block at all; this panel holds a persona FIXED. Every agent here therefore shares a
 * prompt prefix the live lanes do not share, which can only push the estimate UP relative to
 * production. So this reads as an UPPER bound on the production rho-hat, and an upper bound on rho
 * is a LOWER bound on N_eff — the conservative direction for the fleet's own claim. A true
 * no-persona arm needs a driver this harness does not have; it is named as unfinished, not
 * quietly approximated.
 *
 * Usage:
 *   bun src/Core.TypeScript/costume-rho/production-panel.ts \
 *     --responses db/costume-rho/prod-sizes-responses.jsonl \
 *     --items db/costume-rho/items.jsonl \
 *     --models qwen2.5:0.5b,llama3.2:1b,gemma2:2b [--boot 2000] [--exclude-fallback]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tableOf, tetrachoric } from "./tetrachoric";

interface Response {
  agent: string; model: string; persona: string; itemId: string;
  predictedKilled: boolean; truth: boolean; error: 0 | 1; fallback: boolean; raw: string; ms: number;
}
interface Item { id: string; stratum: string; killed: boolean }

function argValue(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
}

/** Same splitmix64 the harness bootstraps with, same seed, so resamples are reproducible. */
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

/** N_eff = N / (1 + (N-1)*rho) — CondorcetBoundary.effectiveN (src/Bayesian/CondorcetBoundary.fs:93). */
const effectiveN = (n: number, rho: number): number => {
  const r = Math.max(0, Math.min(1, rho));
  return n / (1 + (n - 1) * r);
};
/** rhoStarAlgebraic — CondorcetBoundary.fs:226. n<=3 => 0. */
const rhoStarAlgebraic = (n: number): number => (n <= 3 ? 0 : (n - 3) / (3 * (n - 1)));

function main(): number {
  const root = process.cwd();
  const respPath = argValue("--responses", "db/costume-rho/prod-sizes-responses.jsonl");
  const itemsPath = argValue("--items", "db/costume-rho/items.jsonl");
  const models = argValue("--models", "qwen2.5:0.5b,llama3.2:1b,gemma2:2b").split(",").filter(Boolean);
  const B = Number(argValue("--boot", "2000"));
  const excludeFallback = process.argv.includes("--exclude-fallback");

  const all: Response[] = readFileSync(join(root, respPath), "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Response);
  const items: Item[] = readFileSync(join(root, itemsPath), "utf8")
    .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Item);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const personas = [...new Set(all.map((r) => r.persona))].sort();

  console.log(`\n═══ PRODUCTION PANEL — one agent per model family, persona held fixed ═══`);
  console.log(`families (= the live lanes): ${models.join(", ")}`);
  console.log(`N = ${models.length}   rhoStarAlgebraic(N=${models.length}) = ${rhoStarAlgebraic(models.length).toFixed(4)}`);
  console.log(`every pair is CROSS-FAMILY; there are no within-family pairs by construction.\n`);

  const perPersonaRho: { persona: string; rho: number; lo: number; hi: number; n: number; minC: number; belowChance: number }[] = [];

  for (const persona of personas) {
    const agents = models.map((m) => `${m}|${persona}`);
    const perAgent = new Map<string, Map<string, Response>>();
    for (const a of agents) perAgent.set(a, new Map());
    for (const r of all) if (perAgent.has(r.agent)) perAgent.get(r.agent)!.set(r.itemId, r);
    if (agents.some((a) => perAgent.get(a)!.size === 0)) {
      console.log(`  ${persona}: MISSING an agent for one or more families — skipped`);
      continue;
    }

    let common = items.map((i) => i.id).filter((id) => agents.every((a) => perAgent.get(a)!.has(id)));
    if (excludeFallback) common = common.filter((id) => agents.every((a) => !perAgent.get(a)!.get(id)!.fallback));
    const n = common.length;
    const errByAgent = new Map<string, number[]>(
      agents.map((a) => [a, common.map((id) => perAgent.get(a)!.get(id)!.error as number)]),
    );

    const pairRho = (idx: readonly number[]): number[] => {
      const out: number[] = [];
      for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) {
        const ea = idx.map((t) => errByAgent.get(agents[i]!)![t]!);
        const eb = idx.map((t) => errByAgent.get(agents[j]!)![t]!);
        const r = tetrachoric(tableOf(ea, eb));
        if (r.defined && !Number.isNaN(r.rho)) out.push(r.rho);
      }
      return out;
    };

    const full = pairRho(common.map((_, t) => t));
    const rho = full.length ? mean(full) : NaN;

    // COMPETENCE FIRST. Condorcet's theorem — and therefore N_eff, which is only meaningful as an
    // input to it — assumes jurors better than chance. Below c = 0.5 the majority is WORSE than a
    // single juror and adding lanes makes it worse still, so an N_eff printed there is not a
    // conservative estimate of fleet value; it is a category error wearing a number.
    const comps = agents.map((a) => 1 - mean(errByAgent.get(a)!));
    const minC = Math.min(...comps);
    const belowChance = comps.filter((c) => c <= 0.5).length;

    // Cluster bootstrap over item strata — identical scheme to estimate-rho.ts.
    const strata = common.map((id) => itemById.get(id)!.stratum);
    const stratumList = [...new Set(strata)];
    const byStratum = new Map<string, number[]>();
    strata.forEach((s, t) => { if (!byStratum.has(s)) byStratum.set(s, []); byStratum.get(s)!.push(t); });
    const rnd = splitmix64(4n);
    const boots: number[] = [];
    for (let b = 0; b < B; b++) {
      const idx: number[] = [];
      for (let s = 0; s < stratumList.length; s++) {
        idx.push(...byStratum.get(stratumList[Math.floor(rnd() * stratumList.length)]!)!);
      }
      const rs = pairRho(idx);
      if (rs.length) boots.push(mean(rs));
    }
    const lo = boots.length ? quantile(boots, 0.025) : NaN;
    const hi = boots.length ? quantile(boots, 0.975) : NaN;
    perPersonaRho.push({ persona, rho, lo, hi, n, minC, belowChance });

    console.log(`  persona ${persona.padEnd(8)} n=${n}  rho-hat = ${rho.toFixed(4)}  95% CI [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);
    const pairNames: string[] = [];
    for (let i = 0; i < agents.length; i++) for (let j = i + 1; j < agents.length; j++) pairNames.push(`${agents[i]!.split("|")[0]} x ${agents[j]!.split("|")[0]}`);
    full.forEach((r, k) => console.log(`      ${pairNames[k]!.padEnd(30)} rho = ${r >= 0 ? " " : ""}${r.toFixed(4)}`));
    console.log(`      competence c-hat per lane = [${comps.map((c) => c.toFixed(3)).join(", ")}]` +
      `${belowChance > 0 ? `   *** ${belowChance}/${agents.length} AT OR BELOW CHANCE ***` : ""}`);
    if (belowChance > 0) {
      console.log(`      N_eff = REFUSED — Condorcet assumes c > 0.5; ${belowChance} lane(s) are not. ` +
        `Majority vote here is worse than one lane, so no N_eff is reportable as fleet value.`);
    } else {
      console.log(`      N_eff = ${effectiveN(models.length, rho).toFixed(3)}  (CI [${effectiveN(models.length, hi).toFixed(3)}, ${effectiveN(models.length, lo).toFixed(3)}])`);
    }
  }

  if (perPersonaRho.length > 0) {
    const rhos = perPersonaRho.map((p) => p.rho);
    const pooled = mean(rhos);
    const anyBelow = perPersonaRho.reduce((acc, p) => acc + p.belowChance, 0);
    console.log(`\n═══ POOLED OVER PERSONAS (each persona is one realisation of the production shape) ═══`);
    console.log(`  rho-hat (mean over ${perPersonaRho.length} personas) = ${pooled.toFixed(4)}`);
    console.log(`  range across personas = [${Math.min(...rhos).toFixed(4)}, ${Math.max(...rhos).toFixed(4)}]`);

    if (anyBelow > 0) {
      console.log(`\n  ═══ N_eff IS REFUSED — THE CONDORCET PRECONDITION FAILS ═══`);
      console.log(`  ${anyBelow} lane-instances across the panels sit AT OR BELOW chance (c <= 0.5).`);
      console.log(`  N_eff = N/(1+(N-1)rho) is only meaningful as an input to P(majority correct | N_eff, c),`);
      console.log(`  and that quantity assumes c > 0.5. Below it the theorem RUNS BACKWARDS: the majority is`);
      console.log(`  worse than the best single lane and MORE lanes make it worse. Reporting a number here`);
      console.log(`  would be the vacuity class -- an instrument reading taken while the instrument is off.`);
      if (pooled < 0) {
        console.log(`\n  On the NEGATIVE rho-hat specifically: do not read it as decorrelation.`);
        console.log(`  Negative pairwise ERROR correlation between near-constant responders with OPPOSITE`);
        console.log(`  modal answers is what opposing response bias looks like, not complementary judgment.`);
        console.log(`  Two lanes that mostly say "killed" and mostly say "survived" disagree by construction.`);
      }
    } else {
      console.log(`  N_eff at N=${models.length} = ${effectiveN(models.length, pooled).toFixed(3)} independent voters (of ${models.length} lanes)`);
      if (pooled > 0) {
        console.log(`  1/rho ceiling (N -> inf) = ${(1 / pooled).toFixed(3)} -- correlation CAPS N_eff; more lanes cannot pass this.`);
      } else {
        console.log(`  1/rho ceiling: NOT REPORTED -- rho-hat <= 0, for which 1/rho is not a ceiling on anything.`);
      }
      console.log(`  boundary: rhoStarAlgebraic(${models.length}) = ${rhoStarAlgebraic(models.length).toFixed(4)} -- ` +
        `${pooled > rhoStarAlgebraic(models.length) ? "rho-hat EXCEEDS it: the majority does NOT beat the best single lane" : "rho-hat is below it"}`);
    }
  }
  return 0;
}

if (import.meta.main) process.exit(main());
