/**
 * src/wasm-dla/bytelock/reference.mjs
 *
 * Canonical DLA reference implementation — Byte-Lock v1
 * This is the ground truth. All 10 substrates must produce identical
 * trajectory vectors for the same seed.
 *
 * Spec: src/wasm-dla/CANONICAL_SPEC.md
 *
 * Usage:
 *   node reference.mjs [seed]          — print golden vector as JSON
 *   node reference.mjs --verify <file> — verify a substrate output against golden
 */

// ── Constants ─────────────────────────────────────────────────────────────────
export const GRID_SIZE  = 128;
export const CENTER     = 64;
export const N_WALKERS  = 800;
export const MAX_STEPS  = 50_000;
export const SPAWN_CAP  = 58;   // min(maxR + 3, 58) — keeps walkers inside grid
export const KILL_EXTRA = 8;    // killR = spawnR + KILL_EXTRA
const TWO_PI = 6.283185307179586;

// ── xorshift32 PRNG ───────────────────────────────────────────────────────────
// Canonical form: same shift constants as useDLA.ts / V8 / QuickJS / Lua sources.
// Returns a u32 (0 .. 2^32-1). Division by 4294967296 gives [0, 1).
export function makeXorshift32(seed) {
  // seed=0 is invalid for xorshift32 (would stay 0 forever); use 1 instead.
  let s = (seed >>> 0) || 1;
  return {
    next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return s >>> 0;
    },
    // float in [0, 1) — uses Math.fround so the value matches f32 WASM substrates
    nextF32() {
      return Math.fround(this.next() / 4294967296);
    },
  };
}

// ── DLA core ──────────────────────────────────────────────────────────────────
/**
 * Run the canonical DLA algorithm.
 * @param {number} seed  — u32 seed
 * @returns {{ trajectory: Uint32Array, clusterSize: number, maxRBits: number }}
 *   trajectory[i] = (stick_x << 16) | stick_y  if walker i stuck
 *   trajectory[i] = 0xFFFFFFFF                  if walker i escaped
 *   maxRBits = Float32Array bit-cast of maxR (avoids float formatting issues)
 */
export function runDLA(seed) {
  const rng = makeXorshift32(seed);
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const trajectory = new Uint32Array(N_WALKERS);

  // Place seed cell at center
  grid[CENTER * GRID_SIZE + CENTER] = 1;
  let clusterSize = 1;
  let maxR = Math.fround(1.0);

  for (let w = 0; w < N_WALKERS; w++) {
    // 1. Spawn on a circle
    const spawnR = Math.fround(Math.min(Math.fround(maxR + 3), SPAWN_CAP));
    const angleBits = rng.next();
    const angle = Math.fround(Math.fround(angleBits / 4294967296) * TWO_PI);
    let wx = Math.round(CENTER + Math.fround(spawnR * Math.fround(Math.cos(angle))));
    let wy = Math.round(CENTER + Math.fround(spawnR * Math.fround(Math.sin(angle))));
    // Clamp spawn to [1, GRID_SIZE-2] so walkers start inside the grid
    wx = Math.max(1, Math.min(GRID_SIZE - 2, wx));
    wy = Math.max(1, Math.min(GRID_SIZE - 2, wy));

    const killR2 = (spawnR + KILL_EXTRA) * (spawnR + KILL_EXTRA);
    let stuck = false;

    // 2. Walk
    for (let step = 0; step < MAX_STEPS; step++) {
      // Check 4-neighbors
      const left  = grid[wy * GRID_SIZE + (wx - 1)];
      const right = grid[wy * GRID_SIZE + (wx + 1)];
      const up    = grid[(wy - 1) * GRID_SIZE + wx];
      const down  = grid[(wy + 1) * GRID_SIZE + wx];
      if (left || right || up || down) {
        // Stick
        grid[wy * GRID_SIZE + wx] = 1;
        clusterSize++;
        const dx = wx - CENTER;
        const dy = wy - CENTER;
        const r = Math.fround(Math.sqrt(dx * dx + dy * dy));
        if (r > maxR) maxR = r;
        trajectory[w] = (wx << 16) | wy;
        stuck = true;
        break;
      }

      // Kill radius check
      const dx = wx - CENTER;
      const dy = wy - CENTER;
      if (dx * dx + dy * dy > killR2) break;

      // Move (4-directional, clamp to [1, GRID_SIZE-2])
      const dir = rng.next() % 4;
      if      (dir === 0) wx = Math.min(wx + 1, GRID_SIZE - 2);
      else if (dir === 1) wx = Math.max(wx - 1, 1);
      else if (dir === 2) wy = Math.min(wy + 1, GRID_SIZE - 2);
      else                wy = Math.max(wy - 1, 1);
    }

    if (!stuck) trajectory[w] = 0xFFFFFFFF;
  }

  // Bit-cast maxR to u32 so we can store it without float formatting ambiguity
  const f32buf = new Float32Array(1);
  f32buf[0] = maxR;
  const maxRBits = new Uint32Array(f32buf.buffer)[0];

  return { trajectory, clusterSize, maxRBits };
}

