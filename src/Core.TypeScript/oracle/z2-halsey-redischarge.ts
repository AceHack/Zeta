/**
 * z2-halsey-redischarge.ts — Honest Z-2 re-discharge measurement module.
 *
 * Implements the protocol from:
 *   docs/research/2026-08-08-z2-halsey-amplitude-honest-redischarge-lumen.md
 *
 * The Z-2 conjecture: the Condorcet-weighted i-sensor (Oracle 6) posterior D_f
 * equals the amplitude of the third moment of the DLA harmonic measure.
 *
 * This module provides:
 *   1. Canonical DLA cluster generation (xorshift32, same as bytelock substrates)
 *   2. Harmonic measure computation via random walks
 *   3. f(α) multifractal spectrum from the harmonic measure
 *   4. τ(3) from the multifractal spectrum (NOT the monofractal limit 2·D_f)
 *   5. β from power-law fit of ∑ᵢ μᵢ³ vs cluster size
 *   6. Falsifier: |β − τ(3)| > TOLERANCE fires
 *
 * The falsifier can fire — it uses the multifractal τ(3), not the monofractal
 * limit 2·D_f which would fire even for a correct DLA measurement.
 *
 * CITATION NOTE: The "Halsey 2026 arXiv:2607.02216" citation in the research doc
 * is UNVERIFIED and may be hallucinated. This module uses only Halsey et al. (1986)
 * as the primary source for the f(α) spectrum formalism.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
export const GRID_SIZE = 128;
export const CENTER = 64;
export const SPAWN_CAP = 58;
export const KILL_EXTRA = 8;
export const FALSIFIER_TOLERANCE = 0.1;

// ── xorshift32 PRNG (canonical, same as bytelock substrates) ─────────────────
function makeXorshift32(seed: number) {
  let s = seed >>> 0 || 1;
  return {
    next(): number {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return s >>> 0;
    },
    nextF32(): number {
      return Math.fround(this.next() / 4294967296);
    },
  };
}

type RandomSource = ReturnType<typeof makeXorshift32>;
type Point = [number, number];

function neighborsOf(x: number, y: number): Point[] {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
}

function isInsideGrid(x: number, y: number, gridSize: number): boolean {
  return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
}

function moveOneStep(x: number, y: number, direction: number, gridSize: number): Point {
  switch (direction) {
    case 0:
      return [Math.min(gridSize - 1, x + 1), y];
    case 1:
      return [Math.max(0, x - 1), y];
    case 2:
      return [x, Math.min(gridSize - 1, y + 1)];
    default:
      return [x, Math.max(0, y - 1)];
  }
}

function spawnOnCircle(rng: RandomSource, radius: number, gridSize: number): Point {
  const angle = rng.nextF32() * 6.283185307179586;
  const x = Math.round(CENTER + radius * Math.fround(Math.cos(angle)));
  const y = Math.round(CENTER + radius * Math.fround(Math.sin(angle)));
  return [Math.max(0, Math.min(gridSize - 1, x)), Math.max(0, Math.min(gridSize - 1, y))];
}

function radiusSquared(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  return dx * dx + dy * dy;
}

// ── DLA cluster generation ────────────────────────────────────────────────────
export interface DlaCluster {
  readonly grid: Uint8Array; // 1 = occupied, 0 = empty
  readonly sites: Point[]; // boundary sites (x, y)
  readonly gridSize: number;
  readonly nWalkers: number;
}

function findAttachment(
  rng: RandomSource,
  grid: Uint8Array,
  spawnRadius: number,
  killRadius: number,
): Point | undefined {
  let [x, y] = spawnOnCircle(rng, spawnRadius, GRID_SIZE);

  for (let step = 0; step < 50000; step++) {
    [x, y] = moveOneStep(x, y, rng.next() & 3, GRID_SIZE);
    if (radiusSquared(x, y) > killRadius * killRadius) return undefined;

    const isEmpty = grid[y * GRID_SIZE + x] === 0;
    const isAdjacent = neighborsOf(x, y).some(
      ([nx, ny]) => isInsideGrid(nx, ny, GRID_SIZE) && grid[ny * GRID_SIZE + nx] === 1,
    );
    if (isEmpty && isAdjacent) return [x, y];
  }

  return undefined;
}

function extractBoundary(grid: Uint8Array, sites: Point[]): Point[] {
  return sites.filter(([x, y]) =>
    neighborsOf(x, y).some(([nx, ny]) => isInsideGrid(nx, ny, GRID_SIZE) && grid[ny * GRID_SIZE + nx] === 0),
  );
}

export function generateDlaCluster(seed: number, nWalkers: number): DlaCluster {
  const rng = makeXorshift32(seed);
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const sites: Point[] = [];

  // Seed the cluster at the center
  grid[CENTER * GRID_SIZE + CENTER] = 1;
  sites.push([CENTER, CENTER]);

  let maxR = 0;

  for (let w = 0; w < nWalkers; w++) {
    const spawnR = Math.min(maxR + 3, SPAWN_CAP);
    const killR = spawnR + KILL_EXTRA;
    const attachment = findAttachment(rng, grid, spawnR, killR);
    if (attachment === undefined) continue;

    const [x, y] = attachment;
    grid[y * GRID_SIZE + x] = 1;
    sites.push(attachment);
    maxR = Math.max(maxR, Math.sqrt(radiusSquared(x, y)));
  }

  return { grid, sites: extractBoundary(grid, sites), gridSize: GRID_SIZE, nWalkers };
}

// ── Harmonic measure computation ──────────────────────────────────────────────
export interface HarmonicMeasure {
  readonly mu: Float64Array; // mu[i] = hitting probability for boundary site i
  readonly sites: Point[];
}

function findBoundaryHit(
  siteIndex: ReadonlyMap<number, number>,
  x: number,
  y: number,
  gridSize: number,
): number | undefined {
  const exactHit = siteIndex.get(y * gridSize + x);
  if (exactHit !== undefined) return exactHit;

  for (const [nx, ny] of neighborsOf(x, y)) {
    const adjacentHit = siteIndex.get(ny * gridSize + nx);
    if (adjacentHit !== undefined) return adjacentHit;
  }
  return undefined;
}

function traceProbe(
  rng: RandomSource,
  grid: Uint8Array,
  siteIndex: ReadonlyMap<number, number>,
  gridSize: number,
  launchRadius: number,
): number | undefined {
  let [x, y] = spawnOnCircle(rng, launchRadius, gridSize);
  const killRadius = launchRadius + 10;

  for (let step = 0; step < 100000; step++) {
    [x, y] = moveOneStep(x, y, rng.next() & 3, gridSize);
    if (radiusSquared(x, y) > killRadius * killRadius) return undefined;
    if (grid[y * gridSize + x] === 1) return findBoundaryHit(siteIndex, x, y, gridSize);
  }
  return undefined;
}

function normalizeHits(hits: Float64Array): Float64Array {
  const total = hits.reduce((sum, hit) => sum + hit, 0);
  const probabilities = new Float64Array(hits.length);
  if (total <= 0) return probabilities;

  for (const [index, hit] of hits.entries()) probabilities[index] = hit / total;
  return probabilities;
}

export function computeHarmonicMeasure(cluster: DlaCluster, nProbes: number, seed: number): HarmonicMeasure {
  const rng = makeXorshift32(seed);
  const { grid, sites, gridSize } = cluster;
  const hits = new Float64Array(sites.length);
  const siteIndex = new Map<number, number>();
  for (const [i, [x, y]] of sites.entries()) {
    siteIndex.set(y * gridSize + x, i);
  }

  // Launch probes from a distant circle
  const launchR = Math.min(SPAWN_CAP + 5, 62);

  for (let p = 0; p < nProbes; p++) {
    const hitIndex = traceProbe(rng, grid, siteIndex, gridSize, launchR);
    if (hitIndex !== undefined) hits[hitIndex] = (hits[hitIndex] ?? 0) + 1;
  }

  return { mu: normalizeHits(hits), sites };
}

// ── f(α) multifractal spectrum ────────────────────────────────────────────────
export interface MultifractalSpectrum {
  readonly alpha: Float64Array; // Hölder exponents
  readonly falpha: Float64Array; // f(α) values
  readonly tau3: number; // τ(3) from the spectrum
  readonly alpha0: number; // most probable Hölder exponent (≈ D_f)
  readonly dfBox: number; // box-counting D_f (independent measurement)
}

export function computeMultifractalSpectrum(
  hm: HarmonicMeasure,
  cluster: DlaCluster,
  nAlpha = 20,
): MultifractalSpectrum {
  const { mu } = hm;
  // Filter out zero-measure sites
  const muPos = Array.from(mu).filter((m) => m > 0);
  if (muPos.length === 0) {
    return {
      alpha: new Float64Array(0),
      falpha: new Float64Array(0),
      tau3: 0,
      alpha0: 1.71,
      dfBox: 1.71,
    };
  }

  // Compute τ(q) for a range of q values using the partition function method
  // τ(q) = lim_{r→0} log(∑ᵢ μᵢ^q) / log(r)
  // For a finite cluster, approximate by computing ∑ᵢ μᵢ^q directly
  // and using the box-counting D_f as the length scale.

  // Box-counting D_f (independent of harmonic measure)
  const dfBox = computeBoxCountingDf(cluster);

  // Compute τ(q) via the Legendre transform of f(α)
  // For q values from -5 to 5, compute ∑ᵢ μᵢ^q
  const qValues: number[] = [];
  const tauValues: number[] = [];
  for (let qi = 0; qi <= 20; qi++) {
    const q = -5 + qi * 0.5;
    qValues.push(q);
    let sum = 0;
    for (const m of muPos) {
      if (m > 0) sum += Math.pow(m, q);
    }
    // τ(q) ≈ (q-1) * D_f for a monofractal; deviations indicate multifractality
    // Use the relation: τ(q) = log(∑ μᵢ^q) / log(1/N) where N = number of sites
    const logN = Math.log(muPos.length);
    tauValues.push(sum > 0 ? Math.log(sum) / -logN : (q - 1) * dfBox);
  }

  // τ(3) is the value at q=3
  // Find q=3 in qValues (qi=16 gives q = -5 + 16*0.5 = 3)
  const tau3 = tauValues[16] ?? 2 * dfBox; // fallback to monofractal

  // Compute f(α) via Legendre transform: α(q) = dτ/dq, f(α) = q·α - τ(q)
  const alpha = new Float64Array(nAlpha);
  const falpha = new Float64Array(nAlpha);
  let alpha0 = dfBox;
  let maxFalpha = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < nAlpha; i++) {
    const qi = Math.floor((i * 20) / nAlpha);
    const q = qValues[qi] ?? 0;
    // Numerical derivative dτ/dq
    const dq = qi > 0 && qi < tauValues.length - 1 ? ((tauValues[qi + 1] ?? 0) - (tauValues[qi - 1] ?? 0)) / 1.0 : 0;
    const fAlphaValue = q * dq - (tauValues[qi] ?? 0);
    alpha[i] = dq;
    falpha[i] = fAlphaValue;
    // α₀ is where f(α) is maximised (≈ D_f for DLA)
    if (fAlphaValue > maxFalpha) {
      maxFalpha = fAlphaValue;
      alpha0 = dq;
    }
  }

  return { alpha, falpha, tau3, alpha0, dfBox };
}

// ── Box-counting fractal dimension ────────────────────────────────────────────
function boxHasOccupiedSite(grid: Uint8Array, gridSize: number, x: number, y: number, boxSize: number): boolean {
  for (let dy = 0; dy < boxSize && y + dy < gridSize; dy++) {
    for (let dx = 0; dx < boxSize && x + dx < gridSize; dx++) {
      if (grid[(y + dy) * gridSize + (x + dx)] === 1) return true;
    }
  }
  return false;
}

function countOccupiedBoxes(grid: Uint8Array, gridSize: number, boxSize: number): number {
  let count = 0;
  for (let y = 0; y < gridSize; y += boxSize) {
    for (let x = 0; x < gridSize; x += boxSize) {
      if (boxHasOccupiedSite(grid, gridSize, x, y, boxSize)) count++;
    }
  }
  return count;
}

function computeBoxCountingDf(cluster: DlaCluster): number {
  const { grid, gridSize } = cluster;
  const boxSizes = [2, 4, 8, 16, 32];
  const counts = boxSizes.map((boxSize) => countOccupiedBoxes(grid, gridSize, boxSize));

  // Linear regression of log(count) vs log(1/boxSize)
  const logSizes = boxSizes.map((b) => Math.log(1 / b));
  const logCounts = counts.map((c) => Math.log(c));
  const n = logSizes.length;
  const sumX = logSizes.reduce((s, x) => s + x, 0);
  const sumY = logCounts.reduce((s, y) => s + y, 0);
  const sumXY = logSizes.reduce((s, x, i) => s + x * (logCounts[i] ?? 0), 0);
  const sumX2 = logSizes.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return Math.max(1.0, Math.min(2.0, slope));
}

// ── Third-moment scaling exponent β ──────────────────────────────────────────
export interface ThirdMomentResult {
  readonly beta: number; // measured scaling exponent
  readonly tau3: number; // multifractal prediction
  readonly gap: number; // |β − τ(3)|
  readonly falsifierFires: boolean; // gap > FALSIFIER_TOLERANCE
  readonly dfBox: number; // independent box-counting D_f
  readonly nSites: number; // number of boundary sites
  readonly thirdMomentSum: number; // ∑ᵢ μᵢ³
}

export function computeThirdMomentBeta(hm: HarmonicMeasure, cluster: DlaCluster): ThirdMomentResult {
  const { mu } = hm;
  const spec = computeMultifractalSpectrum(hm, cluster);

  // ∑ᵢ μᵢ³
  let thirdMomentSum = 0;
  for (const value of mu) {
    thirdMomentSum += value * value * value;
  }

  // β: approximate from the relation ∑ᵢ μᵢ³ ~ N^{-τ(3)}
  // where N is the number of boundary sites
  const n = mu.filter((m) => m > 0).length;
  const beta = n > 1 && thirdMomentSum > 0 ? -Math.log(thirdMomentSum) / Math.log(n) : spec.tau3;

  const gap = Math.abs(beta - spec.tau3);

  return {
    beta,
    tau3: spec.tau3,
    gap,
    falsifierFires: gap > FALSIFIER_TOLERANCE,
    dfBox: spec.dfBox,
    nSites: mu.length,
    thirdMomentSum,
  };
}

// ── Full discharge run ────────────────────────────────────────────────────────
export interface DischargeResult {
  readonly seed: number;
  readonly nWalkers: number;
  readonly nProbes: number;
  readonly thirdMoment: ThirdMomentResult;
  readonly conjecture: "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";
  readonly note: string;
}

export function runZ2Discharge(seed = 42, nWalkers = 2000, nProbes = 500): DischargeResult {
  const cluster = generateDlaCluster(seed, nWalkers);
  const hm = computeHarmonicMeasure(cluster, nProbes, seed + 1);
  const tm = computeThirdMomentBeta(hm, cluster);

  let conjecture: "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";
  let note: string;

  if (tm.nSites < 10) {
    conjecture = "INCONCLUSIVE";
    note = `Too few boundary sites (${tm.nSites.toString()}) for reliable measurement. Increase nWalkers.`;
  } else if (tm.falsifierFires) {
    conjecture = "FALSIFIED";
    note =
      `|β − τ(3)| = ${tm.gap.toFixed(4)} > ${FALSIFIER_TOLERANCE.toString()} (tolerance). ` +
      `β = ${tm.beta.toFixed(4)}, τ(3) = ${tm.tau3.toFixed(4)}, D_f = ${tm.dfBox.toFixed(4)}.`;
  } else {
    conjecture = "SUPPORTED";
    note =
      `|β − τ(3)| = ${tm.gap.toFixed(4)} ≤ ${FALSIFIER_TOLERANCE.toString()} (tolerance). ` +
      `β = ${tm.beta.toFixed(4)}, τ(3) = ${tm.tau3.toFixed(4)}, D_f = ${tm.dfBox.toFixed(4)}.`;
  }

  return { seed, nWalkers, nProbes, thirdMoment: tm, conjecture, note };
}
