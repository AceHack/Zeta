#!/usr/bin/env bun
/**
 * src/Core.TypeScript/oracle/dla-meter.ts
 *
 * DLA meter: runs one DLA computation and emits an OracleReading JSON file
 * to docs/oracle-readings/<agent>/<YYYY>/<MM>/<DD>/<zetaid>.json
 *
 * Called by the agent-heartbeat workflow after each heartbeat tick.
 * The heartbeat ZetaId is passed as --heartbeat-id so the reading is
 * traceable back to the specific heartbeat that triggered it.
 *
 * The seed is derived from Date.now() + ORACLE_PRIME_OFFSETS[oracleIndex].
 * This enforces L > 0 (the prime offset is the minimum decorrelation window).
 * Same prime offsets as the browser visualizer and DebouncedOracle.fs.
 *
 * Transport: Git (branch push via the REST git-data API, same as write-heartbeat.ts).
 * L ≈ 120s (GitHub Actions round-trip). ρ ≈ 0.008. Condorcet bonus ≈ 0.992.
 * This is the Classical/Independent regime — the real sensor-fusion proof.
 *
 * Usage:
 *   bun src/Core.TypeScript/oracle/dla-meter.ts \
 *     --agent alexa \
 *     --oracle-index 0 \
 *     --heartbeat-id <hex> \
 *     [--dry-run]
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { readdirSync, readFileSync, existsSync } from "fs";

// ── CommitPairCorrelator (TypeScript port) ────────────────────────────────────
// The honest register-3 probe for oracle-reading pairs.
// Uses MI excess over a Reichenbach-stratified permutation null.
// CHSH is NOT used here — see the soundness note in CommitPairCorrelator.fs:
// settings are artifact properties (not independent random choices),
// outcomes are editorial summaries (not physical measurements), and
// no-signaling fails by construction (readings can share a seed lineage).
//
// TypeScript inline implementation (mirrors CommitPairCorrelator.fs logic):
// - "commits" = prior oracle readings for this agent
// - "observable" = quantized fractalDim bucket (0.1-wide bins)
// - "spacelike pairs" = readings from different oracle indices (different prime offsets)
// - "excess" = MI(bucketA, bucketB) > permutation null threshold

const COMMIT_PAIR_SOUNDNESS_NOTE =
  "CHSH is ill-posed for oracle-reading pairs: settings are artifact properties " +
  "(not independent random choices), outcomes are fractalDim summaries (not physical " +
  "measurements), and no-signaling fails by construction (readings share a seed lineage). " +
  "The honest instrument is MI excess over a Reichenbach-stratified permutation null. " +
  "See src/Core/CommitPairCorrelator.fs and docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md.";

/** Quantize fractalDim to 0.1-wide bins (e.g. 1.3 → 13, 1.32 → 13). */
function dfBucket(df: number): number {
  return Math.floor(df * 10);
}

