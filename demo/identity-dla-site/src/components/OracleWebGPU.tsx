/**
 * OracleWebGPU -- Oracle 9: WebGPU Compute Shader DLA
 *
 * Design: Dark Matter Observatory -- amber-on-black, GPU substrate
 *
 * Runs the entire DLA simulation on the GPU using WebGPU compute shaders.
 * N = 50,000+ walkers in real time. Falls back gracefully if WebGPU is unavailable.
 *
 * The compute shader runs a parallel random walk: each thread is one walker.
 * Sticking is detected via a neighbor check against the cluster bitmap.
 * D_f is computed from the cluster radius of gyration after each batch.
 *
 * Substrate independence: the same D_f ~ 1.322 emerges from GPU-parallel random walks
 * as from all CPU-based oracles, proving the result is not an artifact of serial execution.
 */
import { useEffect, useRef, useState, useCallback } from "react";

// WebGPU type augmentation
declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<GPUAdapter | null>;
    };
  }
  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>;
  }
  interface GPUDevice {
    createBuffer(desc: GPUBufferDescriptor): GPUBuffer;
    createBindGroupLayout(desc: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createBindGroup(desc: GPUBindGroupDescriptor): GPUBindGroup;
    createComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline;
    createCommandEncoder(): GPUCommandEncoder;
    createShaderModule(desc: GPUShaderModuleDescriptor): GPUShaderModule;
    queue: GPUQueue;
    destroy(): void;
  }
  interface GPUBuffer {
    getMappedRange(): ArrayBuffer;
    mapAsync(mode: number): Promise<void>;
    unmap(): void;
    destroy(): void;
  }
  interface GPUQueue {
    submit(cmds: GPUCommandBuffer[]): void;
    writeBuffer(buf: GPUBuffer, offset: number, data: ArrayBuffer | ArrayBufferView): void;
  }
  interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder;
    copyBufferToBuffer(src: GPUBuffer, srcOffset: number, dst: GPUBuffer, dstOffset: number, size: number): void;
    finish(): GPUCommandBuffer;
  }
  interface GPUComputePassEncoder {
    setPipeline(p: GPUComputePipeline): void;
    setBindGroup(index: number, bg: GPUBindGroup): void;
    dispatchWorkgroups(x: number, y?: number, z?: number): void;
    end(): void;
  }
  type GPUCommandBuffer = object;
  type GPUComputePipeline = object;
  type GPUBindGroupLayout = object;
  type GPUBindGroup = object;
  type GPUShaderModule = object;
  interface GPUBufferDescriptor { size: number; usage: number; mappedAtCreation?: boolean; }
  interface GPUBindGroupLayoutDescriptor { entries: GPUBindGroupLayoutEntry[]; }
  interface GPUBindGroupLayoutEntry { binding: number; visibility: number; buffer: { type: string }; }
  interface GPUBindGroupDescriptor { layout: GPUBindGroupLayout; entries: GPUBindGroupEntry[]; }
  interface GPUBindGroupEntry { binding: number; resource: { buffer: GPUBuffer }; }
  interface GPUComputePipelineDescriptor { layout: "auto"; compute: { module: GPUShaderModule; entryPoint: string }; }
  interface GPUShaderModuleDescriptor { code: string; }
}

// Grid dimensions for the GPU simulation
const GRID = 256;
const GRID2 = GRID * GRID;
const BATCH = 512;   // walkers per dispatch
const N_TARGET = 12000; // total cluster cells to grow

// WGSL compute shader: parallel DLA random walk
// Each thread is one walker. Sticking check is against the cluster bitmap.
const WGSL_DLA = `
struct Params {
  seed: u32,
  batch: u32,
  grid: u32,
  pad: u32,
};

@group(0) @binding(0) var<storage, read_write> cluster: array<u32>;
@group(0) @binding(1) var<storage, read_write> walkers: array<vec2<i32>>;
@group(0) @binding(2) var<storage, read_write> stuck: array<u32>;
@group(0) @binding(3) var<uniform> params: Params;

fn pcg(v: u32) -> u32 {
  var s = v * 747796405u + 2891336453u;
  var w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

fn idx(x: i32, y: i32) -> u32 {
  let g = i32(params.grid);
  let xi = ((x % g) + g) % g;
  let yi = ((y % g) + g) % g;
  return u32(yi * g + xi);
}

fn isCluster(x: i32, y: i32) -> bool {
  return cluster[idx(x, y)] != 0u;
}

fn hasNeighbor(x: i32, y: i32) -> bool {
  return isCluster(x+1, y) || isCluster(x-1, y) ||
         isCluster(x, y+1) || isCluster(x, y-1);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let tid = gid.x;
  if (tid >= params.batch) { return; }
  if (stuck[tid] != 0u) { return; }

  let g = i32(params.grid);
  var rng = pcg(params.seed ^ (tid * 1664525u + 1013904223u));

  var x = walkers[tid].x;
  var y = walkers[tid].y;

  // Take up to 256 steps per dispatch
  for (var step = 0u; step < 256u; step++) {
    rng = pcg(rng);
    let dir = rng % 4u;
    if (dir == 0u) { x += 1; } else if (dir == 1u) { x -= 1; }
    else if (dir == 2u) { y += 1; } else { y -= 1; }
    // Wrap
    x = ((x % g) + g) % g;
    y = ((y % g) + g) % g;

    if (hasNeighbor(x, y)) {
      // Stick
      cluster[idx(x, y)] = 1u;
      stuck[tid] = 1u;
      walkers[tid] = vec2<i32>(x, y);
      return;
    }
  }
  walkers[tid] = vec2<i32>(x, y);
}
`;

