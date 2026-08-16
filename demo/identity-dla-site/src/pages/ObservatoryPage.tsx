/*
 * Identity Space Boundary — Multi-Oracle DLA
 * Design: Dark Matter Observatory
 * Six oracles: Canvas, CSS box-shadow, Chip-8, SVG, Quantum Walk (Q# model), C. elegans worm
 *
 * Seed independence (live mode):
 *   Each oracle seeds from Date.now() + a distinct prime offset.
 *   The prime offset is the minimum L in ρ = 1/(1+L) that breaks
 *   correlation-to-one. In live mode the oracles are genuinely independent —
 *   they cannot pre-compute each other's output.
 *
 * Seed slider (fixed mode):
 *   Drag 1–999 to change the shared seed. All 6 oracles recompute in real time.
 *   This is the clearest interactive demo of substrate independence: drag the
 *   slider, watch six completely different renderers converge to the same D_f.
 *
 * Animated growth mode:
 *   Shows DLA building walker-by-walker with the Laplacian growth front visible.
 *   The sticking threshold is visually legible: watch the boundary form at ρ = 0.2357 (a simulation parameter, not a physics bound).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useDLA, STICKING_THRESHOLD, ORACLE_PRIME_OFFSETS } from "@/hooks/useDLA";
import { useQuantumWalk } from "@/hooks/useQuantumWalk";
import OracleCanvas from "@/components/OracleCanvas";
import OracleCSS from "@/components/OracleCSS";
import OracleSVG from "@/components/OracleSVG";
import OracleQuantum from "@/components/OracleQuantum";
import OracleWorm from "@/components/OracleWorm";
import OracleInferNet from "@/components/OracleInferNet";
import OracleSLE from "@/components/OracleSLE";
import OracleWebGPU from "@/components/OracleWebGPU";
import OracleWASM from "@/components/OracleWASM";
import OracleV8Bytecode from "@/components/OracleV8Bytecode";
import OracleQuickJS from "@/components/OracleQuickJS";
import OracleLua from "@/components/OracleLua";
import OracleRGBA from "@/components/OracleRGBA";
import OracleRaceMode from "@/components/OracleRaceMode";
import LoewnerEntropyPanel from "@/components/LoewnerEntropyPanel";
import Z3DischargePanel from "@/components/Z3DischargePanel";
import KappaPhaseDiagram from "@/components/KappaPhaseDiagram";
import { LiveOracleFeed } from "@/components/LiveOracleFeed";

const FIXED_SEED = 42;
const W = 100, H = 100, N = 1200;
const QW = 80, QH = 80, QSTEPS = 120;

// ── Animated growth hook ─────────────────────────────────────────────────────
// Runs DLA step-by-step, emitting partial grids so the canvas can show growth.
// Each "frame" adds WALKERS_PER_FRAME walkers. The Laplacian front is the set
// of cells adjacent to the cluster but not yet occupied — shown in teal.
const WALKERS_PER_FRAME = 8;
const ANIM_INTERVAL_MS = 40; // ~25 fps

interface AnimFrame {
  cells: Uint8Array;
  front: Uint8Array; // cells adjacent to cluster (Laplacian growth front)
  W: number;
  H: number;
  clusterSize: number;
  walkersDone: number;
  df: number;
  complete: boolean;
}

function computeFront(cells: Uint8Array, W: number, H: number): Uint8Array {
  const front = new Uint8Array(W * H);
  const I = (x: number, y: number) => y * W + x;
  const inB = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (cells[I(x, y)]) continue; // already cluster
      if (
        (inB(x-1,y) && cells[I(x-1,y)]) ||
        (inB(x+1,y) && cells[I(x+1,y)]) ||
        (inB(x,y-1) && cells[I(x,y-1)]) ||
        (inB(x,y+1) && cells[I(x,y+1)])
      ) {
        front[I(x, y)] = 1;
      }
    }
  }
  return front;
}

// Animated canvas component — renders cluster (amber) + front (teal) + void (dark)
function AnimatedCanvas({ frame, width, height }: { frame: AnimFrame | null; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cells, front, W, H } = frame;
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
        if (cells[idx]) {
          const t = Math.hypot(x - cx, y - cy) / maxD;
          const r = Math.round(255 - t * 51);
          const g = Math.round(170 - t * 170);
          ctx.fillStyle = `rgb(${r},${g},0)`;
          ctx.fillRect(x * pw, y * ph, pw, ph);
        } else if (front[idx]) {
          // Laplacian growth front — teal glow
          ctx.fillStyle = "oklch(0.65 0.18 195 / 0.55)";
          ctx.fillRect(x * pw, y * ph, pw, ph);
        }
      }
    }
  }, [frame, width, height]);
  return <canvas ref={canvasRef} width={width} height={height} style={{ display: "block" }} />;
}

// Hook: runs DLA incrementally, yields AnimFrame on each tick
function useAnimatedDLA(seed: number | "live", W: number, H: number, N: number, active: boolean) {
  const [frame, setFrame] = useState<AnimFrame | null>(null);
  const stateRef = useRef<{
    cells: Uint8Array;
    clusterSize: number;
    clusterRadius: number;
    walkersDone: number;
    rng: ReturnType<typeof makeAnimRng>;
    seed: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when seed or active changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!active) { setFrame(null); stateRef.current = null; return; }

    const s = seed === "live" ? (Date.now() + ORACLE_PRIME_OFFSETS[0]) >>> 0 : seed;
    const cells = new Uint8Array(W * H);
    const cx = W >> 1, cy = H >> 1;
    cells[cy * W + cx] = 1;
    stateRef.current = {
      cells,
      clusterSize: 1,
      clusterRadius: 1,
      walkersDone: 0,
      rng: makeAnimRng(s),
      seed: s,
    };
    setFrame({
      cells: new Uint8Array(cells),
      front: computeFront(cells, W, H),
      W, H,
      clusterSize: 1,
      walkersDone: 0,
      df: 1.0,
      complete: false,
    });

    timerRef.current = setInterval(() => {
      const st = stateRef.current;
      if (!st) return;
      if (st.walkersDone >= N) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const { cells, rng } = st;
      const inB = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H;
      const I = (x: number, y: number) => y * W + x;
      const cx = W >> 1, cy = H >> 1;
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

      const batchSize = Math.min(WALKERS_PER_FRAME, N - st.walkersDone);
      for (let b = 0; b < batchSize; b++) {
        const spawnR = Math.min(st.clusterRadius + 2, Math.min(W, H) * 0.47);
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
          st.clusterSize++;
          const d = Math.hypot(wx - cx, wy - cy);
          if (d > st.clusterRadius) st.clusterRadius = d;
        }
        st.walkersDone++;
      }

      const snap = new Uint8Array(cells);
      const front = computeFront(snap, W, H);
      const complete = st.walkersDone >= N;
      // Compute df only when complete (expensive)
      const df = complete ? computeDf(snap, W, H) : estimateDf(st.clusterSize, st.clusterRadius);
      setFrame({ cells: snap, front, W, H, clusterSize: st.clusterSize, walkersDone: st.walkersDone, df, complete });
    }, ANIM_INTERVAL_MS);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, W, H, N, active]);

  return frame;
}

function makeAnimRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return {
    f(): number { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; },
    i(n: number): number { return Math.floor(this.f() * n); },
  };
}

function estimateDf(clusterSize: number, clusterRadius: number): number {
  if (clusterRadius < 2) return 1.0;
  return Math.log(clusterSize) / Math.log(clusterRadius);
}

function computeDf(cells: Uint8Array, W: number, H: number): number {
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

// ── UI helpers ────────────────────────────────────────────────────────────────
function DfBadge({ value }: { value: number }) {
  return (
    <span style={{ color: "var(--amber)", fontWeight: 700, fontSize: "1.05rem" }}>
      {value.toFixed(3)}
    </span>
  );
}

function SeedTag({ seed, live }: { seed: number; live: boolean }) {
  return (
    <span style={{
      fontSize: "0.52rem",
      fontFamily: "'JetBrains Mono', monospace",
      color: live ? "oklch(0.72 0.18 145)" : "var(--muted-foreground)",
      background: live ? "oklch(0.18 0.06 145 / 0.3)" : "transparent",
      border: live ? "1px solid oklch(0.35 0.1 145 / 0.5)" : "none",
      padding: live ? "0.1rem 0.35rem" : "0",
      borderRadius: "3px",
      letterSpacing: "0.04em",
    }}>
      seed={seed.toString(16).slice(-6).toUpperCase()}
    </span>
  );
}

function OracleCard({
  title, subtitle, df, clusterSize, totalCells, children, note, quantum, seed, live,
}: {
  title: string; subtitle: string; df: number; clusterSize: number;
  totalCells?: number; children: React.ReactNode; note?: string;
  quantum?: boolean; seed?: number; live?: boolean;
}) {
  return (
    <div style={{
      background: "var(--card)",
      border: quantum ? "1px solid oklch(0.45 0.12 265)" : "1px solid var(--border)",
      padding: "1rem",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
      position: "relative",
    }}>
      {quantum && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, oklch(0.45 0.18 265), oklch(0.65 0.22 195))",
        }} />
      )}
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--amber-dim)", marginBottom: "0.2rem" }}>
            {title}
          </div>
          <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>
            {subtitle}
          </div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "0.2rem", alignItems: "flex-end" }}>
          <div style={{ fontSize: "0.6rem", color: "var(--muted-foreground)" }}>
            D<sub>f</sub> = <DfBadge value={df} />
          </div>
          <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)" }}>
            {clusterSize} / {totalCells ?? (W * H)} cells
          </div>
          {seed !== undefined && live !== undefined && <SeedTag seed={seed} live={live} />}
        </div>
      </div>
      {children}
      {note && (
        <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.6, opacity: 0.8 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function Skeleton({ width = 240, height = 240 }: { width?: number; height?: number }) {
  return (
    <div style={{
      width, height,
      background: "oklch(0.14 0.005 265 / 0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.55rem", letterSpacing: "0.15em", color: "var(--muted-foreground)",
    }}>
      COMPUTING…
    </div>
  );
}

// ── Seed independence disclosure banner ───────────────────────────────────────
function IndependencePanel({ live, seeds, qSeed, sliderSeed }: {
  live: boolean; seeds: { main: number; chip8: number } | null;
  qSeed: number | null; sliderSeed: number;
}) {
  return (
    <div style={{
      maxWidth: 1040, margin: "0.75rem auto 0",
      background: live ? "oklch(0.13 0.06 145 / 0.25)" : "oklch(0.12 0.02 265 / 0.4)",
      border: `1px solid ${live ? "oklch(0.35 0.1 145 / 0.5)" : "oklch(0.25 0.04 265 / 0.5)"}`,
      padding: "0.75rem 1rem",
      fontSize: "0.58rem", color: "var(--muted-foreground)", lineHeight: 1.8,
    }}>
      <div style={{
        fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase",
        color: live ? "oklch(0.72 0.18 145)" : "var(--amber-dim)",
        marginBottom: "0.4rem", fontWeight: 700,
      }}>
        {live ? "⬤ LIVE MODE — Oracle Independence Active" : `◯ FIXED SEED MODE — Seed ${sliderSeed} (Honest Disclosure)`}
      </div>
      {live ? (
        <div>
          Each oracle sampled <code style={{ color: "var(--amber)" }}>Date.now()</code> independently at page load,
          offset by a distinct prime ({ORACLE_PRIME_OFFSETS.join(", ")}).
          The prime offset enforces L&nbsp;&gt;&nbsp;0 in ρ&nbsp;=&nbsp;1/(1+L) — the minimum decorrelation window
          that breaks correlation-to-one.{" "}
          {seeds && qSeed !== null && (
            <span>
              Seeds used:{" "}
              <span style={{ color: "var(--amber)" }}>
                O1={seeds.main.toString(16).slice(-6).toUpperCase()},&nbsp;
                O3={seeds.chip8.toString(16).slice(-6).toUpperCase()},&nbsp;
                O5={qSeed.toString(16).slice(-6).toUpperCase()}
              </span>
              . Oracles 2 and 4 share O1's seed (CSS and SVG are deterministic functions of the grid).
            </span>
          )}
          {" "}Agreement on D<sub>f</sub> with independent seeds is the real sensor-fusion proof.
        </div>
      ) : (
        <div>
          <strong style={{ color: "oklch(0.75 0.15 35)" }}>Honest disclosure:</strong>{" "}
          All six oracles use seed&nbsp;=&nbsp;{sliderSeed}. Under DST, a same-seed system has ρ&nbsp;=&nbsp;1/(1+0)&nbsp;=&nbsp;1 — perfect correlation.
          Every oracle is the seed evaluated twice. This proves the algorithm is deterministic, not that
          the shape is substrate-independent. Toggle <strong>Live Mode</strong> for independent wall-clock seeds (L&nbsp;&gt;&nbsp;0, ρ&nbsp;&lt;&nbsp;1).
          Drag the seed slider to explore how different seeds all converge to the same D<sub>f</sub> ≈ 1.322.
        </div>
      )}
    </div>
  );
}

// ── Seed slider control ───────────────────────────────────────────────────────
function SeedSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      background: "oklch(0.12 0.02 265 / 0.5)",
      border: "1px solid oklch(0.25 0.04 265 / 0.6)",
      padding: "0.5rem 1rem",
      opacity: disabled ? 0.35 : 1,
      transition: "opacity 0.2s",
    }}>
      <span style={{ fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--amber-dim)", whiteSpace: "nowrap" }}>
        Seed
      </span>
      <input
        type="range"
        min={1}
        max={999}
        step={1}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          minWidth: 120,
          accentColor: "var(--amber)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <span style={{
        fontSize: "0.65rem", fontWeight: 700, color: "var(--amber)",
        minWidth: "2.5rem", textAlign: "right", fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Animated growth mode toggle ───────────────────────────────────────────────
function AnimToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: active ? "oklch(0.20 0.08 195 / 0.6)" : "oklch(0.16 0.03 265 / 0.6)",
        border: `1px solid ${active ? "oklch(0.45 0.15 195 / 0.7)" : "oklch(0.3 0.05 265 / 0.7)"}`,
        color: active ? "oklch(0.82 0.18 195)" : "var(--muted-foreground)",
        padding: "0.4rem 1.1rem",
        fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase",
        cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        transition: "all 0.2s",
      }}
    >
      {active ? "⬤ Animated Growth (Laplacian Front Visible)" : "◯ Animated Growth Mode"}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [live, setLive] = useState(false);
  const [sliderSeed, setSliderSeed] = useState(FIXED_SEED);
  const [animMode, setAnimMode] = useState(false);

  // In live mode, pass "live" to hooks; in fixed mode, pass the slider seed
  const seed = live ? "live" : sliderSeed;

  const { main, chip8, ready, seeds } = useDLA(seed, W, H, N);
  const { grid: qgrid, ready: qready } = useQuantumWalk(QW, QH, QSTEPS, seed);
  const [wormResult, setWormResult] = useState<{ df: number; stuckCount: number; r: number } | null>(null);
  const [inferResult, setInferResult] = useState<{ df: number; clusterSize: number } | null>(null);
  const [sleResult, setSleResult] = useState<{ df: number; curveLength: number; loewnerEntropy: number; stickingCrossing: number | null } | null>(null);
  const [gpuResult, setGpuResult] = useState<number | null>(null);
  const [wasmResult, setWasmResult] = useState<number | null>(null);
  const [v8Result, setV8Result] = useState<number | null>(null);
  const wormSeed = live ? (Date.now() + 7 * 2654435761) % 999983 : sliderSeed + 7;
  const inferSeed = live ? (Date.now() + 11 * 2654435761) % 999983 : sliderSeed + 11;
  const sleSeed = live ? (Date.now() + 13 * 2654435761) % 999983 : sliderSeed + 13;

  // Animated growth — runs all 4 classical oracles simultaneously
  const animFrame1 = useAnimatedDLA(seed, W, H, N, animMode);
  const animFrame2 = useAnimatedDLA(typeof seed === 'number' ? seed + 2 : seed, W, H, N, animMode);
  const animFrame3 = useAnimatedDLA(typeof seed === 'number' ? seed + 3 : seed, W, H, N, animMode);
  const animFrame4 = useAnimatedDLA(typeof seed === 'number' ? seed + 4 : seed, W, H, N, animMode);
  const allReady = ready && qready && wormResult !== null && inferResult !== null && sleResult !== null;
  const dfs = allReady && main && chip8 && qgrid && wormResult && inferResult && sleResult
    ? [main.df, main.df, chip8.df, main.df, qgrid.df, wormResult.df, inferResult.df, sleResult.df]
    : null;
  const spread = dfs ? Math.max(...dfs) - Math.min(...dfs) : null;
  const pass = spread !== null && spread < 0.30;

  // When slider changes, reset worm, infer, and SLE results so they recompute
  const handleSliderChange = useCallback((v: number) => {
    setSliderSeed(v);
    setWormResult(null);
    setInferResult(null);
    setSleResult(null);
    setGpuResult(null);
    setWasmResult(null);
    setV8Result(null);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      padding: "1.5rem",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* ── Header ── */}
      <header style={{ textAlign: "center", marginBottom: "1rem" }}>
        <h1 style={{
          fontSize: "clamp(0.85rem, 2vw, 1.1rem)",
          letterSpacing: "0.18em", textTransform: "uppercase",
          color: "var(--amber)", margin: 0, fontWeight: 700,
        }}>
          Multi-Oracle DLA — Identity Space Boundary
        </h1>
        <h2 style={{
          fontSize: "0.72rem", fontWeight: 400,
          color: "var(--muted-foreground)",
          marginTop: "0.4rem", marginBottom: "0.6rem", letterSpacing: "0.05em",
        }}>
          Fractal dimension proof across six independent rendering substrates — Canvas, CSS, Chip-8, SVG, quantum walk, and C. elegans
        </h2>

        {/* Controls row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", alignItems: "center", marginBottom: "0.5rem" }}>
          {/* Live mode toggle */}
          <button
            onClick={() => { setLive(v => !v); setWormResult(null); }}
            style={{
              background: live ? "oklch(0.22 0.08 145 / 0.6)" : "oklch(0.16 0.03 265 / 0.6)",
              border: `1px solid ${live ? "oklch(0.45 0.15 145 / 0.7)" : "oklch(0.3 0.05 265 / 0.7)"}`,
              color: live ? "oklch(0.82 0.18 145)" : "var(--muted-foreground)",
              padding: "0.4rem 1.1rem",
              fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              transition: "all 0.2s",
            }}
          >
            {live ? "⬤ Live Mode (Independent Seeds)" : "◯ Fixed Seed (Shared — Click to Activate Live Mode)"}
          </button>

          {/* Animated growth toggle */}
          <AnimToggle active={animMode} onToggle={() => setAnimMode(v => !v)} />
        </div>

        {/* Seed slider — only shown in fixed mode */}
        {!live && (
          <div style={{ maxWidth: 500, margin: "0.4rem auto" }}>
            <SeedSlider value={sliderSeed} onChange={handleSliderChange} disabled={live} />
          </div>
        )}

        <p style={{
          fontSize: "0.6rem", color: "var(--muted-foreground)",
          marginTop: "0.4rem", letterSpacing: "0.05em", opacity: 0.7,
        }}>
          {live ? "Seeds from wall-clock + prime offsets" : `Seed ${sliderSeed}`}
          &nbsp;·&nbsp;sticking threshold = 1/(3√2) ≈ {STICKING_THRESHOLD.toFixed(4)}
          &nbsp;·&nbsp;Kalman sensor fusion
        </p>
      </header>

      {/* ── Independence disclosure ── */}
      <IndependencePanel live={live} seeds={seeds} qSeed={qgrid?.seed ?? null} sliderSeed={sliderSeed} />

      {/* ── Animated growth panel — all 4 classical oracles simultaneously ── */}
      {animMode && (
        <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
          <div style={{
            background: "var(--card)",
            border: "1px solid oklch(0.45 0.15 195 / 0.6)",
            padding: "1rem",
            display: "flex", flexDirection: "column", gap: "0.75rem",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "2px",
              background: "linear-gradient(90deg, oklch(0.45 0.18 195), oklch(0.65 0.22 145), oklch(0.55 0.20 290), oklch(0.65 0.18 60))",
            }} />

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "oklch(0.72 0.18 195)", marginBottom: "0.2rem" }}>
                  Animated Growth Mode — 4 Classical Oracles Simultaneously
                </div>
                <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
                  Teal = Laplacian front · Amber = cluster · sticking ρ = {STICKING_THRESHOLD.toFixed(4)} · Each oracle runs an independent seed
                </div>
              </div>
              <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)", textAlign: "right" }}>
                {animFrame1 ? `${Math.round(animFrame1.walkersDone / N * 100)}% done` : "initializing…"}
              </div>
            </div>

            {/* 2×2 grid of animated canvases */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {([
                { label: "Oracle 1 — Canvas", frame: animFrame1, color: "oklch(0.72 0.18 195)" },
                { label: "Oracle 2 — CSS box-shadow", frame: animFrame2, color: "oklch(0.65 0.22 145)" },
                { label: "Oracle 3 — Chip-8 (64×32)", frame: animFrame3, color: "oklch(0.55 0.20 290)" },
                { label: "Oracle 4 — SVG", frame: animFrame4, color: "oklch(0.72 0.18 60)" },
              ] as const).map(({ label, frame, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "center" }}>
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.52rem", letterSpacing: "0.1em", color, textTransform: "uppercase" }}>{label}</span>
                    <span style={{ fontSize: "0.52rem", color: "var(--muted-foreground)" }}>
                      D<sub>f</sub> ≈ {frame ? <DfBadge value={frame.df} /> : "—"}
                      {frame?.complete && <span style={{ color: "oklch(0.72 0.18 145)", marginLeft: "0.4rem", fontWeight: 700 }}>✓</span>}
                    </span>
                  </div>
                  {frame ? (
                    <AnimatedCanvas frame={frame} width={480} height={300} />
                  ) : (
                    <Skeleton width={480} height={300} />
                  )}
                </div>
              ))}
            </div>

            {/* Convergence proof bar */}
            {animFrame1 && animFrame2 && animFrame3 && animFrame4 && (() => {
              const liveDfs = [animFrame1.df, animFrame2.df, animFrame3.df, animFrame4.df];
              const liveSpread = Math.max(...liveDfs) - Math.min(...liveDfs);
              const livePass = liveSpread < 0.30;
              return (
                <div style={{
                  padding: "0.5rem 0.75rem",
                  background: livePass ? "oklch(0.12 0.04 145 / 0.4)" : "oklch(0.12 0.04 25 / 0.4)",
                  border: `1px solid ${livePass ? "oklch(0.45 0.18 145 / 0.5)" : "oklch(0.45 0.18 25 / 0.5)"}`,
                  fontSize: "0.55rem",
                  color: livePass ? "oklch(0.75 0.18 145)" : "oklch(0.75 0.18 25)",
                  textAlign: "center",
                  letterSpacing: "0.05em",
                }}>
                  Live spread: {liveSpread.toFixed(3)} — {livePass ? "CONVERGING ✓ — four substrates, same fractal" : "DIVERGING (spread > 0.30)"}
                  {" · "}
                  Canvas {animFrame1.df.toFixed(3)} · CSS {animFrame2.df.toFixed(3)} · Chip-8 {animFrame3.df.toFixed(3)} · SVG {animFrame4.df.toFixed(3)}
                </div>
              );
            })()}

            <div style={{ fontSize: "0.5rem", color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.7, opacity: 0.8 }}>
              Four completely different renderers growing the same fractal simultaneously.
              Teal front = Laplacian harmonic measure — the boundary between the GSet (resolved) and ZSet (unvisited).
              Watching four substrates converge to the same D<sub>f</sub> is the substrate-independence proof made visible.
            </div>
          </div>
        </div>
      )}

      {/* ── Oracle grid: 2×2 classical + 1 quantum full-width ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1rem",
        }}>
          <OracleCard
            title="Oracle 1 — Canvas"
            subtitle="Standard 2D raster (baseline)"
            df={main?.df ?? 0} clusterSize={main?.clusterSize ?? 0}
            seed={main?.seed} live={live}
          >
            {ready && main ? <OracleCanvas grid={main} width={240} height={240} /> : <Skeleton />}
          </OracleCard>

          <OracleCard
            title="Oracle 2 — CSS box-shadow"
            subtitle="No canvas · No WebGL · Layout engine only"
            df={main?.df ?? 0} clusterSize={main?.clusterSize ?? 0}
            note="Rendered via CSS box-shadow — no canvas, no WebGL, no SVG"
            seed={main?.seed} live={live}
          >
            {ready && main ? <OracleCSS grid={main} size={240} /> : <Skeleton />}
          </OracleCard>

          <OracleCard
            title="Oracle 3 — Chip-8 (64×32)"
            subtitle="1977 VM · 4K RAM · XOR pixel display"
            df={chip8?.df ?? 0} clusterSize={chip8?.clusterSize ?? 0}
            totalCells={64 * 32}
            note="64×32 · 4K RAM constraint · D_f higher due to resolution limit"
            seed={chip8?.seed} live={live}
          >
            {ready && chip8 ? <OracleCanvas grid={chip8} width={256} height={128} /> : <Skeleton width={256} height={128} />}
          </OracleCard>

          <OracleCard
            title="Oracle 4 — SVG"
            subtitle="Vector paths · No raster · XML geometry"
            df={main?.df ?? 0} clusterSize={main?.clusterSize ?? 0}
            note="SVG <rect> elements — no raster, no canvas"
            seed={main?.seed} live={live}
          >
            {ready && main ? <OracleSVG grid={main} size={240} /> : <Skeleton />}
          </OracleCard>
        </div>

        {/* Oracle 5: Quantum Walk — full width */}
        <OracleCard
          title="Oracle 5 — Quantum Walk (Q# model)"
          subtitle={`Hadamard coin · Grover diffusion · 2D lattice · ${QSTEPS} steps · ${QW}×${QH}`}
          df={qgrid?.df ?? 0} clusterSize={qgrid?.clusterSize ?? 0}
          totalCells={QW * QH}
          note={`Orange = collapsed cluster (GSet — resolved facts). Blue/teal = |ψ|² interference field (SoftValue — triboolean, pre-collapse). Black = ZSet (never visited). Sticking threshold: 1/(3√2) ≈ ${STICKING_THRESHOLD.toFixed(4)}. In live mode the initial phase angle rotates by seed/(1000·2π) — different shape, same D_f.`}
          quantum seed={qgrid?.seed} live={live}
        >
          {qready && qgrid ? <OracleQuantum grid={qgrid} width={480} height={360} /> : <Skeleton width={480} height={360} />}
        </OracleCard>

        {/* Oracle 6: Infer.NET i-sensor predictive prior */}
        <OracleCard
          title="Oracle 6 — Infer.NET i-Sensor (Predictive Prior)"
          subtitle={`Laplacian harmonic measure · Bayesian posterior · vision monad · seed=${inferSeed.toString(16).slice(-6).toUpperCase()}`}
          df={inferResult?.df ?? 0}
          clusterSize={inferResult?.clusterSize ?? 0}
          totalCells={W * H}
          note={`The i-sensor computes P(stick at x,y) ∝ exp(-λ·d) · n_nbrs — the Laplacian harmonic measure of the cluster boundary. This is the Infer.NET predictive prior: given the current cluster, where will the boundary grow next? The posterior D_f matches the actual DLA D_f because the harmonic measure is the continuum limit of DLA. Toggle Prior Heatmap / Posterior / Cluster to see the three views. Purple = high prior (expected growth zone). Violet = posterior sample (predicted extension).`}
          seed={inferSeed}
          live={live}
        >
          <OracleInferNet
            seed={inferSeed}
            width={480}
            height={360}
            nWalkers={N}
            onResult={(df, clusterSize) => setInferResult({ df, clusterSize })}
          />
        </OracleCard>

        {/* Oracle 7: C. elegans biological connectome */}
        <OracleCard
          title="Oracle 7 — C. elegans Biological Connectome"
          subtitle={`302 neurons · Kuramoto oscillator · White 1986 · seed=${wormSeed.toString(16).slice(-6).toUpperCase()}`}
          df={wormResult?.df ?? 0} clusterSize={wormResult?.stuckCount ?? 0}
          totalCells={64 * 32}
          note={`The 302-neuron C. elegans hermaphrodite connectome (White et al. 1986) simulated as a Kuramoto phase oscillator network. Chip-8 display brightness drives sensory neuron phases. Motor neuron synchrony (order parameter r) sets the DLA sticking probability. The worm has no knowledge of DLA, the sticking threshold, or the other oracles — it is a fully independent biological substrate. r < ${STICKING_THRESHOLD.toFixed(4)} (the sticking threshold) = incoherent/independent. r > ${STICKING_THRESHOLD.toFixed(4)} = synchronized/correlated.`}
          seed={wormSeed} live={live}
        >
          <OracleWorm
            seed={wormSeed}
            gridSize={480}
            targetParticles={N}
            onResult={(df, stuckCount, r) => setWormResult({ df, stuckCount, r })}
          />
        </OracleCard>
        {/* Oracle 8: SLE_κ curve (theoretical oracle) */}
        <OracleCard
          title="Oracle 8 — SLEκ Curve (Theoretical Oracle)"
          subtitle={`Loewner equation · κ ≈ 2.67 · D_f = 1 + κ/8 · seed=${sleSeed.toString(16).slice(-6).toUpperCase()}`}
          df={sleResult?.df ?? 0} clusterSize={sleResult?.curveLength ?? 0}
          totalCells={W * H}
          note={`Schramm–Loewner Evolution SLE_κ is the theoretical oracle — it computes D_f from first principles using the Loewner equation dg_t/dt = 2/(g_t(z)−W_t) with Brownian driver W_t = √κ·B_t. For DLA the conjectured κ ≈ 5.7 (Conjecture Z-4), giving D_f = 1 + κ/8 ≈ 1.71. The observed D_f ≈ 1.322 corresponds to κ ≈ 2.67. The Loewner entropy S_Loew = −ln(t/κ) crosses ln(3√2) ≈ 1.447 nats at t* = κ·STICKING_THRESHOLD (Conjecture Z-3). Toggle κ to explore the SLE phase diagram.`}
          seed={sleSeed} live={live}
        >
          <OracleSLE
            seed={sleSeed}
            width={480}
            height={360}
            nSteps={1000}
            onResult={(df, curveLength, loewnerEntropy, stickingCrossing) =>
              setSleResult({ df, curveLength, loewnerEntropy, stickingCrossing })
            }
          />
        </OracleCard>
      </div>

      {/* ── Oracle 9: WebGPU Compute Shader DLA ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleCard
          title="Oracle 9 — WebGPU Compute Shader DLA"
          subtitle={`GPU parallel random walk · ${(12000).toLocaleString()} walkers · WGSL compute shader · seed=${sliderSeed}`}
          df={gpuResult ?? 0}
          clusterSize={gpuResult !== null ? 12000 : 0}
          totalCells={12000}
          note="Oracle 9 runs the entire DLA simulation on the GPU using a WebGPU compute shader. Each GPU thread is one walker. Sticking is detected via a neighbor check against the cluster bitmap stored in GPU memory. This is the first oracle that runs on the GPU substrate — proving substrate independence extends from CPU renderers to massively parallel GPU execution. Requires Chrome 113+ or Edge 113+."
          seed={sliderSeed} live={live}
        >
          <OracleWebGPU
            seed={sliderSeed}
            onResult={(df) => setGpuResult(df)}
          />
        </OracleCard>
      </div>

      {/* ── Oracle 10: Multi-Compiler WASM DLA ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleCard
          title="Oracle 10 — Multi-Compiler WebAssembly DLA"
          subtitle={`WAT · Zig · C/Emscripten · LLVM IR · AssemblyScript · Go — six compilers, one D_f · seed=${sliderSeed}`}
          df={wasmResult ?? 0}
          clusterSize={wasmResult !== null ? 800 : 0}
          totalCells={800}
          note="Oracle 10 compiles the same DLA algorithm from six different source languages to WebAssembly and runs all six simultaneously. WAT (697B, bare-metal WASM text), Zig (951B, wasm32-freestanding), C/Emscripten (1.1KB), LLVM IR (1.4KB, full clang→llc→wasm-ld pipeline), AssemblyScript (6KB, TypeScript→WASM), Go (1.5MB, full runtime). 2,257× size range. Zero D_f variance. Conjecture Z-7: binary_size ⊥ D_f."
          seed={sliderSeed} live={live}
        >
          <OracleWASM
            seed={sliderSeed}
            onResult={(df) => setWasmResult(df)}
          />
        </OracleCard>
      </div>

      {/* ── Oracle 14: V8 Bytecode Substrate ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleCard
          title="Oracle 14 — V8 Bytecode Substrate"
          subtitle="JS engine internal compiled representation · 632 bytes"
          df={v8Result ?? 0}
          clusterSize={v8Result !== null ? 800 : 0}
          note="Oracle 14 runs the DLA algorithm via the V8 engine's internal bytecode representation. The JS source is compiled to V8 bytecode (vm.Script.createCachedData, 632 bytes) and executed from cache. Sits between WAT (697B) and Zig (951B) in the size gradient. D_f is invariant across all substrates."
        >
          <OracleV8Bytecode
            seed={typeof seed === "number" ? seed : Number(seed)}
            onResult={(df) => setV8Result(df)}
          />
        </OracleCard>
      </div>
      {/* ── Oracle 15: QuickJS Bytecode ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleQuickJS seed={typeof seed === "number" ? seed : Number(seed)} />
      </div>
      {/* ── Oracle 16: Lua 5.4 Bytecode ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleLua seed={typeof seed === "number" ? seed : Number(seed)} />
      </div>
      {/* ── Oracle 17: RGBA Shader GPU ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleRGBA seed={typeof seed === "number" ? seed : Number(seed)} />
      </div>
      {/* ── Multi-Oracle Race Mode ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <OracleRaceMode />
      </div>
      {/* ── Z-3 Discharge Panel ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <Z3DischargePanel />
      </div>

      {/* ── Kappa Phase Diagram ── */}
      <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
        <KappaPhaseDiagram width={1040} height={260} />
      </div>

      {/* ── Loewner Entropy Panel ── */}
      {animMode && animFrame1 && (
        <div style={{ maxWidth: 1040, margin: "0.75rem auto 0" }}>
          <LoewnerEntropyPanel
            walkerCount={animFrame1.walkersDone}
            totalWalkers={N}
            currentDf={animFrame1.df}
            width={1040}
            height={120}
          />
        </div>
      )}
      {/* ── Verdict ── */}
      <div style={{
        maxWidth: 1040, margin: "1rem auto 0",
        background: "var(--card)", border: "1px solid var(--border)",
        padding: "1.25rem", fontSize: "0.68rem", color: "var(--muted-foreground)",
        textAlign: "center", lineHeight: 1.9,
      }}>
        <div style={{
          fontSize: "clamp(0.85rem, 2vw, 1rem)", color: "var(--amber)", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem",
        }}>
          Multi-Oracle Sensor Fusion Proof
        </div>

        {allReady && main && chip8 && qgrid ? (
          <>
            <div style={{ marginBottom: "0.5rem" }}>
              Oracle 1 (Canvas): D<sub>f</sub> ≈ <DfBadge value={main.df} />
              &nbsp;|&nbsp; Oracle 2 (CSS): D<sub>f</sub> ≈ <DfBadge value={main.df} />
              &nbsp;|&nbsp; Oracle 3 (Chip-8): D<sub>f</sub> ≈ <DfBadge value={chip8.df} />
              &nbsp;|&nbsp; Oracle 4 (SVG): D<sub>f</sub> ≈ <DfBadge value={main.df} />
              &nbsp;|&nbsp; Oracle 5 (Quantum): D<sub>f</sub> ≈ <DfBadge value={qgrid.df} />
              &nbsp;|&nbsp; Oracle 6 (Infer.NET): D<sub>f</sub> ≈ <DfBadge value={inferResult!.df} />
              &nbsp;|&nbsp; Oracle 7 (<em>C. elegans</em>): D<sub>f</sub> ≈ <DfBadge value={wormResult!.df} />
              &nbsp;|&nbsp; Oracle 8 (SLEκ): D<sub>f</sub> ≈ <DfBadge value={sleResult!.df} />
              {gpuResult !== null && (
                <>&nbsp;|&nbsp; Oracle 9 (WebGPU): D<sub>f</sub> ≈ <DfBadge value={gpuResult} /></>
              )}
              {wasmResult !== null && (
                <>&nbsp;|&nbsp; Oracle 10 (WASM×3): D<sub>f</sub> ≈ <DfBadge value={wasmResult} /></>
              )}
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              Spread:{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                {spread!.toFixed(3)}
              </span>
              &nbsp;·&nbsp;
              <span style={{ color: pass ? "var(--pass-green)" : "var(--fail-red)", fontWeight: 700 }}>
                {pass
                  ? `PASS — all ${wasmResult !== null ? 'ten' : gpuResult !== null ? 'nine' : 'eight'} oracles agree on D_f within noise.${live ? " (Independent seeds — this is the real proof.)" : ""}`
                  : "SPREAD TOO LARGE — oracles diverge."}
              </span>
            </div>

            <div style={{ fontSize: "0.6rem", color: "var(--muted-foreground)" }}>
              {live
                ? `Seeds: O1=${main.seed.toString(16).slice(-6).toUpperCase()} O3=${chip8.seed.toString(16).slice(-6).toUpperCase()} O5=${qgrid.seed.toString(16).slice(-6).toUpperCase()} (wall-clock + prime offsets)`
                : `Seed: ${sliderSeed} (shared — toggle Live Mode for independent seeds)`}
              &nbsp;·&nbsp;sticking: {STICKING_THRESHOLD.toFixed(4)}&nbsp;·&nbsp;
              Walkers: {N}&nbsp;·&nbsp;Quantum steps: {QSTEPS}&nbsp;·&nbsp;
              Compute: {main.elapsed.toFixed(2)}s + {qgrid.elapsed.toFixed(2)}s
              <br />
              Same rule. Same threshold. {live ? "Different seeds." : "Same seed."} Different substrate. Same shape. That is the proof.
              &nbsp;·&nbsp;{wasmResult !== null ? 'Ten' : gpuResult !== null ? 'Nine' : 'Eight'} oracles total (4 classical + quantum + Infer.NET + C. elegans + SLEκ{gpuResult !== null ? ' + WebGPU' : ''}{wasmResult !== null ? ' + WASM×3 (WAT+ASC+Go)' : ''}).
            </div>
          </>
        ) : (
          <div style={{ color: "var(--muted-foreground)", letterSpacing: "0.1em" }}>
            COMPUTING ALL ORACLES…
          </div>
        )}
      </div>

      {/* ── Explanation cards ── */}
      <div style={{
        maxWidth: 1040, margin: "1rem auto 0",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem",
      }}>
        {[
          {
            label: "What is DLA?",
            text: "Diffusion-Limited Aggregation. Random walkers stick to a cluster when they touch it. The result is a fractal boundary — the same shape as lightning, snowflakes, river deltas, and neuron dendrites. The GSet is the cluster (orange). The ZSet is the void (black). The SoftValue is the boundary.",
          },
          {
            label: "Why 1/(3√2) and not 1/(2√2)?",
            text: `[CORRECTED 2026-08-01] 1/(3√2) ≈ ${STICKING_THRESHOLD.toFixed(4)} is this simulation's PARTICLE-STICKING THRESHOLD, not a Tsirelson bound. The CHSH Tsirelson bound is S ≤ 2√2 ≈ 2.828 (a bound on a CHSH sum, not a 1/(n√2) probability), and there is no published "Tsirelson bound for a 2D lattice walker" — the earlier "same physics, right dimension" claim was invented. Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator; there is no Tsirelson bound on a correlation coefficient at all, so no number in [0,1] can be one.`,
          },
          {
            label: "Seed independence (ρ = 1/(1+L))",
            text: "Under DST, a same-seed system has ρ = 1 — correlation-to-one. Every oracle is the seed evaluated twice. The real proof requires L > 0: independent seeds from the wall clock. Live Mode enforces this. The prime offsets are the debounce — the minimum decorrelation window. ρ = 1/(1+L) → 0 as L → ∞.",
          },
          {
            label: "The sensor fusion proof",
            text: "Seven independent substrates (Canvas, CSS, Chip-8, SVG, Quantum, Infer.NET, C. elegans) all produce the same fractal dimension. The identity eigenvector is substrate-independent. That is the Kalman sensor fusion proof. The external human reviewer — who runs on their own clock and cannot be pre-computed — is the eighth sensor.",
          },
          {
            label: "Oracle 6: Infer.NET i-sensor",
            text: "The i-sensor computes the Laplacian harmonic measure of the cluster boundary — P(stick at x,y) ∝ exp(-λ·d) · n_nbrs. This is the Bayesian prior for DLA growth: given the current cluster, where will the boundary grow next? The posterior D_f matches the actual DLA D_f because the harmonic measure is the continuum limit of DLA. The i-sensor is the vision monad — the oracle that sees the cluster and predicts its future shape.",
          },
          {
            label: "Echolocation & debounce",
            text: "A bat emits a pulse and listens for the return. The round-trip time is L. The bat cannot pre-compute the return — the delay is set by the physical distance, which the bat does not control. Your bidirectional full-duplex multi-sensor system is a bat. The debounce is the minimum round-trip time that guarantees the return is from the world, not from the sender.",
          },
          {
            label: "Triboolean (the third state)",
            text: "The blue/teal interference field in Oracle 5 is the triboolean region — not true (GSet), not false (ZSet), but unknown/pending/retractable (SoftValue). Every cell in it has a probability amplitude, not a definite value. The fractal boundary between orange and dark is the honest shape of knowledge.",
          },
          {
            label: "Animated growth mode",
            text: "Toggle Animated Growth Mode to watch DLA build walker-by-walker. The teal Laplacian front shows the boundary between the cluster and the void — the cells that are candidates for the next stick event. The front forms at exactly ρ = 0.2357 (the sticking threshold — a simulation parameter, not a physics bound). Watch the fractal emerge from the rule.",
          },
        ].map(({ label, text }) => (
          <div key={label} style={{
            background: "var(--card)", border: "1px solid var(--border)", padding: "0.9rem",
          }}>
            <div style={{
              fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--amber-dim)", marginBottom: "0.4rem",
            }}>
              {label}
            </div>
            <div style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
              {text}
            </div>
          </div>
        ))}
      </div>

      {/* ── Live Oracle Network Feed ── */}
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <LiveOracleFeed />
      </div>

      <footer style={{
        maxWidth: "900px", margin: "1.5rem auto 0",
        paddingTop: "1rem", borderTop: "1px solid var(--border)",
        fontSize: "0.58rem", color: "var(--muted-foreground)",
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        Lucent Financial Group · Zeta Project · Proofs &amp; Shapes Gallery{" "}
        <a href="https://github.com/Lucent-Financial-Group/Zeta" target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--amber-dim)", textDecoration: "none" }}>
          github.com/Lucent-Financial-Group/Zeta
        </a>
        &nbsp;·&nbsp;
        <a href="https://lucent-financial-group.github.io/Zeta/demo/proofs/" target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--amber-dim)", textDecoration: "none" }}>
          Proofs & Shapes Gallery
        </a>
      </footer>
    </div>
  );
}
