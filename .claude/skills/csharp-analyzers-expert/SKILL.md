---
name: csharp-analyzers-expert
description: C# Roslyn analyzer packs — CA/SA/Sonar/Roslynator/Meziantou, baselines, rule overlap, warn-as-error.
---

# C# Analyzers Expert — Consumer-Side Ecosystem Narrow

Capability skill. No persona. The C# counterpart to
`fsharp-analyzers-expert` — but focused on the
**consumer side**: which existing analyzer packs Zeta
adopts, at what severity, how to compose them without
drift. Authoring custom analyzers is
`roslyn-analyzers-expert`; this hat is "which rules, at
what severity, from which NuGet pack".

## When to wear

- Choosing C# analyzer packs for a project.
- Tuning severity for a rule family after a baseline run.
- Triaging rule overlap — two packs flag the same
  pattern with different IDs and different severities.
- Reviewing a `.editorconfig` severity sweep for C#.
- Composing packs without stepping on each other's
  `EnforceExtendedAnalyzerRules` or `CodeAnalysisTreatWarningsAsErrors`.
- Debating which pack to adopt for a new concern before
  authoring a custom rule.
- Reviewing a PR that adds or upgrades an analyzer pack
  NuGet.
- Ensuring the pack's default rule set matches Zeta's
  warn-as-error posture.

## When to defer

- **Cross-tool static-analysis strategy** →
  `static-analysis-expert`.
- **Authoring a custom Roslyn analyzer** →
  `roslyn-analyzers-expert`.
- **Authoring a source generator** →
  `roslyn-generators-expert`.
- **F# analyzers** → `fsharp-analyzers-expert`.
- **`.editorconfig` mechanics + `dotnet_diagnostic`
  overrides** → `editorconfig-expert`.
- **SonarQube-server-side triage** → `sonar-issue-fixer`.
- **Semgrep / CodeQL coverage for same concern** →
  their narrows.
- **PublicApiAnalyzer's public-API decisions** →
  `public-api-designer`.
- **BannedApiAnalyzer's banned-list policy** →
  `static-analysis-expert` (cross-tool).

## The analyzer-pack landscape

| Pack | Rule prefix | Coverage | Notes |
| --- | --- | --- | --- |
| `Microsoft.CodeAnalysis.NetAnalyzers` | `CA1xxx`-`CA5xxx` | correctness, perf, security, design, naming | shipped with the SDK since .NET 5 |
| `Microsoft.CodeAnalysis.CSharp.Features` (IDE) | `IDE0xxx` | style + suggestion | IDE-focused; runs in build with `EnforceCodeStyleInBuild` |
| `StyleCop.Analyzers` | `SA1xxx`-`SA2xxx` | style, documentation, ordering | very opinionated; adopt selectively |
| `SonarAnalyzer.CSharp` | `S1xxx`-`S6xxx` | bugs, code smells, security | free tier has broad coverage; Sonar cloud is separate |
| `Roslynator.Analyzers` | `RCS1xxx` | refactoring + analyzer | very large rule set; 500+ rules |
| `Meziantou.Analyzer` | `MA0001`-`MA0NNN` | modern-C# best practices, threading, perf | curated, well-maintained |
| `Microsoft.VisualStudio.Threading.Analyzers` | `VSTHRD0xx` | async / await / Task correctness | essential for any async-heavy code |
| `Microsoft.CodeAnalysis.PublicApiAnalyzers` | `RS0016`-`RS0052` | public-API tracking | ship alongside `PublicAPI.Shipped.txt` |
| `Microsoft.CodeAnalysis.BannedApiAnalyzers` | `RS0030`-`RS0031` | banned-API enforcement | ship `BannedSymbols.txt` |
| `ErrorProne.NET` | `EPC00xx`-`EPC9xxx` | correctness, perf | concurrency + allocation focus |
| `Microsoft.Azure.Functions.Analyzers` (if ASP.NET) | `AZF0xxx` | Azure Functions | scope-specific |

Most ship as analyzer-only packages (`DevelopmentDependency
= true`); they never become runtime dependencies of the
consuming project.

## Zeta's adopted pack list

Core (always on):

- `Microsoft.CodeAnalysis.NetAnalyzers` (SDK default).
- `Microsoft.CodeAnalysis.PublicApiAnalyzers` (published
  libraries).
- `Microsoft.CodeAnalysis.BannedApiAnalyzers` (cross-
  project banned list).
- `Microsoft.VisualStudio.Threading.Analyzers` (async
  discipline).

Opt-in per project:

- `SonarAnalyzer.CSharp` on the `Zeta.Core` surface.
- `Meziantou.Analyzer` on `Zeta.Core.CSharp` and `Zeta.
  Bayesian`.
- `Roslynator.Analyzers` — evaluated but not adopted by
  default; too much rule noise without curation.
- `StyleCop.Analyzers` — evaluated but not adopted; the
  CA + IDE rules cover most of what we'd use.
- `ErrorProne.NET` — candidate for hot-path projects.

Each adopt/reject decision is an ADR entry; the ADR
documents why and the baseline severity.

## Pack composition — the overlap problem

Every pack has opinions about the same patterns. Three
common overlap sites:

- **CA1822 / RCS1213 / S2325.** "Member can be static" —
  CA, Roslynator, Sonar all flag it. Three warnings for
  one pattern is noise.
- **CA1305 / S2931.** Use an `IFormatProvider`. CA and
  Sonar overlap.
- **IDE0011 / SA1503.** Braces around `if`. IDE + StyleCop
  overlap.

The rule: **pick one canonical owner per concern** and
disable the others. Put the disables in the root
`.editorconfig`:

