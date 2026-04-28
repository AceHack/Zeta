# Installed Dependencies & Why

Living ledger of every tool / package / artifact installed on this
machine for the Zeta.Core project. Keep this file honest when adding
or removing anything — future contributors (and future-you) should
be able to recreate the environment from this doc.

## Runtime SDKs (installed before project started — reused)

| Tool | Version | Why | How installed |
|---|---|---|---|
| **.NET SDK** | 10.0.203 | Primary build runtime for F# + C# projects | mise-managed via `.mise.toml` + `global.json`; installed by `tools/setup/install.sh` (the canonical update path — see `memory/feedback_install_script_is_preferred_update_method_2026_04_24.md`). Older Homebrew / system installs (`/usr/local/share/dotnet`, `/opt/homebrew/Cellar/dotnet/`) MAY remain on personal machines but are NOT used for the build — `mise exec -- dotnet` resolves to the pinned SDK. |
| **Java** | OpenJDK 21.0.1 LTS | Required by TLA+ `tla2tools.jar` and Alloy `alloy.jar` | Pre-installed (Oracle JDK) |
| **Rust / cargo** | rustc 1.94.1 (Homebrew) | Building Feldera (apples-to-apples benchmark) | Pre-installed via Homebrew |
| **Python 3** | 3.14 (mise-pinned) | Package-audit script JSON parsing + helper scripts; uv venv auto-source per `.mise.toml` | mise-managed via `.mise.toml` (`python = "3.14"`); resolved through `mise exec -- python3` for dev/CI parity. System Python may remain on personal machines but is not used for the build. |
| **bash / awk / curl / git** | system default | `tools/*.sh` helper scripts | Pre-installed |

## Project-specific binary artifacts (downloaded by `tools/setup/install.sh`)

| Artifact | Version | Path | Why | Install command |
|---|---|---|---|---|
| **TLA+ / TLC** | tla2tools.jar v1.8.0 | `tools/tla/tla2tools.jar` | Model-check every `docs/*.tla` spec in CI | `curl -sL -o tools/tla/tla2tools.jar https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar` |
| **Alloy** | v6.2.0 dist jar | `tools/alloy/alloy.jar` | Bounded-model structural invariants (Spine sizeDoubling) | `curl -sL -o tools/alloy/alloy.jar https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar` |
| **Feldera (cloned)** | `main` branch | `references/upstreams/feldera/` | Apples-to-apples Nexmark benchmarks | `git clone --depth 1 https://github.com/feldera/feldera.git` |
| **CTFP book (Milewski)** | v1.3.0 PDF | `docs/category-theory/ctfp-milewski.pdf` | Required-reading category theory reference | `curl -sL -o ... https://github.com/hmemcpy/milewski-ctfp-pdf/.../category-theory-for-programmers.pdf` |
| **CTFP .NET (Bouderaux)** | archived snapshot | `docs/category-theory/ctfp-dotnet/` | F#/C# CT examples (no upstream tracking, .git stripped) | `git clone ... && rm -rf .git .github` |

## dotnet global tools

| Tool | Version | Why | Install |
|---|---|---|---|
| **dotnet-stryker** | latest | Mutation testing against `Zeta.Core.fsproj` | `dotnet tool install -g dotnet-stryker` |
| **elan / lean / lake** | elan-installed, toolchain `leanprover/lean4:v4.30.0-rc1` at `/opt/homebrew/bin/{elan,lean,lake}` | Lean 4 version manager + compiler + build tool; drives chain-rule proof | `tools/setup/install.sh` runs the elan installer; toolchain pinned by `tools/lean4/lean-toolchain` |

## NuGet packages (pinned in `Directory.Packages.props`)

See `Directory.Packages.props` for the authoritative list. Current pins:

