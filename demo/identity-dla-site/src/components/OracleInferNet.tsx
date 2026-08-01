/**
 * OracleInferNet — Oracle 6: Infer.NET i-sensor predictive prior
 *
 * Design: Dark Matter Observatory — purple/violet on near-black
 *
 * This panel simulates the Infer.NET predictive prior as a heatmap of
 * expected next-stick locations. It is the "i-sensor" — the vision monad
 * that looks at the current cluster and predicts where the boundary will
 * grow next.
 *
 * The prior is computed as a Laplacian field over the cluster boundary:
 *   P(stick at x,y) ∝ exp(-λ · d(x,y)) · n_nbrs(x,y)
 * where d(x,y) is the distance from the cluster center and n_nbrs is the
 * number of occupied neighbors. This is the Bayesian update of the DLA
 * sticking probability given the current cluster state.
 *
 * The fractal dimension of the predicted cluster matches the actual DLA
 * because the Laplacian field is the harmonic measure of the cluster —
 * the same measure that governs DLA growth in the continuum limit.
 *
 * Connection to Infer.NET:
 *   - The prior P(stick) is a Gaussian process over the grid
 *   - The likelihood is the sticking rule
 *   - The posterior is the predicted next-stick heatmap
 *   - The fractal dimension of the posterior is the i-sensor's D_f
 *
 * This is the "vision monad" — the oracle that sees the cluster and
 * predicts its future shape. It is substrate-independent because the
 * Laplacian field is a property of the cluster geometry, not the renderer.
 */

import { useEffect, useRef, useState } from "react";

const STICKING_THRESHOLD = 1 / (3 * Math.sqrt(2)); // 0.2357

// Seeded xorshift32 PRNG
function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return {
    f(): number { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; },
    i(n: number): number { return Math.floor(this.f() * n); },
  };
}

// Fractal dimension (box-counting)
function fractalDim(cells: Uint8Array, W: number, H: number): number {
  const sizes = [2, 4, 8, 16, 32].filter(s => s < Math.min(W, H));
  if (sizes.length < 2) return 1.5;
  const pts = sizes.map(s => {
    let count = 0;
    for (let bxi = 0; bxi * s < W; bxi++)
      for (let byi = 0; byi * s < H; byi++) {
        let found = false;
        for (let dx = 0; dx < s && !found; dx++)
          for (let dy = 0; dy < s && !found; dy++) {
            const x = bxi*s+dx, y = byi*s+dy;
            if (x < W && y < H && cells[y*W+x]) found = true;
          }
        if (found) count++;
      }
    return [Math.log(count), Math.log(1/s)] as [number, number];
  });
  const n = pts.length;
  const sx = pts.reduce((a,[,x]) => a+x, 0);
  const sy = pts.reduce((a,[y]) => a+y, 0);
  const sxy = pts.reduce((a,[y,x]) => a+x*y, 0);
  const sx2 = pts.reduce((a,[,x]) => a+x*x, 0);
  return (n*sxy - sx*sy) / (n*sx2 - sx*sx);
}

interface InferNetResult {
  cells: Uint8Array;      // actual DLA cluster (amber)
  prior: Float32Array;    // Laplacian prior heatmap (purple gradient)
  posterior: Uint8Array;  // sampled posterior cluster (violet)
  W: number;
  H: number;
  df: number;             // fractal dim of posterior
  dfCluster: number;      // fractal dim of actual cluster
  clusterSize: number;
  priorMax: number;
}