/** Seeded splitmix64 step — deterministic permutation null (mirrors DecorrelationExcess.fs). */
function splitmix64(s: bigint): [bigint, bigint] {
  let z = (s + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & 0xFFFFFFFFFFFFFFFFn;
  return [z ^ (z >> 31n), (s + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn];
}

/** Seeded Fisher-Yates shuffle of an array (in-place). */
function seededShuffle<T>(arr: T[], seed: bigint): void {
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    let r: bigint;
    [r, s] = splitmix64(s);
    const j = Number(r % BigInt(i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Mutual information of a pairing (list of [a, b] pairs). */
function pairingMI(pairs: [number, number][]): number {
  if (pairs.length === 0) return 0;
  const n = pairs.length;
  const jointCounts = new Map<string, number>();
  const aCounts = new Map<number, number>();
  const bCounts = new Map<number, number>();
  for (const [a, b] of pairs) {
    const key = `${a},${b}`;
    jointCounts.set(key, (jointCounts.get(key) ?? 0) + 1);
    aCounts.set(a, (aCounts.get(a) ?? 0) + 1);
    bCounts.set(b, (bCounts.get(b) ?? 0) + 1);
  }
  let mi = 0;
  for (const [key, count] of jointCounts) {
    const [aStr, bStr] = key.split(",");
    const a = parseInt(aStr!), b = parseInt(bStr!);
    const pAB = count / n;
    const pA = (aCounts.get(a) ?? 0) / n;
    const pB = (bCounts.get(b) ?? 0) / n;
    if (pA > 0 && pB > 0) mi += pAB * Math.log(pAB / (pA * pB));
  }
  return mi;
}

interface CommitPairProbeResult {
  meteredPairs: number;
  excessFraction: number | null;
  isExcess: boolean;
  soundnessNote: string;
}

/**
 * Run the commit-pair correlator over prior oracle readings for this agent.
 * "Spacelike pairs" = readings from different oracle indices (different prime offsets).
 * Observable = quantized fractalDim bucket.
 * Excess = MI > permutation null threshold at δ=0.05, k=100 shuffles.
 */
function runCommitPairProbe(
  priorReadings: Array<{ oracleIndex: number; fractalDim: number }>,
  seed: number
): CommitPairProbeResult {
  // Group by oracle index — each oracle is a "commit stream"
  const byOracle = new Map<number, number[]>();
  for (const r of priorReadings) {
    const bucket = dfBucket(r.fractalDim);
    const arr = byOracle.get(r.oracleIndex) ?? [];
    arr.push(bucket);
    byOracle.set(r.oracleIndex, arr);
  }
  const oracleIndices = [...byOracle.keys()].sort();
  if (oracleIndices.length < 2) {
    return { meteredPairs: 0, excessFraction: null, isExcess: false, soundnessNote: COMMIT_PAIR_SOUNDNESS_NOTE };
  }

  // Build spacelike pairs: all (i, j) pairs where i < j (different oracle indices)
  // Pair up the last min(|A|, |B|) readings from each oracle pair
  let totalPairs = 0;
  let excessPairs = 0;
  const DELTA = 0.05;
  const K_SHUFFLES = 100;

  for (let i = 0; i < oracleIndices.length; i++) {
    for (let j = i + 1; j < oracleIndices.length; j++) {
      const aObs = byOracle.get(oracleIndices[i]!)!;
      const bObs = byOracle.get(oracleIndices[j]!)!;
      const len = Math.min(aObs.length, bObs.length);
      if (len < 2) continue; // need at least 2 pairs for a meaningful null

      const pairs: [number, number][] = aObs.slice(-len).map((a, k) => [a, bObs[bObs.length - len + k]!]);
      const realMI = pairingMI(pairs);

      // Permutation null: shuffle bObs K times and compute MI each time
      const nullMIs: number[] = [];
      for (let k = 0; k < K_SHUFFLES; k++) {
        const shuffled = [...bObs.slice(-len)];
        seededShuffle(shuffled, BigInt(seed) + BigInt(i * 1000 + j * 100 + k));
        nullMIs.push(pairingMI(aObs.slice(-len).map((a, idx) => [a, shuffled[idx]!])));
      }
      nullMIs.sort((a, b) => a - b);
      const threshold = nullMIs[Math.floor((1 - DELTA) * K_SHUFFLES)]!;

      totalPairs++;
      if (realMI > threshold) excessPairs++;
    }
  }

  return {
    meteredPairs: totalPairs,
    excessFraction: totalPairs > 0 ? excessPairs / totalPairs : null,
    isExcess: excessPairs > 0,
    soundnessNote: COMMIT_PAIR_SOUNDNESS_NOTE,
  };
}

/** Load prior oracle readings for this agent from docs/oracle-readings/<agent>/. */
function loadPriorReadings(
  repoRoot: string,
  agent: string
): Array<{ oracleIndex: number; fractalDim: number }> {
  const baseDir = join(repoRoot, "docs", "oracle-readings", agent);
  if (!existsSync(baseDir)) return [];
  const results: Array<{ oracleIndex: number; fractalDim: number }> = [];
  try {
    // Walk yyyy/mm/dd/file.json
    for (const yyyy of readdirSync(baseDir)) {
      const yyyyDir = join(baseDir, yyyy);
      for (const mm of readdirSync(yyyyDir)) {
        const mmDir = join(yyyyDir, mm);
        for (const dd of readdirSync(mmDir)) {
          const ddDir = join(mmDir, dd);
          for (const file of readdirSync(ddDir)) {
            if (!file.endsWith(".json")) continue;
            try {
              const raw = JSON.parse(readFileSync(join(ddDir, file), "utf8"));
              if (typeof raw.oracleIndex === "number" && typeof raw.fractalDim === "number") {
                results.push({ oracleIndex: raw.oracleIndex, fractalDim: raw.fractalDim });
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    }
  } catch { /* directory walk error — return what we have */ }
  return results;
}

// ── DLA constants (mirrors IdentityDLA.fs and useDLA.ts) ─────────────────────

// ⚠ NAME IS A MISNOMER (Soraya audit, 2026-08-01). `TSIRELSON` is NOT the Tsirelson bound.
// Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator (see src/Core/Tsirelson.fs,
// src/Core/BellTest.fs). There is no Tsirelson bound on a correlation coefficient. 1/(3√2)
// is ρ*/√2 — the Condorcet limit ρ* = 1/3 pushed through the FREELY CHOSEN linear map
// ρ = S/12 — a design parameter chosen for homoiconicity, not derived. See
// docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md
// Here it is used purely as a DLA sticking probability / density cutoff. Do not read it as physics.
const TSIRELSON = 1 / (3 * Math.sqrt(2)); // ≈ 0.2357 — DLA sticking probability (design choice)
const ORACLE_PRIME_OFFSETS = [1009, 1013, 1019, 1021, 1031];
const GRID_W = 100;
const GRID_H = 100;
const N_WALKERS = 1200;

// ── Seeded PRNG (xorshift32, same as useDLA.ts) ───────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── DLA computation ───────────────────────────────────────────────────────────

interface DlaResult {
  cells: Uint8Array;
  clusterSize: number;
  df: number;
  elapsed: number;
  seed: number;
}

function fractalDim(cells: Uint8Array, W: number, H: number): number {
  const counts: number[] = [];
  const scales: number[] = [];
  for (let box = 2; box <= Math.min(W, H) / 2; box *= 2) {
    let count = 0;
    for (let y = 0; y < H; y += box) {
      for (let x = 0; x < W; x += box) {
        let has = false;
        for (let dy = 0; dy < box && !has; dy++) {
          for (let dx = 0; dx < box && !has; dx++) {
            if (cells[(y + dy) * W + (x + dx)]) has = true;
          }
        }
        if (has) count++;
      }
    }
    if (count > 0) { counts.push(Math.log(count)); scales.push(Math.log(1 / box)); }
  }
  if (counts.length < 2) return 1.5;
  const n = counts.length;
  const sx = scales.reduce((a, b) => a + b, 0);
  const sy = counts.reduce((a, b) => a + b, 0);
  const sxx = scales.reduce((a, b) => a + b * b, 0);
  const sxy = scales.reduce((a, v, i) => a + v * (counts[i] ?? 0), 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

function runDla(seed: number, W: number, H: number, nWalkers: number): DlaResult {
  const t0 = Date.now();
  const rng = makeRng(seed);
  const cells = new Uint8Array(W * H);
  const cx = W >> 1, cy = H >> 1;
  cells[cy * W + cx] = 1;
  let clusterSize = 1;
  let clusterRadius = 1;

  for (let i = 0; i < nWalkers; i++) {
    const spawnR = clusterRadius + 5;
    const angle = rng() * 2 * Math.PI;
    let wx = Math.round(cx + spawnR * Math.cos(angle));
    let wy = Math.round(cy + spawnR * Math.sin(angle));
    const killR = clusterRadius + 20;
    let steps = 0;
    const maxSteps = killR * killR * 4;

    while (steps++ < maxSteps) {
      const dx = Math.floor(rng() * 3) - 1;
      const dy = Math.floor(rng() * 3) - 1;
      if (dx === 0 && dy === 0) continue;
      wx += dx; wy += dy;
      if (wx < 0 || wx >= W || wy < 0 || wy >= H) break;
      const dist2 = (wx - cx) ** 2 + (wy - cy) ** 2;
      if (dist2 > killR * killR) break;

      // Check neighbours
      let stick = false;
      for (let ny = wy - 1; ny <= wy + 1 && !stick; ny++) {
        for (let nx = wx - 1; nx <= wx + 1 && !stick; nx++) {
          if (nx >= 0 && nx < W && ny >= 0 && ny < H && cells[ny * W + nx]) {
            // Tsirelson sticking probability
            if (rng() < TSIRELSON) stick = true;
          }
        }
      }
      if (stick) {
        cells[wy * W + wx] = 1;
        clusterSize++;
        const r = Math.sqrt((wx - cx) ** 2 + (wy - cy) ** 2);
        if (r > clusterRadius) clusterRadius = r;
        break;
      }
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  const df = fractalDim(cells, W, H);
  return { cells, clusterSize, df, elapsed, seed };
}

// ── OracleReading type ────────────────────────────────────────────────────────

interface OracleReading {
  oracleIndex: number;
  oracleName: string;
  seed: string; // hex
  fractalDim: number;
  clusterSize: number;
  totalCells: number;
  elapsedSeconds: number;
  timestamp: string;
  transport: string;
  latencySeconds: number;
  effectiveCorrelation: number;
  condorcetBonus: number;
  agentId: string;
  heartbeatId: string;
  /** Register-3 excess-correlation probe over spacelike oracle-reading pairs.
   *  Uses CommitPairCorrelator (MI excess over Reichenbach-stratified permutation null).
   *  One-way: isExcess=true convicts; false never acquits.
   *  soundnessNote explains why CHSH is not used here.
   *  null = no prior readings available for this agent (first tick). */
  commitPairProbe: CommitPairProbeResult | null;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface Args {
  agent: string;
  oracleIndex: number;
  heartbeatId: string;
  repoRoot: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args | { error: string } {
  const args: Args = {
    agent: process.env.ZETA_AGENT_ID ?? "alexa",
    oracleIndex: 0,
    heartbeatId: "0000000000000000",
    repoRoot: process.cwd(),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--agent":       args.agent = argv[++i] ?? ""; break;
      case "--oracle-index": args.oracleIndex = parseInt(argv[++i] ?? "0", 10); break;
      case "--heartbeat-id": args.heartbeatId = argv[++i] ?? ""; break;
      case "--repo-root":   args.repoRoot = argv[++i] ?? process.cwd(); break;
      case "--dry-run":     args.dryRun = true; break;
    }
  }
  return args;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`dla-meter: ${parsed.error}`);
    return 2;
  }

  // Seed = wall-clock + prime offset for this oracle index.
  // This enforces L > 0 — the prime offset is the minimum decorrelation window.
  // Different agents run at different wall-clock times (cron jitter) → different seeds.
  // The prime offset guarantees no two oracle indices share a seed even if sampled
  // in the same millisecond.
  const primeOffset = ORACLE_PRIME_OFFSETS[parsed.oracleIndex % ORACLE_PRIME_OFFSETS.length]!;
  const seed = (Date.now() + primeOffset) >>> 0;

  console.log(`dla-meter: agent=${parsed.agent} oracle=${parsed.oracleIndex} seed=0x${seed.toString(16)}`);

  const result = runDla(seed, GRID_W, GRID_H, N_WALKERS);

  // Load prior readings and run the CommitPairCorrelator probe.
  // This is the honest register-3 instrument — MI excess over a Reichenbach-stratified
  // permutation null. CHSH is not used here (see COMMIT_PAIR_SOUNDNESS_NOTE).
  const priorReadings = loadPriorReadings(parsed.repoRoot, parsed.agent);
  const commitPairProbe = priorReadings.length >= 2
    ? runCommitPairProbe(priorReadings, seed)
    : null;
  if (commitPairProbe) {
    console.log(`dla-meter: commitPairProbe meteredPairs=${commitPairProbe.meteredPairs} isExcess=${commitPairProbe.isExcess} excessFraction=${commitPairProbe.excessFraction?.toFixed(3) ?? "null"}`);
  } else {
    console.log(`dla-meter: commitPairProbe=null (insufficient prior readings)`);
  }

  // Git transport: L ≈ 120s (GitHub Actions round-trip).
  // ρ = 1/(1+120) ≈ 0.008. Condorcet bonus ≈ 0.992. Classical/Independent regime.
  const latencySeconds = 120.0;
  const rho = 1 / (1 + latencySeconds);
  const bonus = latencySeconds / (1 + latencySeconds);

  const reading: OracleReading = {
    oracleIndex:         parsed.oracleIndex,
    oracleName:          `Oracle ${parsed.oracleIndex} — ${parsed.agent} (Git/GitHub Actions)`,
    seed:                seed.toString(16).padStart(8, "0"),
    fractalDim:          result.df,
    clusterSize:         result.clusterSize,
    totalCells:          GRID_W * GRID_H,
    elapsedSeconds:      result.elapsed,
    timestamp:           new Date().toISOString(),
    transport:           "git",
    latencySeconds,
    effectiveCorrelation: rho,
    condorcetBonus:      bonus,
    agentId:             parsed.agent,
    heartbeatId:         parsed.heartbeatId,
    commitPairProbe,
  };

  if (parsed.dryRun) {
    console.log("DRY RUN — OracleReading:");
    console.log(JSON.stringify(reading, null, 2));
    return 0;
  }

  // Write to docs/oracle-readings/<agent>/<YYYY>/<MM>/<DD>/<seed>.json
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const dir = join(parsed.repoRoot, "docs", "oracle-readings", parsed.agent, yyyy, mm, dd);
  mkdirSync(dir, { recursive: true });
  const filename = `oracle-${parsed.oracleIndex}-${reading.seed}.json`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(reading, null, 2) + "\n");
  console.log(`dla-meter: wrote ${filepath}`);
  console.log(`dla-meter: D_f=${result.df.toFixed(4)} cluster=${result.clusterSize} elapsed=${result.elapsed.toFixed(3)}s`);
  console.log(`dla-meter: ρ=${rho.toFixed(4)} bonus=${bonus.toFixed(4)} (Classical/Independent)`);

  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
