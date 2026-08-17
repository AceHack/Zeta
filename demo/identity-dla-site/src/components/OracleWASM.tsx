/*
 * Oracle 10 — Multi-Compiler WebAssembly DLA
 * Design: Dark Matter Observatory
 *
 * Seven compilers, each WASM binary compiled from a different source language:
 *
 *   WAT   Hand-written WebAssembly Text Format → WASM (1,018 B, bare metal)
 *   Zig   Systems language → wasm32-freestanding (1,314 B, no runtime)
 *   C     Emscripten (clang → WASM, standalone) (1,613 B)
 *   LLVM  C → LLVM IR bitcode → llc-18 -march=wasm32 → wasm-ld-18 (1,065 B)
 *   Rust  cargo build --target wasm32-unknown-unknown --release (467 KB)
 *   ASC   AssemblyScript (TypeScript subset) → WASM (5,106 B)
 *   Go    GOOS=js GOARCH=wasm (~1.9 MB, includes full Go runtime)
 *
 * Conjecture Z-7 is that binary_size ⊥ D_f. Testing it requires every panel to run the SAME
 * algorithm; only then does a size-vs-D_f spread mean anything. ALL SEVEN do now — every panel
 * implements src/wasm-dla/CANONICAL_SPEC.md and agrees exactly (cluster 345 at seed 4,
 * 800 walkers), pinned by bytelock/testdata/golden-seed-*.json.
 *
 * That took four separate corrections, because for a long time this header claimed "same
 * algorithm, same D_f, zero variance" while four panels ran algorithms of their own. Measured at
 * seed 4 against the canonical 345, each immediately before it was moved:
 *
 *   Go    (#11489)  — moved to bytelock/dla-canonical.go
 *   Zig   (#11530)  cluster 1     DEGENERATE — LCG low-2-bits period 4, walkers never left home
 *   C     (here)    cluster 1     DEGENERATE — the identical LCG defect
 *   LLVM  (here)    cluster 1642  ran 3000 walkers, a compile-time constant the panel cannot set
 *   Rust  (here)    cluster 462   100-wide grid with rem_euclid indexing, i.e. a torus
 *
 * The lesson each of the four taught is the same one: a panel that returns a PLAUSIBLE wrong
 * number is the same defect as one that returns 1, only harder to see. So the repair was never to
 * patch the divergent module — it was to stage the substrate the byte-lock already pins, and to
 * let identity-dla-pages-wasm-behavior.test.ts run it and compare against the committed vector.
 *
 * ── WHAT THE CONVERGENCE BANNER CAN AND CANNOT SHOW (read before trusting it) ────────────────
 *
 * Now that all seven agree, the "spread" readout below has become UNFALSIFIABLE, and saying so is
 * part of the fix rather than an aside. `computeDf` is a pure function of cluster size. The
 * byte-lock guarantees all seven substrates compute the same cluster size. Therefore the seven
 * D_f readouts are equal BY ARITHMETIC, and "Spread: 0.0000" is a restatement of the byte-lock,
 * not independent evidence for Z-7. A number that cannot come out any other way measures nothing.
 *
 * What the panel does still honestly demonstrate is the part Z-7 actually claims: seven binaries
 * from seven toolchains, spanning 1,018 B to ~1.9 MB — a ~1,870x range — execute the same
 * algorithm and produce the same trajectory. The evidence is that the SUBSTRATES agree, and it is
 * carried by the byte-lock and its golden vectors, not by the spread arithmetic on this page. The
 * banner is worded accordingly.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { acceptsWasmResult, beginWasmExecution, cancelWasmExecution, idleWasmExecution, type WasmExecutionController } from "@/lib/wasmExecutionController";
import { installGoRuntimeBridge, probeGoOracle, readGoOracle } from "@/lib/goWasmOracle";

const pagesWasmUrl = (file: string): string => `${import.meta.env.BASE_URL}wasm/${file}`;
const ASC_WASM_URL = pagesWasmUrl("dla-asc.wasm");
const WAT_WASM_URL = pagesWasmUrl("dla-wat.wasm");
const ZIG_WASM_URL = pagesWasmUrl("dla-zig.wasm");
const EMCC_WASM_URL = pagesWasmUrl("dla-emcc.wasm");
const LLVM_WASM_URL = pagesWasmUrl("dla-llvm.wasm");
const RUST_WASM_URL = pagesWasmUrl("dla-rust.wasm");
// The Go pair. Unlike the six above, these are BUILT during the Pages deploy (the module
// is ~1.9 MB) — so whether they exist is a fact about the deployed artifact, discovered
// at run time by `probeGoOracle`, never assumed here.
const GO_WASM_URL = pagesWasmUrl("dla-go.wasm");
const GO_BRIDGE_URL = pagesWasmUrl("wasm_exec.js");

const W = 100, H = 100;
const N_WALKERS = 800;

// ── Compute D_f from cluster size using JS Math.log (host-side) ──────────────
function computeDf(clusterSize: number): number {
  if (clusterSize < 2) return 0;
  const n = clusterSize;
  const r = Math.sqrt(n) + 1;
  return Math.log(n) / Math.log(r);
}

/**
 * The reference reading the charts draw their amber line at: what `computeDf` returns for the
 * byte-locked cluster size at seed 4 (`bytelock/testdata/` pins 332 at seed 1 and 339 at seed 42,
 * so this line is seed-4 specific and the dots move slightly with the seed selector).
 *
 * DERIVED, not typed in. The previous line was the literal `1.322`, which is the substrates'
 * hardcoded `get_df()` proxy constant and is not a quantity this panel computes at all — so it sat
 * a full 0.64 away from every dot, on an axis that stopped at 1.8, and nobody noticed for months
 * because the dots were drawn outside the plot area.
 */
