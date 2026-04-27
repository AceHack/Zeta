# Shipped verification capabilities — the factory's honest resume

> **Companion:** `docs/EXPERIENCE-PORTFOLIO.md` holds the
> detail-report "deep-dive" counterpart to this resume.
> **This doc** is the short interview-grade summary; the
> portfolio carries the stories, the numbers, and the
> hard-won lessons behind each claim.

## Executive summary

The Zeta software factory ships a **strict-by-default
.NET 10 build gate**, a **seven-tool formal-methods
portfolio** routed by property class (TLA+, Lean 4,
Alloy, Z3, FsCheck, Semgrep, CodeQL), **custom lints
authored from past bugs**, and a set of **factory-reusable
patterns** (crank-to-11, latest-version-at-adoption,
portfolio diversity, rule-citation-by-ID) encoded as
memories and skills. The factory's honesty contract:
every Active row has in-repo evidence; Pin-only,
Researched, and Retired each keep their own section so a
reader sees the real state, not a polished one.

## Capabilities at a glance

| Department | Active tools | Factory pattern behind it |
|---|---|---|
| Build gate | `TreatWarningsAsErrors`, `EnableNETAnalyzers=latest-recommended`, `Nullable=enable`, `Deterministic`, `LangVersion=latest`, `net10.0`, CPM+transitive-pinning | Crank-to-11, latest-version-at-adoption |
| Analyzer packs | G-Research.FSharp, Ionide, FSharp.Analyzers.Build, Meziantou | Crank-to-11; pin-only state honestly tracked |
| Static analysis / security | CodeQL (tuned config), Semgrep (custom Zeta rules), cspell | Custom-rule-from-past-bugs; paths-ignore for vendored code |
| Formal methods | TLA+, Lean 4 + Mathlib, Alloy, Z3 | Portfolio diversity (anti-hammer-bias) |
| Property testing | FsCheck v3 on F# algebra | Property-first on algebraic laws |
| Unit testing | xUnit v3, FsUnit, Unquote, coverlet | Latest-version-at-adoption |
| Performance | BenchmarkDotNet | Measure-before-tune, perf-gated pluggability |
| Custom lints | `no-empty-dirs`, `safety-clause-audit`, alignment-audit trio, `tally.ts` invariant-inventory probe, prompt-protector ASCII lint | Author rule AFTER catching bug; invariants as tally |
| Agent-layer discipline | `skill-tune-up` with BP-NN citations, `verification-drift-auditor`, `formal-verification-expert` routing | Rule-citation-by-ID; scratchpad before promotion |

## Signature accomplishments (pattern-in-action)

- **Semgrep rules are written AFTER Zeta catches the bug.** `.semgrep.yml` ships with rules like `pool-rent-unguarded-multiply` (caught int32 overflow in `ZSet.fs:cartesian`) and `plain-tick-increment` (caught torn-read class in tick mutation) — each rule message cites the original file/line and the bug class. Pattern: the factory doesn't deploy generic rulesets, it authors rules from its own incident history.
- **Verification portfolio covers seven tools without tool-hammer-bias.** `formal-verification-expert` (Soraya) routes property classes to tools rather than defaulting to TLA+ for everything. Temporal/concurrency/protocol → TLA+; algebraic laws → Lean 4; structural finding → Alloy; SMT → Z3; property distribution → FsCheck; code-pattern → Semgrep; semantic CFG → CodeQL.
- **F# warning hygiene is per-rule-justified.** `Directory.Build.props` suppresses/downgrades exactly three warnings (FS3517, FS3261, FS0893, FS0052, FS0064) — each with a one-line comment naming the reason (informational-only, interop boundary, FsCheck.Xunit.v3 namespace quirk). Pattern: warning suppression is a named, evidenced decision, not a silent opt-out.
- **Pinned-but-not-referenced is a first-class state.** `SonarAnalyzer.CSharp` is pinned in `Directory.Packages.props` but the comment says: "Pinned but NOT referenced — 15+ real findings (S1905, S6966, S2699) need a cleanup pass first." Pattern: honest state markers prevent "we use Sonar" overclaims while keeping the package pinned for one-line activation later.
- **Round-34 Meziantou wire-in.** Meziantou.Analyzer was pinned for months without being referenced; Aaron caught it; Architect wired it in. Pattern: the factory catches its own stale pin-only states, with human-in-the-loop signal.

---

## Detailed rows

The sections below are the detail tables each capability
entry projects from. Short form above is the resume;
the long form below is the reference-grade evidence.

## How to read the state column

- **Active** — currently wired into build / CI / test
  pipelines; running now; measurable output.
- **Pin-only** — package or tool pinned in config but
  not yet referenced by any target. Honest state for
  things we're parking.
