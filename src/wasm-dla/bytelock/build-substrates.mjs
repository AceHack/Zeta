#!/usr/bin/env node
/**
 * build-substrates.mjs — Compile all 9 DLA byte-lock substrates from source.
 *
 * Run this before run-bytelock-ci.mjs whenever the source files change or
 * after a fresh clone (compiled binaries are in .gitignore).
 *
 * Usage:
 *   node build-substrates.mjs              # build all
 *   node build-substrates.mjs --only=Rust  # build one substrate by name
 *   node build-substrates.mjs --check      # verify all binaries exist (no build)
 *
 * Exit codes:
 *   0 — all requested substrates built successfully
 *   1 — one or more substrates failed to build
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const onlyFilter = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const checkOnly = args.includes("--check");

// ─────────────────────────────────────────────────────────────────────────────
// Substrate build definitions
// ─────────────────────────────────────────────────────────────────────────────

const SUBSTRATES = [
  {
    name: "WAT",
    output: "dla-canonical-wat.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-wat.wasm")),
    build: () => {
      run("wat2wasm", ["dla-canonical.wat", "-o", "dla-canonical-wat.wasm"]);
    },
  },
  {
    name: "LLVM/C",
    output: "dla-canonical-llvm.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-llvm.wasm")),
    build: () => {
      run("clang", [
        "--target=wasm32",
        "-nostdlib",
        "-Wl,--no-entry",
        "-Wl,--allow-undefined",
        "-Wl,--export-all",
        "-O2",
        "-o", "dla-canonical-llvm.wasm",
        "dla-canonical.c",
      ]);
    },
  },
  {
    name: "Emscripten",
    output: "dla-canonical-emcc.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-emcc.wasm")),
    build: () => {
      // CORRECTED 2026-08-17. This recipe was `-s SIDE_MODULE=1 -s EXPORTED_FUNCTIONS=['_run']`,
      // and on emscripten 5.0.7 that does not reproduce the committed `dla-canonical-emcc.wasm`:
      // it emits a RELOCATABLE side module that imports `env.__memory_base` and exports no
      // `memory`, so the byte-lock harness cannot instantiate it at all —
      // `LinkError: imported global env:__memory_base must be a number`. The committed module is
      // a standalone one: two imports (`env.cos_f32`, `env.sin_f32`), its own memory, and
      // `_initialize` / `stackSave` in its export list.
      //
      // So condition 3 of `.claude/rules/no-binary-in-proof-lineage.md` — "reproducible from
      // committed source" — did not actually hold for this substrate. A recipe that cannot
      // produce a loadable module is not a reproduction, and nothing checked, because the
      // artifact is committed and the build is only run by hand.
      //
      // The flags below were bisected against the committed artifact's own import/export shape
      // and confirmed by MEASUREMENT rather than inspection: rebuilt here they return
      // 332 / 345 / 339 at seeds 1 / 4 / 42 — identical to the committed module.
      //
      // Honest limit: still NOT byte-identical on this toolchain (emcc 5.0.7-git), so the
      // reproduction is behavioural, not bitwise. Which emscripten produced the committed bytes
      // is recorded nowhere; pinning it is separate work.
      //
      // ERROR_ON_UNDEFINED_SYMBOLS=0 is load-bearing rather than a silencer: `cos_f32`/`sin_f32`
      // are deliberately host-provided — the spec keeps trig on the host so every substrate
      // shares one set of f32 bits — so they MUST link undefined and arrive as imports.
      run("emcc", [
        "-O2",
        "-s", "WASM=1",
        "-s", "STANDALONE_WASM=1",
        "--no-entry",
        "-s", "ERROR_ON_UNDEFINED_SYMBOLS=0",
        "-s", "EXPORTED_FUNCTIONS=['_init','_run','_get_cluster_size','_get_max_r_bits','_get_trajectory_entry']",
        "-o", "dla-canonical-emcc.wasm",
        "dla-canonical.c",
      ]);
    },
  },
  {
    name: "Rust",
    output: "dla-canonical-rust.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-rust.wasm")),
    build: () => {
      // Ensure wasm32 target is installed
      spawnSync("rustup", ["target", "add", "wasm32-unknown-unknown"], { stdio: "inherit" });
      run("rustc", [
        "--edition", "2021",
        "--target", "wasm32-unknown-unknown",
        "-C", "opt-level=s",
        "-C", "link-args=--allow-undefined",
        "-C", "panic=abort",
        "--crate-type", "cdylib",
        "-o", "dla-canonical-rust.wasm",
        "dla-canonical.rs",
      ]);
    },
  },
  {
    name: "AssemblyScript",
    output: "dla-canonical-asc.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-asc.wasm")),
    build: () => {
      run("npx", [
        "asc", "dla-canonical.ts",
        "--outFile", "dla-canonical-asc.wasm",
        "--optimize",
        "--noAssert",
        "--runtime", "stub",
      ]);
    },
  },
  {
    name: "Zig",
    output: "dla-canonical-zig.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-zig.wasm")),
    build: () => {
      // SINGLE STEP. `zig build-exe -fno-entry` links a complete WebAssembly module by
      // itself; Zig ships its own linker, so no external `wasm-ld` and no `ar` unpacking
      // is involved. This is also the command `.mise.toml` documents for this substrate.
      //
      // WHY THE OLD TWO-STEP ROUTE WAS REMOVED (2026-08-15): step 1 (`zig build-lib`)
      // emits BOTH `libdla-canonical.a` (an `ar` archive) and a same-named `.wasm` that is
      // itself the archive, and step 2 needed `wasm-ld` on PATH. When step 2 was skipped
      // or unavailable, step 1's archive was left sitting where a module was expected —
      // and that is exactly what was committed: `dla-canonical-zig.wasm` starting with
      // `!<arch>` (`21 3c 61 72`) rather than `00 61 73 6d`. It loaded in no run for two
      // weeks. A build whose intermediate has the same name as its output is a trap; this
      // route has no intermediate.
      run("zig", [
        "build-exe", "dla-canonical.zig",
        "-target", "wasm32-freestanding",
        "-O", "ReleaseSmall",
        "-fno-entry",
        "--export=init",
        "--export=run",
        "--export=get_cluster_size",
        "--export=get_max_r_bits",
        "--export=get_trajectory_entry",
        "-femit-bin=" + join(__dir, "dla-canonical-zig.wasm"),
      ]);
      // Named exports rather than `--export-all`: the runner needs exactly these five, and
      // an export list that names them fails at BUILD time if a symbol is renamed, instead
      // of at run time as an undefined-function error midway through a seed.
      verifyWasmHeader(join(__dir, "dla-canonical-zig.wasm"), "Zig");
    },
  },
  {
    name: "JS (V8)",
    output: null, // no binary — runs directly via Node.js
    check: () => existsSync(join(__dir, "dla-canonical-source.js")),
    build: () => {
      // No compilation needed — JS runs directly in Node.js (V8 engine)
      console.log("  JS (V8): no compilation needed — runs directly via Node.js");
    },
  },
  {
    name: "Lua 5.4",
    output: "dla-canonical.luac",
    check: () => existsSync(join(__dir, "dla-canonical.luac")),
    build: () => {
      run("luac5.4", ["-o", "dla-canonical.luac", "dla-canonical.lua"]);
    },
  },
  {
    name: "Go",
    output: "dla-canonical-go.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-go.wasm")),
    build: () => {
      // Ensure go.mod exists
      if (!existsSync(join(__dir, "go.mod"))) {
        execSync("go mod init dla-bytelock", { cwd: __dir, stdio: "inherit" });
      }
      // `run`, not a bare `spawnSync`. Until 2026-08-15 this call ignored its exit status,
      // so a failed `go build` reported "Building Go... OK" and produced no artefact — the
      // same false-green shape as the rest of this finding, one layer earlier.
      run("go", ["build", "-o", "dla-canonical-go.wasm", "."], {
        env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
      });
      verifyWasmHeader(join(__dir, "dla-canonical-go.wasm"), "Go");
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { cwd: __dir, stdio: "inherit", ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with status ${result.status}`);
  }
}

// A BUILD MUST NOT BE ABLE TO EMIT A NON-MODULE AND CALL IT SUCCESS.
// `dla-canonical-zig.wasm` was an `ar` archive on main for two weeks because the Zig
// route's intermediate shared a name with its output. The runner now refuses to load such
// a file (exit 3); this refuses to PRODUCE one, which is where the defect is cheapest to
// catch. Checks the 4-byte magic plus the 4-byte binary-format version.
function verifyWasmHeader(path, name) {
  const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const head = readFileSync(path).subarray(0, WASM_HEADER.length);
  if (head.length !== WASM_HEADER.length || !WASM_HEADER.every((b, i) => head[i] === b)) {
    const found = [...head].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    throw new Error(
      `${name}: produced ${path} but it is NOT a WebAssembly module — ` +
        `expected header ${WASM_HEADER.map((b) => b.toString(16).padStart(2, "0")).join(" ")}, found ${found}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const targets = onlyFilter
  ? SUBSTRATES.filter((s) => s.name.toLowerCase().includes(onlyFilter.toLowerCase()))
  : SUBSTRATES;

if (targets.length === 0) {
  console.error(`No substrate matches --only=${onlyFilter}`);
  process.exit(1);
}

let failed = 0;

for (const s of targets) {
  if (checkOnly) {
    const ok = s.check();
    console.log(`${ok ? "✓" : "✗"} ${s.name}${s.output ? ` (${s.output})` : ""}`);
    if (!ok) failed++;
    continue;
  }

  process.stdout.write(`Building ${s.name}... `);
  try {
    s.build();
    console.log("OK");
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
    failed++;
  }
}

if (checkOnly) {
  console.log(`\n${targets.length - failed}/${targets.length} substrates present.`);
} else {
  console.log(`\n${targets.length - failed}/${targets.length} substrates built successfully.`);
}

process.exit(failed > 0 ? 1 : 0);
