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

## Dependencies (Desired-State)

All four compilers are declared in desired-state config:

- **NixOS** (`infra/nixos/modules/common.nix`): `wabt`, `binaryen`, `emscripten`, `nodejs`
- **macOS** (`tools/setup/manifests/brew`): `wabt`, `binaryen`, `emscripten tier=standard`
- **Ubuntu** (`tools/setup/manifests/apt`): `wabt`, `binaryen`, `emscripten`, `nodejs`
- **devShell** (`flake.nix`): `wabt`, `binaryen`, `emscripten`, `nodejs`

AssemblyScript (`asc`) is installed via `pnpm add -g assemblyscript`
(already in mise) and requires `nodejs` as the runtime host.