| Package | Version | Purpose |
|---|---|---|
| FSharp.Core | 10.1.202 | F# runtime |
| G-Research.FSharp.Analyzers | 0.22.0 | F# static analysis |
| Ionide.Analyzers | 0.15.0 | F# static analysis |
| FSharp.Analyzers.Build | 0.5.0 | Analyzer build hook |
| Meziantou.Analyzer | 3.0.48 | C# static analysis (shim project) |
| xunit.v3 | 3.2.2 | Test framework |
| xunit.runner.visualstudio | 3.1.5 | VS test runner |
| Microsoft.NET.Test.Sdk | 18.4.0 | dotnet test host |
| FsCheck | 3.3.2 | Property-based testing |
| FsCheck.Xunit.v3 | 3.3.2 | FsCheck × xUnit v3 glue |
| FsUnit.Xunit | 7.1.0 | F# test DSL |
| Unquote | 7.0.1 | F# assertion debugger |
| BenchmarkDotNet | 0.15.8 | Perf harness |
| coverlet.collector | 10.0.0 | Code-coverage collector |
| coverlet.msbuild | 10.0.0 | MSBuild coverage target |
| Microsoft.Z3 | 4.12.2 | SMT-prover for pointwise axioms |
| System.IO.Hashing | 10.0.6 | XxHash + CRC32 |
| System.Reactive | 6.1.0 | Rx .NET |
| System.Numerics.Tensors | 10.0.6 | SIMD Tensor ops |
| FsPickler | 5.3.2 | Canonical F# binary pickler |
| Apache.Arrow | 22.1.0 | Arrow IPC wire format |

Run `tools/audit-packages.sh` to diff pins against NuGet's latest. The
audit is idempotent; `⚠ bump available` lines are actionable.

## Still required but NOT yet installed on this box

| Tool | Reason deferred | When to install |
|---|---|---|
| **CodeQL CLI** | 500 MB; skipped pending concrete rules-authoring session | `brew install codeql` on macOS |
| **Semgrep** | Not installed on this box; rules in `.semgrep.yml` run wherever Semgrep is invoked from (CI or dev laptop) | `brew install semgrep` or `pip3 install --user semgrep` |
| **Infer.NET F# wrapper native libs** | Only needed if `Zeta.Bayesian` ever grows a full graphical-model operator (roadmap P2); current conjugate-prior impl has zero native deps | Install on-demand per that task |
| **Feldera build** | Cloned but not `cargo build`-ed yet — ~15 min build | `cd references/upstreams/feldera && cargo build --release` when apples-to-apples run is scheduled |

## How to recreate this environment from scratch

