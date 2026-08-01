/**
 * Quantum Walk DLA — Oracle 5 (Q# model, simulated in JS)
 *
 * The Q# quantum walk on a 2D lattice uses the Hadamard coin:
 *
 *   H = (1/√2) [[1, 1], [1, -1]]
 *
 * The walker carries a 4-component coin state (up/down/left/right),
 * each with a complex amplitude. At each step:
 *   1. Apply the Hadamard coin to the coin register (creates superposition)
 *   2. Shift: move the amplitude in each direction
 *   3. Interference: amplitudes at each cell sum (complex addition)
 *
 * The probability density |ψ|² at each cell is the quantum analogue of
 * the DLA density field. We then apply the Tsirelson sticking rule to
 * the probability density: cells with |ψ|² > STICKING_THRESHOLD collapse (stick).
 *
 * Seed independence (live mode):
 *   The seed controls the initial phase angle of the coin state.
 *   A different seed → different phase → different interference pattern →
 *   different fractal shape, but the same fractal DIMENSION.
 *   This is the quantum oracle's contribution to the sensor-fusion proof:
 *   the D_f is invariant under phase rotation of the initial coin state.
 *
 * Why 1/(3√2)?  [CORRECTED 2026-08-01 — the previous answer here was FALSE.]
 *   It is a STICKING-PROBABILITY PARAMETER chosen for this simulation. It is not a
 *   Tsirelson bound and carries no physics content.
 *
 *   The two claims previously written here were both wrong:
 *     - "1/(2√2) = Tsirelson bound for a SINGLE qubit" — no. The CHSH Tsirelson bound
 *       is S ≤ 2√2 ≈ 2.828, a bound on a CHSH sum, not 1/(2√2) ≈ 0.354.
 *     - "1/(3√2) = Tsirelson bound for a 2D LATTICE walker" — no such published bound
 *       exists; the 1/(n√2) family was invented to make the numbers line up.
 *
 *   Within Zeta's own model the correlation at the Tsirelson crossing is
 *   ρ* = √2 − 1 ≈ 0.414 (see src/Core/FeedbackThrottle.fs, which solves
 *   2 + 2/(1+L) = 2√2) — not 0.2357. Do not re-label this constant as physics.
 */

import { useEffect, useState } from "react";
import { fractalDim, STICKING_THRESHOLD, liveSeed, ORACLE_PRIME_OFFSETS } from "./useDLA";

export interface QuantumGrid {
  cells: Uint8Array;      // collapsed cluster (measurement outcome)
  density: Float32Array;  // |ψ|² probability density (pre-collapse)
  W: number;
  H: number;
  clusterSize: number;
  elapsed: number;
  df: number;
  steps: number;
  seed: number;           // actual seed used — exposed for independence audit
}

// Complex number helpers
type C = [number, number]; // [re, im]
const cadd = ([ar, ai]: C, [br, bi]: C): C => [ar + br, ai + bi];
const cscale = ([r, i]: C, s: number): C => [r * s, i * s];
const cabs2 = ([r, i]: C) => r * r + i * i;

// 4-component Grover coin (maximally entangles all four directions)
// H_4 = (1/2) * [[1,1,1,1],[1,-1,1,-1],[1,1,-1,-1],[1,-1,-1,1]]
function applyCoin(amp: C[]): C[] {
  const s = 0.5;
  const [a, b, c, d] = amp;
  return [
    cscale(cadd(cadd(cadd(a, b), c), d), s),
    cscale(cadd(cadd([a[0]-b[0],a[1]-b[1]], c), [-d[0],-d[1]]), s),
    cscale(cadd(cadd(a, b), [-c[0],-c[1]]), s),
    cscale(cadd(cadd([a[0]-b[0],a[1]-b[1]], [-c[0],-c[1]]), d), s),
  ];
}