const CANONICAL_CLUSTER_AT_SEED_4 = 345;

function radialCells(clusterSize: number): Uint8Array {
  const cells = new Uint8Array(W * H);
  const radius = Math.max(1, Math.sqrt(clusterSize / Math.PI) * 1.2);
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) cells[y * W + x] = 1;
  }
  return cells;
}

/**
 * The canonical spec keeps cos/sin on the HOST so every substrate shares one set of f32 trig
 * bits rather than each compiler's own libm. `Math.fround` mirrors `bytelock/run-wasm.mjs`, the
 * harness that produced the committed golden vectors — the imports are typed `f32`, so the
 * rounding is what the JS→wasm boundary would do anyway, and writing it makes that explicit
 * instead of load-bearing-by-accident.
 */
const canonicalTrig = {
  cos_f32: (x: number): number => Math.fround(Math.cos(x)),
  sin_f32: (x: number): number => Math.fround(Math.sin(x)),
} as const;

/**
 * The canonical ABI: `init(seed)`, `run()`, `get_cluster_size()`. The walker count is fixed
 * inside the module by the spec, so — unlike the divergent substrates these panels used to
 * load — there is no count to pass and no way for a panel to run a different experiment than
 * the byte-lock did.
 */
function runCanonicalModule(instance: WebAssembly.Instance, seed: number): number {
  const exp = instance.exports as unknown as {
    init: (seed: number) => void;
    run: () => void;
    get_cluster_size: () => number;
  };
  exp.init(seed);
  exp.run();
  return exp.get_cluster_size();
}

async function fetchVerifiedWasm(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`teaching error: WASM asset fetch failed (${response.status}) at ${url}`);
  const bytes = await response.arrayBuffer();
  const magic = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (magic.length !== 4 || magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
    throw new Error(`teaching error: WASM asset is not binary module bytes at ${url}`);
  }
  return bytes;
}

// ── Compiler result type ──────────────────────────────────────────────────────
interface CompilerResult {
  name: string;
  lang: string;
  color: string;
  binarySize: string;
  binarySizeBytes: number;
  df: number;
  clusterSize: number;
  elapsed: number;
  status: "pending" | "loading" | "running" | "done" | "cancelled" | "error";
  error?: string;
  cells?: Uint8Array;
}

/**
 * Binary sizes are the X AXIS of the Z-7 scatter below, so a stale one is a wrong plot, not a
 * cosmetic slip. These are `stat` of the staged files on 2026-08-17, after every panel moved onto
 * its canonical substrate — the previous values still described the divergent modules that the
 * panels no longer load (WAT was listed at 697 B and is 1018; Rust at 7,428 B and is 478,353).
 *
 * NAMED RESIDUAL: nothing checks these against the files. They are hand-copied from
 * `PAGES_WASM_ASSETS`'s sources, and this comment is the only thing tying them to a measurement.
 * Go is genuinely approximate — it is built during the Pages deploy, never committed, so its size
 * is a fact about a particular build rather than about the tree.
 */
const COMPILERS: Pick<CompilerResult, "name" | "lang" | "color" | "binarySize" | "binarySizeBytes">[] = [
  { name: "WAT", lang: "WebAssembly Text Format (bare metal)", color: "#f59e0b", binarySize: "1,018 B", binarySizeBytes: 1018 },
  { name: "Zig", lang: "wasm32-freestanding (no runtime)", color: "#f97316", binarySize: "1,314 B", binarySizeBytes: 1314 },
  { name: "C", lang: "Emscripten (clang → WASM, standalone)", color: "#a78bfa", binarySize: "1,613 B", binarySizeBytes: 1613 },
  { name: "LLVM", lang: "C → LLVM IR → llc-18 -march=wasm32 → wasm-ld-18", color: "#e879f9", binarySize: "1,065 B", binarySizeBytes: 1065 },
  { name: "Rust", lang: "cargo build --target wasm32-unknown-unknown --release", color: "#fb923c", binarySize: "467 KB", binarySizeBytes: 478353 },
  { name: "ASC", lang: "AssemblyScript (TypeScript → WASM)", color: "#2dd4bf", binarySize: "5,106 B", binarySizeBytes: 5106 },
  { name: "Go", lang: "GOOS=js GOARCH=wasm (full runtime)", color: "#60a5fa", binarySize: "~1.9 MB", binarySizeBytes: 1900000 },
];

interface OracleWASMProps {
  seed: number;
  onResult?: (df: number) => void;
}

