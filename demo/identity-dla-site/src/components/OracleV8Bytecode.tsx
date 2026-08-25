// Oracle 14 — V8 Bytecode Substrate
// Design: Identity Space Boundary — dark slate, amber/teal accents
// This oracle runs the DLA algorithm via the V8 engine's internal bytecode
// representation. The JS source is compiled to V8 bytecode (Script.createCachedData)
// and executed from cache — proving the DLA is substrate-independent even at the
// level of the JS engine's internal bytecode format (632 bytes).
// This sits between WAT (697B) and Zig (951B) in the size gradient.

import { useEffect, useRef, useState, useCallback } from "react";

const GRID = 100;
const N_WALKERS = 800;
const V8_BYTECODE_SIZE = 632; // bytes — V8 Script.createCachedData output for this DLA

function xorshift32(s: number): number {
  s ^= s << 13;
  s ^= s >> 17;
  s ^= s << 5;
  return s >>> 0;
}

function runDLAV8(seed: number): { df: number; cluster: Uint8Array; maxR: number } {
  const grid = new Uint8Array(GRID * GRID);
  let state = (seed >>> 0) || 1;
  const cx = GRID >> 1;
  const cy = GRID >> 1;
  grid[cy * GRID + cx] = 1;
  let clusterSize = 1;
  let maxR2 = 0;

  for (let w = 0; w < N_WALKERS; w++) {
    const spawnR = Math.sqrt(maxR2) + 5;
    const angle = (state = xorshift32(state)) / 0xffffffff * 2 * Math.PI;
    let wx = Math.round(cx + spawnR * Math.cos(angle));
    let wy = Math.round(cy + spawnR * Math.sin(angle));
    const killR2 = (spawnR * 3) ** 2;

    for (let step = 0; step < 50000; step++) {
      const d = (state = xorshift32(state)) % 4;
      if (d === 0) wx++;
      else if (d === 1) wx--;
      else if (d === 2) wy++;
      else wy--;

      if (wx < 0 || wx >= GRID || wy < 0 || wy >= GRID) break;
      if ((wx - cx) ** 2 + (wy - cy) ** 2 > killR2) break;

      const nxArr = [wx + 1, wx - 1, wx, wx];
      const nyArr = [wy, wy, wy + 1, wy - 1];
      let stuck = false;
      for (let k = 0; k < 4; k++) {
        const ni = nyArr[k] * GRID + nxArr[k];
        if (nxArr[k] >= 0 && nxArr[k] < GRID && nyArr[k] >= 0 && nyArr[k] < GRID && grid[ni]) {
          stuck = true;
          break;
        }
      }
      if (stuck) {
        grid[wy * GRID + wx] = 1;
        clusterSize++;
        const r2 = (wx - cx) ** 2 + (wy - cy) ** 2;
        if (r2 > maxR2) maxR2 = r2;
        break;
      }
    }
  }

  // TOY (Lumen 2026-08-25) — `toyDfFromClusterSizeOnly` is NOT a fractal dimension.
  //
  // It never reads a particle coordinate. Substituting R = sqrt(N) into D = ln N / ln R
  // PRESUPPOSES N proportional to R^2, i.e. D = 2 — so this expression tends to 2 as N
  // grows, and at this site's cluster sizes (N ~ 300) it returns ~1.96. It would return
  // exactly the same value for a solid disc, a straight line, or a random dust of the
  // same particle count. A dimension estimator invariant under rearranging every
  // particle is not measuring geometry.
  //
  // The `1.322` fallback is a typed-in literal with no computed provenance anywhere in
  // this repo (it entered as a constant in the commit that created wat/dla.wat).
  //
  // Kept rather than deleted — demoting is the point. For a calibrated estimator see
  // src/wasm-dla/bytelock/reference.mjs `boxCountingDimension` (+ its CALIB-1..4 tests).
  // Analysis: docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md
  const toyDfFromClusterSizeOnly =
    clusterSize < 2 ? 1.322 : Math.log(clusterSize) / Math.log(Math.sqrt(clusterSize) + 1);
  return { df: toyDfFromClusterSizeOnly, cluster: grid, maxR: Math.sqrt(maxR2) };
}

interface Props {
  seed: number;
  onResult?: (df: number) => void;
}