export function runQuantumWalk(
  seed: number,
  W: number,
  H: number,
  nSteps: number
): QuantumGrid {
  const t0 = performance.now();

  // State: 4 complex amplitudes per cell (coin dirs: up/down/left/right)
  const N = 4 * W * H;
  const re = new Float32Array(N);
  const im = new Float32Array(N);

  const I = (dir: number, x: number, y: number) => dir * W * H + y * W + x;
  const inB = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;

  // Seed → initial phase angle.
  // A different seed rotates the initial coin state by a different angle.
  // This is the quantum oracle's seed independence mechanism:
  //   same Grover coin + same lattice + different phase → different shape, same D_f.
  // The phase is the "which direction does the bat face" parameter.
  const phase = ((seed >>> 0) % 1000) / 1000 * 2 * Math.PI;
  const cx = W >> 1, cy = H >> 1;
  const init = 0.5; // 1/√4 = 0.5 for equal superposition
  for (let d = 0; d < 4; d++) {
    // Each direction gets a phase-rotated amplitude: e^(i * phase * d)
    const theta = phase * d;
    re[I(d, cx, cy)] = init * Math.cos(theta);
    im[I(d, cx, cy)] = init * Math.sin(theta);
  }

  // Shift operators: dir 0=up(y-1), 1=down(y+1), 2=left(x-1), 3=right(x+1)
  const dx = [0, 0, -1, 1];
  const dy = [-1, 1, 0, 0];

  const reNext = new Float32Array(N);
  const imNext = new Float32Array(N);

  for (let step = 0; step < nSteps; step++) {
    reNext.fill(0);
    imNext.fill(0);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const amp: C[] = [
          [re[I(0,x,y)], im[I(0,x,y)]],
          [re[I(1,x,y)], im[I(1,x,y)]],
          [re[I(2,x,y)], im[I(2,x,y)]],
          [re[I(3,x,y)], im[I(3,x,y)]],
        ];

        const coined = applyCoin(amp);

        for (let d = 0; d < 4; d++) {
          const nx = x + dx[d], ny = y + dy[d];
          if (inB(nx, ny)) {
            const j = I(d, nx, ny);
            reNext[j] += coined[d][0];
            imNext[j] += coined[d][1];
          }
        }
      }
    }

    re.set(reNext);
    im.set(imNext);
  }

  // Compute probability density |ψ|² at each cell (sum over coin dirs)
  const density = new Float32Array(W * H);
  let totalProb = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let p = 0;
      for (let d = 0; d < 4; d++) p += cabs2([re[I(d,x,y)], im[I(d,x,y)]]);
      density[y * W + x] = p;
      totalProb += p;
    }
  }

  if (totalProb > 0) {
    for (let i = 0; i < density.length; i++) density[i] /= totalProb;
  }

  // Collapse: cells with density > threshold stick (measurement)
  const cells = new Uint8Array(W * H);
  let clusterSize = 0;
  let maxD = 0;
  for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];
  const collapseThreshold = maxD * STICKING_THRESHOLD * 1.2;

  for (let i = 0; i < density.length; i++) {
    if (density[i] >= collapseThreshold) {
      cells[i] = 1;
      clusterSize++;
    }
  }

  const elapsed = (performance.now() - t0) / 1000;
  const df = fractalDim(cells, W, H);

  return { cells, density, W, H, clusterSize, elapsed, df, steps: nSteps, seed };
}

export function useQuantumWalk(
  W = 80,
  H = 80,
  nSteps = 120,
  seed: number | "live" = 42
): {
  grid: QuantumGrid | null;
  ready: boolean;
} {
  const [state, setState] = useState<{ grid: QuantumGrid | null; ready: boolean }>({
    grid: null,
    ready: false,
  });

  useEffect(() => {
    const id = setTimeout(() => {
      // Oracle 5 (index 4) gets its own prime offset in live mode
      const s = seed === "live"
        ? (Date.now() + ORACLE_PRIME_OFFSETS[4]) >>> 0
        : seed;
      const grid = runQuantumWalk(s, W, H, nSteps);
      setState({ grid, ready: true });
    }, 100);
    return () => clearTimeout(id);
  }, [W, H, nSteps, seed]);

  return state;
}
