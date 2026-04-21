# Technical Debt — Zeta (System-Under-Test)

*Scope: `project` — this document is Zeta-specific.
The factory-side primer
[`docs/TECH-DEBT.md`](TECH-DEBT.md) owns the vocabulary, the
general class taxonomy, the discovery-automation story, and
the AI operator-manual contract. This doc names the debt
classes that are **Zeta-specific** — the DBSP operator
algebra, the formal-verification portfolio, the F#/.NET
substrate, and the library-consumer contract.*

*Read the factory primer first if you are new to the
project. This doc assumes the primer's framing.*

---

## TL;DR

- Zeta is a retraction-native incremental-view-maintenance
  library for .NET 10 with a DBSP-style operator algebra.
- Zeta's technical debt has a distinct flavour from
  generic-factory debt: **correctness of the operator
  algebra** and **formal-proof alignment** dominate;
  perf-budget and public-API contract debt come next.
- Classes below are Zeta-specific; every class cites real
  in-repo findings from `docs/DEBT.md`,
  `docs/INTENTIONAL-DEBT.md`, or `docs/BUGS.md`.

---

## Zeta-specific classes of technical debt

### S1. Operator-algebra correctness debt

The DBSP operator algebra (`D`, `I`, `z⁻¹`, `H`, insert /
retract duality) is a *mathematical* contract. Debt here is
an operator implementation whose behaviour is *compatible
with the tests we have* but does not witness the full law
the algebra demands.

**Symptom:** the operator passes FsCheck properties and
xUnit tests, yet a stronger property (linearity + time-
invariance + causality, bilinearity, retraction
completeness) has not been proved and may not hold.

**Example from this repo:**
- `LawRunner has no test covering operators that omit the
  marker tag` (`docs/DEBT.md`) — the law runner claims to
  verify the `ILinearOperator` tag; no fixture implements
  `IOperator<_>` without the tag to confirm the runner
  does not silently rely on compile-time dispatch.
- `Lean IsLinear predicate too weak for B2` (`docs/DEBT.md`)
  — predicate covers `map_zero + map_add` only; DBSP
  linearity also requires time-invariance and causality.

**Cadence that catches it:** Soraya
(`formal-verification-expert`) + `verification-drift-auditor`
skill; Tariq (Lean review) on mathlib-backed proofs.

### S2. Formal-proof-alignment debt

Lean proofs, TLA+ models, Alloy models, and Z3 queries are
specs *about* the F# code. When the F# code evolves and the
spec does not, the spec is still valid *on paper* but no
longer proves anything about the shipped library.

**Symptom:** spec compiles, spec file looks current, but a
semantic check shows the spec's model diverges from the
code it nominally verifies.

**Example from this repo:**
- `docs/FACTORY-HYGIENE.md` row #16 (verification-drift
  audit) — cadenced exactly for this class.
- `tools/lean4/Lean4/DbspChainRule.lean` — pending closure
  of B2/B3 blocks chain-rule completion; the predicate
  mismatch is debt S1, the closure gap is debt S2.

**Cadence that catches it:** `verification-drift-auditor`
skill round-cadence; Soraya routing.

### S3. Public-API contract debt

Zeta ships three published libraries (`Zeta.Core`,
`Zeta.Core.CSharp`, `Zeta.Bayesian`). Every public member
is a forever-contract. Debt here is a type / method / field
whose publication was *implicit* — made public by transitive
exposure, not by a `public-api-designer` gate.

**Symptom:** `public-api-designer` (Ilyana) review flags a
type as "accidentally a plugin contract"; removing it
becomes breaking-change for consumers the factory did not
know existed.

**Example from this repo:**
- `Op<'T> implicitly publicised as a plugin subclass-
  extension point` (`docs/DEBT.md`) —
  `Circuit.RegisterStream<'T>` accepts `Op<'T>`, which
  makes every abstract member on `Op` / `Op<'T>` a forever
  plugin contract without design intent. Fix path: narrow
  `IOperator<'T>` interface + deprecate direct subclass
  registration. Ilyana gate + ADR-scale work.

**Cadence that catches it:** `public-api-designer` (Ilyana)
review on every PR that touches `src/Core/**` public-
surface.

### S4. Perf-budget debt

Zeta has per-module perf budgets enforced in BenchmarkDotNet
benchmarks. Debt here is a regression that is *within the
budget tolerance today* but erodes the margin, or a
benchmark that was *documented but never written*.

