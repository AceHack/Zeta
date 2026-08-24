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
 *   r < 0.2357 (the "Tsirelson threshold") → incoherent, independent
 *   r > 0.2357 → synchronized, correlated
 *
 * ⚠ NAME IS A MISNOMER (Soraya audit, 2026-08-01). 0.2357 = 1/(3√2) is NOT the Tsirelson
 * bound. Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator (src/Core/Tsirelson.fs);
 * there is no Tsirelson bound on a correlation coefficient. 1/(3√2) is ρ* / √2 — the Condorcet
 * limit ρ* = 1/3 pushed through the FREELY CHOSEN linear map ρ = S/12 — a design parameter
 * chosen for homoiconicity, not derived. See
 * docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md
 * The value is correct as a coherence cutoff; only the name oversells. Do not read it as physics.
 *
 * The DLA cluster grows where the worm's motor neurons are synchronized.
 * The fractal dimension of the resulting cluster is Oracle 7's D_f.
 *
 * Real connectome: White 1986 (521 neurons, 10,340 synapses) loaded from
 * /celegans-connectome.json at runtime. Falls back to synthetic if unavailable.
 */

import { useEffect, useRef, useState } from "react";

// ── Real connectome loader ────────────────────────────────────────────────────
interface ConnectomeData {
  neurons: string[];
  edges: [number, number, number, number][]; // [pre_idx, post_idx, weight, is_electrical]
}
let _connectomeCache: ConnectomeData | null = null;
async function loadConnectome(): Promise<ConnectomeData> {
  if (_connectomeCache) return _connectomeCache;
  const resp = await fetch("/celegans-connectome.json");
  _connectomeCache = await resp.json() as ConnectomeData;
  return _connectomeCache;
}
interface ConnectomeStats {
  nNeurons: number; nEdges: number; nSensory: number; nMotor: number;
  maxDegree: number; meanDegree: number; hubNeuron: string;
}
function buildRealConnectome(data: ConnectomeData): {
  K: Float32Array; nNeurons: number; sensoryIdx: number[]; motorIdx: number[];
  stats: ConnectomeStats;
} {
  const N = data.neurons.length;
  const K = new Float32Array(N * N);
  const sensoryPrefixes = ["AFD","ASE","ASH","ASI","ASJ","ASK","AWA","AWB","AWC","ADF","ADL","AQR","PHA","PHB","IL1","IL2","OLL","OLQ","CEP","ADE","PDE","PVD","FLP"];
  const motorPrefixes = ["VA","VB","VC","VD","DA","DB","DD","AS","MU"];
  const sensoryIdx: number[] = [];
  const motorIdx: number[] = [];
  data.neurons.forEach((name, i) => {
    if (sensoryPrefixes.some(p => name.startsWith(p))) sensoryIdx.push(i);
    if (motorPrefixes.some(p => name.startsWith(p))) motorIdx.push(i);
  });
  const degreeIn = new Array(N).fill(0);
  const rowMax = new Float32Array(N);
  for (const [pre, post, w] of data.edges) {
    K[post * N + pre] += w;
    degreeIn[post]++;
    if (K[post * N + pre] > rowMax[post]) rowMax[post] = K[post * N + pre];
  }
  for (let i = 0; i < N; i++) {
    if (rowMax[i] > 0) for (let j = 0; j < N; j++) K[i * N + j] /= rowMax[i];
  }
  const maxDegree = Math.max(...degreeIn);
  const meanDegree = degreeIn.reduce((a, b) => a + b, 0) / N;
  const hubIdx = degreeIn.indexOf(maxDegree);
  const stats: ConnectomeStats = {
    nNeurons: N, nEdges: data.edges.length,
    nSensory: sensoryIdx.length, nMotor: motorIdx.length,
    maxDegree, meanDegree: Math.round(meanDegree * 10) / 10,
    hubNeuron: data.neurons[hubIdx] ?? "?"
  };
  return { K, nNeurons: N, sensoryIdx, motorIdx, stats };
}

// ── Minimal Kuramoto simulation (mirrors CelegansController.fs) ─────────────

const N_NEURONS = 302;
const TSIRELSON = 1 / (3 * Math.sqrt(2)); // 0.2357

