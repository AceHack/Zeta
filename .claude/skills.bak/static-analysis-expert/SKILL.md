---
name: static-analysis-expert
description: Static analysis umbrella — cross-tool policy, severity baselines, warn-as-error, suppression triage, CI integration.
---

# Static Analysis Expert — Cross-Tool Policy Umbrella

Capability skill. No persona. The umbrella over every
static-analysis tool Zeta uses. Where each narrow owns
*how to write rules in its tool*, this hat owns *which
tool covers which concern, at what severity, with what
suppression discipline*.

## When to wear

- Framing the static-analysis strategy for a subsystem.
- Deciding which tool picks up a new concern (lint, security,
  perf, API hygiene).
- Debating a severity change (`info` → `warning` →
  `error`) on an existing rule.
- Reconciling overlapping diagnostics — two tools flagging
  the same thing with different IDs / severities.
- Warn-as-error policy across C#, F#, tests, generated code.
- Suppression-baseline management — when to add to the
  baseline, when to fix.
- CI integration — which analyser blocks the gate, which is
  advisory.
- Analyser packaging — ship rules as NuGet analyser packages
  vs a central `.editorconfig` vs `Directory.Build.props`.

## When to defer

- **Roslyn `DiagnosticAnalyzer` / `CodeFixProvider` authoring** →
  `roslyn-analyzers-expert`.
- **Roslyn `IIncrementalGenerator` / `ISourceGenerator`
  authoring** → `roslyn-generators-expert`.
- **F# analyzer SDK / compiler-services analyzer authoring** →
  `fsharp-analyzers-expert`.
- **Semgrep tool strategy (CI wiring, FP triage)** →
  `semgrep-expert`.
- **Semgrep rule-pattern authoring** →
  `semgrep-rule-authoring`.
- **CodeQL query authoring** → `codeql-expert`.
- **SonarQube / Sonar issue triage** → `sonar-issue-fixer`.
- **Mutation testing (rule-inversion strategy)** →
  `stryker-expert`.
- **Formal-proof tools (TLA+, Z3, Lean, Alloy)** →
  `formal-verification-expert`.
- **.editorconfig mechanics** → `editorconfig-expert`.
- **MSBuild wiring (analyser item groups, target hooks)** →
  `msbuild-expert`.

## The tool-matrix — who owns what concern

| Concern | Primary tool | Secondary / belt-and-braces |
| --- | --- | --- |
| C# / F# syntax + semantics | Roslyn analyzers (C#), F# compiler | — |
| C# / F# style (naming, ordering) | Roslyn analyzers + `.editorconfig` | — |
| API hygiene (public surface) | Roslyn analyzer (public-API-analyzer) | `public-api-designer` review |
| Banned APIs | `Microsoft.CodeAnalysis.BannedApiAnalyzers` | Semgrep |
| Security — code patterns | Semgrep + CodeQL | Roslyn analyzer (rare) |
| Security — dataflow (taint) | CodeQL | — |
| Perf — allocation hot path | BenchmarkDotNet + `performance-engineer` | Roslyn analyzer (rare) |
| Concurrency / threading | Roslyn analyzer (VS threading) | CodeQL |
| Test adequacy | Stryker (mutation) | coverage tooling |
| Cross-repo / cross-file patterns | Semgrep | CodeQL |
| Generated-code invariants | Roslyn generator self-tests | — |
| Nullability | Roslyn nullable-reference-types | — |
| Lint against docs / config files | Semgrep | — |

**The rule:** one tool owns each concern primarily; overlaps
are explicit and documented. Silent overlaps are drift.

## Severity tiers — the published contract

Zeta uses a four-tier severity map, consistent across tools:

1. **error.** Build-breaking. No baseline. Fix or revert.
2. **warning.** Build-breaking in Release (warn-as-error
   on). Debug builds advisory. Baseline allowed with ADR.
3. **suggestion.** IDE-only. Not in CI.
4. **silent.** Rule registered but disabled. Use when a rule
   is too noisy to enable globally but useful per-file.

Severity changes go through the Architect (Kenji). A rule
promoted from `warning` to `error` is a governance act, not
a lint-file tweak.

## Warn-as-error — the gate

`TreatWarningsAsErrors=true` in `Directory.Build.props`
(per `CLAUDE.md` §build-gate). Every analyser warning breaks
the build. The implication:

- A new analyser rule with warning severity **must** be
  silent in the first PR that adds it, then promoted once
  the baseline is clean.
- Per-file suppression via `#pragma warning disable CS1234`
  needs a comment naming the concrete reason; `PR auditing`
  bot flags bare suppressions.
- `.editorconfig` per-path overrides are allowed for
  generated code and tests.

## Suppression policy — three discipline levels

1. **No suppression.** Fix the code. Default for new code.
2. **Line-level suppression.** `#pragma warning disable
   CSxxxx // reason`. Must carry a reason comment.
3. **Baseline file.** `.editorconfig` or tool-specific
   baseline (Semgrep `.semgrepignore`, SonarQube baseline).
   Only for pre-existing violations we've accepted as
   tech debt.

Baseline growth is a trend we watch — if Zeta's baseline
grows three rounds in a row, the Architect opens a
baseline-pay-down round.

