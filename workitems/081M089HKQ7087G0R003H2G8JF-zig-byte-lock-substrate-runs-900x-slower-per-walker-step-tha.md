---
id: 081M089HKQ7087G0R003H2G8JF
type: bug
state: backlog
priority: P2
slug: zig-byte-lock-substrate-runs-900x-slower-per-walker-step-tha
title: "Zig byte-lock substrate runs ~900x slower per walker step than the other five oracles"
created: 2026-08-17T16:40:45.031Z
depends_on: []
composes_with: []
---

# Zig byte-lock substrate runs ~900x slower per walker step than the other five oracles

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M089HKQ7087G0R003H2G8JF-*.md` glob. -->

## The measurement

Every substrate in `src/wasm-dla/bytelock/` computes the identical trajectory from the
identical PRNG, so all six execute the **same number of walker steps**. Time per step,
measured 2026-08-17 (bun 1.3.14 / JSC, Apple Silicon; step total counted from the canonical
algorithm in JS):

| substrate | run() seed 1 | run() seed 42 | ns per walker step |
|---|---|---|---|
| WAT | 2.8 ms | 3.1 ms | **22.7** |
| LLVM/C | 1.4 ms | 1.8 ms | **11.5** |
| Emscripten | 1.4 ms | 1.8 ms | **11.7** |
| Rust | 1.9 ms | 2.2 ms | **15.5** |
| AssemblyScript | 3.1 ms | 3.5 ms | **25.2** |
| **Zig** | **2508 ms** | **3148 ms** | **20,279** |

Reference step totals: 123,690 (seed 1), 151,722 (seed 42). Cluster size is 332/339 for all
six — the Zig substrate is **correct**, and agrees on every byte-lock seed. This is a
performance defect only.

## What has been ruled out, by measurement

- **Not startup.** `WebAssembly.Module` compile = 0.25 ms, `Instance` = 0.08 ms. The cost is
  entirely inside `run()`.
- **Not extra work.** The `run` body is 700 bytes of ordinary opcodes (vs WAT's 411); no
  `call_indirect`, no software float, no exotic instructions. Section anatomy is unremarkable.
- **Not engine-specific.** Reproduced on both bun (JSC) and node (V8).
- **Not a per-walker constant.** Cost is exactly linear in steps: a degenerate build that
  never sticks ran 40M steps in 843 s = 21 µs/step, the same rate.
- **Not mainly the optimization mode.** Rebuilding `-O ReleaseFast` gives 643 ms — 4x better,
  still ~200x off WAT — and inflates the artifact from 1,314 bytes to 512,211, which would
  wreck the Conjecture Z-7 size table and likely trip the DWARF ceiling in
  `audit-proof-lineage-binaries.ts`. Not a free win; needs its own decision.

## What is NOT known

The root cause inside Zig 0.13.0's wasm32-freestanding codegen is **not identified**. 20 µs
for a ~20-instruction loop iteration is roughly 60,000 cycles, which no amount of "ReleaseSmall
is size-optimized" explains. Naming a cause here without evidence would be a guess wearing a
measurement's clothes.

## Why it matters

1. It makes the byte-lock runner and any test that executes this substrate seconds-slow where
   the other five are milliseconds — it is the entire reason the Pages behaviour test needed an
   explicit time budget (#11530, #11546), and a slow check near a timeout boundary is a check
   whose verdict depends on runner load.
2. The site's Zig oracle panel runs this module in a browser, where ~3 s is user-visible.

## Suggested first step

Diff the emitted `run` against the WAT/C substrates instruction-by-instruction (needs a
disassembler — `wabt`/`wasm-tools` are not currently on this machine), or bisect the Zig source
by replacing one construct at a time (`js_round`'s `@intFromFloat`, the `switch (dir)`, the
`f32` kill-radius test) and re-measuring. The measurement harness used above is small enough to
rewrite in a few lines.