- **Researched** — evaluated in `docs/research/` or a
  skill; not yet applied to repo code. No interview
  claim except "evaluated."
- **Retired** — previously active, now removed. Listed
  so nobody re-litigates a closed decision.

**Rule of thumb:** imagine the factory at a job
interview. Every entry has to survive "show me where
you used it."

**Audit cadence:** this doc is swept on a round cadence
by the **shipped-capabilities resume audit**
(`docs/FACTORY-HYGIENE.md` row #24 — proposed). Any
claim whose evidence disappears (package removed,
workflow deleted, skill retired) gets downgraded or
removed at the next sweep.

## 1. Build gates and language-strictness (F# / C# / .NET 10)

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| `TreatWarningsAsErrors=true` | `Directory.Build.props` | Every warning breaks the build across every TFM. The zero-warning floor is factory policy. | Active |
| `EnableNETAnalyzers=true` + `AnalysisLevel=latest-recommended` | `Directory.Build.props` | Full Roslyn analyzer pack at the strictest tier shipped with the SDK. | Active |
| `Nullable=enable` | `Directory.Build.props` | NRT discipline on C# surface; F# nullness warnings likewise on via `FS3261`. | Active |
| `Deterministic=true`, `ContinuousIntegrationBuild=true` | `Directory.Build.props` | Reproducible binary output for supply-chain discipline. | Active |
| F# warning surgery (`NoWarn`, `WarningsNotAsErrors`) | `Directory.Build.props` lines 7-9 | Per-rule justification for every suppressed or non-fatal F# warning, with inline comment explaining why (FS3517 informational, FS3261 interop nullness, FS0893 FsCheck.Xunit.v3 child-namespace quirk). | Active |
| `LangVersion=latest` + `net10.0` | `Directory.Build.props` | Latest-version-at-adoption rule in concrete form. | Active |
| Central Package Management (CPM) + transitive pinning | `Directory.Packages.props` `ManagePackageVersionsCentrally=true`, `CentralPackageTransitivePinningEnabled=true` | Single source of truth for every package version; transitive dependency pinning for supply-chain discipline. | Active |
| `PackageLicenseExpression=Apache-2.0` | `Directory.Build.props` | Per-package SPDX license expression shipped in metadata. | Active |

## 2. .NET analyzer packs

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| `G-Research.FSharp.Analyzers` 0.22.0 | `Directory.Packages.props` pin; referenced from F# projects | F#-idiomatic analyzers (partial-match coverage, pattern hygiene). | Active |
| `Ionide.Analyzers` 0.15.0 | `Directory.Packages.props` pin | F# analyzer pack from Ionide. | Active |
| `FSharp.Analyzers.Build` 0.5.0 | `Directory.Packages.props` pin | MSBuild integration for F# analyzers. | Active |
| `Meziantou.Analyzer` 3.0.48 | `Directory.Packages.props` pin + wired into `Directory.Build.props` as of round 34 | General-purpose C# analyzer pack. Comment in props documents Aaron caught the pin-only state and drove the wire-in. | Active |
| `SonarAnalyzer.CSharp` 10.19.0.132793 | `Directory.Packages.props` pin | Pinned but NOT referenced. Comment explicitly notes the 15+ real findings (S1905 casts, S6966 SendAsync, S2699 assertionless tests) that require a cleanup pass first. Tracked on BACKLOG. | Pin-only — honest state |

## 3. Static analysis and security scanning (CI workflow layer)

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| **CodeQL** | `.github/workflows/codeql.yml`, `.github/codeql/codeql-config.yml` | C# static analysis on the production-surface code only. Config explicitly excludes `references/upstreams/**` (vendored Feldera Rust/C# reference), `bench/**` (perf-critical intentional unsafe patterns), and formal-method tool trees. | Active |
| **Semgrep** with Zeta-specific rules | `.semgrep.yml` | Custom Zeta rules targeting exact bug classes past review rounds found. Example rules: `pool-rent-unguarded-multiply` (int32 overflow in join), `plain-tick-increment` (torn-read class on tick mutation). Not the default ruleset — these are rules **we wrote after catching the bugs**. | Active |
| **cspell** spell-check | `cspell.json` | Spelling discipline across docs and comments. | Active |

## 4. Formal methods (property classes routed to different tools)

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| **TLA+** | `tools/tla/specs/*.tla` (e.g. `RecursiveSignedSemiNaive.tla`) + `docs/research/proof-tool-coverage.md` | Model-checked protocol / semi-naive recursion / retraction-safe algorithms at bounded scale. Routed per `formal-verification-expert` skill (Soraya) — anti-hammer-bias: TLA+ is for temporal/concurrency/protocol, not for everything. | Active |
| **Lean 4** (with Mathlib) | `tools/lean4/Lean4/*.lean` (e.g. `DbspChainRule.lean`) | Formal proofs of algebraic laws (chain rule for DBSP). Mathlib vendored under `tools/lean4/.lake/packages/mathlib/`. | Active |
| **Alloy** | `tools/alloy/` | Model-finding / structural-property verification — different property class from TLA+. | Active |
| **Z3** SMT solver | `tools/Z3Verify/` + `Microsoft.Z3` 4.12.2 pinned | Quantifier-free theory checking; SMT-based property discharge routed from F# via the package. | Active |

## 5. Testing frameworks and property testing

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| **xUnit v3** | `xunit.v3` 3.2.2 + `xunit.runner.visualstudio` 3.1.5 | Latest-generation xUnit; adopted from day one. | Active |
| **FsCheck** v3 + FsCheck.Xunit.v3 | `tests/Tests.FSharp/Tests.FSharp.fsproj` + 3.3.2 pins | Property-based testing for operator algebra laws. Used on the DBSP algebra directly. | Active |
| `FsUnit.Xunit` 7.1.1 | Package pin | F#-idiomatic xUnit assertions. | Active |
| `Unquote` 7.0.1 | Package pin | F# decompiled-expression assertions with quotation-driven diffs. | Active |
| `coverlet` (collector + msbuild) 10.0.0 | Package pins | Code coverage collection. | Active |

## 6. Performance measurement

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| **BenchmarkDotNet** 0.15.8 | `bench/Benchmarks/` + `bench/Feldera.Bench/` projects | Micro-benchmarking of hot-path operators; zero-alloc audits routed through this. Performance engineer (Naledi) is the owner. | Active |

## 7. Custom lints and audit scripts (factory-grown)

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| `no-empty-dirs.sh` + allowlist | `tools/lint/` | Fail-fast on accidental empty-directory churn. | Active |
| `safety-clause-audit.sh` | `tools/lint/` | Custom safety-clause scanner. | Active |
| Alignment audit trio: `audit_commit.sh`, `audit_personas.sh`, `audit_skills.sh`, `citations.sh` | `tools/alignment/` | Commit alignment, persona alignment, skill alignment, citation integrity — written for THIS factory's discipline. | Active |
| `invariant-substrates/tally.ts` | `tools/invariant-substrates/` | Aaron's inventory probe for the composite-invariants pattern. | Active |
| Prompt-injection ASCII lint (`prompt-protector`) | `.claude/skills/prompt-protector/SKILL.md` + pre-commit hook | BP-10 invisible-Unicode char classes blocked at commit and at notebook-edit time. | Active |

## 8. Agent-layer discipline (shipped via `.claude/`)

| Capability | Form in this repo | What we used it for on Zeta | State |
|---|---|---|---|
| Skill-tune-up ranking by BP-NN citation | `.claude/skills/skill-tune-up/SKILL.md` (Aarav) + `memory/persona/aarav/NOTEBOOK.md` | Every finding in skill reviews cites a stable BP-NN rule ID; freeform findings are scratchpad until promoted by Architect. | Active |
| Verification-drift auditor | `.claude/skills/verification-drift-auditor/` + `project_verification_drift_auditor.md` | Lean / TLA+ / Z3 / FsCheck spec-alignment-with-code drift detection on round cadence. | Active |
| `formal-verification-expert` routing | `.claude/skills/formal-verification-expert/SKILL.md` (Soraya) | Property-class-to-tool routing. Anti-TLA+-hammer-bias encoded as the routing discipline itself. | Active |

## 9. Researched but not yet adopted

These are tools we've **studied** (`docs/research/` or a
dedicated skill) but not yet applied to repo code. Listed
honestly — the factory has *evaluated* them, which is not
the same as having used them.

