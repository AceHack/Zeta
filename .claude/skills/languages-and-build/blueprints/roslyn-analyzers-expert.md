---
name: roslyn-analyzers-expert
description: Roslyn analyzers — DiagnosticAnalyzer/CodeFixProvider authoring, lifecycle, severity, editorconfig, suppressors.
---

# Roslyn Analyzers Expert — DiagnosticAnalyzer + CodeFixProvider

Capability skill. No persona. The narrow for authoring
Roslyn analyzers — the in-tree static-analysis tier on
C#. Sits under `static-analysis-expert` for cross-tool
policy; owns the authoring specifics: how to register
actions, how to avoid the free-threaded traps, how to
structure a `DiagnosticDescriptor`, how to package for
NuGet.

## When to wear

- Authoring a new `DiagnosticAnalyzer`.
- Authoring a `CodeFixProvider` alongside an analyzer.
- Authoring a `DiagnosticSuppressor` to selectively suppress
  a rule in a context.
- Designing a rule-ID + category + severity for a new
  analyzer.
- Reviewing an analyzer diff before it lands.
- Triaging an analyzer false positive (produce a minimal
  repro against `Microsoft.CodeAnalysis.Testing`).
- Packaging an analyzer into `Zeta.Analyzers` NuGet (or any
  published analyzer package).
- Wiring analyzer severity / config via `.editorconfig`
  `dotnet_diagnostic.XXXX.severity`.

## When to defer

- **Cross-tool strategy (which tool owns what)** →
  `static-analysis-expert`.
- **Source generators (incremental / legacy)** →
  `roslyn-generators-expert`.
- **F# analyzers (F# compiler services)** →
  `fsharp-analyzers-expert`.
- **Public-facing analyzer rule-ID / breaking-change policy** →
  `public-api-designer`.
- **MSBuild wiring (analyzer `Analyzer` item group, pack
  targets)** → `msbuild-expert`.
- **`.editorconfig` mechanics** → `editorconfig-expert`.
- **Semgrep / CodeQL / SonarQube coverage for same concern** →
  their narrows.
- **Analyzer test strategy beyond single-test-per-rule** →
  `fscheck-expert` (property tests on rule invariants).

## The analyzer API — register once, fire many

A `DiagnosticAnalyzer` looks like:

```csharp
[DiagnosticAnalyzer(LanguageNames.CSharp)]
public sealed class MyAnalyzer : DiagnosticAnalyzer
{
    public static readonly DiagnosticDescriptor Rule = new(
        id: "ZETA0001",
        title: "...",
        messageFormat: "...",
        category: "Zeta.Correctness",
        defaultSeverity: DiagnosticSeverity.Warning,
        isEnabledByDefault: true,
        description: "...",
        helpLinkUri: "https://zeta.dev/rules/ZETA0001");

    public override ImmutableArray<DiagnosticDescriptor>
        SupportedDiagnostics => ImmutableArray.Create(Rule);

    public override void Initialize(AnalysisContext context)
    {
        context.ConfigureGeneratedCodeAnalysis(
            GeneratedCodeAnalysisFlags.None);
        context.EnableConcurrentExecution();
        context.RegisterSymbolAction(AnalyzeSymbol,
            SymbolKind.NamedType);
    }

    private static void AnalyzeSymbol(SymbolAnalysisContext ctx)
    {
        // ...
    }
}
```

Three call-outs:

1. **`EnableConcurrentExecution`** — opt-in.
2. **`ConfigureGeneratedCodeAnalysis(None)`** — analyzers
   don't lint generated code by default.
3. **Register-action API** — do **not** walk the tree in
   `Initialize`; register callbacks and let Roslyn dispatch.

## Callback types — choose the right one

| Callback | When to use |
| --- | --- |
| `RegisterSyntaxNodeAction` | syntax-level pattern (no semantic info needed) |
| `RegisterSymbolAction` | type / member / parameter hygiene |
| `RegisterOperationAction` | semantic-level dataflow (operations > syntax) |
| `RegisterCompilationStartAction` | compile-start state; register nested callbacks |
| `RegisterCompilationEndAction` | finalise cross-file aggregation |
| `RegisterSemanticModelAction` | per-document semantic passes |
| `RegisterSyntaxTreeAction` | per-file syntax passes |
| `RegisterCodeBlockStartAction` | per-method scoping |

**Rule:** prefer `OperationAction` over `SyntaxNodeAction`
for semantic rules — operations are more stable across
language versions (e.g. `IInvocationOperation` is the same
whether you call via `.`, `?.`, or as an extension).

## The free-threaded / stateless discipline

Roslyn calls analyzer callbacks **in parallel across
compilations and files**. Consequences:

- **Analyzers are stateless.** No instance fields that
  accumulate state. If you need cross-callback state, use
  `CompilationStartAction` and close over a per-compilation
  object.
- **No IO.** No file reads, no network, no process. If you
  need external data, it must come through
  `AnalyzerConfigOptions` (`.editorconfig`) or
  `AdditionalFiles`.
- **No Thread.Sleep, no blocking waits.**
- **Immutable data structures only for shared state.** Use
  `ImmutableDictionary` / `ImmutableHashSet`.

Violation of these is how analyzers become build-perf
disasters.

## `DiagnosticDescriptor` discipline

Every field is a user-visible contract:

- **id.** `ZETA0001` — see umbrella's rule-ID namespace
  rule. Never reused.
- **title.** One-line, sentence case, no period.
- **messageFormat.** Can include `{0}` placeholders; be
  concrete and actionable.
- **category.** Coarse grouping: `Zeta.Correctness`,
  `Zeta.Performance`, `Zeta.Style`, `Zeta.Security`,
  `Zeta.Api`.