**Symptom:** Naledi (`performance-engineer`) flags a
measurement regression; or the tech radar has a Trial row
stuck at Trial because the promoting benchmark does not
exist yet.

**Example from this repo:**
- `bench/Benchmarks/BloomBench.fs referenced but absent on
  disk` (`docs/DEBT.md`) — referenced in `docs/BUGS.md`,
  `docs/research/bloom-filter-frontier.md`, and
  `docs/TECH-RADAR.md`; the TECH-RADAR Bloom row is stuck
  at Trial until numbers exist.

**Cadence that catches it:** BenchmarkDotNet CI gate;
Naledi routing on perf-sensitive PRs; tech radar
promotion-blocking rule.

### S5. F# / .NET warning-hygiene debt

`Directory.Build.props` ships with `TreatWarningsAsErrors`,
`EnableNETAnalyzers=latest-recommended`, and per-rule-
justified F# warning tuning. Debt here is a warning that
is *suppressed without per-rule justification*, or an
analyzer finding that is *triaged to WONT-FIX without ADR*.

**Symptom:** a suppression pragma or `<NoWarn>` entry
appears in a project file without a cited reason; an
analyzer flags a pattern the team has no policy on.

**Example from this repo:**
- `SonarAnalyzer.CSharp pinned with 15+ findings waiting for
  a cleanup pass` (`docs/FACTORY-RESUME.md` honest-scope-
  limits) — this is also a factory-class-3 debt (pinned-
  but-not-referenced), with Zeta-specific flavour.

**Cadence that catches it:** build-gate per
`docs/FACTORY-HYGIENE.md` row #1 (`TreatWarningsAsErrors`
→ warning IS a break); per-rule suppression justification
discipline.

### S6. Feature-flag / preview-debt

Features behind `docs/FEATURE-FLAGS.md` gates are
preview-quality: the implementation exists, the contract is
*not* stable, and callers must acknowledge the preview
status explicitly.

**Symptom:** a preview flag remains enabled long after the
preview milestone; or a caller uses a preview API without
acknowledging the gate.

**Example from this repo:**
- `Durability.createBackingStore invalidOp message spans 6
  lines of prose` (`docs/DEBT.md`) — preview surface leaks
  English-prose error; fix: `DbspError.WitnessDurablePreview`
  case so callers can pattern-match.
- `.github/PULL_REQUEST_TEMPLATE.md missing a Feature-Flag
  checkbox` (`docs/DEBT.md`) — PRs adding preview gates did
  not trigger review of `docs/FEATURE-FLAGS.md`.

**Cadence that catches it:** PR-template checkbox; ADR
reversion-trigger when the preview milestone is reached.

### S7. CI-parity debt

Zeta's install script (`tools/setup/install.sh`) is
consumed three ways: dev laptops, CI runners, devcontainer
images (`GOVERNANCE.md §24`). Debt here is a CI path that
*deliberately skips* the install script and uses a
tool-specific action instead, creating parity risk.

**Symptom:** a toolchain component installed only by
`install.sh` (TLC jar, Alloy jar, Lean toolchain) is
invisible to CI; tests that need it skip rather than
validate.

**Example from this repo:**
- `CI parity-swap — gate.yml runs actions/setup-dotnet not
  tools/setup/install.sh` (`docs/DEBT.md`) — explicit
  intentional debt; the fix requires `mise trust`
  hardening first.
- `Verifier-jar SHA-256 pinning` (`docs/DEBT.md`) — TOFU
  on first use; gradient step to close.

**Cadence that catches it:** Dejan (`devops-engineer`)
owns the install script; round-cadence CI-parity audit.

### S8. Test-flakiness debt (FsCheck seed class)

Non-deterministic tests in the FsCheck suite. Generic factory
class #9 (test-flakiness) with a Zeta-specific flavour: the
FsCheck property may be *inherently probabilistic* (FPR
assertion, shrink behaviour) and needs seed-pinning rather
than root-cause fix.

**Example from this repo:**
- `Flaky FsCheck property in the F# suite` (`docs/DEBT.md`)
  — seeds `(5370856837815825128, 13581531945998878741)` and
  `(2518361587550814727, 17790701944329487187, 23)`
  reproduce; second run green with a different seed.

**Cadence that catches it:** CI flake detector; reviewer
discipline "flakiness is not acceptable long-term."

### S9. Spec-drift (OpenSpec)

