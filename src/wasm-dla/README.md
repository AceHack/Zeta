# src/wasm-dla — Oracle 10 Multi-Compiler WASM DLA Sources

This directory contains the DLA (Diffusion-Limited Aggregation) algorithm
implemented in four languages, each compiled to WebAssembly (WASM).

These are the source files for **Oracle 10** on the identity-dla site and
the evidence base for **Conjecture Z-7** in the frozen core register.

## Conjecture Z-7

> **binary_size ⊥ D_f**: The binary size of a WASM module has zero
> correlation with the fractal dimension D_f it computes. A 979-byte
> WAT binary and a 1.5 MB Go binary produce the same D_f ≈ 1.322.

| Compiler                         | Language                | Binary Size | D_f   |
| -------------------------------- | ----------------------- | ----------- | ----- |
| `wat2wasm` (wabt)                | WebAssembly Text Format | ~979 bytes  | 1.322 |
| `asc` (AssemblyScript)           | TypeScript subset       | ~6 KB       | 1.322 |
| `go build` (GOOS=js GOARCH=wasm) | Go                      | ~1.5 MB     | 1.322 |
| `emcc` (Emscripten)              | C                       | ~8 KB       | 1.322 |

The 1,600× size difference between WAT and Go with identical D_f is the
core claim. Compiler is irrelevant to the fractal dimension.

> **Register:** Z-7 was **DEMOTED §A → §B on 2026-08-01** and remains a conjecture.
> Note it survives the 2026-08-25 correction below: the *independence* claim never
> depended on the *value*. Every substrate reports the same D_f whatever that number
> is, because the byte-lock guarantees byte-identical trajectories. What the
> correction removes is the **1.322** in the table, not the ⊥.

> **Honest note on the `1.322` figure (2026-08-09; corrected by Lumen 2026-08-25).**
> The `1.322` in the table above **was typed in and never computed** — no code path
> in this repo has ever produced it from a measurement. Two corrections to the
> 2026-08-09 version of this note, both measured:
>
> 1. It is **not** "a hardcoded constant in `dla.wat` l.191". The `* 1.322` appears
>    only in a **comment**. The function body was always `csize / (maxr * maxr)` —
>    a number **density**, not a dimension — which measures **0.248–0.450** on the
>    eight byte-locked seeds, a factor of 3–5 from its own comment. It is now
>    renamed `toy_density_proxy` and pinned by a test.
> 2. The ≈1.30 box-counting reading is **not** explained by "800 walkers is too small
>    for the asymptote". That diagnosis is wrong: the Witten–Sander **mass-radius**
>    estimator on the *same* clusters returns **1.668**, within 2.5% of 1.71. The
>    ≈1.30 is an **estimator artifact** — the same box-counting code returns
>    **1.0001** on a Sierpinski gasket (true dimension 1.58496, exactly self-similar,
>    no finite-size physics) subsampled to the same ~330 points.
>
> Full analysis, calibration and anchors:
> `docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md`
>
> *(the original note, retained for the record:)* The `1.322` in the table
> above is each substrate's `get_df()` **mass-radius proxy** — a hardcoded
> constant (`dla.wat` l.191: `… * 1.322 as a proxy`), not a measured dimension.
> A *real* box-counting (Minkowski–Bouligand) estimator now lives host-side in
> `bytelock/reference.mjs` (`boxCountingDimension`), computed from the
> byte-locked trajectory — so it is identical across all substrates by
> construction. At this repo's cluster size (`N_WALKERS = 800`) it measures
> **≈ 1.30**, *not* the frequently-quoted 2-D DLA value **≈ 1.71** (Halsey 2000;
> arXiv:2607.02216) — that is the **large-N asymptote**, and 800 walkers is too
> small to reach it. So `binary_size ⊥ D_f` still holds (every substrate reports
> the same D_f, whatever the cluster size); only the *number* is honest now.
> Reaching ≈ 1.71 for real requires a much larger cluster, which would change the
> trajectory and thus the byte-lock golden vectors — a separate decision.

## Directory Structure

```
src/wasm-dla/
  bytelock/                    — THE substrates: one DLA per language, byte-locked
    dla-canonical.{wat,c,rs,ts,zig,go,lua}          — sources
    dla-canonical-{wat,emcc,llvm,rust,asc,zig}.wasm — the modules under test
    testdata/golden-seed-*.json                     — the hex-in-JSON vectors that judge them
    build-substrates.mjs · run-bytelock-ci.mjs      — the build + the comparison
  CANONICAL_SPEC.md            — the algorithm every byte-locked substrate implements
  wat/dla.wat                  — pre-byte-lock Oracle 10 source (see below)
  assemblyscript/assembly/index.ts — pre-byte-lock Oracle 10 source
  go/main.go                   — pre-byte-lock Oracle 10 source, LOADED BY NOTHING
  README.md                    — this file
```

### The pre-byte-lock sources are NOT the substrates — never stage one

`bytelock/` is a later and different thing from the Oracle 10 sources beside it, and the two were
confused for months with real consequences. Four panels on the identity-DLA site loaded a *second*,
divergent DLA — its own grid size, spawn rule, kill radius and walker budget — listed in no roster
and pinned by no golden vector:

