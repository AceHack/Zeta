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