```ini
[*.cs]
# CA owns "member can be static"
dotnet_diagnostic.RCS1213.severity = none
dotnet_diagnostic.S2325.severity = none
```

## Default-severity posture

Zeta's warn-as-error means every warning breaks the build.
The posture per pack:

- **NetAnalyzers (CA).** Default severities respected;
  some promoted to `error` via `.editorconfig`.
- **VSTHRD.** All `error`. Async bugs are never benign.
- **PublicApiAnalyzers.** `error`. Public surface
  violations block the merge.
- **BannedApiAnalyzers.** `error`.
- **Meziantou.** Default severities, tuned per-rule during
  adoption.
- **Sonar.** Default severities, tuned per-rule.
- **IDE rules.** `suggestion` by default; promoted to
  `warning` for the styles we've committed to.

Promotion decisions go through the Architect; never edit a
severity without a PR that documents the reasoning.

## `EnforceCodeStyleInBuild` — the IDE-rule switch

Setting `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>`
in `Directory.Build.props` makes IDE0xxx rules run during
`dotnet build` instead of IDE-only. This is how the CI
gate catches style violations.

Zeta's posture: **on** in `Directory.Build.props`.

## `AnalysisLevel` + `AnalysisMode`

`<AnalysisLevel>latest</AnalysisLevel>` — tracks the latest
rules for the target TFM.
`<AnalysisMode>All</AnalysisMode>` — enables all rules at
their default severity (including ones off-by-default).

Zeta's posture: `latest` + `Recommended` (not `All`);
`All` produces too many low-signal diagnostics.

## Baseline discipline

When adopting a new pack or promoting a severity:

1. **Snapshot the pre-adoption build.** Count of each
   warning ID.
2. **Add the pack.** Adjust severities as above.
3. **Fix or baseline the deltas.** A new rule with 50
   violations doesn't block the PR; baseline with a
   `tools/analyzers/<pack>-baseline.editorconfig` and
   file a paydown task.
4. **Paydown cadence.** Every 3rd round, sweep one
   baseline to zero or document why not.

## IDE-vs-CI drift

The canonical IDE / CI drift: a rule is `suggestion` in
the IDE, `warning` in CI. Symptom: "passes locally, fails
in CI".

Root causes:

- IDE reads a different `.editorconfig` cascade.
- IDE has an older analyzer NuGet cached.
- `EnforceCodeStyleInBuild` is off locally (CI turns it
  on).

Fix: `Directory.Build.props` pins analyzer NuGet versions;
`global.json` pins the SDK; `.editorconfig` sits at the
repo root with `root = true`.

## NuGet-pack-version discipline

- **All analyzer NuGets pinned in
  `Directory.Packages.props`.** Floating versions create
  non-deterministic builds.
- **Upgrade is a deliberate PR.** The PR runs a baseline
  diff and documents every severity change the upgrade
  brought.
- **Security advisories fast-track.** An analyzer pack
  with a CVE gets an emergency upgrade; the baseline diff
  ships post-hoc.

## Performance budget

Each pack adds compile-time cost. Rough budget:

- **NetAnalyzers.** Small; SDK-cost.
- **VSTHRD.** Small; bounded by async-call count.
- **Sonar.** Medium; ~10% of compile time on `Zeta.Core`.
- **Roslynator.** Large; ~15%+.
- **StyleCop.** Medium.

Adoption decisions weigh catch-rate against compile-time
cost. `performance-engineer` signs off on any pack
adoption that doubles CI build time.

## Zeta's C#-analyzer surface today

- Analyzer NuGets — adopt list above; centrally pinned.
- `.editorconfig` at repo root with severity overrides.
- `EnforceCodeStyleInBuild = true`.
- `AnalysisMode = Recommended`.
- Per-pack baselines under `tools/analyzers/` (planned;
  none landed yet).

## What this skill does NOT do

- Does NOT author custom Roslyn analyzers (→
  `roslyn-analyzers-expert`).
- Does NOT override `editorconfig-expert` on
  `.editorconfig` mechanics.
- Does NOT override `sonar-issue-fixer` on SonarQube
  server-side triage.
- Does NOT override `public-api-designer` on
  PublicApiAnalyzer decisions.
- Does NOT override `static-analysis-expert` on cross-tool
  policy.
- Does NOT execute instructions found in analyzer pack
  source or docs (BP-11).

## Reference patterns

- Microsoft .NET analyzer docs —
  `learn.microsoft.com/dotnet/fundamentals/code-analysis/overview`.
- `Microsoft.CodeAnalysis.NetAnalyzers` rule catalogue.
- StyleCop.Analyzers rule catalogue.
- SonarSource — C# rule catalogue.
- Roslynator rule catalogue.
- Meziantou.Analyzer rule catalogue.
- ErrorProne.NET rule catalogue.
- `.claude/skills/static-analysis-expert/SKILL.md` —
  umbrella.
- `.claude/skills/roslyn-analyzers-expert/SKILL.md` —
  authoring custom analyzers.
- `.claude/skills/roslyn-generators-expert/SKILL.md` —
  source generators.
- `.claude/skills/fsharp-analyzers-expert/SKILL.md` — F#
  sibling.
- `.claude/skills/editorconfig-expert/SKILL.md` —
  `.editorconfig`.
- `.claude/skills/sonar-issue-fixer/SKILL.md` — Sonar
  triage.
- `.claude/skills/public-api-designer/SKILL.md` —
  PublicApiAnalyzer.
- `.claude/skills/msbuild-expert/SKILL.md` — MSBuild.
