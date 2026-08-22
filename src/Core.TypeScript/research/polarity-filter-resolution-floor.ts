#!/usr/bin/env bun
// polarity-filter-resolution-floor.ts — the numeric half of the F1 (resolution) pricing.
//
// Companion to docs/research/2026-08-15-polarity-filter-has-no-resolution-limit-the-square-root-sigma-floor-and-what-f1-costs.md
// and to the F2 smoothness falsifier built in PR #10847 (cite the PR: its test file is not on main yet).
//
// WHAT THIS MEASURES
// ------------------
// src/Core/PolarityFilter.fs finds a signal's orientation by sweeping `n` filter angles over
// [0, pi) and taking the argmax of Malus's law cos^2(filterAngle - signalAngle). The module has
// no notion of resolution: `n` is a sampling step, not a lower bound on distinguishability.
//
// This probe adds a measurement-noise term sigma to each throughput reading -- the channel the
// real module does NOT have -- and measures the RMS orientation error as a function of (sigma, n).
//
//   sigma = 0  ==> the error keeps shrinking with n WITHOUT BOUND (infinite resolution: the defect)
//   sigma > 0  ==> a floor appears that n cannot beat, and it scales as sqrt(sigma), not sigma
//
// The sqrt is because the sweep localises a MAXIMUM, where the first derivative vanishes
// (transmit ~ 1 - Delta^2), so the position information is curvature-limited. First-order
// discrimination away from the peak would floor at ~sigma/L with L = 1; peak localisation is
// strictly worse.
//
// DETERMINISM: a fixed 64-bit LCG, seeded explicitly, no ambient entropy (DST, manifesto section 7).
// Same seed => same table, every run, on every machine with IEEE-754 doubles.
//
// Usage:
//   bun src/Core.TypeScript/research/polarity-filter-resolution-floor.ts            # print the table
//   bun src/Core.TypeScript/research/polarity-filter-resolution-floor.ts --check    # assert the scaling
//   bun src/Core.TypeScript/research/polarity-filter-resolution-floor.ts --seed 7   # a different draw

const PI = Math.PI;

/** Malus's law -- a transliteration of `PolarityFilter.transmit` (src/Core/PolarityFilter.fs). */
export function transmit(filterAngle: number, signalAngle: number): number {
  const c = Math.cos(filterAngle - signalAngle);
  return c * c;
}

/** Deterministic 64-bit LCG (Knuth MMIX constants). No ambient entropy. */
export function makeRng(seed: bigint): () => number {
  let s = seed & ((1n << 64n) - 1n);
  return () => {
    s = (s * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number(s >> 11n) / 2 ** 53;
  };
}

/** Box-Muller from the LCG -- one standard normal per call (the second deviate is discarded). */
export function makeGauss(rnd: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * PI * rnd());
}

/**
 * `PolarityFilter.findOrientation` with a measurement-noise channel added: each swept throughput
 * reading is perturbed by `sigma * N(0,1)` before the argmax. Returns the recovered angle only.
 */
export function findOrientationNoisy(
  n: number,
  signalAngle: number,
  sigma: number,
  gauss: () => number,
): number {
  let best = 0;
  let bestT = -1;
  for (let i = 0; i < n; i++) {
    const a = (PI * i) / Math.max(1, n);
    const t = transmit(a, signalAngle) + sigma * gauss();
    if (t > bestT) {
      bestT = t;
      best = a;
    }
  }
  return best;
}

/** Polarization is headless (mod pi): fold an angle difference into [0, pi/2]. */
export function foldHeadless(delta: number): number {
  const x = ((delta % PI) + PI) % PI;
  return x > PI / 2 ? PI - x : x;
}

/** RMS recovered-orientation error over `trials` uniformly drawn signal orientations. */
export function rmsError(
  n: number,
  sigma: number,
  trials: number,
  rnd: () => number,
  gauss: () => number,
): number {
  let se = 0;
  for (let t = 0; t < trials; t++) {
    const s = rnd() * PI;
    se += foldHeadless(findOrientationNoisy(n, s, sigma, gauss) - s) ** 2;
  }
  return Math.sqrt(se / trials);
}

// ── The published table ───────────────────────────────────────────────────────

const SIGMAS = [0, 1e-6, 1e-4, 1e-2, 1e-1];
const SWEEPS = [64, 1024, 16384];
const TRIALS = 400;
const DEFAULT_SEED = 42n;

function main(argv: string[]): number {
  const seedArg = argv.indexOf("--seed");
  const seed = seedArg >= 0 ? BigInt(argv[seedArg + 1] ?? "42") : DEFAULT_SEED;
  const check = argv.includes("--check");

  const rnd = makeRng(seed);
  const gauss = makeGauss(rnd);

  const rows: { sigma: number; errs: number[] }[] = [];
  for (const sigma of SIGMAS) {
    rows.push({ sigma, errs: SWEEPS.map((n) => rmsError(n, sigma, TRIALS, rnd, gauss)) });
  }

  console.log(
    `PolarityFilter.findOrientation -- RMS orientation error (radians), ${TRIALS} trials, seed ${seed}`,
  );
  console.log(`sigma\t${SWEEPS.map((n) => `n=${n}`).join("\t")}\tfloor/sqrt(sigma)`);
  for (const { sigma, errs } of rows) {
    const floor = errs[errs.length - 1]!;
    const ratio = sigma === 0 ? "--" : (floor / Math.sqrt(sigma)).toFixed(2);
    console.log(`${sigma}\t${errs.map((e) => e.toExponential(2)).join("\t")}\t${ratio}`);
  }

  if (!check) return 0;

  // The two assertions the table is making.
  let failures = 0;

  // (1) sigma = 0: no floor. Refining the sweep keeps buying resolution, without bound.
  const noiseless = rows[0]!.errs;
  if (!(noiseless[2]! < noiseless[0]! / 100)) {
    console.error(
      `FAIL: at sigma=0 the error did not keep shrinking with n (${noiseless.join(", ")})`,
    );
    failures++;
  }

  // (2) sigma > 0: a floor exists and scales as sqrt(sigma) with a stable prefactor.
  const ratios = rows
    .filter((r) => r.sigma > 0)
    .map((r) => r.errs[r.errs.length - 1]! / Math.sqrt(r.sigma));
  const lo = Math.min(...ratios);
  const hi = Math.max(...ratios);
  if (!(lo > 0.25 && hi < 0.7)) {
    console.error(
      `FAIL: floor/sqrt(sigma) not stable in [0.25, 0.7] across three decades (${ratios
        .map((r) => r.toFixed(2))
        .join(", ")})`,
    );
    failures++;
  }

  if (failures > 0) return 1;
  console.log(
    `\nPASS: no floor at sigma=0 (the defect); floor ~ ${((lo + hi) / 2).toFixed(2)}*sqrt(sigma) for sigma > 0`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
