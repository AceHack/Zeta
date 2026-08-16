#!/usr/bin/env bun
/**
 * validate.ts — the estimator's own falsifier, plus re-verification of the two defects PR #10928
 * flagged against `CondorcetBoundary`.
 *
 * Nothing here trusts a citation. Every claim is re-derived by running it:
 *
 *   A. bvnUpper agrees with closed forms at rho = 0 and rho = +/-1, and is monotone in rho.
 *   B. tetrachoric RECOVERS rho from draws of the theorem's own generative model
 *      (SocietyUsefulWork.fs:69-73) across the full (rho, c) grid.
 *   C. phi ATTENUATES on skewed marginals — measured, not asserted — which is the whole reason the
 *      design forbids it. If B and C both hold, "use tetrachoric" is metered, not a preference.
 *   D. findRhoStar bisects a NON-monotone predicate and under-reports. Re-verified independently
 *      of the sibling agent's claim, by reimplementing the cited F# and exhibiting a witness.
 */

import { bvnUpper, normalCdf, phi, probit, tableOf, tetrachoric } from "./tetrachoric";

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

function normalSampler(rnd: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0, s = 0;
    do {
      u = 2 * rnd() - 1; v = 2 * rnd() - 1; s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}

let failures = 0;
function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name} — ${detail}`);
  if (!ok) failures++;
}

// ── A. bvnUpper sanity ───────────────────────────────────────────────────────────────────────────
console.log("\nA. bivariate-normal orthant quadrature");
{
  const h = 0.3, k = -0.7;
  const indep = (1 - normalCdf(h)) * (1 - normalCdf(k));
  check("rho=0 factorises", Math.abs(bvnUpper(h, k, 0) - indep) < 1e-9, `${bvnUpper(h, k, 0).toFixed(10)} vs ${indep.toFixed(10)}`);
  const comon = 1 - normalCdf(Math.max(h, k));
  check("rho=1 is min-marginal", Math.abs(bvnUpper(h, k, 0.999999) - comon) < 1e-4, `${bvnUpper(h, k, 0.999999).toFixed(6)} vs ${comon.toFixed(6)}`);
  const anti = Math.max(0, 1 - normalCdf(h) - normalCdf(k));
  check("rho=-1 is Frechet lower", Math.abs(bvnUpper(h, k, -0.999999) - anti) < 1e-4, `${bvnUpper(h, k, -0.999999).toFixed(6)} vs ${anti.toFixed(6)}`);
  let mono = true;
  let prev = -1;
  for (let r = -0.99; r <= 0.99; r += 0.01) {
    const v = bvnUpper(h, k, r);
    if (v < prev - 1e-12) mono = false;
    prev = v;
  }
  check("monotone increasing in rho", mono, "bisection in tetrachoric() is therefore exact ML, not a heuristic");
}

// ── B/C. recovery on the theorem's own generative model ──────────────────────────────────────────
// V_ij = sqrt(rho)*X_j + sqrt(1-rho)*eps_ij ; agent i ERRS iff V_ij > probit(c_i)
// (SocietyUsefulWork.fs uses "discovers iff V < probit(c)"; the error indicator is the complement,
//  which is the same one-factor copula with the threshold reflected. rho is unchanged.)
// The check is on BIAS across replicates, not on one sample's absolute error. A single draw's error
// is dominated by sampling noise (largest at extreme c, where one cell is nearly empty), so a flat
// absolute-error tolerance would confuse "noisy" with "wrong". Bias is the property that decides
// whether the estimator can be trusted to answer the question.
console.log("\nB/C. recovery on SocietyUsefulWork.fs:69-73's generative model (R=40 replicates x n=1000)");
{
  const N = 1000, R = 40;
  const rows: string[] = [];
  let worstBias = 0;
  let phiAlwaysUnder = true;
  let maxAttenuation = 0;
  let minAttenuation = 1;
  for (const rho of [0.0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9]) {
    for (const c of [0.5, 0.65, 0.8, 0.92]) {
      const tets: number[] = [], phis: number[] = [];
      for (let rep = 0; rep < R; rep++) {
        const rnd = splitmix64(BigInt(Math.round(rho * 1000) * 7919 + Math.round(c * 1000) * 104729 + rep * 15485863));
        const nrm = normalSampler(rnd);
        const thr = probit(c);
        const ei: number[] = [], ej: number[] = [];
        const sr = Math.sqrt(rho), sq = Math.sqrt(1 - rho);
        for (let t = 0; t < N; t++) {
          const x = nrm();
          ei.push(sr * x + sq * nrm() > thr ? 1 : 0);
          ej.push(sr * x + sq * nrm() > thr ? 1 : 0);
        }
        const tbl = tableOf(ei, ej);
        const tr = tetrachoric(tbl);
        if (tr.defined) tets.push(tr.rho);
        const p = phi(tbl);
        if (!Number.isNaN(p)) phis.push(p);
      }
      const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const sd = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1));
      const mt = mean(tets), mp = mean(phis);
      const bias = Math.abs(mt - rho);
      worstBias = Math.max(worstBias, bias);
      if (rho > 0.02) {
        if (mp > mt + 1e-9) phiAlwaysUnder = false;
        const att = (rho - mp) / rho;
        maxAttenuation = Math.max(maxAttenuation, att);
        minAttenuation = Math.min(minAttenuation, att);
      }
      rows.push(
        `   rho=${rho.toFixed(2)} c=${c.toFixed(2)} | tetrachoric mean ${mt.toFixed(4)} (bias ${(mt - rho >= 0 ? "+" : "")}${(mt - rho).toFixed(4)}, sd ${sd(tets).toFixed(4)})  phi mean ${mp.toFixed(4)}  attenuation ${(rho > 0 ? ((rho - mp) / rho) * 100 : 0).toFixed(1)}%`,
      );
    }
  }
  for (const r of rows) console.log(r);
  check("tetrachoric is unbiased for rho", worstBias < 0.02, `worst |bias| ${worstBias.toFixed(4)} over the (rho,c) grid`);
  check("phi never exceeds tetrachoric", phiAlwaysUnder, "phi is a lower bound on this model, at every grid point");
  check(
    "phi attenuation is material AND c-dependent",
    minAttenuation > 0.15 && maxAttenuation > 0.5,
    `under-reports true rho by ${(minAttenuation * 100).toFixed(0)}%-${(maxAttenuation * 100).toFixed(0)}%; the size depends on c, so phi is not even a fixed rescaling`,
  );
}

// ── D. the findRhoStar defect, re-verified from scratch ──────────────────────────────────────────
// Reimplementation of src/Bayesian/CondorcetBoundary.fs (majorityProbability / effectiveN /
// correlatedSocietyBeatsBest / findRhoStar / rhoStarAlgebraic). Repo code is read, not run.
console.log("\nD. CondorcetBoundary.findRhoStar — re-verifying the flagged defect independently");
{
  const binom = (n: number, k: number): number => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  };
  const majorityProbability = (n: number, c: number): number => {
    let acc = 0;
    for (let k = Math.floor(n / 2) + 1; k <= n; k++) acc += binom(n, k) * c ** k * (1 - c) ** (n - k);
    return acc;
  };
  const effectiveN = (n: number, rho: number): number => n / (1 + (n - 1) * Math.max(0, Math.min(1, rho)));
  const correlatedMajorityProbability = (n: number, c: number, rho: number): number =>
    majorityProbability(Math.max(1, Math.floor(effectiveN(n, rho))), c);
  const beats = (n: number, c: number, rho: number): boolean => correlatedMajorityProbability(n, c, rho) > c;
  const societyBeatsBest = (n: number, c: number): boolean => majorityProbability(n, c) > c;
  const findRhoStar = (n: number, c: number): number => {
    if (!societyBeatsBest(n, c)) return 0;
    let lo = 0, hi = 1;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (beats(n, c, mid)) lo = mid; else hi = mid;
    }
    return lo;
  };
  const rhoStarAlgebraic = (n: number): number => (n <= 3 ? 0 : (n - 3) / (3 * (n - 1)));

  // D1 — the predicate is non-monotone in rho: a witness where it is FALSE then TRUE again.
  let nonMonotoneWitness = "";
  for (const [n, c] of [[8, 0.65], [16, 0.6], [12, 0.7], [16, 0.75]] as [number, number][]) {
    let sawFalse = false, flipped = false;
    for (let rho = 0; rho <= 1.0001; rho += 0.001) {
      const b = beats(n, c, rho);
      if (!b) sawFalse = true;
      else if (sawFalse) { flipped = true; nonMonotoneWitness = `N=${n} c=${c}: predicate FALSE then TRUE again at rho=${rho.toFixed(3)}`; break; }
    }
    if (flipped) break;
  }
  check("beat-predicate is non-monotone in rho", nonMonotoneWitness !== "", nonMonotoneWitness || "no witness found — the defect claim would be REFUTED");

  // D2 — the under-report: findRhoStar returns a value, yet a strictly larger rho still beats.
  const n = 8, c = 0.65;
  const fr = findRhoStar(n, c);
  let maxBeating = 0;
  for (let rho = 0; rho <= 1.0001; rho += 0.0005) if (beats(n, c, rho)) maxBeating = rho;
  check(
    "findRhoStar under-reports the true supremum",
    maxBeating > fr + 1e-6,
    `N=${n} c=${c}: findRhoStar=${fr.toFixed(4)}, but rho=${maxBeating.toFixed(4)} still beats (factor ${(maxBeating / Math.max(fr, 1e-9)).toFixed(2)}x); rho=0.20 beats? ${String(beats(n, c, 0.2))}`,
  );

  // D3 — the docstring's c-dependent N=16 table vs the shipped function.
  const tbl16 = [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((cc) => findRhoStar(16, cc));
  const allSame = tbl16.every((v) => Math.abs(v - tbl16[0]!) < 1e-9);
  check(
    "findRhoStar 16 c is c-INDEPENDENT (docstring at :41-44 claims otherwise)",
    allSame,
    `all c give ${tbl16[0]!.toFixed(4)}; the docstring claims 0.33 / 0.14 / 0.06 at c = 0.6 / 0.7 / 0.8`,
  );

  console.log(`   rhoStarAlgebraic: N=3 -> ${rhoStarAlgebraic(3).toFixed(4)}   N=6 -> ${rhoStarAlgebraic(6).toFixed(4)}   N=8 -> ${rhoStarAlgebraic(8).toFixed(4)}   N=21 -> ${rhoStarAlgebraic(21).toFixed(4)}   N->inf -> 0.3333`);
  console.log("   => comparisons in this experiment use rhoStarAlgebraic, never findRhoStar.");
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