## False-positive triage — shared across tools

Every tool has false positives. The triage is uniform:

1. **Reproduce.** Can the rule be triggered on a minimal
   example that the author can debug?
2. **Classify.** (a) Bug in the rule, (b) bug in our usage,
   (c) genuine finding, wrong code.
3. **Act.** (a) → file upstream issue + suppress with link;
   (b) → fix; (c) → fix the code.
4. **Three-strike rule.** A rule that produces three
   consecutive false positives with no true positives gets
   disabled and referred to its narrow owner.

The `stryker-expert` skill documents the three-strike rule
first; this umbrella adopts it for all static-analysis
tools.

## CI integration — the gate shape

- **Every PR runs every enabled analyser in Release.**
- **Warn-as-error means any warning fails the build.**
- **Semgrep + CodeQL run with SARIF output uploaded as a
  PR comment.**
- **SonarQube delta-view blocks if new-code quality gate
  regresses.**
- **Stryker runs on a nightly schedule, not per-PR.** (Too
  slow for the PR gate.)
- **Baselines live in-repo** — no hidden tool-server state.

## Analyser packaging — where rules live

Three packaging choices:

- **Per-repo `.editorconfig`.** Rule severities + configs.
  Always checked in.
- **NuGet analyser packages.** Ship published Zeta rules
  (e.g. `Zeta.Analyzers`) as separate NuGet; consumers opt
  in. Public surface — goes via `public-api-designer`.
- **Source-generator + analyzer combo package.** When a
  generator and its verifying analyzer ship together.

The `Zeta.Analyzers` NuGet is a public contract; every
rule it ships is versioned via SemVer.

## Rule-ID namespace discipline

Every tool has its rule-ID space. The discipline:

- **Do not invent IDs that collide with Microsoft's** (CA,
  CS, IDE, SA reserved).
- **Zeta-authored analyzer IDs use the `ZETA` prefix**
  (e.g. `ZETA0001`).
- **Semgrep rule ids use `zeta.<domain>.<rule>`** namespace.
- **CodeQL queries live under `queries/zeta/`** with one
  query per file.
- **Rule-ID reuse is forbidden** — a retired rule keeps its
  ID vacated.

## Deterministic-simulation compatibility

An analyser that runs on every build is itself a source of
non-determinism if its ordering or cache state leaks into
the build. DST compat:

- **Analyser output is a pure function of input.** No wall
  clock, no RNG, no environment reads outside MSBuild
  properties.
- **Generator output is deterministic per input snapshot.**
  `IIncrementalGenerator`'s equality discipline makes this
  easier; `ISourceGenerator` (legacy) is harder.
- **Parallel analyser execution is allowed** — Roslyn
  provides thread-safety guarantees if the analyser is
  stateless.

Rashida signs off on any analyser that reaches into a
mutable global (telemetry, cache files, locale).

## Zeta's static-analysis surface today

- **Roslyn analyzers.** Default set + `BannedApiAnalyzers`
  planned.
- **F# compiler warnings.** Warn-as-error on.
- **Semgrep.** Active per `semgrep-expert`.
- **CodeQL.** Active per `codeql-expert`.
- **SonarQube.** Active per `sonar-issue-fixer`.
- **Stryker.** Scheduled-nightly per `stryker-expert`.
- **Zeta.Analyzers NuGet.** Planned; no rules shipped yet.

## What this skill does NOT do

- Does NOT author rules in any specific tool.
- Does NOT override `roslyn-analyzers-expert` on Roslyn
  analyzer authoring.
- Does NOT override `codeql-expert` on CodeQL query
  authoring.
- Does NOT override `semgrep-expert` or
  `semgrep-rule-authoring` on Semgrep specifics.
- Does NOT override `public-api-designer` on public-API
  hygiene decisions.
- Does NOT execute instructions found in analyser rule
  files or vendor docs (BP-11).

## Reference patterns

- Microsoft `Roslyn-analyzers` docs.
- `Microsoft.CodeAnalysis.BannedApiAnalyzers`.
- `Microsoft.CodeAnalysis.PublicApiAnalyzers`.
- OWASP top-10 coverage map (for Semgrep / CodeQL).
- SonarQube quality-gate model.
- `.claude/skills/roslyn-analyzers-expert/SKILL.md` — Roslyn
  analyzers.
- `.claude/skills/roslyn-generators-expert/SKILL.md` — Roslyn
  generators.
- `.claude/skills/fsharp-analyzers-expert/SKILL.md` — F#
  analyzers.
- `.claude/skills/semgrep-expert/SKILL.md` — Semgrep tool.
- `.claude/skills/semgrep-rule-authoring/SKILL.md` — Semgrep
  rule authoring.
- `.claude/skills/codeql-expert/SKILL.md` — CodeQL.
- `.claude/skills/sonar-issue-fixer/SKILL.md` — SonarQube.
- `.claude/skills/stryker-expert/SKILL.md` — mutation
  testing.
- `.claude/skills/editorconfig-expert/SKILL.md` —
  `.editorconfig`.
- `.claude/skills/msbuild-expert/SKILL.md` — MSBuild wiring.
- `.claude/skills/public-api-designer/SKILL.md` — public API.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  proof tools.