```bash
# From a fresh macOS box (Linux variants noted inline):
# Preferred path: mise-managed toolchain via tools/setup/install.sh.
# Brew is NOT used for .NET — `.mise.toml` + `global.json` pin the SDK,
# `tools/setup/install.sh` installs it on every machine (dev / CI /
# devcontainer). See
# memory/feedback_install_script_is_preferred_update_method_2026_04_24.md.
brew install openjdk@21             # Java for TLC / Alloy
brew install rustup && rustup-init   # Rust for Feldera
# .NET SDK + dotnet-stryker + TLC + Alloy + elan:
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

| Path | Contents |
|---|---|
| `tools/lean4/lakefile.toml` | Declares `[[require]] name = "mathlib" scope = "leanprover-community" rev = "v4.30.0-rc1"`; library target `Lean4` |
| `tools/lean4/lean-toolchain` | Pins `leanprover/lean4:v4.30.0-rc1` (matches Mathlib rev) |
| `tools/lean4/Lean4/Basic.lean` | Template sanity stub (`def hello := "world"`) |
| `tools/lean4/Lean4/DbspChainRule.lean` | Current chain-rule scaffold; namespace `Dbsp.ChainRule`, 7 outstanding `sorry` obligations. Supersedes the older `proofs/lean/ChainRule.lean` on the v4.12.0 pin. |
| `tools/lean4/.lake/packages/mathlib/` | Pre-warmed Mathlib checkout (aesop, batteries, Cli, LeanSearchClient, Qq, importGraph, plausible, proofwidgets siblings) |

The older scaffold at `proofs/lean/ChainRule.lean` (Mathlib v4.12.0
dep; unbuilt) is superseded and slated for deletion once the migrated
file builds green. See DEBT.md.

## Reference material (non-executable, cited in docs/papers)

| Artifact | Source | Path | Why |
|---|---|---|---|
| **Lamport *Specifying Systems*** | Lamport's personal site (PDF) | `references/tla-book/specifying-systems.pdf` | Canonical TLA+ textbook; cited in `docs/SPEC-CAUGHT-A-BUG.md` |
| **Adam Shostack EoP card game** | `elevationofprivilege.com` | upstream only (not vendored) | Teaching tool for threat modelling (CC-BY-3.0) |

## Changelog

- 2026-04-17 (round 23) — Lean toolchain landed: elan + `leanprover/lean4:v4.30.0-rc1` at `/opt/homebrew/bin/{elan,lean,lake}`. Mathlib `v4.30.0-rc1` pre-warmed at `tools/lean4/.lake/packages/mathlib/` with sibling packages aesop, batteries, Cli, LeanSearchClient, Qq, importGraph, plausible, proofwidgets. `cd tools/lean4 && lake build` completes. Chain-rule proof migrated from `proofs/lean/` (stale v4.12.0 pin) to `tools/lean4/Lean4/DbspChainRule.lean` (working v4.30.0-rc1). Closure of T3/T4/B2 sub-goals is the round-24 opener.
- 2026-04-17 — initial ledger
- 2026-04-17 — added Feldera clone
- 2026-04-17 — bumped Meziantou 2→3, Test.Sdk 17→18, BenchmarkDotNet 0.15.4→0.15.8, System.Reactive 6.0.1→6.1.0, Apache.Arrow 22.0.0→22.1.0
- 2026-04-17 (round 17) — added Lamport TLA+ book, an imported 81-entry upstream reference list from prior research, Adam Shostack EoP card game, `docs/security/THREAT-MODEL-SPACE-OPERA.md`, `docs/security/THREAT-MODEL.md`, `docs/security/SDL-CHECKLIST.md`, `docs/FAMILY-EMPATHY.md`, `docs/TECH-RADAR.md`, `docs/LOCKS.md`, `docs/UPSTREAM-LIST.md`, `docs/DECISIONS/2026-04-17-lock-free-circuit-register.md`. Shipped 6 new code-owner skills (storage / algebra / query-planner / complexity / threat-model-critic / paper-peer-reviewer). Shipped `src/Core/BloomFilter.fs` (blocked + counting, cutting-edge) and `src/Core/Durability.fs` (DurabilityMode DU + WitnessDurableBackingStore skeleton). Added 5 SDL-derived Semgrep rules. Fixed 6 harsh-critic P0s (SpeculativeWatermark logic inversion, Hierarchy Comparer boxing, FastCdc O(n²) buffer scan, Residuated O(n) rebuild, ClosurePair Equals/GetHashCode mismatch, Hierarchy RecursiveSemiNaive monotonicity leak). Added 22 new tests in `Round17Tests.fs`; total suite 471 passing, 0 warnings, 0 errors.
- 2026-04-17 (round 20) — Lean 4 + Mathlib chain-rule scaffold: `proofs/lean/lakefile.lean` now declares the Mathlib dep at tag `v4.12.0`, `proofs/lean/lean-toolchain` pins `leanprover/lean4:v4.12.0`, and `proofs/lean/ChainRule.lean` was expanded from a one-`sorry` stub to a named-sub-lemma skeleton (six discrete `sorry` goals + three closed lemmas). `proofs/lean/README.md` + `docs/research/mathlib-progress.md` document the sub-goals, effort estimates, and build gate. Flipped the Lean/elan INSTALLED row from "install on demand" to "install next round". `lake build` not verified locally — toolchain install is the round-21 opener.
