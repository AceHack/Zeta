// src/wasm-dla/bytelock/dla-canonical.ts
//
// Canonical DLA substrate — Byte-Lock v1 (AssemblyScript)
// Spec: src/wasm-dla/CANONICAL_SPEC.md
//
// PRNG:   xorshift32
// Grid:   128×128, u8 per cell
// Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
// Walk:   4-directional, clamp to [1, 126]
// Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
//
// Compile:
//   npx asc dla-canonical.ts --outFile dla-canonical-asc.wasm --optimize \
//     --importMemory false --exportRuntime false

// Host-provided trig
declare function cos_f32(x: f32): f32;
declare function sin_f32(x: f32): f32;

const GRID_SIZE: i32 = 128;
const CENTER: i32 = 64;
const N_WALKERS: i32 = 800;
const MAX_STEPS: i32 = 50000;
const SPAWN_CAP: f32 = 58.0;
const KILL_EXTRA: f32 = 8.0;
const TWO_PI: f32 = 6.2831855;

const grid = new StaticArray<u8>(GRID_SIZE * GRID_SIZE);
const trajectory = new StaticArray<u32>(N_WALKERS);
let prngState: u32 = 1;
let clusterSize: i32 = 0;
let maxR: f32 = 1.0;

function xorshift32(): u32 {
  prngState ^= prngState << 13;
  prngState ^= prngState >> 17;
  prngState ^= prngState << 5;
  return prngState;
}

function gridIdx(x: i32, y: i32): i32 {
  return y * GRID_SIZE + x;
}

function getCell(x: i32, y: i32): u8 {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
  return grid[gridIdx(x, y)];
}

function hasNeighbor(x: i32, y: i32): bool {
  return getCell(x - 1, y) != 0 || getCell(x + 1, y) != 0 ||
         getCell(x, y - 1) != 0 || getCell(x, y + 1) != 0;
}

function clamp(v: i32, lo: i32, hi: i32): i32 {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// JS Math.round semantics: round half away from zero
function jsRound(x: f32): i32 {
  return i32(x >= 0.0 ? x + 0.5 : x - 0.5);
}

export function init(seed: u32): void {
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) grid[i] = 0;
  prngState = seed == 0 ? 1 : seed;
  clusterSize = 1;
  maxR = 1.0;
  grid[gridIdx(CENTER, CENTER)] = 1;
  for (let i = 0; i < N_WALKERS; i++) trajectory[i] = 0xFFFFFFFF;
}

export function run(): void {
  for (let w: i32 = 0; w < N_WALKERS; w++) {
    const spawnR: f32 = min(maxR + 3.0, SPAWN_CAP);
    const angleBits: u32 = xorshift32();
    const angle: f32 = (f32(angleBits) / 4294967296.0) * TWO_PI;

    let wx: i32 = clamp(jsRound(f32(CENTER) + spawnR * cos_f32(angle)), 1, GRID_SIZE - 2);
    let wy: i32 = clamp(jsRound(f32(CENTER) + spawnR * sin_f32(angle)), 1, GRID_SIZE - 2);

    const killR: f32 = spawnR + KILL_EXTRA;
    const killR2: f32 = killR * killR;

    let done: bool = false;
    for (let step: i32 = 0; step < MAX_STEPS && !done; step++) {
      if (hasNeighbor(wx, wy)) {
        grid[gridIdx(wx, wy)] = 1;
        clusterSize++;
        const dx: f32 = f32(wx - CENTER);
        const dy: f32 = f32(wy - CENTER);
        const r: f32 = Mathf.sqrt(dx * dx + dy * dy);
        if (r > maxR) maxR = r;
        trajectory[w] = (u32(wx) << 16) | u32(wy);
        done = true;
        break;
      }
      const dx: f32 = f32(wx - CENTER);
      const dy: f32 = f32(wy - CENTER);
      if (dx * dx + dy * dy > killR2) break;

      const dir: u32 = xorshift32() % 4;
      if      (dir == 0) wx = clamp(wx + 1, 1, GRID_SIZE - 2);
      else if (dir == 1) wx = clamp(wx - 1, 1, GRID_SIZE - 2);
      else if (dir == 2) wy = clamp(wy + 1, 1, GRID_SIZE - 2);
      else               wy = clamp(wy - 1, 1, GRID_SIZE - 2);
    }
  }
}

export function getClusterSize(): i32 { return clusterSize; }
export function getMaxRBits(): u32    { return reinterpret<u32>(maxR); }
export function getTrajectoryEntry(i: i32): u32 { return trajectory[i]; }