export default function OracleWASM({ seed, onResult }: OracleWASMProps) {
  const [results, setResults] = useState<CompilerResult[]>(
    COMPILERS.map(c => ({ ...c, df: 0, clusterSize: 0, elapsed: 0, status: "pending" as const, binarySizeBytes: c.binarySizeBytes }))
  );
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  const executionRef = useRef<WasmExecutionController>(idleWasmExecution);
  const [execution, setExecution] = useState<WasmExecutionController>(idleWasmExecution);

  const updateResult = useCallback((i: number, patch: Partial<CompilerResult>) => {
    setResults(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r));
  }, []);

  // ── Run WAT oracle (index 0) ─────────────────────────────────────────────────
  const runWAT = useCallback(async (s: number) => {
    updateResult(0, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(WAT_WASM_URL);
      const { instance } = await WebAssembly.instantiate(buf, { math: { cos_f32: Math.cos, sin_f32: Math.sin } });
      const exp = instance.exports as {
        init: (seed: number) => void;
        run: (n: number) => number;
        get_cluster_size: () => number;
      };
      updateResult(0, { status: "running" });
      exp.init(s);
      exp.run(N_WALKERS);
      const clusterSize = exp.get_cluster_size();
      const df = computeDf(clusterSize);
      const cells = radialCells(clusterSize);
      updateResult(0, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells });
      return df;
    } catch (e) {
      updateResult(0, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run Zig oracle (index 1) ─────────────────────────────────────────────────
  // This panel used to load `src/wasm-dla/zig/dla.wasm`, a second Zig DLA on its own PRNG and
  // its own spawn rule, in no byte-lock roster and pinned by no golden vector. It reported
  // cluster size 1 at every seed — its LCG's low two bits have period 4, so `prng % 4` cycled
  // 3,2,1,0 and each walker returned to its spawn point every four steps. It now loads the
  // canonical Zig substrate, which agrees with WAT and AssemblyScript exactly.
  const runZig = useCallback(async (s: number) => {
    updateResult(1, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(ZIG_WASM_URL);
      // Zig's `extern fn` on wasm32-freestanding imports from "env"; the canonical spec keeps
      // cos/sin on the HOST so every substrate shares one set of f32 trig bits.
      const { instance } = await WebAssembly.instantiate(buf, { env: { cos_f32: Math.cos, sin_f32: Math.sin } });
      const exp = instance.exports as {
        init: (seed: number) => void;
        run: () => void;
        get_cluster_size: () => number;
      };
      updateResult(1, { status: "running" });
      exp.init(s);
      exp.run();
      const clusterSize = exp.get_cluster_size();
      const df = computeDf(clusterSize);
      const cells = radialCells(clusterSize);
      updateResult(1, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells });
      return df;
    } catch (e) {
      updateResult(1, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run Emscripten/C oracle (index 2) ────────────────────────────────────────
  // Was `src/wasm-dla/c/dla-emcc.wasm`, a second C DLA whose LCG made every walker return to
  // its spawn cell every four steps — cluster 1 at every seed tried. Now the canonical
  // Emscripten substrate, which imports host trig from "env" and exposes init/run.
  const runEmcc = useCallback(async (s: number) => {
    updateResult(2, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(EMCC_WASM_URL);
      const { instance } = await WebAssembly.instantiate(buf, { env: { ...canonicalTrig } });
      updateResult(2, { status: "running" });
      const clusterSize = runCanonicalModule(instance, s);
      const df = computeDf(clusterSize);
      updateResult(2, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells: radialCells(clusterSize) });
      return df;
    } catch (e) {
      updateResult(2, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run LLVM IR oracle (index 3) ────────────────────────────────────────────
  // Was `src/wasm-dla/c/dla-llvm-opt.wasm`, whose `run_dla(seed)` took no walker count and ran
  // a hardcoded 3000 — so N_WALKERS above never reached it and the panel reported 1642 beside
  // everyone else's 345. The canonical LLVM substrate additionally imports `env.memset`, which
  // the freestanding link leaves undefined; it is called from `init`, so binding the memory
  // straight after instantiation is early enough.
  const runLLVM = useCallback(async (s: number) => {
    updateResult(3, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(LLVM_WASM_URL);
      let memory: WebAssembly.Memory | null = null;
      const { instance } = await WebAssembly.instantiate(buf, {
        env: {
          ...canonicalTrig,
          memset: (ptr: number, value: number, len: number) => {
            if (!memory) throw new Error("teaching error: memset called before memory was bound");
            new Uint8Array(memory.buffer).fill(value & 0xff, ptr, ptr + len);
            return ptr;
          },
        },
      });
      memory = instance.exports.memory as WebAssembly.Memory;
      updateResult(3, { status: "running" });
      const clusterSize = runCanonicalModule(instance, s);
      const df = computeDf(clusterSize);
      updateResult(3, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells: radialCells(clusterSize) });
      return df;
    } catch (e) {
      updateResult(3, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run Rust oracle (index 4) ────────────────────────────────────────────────
  // Was `src/wasm-dla/rust/dla-opt.wasm`, a second Rust DLA on a 100-wide grid indexed through
  // `rem_euclid` — a torus, so its kill radius could never fire and a walker leaving one edge
  // re-entered the other. It reported 462. Now the canonical Rust substrate.
  const runRust = useCallback(async (s: number) => {
    updateResult(4, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(RUST_WASM_URL);
      const { instance } = await WebAssembly.instantiate(buf, { env: { ...canonicalTrig } });
      updateResult(4, { status: "running" });
      const clusterSize = runCanonicalModule(instance, s);
      const df = computeDf(clusterSize);
      updateResult(4, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells: radialCells(clusterSize) });
      return df;
    } catch (e) {
      updateResult(4, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run AssemblyScript oracle (index 5) ──────────────────────────────────────
  const runASC = useCallback(async (s: number) => {
    updateResult(5, { status: "loading" });
    const t0 = performance.now();
    try {
      const buf = await fetchVerifiedWasm(ASC_WASM_URL);
      const { instance } = await WebAssembly.instantiate(buf, { env: { abort: () => {} }, "dla-canonical": { sin_f32: Math.sin, cos_f32: Math.cos } });
      const exp = instance.exports as {
        init: (seed: number) => void;
        run: (n: number) => number;
        getClusterSize: () => number;
      };
      updateResult(5, { status: "running" });
      exp.init(s);
      exp.run(N_WALKERS);
      const clusterSize = exp.getClusterSize();
      const df = computeDf(clusterSize);
      const cells = radialCells(clusterSize);
      updateResult(5, { df, clusterSize, elapsed: (performance.now() - t0) / 1000, status: "done", cells });
      return df;
    } catch (e) {
      updateResult(5, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  // ── Run Go oracle (index 6) ──────────────────────────────────────────────────
  //
  // Until 2026-08-17 this function's whole body was a hardcoded
  //   "pending: Pages build does not yet produce the Go module"
  // which was TRUE — no workflow compiled Go — and which would have stayed on screen
  // unchanged on the day that stopped being true. The status is now derived from the
  // artifact: `probeGoOracle` fetches the module and its runtime bridge, and every
  // outcome (absent, half-published, not a module, degenerate run, measured D_f) is
  // reported as what was actually found.
  const runGo = useCallback(async (s: number) => {
    updateResult(6, { status: "loading" });
    const t0 = performance.now();
    try {
      // Wrapped, not passed bare: an unbound `fetch` loses its `this` and throws
      // "Illegal invocation" in a browser.
      const probe = await probeGoOracle((url: string) => fetch(url), GO_WASM_URL, GO_BRIDGE_URL);
      if (!probe.available) {
        updateResult(6, { status: "error", error: probe.reason });
        return null;
      }
      // `wasm_exec.js` is the Go runtime's JS half; it defines `globalThis.Go`.
      installGoRuntimeBridge(probe.bridgeSource);
      const goRuntime = (globalThis as unknown as { Go: new () => { importObject: WebAssembly.Imports; run: (instance: WebAssembly.Instance) => Promise<void> } }).Go;
      const go = new goRuntime();
      const { instance } = await WebAssembly.instantiate(probe.moduleBytes, go.importObject);
      updateResult(6, { status: "running" });
      // `main()` registers the dla_* globals and then blocks on `select {}`, so this
      // promise never settles — awaiting it would hang the panel forever.
      void go.run(instance);
      const registered = globalThis as unknown as {
        dla_init: (seed: number) => void;
        dla_run: () => void;
        dla_get_cluster_size: () => number;
      };
      registered.dla_init(s);
      registered.dla_run();
      const reading = readGoOracle(registered.dla_get_cluster_size(), computeDf);
      if (reading.kind === "degenerate") {
        updateResult(6, { status: "error", error: reading.reason });
        return null;
      }
      updateResult(6, {
        df: reading.df,
        clusterSize: reading.clusterSize,
        elapsed: (performance.now() - t0) / 1000,
        status: "done",
        cells: radialCells(reading.clusterSize),
      });
      return reading.df;
    } catch (e) {
      updateResult(6, { status: "error", error: String(e) });
      return null;
    }
  }, [updateResult]);

  const stop = useCallback(() => {
    const next = cancelWasmExecution(executionRef.current);
    executionRef.current = next;
    setExecution(next);
    setResults(previous => previous.map(result => result.status === "done" || result.status === "error" ? result : { ...result, status: "cancelled" }));
  }, []);

  const start = useCallback(() => {
    if (executionRef.current.running) return;
    const next = beginWasmExecution(executionRef.current);
    executionRef.current = next;
    setExecution(next);
    setResults(COMPILERS.map(c => ({ ...c, df: 0, clusterSize: 0, elapsed: 0, status: "pending" as const })));
    const generation = next.generation;
    const run = async () => {
      const runners = [runWAT, runZig, runEmcc, runLLVM, runRust, runASC, runGo] as const;
      const values: number[] = [];
      for (const runner of runners) {
        if (!acceptsWasmResult(executionRef.current, generation)) return;
        const value = await runner(seed);
        if (!acceptsWasmResult(executionRef.current, generation)) return;
        if (value !== null && value > 0) values.push(value);
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
      }
      if (!acceptsWasmResult(executionRef.current, generation)) return;
      const complete = cancelWasmExecution(executionRef.current);
      executionRef.current = complete;
      setExecution(complete);
      if (values.length > 0) onResultRef.current?.(values.reduce((a, b) => a + b, 0) / values.length);
    };
    void run();
  }, [seed, runWAT, runZig, runEmcc, runLLVM, runRust, runASC, runGo]);

  useEffect(() => {
    if (!executionRef.current.running) setResults(COMPILERS.map(c => ({ ...c, df: 0, clusterSize: 0, elapsed: 0, status: "pending" as const })));
  }, [seed]);

  // ── Canvas refs (one per compiler) ───────────────────────────────────────────
  const canvasRefs = [
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
  ];

  useEffect(() => {
    results.forEach((r, i) => {
      const canvas = canvasRefs[i].current;
      if (!canvas || !r.cells) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cw = canvas.width, ch = canvas.height;
      const cellW = cw / W, cellH = ch / H;
      ctx.fillStyle = "#07070f";
      ctx.fillRect(0, 0, cw, ch);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (r.cells[y * W + x]) {
            ctx.fillStyle = r.color;
            ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
          }
        }
      }
    });
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneResults = results.filter(r => r.status === "done" && r.df > 0);
  const spread = doneResults.length > 1
    ? Math.max(...doneResults.map(r => r.df)) - Math.min(...doneResults.map(r => r.df))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ fontSize: "0.6rem", color: "var(--muted-foreground)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {results.length} compiled modules · explicit start · sequential execution · cancellable between modules
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={start} disabled={execution.running} style={{ padding: "0.5rem 0.75rem", border: "1px solid #2dd4bf", background: execution.running ? "rgba(45,212,191,0.1)" : "rgba(45,212,191,0.2)", color: "#ccfbf1", font: "inherit" }}>{execution.running ? "running…" : "run compiler experiment"}</button>
        <button type="button" onClick={stop} disabled={!execution.running} style={{ padding: "0.5rem 0.75rem", border: "1px solid #f59e0b", background: "rgba(245,158,11,0.12)", color: "#fde68a", font: "inherit" }}>stop after current module</button>
        <span style={{ alignSelf: "center", color: "var(--muted-foreground)", fontSize: "0.55rem" }}>No compiler module runs merely because this page rendered.</span>
      </div>

      {/* Compiler panels — 2×2 grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
        {results.map((r, i) => (
          <div key={r.name} style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${r.status === "done" ? r.color + "40" : "var(--border)"}`,
            padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem",
            transition: "border-color 0.3s",
          }}>
            {/* Compiler name + binary size */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: r.color, letterSpacing: "0.08em" }}>
                  {r.name}
                </span>
                <span style={{ fontSize: "0.5rem", color: "var(--muted-foreground)", fontFamily: "monospace" }}>
                  {r.binarySize}
                </span>
              </div>
              <span style={{ fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
                {r.status === "pending" && "waiting"}
                {r.status === "loading" && "loading…"}
                {r.status === "running" && "running…"}
                {r.status === "done" && `${r.elapsed.toFixed(2)}s`}
                {r.status === "cancelled" && "cancelled"}
                {r.status === "error" && "error"}
              </span>
            </div>
            <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)", lineHeight: 1.4 }}>{r.lang}</div>

            {/* Canvas */}
            <canvas
              ref={canvasRefs[i]}
              width={200} height={200}
              style={{ width: "100%", aspectRatio: "1", background: "#07070f", border: "1px solid var(--border)" }}
            />

            {/* D_f readout */}
            <div style={{ textAlign: "center" }}>
              {r.status === "done" ? (
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: r.color, fontFamily: "monospace" }}>
                  D<sub style={{ fontSize: "0.7rem" }}>f</sub> = {r.df.toFixed(3)}
                </span>
              ) : r.status === "error" ? (
                <span style={{ fontSize: "0.55rem", color: "#f87171" }}>{r.error?.slice(0, 60)}</span>
              ) : (
                <span style={{ fontSize: "0.6rem", color: "var(--muted-foreground)", letterSpacing: "0.1em" }}>
                  {r.status === "pending" ? "—" : "computing…"}
                </span>
              )}
            </div>
            {r.status === "done" && (
              <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)", textAlign: "center" }}>
                {r.clusterSize.toLocaleString()} cells stuck
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Convergence bar */}
      {doneResults.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
          padding: "0.6rem 0.75rem", fontSize: "0.6rem", color: "var(--muted-foreground)",
          display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
        }}>
          <span style={{ color: "#f59e0b", fontWeight: 700, letterSpacing: "0.1em" }}>
            Z-7 COMPILER CONVERGENCE
          </span>
          {doneResults.map(r => (
            <span key={r.name}>
              <span style={{ color: r.color }}>{r.name}</span>
              {" ("}
              <span style={{ fontFamily: "monospace", fontSize: "0.5rem" }}>{r.binarySize}</span>
              {"): "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{r.df.toFixed(4)}</span>
            </span>
          ))}
          {spread !== null && (
            <span>
              Spread:{" "}
              <span style={{ color: spread < 0.05 ? "#34d399" : "#f87171", fontWeight: 700 }}>
                {spread.toFixed(4)}
              </span>
              {/*
                Deliberately NOT "Z-7 CONFIRMED". D_f here is a pure function of cluster size and
                the byte-lock pins the cluster size, so a zero spread is arithmetic, not a
                measurement — it could not have come out otherwise. A nonzero spread, however,
                would be real news: it would mean a panel is off the canonical substrate again,
                which is exactly how this page read for months. So the readout is kept, and only
                the claim attached to it is corrected.
              */}
              <span style={{ color: spread < 0.05 ? "#34d399" : "#f87171", marginLeft: "0.5rem" }}>
                {spread < 0.05
                  ? "all panels on the canonical substrate — a zero spread is expected here, not evidence"
                  : "DIVERGENCE — a panel is not running the byte-locked algorithm"}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Live scatter plot — Z-7 visual proof: binary size (x, log) vs D_f (y) */}
      {(() => {
        const SVG_W = 400, SVG_H = 160;
        const PAD = { left: 48, right: 16, top: 12, bottom: 36 };
        const plotW = SVG_W - PAD.left - PAD.right;
        const plotH = SVG_H - PAD.top - PAD.bottom;
        const minLog = Math.log10(600), maxLog = Math.log10(2000000);
        // The axis used to run 1.0–1.8 around a reference line at 1.322. Both were wrong: 1.322 is
        // the substrates' hardcoded `get_df()` PROXY CONSTANT (see src/wasm-dla/README.md), which
        // this panel does not use, and `computeDf(345)` — what it does use — is 1.9647. Every dot
        // was therefore drawn above the plot area. The range now brackets the value actually shown.
        const minDf = 1.6, maxDf = 2.2;
        const toX = (bytes: number) => PAD.left + ((Math.log10(bytes) - minLog) / (maxLog - minLog)) * plotW;
        const toY = (df: number) => PAD.top + plotH - ((df - minDf) / (maxDf - minDf)) * plotH;
        // X-axis tick marks
        const xTicks = [1000, 10000, 100000, 1000000];
        const xTickLabel = (b: number) => b >= 1048576 ? `${(b/1048576).toFixed(0)}M` : b >= 1024 ? `${(b/1024).toFixed(0)}K` : `${b}`;
        // The canonical reading, stated as the measured quantity it is: computeDf(345) at seed 4,
        // 800 walkers — a mass-radius proxy, NOT a box-counting dimension and NOT the ≈1.71
        // large-N asymptote for 2-D DLA.
        const refDf = computeDf(CANONICAL_CLUSTER_AT_SEED_4);
        return (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", padding: "0.75rem" }}>
            <div style={{ fontSize: "0.55rem", color: "var(--muted-foreground)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem" }}>
              Live Scatter Plot — Binary Size (log) vs D_f — Z-7 Visual Proof
            </div>
            <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: "visible", display: "block" }}>
              {/* Grid lines */}
              {[1.7, 1.8, 1.9, refDf, 2.0, 2.1].map(df => (
                <line key={df}
                  x1={PAD.left} y1={toY(df)} x2={PAD.left + plotW} y2={toY(df)}
                  stroke={df === refDf ? "#f59e0b" : "rgba(255,255,255,0.04)"}
                  strokeWidth={df === refDf ? 1.5 : 0.5}
                  strokeDasharray={df === refDf ? "4 3" : "none"}
                />
              ))}
              {/* Reference D_f label — the measured canonical reading, not the 1.322 proxy */}
              <text x={PAD.left + plotW + 3} y={toY(refDf) + 3} fontSize="7" fill="#f59e0b" fontFamily="monospace">D_f={refDf.toFixed(3)}</text>
              {/* X axis */}
              <line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              {/* Y axis */}
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              {/* X ticks */}
              {xTicks.map(b => (
                <g key={b}>
                  <line x1={toX(b)} y1={PAD.top + plotH} x2={toX(b)} y2={PAD.top + plotH + 4} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                  <text x={toX(b)} y={PAD.top + plotH + 12} fontSize="7" fill="rgba(255,255,255,0.35)" textAnchor="middle" fontFamily="monospace">{xTickLabel(b)}</text>
                </g>
              ))}
              {/* Y ticks */}
              {[1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2].map(df => (
                <g key={df}>
                  <line x1={PAD.left - 4} y1={toY(df)} x2={PAD.left} y2={toY(df)} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                  <text x={PAD.left - 6} y={toY(df) + 3} fontSize="7" fill="rgba(255,255,255,0.35)" textAnchor="end" fontFamily="monospace">{df.toFixed(1)}</text>
                </g>
              ))}
              {/* Axis labels */}
              <text x={PAD.left + plotW / 2} y={SVG_H - 2} fontSize="7" fill="rgba(255,255,255,0.4)" textAnchor="middle" fontFamily="monospace">Binary Size (bytes, log scale)</text>
              <text x={8} y={PAD.top + plotH / 2} fontSize="7" fill="rgba(255,255,255,0.4)" textAnchor="middle" fontFamily="monospace" transform={`rotate(-90, 8, ${PAD.top + plotH / 2})`}>D_f</text>
              {/* Data points — animate in as each compiler finishes */}
              {results.map((r) => {
                if (r.status !== "done" || r.df <= 0) return null;
                const cx = toX(r.binarySizeBytes);
                const cy = toY(r.df);
                return (
                  <g key={r.name}>
                    <circle cx={cx} cy={cy} r={6} fill={r.color} opacity={0.85} />
                    <circle cx={cx} cy={cy} r={6} fill="none" stroke={r.color} strokeWidth={1.5} opacity={0.4} />
                    <text x={cx} y={cy - 9} fontSize="7" fill={r.color} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{r.name}</text>
                  </g>
                );
              })}
              {/* Pending dots (ghost) */}
              {results.map((r) => {
                if (r.status === "done") return null;
                const cx = toX(r.binarySizeBytes);
                return (
                  <circle key={r.name} cx={cx} cy={toY(refDf)} r={4}
                    fill="none" stroke={r.color} strokeWidth={1} opacity={0.2}
                    strokeDasharray="2 2"
                  />
                );
              })}
              {/* Least-squares regression line — computed over done results */}
              {(() => {
                const done = results.filter(r => r.status === "done" && r.df > 0);
                if (done.length < 2) return null;
                // Regression in log(size) vs D_f space
                const xs2 = done.map(r => Math.log10(r.binarySizeBytes));
                const ys2 = done.map(r => r.df);
                const n2 = done.length;
                const mx = xs2.reduce((a, b) => a + b, 0) / n2;
                const my = ys2.reduce((a, b) => a + b, 0) / n2;
                const num2 = xs2.reduce((a, x, i) => a + (x - mx) * (ys2[i] - my), 0);
                const den2 = xs2.reduce((a, x) => a + (x - mx) ** 2, 0);
                const slope = den2 === 0 ? 0 : num2 / den2;
                const intercept = my - slope * mx;
                // Draw line from x=minSize to x=maxSize
                const x1log = Math.log10(Math.min(...done.map(r => r.binarySizeBytes)));
                const x2log = Math.log10(Math.max(...done.map(r => r.binarySizeBytes)));
                const y1reg = intercept + slope * x1log;
                const y2reg = intercept + slope * x2log;
                const rx1 = toX(10 ** x1log);
                const rx2 = toX(10 ** x2log);
                const ry1 = toY(y1reg);
                const ry2 = toY(y2reg);
                return (
                  <g>
                    <line x1={rx1} y1={ry1} x2={rx2} y2={ry2}
                      stroke="rgba(255,255,255,0.35)" strokeWidth={1.5}
                      strokeDasharray="5 3"
                    />
                    <text x={rx2 + 3} y={ry2 + 3} fontSize="7" fill="rgba(255,255,255,0.5)" fontFamily="monospace">
                      slope={slope.toFixed(5)}
                    </text>
                  </g>
                );
              })()}
            </svg>
            <div style={{ fontSize: "0.5rem", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
              Each dot appears as its compiler finishes. All seven land exactly on the amber line across a ~1,870× size range
              (1,018 B → ~1.9 MB). They land <em>exactly</em>, not approximately, because all seven run the byte-locked
              canonical algorithm and D_f here is a function of cluster size alone — so the flat regression is the byte-lock
              restated, and a dot off the line would be the informative event.
            </div>
          </div>
        );
      })()}

      {/* Z-7 explanation */}
      <div style={{ fontSize: "0.52rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--foreground)" }}>Conjecture Z-7 (binary_size ⊥ D_f):</strong>{" "}
        The LLVM binary (1,065 B) is the smallest and traverses the longest pipeline — C source → LLVM IR bitcode →
        llc-18 -march=wasm32 → wasm-ld-18. The Rust binary (467 KB) is 449× larger, and the Go binary (~1.9 MB) carries a
        whole language runtime. All seven compute the identical cluster (345 at seed 4, 800 walkers) and therefore the
        identical D_f. What that supports is the claim as stated — the result is a property of the algorithm, not of the
        substrate — and the load-bearing evidence is that seven independently compiled binaries agree
        <em> trajectory-for-trajectory</em>, checked in CI against committed golden vectors, not the spread arithmetic on
        this page. Note also that D_f here is a mass-radius proxy at N=800; it is neither a box-counting estimate nor the
        ≈1.71 large-N asymptote for 2-D DLA (Halsey 2000).
      </div>

      {/* Convergence speed chart — D_f estimate vs walker count per compiler */}
      {(() => {
        const done = results.filter(r => r.status === "done" && r.df > 0);
        if (done.length === 0) return null;
        // Simulate convergence curves: each compiler converges at a rate proportional
        // to 1/sqrt(N) from a starting estimate, reaching the final D_f.
        // Smaller binaries (WAT, Zig) converge faster due to less overhead per step.
        const STEPS = 20;
        const WALKERS_MAX = 800;
        const SVG_CW = 320;
        const SVG_CH = 100;
        const CPad = { top: 12, right: 10, bottom: 22, left: 32 };
        const cPlotW = SVG_CW - CPad.left - CPad.right;
        const cPlotH = SVG_CH - CPad.top - CPad.bottom;
        const toXC = (w: number) => CPad.left + (w / WALKERS_MAX) * cPlotW;
        // Was 1.1–1.6 around a 1.322 line, which no longer contains the value the panel computes.
        const dfMin = 1.7, dfMax = 2.2;
        const toYC = (df: number) => CPad.top + cPlotH - ((df - dfMin) / (dfMax - dfMin)) * cPlotH;
        // Overhead factor: an INVENTED shape, not a measured one — see the caption below.
        const overheadFactor = (bytes: number) => 1 + Math.log10(bytes / 1018) * 0.15;
        return (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.52rem", color: "#fbbf24", fontWeight: 700, marginBottom: "0.25rem" }}>
              Convergence Speed — ILLUSTRATION ONLY, NOT MEASURED DATA
            </div>
            <svg width="100%" viewBox={`0 0 ${SVG_CW} ${SVG_CH}`} style={{ overflow: "visible", display: "block" }}>
              {/* Reference line — the measured canonical reading; the CURVES around it are not measured */}
              <line x1={CPad.left} y1={toYC(computeDf(CANONICAL_CLUSTER_AT_SEED_4))} x2={CPad.left + cPlotW} y2={toYC(computeDf(CANONICAL_CLUSTER_AT_SEED_4))}
                stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
              <text x={CPad.left + cPlotW + 2} y={toYC(computeDf(CANONICAL_CLUSTER_AT_SEED_4)) + 3} fontSize="6" fill="#f59e0b" fontFamily="monospace">{computeDf(CANONICAL_CLUSTER_AT_SEED_4).toFixed(3)}</text>
              {/* Y axis */}
              <line x1={CPad.left} y1={CPad.top} x2={CPad.left} y2={CPad.top + cPlotH} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              {/* X axis */}
              <line x1={CPad.left} y1={CPad.top + cPlotH} x2={CPad.left + cPlotW} y2={CPad.top + cPlotH} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              {/* X ticks */}
              {[0, 200, 400, 600, 800].map(w => (
                <g key={w}>
                  <line x1={toXC(w)} y1={CPad.top + cPlotH} x2={toXC(w)} y2={CPad.top + cPlotH + 3} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                  <text x={toXC(w)} y={CPad.top + cPlotH + 10} fontSize="6" fill="rgba(255,255,255,0.35)" textAnchor="middle" fontFamily="monospace">{w}</text>
                </g>
              ))}
              {/* Y ticks */}
              {[1.7, 1.8, 1.9, 2.0, 2.1].map(df => (
                <g key={df}>
                  <line x1={CPad.left - 3} y1={toYC(df)} x2={CPad.left} y2={toYC(df)} stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} />
                  <text x={CPad.left - 4} y={toYC(df) + 2} fontSize="6" fill="rgba(255,255,255,0.3)" textAnchor="end" fontFamily="monospace">{df.toFixed(1)}</text>
                </g>
              ))}
              {/* Axis labels */}
              <text x={CPad.left + cPlotW / 2} y={SVG_CH - 2} fontSize="6" fill="rgba(255,255,255,0.35)" textAnchor="middle" fontFamily="monospace">Walkers accumulated</text>
              {/* Convergence curves per compiler */}
              {done.map(r => {
                const oh = overheadFactor(r.binarySizeBytes);
                const points: string[] = [];
                for (let i = 0; i <= STEPS; i++) {
                  const w = (i / STEPS) * WALKERS_MAX;
                  if (w === 0) { points.push(`${toXC(0)},${toYC(1.5)}`); continue; }
                  // Convergence model: estimate approaches final D_f with noise ~ 1/sqrt(w) * overhead
                  const noise = (oh * 0.3) / Math.sqrt(w + 1);
                  const estimate = r.df + noise * (i % 3 === 0 ? 1 : -0.5);
                  points.push(`${toXC(w)},${toYC(Math.max(dfMin, Math.min(dfMax, estimate)))}`);
                }
                return (
                  <polyline key={r.name}
                    points={points.join(" ")}
                    fill="none" stroke={r.color} strokeWidth={1.2} opacity={0.75}
                  />
                );
              })}
              {/* Legend dots */}
              {done.map((r, i) => (
                <g key={r.name}>
                  <circle cx={CPad.left + 5 + (i % 4) * 72} cy={CPad.top + 6 + Math.floor(i / 4) * 10} r={3} fill={r.color} opacity={0.85} />
                  <text x={CPad.left + 10 + (i % 4) * 72} y={CPad.top + 9 + Math.floor(i / 4) * 10} fontSize="6" fill={r.color} fontFamily="monospace">{r.name}</text>
                </g>
              ))}
            </svg>
            <div style={{ fontSize: "0.45rem", color: "var(--muted-foreground)", marginTop: "0.2rem" }}>
              These curves are GENERATED, not measured: each is the panel's final D_f plus an invented 1/√N wobble scaled by
              binary size. No convergence history is recorded — the substrates report only a final cluster size — so the
              earlier caption here (&ldquo;smaller binaries converge faster&rdquo;) asserted a causal claim nothing on this
              page tests. Kept as a sketch of the shape a real measurement would take, marked so it cannot be cited.
            </div>
          </div>
        );
      })()}
    </div>
  );
}
