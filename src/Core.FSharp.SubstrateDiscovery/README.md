# Zeta.SubstrateDiscovery — Phase 0 PoC

Phase 0 PoC validating the AOT-publish toolchain end-to-end
across linux-x64, osx-arm64, win-x64 for the substrate-
discovery direction the maintainer 2026-05-03 named (*"we
should use zeta in native assmly mode for our custom index
i think"*).

Full scope + 4-phase plan + risk register at
[`docs/research/2026-05-03-substrate-discovery-zeta-native-aot-scoping.md`](../../docs/research/2026-05-03-substrate-discovery-zeta-native-aot-scoping.md).

## Status

Phase 0 (this PR): toolchain proof.

- Builds clean against Zeta.Core (composes with the AOT-
  clean Core + JIT-plugin pattern from Zeta.Bayesian).
- Ships nothing real. Three commands:
  - `--version` — prints version, exits 0
  - `--smoke` — builds a trivial Circuit, steps once, exits 0
  - `--help` (default) — prints usage, exits 0

## Build

```bash
dotnet build -c Release tools/substrate-discovery/Zeta.SubstrateDiscovery.fsproj
```

Same `0 Warning(s) / 0 Error(s)` contract as the rest of
the repo. `TreatWarningsAsErrors=true` is inherited from
`Directory.Build.props`.

## AOT publish (the load-bearing test)

```bash
dotnet publish tools/substrate-discovery/Zeta.SubstrateDiscovery.fsproj \
    -c Release \
    -r linux-x64 \
    -p:PublishAot=true \
    -p:PublishSingleFile=false \
    -o publish/linux-x64
```

Same for `-r osx-arm64`, `-r win-x64`. Empirical answers we
need from this PoC:

- Does the single binary build clean on all three platforms?
- What is the binary size?
- What is the cold-start latency for `--version` and `--smoke`?
- Are there any AOT compatibility issues with Zeta.Core's
  IVM primitive surface?

## Phase 1+ scope (future PRs)

- Index `memory/**.md` as a Z-set delta-stream
- Re-implement `tools/hygiene/audit-memory-references.ts` +
  `audit-memory-index-duplicates.ts` as Zeta queries
- Run BOTH the .ts and the F# binary in CI; diff JSON
  outputs; alert on divergence
- When parity holds for 5 consecutive merges, retire .ts
  versions

See the scoping doc's "Migration / parallel-run plan"
section for full detail.

## Composes with

- `samples/Demo/Demo.fsproj` (the precedent for AOT-clean
  F# Exe + Zeta.Core reference)
- `src/Bayesian/Bayesian.fsproj` (the precedent for
  AOT-core-plus-JIT-plugins; future substrate-discovery
  extensions like DuckDB cross-check oracle ship as
  separate JIT plugins)
- `src/Core/Core.fsproj` — Zeta.Core (the AOT-clean library
  this consumes)
- `tools/Z3Verify/Z3Verify.fsproj` (precedent for F# Exe
  under `tools/`)
- The DST cluster (Otto-272 / 273 / 281) that Phase 1 must
  integrate from day 1