// Lightweight LCG hash — avoids BigInt for ES2019 compat
function hashFloat(seed: number, i: number): number {
  let x = (seed ^ (i * 2654435761)) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  x = (x * 1664525 + 1013904223) >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

// Generate synthetic connectome coupling matrix from seed (fallback)
function buildSyntheticConnectome(seed: number): Float32Array {
  const K = new Float32Array(N_NEURONS * N_NEURONS);
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
    if (rowMax > 0) for (let j = 0; j < N_NEURONS; j++) K[i * N_NEURONS + j] /= rowMax;
  }
  return K;
}

interface WormState {
  phase: Float32Array;
  omega: Float32Array;
  K: Float32Array;
  nNeurons: number;
  kGlobal: number;
  orderParameter: number;
  cluster: Set<number>;
  df: number;
  stuckCount: number;
  // Neuron activity heatmap: phase per neuron mapped to 64×32 grid
  neuronPhases: Float32Array;
}

function initWormState(seed: number, K?: Float32Array, nNeurons?: number): WormState {
  const N = nNeurons ?? N_NEURONS;
  const phase = new Float32Array(N);
  const omega = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    phase[i] = hashFloat(seed, i) * 2 * Math.PI;
    omega[i] = 1.0 + 0.1 * (hashFloat(seed + 1, i) - 0.5);
  }
  const useK = K ?? buildSyntheticConnectome(seed + 2);
  return {
    phase, omega, K: useK, nNeurons: N, kGlobal: 1.0,
    orderParameter: 0,
    cluster: new Set([16 * 64 + 32]),
    df: 0, stuckCount: 1,
    neuronPhases: new Float32Array(N),
  };
}