// ── Golden vector serialisation ───────────────────────────────────────────────
export function toGoldenVector(seed, result) {
  return {
    spec_version: "1",
    seed,
    grid_size: GRID_SIZE,
    n_walkers: N_WALKERS,
    prng: "xorshift32",
    substrate: "reference-js",
    cluster_size: result.clusterSize,
    max_r_bits: result.maxRBits,
    trajectory: Array.from(result.trajectory, (v) => "0x" + v.toString(16).padStart(8, "0")),
  };
}

// ── Verification ──────────────────────────────────────────────────────────────
/**
 * Verify a substrate output JSON against the golden vector.
 * Returns { pass: boolean, divergences: string[] }
 */
export function verify(golden, candidate) {
  const divergences = [];

  if (candidate.spec_version !== golden.spec_version)
    divergences.push(`spec_version: expected ${golden.spec_version}, got ${candidate.spec_version}`);
  if (candidate.seed !== golden.seed)
    divergences.push(`seed: expected ${golden.seed}, got ${candidate.seed}`);
  if (candidate.grid_size !== golden.grid_size)
    divergences.push(`grid_size: expected ${golden.grid_size}, got ${candidate.grid_size}`);
  if (candidate.n_walkers !== golden.n_walkers)
    divergences.push(`n_walkers: expected ${golden.n_walkers}, got ${candidate.n_walkers}`);
  if (candidate.cluster_size !== golden.cluster_size)
    divergences.push(`cluster_size: expected ${golden.cluster_size}, got ${candidate.cluster_size}`);
  if (candidate.max_r_bits !== golden.max_r_bits)
    divergences.push(`max_r_bits: expected 0x${golden.max_r_bits.toString(16)}, got 0x${candidate.max_r_bits.toString(16)}`);

  const tg = golden.trajectory;
  const tc = candidate.trajectory;
  if (!tc) {
    divergences.push("trajectory: missing");
  } else if (tc.length !== tg.length) {
    divergences.push(`trajectory length: expected ${tg.length}, got ${tc.length}`);
  } else {
    let firstDiv = -1;
    for (let i = 0; i < tg.length; i++) {
      if (tc[i] !== tg[i]) { firstDiv = i; break; }
    }
    if (firstDiv >= 0) {
      const total = tg.filter((v, i) => v !== tc[i]).length;
      divergences.push(
        `trajectory: ${total} divergent entries, first at index ${firstDiv}: ` +
        `expected ${tg[firstDiv]}, got ${tc[firstDiv]}`
      );
    }
  }

  return { pass: divergences.length === 0, divergences };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);

  if (args[0] === "--verify") {
    // node reference.mjs --verify <candidate.json> [seed]
    const { readFileSync } = await import("fs");
    const candidatePath = args[1];
    const seed = args[2] ? parseInt(args[2], 10) : 42;
    const golden = toGoldenVector(seed, runDLA(seed));
    const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
    const result = verify(golden, candidate);
    if (result.pass) {
      console.log("PASS — byte-lock verified");
    } else {
      console.error("FAIL — divergences:");
      for (const d of result.divergences) console.error("  " + d);
      process.exit(1);
    }
  } else {
    // node reference.mjs [seed]
    const seed = args[0] ? parseInt(args[0], 10) : 42;
    const result = runDLA(seed);
    const gv = toGoldenVector(seed, result);
    console.log(JSON.stringify(gv, null, 2));
  }
}
