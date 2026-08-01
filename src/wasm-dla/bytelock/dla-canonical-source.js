/**
 * src/wasm-dla/bytelock/dla-canonical-source.js
 *
 * Canonical DLA source — Byte-Lock v1
 * This single JS file is compiled to:
 *   - V8 bytecode:    node --print-bytecode (or vm.Script.createCachedData)
 *   - QuickJS bytecode: qjsc -c dla-canonical-source.js -o dla-canonical-qjs.c
 *   - Lua bytecode:   (see dla-canonical.lua — separate port)
 *
 * It is also the Node.js oracle substrate (run directly with node).
 *
 * Spec: src/wasm-dla/CANONICAL_SPEC.md
 *
 * PRNG:   xorshift32
 * Grid:   128×128, Uint8Array
 * Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
 * Walk:   4-directional, clamp to [1, 126]
 * Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
 *
 * Float precision: all trig uses Math.fround() to match f32 WASM substrates.
 */

"use strict";

const GRID_SIZE  = 128;
const CENTER     = 64;
const N_WALKERS  = 800;
const MAX_STEPS  = 50000;
const SPAWN_CAP  = Math.fround(58.0);
const KILL_EXTRA = Math.fround(8.0);
const TWO_PI     = Math.fround(6.2831855);

// ── xorshift32 ────────────────────────────────────────────────────────────────
function makeXorshift32(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
}

// ── DLA core ──────────────────────────────────────────────────────────────────
function runDLA(seed) {
  const rng  = makeXorshift32(seed);
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const traj = new Uint32Array(N_WALKERS);

  // Init
  grid[CENTER * GRID_SIZE + CENTER] = 1;
  for (let i = 0; i < N_WALKERS; i++) traj[i] = 0xFFFFFFFF;

  let clusterSize = 1;
  let maxR = Math.fround(1.0);

  for (let w = 0; w < N_WALKERS; w++) {
    // Spawn
    const spawnR = Math.fround(Math.min(Math.fround(maxR + Math.fround(3.0)), SPAWN_CAP));
    const angleBits = rng();
    const angle = Math.fround(Math.fround(angleBits / 4294967296) * TWO_PI);

    let wx = Math.round(CENTER + Math.fround(spawnR * Math.fround(Math.cos(angle))));
    let wy = Math.round(CENTER + Math.fround(spawnR * Math.fround(Math.sin(angle))));
    wx = Math.max(1, Math.min(GRID_SIZE - 2, wx));
    wy = Math.max(1, Math.min(GRID_SIZE - 2, wy));

    const killR  = Math.fround(spawnR + KILL_EXTRA);
    const killR2 = Math.fround(killR * killR);

    let stuck = false;
    for (let step = 0; step < MAX_STEPS; step++) {
      // Check 4-neighbors
      const left  = wx > 0            ? grid[wy * GRID_SIZE + (wx - 1)] : 0;
      const right = wx < GRID_SIZE-1  ? grid[wy * GRID_SIZE + (wx + 1)] : 0;
      const up    = wy > 0            ? grid[(wy - 1) * GRID_SIZE + wx]  : 0;
      const down  = wy < GRID_SIZE-1  ? grid[(wy + 1) * GRID_SIZE + wx]  : 0;

      if (left || right || up || down) {
        grid[wy * GRID_SIZE + wx] = 1;
        clusterSize++;
        const dx = Math.fround(wx - CENTER);
        const dy = Math.fround(wy - CENTER);
        const r  = Math.fround(Math.sqrt(Math.fround(dx * dx + dy * dy)));
        if (r > maxR) maxR = r;
        traj[w] = ((wx << 16) | wy) >>> 0;
        stuck = true;
        break;
      }

      // Kill radius
      const dx = Math.fround(wx - CENTER);
      const dy = Math.fround(wy - CENTER);
      if (Math.fround(dx * dx + dy * dy) > killR2) break;

      // Move
      const dir = rng() % 4;
      if      (dir === 0) wx = Math.min(wx + 1, GRID_SIZE - 2);
      else if (dir === 1) wx = Math.max(wx - 1, 1);
      else if (dir === 2) wy = Math.min(wy + 1, GRID_SIZE - 2);
      else                wy = Math.max(wy - 1, 1);
    }
    // traj[w] stays 0xFFFFFFFF if not stuck
  }

  // Bit-cast maxR to u32
  const f32buf = new Float32Array(1);
  f32buf[0] = maxR;
  const maxRBits = new Uint32Array(f32buf.buffer)[0];

  return { trajectory: traj, clusterSize, maxRBits };
}

// ── Golden vector serialisation ───────────────────────────────────────────────
function toGoldenVector(seed, result, substrateName) {
  return {
    spec_version: "1",
    seed,
    grid_size: GRID_SIZE,
    n_walkers: N_WALKERS,
    prng: "xorshift32",
    substrate: substrateName || "js-canonical",
    cluster_size: result.clusterSize,
    max_r_bits: result.maxRBits,
    trajectory: Array.from(result.trajectory, (v) => "0x" + v.toString(16).padStart(8, "0")),
  };
}

// ── CLI (Node.js) ─────────────────────────────────────────────────────────────
if (typeof process !== "undefined" && process.argv && process.argv[1] &&
    process.argv[1].endsWith("dla-canonical-source.js")) {
  const seed = process.argv[2] ? parseInt(process.argv[2], 10) : 42;
  const result = runDLA(seed);
  const gv = toGoldenVector(seed, result, "js-canonical");
  process.stdout.write(JSON.stringify(gv, null, 2) + "\n");
}

// ── Exports (for QuickJS / embedded use) ─────────────────────────────────────
if (typeof module !== "undefined") {
  module.exports = { runDLA, toGoldenVector, GRID_SIZE, CENTER, N_WALKERS };
}