| Capability | Evaluation artefact | State |
|---|---|---|
| Stryker (mutation testing) | `.claude/skills/stryker-expert/SKILL.md` + mentions in `docs/TECH-RADAR.md`, `docs/VISION.md`, `docs/QUALITY.md` | Researched; no package pin; no test runs. |
| F* (F-star) | `.claude/skills/f-star-expert/SKILL.md` | Researched; no code. |
| LiquidF# (refinement types) | `docs/research/liquidfsharp-evaluation.md`, `docs/research/liquidfsharp-findings.md`, `docs/research/refinement-type-feature-catalog.md` | Evaluated in research docs; no application yet. |

## 10. Factory-reusable patterns (the *how we used it* knowledge)

Alongside the tool list, the factory has **patterns** —
techniques, disciplines, ways of deploying tools — that
are themselves shippable. Each pattern cites the memory
or doc it lives in, and the concrete Zeta instance that
exercises it. These are the shipped knowledge, distinct
from the shipped tooling.

| Pattern | Authoritative memory / doc | Concrete Zeta instance |
|---|---|---|
| **Crank-to-11 on new tech** | `memory/feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md` | `Directory.Build.props` `TreatWarningsAsErrors` + strictest analyzer tier + F# warning tuning with per-rule justification. |
| **Latest-version-at-adoption** | `memory/feedback_latest_version_on_new_tech_adoption_no_legacy_start.md` | `net10.0`, `LangVersion=latest`, xUnit v3, FsCheck v3, Lean 4 — all current-generation picks. |
| **Verification portfolio diversity (anti-hammer-bias)** | `.claude/skills/formal-verification-expert/SKILL.md` | TLA+ + Lean 4 + Alloy + Z3 + FsCheck + Semgrep + CodeQL routed by property class. |
| **Rule-citation-by-ID in reviews** | `docs/AGENT-BEST-PRACTICES.md` BP-01 … BP-NN; `.claude/skills/skill-tune-up/SKILL.md` | Every finding cites a stable rule ID; scratchpad for unpromoted findings; ADR-gated promotion. |
| **Default-on with documented exceptions** | `memory/feedback_default_on_factory_wide_rules_with_documented_exceptions.md` | ASCII-clean, TWAE, BP-11 all default-on; exceptions are named with scope/reason/exit/owner. |
| **Pluggability-first, perf-gated** | `memory/feedback_pluggability_first_perf_gated.md` | Operator plugin discipline, disk-backing-store pluggability, tier-1 / tier-2-shim / tier-3 sizing. |
| **Preserve original AND every transformation** | `memory/feedback_preserve_original_and_every_transformation.md` | Round-history as append-only layer; every scope-change leaves the preceding layer intact. |
| **Free-beats-cheap-beats-expensive cost ordering** | `memory/feedback_free_beats_cheap_beats_expensive.md` | Every ADR names its cost tier; paid tools are plugin-grade, not kernel-grade. |
| **Custom Semgrep rules from past bugs** | `.semgrep.yml` | Rules are authored *after* a bug class is caught in review, with the file/line/class documented in the rule message. |
| **Portable factory substrate** | `memory/project_factory_reuse_beyond_zeta_constraint.md` | `project: zeta` frontmatter tags Zeta-specific artefacts; unmarked artefacts default to portable. |