// One Kuramoto step (dt=0.05s, Euler)
function kuramotoStep(state: WormState): WormState {
  const { phase, omega, K, nNeurons: N } = state;
  const newPhase = new Float32Array(N);
  const dt = 0.05;
  for (let i = 0; i < N; i++) {
    let coupling = 0;
    for (let j = 0; j < N; j++) {
      const kij = K[i * N + j];
      if (kij > 0) coupling += kij * Math.sin(phase[j] - phase[i]);
    }
    newPhase[i] = phase[i] + dt * (omega[i] + state.kGlobal * coupling / N);
    newPhase[i] = ((newPhase[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }
  let sumSin = 0, sumCos = 0;
  for (let i = 0; i < N; i++) { sumSin += Math.sin(newPhase[i]); sumCos += Math.cos(newPhase[i]); }
  const r = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / N;
  return { ...state, phase: newPhase, orderParameter: r, neuronPhases: newPhase };
}

// Inject display brightness into sensory neurons
function injectDisplay(state: WormState, displayBrightness: number[]): WormState {
  const newPhase = new Float32Array(state.phase);
  const nSensory = Math.min(60, state.nNeurons);
  const stripW = Math.max(1, Math.floor(64 / nSensory));
  for (let k = 0; k < nSensory; k++) {
    const x0 = k * stripW;
    const x1 = Math.min(64, x0 + stripW);
    let brightness = 0;
    for (let x = x0; x < x1; x++) brightness += displayBrightness[x] ?? 0;
    brightness /= (x1 - x0);
    newPhase[k] = (newPhase[k] + brightness * Math.PI / 4) % (2 * Math.PI);
  }
  return { ...state, phase: newPhase };
}

// Motor readout → sticking probability
function motorReadout(state: WormState): number {
  const { phase, nNeurons: N } = state;
  const motorStart = Math.floor(N * 0.66);
  let sumSin = 0, sumCos = 0;
  for (let i = 0; i < N; i++) { sumSin += Math.sin(phase[i]); sumCos += Math.cos(phase[i]); }
  const meanPhase = Math.atan2(sumSin, sumCos);
  let motorCos = 0;
  for (let i = motorStart; i < N; i++) motorCos += Math.cos(phase[i] - meanPhase);
  motorCos /= (N - motorStart);
  return Math.max(0.05, Math.min(0.95, 0.5 + 0.4 * motorCos));
}

// DLA step driven by worm motor output
function dlaStep(state: WormState, seed: number, tick: number): WormState {
  const { cluster } = state;
  const W = 64, H = 32;
  const pStick = motorReadout(state);
  const h = hashFloat(seed + tick * 1000, 0);
  const angle = h * 2 * Math.PI;
  const r = Math.max(...Array.from(cluster).map(idx => {
    const cx = idx % W - W / 2, cy = Math.floor(idx / W) - H / 2;
    return Math.sqrt(cx * cx + cy * cy);
  })) + 3;
  let wx = Math.round(W / 2 + r * Math.cos(angle));
  let wy = Math.round(H / 2 + r * Math.sin(angle));
  for (let step = 0; step < 500; step++) {
    const dx = Math.round(hashFloat(seed + tick * 1000 + step * 4, 0) * 2 - 1);
    const dy = Math.round(hashFloat(seed + tick * 1000 + step * 4 + 1, 0) * 2 - 1);
    wx = Math.max(0, Math.min(W - 1, wx + dx));
    wy = Math.max(0, Math.min(H - 1, wy + dy));
    const idx = wy * W + wx;
    if ([idx-1, idx+1, idx-W, idx+W].some(n => cluster.has(n))) {
      if (hashFloat(seed + tick * 1000 + step * 4 + 2, 0) < pStick) {
        const newCluster = new Set(cluster);
        newCluster.add(idx);
        return { ...state, cluster: newCluster, stuckCount: newCluster.size };
      }
    }
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
  couplingK?: number; // Kuramoto global coupling constant (default 1.0)
}

// Top WormAtlas neuron names by functional role (for glow labels)
const WORM_NEURON_NAMES = [
  "ASEL","ASER","AWC","AWB","AFD","ASE","ASH","ASI","ASJ","ASK",
  "AIY","AIZ","RIA","RIB","AVA","AVB","AVD","AVE","PVC","DVA",
  "VA1","VB1","DA1","DB1","DD1","AS1","MU","SAA","SAB","SMB"
];

export default function OracleWorm({ seed, gridSize, targetParticles, onResult, couplingK: initK = 1.0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<WormState | null>(null);
  const [done, setDone] = useState(false);
  const [connectomeSource, setConnectomeSource] = useState<"loading" | "real" | "synthetic">("loading");
  const [connectomeStats, setConnectomeStats] = useState<ConnectomeStats | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [couplingK, setCouplingK] = useState(initK);
  const couplingKRef = useRef(initK);
  const stateRef = useRef<WormState | null>(null);
  const tickRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Initialize — try real connectome first, fall back to synthetic
  useEffect(() => {
    setConnectomeSource("loading");
    loadConnectome().then(data => {
      const { K, nNeurons, stats } = buildRealConnectome(data);
      const phase = new Float32Array(nNeurons);
      const omega = new Float32Array(nNeurons);
      for (let i = 0; i < nNeurons; i++) {
        phase[i] = hashFloat(seed, i) * 2 * Math.PI;
        omega[i] = 1.0 + 0.1 * (hashFloat(seed + 1, i) - 0.5);
      }
      let ws: WormState = {
        phase, omega, K, nNeurons,
        kGlobal: couplingKRef.current,
        orderParameter: 0,
        cluster: new Set([16 * 64 + 32]),
        df: 0, stuckCount: 1,
        neuronPhases: new Float32Array(nNeurons),
      };
      for (let i = 0; i < 200; i++) ws = kuramotoStep(ws);
      stateRef.current = ws;
      setState(ws);
      tickRef.current = 0;
      setDone(false);
      setConnectomeSource("real");
      setConnectomeStats(stats);
    }).catch(() => {
      const ws0 = initWormState(seed);
      let ws = ws0;
      for (let i = 0; i < 200; i++) ws = kuramotoStep(ws);
      stateRef.current = ws;
      setState(ws);
      tickRef.current = 0;
      setDone(false);
      setConnectomeSource("synthetic");
    });
  }, [seed]);

  // Update kGlobal in running state when slider changes
  useEffect(() => {
    couplingKRef.current = couplingK;
    if (stateRef.current) {
      stateRef.current = { ...stateRef.current, kGlobal: couplingK };
    }
  }, [couplingK]);

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
      const brightness = new Array(64).fill(0);
      s.cluster.forEach(idx => { brightness[idx % 64] += 1; });
      const maxB = Math.max(...brightness, 1);
      const normBrightness = brightness.map(b => b / maxB);
      s = injectDisplay(s, normBrightness);
      s = kuramotoStep(s);
      for (let i = 0; i < 3; i++) s = dlaStep(s, seed, tickRef.current * 3 + i);
      tickRef.current++;
      stateRef.current = s;
      setState(s);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state?.stuckCount === 0, done]);

  // Render to canvas — with neuron activity heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d")!;
    const W = 64, H = 32;
    const scale = gridSize / W;
    const N = state.nNeurons;

    ctx.fillStyle = "#050a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── Neuron activity heatmap ──────────────────────────────────────────────
    const phaseImg = ctx.createImageData(W, H);
    for (let ni = 0; ni < N; ni++) {
      const px = ni % W;
      const py = Math.floor(ni / W) % H;
      const phi = state.neuronPhases[ni] ?? 0;
      const t = phi / (2 * Math.PI); // 0→1
      const rr = Math.round(t < 0.5 ? 0 : (t - 0.5) * 2 * 255);
      const gg = Math.round(t < 0.5 ? t * 2 * 180 : (1 - (t - 0.5) * 2) * 180);
      const bb = Math.round(t < 0.5 ? (1 - t * 2) * 200 : 0);
      const pidx = (py * W + px) * 4;
      phaseImg.data[pidx] = rr;
      phaseImg.data[pidx + 1] = gg;
      phaseImg.data[pidx + 2] = bb;
      phaseImg.data[pidx + 3] = 80; // semi-transparent
    }
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = W; tmpCanvas.height = H;
    tmpCanvas.getContext("2d")!.putImageData(phaseImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height);

    const r = state.orderParameter;
    const alpha = Math.min(0.3, r * 1.2);
    ctx.fillStyle = `rgba(0, 200, 180, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── DLA cluster — retro-phosphor amber glow ──────────────────────────────
    state.cluster.forEach(idx => {
      const x = idx % W, y = Math.floor(idx / W);
      const intensity = Math.min(1, state.orderParameter * 3 + 0.3);
      const r2 = Math.round(255 * intensity);
      const g = Math.round(140 * intensity);
      ctx.fillStyle = `rgb(${r2},${g},0)`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });

    // ── Top-10 glowing neuron dots (phosphor CRT style) ──────────────────────
    // Find top-10 neurons by phase magnitude (most active)
    const phases = Array.from(state.neuronPhases);
    const topIdx = phases
      .map((p, i) => ({ p, i }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 10)
      .map(x => x.i);
    topIdx.forEach((ni, rank) => {
      const px = (ni % W) * scale + scale / 2;
      const py = (Math.floor(ni / W) % H) * scale + scale / 2;
      const phi = phases[ni] ?? 0;
      const brightness = 0.4 + 0.6 * (phi / (2 * Math.PI));
      // Phosphor glow: radial gradient bloom
      const glowR = scale * 2.5;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      const alpha2 = Math.round(brightness * 255).toString(16).padStart(2, "0");
      grad.addColorStop(0, `#ffcc00${alpha2}`);   // bright amber core
      grad.addColorStop(0.3, `#ff8800${Math.round(brightness * 120).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, "rgba(255,136,0,0)");
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
      // Neuron name label (top-5 only to avoid clutter)
      if (rank < 5) {
        const name = WORM_NEURON_NAMES[ni % WORM_NEURON_NAMES.length] ?? `N${ni}`;
        ctx.font = `${Math.max(5, scale * 0.7)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(255,204,0,${brightness * 0.9})`;
        ctx.fillText(name, px + scale * 0.5, py - scale * 0.3);
      }
    });

    // ── CRT scanline overlay ─────────────────────────────────────────────────
    for (let sy = 0; sy < canvas.height; sy += 2) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, sy, canvas.width, 1);
    }

    // ── Tsirelson threshold line (phosphor green dashes) ─────────────────────
    const tLine = TSIRELSON * canvas.height;
    ctx.strokeStyle = "rgba(0,255,100,0.35)";
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
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={gridSize}
          height={gridSize / 2}
          className="w-full rounded border border-white/10"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Retro-phosphor legend */}
        <div style={{ position: "absolute", top: 2, right: 4, fontSize: "0.55rem", fontFamily: '"JetBrains Mono", monospace', color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>
          <div style={{ color: "#60a5fa" }}>● phase=0</div>
          <div style={{ color: "#14b8a6" }}>● phase=π/2</div>
          <div style={{ color: "#ffcc00" }}>● phase=π (hot)</div>
        </div>
        {/* CRT corner vignette */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
          background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%)" }} />
      </div>
      {/* Kuramoto coupling strength slider */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.6rem", fontFamily: '"JetBrains Mono", monospace' }}>
        <span style={{ color: "#64748b", minWidth: "4.5rem" }}>K coupling:</span>
        <input
          type="range" min="0" max="3" step="0.05" value={couplingK}
          onChange={e => setCouplingK(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#f59e0b", cursor: "pointer" }}
        />
        <span style={{ color: couplingK > 1.5 ? "#f59e0b" : couplingK < 0.5 ? "#60a5fa" : "#14b8a6", minWidth: "2.5rem", textAlign: "right" }}>
          {couplingK.toFixed(2)}
        </span>
        <span style={{ color: "#475569", fontSize: "0.5rem" }}>
          {couplingK < 0.3 ? "incoherent" : couplingK > 2.0 ? "locked" : "partial"}
        </span>
      </div>
      <div className="flex justify-between text-xs font-mono text-white/50">
        <span>r = {r.toFixed(3)} {r < TSIRELSON ? "< ρ*" : "> ρ*"}</span>
        <span>{done ? `D_f = ${df.toFixed(3)}` : `${pct}%`}</span>
      </div>
      {/* Connectome source badge with tooltip */}
      <div style={{ position: "relative", textAlign: "center" }}>
        <span
          style={{ fontSize: "0.6rem", fontFamily: "monospace", cursor: "pointer",
            color: connectomeSource === "real" ? "#14b8a6" : connectomeSource === "synthetic" ? "#f59e0b" : "#64748b" }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {connectomeSource === "loading" && "⏳ Loading White 1986 connectome…"}
          {connectomeSource === "real" && "✓ Real connectome — White 1986 ⓘ"}
          {connectomeSource === "synthetic" && "⚠ Synthetic connectome ⓘ"}
        </span>
        {showTooltip && connectomeStats && (
          <div style={{
            position: "absolute", bottom: "1.4rem", left: "50%", transform: "translateX(-50%)",
            background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
            padding: "0.5rem 0.75rem", zIndex: 50, minWidth: 200, textAlign: "left",
            fontSize: "0.65rem", fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.6)"
          }}>
            <div style={{ color: "#14b8a6", fontWeight: "bold", marginBottom: "0.25rem" }}>White 1986 Connectome</div>
            <div>Neurons: <span style={{ color: "#e2e8f0" }}>{connectomeStats.nNeurons}</span></div>
            <div>Synapses: <span style={{ color: "#e2e8f0" }}>{connectomeStats.nEdges.toLocaleString()}</span></div>
            <div>Sensory: <span style={{ color: "#60a5fa" }}>{connectomeStats.nSensory}</span> · Motor: <span style={{ color: "#f59e0b" }}>{connectomeStats.nMotor}</span></div>
            <div>Mean in-degree: <span style={{ color: "#e2e8f0" }}>{connectomeStats.meanDegree}</span></div>
            <div>Max in-degree: <span style={{ color: "#e2e8f0" }}>{connectomeStats.maxDegree}</span> ({connectomeStats.hubNeuron})</div>
            <div style={{ marginTop: "0.25rem", color: "#64748b", fontSize: "0.6rem" }}>Source: White et al. 1986, OpenWorm c302</div>
          </div>
        )}
        {showTooltip && connectomeSource === "synthetic" && (
          <div style={{
            position: "absolute", bottom: "1.4rem", left: "50%", transform: "translateX(-50%)",
            background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
            padding: "0.5rem 0.75rem", zIndex: 50, minWidth: 180, textAlign: "left",
            fontSize: "0.65rem", fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.6,
          }}>
            <div style={{ color: "#f59e0b", fontWeight: "bold" }}>Synthetic Connectome</div>
            <div>Statistical approximation of White 1986</div>
            <div>Mean in-degree ≈ 23 (LCG hash)</div>
            <div style={{ color: "#64748b", fontSize: "0.6rem", marginTop: "0.25rem" }}>Real data unavailable — check /celegans-connectome.json</div>
          </div>
        )}
      </div>
      {!done && (
        <div className="text-xs font-mono text-teal-400/70 text-center">
          {connectomeStats ? connectomeStats.nNeurons : N_NEURONS} neurons · Kuramoto coupling · {state?.stuckCount ?? 0} stuck
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
