import { useEffect, useState } from "react";

// ⚠ NAME IS A MISNOMER (Soraya audit, 2026-08-01). `TSIRELSON` is NOT the Tsirelson bound.
// Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator (see src/Core/Tsirelson.fs,
// src/Core/BellTest.fs). There is no Tsirelson bound on a correlation coefficient. 1/(3√2)
// is ρ*/√2 — the Condorcet limit ρ* = 1/3 pushed through the FREELY CHOSEN linear map
// ρ = S/12 — a design parameter chosen for homoiconicity, not derived. See
// docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md
// Here it is used purely as a DLA sticking probability / density cutoff. Do not read it as physics.
export const TSIRELSON = 1 / (3 * Math.sqrt(2)); // ≈ 0.2357 — DLA sticking probability (design choice)

// ── Seeded xorshift32 PRNG ────────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return {
    f(): number {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    },
    i(n: number): number {
      return Math.floor(this.f() * n);
    },
  };
}

export interface DLAGrid {
  cells: Uint8Array;
  W: number;
  H: number;
  clusterSize: number;
  elapsed: number;
  df: number;
}

// ── DLA core ──────────────────────────────────────────────────────────────────
export function runDLA(seed: number, W: number, H: number, nWalkers: number): DLAGrid {
  const t0 = performance.now();
  const rng = makeRng(seed);
  const cells = new Uint8Array(W * H);
  const I = (x: number, y: number) => y * W + x;
  const inB = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  const cx = W >> 1, cy = H >> 1;
  cells[I(cx, cy)] = 1;
  let clusterSize = 1;
  let clusterRadius = 1;

  function nbrs(x: number, y: number): number {
    let n = 0;
    if (inB(x - 1, y) && cells[I(x - 1, y)]) n++;
    if (inB(x + 1, y) && cells[I(x + 1, y)]) n++;
    if (inB(x, y - 1) && cells[I(x, y - 1)]) n++;
    if (inB(x, y + 1) && cells[I(x, y + 1)]) n++;
    return n;
  }

  function stickP(x: number, y: number): number {
    const n = nbrs(x, y);
    return n === 0 ? 0 : Math.min(1, TSIRELSON * (1 + n * 0.5));
  }

  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let i = 0; i < nWalkers; i++) {
    const spawnR = Math.min(clusterRadius + 2, Math.min(W, H) * 0.47);
    const killR = spawnR + Math.max(10, Math.min(W, H) * 0.15);
    const angle = rng.f() * 2 * Math.PI;
    let wx = Math.max(0, Math.min(W - 1, Math.round(cx + spawnR * Math.cos(angle))));
    let wy = Math.max(0, Math.min(H - 1, Math.round(cy + spawnR * Math.sin(angle))));

    let stuck = false, escaped = false, steps = 0;
    const maxSteps = W * H * 4;
    while (!stuck && !escaped && steps++ < maxSteps) {
      const [dx, dy] = dirs[rng.i(4)];
      wx = Math.max(0, Math.min(W - 1, wx + dx));
      wy = Math.max(0, Math.min(H - 1, wy + dy));
      const dist = Math.hypot(wx - cx, wy - cy);
      if (dist > killR) escaped = true;
      else if (nbrs(wx, wy) > 0 && rng.f() < stickP(wx, wy)) stuck = true;
    }
    if (stuck) {
      cells[I(wx, wy)] = 1;
      clusterSize++;
      const d = Math.hypot(wx - cx, wy - cy);
      if (d > clusterRadius) clusterRadius = d;
    }
  }

  const elapsed = (performance.now() - t0) / 1000;
  return { cells, W, H, clusterSize, elapsed, df: fractalDim(cells, W, H) };
}

// ── Fractal dimension (box-counting) ─────────────────────────────────────────
export function fractalDim(cells: Uint8Array, W: number, H: number): number {
  const sizes = [2, 4, 8, 16, 32].filter((s) => s < Math.min(W, H));
  if (sizes.length < 2) return 1.5;
  const pts = sizes.map((s) => {
    let count = 0;
    for (let bxi = 0; bxi * s < W; bxi++)
      for (let byi = 0; byi * s < H; byi++) {
        let found = false;
        for (let dx = 0; dx < s && !found; dx++)
          for (let dy = 0; dy < s && !found; dy++) {
            const x = bxi * s + dx, y = byi * s + dy;
            if (x < W && y < H && cells[y * W + x]) found = true;
          }
        if (found) count++;
      }
    return [Math.log(count), Math.log(1 / s)] as [number, number];
  });
  const n = pts.length;
  const sx = pts.reduce((a, [, x]) => a + x, 0);
  const sy = pts.reduce((a, [y]) => a + y, 0);
  const sxy = pts.reduce((a, [y, x]) => a + x * y, 0);
  const sx2 = pts.reduce((a, [, x]) => a + x * x, 0);
  return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
}

// ── Warm colour (orange gradient, inner bright → outer deep red) ─────────────
export function warmColour(x: number, y: number, cx: number, cy: number, maxD: number): string {
  const t = Math.hypot(x - cx, y - cy) / maxD;
  const r = Math.round(255 - t * 51);
  const g = Math.round(170 - t * 170);
  return `rgb(${r},${g},0)`;
}

// ── React hook ────────────────────────────────────────────────────────────────
export interface OracleResults {
  main: DLAGrid | null;
  chip8: DLAGrid | null;
  ready: boolean;
}

export function useDLA(seed = 42, W = 100, H = 100, N = 1200): OracleResults {
  const [results, setResults] = useState<OracleResults>({ main: null, chip8: null, ready: false });

  useEffect(() => {
    const id = setTimeout(() => {
      const main = runDLA(seed, W, H, N);
      const chip8 = runDLA(seed, 64, 32, 350);
      setResults({ main, chip8, ready: true });
    }, 50);
    return () => clearTimeout(id);
  }, [seed, W, H, N]);

  return results;
}
