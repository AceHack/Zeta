# Factory technology inventory

Unified inventory of every technology the factory uses, with
install path, version pin, authoritative-doc URL,
expert-skill cross-reference, and TECH-RADAR ring per tech.
Per the BACKLOG P1 row (PR #165) triggered by Aaron
2026-04-23: *"don't forget to map out all our technology so
the factory has first class support for everything"*.

Living doc — updated with each new tech adoption. Surfaces
cross-platform parity status (FACTORY-HYGIENE row #51) +
GitHub surface coverage (row #48).

## Scope

This inventory is the **single-doc tie-together** of:

- `docs/HARNESS-SURFACES.md` — agent harnesses (per-feature
  granularity)
- `docs/TECH-RADAR.md` — ThoughtWorks-style ring adoption
- `tools/setup/` — install script substrate
- Per-tech expert skills under `.claude/skills/*/SKILL.md`

Rows point at each of the above where applicable. This doc
does not replace any of them — it makes them indexable from
one place.

## Status

**First-pass: 2026-04-23** — ~26 rows across 6 sections.
The full footprint is still larger (Bayesian libs, SIMD
intrinsics, profiling tools, etc.); additional rows land
on future cadenced-audit fires or on-touch when a new tech
is added.

## Inventory

### Language runtimes and build

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| .NET 10 (F# + C#) | Primary language runtime for `src/Core`, tests, benchmarks | `tools/setup/install.sh` via mise (`tools/setup/common/mise.sh` + `.mise.toml`) | `global.json` (SDK pin) + `.mise.toml` | [dotnet.microsoft.com](https://dotnet.microsoft.com/) | `fsharp-expert`, `csharp-expert` | Adopt | F# is the reference implementation per `memory/CURRENT-aaron.md` §5 |
| Rust | Future-Zeta target (not in-tree today) | TBD | TBD | [rust-lang.org](https://www.rust-lang.org/) | none yet | Assess | Anticipated per `memory/CURRENT-aaron.md` §5 |
| bun + TypeScript | Post-setup scripting default (per row #49) | `tools/setup/install.sh` pulls bun | `package.json` `packageManager` (`bun@1.3.13`) + dependency pins | [bun.sh](https://bun.sh) | `typescript-expert` | Trial | Post-setup default per `docs/POST-SETUP-SCRIPT-STACK.md`; TECH-RADAR ring: Trial (graduation criteria documented there). |
| bash + PowerShell | Pre-setup scripts (`tools/setup/**` only) | OS-provided | N/A | N/A | `bash-expert`, `powershell-expert` | Adopt | Dual-authored per row #51 cross-platform parity |

### Data infrastructure

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| Postgres | Sample app backend (FactoryDemo) | OS package install / standard image pull at demo-run time | not yet pinned in-repo (docker-compose pending; tracked as follow-up) | [postgresql.org](https://www.postgresql.org/docs/) | `postgresql-expert`, `relational-database-expert` | Adopt | CRM-shaped demo substrate referenced from `samples/FactoryDemo.Api.FSharp/` and `samples/FactoryDemo.Api.CSharp/`; docker-compose landing per future sample-refresh tick |
| Docker + docker-compose | Containerisation for demo + dev env | Manual / OS package install | N/A (OS install) | [docs.docker.com](https://docs.docker.com/) | `docker-expert` | Adopt | Used by FactoryDemo + future devcontainer; setup scripts do not currently detect or install Docker |
| Apache Arrow | Columnar serialization for Zeta ZSet IPC | NuGet package pinned in `.csproj` | `Directory.Packages.props` | [arrow.apache.org](https://arrow.apache.org/) | `serialization-and-wire-format-expert`, `columnar-storage-expert` | Adopt | Core to `ArrowSerializer.fs` |

### Agent harnesses

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| Claude Code | Primary agent harness for factory work | User-installed CLI | skill-loaded automatically | [docs.claude.com](https://docs.claude.com/en/docs/claude-code) | `claude-md-steward` + `docs/HARNESS-SURFACES.md` rows | Adopt | See HARNESS-SURFACES for feature-level detail |
| Codex CLI | Secondary agent harness (OpenAI) | Independent install | N/A | [github.com/openai/codex](https://github.com/openai/codex) | referenced in `docs/HARNESS-SURFACES.md` | Trial | Mapped in `docs/research/openai-codex-cli-capability-map.md` |
| Gemini CLI | Tertiary agent harness (Google) | Independent install | N/A | [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | referenced in `docs/HARNESS-SURFACES.md` | Trial | Mapped in `docs/research/gemini-cli-capability-map.md` |
| OpenAI web UI (via Playwright) | Amara ferry transport per `docs/protocols/cross-agent-communication.md` | Plugin-enabled only via `.claude/settings.json`; no repo-local Playwright package install | N/A (no repo-local Playwright dependency in `package.json`) | [openai.com](https://openai.com/) + [playwright.dev](https://playwright.dev/) | none yet (candidate skill) | Trial | PR #165 BACKLOG notes Playwright caveats (long-conversation rendering, async loading, ongoing UI-change maintenance). Any OpenAI mode/model authorized within the human maintainer's already-paid subscription (deep research, agent mode, etc.) |
| Playwright | Browser automation for web UI integration (OpenAI, email signup research) | Plugin-enabled only via `.claude/settings.json` (no `@playwright/test` dependency in `package.json`) | N/A | [playwright.dev](https://playwright.dev/) | none yet (candidate skill) | Trial | Constrained by courier protocol + two-layer authorization model; scraping/export only, not primary review signal |

### Formal verification + testing

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| Lean 4 + Mathlib | Proof-grade verification for algebraic invariants | `tools/setup/install.sh` | `lean-toolchain` | [leanprover.github.io](https://leanprover.github.io/) | `lean4-expert` | Adopt | Specs under `tools/lean4/` |
| Z3 | SMT solver for pointwise axioms | OS-installed CLI (`brew`/`apt`/`winget`); `tools/Z3Verify` shells out to `z3` | OS package manager version | [github.com/Z3Prover/z3](https://github.com/Z3Prover/z3) | `z3-expert` | Adopt | `tools/Z3Verify/` — note: no JARs downloaded, unlike TLA+/Alloy |
| TLA+ + TLC | Concurrency + state-machine safety | `tools/setup/install.sh` pulls `tla2tools.jar` | pinned in setup | [lamport.azurewebsites.net/tla/tla.html](https://lamport.azurewebsites.net/tla/tla.html) | `tla-expert` | Adopt | 18 specs under `tools/tla/` |
| Alloy 6 | Lightweight formal specs | `tools/setup/install.sh` pulls Alloy JARs | pinned in setup | [alloytools.org](https://alloytools.org/) | `alloy-expert` | Adopt | Specs under `tools/alloy/` |
| FsCheck | F# property-based testing | NuGet package | `Directory.Packages.props` | [fscheck.github.io](https://fscheck.github.io/FsCheck/) | `fscheck-expert` | Adopt | Property suite integrated with CI |
| xUnit | Concrete-scenario test framework | NuGet package | `Directory.Packages.props` | [xunit.net](https://xunit.net/) | covered in `tests/` conventions | Adopt | Primary test runner for `tests/*.Tests` |
| Stryker.NET | Mutation testing | `tools/setup/manifests/dotnet-tools` (global tool manifest installed by setup) | unversioned in setup manifest (tracks latest) | [stryker-mutator.io](https://stryker-mutator.io/docs/stryker-net/introduction/) | `stryker-expert` | Trial | No GitHub Actions job invokes Stryker currently (run manually or via local dotnet-tools); CI-wiring is follow-up work. TECH-RADAR ring: Trial. |
| BenchmarkDotNet | Benchmark runner | NuGet package | `Directory.Packages.props` | [benchmarkdotnet.org](https://benchmarkdotnet.org/) | `benchmark-authoring-expert` | Adopt | `bench/` projects |

### Static analysis + security

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| Semgrep | Lightweight pattern-matching static analysis | CI-installed via `pip install semgrep` in `.github/workflows/gate.yml` | workflow pin in `.github/workflows/gate.yml` | [semgrep.dev](https://semgrep.dev/) | `semgrep-expert`, `semgrep-rule-authoring` | Trial | Custom rules defined in `.semgrep.yml`. TECH-RADAR ring: Trial. |
| CodeQL | Semantic static analysis | GitHub-hosted | workflow pin | [codeql.github.com](https://codeql.github.com/) | `codeql-expert` | Trial | `.github/workflows/codeql.yml`. TECH-RADAR ring: Trial. |
| Roslyn analyzers | C# analyzers | NuGet package | `Directory.Packages.props` | [learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/overview) | `roslyn-analyzers-expert`, `csharp-analyzers-expert` | Adopt | Wired via `Directory.Build.props` |
| F# analyzers | F# analyzers | NuGet package | `Directory.Packages.props` | [fsharp.github.io/FSharp.Analyzers.SDK](https://fsharp.github.io/FSharp.Analyzers.SDK/) | `fsharp-analyzers-expert` | Adopt | Wired via project files |
| markdownlint-cli2 | Markdown lint | CI-installed | workflow pin | [github.com/DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | (none; see `memory/MEMORY-AUTHOR-TEMPLATE.md` for five recurring classes) | Adopt | Runs on every PR via `.github/workflows/gate.yml` |
| actionlint | GitHub Actions workflow linting | CI-installed | workflow pin | [github.com/rhysd/actionlint](https://github.com/rhysd/actionlint) | referenced in `github-actions-expert` | Adopt | Runs on every PR |
| shellcheck | Shell script linting | CI-installed + pre-commit | latest stable | [shellcheck.net](https://www.shellcheck.net/) | `bash-expert` | Adopt | Runs on every PR |

### CI + publishing

| Technology | Role | Install path | Version pin | Auth doc | Expert skill | TECH-RADAR ring | Notes |
|---|---|---|---|---|---|---|---|
| GitHub Actions | CI/CD orchestration | `.github/workflows/*.yml` | full-length commit SHA pins on action refs in workflow files | [docs.github.com/actions](https://docs.github.com/en/actions) | `github-actions-expert` | Adopt | Gate workflow, CodeQL, auto-merge. Workflow-injection safe-patterns audited under FACTORY-HYGIENE row #43. |
| NuGet | .NET package ecosystem | `dotnet` CLI | `Directory.Packages.props` for lib pins | [learn.microsoft.com/en-us/nuget](https://learn.microsoft.com/en-us/nuget/) | `nuget-publishing-expert` | Adopt | Zeta.Core shipped as NuGet; `package-auditor` skill audits |

## Open follow-ups

1. **Additional rows** — this first-pass covers ~26 techs; the full footprint includes more (Bayesian probability libs, custom SIMD intrinsics, profiling tools, etc.). Land on future fires.
2. **Cross-platform parity column** — row #51's output should feed a per-tech status column (mac/windows/linux/WSL). Deferred until the parity-enforcement work lands.
3. **Version-pin automation** — the "Version pin" column is currently prose; could be pulled from the authoritative files (`global.json`, `Directory.Packages.props`, `package.json`, etc.) by a script. Deferred.
4. **OpenAI mode/model inventory** — deep research, agent mode, normal GPT-N models; a nested list under the OpenAI row would surface which modes are in use for which factory workflows. Deferred to the first real OpenAI-UI Playwright fire.
5. **Quantum-resistant crypto column** — Aaron 2026-04-23: *"any crypto graphy we decide to use should be quantium resisten, even one place we don't use it could be a place for attack, we really don't have much any encryption yet so this is just a note for the future when we do"*. The factory currently has minimal crypto in-tree; when cryptographic primitives land, every row that uses them MUST be PQC (per NIST FIPS 203/204/205/206 — Kyber / Dilithium / Falcon / SPHINCS+). A "PQC-clean?" column should be added when crypto becomes a material part of the factory substrate, and classical-crypto adoption requires an explicit exception + ADR. Full PQC mandate rationale in the factory's cryptography-policy memory (migration to in-repo via the in-repo-first policy cadence).

## Composes with

- `docs/HARNESS-SURFACES.md` — agent-harness feature inventory (complementary, deeper per-harness)
- `docs/TECH-RADAR.md` — ring assessment (complementary, per-ring analysis)
- `tools/setup/install.sh` — install substrate (authoritative install path)
- `docs/POST-SETUP-SCRIPT-STACK.md` — bun+TS vs bash decision flow
- `docs/FACTORY-HYGIENE.md` row #48 (GitHub surface triage cadence), row #49 (post-setup stack), row #51 (cross-platform parity audit), row #54 (backlog-refactor cadenced audit — this doc itself may surface rows for that audit), row #55 (machine-specific content scrubber)
- `memory/MEMORY-AUTHOR-TEMPLATE.md` — absorb-time lint hygiene (used for authoring this and similar docs)
- `memory/CURRENT-aaron.md` + `memory/CURRENT-amara.md` — per-maintainer distillations
