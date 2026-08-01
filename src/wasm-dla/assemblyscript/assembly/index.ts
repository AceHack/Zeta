// src/wasm-dla/assemblyscript/assembly/index.ts
//
// DLA (Diffusion-Limited Aggregation) in AssemblyScript.
// This is the TypeScript-to-WASM substrate for Oracle 10.
// AssemblyScript compiles a strict subset of TypeScript directly to WASM.
//
// Compile: npx asc assembly/index.ts --outFile build/dla.wasm --optimize
// Validate: wasm-validate build/dla.wasm

const GRID_SIZE: i32 = 128;
const CENTER: i32 = 64;

// Grid stored in a StaticArray<i32> — one cell per element
const grid = new StaticArray<i32>(GRID_SIZE * GRID_SIZE);

let prngState: u32 = 42;
let clusterSize: i32 = 0;
let maxR2: i32 = 0;

// LCG PRNG (Knuth constants)
function prngNext(): u32 {
  prngState = (prngState * 1664525 + 1013904223) as u32;
  return prngState;
}

function idx(x: i32, y: i32): i32 {
  return y * GRID_SIZE + x;
}

function getCell(x: i32, y: i32): i32 {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
  return grid[idx(x, y)];
}

function hasClusterNeighbor(x: i32, y: i32): bool {
  return (
    getCell(x - 1, y) === 1 ||
    getCell(x + 1, y) === 1 ||
    getCell(x, y - 1) === 1 ||
    getCell(x, y + 1) === 1
  );
}

function updateMaxR2(x: i32, y: i32): void {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const r2 = dx * dx + dy * dy;
  if (r2 > maxR2) maxR2 = r2;
}

// init(seed) — clear grid, place seed at center, reset PRNG
export function init(seed: u32): void {
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    grid[i] = 0;
  }
  grid[idx(CENTER, CENTER)] = 1;
  prngState = seed;
  clusterSize = 1;
  maxR2 = 0;
}

// step(n) — run n walkers, return cluster size
export function step(n: i32): i32 {
  for (let i = 0; i < n; i++) {
    let wx = (prngNext() % GRID_SIZE) as i32;
    let wy = (prngNext() % GRID_SIZE) as i32;

    // Walk until stuck
    for (let steps = 0; steps < 10000; steps++) {
      if (hasClusterNeighbor(wx, wy)) {
        grid[idx(wx, wy)] = 1;
        clusterSize++;
        updateMaxR2(wx, wy);
        break;
      }
      const dir = (prngNext() % 4) as i32;
      if (dir === 0) wx++;
      else if (dir === 1) wx--;
      else if (dir === 2) wy++;
      else wy--;

      // Clamp to grid
      if (wx < 0) wx = 0;
      if (wx >= GRID_SIZE) wx = GRID_SIZE - 1;
      if (wy < 0) wy = 0;
      if (wy >= GRID_SIZE) wy = GRID_SIZE - 1;
    }
  }
  return clusterSize;
}

// get_df() — return N/R^2 ratio (JS host computes log ratio for D_f)
export function get_df(): f64 {
  if (maxR2 <= 1) return 1.0;
  const r = Math.sqrt(maxR2 as f64);
  return (clusterSize as f64) / (r * r);
}

// get_cell(x, y) — return cell state
export function get_cell(x: i32, y: i32): i32 {
  return getCell(x, y);
}

// get_cluster_size() — return current cluster size
export function get_cluster_size(): i32 {
  return clusterSize;
}