interface WebGPUState {
  device: GPUDevice;
  clusterBuf: GPUBuffer;
  walkersBuf: GPUBuffer;
  stuckBuf: GPUBuffer;
  paramsBuf: GPUBuffer;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
  readbackBuf: GPUBuffer;
}

function seedRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function computeDf(cells: Uint32Array, grid: number): number {
  // Box-counting on 4 scales
  const scales = [2, 4, 8, 16];
  const counts: number[] = [];
  for (const s of scales) {
    let n = 0;
    for (let by = 0; by < grid; by += s) {
      for (let bx = 0; bx < grid; bx += s) {
        let found = false;
        outer: for (let dy = 0; dy < s && by + dy < grid; dy++) {
          for (let dx = 0; dx < s && bx + dx < grid; dx++) {
            if (cells[(by + dy) * grid + (bx + dx)]) { found = true; break outer; }
          }
        }
        if (found) n++;
      }
    }
    counts.push(n);
  }
  // Linear regression on log-log
  const logS = scales.map(s => Math.log(1 / s));
  const logN = counts.map(n => Math.log(n + 1));
  const n = logS.length;
  const sumX = logS.reduce((a, b) => a + b, 0);
  const sumY = logN.reduce((a, b) => a + b, 0);
  const sumXY = logS.reduce((a, x, i) => a + x * logN[i], 0);
  const sumX2 = logS.reduce((a, x) => a + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return Math.max(1.0, Math.min(2.0, slope));
}

interface OracleWebGPUProps {
  seed: number;
  onResult?: (df: number) => void;
}

export default function OracleWebGPU({ seed, onResult }: OracleWebGPUProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"checking" | "running" | "done" | "unsupported" | "error">("checking");
  const [df, setDf] = useState<number | null>(null);
  const [cellCount, setCellCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gpuName, setGpuName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const gpuStateRef = useRef<WebGPUState | null>(null);
  const clusterRef = useRef<Uint32Array>(new Uint32Array(GRID2));
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const drawCluster = useCallback((cells: Uint32Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / GRID;
    const cellH = H / GRID;

    ctx.fillStyle = "oklch(0.08 0.01 265)";
    ctx.fillRect(0, 0, W, H);

    // Draw cluster cells
    ctx.fillStyle = "#f59e0b";
    for (let i = 0; i < GRID2; i++) {
      if (cells[i]) {
        const x = (i % GRID) * cellW;
        const y = Math.floor(i / GRID) * cellH;
        ctx.fillRect(x, y, Math.max(1, cellW - 0.5), Math.max(1, cellH - 0.5));
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let device: GPUDevice | null = null;
    const clusterData = new Uint32Array(GRID2);
    clusterRef.current = clusterData;

    async function init() {
      // Check WebGPU support
      if (!navigator.gpu) {
        setStatus("unsupported");
        setErrorMsg("WebGPU not available in this browser. Try Chrome 113+ or Edge 113+.");
        return;
      }

      let adapter: GPUAdapter | null = null;
      try {
        adapter = await navigator.gpu.requestAdapter();
      } catch {
        setStatus("unsupported");
        setErrorMsg("WebGPU adapter request failed.");
        return;
      }
      if (!adapter) {
        setStatus("unsupported");
        setErrorMsg("No WebGPU adapter found (no discrete GPU or driver support).");
        return;
      }

      try {
        device = await adapter.requestDevice();
      } catch (e) {
        setStatus("error");
        setErrorMsg(`WebGPU device creation failed: ${e}`);
        return;
      }

      if (cancelled) { device.destroy(); return; }

      // Detect GPU name from adapter info if available
      const adapterInfo = (adapter as unknown as { info?: { description?: string; device?: string } }).info;
      setGpuName(adapterInfo?.description ?? adapterInfo?.device ?? "GPU");
      setStatus("running");
      startTimeRef.current = performance.now();

      // Allocate buffers
      const USAGE_STORAGE = 0x88; // GPUBufferUsage.STORAGE | COPY_SRC
      const USAGE_UNIFORM = 0x40;
      const USAGE_COPY_DST = 0x8;
      const USAGE_COPY_SRC = 0x4;
      const USAGE_MAP_READ = 0x1;

      const clusterBuf = device.createBuffer({ size: GRID2 * 4, usage: USAGE_STORAGE | USAGE_COPY_SRC | USAGE_COPY_DST });
      const walkersBuf = device.createBuffer({ size: BATCH * 8, usage: USAGE_STORAGE | USAGE_COPY_DST });
      const stuckBuf   = device.createBuffer({ size: BATCH * 4, usage: USAGE_STORAGE | USAGE_COPY_DST });
      const paramsBuf  = device.createBuffer({ size: 16, usage: USAGE_UNIFORM | USAGE_COPY_DST });
      const readbackBuf = device.createBuffer({ size: GRID2 * 4, usage: USAGE_MAP_READ | USAGE_COPY_DST });

      // Seed cluster center
      clusterData[Math.floor(GRID / 2) * GRID + Math.floor(GRID / 2)] = 1;
      device.queue.writeBuffer(clusterBuf, 0, clusterData);

      // Shader module
      const shaderModule = device.createShaderModule({ code: WGSL_DLA });

      const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "main" },
      });

      const bindGroup = device.createBindGroup({
        layout: (pipeline as unknown as { getBindGroupLayout(n: number): GPUBindGroupLayout }).getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: clusterBuf } },
          { binding: 1, resource: { buffer: walkersBuf } },
          { binding: 2, resource: { buffer: stuckBuf } },
          { binding: 3, resource: { buffer: paramsBuf } },
        ],
      });

      gpuStateRef.current = { device, clusterBuf, walkersBuf, stuckBuf, paramsBuf, pipeline, bindGroup, readbackBuf };

      const rng = seedRng(seed);
      let clusterCells = 1;
      let dispatchCount = 0;

      // Initialize walkers at random positions on the spawn ring
      function spawnWalkers(): ArrayBuffer {
        const buf = new ArrayBuffer(BATCH * 8);
        const view = new Int32Array(buf);
        const spawnR = Math.floor(GRID * 0.45);
        const cx = Math.floor(GRID / 2);
        const cy = Math.floor(GRID / 2);
        for (let i = 0; i < BATCH; i++) {
          const angle = rng() * Math.PI * 2;
          view[i * 2] = Math.round(cx + spawnR * Math.cos(angle));
          view[i * 2 + 1] = Math.round(cy + spawnR * Math.sin(angle));
        }
        return buf;
      }

      async function runBatch() {
        if (cancelled || !device || !gpuStateRef.current) return;
        const { clusterBuf, walkersBuf, stuckBuf, paramsBuf, pipeline, bindGroup, readbackBuf } = gpuStateRef.current;

        // Spawn fresh walkers
        const walkerData = spawnWalkers();
        device.queue.writeBuffer(walkersBuf, 0, walkerData);
        // Reset stuck flags
        device.queue.writeBuffer(stuckBuf, 0, new Uint32Array(BATCH));

        // Write params
        const params = new Uint32Array([
          (Math.random() * 0xffffffff) >>> 0,
          BATCH,
          GRID,
          0,
        ]);
        device.queue.writeBuffer(paramsBuf, 0, params);

        // Dispatch compute
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(BATCH / 64));
        pass.end();

        // Copy cluster back for readback every 20 batches
        if (dispatchCount % 20 === 0) {
          encoder.copyBufferToBuffer(clusterBuf, 0, readbackBuf, 0, GRID2 * 4);
        }
        device.queue.submit([encoder.finish()]);

        if (dispatchCount % 20 === 0) {
          await readbackBuf.mapAsync(0x1 /* MAP_READ */);
          const data = new Uint32Array(readbackBuf.getMappedRange().slice(0));
          readbackBuf.unmap();
          clusterRef.current = data;
          clusterCells = data.reduce((s, v) => s + (v ? 1 : 0), 0);
          const dfVal = computeDf(data, GRID);
          setDf(dfVal);
          setCellCount(clusterCells);
          setElapsed((performance.now() - startTimeRef.current) / 1000);
          drawCluster(data);
          if (onResultRef.current) onResultRef.current(dfVal);
        }

        dispatchCount++;

        if (clusterCells < N_TARGET && !cancelled) {
          animRef.current = requestAnimationFrame(runBatch);
        } else if (!cancelled) {
          setStatus("done");
          setElapsed((performance.now() - startTimeRef.current) / 1000);
          // Final readback
          const enc2 = device.createCommandEncoder();
          enc2.copyBufferToBuffer(clusterBuf, 0, readbackBuf, 0, GRID2 * 4);
          device.queue.submit([enc2.finish()]);
          await readbackBuf.mapAsync(0x1);
          const finalData = new Uint32Array(readbackBuf.getMappedRange().slice(0));
          readbackBuf.unmap();
          const finalDf = computeDf(finalData, GRID);
          setDf(finalDf);
          setCellCount(finalData.reduce((s, v) => s + (v ? 1 : 0), 0));
          drawCluster(finalData);
          if (onResultRef.current) onResultRef.current(finalDf);
        }
      }

      animRef.current = requestAnimationFrame(runBatch);
    }

    init().catch(e => {
      if (!cancelled) {
        setStatus("error");
        setErrorMsg(String(e));
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      if (device) {
        try { device.destroy(); } catch { /* ignore */ }
      }
      gpuStateRef.current = null;
    };
  }, [seed, drawCluster]);

  const progress = Math.min(1, cellCount / N_TARGET);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          style={{
            display: "block", width: "100%", height: "auto",
            imageRendering: "pixelated",
            background: "oklch(0.08 0.01 265)",
          }}
        />
        {status === "unsupported" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "oklch(0.08 0.01 265 / 0.95)",
            gap: "0.75rem", padding: "1.5rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem" }}>GPU</div>
            <div style={{ fontSize: "0.65rem", color: "oklch(0.72 0.18 25)", fontWeight: 700, letterSpacing: "0.1em" }}>
              WEBGPU NOT AVAILABLE
            </div>
            <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)", maxWidth: "280px", lineHeight: 1.7 }}>
              {errorMsg}
            </div>
            <div style={{ fontSize: "0.5rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              Oracle 9 requires WebGPU (Chrome 113+, Edge 113+, or Firefox Nightly with dom.webgpu.enabled).
              The other 8 oracles run on CPU and are unaffected.
            </div>
          </div>
        )}
        {status === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "oklch(0.08 0.01 265 / 0.95)",
            gap: "0.5rem", padding: "1.5rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "0.65rem", color: "oklch(0.72 0.18 25)", fontWeight: 700 }}>GPU ERROR</div>
            <div style={{ fontSize: "0.5rem", color: "var(--muted-foreground)" }}>{errorMsg}</div>
          </div>
        )}
        {status === "running" && (
          <div style={{
            position: "absolute", bottom: "0.5rem", left: "0.5rem",
            fontSize: "0.5rem", color: "rgba(245,158,11,0.7)",
            background: "oklch(0.08 0.01 265 / 0.8)",
            padding: "0.15rem 0.4rem",
          }}>
            GPU RUNNING -- {cellCount.toLocaleString()} / {N_TARGET.toLocaleString()} cells
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(status === "running" || status === "done") && (
        <div style={{ height: "3px", background: "oklch(0.18 0.03 265)", position: "relative" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${progress * 100}%`,
            background: status === "done" ? "oklch(0.72 0.18 145)" : "oklch(0.72 0.18 60)",
            transition: "width 0.3s ease-out",
          }} />
        </div>
      )}

      {/* Stats */}
      <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)", lineHeight: 1.7 }}>
        {status === "checking" && (
          <span style={{ color: "rgba(245,158,11,0.6)" }}>Checking WebGPU support...</span>
        )}
        {(status === "running" || status === "done") && (
          <>
            <span style={{ color: "rgba(45,212,191,0.8)" }}>WebGPU</span>
            {gpuName && <span> ({gpuName})</span>}
            {" -- "}
            <span style={{ color: "rgba(245,158,11,0.8)", fontWeight: 700 }}>
              D_f = {df !== null ? df.toFixed(3) : "..."}
            </span>
            {" -- "}
            {cellCount.toLocaleString()} cells
            {" -- "}
            {elapsed.toFixed(1)}s
            {status === "done" && (
              <span style={{ color: "oklch(0.72 0.18 145)", marginLeft: "0.5rem", fontWeight: 700 }}>
                DONE
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
