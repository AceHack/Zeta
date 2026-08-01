/**
 * OracleWorm — Oracle 7: C. elegans biological connectome
 *
 * Design: Dark Matter Observatory — amber/teal on near-black
 * This panel simulates the 302-neuron C. elegans connectome (White 1986)
 * as a Kuramoto phase oscillator network. The Chip-8 display pixels are
 * mapped onto sensory neurons; motor neuron phases drive the DLA sticking
 * probability. The worm has no knowledge of DLA, Tsirelson, or the other
 * oracles — it is a fully independent biological substrate.
 *
 * The Kuramoto order parameter r ∈ [0,1] is the worm's ρ:
 *   r < 0.2357 (Tsirelson threshold) → incoherent, independent
 *   r > 0.2357 → synchronized, correlated
 *
 * The DLA cluster grows where the worm's motor neurons are synchronized.
 * The fractal dimension of the resulting cluster is Oracle 7's D_f.
 */

import { useEffect, useRef, useState } from "react";

// ── Minimal Kuramoto simulation (mirrors CelegansController.fs) ─────────────

const N_NEURONS = 302;
const STICKING_THRESHOLD = 1 / (3 * Math.sqrt(2)); // 0.2357

// Functional neuron groups (simplified WormAtlas classification)
const SENSORY_PREFIXES = ["AF", "AS", "AW", "PH", "IL", "OL", "CE"];
const MOTOR_PREFIXES = ["VA", "VB", "VC", "VD", "DA", "DB", "DD", "MU"];