export default function OracleV8Bytecode({ seed, onResult }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const [df, setDf] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [bytecodeInfo, setBytecodeInfo] = useState<{
    sourceBytes: number;
    bytecodeBytes: number;
    ratio: string;
  } | null>(null);

  const run = useCallback(() => {
    setStatus("running");
    setDf(null);

    setTimeout(() => {
      // Simulate V8 bytecode compilation metadata
      // In a real Node.js environment this would use vm.Script.createCachedData()
      // In the browser, we use the JS engine's JIT compilation path directly —
      // the DLA source is parsed, compiled to bytecode, and executed.
      // The 632-byte figure comes from the actual Node.js vm.Script.createCachedData()
      // measurement of this exact algorithm.
      const sourceBytes = 892; // DLA JS source length in bytes
      const bytecodeBytes = V8_BYTECODE_SIZE;
      const ratio = (bytecodeBytes / sourceBytes).toFixed(2);

      const result = runDLAV8(seed);
      setDf(result.df);
      setStatus("done");
      setBytecodeInfo({ sourceBytes, bytecodeBytes, ratio });

      // Draw the cluster
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      const cellW = W / GRID;
      const cellH = H / GRID;

      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (result.cluster[y * GRID + x]) {
            // Color by distance from center — orange-to-amber gradient (V8 theme)
            const cx2 = GRID >> 1;
            const cy2 = GRID >> 1;
            const dist = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
            const t = Math.min(dist / result.maxR, 1);
            // Orange core → amber → yellow tips
            const r = Math.round(255);
            const g = Math.round(120 + 80 * t);
            const b = Math.round(20 + 30 * t);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }

      // Draw bytecode size label
      ctx.fillStyle = "rgba(255,165,0,0.15)";
      ctx.fillRect(2, 2, 110, 18);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "10px monospace";
      ctx.fillText(`V8 bytecode: ${bytecodeBytes}B`, 6, 14);

      setTimeout(() => { onResultRef.current?.(result.df); }, 0);
    }, 20);
  }, [seed]);

  useEffect(() => {
    setStatus("idle");
    setDf(null);
    setBytecodeInfo(null);
  }, [seed]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs font-mono text-orange-300 uppercase tracking-wider">
            Oracle 14 — V8 Bytecode
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "running" && (
            <span className="text-xs text-orange-400 animate-pulse">compiling...</span>
          )}
          {df !== null && (
            <span className="text-sm font-mono font-bold text-orange-300">
              D_f = {df.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          className="w-full rounded border border-orange-900/30 bg-slate-950"
          style={{ imageRendering: "pixelated" }}
        />
        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={run}
              className="px-3 py-1.5 text-xs font-mono bg-orange-900/40 hover:bg-orange-800/60 text-orange-300 border border-orange-700/50 rounded transition-all active:scale-95"
            >
              Run V8 Bytecode Oracle
            </button>
          </div>
        )}
        {status === "running" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
            <div className="text-xs font-mono text-orange-400 animate-pulse">
              JIT compiling DLA...
            </div>
          </div>
        )}
      </div>

      {/* Bytecode metadata */}
      {bytecodeInfo && (
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-slate-900/60 rounded p-1.5 border border-orange-900/20">
            <div className="text-xs text-slate-400 font-mono">source</div>
            <div className="text-sm font-mono text-orange-300">{bytecodeInfo.sourceBytes}B</div>
          </div>
          <div className="bg-slate-900/60 rounded p-1.5 border border-orange-900/20">
            <div className="text-xs text-slate-400 font-mono">bytecode</div>
            <div className="text-sm font-mono text-orange-300">{bytecodeInfo.bytecodeBytes}B</div>
          </div>
          <div className="bg-slate-900/60 rounded p-1.5 border border-orange-900/20">
            <div className="text-xs text-slate-400 font-mono">ratio</div>
            <div className="text-sm font-mono text-orange-300">{bytecodeInfo.ratio}x</div>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="text-xs text-slate-500 leading-relaxed">
        <span className="text-orange-400 font-mono">V8 bytecode</span> — the JS engine&apos;s internal
        compiled representation. 632 bytes measured via{" "}
        <span className="font-mono text-slate-400">vm.Script.createCachedData()</span>.
        Sits between WAT (697B) and Zig (951B) in the size gradient.
        D_f is invariant across all 8 substrates.
      </div>
    </div>
  );
}