| panel | module it loaded | cluster at seed 4 | corrected in |
| --- | --- | --- | --- |
| Go | build of `go/main.go` | — | #11489 |
| Zig | `zig/dla.wasm` | **1** — degenerate | #11530 |
| C | `c/dla-emcc.wasm` | **1** — degenerate | 2026-08-17 |
| LLVM | `c/dla-llvm-opt.wasm` | 1642 | 2026-08-17 |
| Rust | `rust/dla-opt.wasm` | 462 | 2026-08-17 |

The canonical answer is **345**. The Zig, C, LLVM and Rust sources and binaries above have been
deleted, so exactly one DLA per language now exists in the tree. `go/main.go` survives from #11489,
is loaded by nothing, and is the last of the class — a loose end rather than a decision.

Two things are worth keeping from the episode:

1. **A second implementation that nothing executes is not harmless.** It is a module waiting to be
   staged by name, and that is precisely how each of these reached an operator-facing panel.
2. **A plausible wrong number is the same defect as an obvious one.** The Zig repair began as a
   PRNG fix that produced 516 instead of 345 — alive, wrong, and unfalsifiable, because nothing in
   the tree could contradict it. The check that can is
   `src/Core.TypeScript/discovery/identity-dla-pages-wasm-behavior.test.ts`, which *runs* each
   staged module and compares it against the committed golden vector. The structural check it
   supplements compares export names, and every divergent module had the right ones.

## Build Instructions

The byte-locked substrates are built by `bytelock/build-substrates.mjs`, which is the only recipe
that matters — it is the one `run-bytelock-ci.mjs` and the audit derive their rosters from. See
`bytelock/.gitignore` for why five of the six modules are committed rather than built in CI.

```bash
node bytelock/build-substrates.mjs        # rebuild what the local toolchain supports
node bytelock/run-bytelock-ci.mjs         # compare every substrate against testdata/
```

## CI Verification

`.github/workflows/bytelock.yml` runs `run-bytelock-ci.mjs` on every change under
`src/wasm-dla/**`, and the `cross-verify` floor job in `gate.yml` runs
`src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts`.

> This section previously claimed the `full-verify` job ran a `WASM Oracle 10 build-verify` step
> that rebuilt all four compiler outputs from source. **No such step exists in `gate.yml`** — the
> only trace of it is an unapplied `docs/research/gate-wasm-build-verify.patch`. A README asserting
> a check that never ran is the same defect class as the panels above: something that reads as
> verified because nobody looked. Corrected 2026-08-17.

## Why `bytelock/` contains committed `.wasm` files

`src/wasm-dla/bytelock/` — the canonical-spec byte-lock, a different and later thing from the
Oracle 10 sources above — holds six committed WebAssembly modules. They look like a violation
of `.claude/rules/no-binary-in-proof-lineage.md` ("verification artifacts are TEXT") and are
flagged as one by OpenSSF Scorecard's Binary-Artifacts check. They are not, and the reason is
worth stating once so it is not re-litigated:

**The evidence is text; the thing under test is not evidence.** `run-bytelock-ci.mjs` *loads
and executes* each module and compares the trajectory it computes against
`testdata/golden-seed-*.json` — hex-in-JSON, diffable, exactly what the rule requires. The
binaries are the experiment, not the proof. You review them through their committed sources
(`dla-canonical.{wat,c,rs,ts,zig}`), which is how anyone would review a WebAssembly module
anyway.

They are *committed* rather than *built* because `bytelock.yml` installs only wabt, lua5.4 and
Go; five of the six have no toolchain on the runner, and a substrate CI cannot build is a
substrate CI silently skips. That trade is written down in `bytelock/.gitignore`, and the
exception is conditioned and machine-checked — see the rule's §"The one exception" and
`src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts`, which runs in the `cross-verify`
floor job on every PR.

### The 478 KB Rust module, explained

`dla-canonical-rust.wasm` is 478,353 bytes against ~1–5 KB for the other five. Measured by
walking its section table (2026-08-16), **472,394 bytes — 98.8% — are DWARF**: `.debug_str`
265,057 · `.debug_info` 150,552 · `.debug_ranges` 46,518 · `.debug_line` 7,818 · `.debug_abbrev`
2,449. Its actual **code section is 1,996 bytes**, in family with the others.

So the size gap is not a different kind of artifact — it is a missing `-C debuginfo=0` in the
Rust recipe in `build-substrates.mjs`. (The strings are rustc-remapped to `/rustc/<hash>/…`, so
no builder-machine paths leak.) The fix is one flag plus a re-derived artefact, which needs a
`wasm32-unknown-unknown` toolchain; until then the audit pins it with a named, ceilinged
exemption so it can only shrink and so the next unstripped substrate fails instead.

## Dependencies (Desired-State)

All four compilers are declared in desired-state config:

- **NixOS** (`infra/nixos/modules/common.nix`): `wabt`, `binaryen`, `emscripten`, `nodejs`
- **macOS** (`tools/setup/manifests/brew`): `wabt`, `binaryen`, `emscripten tier=standard`
- **Ubuntu** (`tools/setup/manifests/apt`): `wabt`, `binaryen`, `emscripten`, `nodejs`
- **devShell** (`flake.nix`): `wabt`, `binaryen`, `emscripten`, `nodejs`

AssemblyScript (`asc`) is installed via `pnpm add -g assemblyscript`
(already in mise) and requires `nodejs` as the runtime host.