Zeta uses a modified OpenSpec workflow (no archive, no
change-history per `openspec/README.md`). Behavioural specs
under `openspec/specs/**` are first-class; they should
track the F# code they describe.

**Symptom:** `spec-zealot` (Viktor) flags a capability spec
as drifted: code evolved, spec did not.

**Example from this repo:**
- Periodically surfaced by Viktor on round cadence; no
  specific open entry in `docs/DEBT.md` right now, but the
  discovery surface is active.

**Cadence that catches it:** `spec-zealot` review on
capability-touching PRs; round-cadence spec-audit pass.

### S10. CWD-brittleness / test-harness debt

Tests or scripts that assume CWD points at the repo root
rather than resolving path relative to assembly location.
Fails non-deterministically on harness-level CWD flips.

**Example from this repo:**
- `TlcRunnerTests repoRoot lookup CWD-brittle`
  (`docs/DEBT.md`) — walk-up from CWD fails when
  full-solution `dotnet test` lands with CWD outside the
  repo; fix is `AppContext.BaseDirectory`-anchored walk.

**Cadence that catches it:** Kenji (Architect) build-gate
observation; `maintainability-reviewer` routine pass.

---

## How the factory automates Zeta debt discovery

The generic discovery infrastructure from
[`docs/TECH-DEBT.md`](TECH-DEBT.md) covers most classes.
Zeta-specific additions:

- **Soraya routing** (`formal-verification-expert`) — picks
  the right tool per property class across the seven-tool
  portfolio (TLA+ / Lean / Z3 / Alloy / FsCheck / Stryker /
  Semgrep / CodeQL) and fights TLA+-hammer bias. Debt
  classes S1 / S2 primary coverage.
- **Ilyana gate** (`public-api-designer`) — every
  public-surface change reviewed. Debt class S3 primary
  coverage.
- **Naledi benchmark measurement** (`performance-engineer`)
  — measures before proposing; binding on P1+ regressions.
  Debt class S4 primary coverage.
- **Viktor spec-zealot** — capability-spec drift review.
  Debt class S9 primary coverage.
- **Dejan devops-engineer** — install-script three-way
  parity. Debt class S7 primary coverage.
- **Build gate (GOVERNANCE §1 / FACTORY-HYGIENE row #1)** —
  `TreatWarningsAsErrors` + `EnableNETAnalyzers=latest-
  recommended`. Debt class S5 primary coverage.

---

## How the factory automates Zeta debt fixes

Same landing stack as the factory primer, plus Zeta-specific
patterns:

- **Pluggability-first, perf-gated.** Every new module gets
  a plugin seam; perf budget enforced in benchmarks
  (memory: `feedback_pluggability_first_perf_gated.md`).
  This prevents over-abstraction debt (factory class 8) at
  author-time rather than review-time.
- **Pre-v1 posture.** No file-format back-compat concern
  yet (memory:
  `feedback_no_file_format_backcompat_or_db_upgrade_concern_yet.md`);
  no migration specs until Aaron declares maturity. This
  bounds what *counts* as S6 preview-debt today.
- **OpenSpec minus archive / change-history.** The upstream
  workflow's archive / history directories are intentionally
  unused (`GOVERNANCE.md §25`). If `openspec init`
  recreates one, removing it is not debt — it is workflow
  discipline.

---

## Relationship to factory primer and ledgers

- **[`docs/TECH-DEBT.md`](TECH-DEBT.md)** — the factory
  primer; owns vocabulary and generic class taxonomy.
  Read first.
- **`docs/DEBT.md`** — the live accidental-debt ledger;
  most entries are Zeta-specific and cited by the classes
  above.
- **`docs/INTENTIONAL-DEBT.md`** — the declared-shortcut
  ledger; factory + Zeta rows mixed, filed newest-first.
- **`docs/BUGS.md`** — correctness failures; separate file
  on purpose.
- **`docs/FEATURE-FLAGS.md`** — active preview gates;
  partner surface for class S6.
- **`docs/TECH-RADAR.md`** — trial-to-adopt graduation
  ledger; partner surface for class S4.
- **`docs/FORMAL-VERIFICATION.md`** — the portfolio-
  coverage doc; partner surface for classes S1 and S2.

---

*This document is audited on round cadence. Debt rows here
reference live ledger entries; when a ledger entry resolves,
this doc's citation updates or the class stays with a
different example. No citation, no class.*
