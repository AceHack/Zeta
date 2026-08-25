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

// ── Box-counting fractal dimension (Minkowski–Bouligand) ──────────────────────
/**
 * Real box-counting (Minkowski–Bouligand) fractal dimension of the DLA cluster,
 * computed HOST-SIDE from the byte-locked trajectory. Because every substrate
 * produces a byte-identical trajectory (that is exactly what the byte-lock
 * verifies), this yields the SAME dimension for all substrates for free —
 * replacing the ad-hoc `get_df()` proxy in `../wat/dla.wat` (now renamed
 * `toy_density_proxy`, because it returns `csize / maxR²` — a number DENSITY, not
 * a dimension; the "~1.322 constant" attributed to it was only ever in a comment,
 * never in its body). For 2-D DLA the asymptotic value is ≈ 1.71 (Witten & Sander
 * 1981, Phys. Rev. Lett. 47, 1400; Halsey 2000, Physics Today 53(11), 36).
 *
 * ⚠ CORRECTION (Lumen 2026-08-25) — READ BEFORE QUOTING THE NUMBER BELOW.
 * The ≈1.30 this returns at the byte-lock's cluster size is NOT "the honest small-N
 * dimension". It is dominated by an ESTIMATOR ARTIFACT, and the artifact is now
 * pinned by calibration tests (`box-counting.test.ts` CALIB-1..4):
 *
 *   - Run this same code on a SIERPINSKI GASKET — exactly self-similar, true
 *     dimension log3/log2 = 1.58496, NO finite-size physics at all — densely
 *     sampled, and it returns 1.530. Subsample the SAME object to ~330 points
 *     (the DLA cluster's occupancy) and it returns 1.0001.
 *   - Mechanism: at ε=2 it finds ~292 boxes for ~330 points, so nearly every point
 *     is alone in its box. The small-ε end of the fit has SATURATED, which drags
 *     the slope toward isolated-point behaviour. The window {2,4,8,16} puts half
 *     its fit points in that regime.
 *   - Definitionally (Falconer, *Fractal Geometry*): the box-counting dimension of
 *     ANY finite point set is exactly 0. These clusters are ~330 cells, so there is
 *     no ε→0 limit to converge to — only a slope over a stated window.
 *   - The Witten–Sander mass-radius estimator on these SAME clusters returns a mean
 *     of 1.668, within 2.5% of 1.71 (see `massRadiusDimension` in the tests). The
 *     cluster IS scaling like DLA; this window was not measuring it.
 *
 * So: report this as "the slope over ε ∈ {2,4,8,16}", never as "the fractal
 * dimension". Growing the cluster does NOT fix it — the saturated points stay in
 * the fit at every size (measured: 1.249 at N=339, plateauing ≈1.43 by N=4992).
 *
 * Scales 2/4/8/16 px, least-squares slope of ln N(ε) vs ln(1/ε) — the same
 * estimator the web app's OracleV8Bytecode oracle uses, so repo substrate, web
 * app, and docs all report the same dimension. Touches no golden vector: the
 * vectors lock the trajectory (+ clusterSize + maxRBits), not D_f, and D_f is
 * derived from the trajectory they already lock.
 *
 * **D is a function of (N, grid size, scale set) — a bare number is not meaningful.**
 * This module's default (128 grid, scales 2/4/8/16) gives ≈ 1.30 at N=800, while
 * `src/Core.TypeScript/oracle/dla-convergence.test.ts` (256 grid, scales
 * 2/4/8/16/32) gives ≈ 1.41 at the same N. Measured decomposition of that gap:
 * the scale set accounts for only ≈ 0.04 (seed 42: 1.249 narrow → 1.212 wide), so
 * the gap is dominated by the **grid size** — a 256 grid confines the cluster less,
 * so at the same N it is a geometrically different cluster, not merely the same
 * cluster measured differently. Both numbers are correct for their setup.
 * `box-counting-conformance.test.ts` proves the two independent implementations
 * agree exactly (1e-10) once (grid, scales) are matched — so the difference is
 * setup, never a divergence in the algorithm. Always report D with its parameters.
 *
 * @param {Uint32Array|number[]} trajectory  runDLA(seed).trajectory
 * @param {{scales?: number[]}} [opts]  measurement window; default scales 2/4/8/16
 * @returns {number} estimated fractal dimension (least-squares slope)
 */
export function boxCountingDimension(trajectory, opts = {}) {
  // Reconstruct the occupied-cell set: the center seed + every stuck walker.
  const occupied = new Set();
  occupied.add(CENTER * GRID_SIZE + CENTER);
  for (const v of trajectory) {
    if (v === 0xffffffff) continue; // escaped walker — never stuck
    const x = (v >>> 16) & 0xffff;
    const y = v & 0xffff;
    occupied.add(y * GRID_SIZE + x);
  }

  const scales = opts.scales ?? [2, 4, 8, 16];
  const pts = []; // [ ln(1/ε), ln N(ε) ]
  for (const eps of scales) {
    const boxes = new Set();
    for (const cell of occupied) {
      const x = cell % GRID_SIZE;
      const y = (cell - x) / GRID_SIZE;
      // floor(coord/ε) < 128/2 = 64 < GRID_SIZE, so the box key is collision-free.
      boxes.add(Math.floor(y / eps) * GRID_SIZE + Math.floor(x / eps));
    }
    pts.push([Math.log(1 / eps), Math.log(boxes.size)]);
  }

  // Least-squares slope of ln N vs ln(1/ε) = the box-counting dimension.
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
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