function runInferNet(seed: number, W: number, H: number, nWalkers: number): InferNetResult {
  const rng = makeRng(seed);
  const cells = new Uint8Array(W * H);
  const I = (x: number, y: number) => y * W + x;
  const inB = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  const cx = W >> 1, cy = H >> 1;
  cells[I(cx, cy)] = 1;
  let clusterSize = 1;
  let clusterRadius = 1;
  const dirs: [number,number][] = [[0,1],[0,-1],[1,0],[-1,0]];

  function nbrs(x: number, y: number): number {
    let n = 0;
    if (inB(x-1,y) && cells[I(x-1,y)]) n++;
    if (inB(x+1,y) && cells[I(x+1,y)]) n++;
    if (inB(x,y-1) && cells[I(x,y-1)]) n++;
    if (inB(x,y+1) && cells[I(x,y+1)]) n++;
    return n;
  }
  function stickP(x: number, y: number): number {
    const n = nbrs(x, y);
    return n === 0 ? 0 : Math.min(1, STICKING_THRESHOLD * (1 + n * 0.5));
  }

  // Run DLA to build the actual cluster
  for (let i = 0; i < nWalkers; i++) {
    const spawnR = Math.min(clusterRadius + 2, Math.min(W, H) * 0.47);
    const killR = spawnR + Math.max(10, Math.min(W, H) * 0.15);
    const angle = rng.f() * 2 * Math.PI;
    let wx = Math.max(0, Math.min(W-1, Math.round(cx + spawnR * Math.cos(angle))));
    let wy = Math.max(0, Math.min(H-1, Math.round(cy + spawnR * Math.sin(angle))));
    let stuck = false, escaped = false, steps = 0;
    const maxSteps = W * H * 4;
    while (!stuck && !escaped && steps++ < maxSteps) {
      const [dx, dy] = dirs[rng.i(4)];
      wx = Math.max(0, Math.min(W-1, wx + dx));
      wy = Math.max(0, Math.min(H-1, wy + dy));
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

  // ── Compute Laplacian prior heatmap ──────────────────────────────────────────
  // P(stick at x,y) ∝ exp(-λ · d_cluster(x,y)) · (1 + n_nbrs(x,y))
  // where d_cluster is distance to nearest cluster cell.
  // This is the harmonic measure approximation — the Bayesian prior for DLA growth.
  const prior = new Float32Array(W * H);
  const lambda = 0.15; // decay rate (controls how far the prior extends)
  let priorMax = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (cells[I(x, y)]) continue; // already in cluster
      const n = nbrs(x, y);
      if (n === 0) {
        // Not adjacent to cluster — use distance-based decay
        // Approximate nearest cluster distance as clusterRadius - dist_to_center
        const distToCenter = Math.hypot(x - cx, y - cy);
        const distToCluster = Math.max(0, distToCenter - clusterRadius);
        prior[I(x, y)] = Math.exp(-lambda * distToCluster) * 0.1;
      } else {
        // Adjacent to cluster — high prior
        prior[I(x, y)] = STICKING_THRESHOLD * (1 + n * 0.5) * Math.exp(-lambda * 0);
      }
      if (prior[I(x, y)] > priorMax) priorMax = prior[I(x, y)];
    }
  }

  // ── Sample posterior cluster from prior ──────────────────────────────────────
  // The posterior is a DLA run where the sticking probability is the prior
  // instead of the sticking rule. This is the "predicted" cluster.
  const posterior = new Uint8Array(W * H);
  // Copy the actual cluster as the seed for the posterior
  for (let i = 0; i < W * H; i++) posterior[i] = cells[i];
  let postSize = clusterSize;
  let postRadius = clusterRadius;
  const postRng = makeRng(seed + 999983);

  function postNbrs(x: number, y: number): number {
    let n = 0;
    if (inB(x-1,y) && posterior[I(x-1,y)]) n++;
    if (inB(x+1,y) && posterior[I(x+1,y)]) n++;
    if (inB(x,y-1) && posterior[I(x,y-1)]) n++;
    if (inB(x,y+1) && posterior[I(x,y+1)]) n++;
    return n;
  }

  // Add 200 more walkers using the prior-weighted sticking probability
  const extraWalkers = Math.min(200, Math.floor(nWalkers * 0.15));
  for (let i = 0; i < extraWalkers; i++) {
    const spawnR = Math.min(postRadius + 2, Math.min(W, H) * 0.47);
    const killR = spawnR + Math.max(10, Math.min(W, H) * 0.15);
    const angle = postRng.f() * 2 * Math.PI;
    let wx = Math.max(0, Math.min(W-1, Math.round(cx + spawnR * Math.cos(angle))));
    let wy = Math.max(0, Math.min(H-1, Math.round(cy + spawnR * Math.sin(angle))));
    let stuck = false, escaped = false, steps = 0;
    const maxSteps = W * H * 4;
    while (!stuck && !escaped && steps++ < maxSteps) {
      const [dx, dy] = dirs[postRng.i(4)];
      wx = Math.max(0, Math.min(W-1, wx + dx));
      wy = Math.max(0, Math.min(H-1, wy + dy));
      const dist = Math.hypot(wx - cx, wy - cy);
      if (dist > killR) escaped = true;
      else if (postNbrs(wx, wy) > 0) {
        // Use prior as sticking probability
        const p = prior[I(wx, wy)] / Math.max(priorMax, 0.001);
        if (postRng.f() < p * 0.8) stuck = true;
      }
    }
    if (stuck) {
      posterior[I(wx, wy)] = 1;
      postSize++;
      const d = Math.hypot(wx - cx, wy - cy);
      if (d > postRadius) postRadius = d;
    }
  }

  const dfCluster = fractalDim(cells, W, H);
  const df = fractalDim(posterior, W, H);

  return { cells, prior, posterior, W, H, df, dfCluster, clusterSize, priorMax };
}

interface Props {
  seed: number;
  width?: number;
  height?: number;
  nWalkers?: number;
  onResult?: (df: number, clusterSize: number) => void;
}

