#!/usr/bin/env node
/**
 * build-substrates.mjs — Compile all 9 DLA byte-lock substrates from source.
 *
 * Run this before run-bytelock-ci.mjs whenever the source files change or
 * after a fresh clone. NOTHING THIS SCRIPT PRODUCES IS COMMITTED any more.
 *
 * Until 2026-09-10 six of the nine substrates were committed `.wasm` files, under the
 * "artifact under test" exception in `.claude/rules/no-binary-in-proof-lineage.md`. That
 * exception's own parenthesis said what to do instead — "(Where the toolchain also exists in
 * CI, prefer BUILDING over COMMITTING — as `bytelock.yml` does for the Go substrate)" — and
 * `src/wasm-dla/bytelock/.gitignore` recorded the trade they were accepted under: the six were
 * tracked *because* `bytelock.yml` installed no toolchain that could rebuild them, and "add a
 * toolchain to the workflow and the corresponding file should stop being tracked, not start
 * being trusted."
 *
 * Run 34490525095 measured the toolchains on all five byte-lock legs. Every one of the six is
 * buildable, at a total install cost of 52-75 seconds on Linux and macOS, and every rebuilt
 * substrate reproduced the UNCHANGED `testdata/golden-seed-*.json` vectors. So the toolchains
 * were added and the files stopped being tracked. Two per-leg gaps are upstream facts and are
 * recorded in `bytelock.yml`'s matrix rather than papered over.
 *
 * `verifyWasmHeader` now runs on EVERY substrate, not just Zig and Go. When the artefacts were
 * committed, `audit-proof-lineage-binaries.ts` checked their headers pre-merge; nothing is
 * committed to check now, so the guard moves to the build site — which is where the file this
 * comment sits in already argued it is cheapest.
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
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const __repoRoot = join(__dir, "..", "..", "..");
const args = process.argv.slice(2);
const onlyFilter = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const checkOnly = args.includes("--check");

// `asc` IS A PROJECT DEPENDENCY, resolved by path — never `npx asc`.
//
// `npx asc` was the recipe until 2026-09-10 and it is measurably broken in two different
// ways at once. On a machine with no `assemblyscript` present it exits 1 with "could not
// determine executable to run" (measured locally). In CI, `npm install assemblyscript` run
// from THIS directory hoists to the repository root — that is where `package.json` lives —
// so `./node_modules/.bin/asc` is not where the install put it, and the build reports
// "asc: command not found". MEASURED on all five byte-lock legs, run 34490525095: the
// AssemblyScript substrate failed to build on every one of them for exactly this reason.
//
// `assemblyscript` is now a root devDependency, so `bun install --frozen-lockfile` — which
// every lane that needs this substrate already runs — puts the binary exactly here.
const ASC = join(__repoRoot, "node_modules", ".bin", process.platform === "win32" ? "asc.cmd" : "asc");

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
      verifyWasmHeader(join(__dir, "dla-canonical-wat.wasm"), "WAT");
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
      verifyWasmHeader(join(__dir, "dla-canonical-llvm.wasm"), "LLVM/C");
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
      verifyWasmHeader(join(__dir, "dla-canonical-emcc.wasm"), "Emscripten");
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
        // `-C strip=debuginfo`, and the flag matters — MEASURED, not chosen.
        //
        // `audit-proof-lineage-binaries.ts` carried a DWARF exemption for this substrate with
        // the note "THE FIX IS ONE FLAG: `-C debuginfo=0` … which would land it at ~6 KB",
        // and that flag is a NO-OP here: on rustc 1.99.0 the module is 624,772 bytes with it
        // and 624,772 bytes without it. The DWARF comes from upstream libcore, which is
        // already compiled, so telling rustc not to EMIT debug info for our crate changes
        // nothing. `-C strip=debuginfo` strips what the linker produced and lands it at
        // 8,058 bytes; `-C strip=symbols` gets 7,004 and also removes the name section.
        //
        // Verified against the unchanged golden vectors after stripping: PASS at all four
        // seeds. The exemption is deleted rather than re-ceilinged, because the artefact it
        // exempted is no longer committed.
        "-C", "strip=debuginfo",
        "-C", "link-args=--allow-undefined",
        "-C", "panic=abort",
        "--crate-type", "cdylib",
        "-o", "dla-canonical-rust.wasm",
        "dla-canonical.rs",
      ]);
      verifyWasmHeader(join(__dir, "dla-canonical-rust.wasm"), "Rust");
    },
  },
  {
    name: "AssemblyScript",
    output: "dla-canonical-asc.wasm",
    check: () => existsSync(join(__dir, "dla-canonical-asc.wasm")),
    build: () => {
      if (!existsSync(ASC)) {
        throw new Error(
          `assemblyscript is not installed at ${ASC} — run \`bun install --frozen-lockfile\` ` +
            `at the repository root first. It is a declared devDependency, not a global tool.`,
        );
      }
      run(ASC, [
        "dla-canonical.ts",
        "--outFile", "dla-canonical-asc.wasm",
        "--optimize",
        "--noAssert",
        "--runtime", "stub",
      ]);
      verifyWasmHeader(join(__dir, "dla-canonical-asc.wasm"), "AssemblyScript");
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

// WINDOWS EXECUTABLE RESOLUTION. `spawnSync` on Windows does NOT search PATHEXT the way a
// shell does: `spawnSync("zig", …)` cannot find `zig.exe`, and the failure arrives as
// `status: null` — not a non-zero exit, an unspawned process. MEASURED on run 34501385444,
// where WAT, Zig, AssemblyScript and Emscripten all failed on both Windows legs with
// "exited with status null" while every one of those tools was installed and on PATH.
//
// `.cmd` and `.bat` are a second, different problem: since the CVE-2024-27980 mitigation,
// Node REFUSES to spawn them without `shell: true` (EINVAL). `asc` ships as `asc.cmd`, so it
// needs the shell route; everything else gets an explicit `.exe` path, which avoids handing
// cmd.exe argument strings full of `[`, `'` and `,` to re-parse.
function resolveExecutable(cmd) {
  if (process.platform !== "win32") return { cmd, shell: false };
  const isPath = cmd.includes("/") || cmd.includes("\\");
  const exts = ["", ".exe", ".cmd", ".bat"];
  const candidates = isPath
    ? exts.map((e) => cmd + e)
    : (process.env.PATH ?? "").split(delimiter).flatMap((d) => exts.map((e) => join(d, cmd + e)));
  const found = candidates.find((c) => c !== "" && existsSync(c));
  const target = found ?? cmd;
  return { cmd: target, shell: /\.(cmd|bat)$/i.test(target) };
}

function run(cmd, args, opts = {}) {
  const { cmd: exe, shell } = resolveExecutable(cmd);
  const result = spawnSync(exe, args, { cwd: __dir, stdio: "inherit", shell, ...opts });
  if (result.status !== 0) {
    // `status: null` means the process never started (not found / not spawnable), which is a
    // different fact from a compiler that ran and rejected the source. Say which.
    const why =
      result.status === null
        ? `could not be started (${result.error?.message ?? "no error reported"}) — resolved to ${exe}`
        : `exited with status ${result.status}`;
    throw new Error(`${cmd} ${why}`);
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
