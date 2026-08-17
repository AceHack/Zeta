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

> **Honest note on the `1.322` figure (2026-08-09).** The `1.322` in the table
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
  wat/
    dla.wat                    — WAT (bare-metal, ~979 bytes)
  assemblyscript/
    assembly/index.ts          — AssemblyScript (TypeScript→WASM)
  go/
    main.go                    — Go (GOOS=js GOARCH=wasm, ~1.5 MB)
  c/
    dla.c                      — C (Emscripten emcc, ~8 KB)
  README.md                    — this file
```

## Build Instructions

### WAT (bare-metal)

```bash
wat2wasm wat/dla.wat -o /tmp/dla-wat.wasm
wasm-validate /tmp/dla-wat.wasm
```

### AssemblyScript

```bash
npx asc assemblyscript/assembly/index.ts --outFile /tmp/dla-asc.wasm --optimize
wasm-validate /tmp/dla-asc.wasm
```

### Go

```bash
GOOS=js GOARCH=wasm go build -o /tmp/dla-go.wasm ./go/
# Note: Go WASM is not wasm-validate compatible (uses non-standard imports)
```

### Emscripten (C)

```bash
emcc c/dla.c -o /tmp/dla-emcc.wasm \
  -s WASM=1 -s SIDE_MODULE=1 -O2 --no-entry \
  -s EXPORTED_FUNCTIONS='["_init","_step","_get_df","_get_cell","_get_cluster_size"]'
wasm-validate /tmp/dla-emcc.wasm
```

## CI Verification

The `full-verify` job in `.github/workflows/gate.yml` runs the
`WASM Oracle 10 build-verify` step, which rebuilds all four compiler
outputs from source and validates each binary. This ensures Conjecture Z-7
is reproducible in CI, not just on the developer's machine.

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