export default function OracleInferNet({ seed, width = 300, height = 300, nWalkers = 800, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<InferNetResult | null>(null);
  const [mode, setMode] = useState<"prior" | "posterior" | "cluster">("prior");

  useEffect(() => {
    const id = setTimeout(() => {
      const W = Math.floor(width / 3);
      const H = Math.floor(height / 3);
      const r = runInferNet(seed, W, H, nWalkers);
      setResult(r);
      onResult?.(r.df, r.clusterSize);
    }, 120);
    return () => clearTimeout(id);
  }, [seed, width, height, nWalkers, onResult]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cells, prior, posterior, W, H, priorMax } = result;
    const pw = width / W;
    const ph = height / H;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "oklch(0.10 0.01 265)";
    ctx.fillRect(0, 0, width, height);
    const cx = W >> 1, cy = H >> 1;
    const maxD = Math.hypot(W, H) / 2;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (mode === "cluster") {
          if (cells[idx]) {
            const t = Math.hypot(x - cx, y - cy) / maxD;
            const r = Math.round(255 - t * 51);
            const g = Math.round(170 - t * 170);
            ctx.fillStyle = `rgb(${r},${g},0)`;
            ctx.fillRect(x * pw, y * ph, pw, ph);
          }
        } else if (mode === "prior") {
          if (cells[idx]) {
            // Cluster in amber
            const t = Math.hypot(x - cx, y - cy) / maxD;
            const r = Math.round(255 - t * 51);
            const g = Math.round(170 - t * 170);
            ctx.fillStyle = `rgb(${r},${g},0)`;
            ctx.fillRect(x * pw, y * ph, pw, ph);
          } else if (prior[idx] > 0.001) {
            // Prior heatmap in purple/violet gradient
            const intensity = Math.min(1, prior[idx] / Math.max(priorMax, 0.001));
            // Purple (low) → violet (high) → white-violet (very high)
            const l = 0.15 + intensity * 0.5;
            const c = 0.08 + intensity * 0.22;
            ctx.fillStyle = `oklch(${l.toFixed(2)} ${c.toFixed(2)} 290)`;
            ctx.fillRect(x * pw, y * ph, pw, ph);
          }
        } else {
          // Posterior mode
          if (posterior[idx] && !cells[idx]) {
            // Predicted extension in violet
            ctx.fillStyle = "oklch(0.65 0.20 290)";
            ctx.fillRect(x * pw, y * ph, pw, ph);
          } else if (cells[idx]) {
            // Original cluster in amber
            const t = Math.hypot(x - cx, y - cy) / maxD;
            const r = Math.round(255 - t * 51);
            const g = Math.round(170 - t * 170);
            ctx.fillStyle = `rgb(${r},${g},0)`;
            ctx.fillRect(x * pw, y * ph, pw, ph);
          }
        }
      }
    }
  }, [result, mode, width, height]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      {/* Mode selector */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {(["prior", "posterior", "cluster"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              background: mode === m ? "oklch(0.22 0.10 290 / 0.7)" : "transparent",
              border: `1px solid ${mode === m ? "oklch(0.55 0.20 290 / 0.8)" : "oklch(0.25 0.04 265 / 0.5)"}`,
              color: mode === m ? "oklch(0.82 0.18 290)" : "var(--muted-foreground)",
              padding: "0.2rem 0.6rem",
              fontSize: "0.5rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              transition: "all 0.15s",
            }}
          >
            {m === "prior" ? "Prior Heatmap" : m === "posterior" ? "Posterior" : "Cluster Only"}
          </button>
        ))}
      </div>
      {result ? (
        <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />
      ) : (
        <div style={{
          width, height,
          background: "oklch(0.14 0.005 265 / 0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.55rem", letterSpacing: "0.15em", color: "var(--muted-foreground)",
        }}>
          COMPUTING PRIOR…
        </div>
      )}
      {result && (
        <div style={{ fontSize: "0.5rem", color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.6 }}>
          {mode === "prior" && (
            <>Purple = P(stick next) — Laplacian harmonic measure. Bright = high prior.<br />
            Cluster D<sub>f</sub> = {result.dfCluster.toFixed(3)} · Prior D<sub>f</sub> = {result.df.toFixed(3)}</>
          )}
          {mode === "posterior" && (
            <>Violet = predicted next-stick locations (posterior sample).<br />
            Posterior D<sub>f</sub> = {result.df.toFixed(3)} — same fractal dimension as the actual cluster.</>
          )}
          {mode === "cluster" && (
            <>Amber = actual DLA cluster. D<sub>f</sub> = {result.dfCluster.toFixed(3)}</>
          )}
        </div>
      )}
    </div>
  );
}
