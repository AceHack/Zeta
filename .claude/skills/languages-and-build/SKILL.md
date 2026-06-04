---
name: languages-and-build
description: Languages, build, packaging — C#/F#/TS/Python/Java, Roslyn/analyzers, MSBuild, NuGet, dependency hygiene.
---

# languages and build

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`csharp-expert`](blueprints/csharp-expert.md) — C# — nullable refs, records, pattern matching, ConfigureAwait, F# interop, init/required facade members.
- [`csharp-analyzers-expert`](blueprints/csharp-analyzers-expert.md) — C# Roslyn analyzer packs — CA/SA/Sonar/Roslynator/Meziantou, baselines, rule overlap, warn-as-error.
- [`fsharp-expert`](blueprints/fsharp-expert.md) — F# idioms — centralised conventions, pitfalls, Zeta-specific patterns for .fs/.fsi files.
- [`fsharp-analyzers-expert`](blueprints/fsharp-analyzers-expert.md) — F# analyzers — FCS analyzer SDK, Ionide, CliContext/EditorContext, range diagnostics, analyzer packaging.
- [`csharp-fsharp-fit-reviewer`](blueprints/csharp-fsharp-fit-reviewer.md) — C#/F# fit review — finds cross-language rewrite wins for idioms, hot-path layout, Span ergonomics, or SIMD.
- [`typescript-expert`](blueprints/typescript-expert.md) — "TypeScript for Zeta tool scripts — strict mode, utility types, branded types, Bun runtime, type-safe DST patterns."
- [`python-expert`](blueprints/python-expert.md) — Python idioms — mise-pinned interpreter, uv tools, ruff formatting, type hints, subprocess hygiene; Zeta narrow surface.
- [`java-expert`](blueprints/java-expert.md) — "Java for Zeta — AlloyRunner.java, JDK 21, SAT4J, single-file compilation, exit-code discipline for .java files."
- [`bash-expert`](blueprints/bash-expert.md) — Bash scripting — macOS/Linux portability, quoting, shellcheck, idempotency; install-graph .sh only.
- [`powershell-expert`](blueprints/powershell-expert.md) — PowerShell — strict mode, Verb-Noun cmdlets, parameter validation, PS7 vs PS5.1; Windows install-script branch.
- [`linq-expert`](blueprints/linq-expert.md) — LINQ — IQueryable/IEnumerable, expression trees, SelectMany monad, Nuqleon serialisation, Zeta algebra.
- [`roslyn-analyzers-expert`](blueprints/roslyn-analyzers-expert.md) — Roslyn analyzers — DiagnosticAnalyzer/CodeFixProvider authoring, lifecycle, severity, editorconfig, suppressors.
- [`roslyn-generators-expert`](blueprints/roslyn-generators-expert.md) — Roslyn source generators — IIncrementalGenerator, equality/caching, .g.cs naming, NuGet packaging, attributes.
- [`msbuild-expert`](blueprints/msbuild-expert.md) — "MSBuild/.NET projects — Directory.Build.props, central packages, .fsproj compile order, InternalsVisibleTo."
- [`nuget-publishing-expert`](blueprints/nuget-publishing-expert.md) — NuGet publishing — package metadata, SemVer, signing, symbol packages, deprecation flow, Zeta.* prefix reservation.
- [`package-auditor`](blueprints/package-auditor.md) — NuGet package audit — pins vs latest, bump classification, API surface impact, concrete bump plan.
- [`package-upgrader`](blueprints/package-upgrader.md) — Package upgrade driver — turns audit output into concrete upgrade PRs, blast-radius-ordered, build+test gated.
- [`editorconfig-expert`](blueprints/editorconfig-expert.md) — EditorConfig — indent/charset/EOL keys, .NET analyzer severity overrides, pattern precedence, MSBuild interaction.
- [`sonar-issue-fixer`](blueprints/sonar-issue-fixer.md) — SonarLint/Roslyn analyzer triage — right long-term fix or documented suppression, never quick-appease edits.
