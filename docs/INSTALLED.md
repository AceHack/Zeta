# Installed Dependencies & Why

Living ledger of every tool / package / artifact installed on this
machine for the Zeta.Core project. Keep this file honest when adding
or removing anything — future contributors (and future-you) should
be able to recreate the environment from this doc.

## Runtime SDKs (installed before project started — reused)

| Tool                        | Version                 | Why                                                                                      | How installed                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **.NET SDK**                | 10.0.303                | Primary build runtime for F# + C# projects                                               | mise-managed via `.mise.toml` + `global.json`; installed by `tools/setup/install.sh` (the canonical update path — see `memory/feedback_install_script_is_preferred_update_method_2026_04_24.md`). Older Homebrew / system installs (`/usr/local/share/dotnet`, `/opt/homebrew/Cellar/dotnet/`) MAY remain on personal machines but are NOT used for the build — `mise exec -- dotnet` resolves to the pinned SDK. |
| **Java**                    | OpenJDK 26 (mise-pinned) | Required by TLA+ `tla2tools.jar` and Alloy `alloy.jar`                                   | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                                                                                                                                                                                                              |
| **Rust / cargo**            | rustc 1.87.0 (mise-pinned) | Building Feldera and the Rust/WASM source surfaces                                    | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                                                                                                                                                                                                              |
| **Go**                      | 1.26.4 (mise-pinned)     | Go compiler/runtime and cross-language byte-lock script substrate                        | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh` on Linux, macOS, and Windows                                                                                                                                                                                                                                                                                                                  |
| **Lua**                     | 5.4 line (OS package)    | Lua 5.4 cross-language byte-lock script substrate                                         | `tools/setup/install.sh` via apt `lua5.4`, brew/Windows `lua`, or NixOS `lua5`                                                                                                                                                                                                                                                                                                                                      |
| **Python 3**                | 3.14.6 (mise-pinned)    | Package-audit script JSON parsing + helper scripts; uv venv auto-source per `.mise.toml` | mise-managed via `.mise.toml` (`python = "3.14.6"`); resolved through `mise exec -- python3` for dev/CI parity. System Python may remain on personal machines but is not used for the build.                                                                                                                                                                                                                      |
| **bash / awk / curl / git** | system default          | `tools/*.sh` helper scripts                                                              | Pre-installed                                                                                                                                                                                                                                                                                                                                                                                                     |

## System CLI tools (declared through install manifests)

| Tool                | Version                    | Why                                                                                           | How installed                                                                                                                                                                                                            |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **QEMU / qemu-img** | OS package manager version | USB/ISO boot, full-install, and 081KSNY2Z0008QG0R0008PN7RQ retention QEMU proofs                                  | `tools/setup/install.sh` via `tools/setup/manifests/{apt,brew}`; Windows via `tools/setup/manifests/windows`; Nix dev/cluster surfaces via `full-ai-cluster/**/flake.nix` and `full-ai-cluster/nixos/modules/common.nix` |
| **mtools / mcopy**  | OS package manager version | File-backed zflash ESP writes into raw QEMU boot images without mounting physical USB devices | `tools/setup/install.sh` via `tools/setup/manifests/{apt,brew}`; Nix dev/cluster surfaces via `full-ai-cluster/**/flake.nix` and NixOS package lists                                                                     |
| **k3d**             | 5.8.3                      | Local K3S/Cilium parity substrate for 081KSXN940008QG0R000SCP2H1 Kubernetes + ArgoCD health tests                 | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                     |
| **kind**            | 0.31.0                     | Conservative Docker/Podman Kubernetes substrate for 081KSXN940008QG0R000SCP2H1 CI smoke tests                     | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                     |
| **kubectl**         | 1.36.1                     | Kubernetes control-plane inspection and ArgoCD Application health assertions                  | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                     |
| **helm**            | 4.2.0                      | Installs bootstrap ArgoCD/Cilium charts for local cluster health tests                        | mise-managed via `.mise.toml`; installed by `tools/setup/install.sh`                                                                                                                                                     |

## Python reference-oracle libraries

| Package           | Version | Why                                                                                                                      | How installed                                                                                                                                                                                                                                     |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **qdk[azure]**    | 1.29.1  | Microsoft QDK Python entrypoint for Q# reference-oracle tests over finite-resolution qubits observables                  | Optional install through `ZETA_INSTALL_QUANTUM=1 tools/setup/install.sh` or `ZETA_INSTALL_FULL=1 tools/setup/install.sh`; realized by `tools/setup/mechanisms/from-uv-venv.sh` from `tools/setup/manifests/from-uv-venv` into repo `.venv` via `uv pip install` |
| **qsharp**        | 1.29.1  | Direct Q# package pin for `qsharp` / `%%qsharp` parity when producing `qsharp-golden.json` observables                   | Same optional quantum path as above                                                                                                                                                                                                               |
| **azure-quantum** | 3.10.0  | Explicit pin for the optional Azure backend edge owned by `qdk[azure]`; local simulation remains the default oracle path | Same optional quantum path as above                                                                                                                                                                                                               |

## Python model-interpretability libraries (activation access)

Opt-in and **not** part of any default install tier. Declared as a locked `uv`
project at `src/Interp.Python` (its own project, on the `src/Arc.Python`
precedent) and realized by `ace` through
`tools/setup/manifests/from-uv-project` -> `from-uv-project.ts`, which runs
`uv sync --frozen` against the committed `uv.lock`. The lock carries a sha256
for every wheel, so a `git clone` at a tag resolves nothing.

Install: `ZETA_INSTALL_INTERP=1` (deliberately **not** `ZETA_INSTALL_FULL`,
which `macos-install-sh-test.yml`, `tlaps-proof.yml` and `wsl-install-sh-test.yml`
already set -- those jobs test the installer and never read an activation).
`tier=standard`, so the 8 GB low-memory lane skips it.

| Package              | Version  | Why                                                                                                            | How installed                                                                                       |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **torch**            | 2.13.0   | The activation aperture Ollama's completion API cannot provide; hidden states, attention, residual stream       | `ZETA_INSTALL_INTERP=1`; **platform-split** -- see the table below                                     |
| **transformer-lens** | 3.8.0    | Named hook points (`blocks.N.hook_resid_post`) and `run_with_hooks` causal patching for H1's "respect" clause   | Same opt-in path; PyPI                                                                                |
| **nnsight**          | 0.7.0    | Second aperture -- traces arbitrary `torch` modules, not just supported architectures                          | Same opt-in path; PyPI                                                                                |

**`torch` is not one pin.** Measured 2026-08-25 (wheel `Content-Length`):

| Host | Build | Wheel | Accelerator |
|---|---|---|---|
| macOS arm64 (`macos-26`) | `2.13.0` from PyPI | 111.2 MB | CPU + **MPS** |
| `ubuntu-24.04` (x86_64) | `2.13.0+cpu` from the PyTorch CPU index | 191.8 MB | CPU only |
| `ubuntu-24.04-arm` (aarch64) | `2.13.0+cpu` from the PyTorch CPU index | 155.0 MB | CPU only |

The linux split is `[tool.uv.sources]` in `src/Interp.Python/pyproject.toml`.
Without it linux x86_64 takes the 526.6 MB default wheel plus the `nvidia-*`
CUDA closure; with it the lock contains **zero** nvidia/cuda/triton packages,
asserted by `test_lock_has_no_cuda_bulk`. macOS stays on PyPI on purpose --
that is the wheel carrying the Metal backend. No runner in the matrix has a
GPU, so a CUDA build would never execute.

Windows: the lock holds `win_amd64` wheels but no workflow exercises them.
Unmetered, not supported.

**`src/Core.Python` and `src/Arc.Python` are not on this mechanism**, though
they would fit. They are synced today by explicit steps in `gate.yml` and
`arc-lane.yml`; moving them onto `from-uv-project` would add their cost to every
`install.sh` run and is a separate decision with its own cost case.

## NPM / Bun quantum simulator dependencies

| Package             | Version | Why                                                                                               | How installed                                                                        |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **quantum-circuit** | 0.9.247 | TypeScript quantum circuit simulator (second oracle) for Q# golden observables cross-verification | Installed via `bun add -d quantum-circuit` as part of `package.json` devDependencies |

## NPM / Bun browser integration dependencies

| Package        | Version | Why                                                                                         | How installed                                                                                          |
| -------------- | ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Playwright** | 1.62.1  | Opt-in real-Chromium multi-page verification for the browser node and page-owned mesh layer | Package pinned by `bun add -d --exact playwright@1.62.1`; Chromium via `bun run install:browser-smoke` |

## Project-specific binary artifacts

The two verifier jars are COMMITTED to git (#8053), not downloaded: the
toolchain is byte-pinned by the diff. Their version and sha256 below are
DERIVED from the jars themselves and checked by
`src/Core.TypeScript/hygiene/lint-verifier-jar-provenance.ts`; edit the jar
and this table fails until it is updated. TLC composes its banner from the
build timestamp and short rev, so the version below is exactly what
`java -cp src/Core.TLA/tla2tools.jar tlc2.TLC` prints.

| Artifact                  | Version              | Path                                     | Why                                                      | Install command                                                                                                                               |
| ------------------------- | -------------------- | ---------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **TLA+ / TLC** | `TLC2 Version 2026.05.18.174321 (rev: 8ba1027)` | `src/Core.TLA/tla2tools.jar` | Model-check every `src/Core.TLA/specs/*.tla` spec in CI | Committed to git; sha256 `71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86` |
| **Alloy** | `6.2.0.202501090817 (rev: 794226d)` | `src/Core.Alloy/alloy.jar` | Bounded-model structural invariants (Spine sizeDoubling) | Committed to git; sha256 `6b8c1cb5bc93bedfc7c61435c4e1ab6e688a242dc702a394628d9a9801edb78d` -- byte-identical to upstream v6.2.0 `org.alloytools.alloy.dist.jar` |
| **Feldera (cloned)**      | `main` branch        | `references/prior-art/feldera/`          | Apples-to-apples Nexmark benchmarks                      | `git clone --depth 1 https://github.com/feldera/feldera.git`                                                                                  |
| **CTFP book (Milewski)**  | v1.3.0 PDF           | `docs/category-theory/ctfp-milewski.pdf` | Required-reading category theory reference               | `curl -sL -o ... https://github.com/hmemcpy/milewski-ctfp-pdf/.../category-theory-for-programmers.pdf`                                        |
| **CTFP .NET (Bouderaux)** | archived snapshot    | `docs/category-theory/ctfp-dotnet/`      | F#/C# CT examples (no upstream tracking, .git stripped)  | `git clone ... && rm -rf .git .github`                                                                                                        |

## dotnet global tools

| Tool                   | Version                                                                                          | Why                                                                     | Install                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **dotnet-stryker**     | latest                                                                                           | Mutation testing against `Zeta.Core.fsproj`                             | `dotnet tool install -g dotnet-stryker`                                                            |
| **elan / lean / lake** | elan-installed, toolchain `leanprover/lean4:v4.30.0-rc1` at `/opt/homebrew/bin/{elan,lean,lake}` | Lean 4 version manager + compiler + build tool; drives chain-rule proof | `tools/setup/install.sh` runs the elan installer; toolchain pinned by `tools/lean4/lean-toolchain` |

## NuGet packages (pinned in `Directory.Packages.props`)

See `Directory.Packages.props` for the authoritative list. Current pins:

| Package                     | Version  | Purpose                           |
| --------------------------- | -------- | --------------------------------- |
| FSharp.Core                 | 10.1.202 | F# runtime                        |
| G-Research.FSharp.Analyzers | 0.22.0   | F# static analysis                |
| Ionide.Analyzers            | 0.15.0   | F# static analysis                |
| FSharp.Analyzers.Build      | 0.5.0    | Analyzer build hook               |
| Meziantou.Analyzer          | 3.0.48   | C# static analysis (shim project) |
| xunit.v3                    | 3.2.2    | Test framework                    |
| xunit.runner.visualstudio   | 3.1.5    | VS test runner                    |
| Microsoft.NET.Test.Sdk      | 18.4.0   | dotnet test host                  |
| FsCheck                     | 3.3.2    | Property-based testing            |
| FsCheck.Xunit.v3            | 3.3.2    | FsCheck × xUnit v3 glue           |
| FsUnit.Xunit                | 7.1.0    | F# test DSL                       |
| Unquote                     | 7.0.1    | F# assertion debugger             |
| BenchmarkDotNet             | 0.15.8   | Perf harness                      |
| coverlet.collector          | 10.0.0   | Code-coverage collector           |
| coverlet.msbuild            | 10.0.0   | MSBuild coverage target           |
| Microsoft.Z3                | 4.12.2   | SMT-prover for pointwise axioms   |
| System.IO.Hashing           | 10.0.6   | XxHash + CRC32                    |
| System.Reactive             | 6.1.0    | Rx .NET                           |
| System.Numerics.Tensors     | 10.0.6   | SIMD Tensor ops                   |
| FsPickler                   | 5.3.2    | Canonical F# binary pickler       |
| Apache.Arrow                | 22.1.0   | Arrow IPC wire format             |

Run `tools/audit-packages.sh` to diff pins against NuGet's latest. The
audit is idempotent; `⚠ bump available` lines are actionable.

## Still required but NOT yet installed on this box

| Tool                                 | Reason deferred                                                                                                                           | When to install                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **CodeQL CLI**                       | 500 MB; skipped pending concrete rules-authoring session                                                                                  | `brew install codeql` on macOS                                                                    |
| **Semgrep**                          | Not installed on this box; rules in `.semgrep.yml` run wherever Semgrep is invoked from (CI or dev laptop)                                | `brew install semgrep` or `pip3 install --user semgrep`                                           |
| **Infer.NET F# wrapper native libs** | Only needed if `Zeta.Bayesian` ever grows a full graphical-model operator (roadmap P2); current conjugate-prior impl has zero native deps | Install on-demand per that task                                                                   |
| **Feldera build**                    | Cloned but not `cargo build`-ed yet — ~15 min build                                                                                       | `cd references/prior-art/feldera && cargo build --release` when apples-to-apples run is scheduled |

## How to recreate this environment from scratch

```bash
# From a fresh macOS box (Linux variants noted inline):
# Preferred path: mise-managed toolchain via tools/setup/install.sh.
# Brew is NOT used for .NET — `.mise.toml` + `global.json` pin the SDK,
# `tools/setup/install.sh` installs it on every machine (dev / CI /
# devcontainer). See
# memory/feedback_install_script_is_preferred_update_method_2026_04_24.md.
# .NET, Java, Rust, Python, and the other language runtimes come from `.mise.toml`.
# SDKs + dotnet-stryker + elan (the TLC/Alloy jars are committed, not installed):
./tools/setup/install.sh            # reads .mise.toml + global.json pins
                                    # (CI-parity form; same as `bash tools/...`
                                    # but catches missing exec-bit / shebang
                                    # issues early)

# Source the managed shellenv so DOTNET_gcServer=0 (Otto-248
# Apple-Silicon GC workaround), PATH, and other vars are
# active in this shell:
. "$HOME/.config/zeta/shellenv.sh"

# Project packages:
mise exec -- dotnet restore Zeta.sln
mise exec -- dotnet build Zeta.sln -c Release

# Audit upstream:
bash tools/audit-packages.sh
```

## Lean / Mathlib project layout

The working Lean project lives at `tools/lean4/`. Build with:

```bash
cd tools/lean4 && lake build
```

| Path                                   | Contents                                                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/lean4/lakefile.toml`            | Declares `[[require]] name = "mathlib" scope = "leanprover-community" rev = "v4.30.0-rc1"`; library target `Lean4`                                                |
| `tools/lean4/lean-toolchain`           | Pins `leanprover/lean4:v4.30.0-rc1` (matches Mathlib rev)                                                                                                         |
| `tools/lean4/Lean4/Basic.lean`         | Template sanity stub (`def hello := "world"`)                                                                                                                     |
| `tools/lean4/Lean4/DbspChainRule.lean` | Current chain-rule scaffold; namespace `Dbsp.ChainRule`, 7 outstanding `sorry` obligations. Supersedes the older `proofs/lean/ChainRule.lean` on the v4.12.0 pin. |
| `tools/lean4/.lake/packages/mathlib/`  | Pre-warmed Mathlib checkout (aesop, batteries, Cli, LeanSearchClient, Qq, importGraph, plausible, proofwidgets siblings)                                          |

The older scaffold at `proofs/lean/ChainRule.lean` (Mathlib v4.12.0
dep; unbuilt) is superseded and slated for deletion once the migrated
file builds green. See DEBT.md.

## Reference material (non-executable, cited in docs/papers)

| Artifact                         | Source                        | Path                                         | Why                                                           |
| -------------------------------- | ----------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| **Lamport _Specifying Systems_** | Lamport's personal site (PDF) | `references/tla-book/specifying-systems.pdf` | Canonical TLA+ textbook; cited in `docs/SPEC-CAUGHT-A-BUG.md` |
| **Adam Shostack EoP card game**  | `elevationofprivilege.com`    | upstream only (not vendored)                 | Teaching tool for threat modelling (CC-BY-3.0)                |

## Changelog

- 2026-04-17 (round 23) — Lean toolchain landed: elan + `leanprover/lean4:v4.30.0-rc1` at `/opt/homebrew/bin/{elan,lean,lake}`. Mathlib `v4.30.0-rc1` pre-warmed at `tools/lean4/.lake/packages/mathlib/` with sibling packages aesop, batteries, Cli, LeanSearchClient, Qq, importGraph, plausible, proofwidgets. `cd tools/lean4 && lake build` completes. Chain-rule proof migrated from `proofs/lean/` (stale v4.12.0 pin) to `tools/lean4/Lean4/DbspChainRule.lean` (working v4.30.0-rc1). Closure of T3/T4/B2 sub-goals is the round-24 opener.
- 2026-04-17 — initial ledger
- 2026-04-17 — added Feldera clone
- 2026-04-17 — bumped Meziantou 2→3, Test.Sdk 17→18, BenchmarkDotNet 0.15.4→0.15.8, System.Reactive 6.0.1→6.1.0, Apache.Arrow 22.0.0→22.1.0
- 2026-04-17 (round 17) — added Lamport TLA+ book, an imported 81-entry upstream reference list from prior research, Adam Shostack EoP card game, `docs/security/THREAT-MODEL-SPACE-OPERA.md`, `docs/security/THREAT-MODEL.md`, `docs/security/SDL-CHECKLIST.md`, `docs/FAMILY-EMPATHY.md`, `docs/TECH-RADAR.md`, `docs/LOCKS.md`, `docs/PRIOR-ART-LIST.md`, `docs/DECISIONS/2026-04-17-lock-free-circuit-register.md`. Shipped 6 new code-owner skills (storage / algebra / query-planner / complexity / threat-model-critic / paper-peer-reviewer). Shipped `src/Core/BloomFilter.fs` (blocked + counting, cutting-edge) and `src/Core/Durability.fs` (DurabilityMode DU + WitnessDurableBackingStore skeleton). Added 5 SDL-derived Semgrep rules. Fixed 6 harsh-critic P0s (SpeculativeWatermark logic inversion, Hierarchy Comparer boxing, FastCdc O(n²) buffer scan, Residuated O(n) rebuild, ClosurePair Equals/GetHashCode mismatch, Hierarchy RecursiveSemiNaive monotonicity leak). Added 22 new tests in `Round17Tests.fs`; total suite 471 passing, 0 warnings, 0 errors.
- 2026-04-17 (round 20) — Lean 4 + Mathlib chain-rule scaffold: `proofs/lean/lakefile.lean` now declares the Mathlib dep at tag `v4.12.0`, `proofs/lean/lean-toolchain` pins `leanprover/lean4:v4.12.0`, and `proofs/lean/ChainRule.lean` was expanded from a one-`sorry` stub to a named-sub-lemma skeleton (six discrete `sorry` goals + three closed lemmas). `proofs/lean/README.md` + `docs/research/mathlib-progress.md` document the sub-goals, effort estimates, and build gate. Flipped the Lean/elan INSTALLED row from "install on demand" to "install next round". `lake build` not verified locally — toolchain install is the round-21 opener.