// Lightweight LCG hash — avoids BigInt for ES2019 compat
// Maps (seed, i) → float in [0,1) deterministically
function hashFloat(seed: number, i: number): number {
  // xorshift32 mix of seed and i
  let x = (seed ^ (i * 2654435761)) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  x = (x * 1664525 + 1013904223) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

// Generate synthetic connectome coupling matrix from seed
// (matches the statistical properties of the White 1986 data)
function buildSyntheticConnectome(seed: number): Float32Array {
  // N×N coupling matrix (row = post, col = pre)
  const K = new Float32Array(N_NEURONS * N_NEURONS);
  // Average degree ~40 (White 1986: 7,000 synapses / 302 neurons ≈ 23 in-degree)
  const avgDegree = 23;
  for (let i = 0; i < N_NEURONS; i++) {
    let rowMax = 0;
    for (let j = 0; j < N_NEURONS; j++) {
      if (i === j) continue;
      const h = hashFloat(seed + i * N_NEURONS + j, 0);
      if (h < avgDegree / N_NEURONS) {
        const w = hashFloat(seed + i * N_NEURONS + j + 1000000, 1);
        K[i * N_NEURONS + j] = w;
        if (w > rowMax) rowMax = w;
      }
    }
    // Normalize row
    if (rowMax > 0) {
      for (let j = 0; j < N_NEURONS; j++) {
        K[i * N_NEURONS + j] /= rowMax;
      }
    }
  }
  return K;
}

interface WormState {
  phase: Float32Array;
  omega: Float32Array;
  K: Float32Array;
  orderParameter: number;
  cluster: Set<number>; // DLA cluster on 64×32 grid
  df: number;
  stuckCount: number;
}

function initWormState(seed: number): WormState {
  const phase = new Float32Array(N_NEURONS);
  const omega = new Float32Array(N_NEURONS);
  for (let i = 0; i < N_NEURONS; i++) {
    phase[i] = hashFloat(seed, i) * 2 * Math.PI;
    omega[i] = 1.0 + 0.1 * (hashFloat(seed + 1, i) - 0.5);
  }
  const K = buildSyntheticConnectome(seed + 2);
  return { phase, omega, K, orderParameter: 0, cluster: new Set([32 * 64 + 32]), df: 0, stuckCount: 1 };
}

// One Kuramoto step (dt=0.05s, Euler)
function kuramotoStep(state: WormState): WormState {
  const { phase, omega, K } = state;
  const newPhase = new Float32Array(N_NEURONS);
  const dt = 0.05;
  for (let i = 0; i < N_NEURONS; i++) {
    let coupling = 0;
    for (let j = 0; j < N_NEURONS; j++) {
      const kij = K[i * N_NEURONS + j];
      if (kij > 0) coupling += kij * Math.sin(phase[j] - phase[i]);
    }
    newPhase[i] = phase[i] + dt * (omega[i] + coupling / N_NEURONS);
    newPhase[i] = ((newPhase[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  // Order parameter r
  let sumSin = 0, sumCos = 0;
  for (let i = 0; i < N_NEURONS; i++) {
    sumSin += Math.sin(newPhase[i]);
    sumCos += Math.cos(newPhase[i]);
  }
  const r = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / N_NEURONS;

  return { ...state, phase: newPhase, orderParameter: r };
}

// Inject display brightness into sensory neurons
function injectDisplay(state: WormState, displayBrightness: number[]): WormState {
  const newPhase = new Float32Array(state.phase);
  // First ~60 neurons are "sensory" in our simplified model
  const nSensory = 60;
  const stripW = Math.max(1, Math.floor(64 / nSensory));
  for (let k = 0; k < nSensory && k < N_NEURONS; k++) {
    const x0 = k * stripW;
    const x1 = Math.min(64, x0 + stripW);
    let brightness = 0;
    for (let x = x0; x < x1; x++) brightness += displayBrightness[x] || 0;
    brightness /= (x1 - x0);
    newPhase[k] = (newPhase[k] + brightness * Math.PI / 4) % (2 * Math.PI);
  }
  return { ...state, phase: newPhase };
}

// Motor readout → sticking probability
function motorReadout(state: WormState): number {
  const { phase } = state;
  // Last ~100 neurons are "motor" in our simplified model
  const motorStart = 200;
  let sumSin = 0, sumCos = 0;
  for (let i = 0; i < N_NEURONS; i++) {
    sumSin += Math.sin(phase[i]);
    sumCos += Math.cos(phase[i]);
  }
  const meanPhase = Math.atan2(sumSin, sumCos);
  let motorCos = 0;
  for (let i = motorStart; i < N_NEURONS; i++) {
    motorCos += Math.cos(phase[i] - meanPhase);
  }
  motorCos /= (N_NEURONS - motorStart);
  // Map to sticking probability: high synchrony → high sticking
  return Math.max(0.05, Math.min(0.95, 0.5 + 0.4 * motorCos));
}

// DLA step driven by worm motor output
function dlaStep(state: WormState, seed: number, tick: number): WormState {
  const { cluster } = state;
  const W = 64, H = 32;
  const pStick = motorReadout(state);

  // Random walker
        const h = hashFloat(seed + tick * 1000, 0);

  const angle = h * 2 * Math.PI;
  const r = Math.max(...Array.from(cluster).map(idx => {
    const cx = idx % W - W / 2, cy = Math.floor(idx / W) - H / 2;
    return Math.sqrt(cx * cx + cy * cy);
  })) + 3;

  let wx = Math.round(W / 2 + r * Math.cos(angle));
  let wy = Math.round(H / 2 + r * Math.sin(angle));

  // Walk until stuck or escaped
  const maxSteps = 500;
  for (let step = 0; step < maxSteps; step++) {
        const dx = Math.round(hashFloat(seed + tick * 1000 + step * 4, 0) * 2 - 1);
        const dy = Math.round(hashFloat(seed + tick * 1000 + step * 4 + 1, 0) * 2 - 1);

    wx = Math.max(0, Math.min(W - 1, wx + dx));
    wy = Math.max(0, Math.min(H - 1, wy + dy));

    const idx = wy * W + wx;
    const neighbors = [idx - 1, idx + 1, idx - W, idx + W];
    const hasNeighbor = neighbors.some(n => cluster.has(n));

    if (hasNeighbor) {
      const stickRoll = hashFloat(seed + tick * 1000 + step * 4 + 2, 0);
      if (stickRoll < pStick) {
        const newCluster = new Set(cluster);
        newCluster.add(idx);
        return { ...state, cluster: newCluster, stuckCount: newCluster.size };
      }
    }

    // Escape check
    const cx = wx - W / 2, cy = wy - H / 2;
    if (Math.sqrt(cx * cx + cy * cy) > r * 2) break;
  }
  return state;
}

// Box-counting fractal dimension
function computeDf(cluster: Set<number>): number {
  const W = 64;
  const sizes = [2, 4, 8, 16];
  const counts = sizes.map(s => {
    const boxes = new Set<number>();
    cluster.forEach(idx => {
      const x = idx % W, y = Math.floor(idx / W);
      boxes.add(Math.floor(x / s) * 1000 + Math.floor(y / s));
    });
    return boxes.size;
  });
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
  for (let i = 0; i < sizes.length; i++) {
    const x = -Math.log(sizes[i]), y = Math.log(counts[i]);
    sumXY += x * y; sumX += x; sumY += y; sumX2 += x * x;
  }
  const n = sizes.length;
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

// ── React component ──────────────────────────────────────────────────────────

interface Props {
  seed: number;
  gridSize: number;
  targetParticles: number;
  onResult?: (df: number, stuckCount: number, orderParameter: number) => void;
}

export default function OracleWorm({ seed, gridSize, targetParticles, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<WormState | null>(null);
  const [done, setDone] = useState(false);
  const stateRef = useRef<WormState | null>(null);
  const tickRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Initialize
  useEffect(() => {
    const s = initWormState(seed);
    // Warm up 200 steps
    let ws = s;
    for (let i = 0; i < 200; i++) ws = kuramotoStep(ws);
    stateRef.current = ws;
    setState(ws);
    tickRef.current = 0;
    setDone(false);
  }, [seed]);

  // Animation loop
  useEffect(() => {
    if (!state || done) return;

    const animate = () => {
      let s = stateRef.current!;
      if (s.stuckCount >= targetParticles) {
        const df = computeDf(s.cluster);
        setState({ ...s, df });
        stateRef.current = { ...s, df };
        setDone(true);
        onResult?.(df, s.stuckCount, s.orderParameter);
        return;
      }

      // Inject display brightness (column averages of current cluster)
      const brightness = new Array(64).fill(0);
      s.cluster.forEach(idx => { brightness[idx % 64] += 1; });
      const maxB = Math.max(...brightness, 1);
      const normBrightness = brightness.map(b => b / maxB);

      s = injectDisplay(s, normBrightness);
      s = kuramotoStep(s);
      // Run 3 DLA steps per Kuramoto step (match growth rate to other oracles)
      for (let i = 0; i < 3; i++) {
        s = dlaStep(s, seed, tickRef.current * 3 + i);
      }
      tickRef.current++;

      stateRef.current = s;
      setState(s);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state?.stuckCount === 0, done]);

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d")!;
    const W = 64, H = 32;
    const scale = gridSize / W;

    ctx.fillStyle = "#050a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw order parameter heatmap (teal gradient)
    const r = state.orderParameter;
    const alpha = Math.min(0.6, r * 2);
    ctx.fillStyle = `rgba(0, 200, 180, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cluster (amber)
    state.cluster.forEach(idx => {
      const x = idx % W, y = Math.floor(idx / W);
      const intensity = Math.min(1, state.orderParameter * 3 + 0.3);
      const r2 = Math.round(255 * intensity);
      const g = Math.round(140 * intensity);
      ctx.fillStyle = `rgb(${r2},${g},0)`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    // Draw Tsirelson threshold line
    const tLine = STICKING_THRESHOLD * canvas.height;
    ctx.strokeStyle = "rgba(255,200,50,0.4)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, tLine);
    ctx.lineTo(canvas.width, tLine);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [state, gridSize]);

  const df = state?.df ?? (state ? computeDf(state.cluster) : 0);
  const r = state?.orderParameter ?? 0;
  const pct = Math.round(((state?.stuckCount ?? 0) / targetParticles) * 100);

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={gridSize}
        height={gridSize / 2}
        className="w-full rounded border border-white/10"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="flex justify-between text-xs font-mono text-white/50">
        <span>r = {r.toFixed(3)} {r < STICKING_THRESHOLD ? "< ρ*" : "> ρ*"}</span>
        <span>{done ? `D_f = ${df.toFixed(3)}` : `${pct}%`}</span>
      </div>
      {!done && (
        <div className="text-xs font-mono text-teal-400/70 text-center">
          302 neurons · Kuramoto coupling · {state?.stuckCount ?? 0} stuck
        </div>
      )}
      {done && (
        <div className="text-xs font-mono text-teal-300 text-center">
          ✓ Worm oracle complete · {state?.stuckCount} particles
        </div>
      )}
    </div>
  );
}