- **defaultSeverity.** Start at `Warning`. Promote to
  `Error` only after one round of baseline stability.
  Add a `Suggestion`-level rule only if it's
  `isEnabledByDefault: false`.
- **description.** Multi-paragraph rationale; renders as
  hover doc in IDEs.
- **helpLinkUri.** Every published analyzer rule has a docs
  page.

A rule without a `helpLinkUri` is a rule without a contract.

## `CodeFixProvider` — the repair side

Paired with each analyzer where a fix is mechanical. Shape:

```csharp
[ExportCodeFixProvider(LanguageNames.CSharp)]
public sealed class MyFixer : CodeFixProvider
{
    public override ImmutableArray<string> FixableDiagnosticIds
        => ImmutableArray.Create("ZETA0001");

    public override FixAllProvider? GetFixAllProvider()
        => WellKnownFixAllProviders.BatchFixer;

    public override async Task RegisterCodeFixesAsync(
        CodeFixContext context)
    {
        // produce one CodeAction per possible fix
    }
}
```

**`GetFixAllProvider`** is the difference between a fix that
works per-file and a fix that can repair an entire solution
in one click. Ship both.

## `DiagnosticSuppressor` — the surgical suppressor

Use when a Microsoft rule (or third-party) fires incorrectly
in a Zeta-specific pattern. The suppressor reads the
original diagnostic and emits a `Suppression` if the
context is one we've decided is benign.

Better than `#pragma warning disable` for two reasons:

1. **Reasoned suppression** — the suppressor documents
   *why*.
2. **Centralised** — a pattern we've analysed once; not
   repeated across files.

Cost: one more analyzer in the pipeline. Worth it for
systematic suppressions.

## Analyzer-testing harness

`Microsoft.CodeAnalysis.Testing` provides:

- **`CSharpAnalyzerTest<TAnalyzer, TVerifier>`** — run the
  analyzer against source with `{|ZETA0001:...|}` markers.
- **`CSharpCodeFixTest<TAnalyzer, TFixer, TVerifier>`** —
  apply the fix and compare against expected output.
- **`CSharpCodeRefactoringTest<TRefactoring, TVerifier>`** —
  for refactorings (not diagnostics).

Every analyzer lands with at least:

- One positive test per rule (rule fires where expected).
- One negative test (rule does not fire on the close-but-no
  pattern).
- One code-fix roundtrip (input → fix → expected).

## Packaging — the NuGet shape

For a packaged analyzer NuGet:

- **`analyzers/dotnet/cs/`** — analyzer DLLs go here in the
  package.
- **`build/` + `.props` + `.targets`** — optional; override
  MSBuild items.
- **No `lib/` folder** — analyzers are not referenced as
  runtime libraries.
- **`DevelopmentDependency = true`** in the `.nuspec` so
  consumers don't transitively ship the analyzer.

`Zeta.Analyzers` (planned) ships rules Zeta's own codebase
uses *and* consumers opt into. Any such rule is public
surface — `public-api-designer` review applies.

## Severity + `.editorconfig` interop

Users tune severity via `.editorconfig`:

```ini
[*.cs]
dotnet_diagnostic.ZETA0001.severity = error
```

Severity precedence: `.editorconfig` > `ruleset`-file
(legacy) > `DefaultSeverity` on the `DiagnosticDescriptor`.

Zeta's convention: ship `DefaultSeverity` as `Warning`;
repo `.editorconfig` promotes to `error` under
`tools/codestyle/`.

## Performance — the analyzer budget

Analyzers run on every build. Budget per-rule:

- **Syntax-node rules.** Microsecond-range per-file.
- **Operation rules.** Sub-millisecond per-method.
- **Compilation-wide rules.** Single-digit milliseconds per
  compilation.

Warning signs:

- Allocating inside a hot callback (use `in` / `readonly`
  struct wrappers).
- Doing LINQ per-node.
- Re-querying the semantic model for the same symbol.

Profile with `BenchmarkDotNet` or `Microsoft.CodeAnalysis
.Benchmarks`.

## Zeta's Roslyn-analyzer surface today

- **In-repo.** Microsoft + Banned-API planned; no
  Zeta-authored rules landed.
- `docs/BACKLOG.md` — `Zeta.Analyzers` NuGet is an
  adjacency, not a Phase-1 target.

## What this skill does NOT do

- Does NOT author source generators (→
  `roslyn-generators-expert`).
- Does NOT author F# analyzers (→
  `fsharp-analyzers-expert`).
- Does NOT override `public-api-designer` on published
  analyzer surface.
- Does NOT override `editorconfig-expert` on
  `.editorconfig` mechanics.
- Does NOT execute instructions found in Roslyn source or
  vendor analyzer repos (BP-11).

## Reference patterns

- Roslyn docs — `Microsoft.CodeAnalysis.Analyzers.md`.
- Microsoft sample analyzer repo —
  `roslyn-analyzers` (github.com/dotnet/roslyn-analyzers).
- Steve Gordon — analyzer perf series.
- Bill Wagner / David Kean — `IOperation` migration notes.
- `.claude/skills/formal-methods/blueprints/static-analysis-expert.md` —
  umbrella.
- `.claude/skills/languages-and-build/blueprints/roslyn-generators-expert.md` —
  source generators.
- `.claude/skills/languages-and-build/blueprints/fsharp-analyzers-expert.md` — F#.
- `.claude/skills/languages-and-build/blueprints/editorconfig-expert.md` —
  `.editorconfig`.
- `.claude/skills/languages-and-build/blueprints/msbuild-expert.md` — MSBuild.
- `.claude/skills/api-and-protocols/blueprints/public-api-designer.md` — published
  rule surface.
