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
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
      run("emcc", [
        "-O2",
        "-s", "WASM=1",
        "-s", "SIDE_MODULE=1",
        "-s", "EXPORTED_FUNCTIONS=['_run']",
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
      // Step 1: build-lib produces an ar archive (libdla-canonical.a)
      run("zig", [
        "build-lib", "dla-canonical.zig",
        "-target", "wasm32-freestanding",
        "-O", "ReleaseSafe",
      ]);
      // Step 2: extract the .o and link with wasm-ld
      const extractDir = "/tmp/zig-bytelock-extract";
      if (existsSync(extractDir)) rmSync(extractDir, { recursive: true });
      mkdirSync(extractDir);
      execSync(`cp libdla-canonical.a ${extractDir}/`, { cwd: __dir });
      execSync(`ar x libdla-canonical.a`, { cwd: extractDir });
      const objs = readdirSync(extractDir).filter((f) => f.endsWith(".o"));
      if (objs.length === 0) throw new Error("Zig: no .o files extracted from archive");
      run("wasm-ld", [
        "--no-entry",
        "--allow-undefined",
        "--export-all",
        "-o", join(__dir, "dla-canonical-zig.wasm"),
        ...objs.map((o) => join(extractDir, o)),
      ]);
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
      const env = { ...process.env, GOOS: "js", GOARCH: "wasm" };
      spawnSync("go", ["build", "-o", "dla-canonical-go.wasm", "."], {
        cwd: __dir,
        env,
        stdio: "inherit",
      });
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: __dir, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with status ${result.status}`);
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