## 11. Zeta-specific — NOT portable

Listed here for honest contrast: these are techniques we
use on Zeta that are **intentionally scope-locked to Zeta**
and do not ship as factory-portable patterns.

- **Retraction-native DBSP operator algebra** (`D`/`I`/`z⁻¹`/`H`). This is *the research subject* of Zeta, not a portable discipline.
- **ArrowInt64Serializer / Zeta-specific zero-copy tiers.** Specific to Zeta's `ZSet`/`Spine` layout.
- **Semi-naive recursion** protocol spec. Specific to Zeta's recursive-query surface.
- **Zeta's custom `NestedCircuit`.** Specific to Zeta's operator graph runtime.

## Audit discipline

Every entry in this doc is subject to the **resume audit**
(`docs/FACTORY-HYGIENE.md` row #24 — proposed). The audit
sweeps on a round cadence with three checks:

1. **Evidence presence.** Does the cited file / package /
   skill / workflow still exist? If not, the entry is
   removed or downgraded.
2. **State accuracy.** Is a Pin-only still pin-only, or
   was it wired in? Is an Active still active, or has it
   decayed? Is a Researched still researched, or has it
   either been adopted (promote) or decisively dropped
   (move to Retired)?
3. **Overclaim check.** Does any entry describe a
   capability the factory has not actually used? If yes,
   either cite the evidence (promote) or move to
   Researched / remove.

This is the factory's honesty contract with any prospective
adopter. The interview-scrutiny test: "show me where you
used this" must have an answer for every Active row.

## Related memories and docs

- `memory/feedback_factory_resume_job_interview_honesty_only_direct_experience.md` — the rule this doc implements.
- `memory/feedback_shipped_hygiene_visible_to_project_under_construction.md` — the parent question about what ships vs. what stays factory-internal.
- `memory/project_factory_reuse_beyond_zeta_constraint.md` — factory-portability as a declared constraint.
- `memory/user_career_substrate_through_line.md` — Aaron's own resume as the honesty-floor reference model for this doc's style.
- `docs/FACTORY-HYGIENE.md` — the parent hygiene-item index; rows #1, #2, #3, #14, #15, #16, #17, #22, #23, #24 are upstream of individual entries here.
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN stable rules cited throughout.
- `docs/TECH-RADAR.md` — where watchlist graduations feed the Researched-to-Active transition for this doc.
