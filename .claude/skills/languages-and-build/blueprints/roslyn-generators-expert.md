---
name: roslyn-generators-expert
description: Roslyn source generators — IIncrementalGenerator, equality/caching, .g.cs naming, NuGet packaging, attributes.
---

# Roslyn Generators Expert — Incremental Source Generators

Capability skill. No persona. The narrow for Roslyn source
generators. Zeta treats generators as a first-class tool
for reducing boilerplate (serializers, equality, visitor
dispatch, public-API exhaustiveness). The authoring bar
is high: a generator that runs every keystroke without
caching kills the IDE. This hat owns the incremental-
generator discipline.

## When to wear

- Authoring an `IIncrementalGenerator`.
- Reviewing a generator diff before it lands.
- Debugging a generator that's re-running on every keystroke
  (equality / caching bug).
- Designing attribute-driven generation (a user-facing
  `[ZetaSerializable]` attribute triggers a generator).
- Deciding whether an `ISourceGenerator` (legacy) should be
  migrated to `IIncrementalGenerator`.
- Packaging a generator into a NuGet.
- Testing a generator via `GeneratorDriver` + verification
  harness.
- Reviewing emitted code for correctness, formatting,
  `#nullable`, and hint-name hygiene.

## When to defer

- **Cross-tool static-analysis policy** →
  `static-analysis-expert`.
- **`DiagnosticAnalyzer` authoring** →
  `roslyn-analyzers-expert`.
- **F# equivalent (Type Providers — a different model)** →
  `fsharp-analyzers-expert` (by adjacency) or `fsharp-expert`.
- **Public-facing generated-code shape / API** →
  `public-api-designer`.
- **MSBuild analyzer item-group / AdditionalFiles wiring** →
  `msbuild-expert`.
- **`.editorconfig` → generator option mapping
  (`build_property.*`)** → `editorconfig-expert`.
- **Semgrep / CodeQL rule authoring** → their narrows.

## Incremental vs legacy — always incremental

`ISourceGenerator` (legacy): one `Execute(context)` method,
runs once per compilation, no caching. Every keystroke
re-runs the whole generator. **Don't write new ones.**

`IIncrementalGenerator` (modern, .NET 6+ / VS 2022+):
declarative pipeline of `IncrementalValueProvider<T>`s that
Roslyn caches automatically when inputs haven't changed.
**Default choice.**

Migration is advisory when `ISourceGenerator` survives
because (a) rewriting the pipeline is real work and (b)
some consumers still target older Roslyn. But Zeta's
minimum is .NET 8 / Roslyn 4.8; new generators are
incremental.

## The pipeline shape

```csharp
[Generator]
public sealed class MyGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext ctx)
    {
        var typesWithAttr = ctx.SyntaxProvider
            .ForAttributeWithMetadataName(
                "Zeta.ZetaSerializableAttribute",
                predicate: static (node, _) => node is TypeDeclarationSyntax,
                transform: static (gasc, _) => Transform(gasc))
            .Where(static t => t is not null);

        var compilationAndTypes = ctx.CompilationProvider
            .Combine(typesWithAttr.Collect());

        ctx.RegisterSourceOutput(compilationAndTypes,
            static (spc, source) => Emit(spc, source));
    }
}
```

Three call-outs:

1. **`ForAttributeWithMetadataName`** — the API that
   **actually** lets Roslyn prune the syntax tree early.
   `CreateSyntaxProvider` without it walks every node on
   every keystroke.
2. **`Combine` / `Collect`** — builds the input graph; Roslyn
   caches each stage.
3. **`RegisterSourceOutput`** — the sink; emits files or
   diagnostics.

## Equality discipline — the load-bearing rule

Roslyn skips a pipeline stage only when inputs are *equal*
by `IEquatable<T>`. If your transform returns a record with
a `Compilation` or `ISymbol` field, the equality comparison
drifts on every edit, caching fails, the generator re-runs
every keystroke.

Rules:

- **Transform output is a value record with value-type
  fields.** Strings, `int`, `ImmutableArray<string>`, nested
  records. Never `ISymbol`, `SyntaxNode`, or `Compilation`.
- **`ImmutableArray<T>.SequenceEqual`** for collection
  fields — records' default `Equals` compares by reference
  for collections.
- **Test equality in a unit test.** Build two transform
  outputs from the same input; `Assert.Equal`.
- **Cachability test.** Run the generator over the same
  compilation twice; assert zero new emissions.

A generator that fails the cachability test degrades IDE
perf for every consumer. This is a build-break-level
concern.

## Inputs — the four streams

An incremental generator consumes from four input kinds:

- **`SyntaxProvider`.** Syntax nodes filtered by attribute
  or predicate.
- **`CompilationProvider`.** The whole `Compilation` — use
  sparingly; invalidates on every edit.
- **`AdditionalTextsProvider`.** `AdditionalFiles` from
  MSBuild (e.g. `.json` config files).
- **`AnalyzerConfigOptionsProvider`.** `.editorconfig`
  values and `build_property.*` values.

**Prefer `SyntaxProvider` + `AdditionalTextsProvider`
streams** — they cache best. **Use `CompilationProvider`
last** — it invalidates on every semantic edit.

## `ForAttributeWithMetadataName` — the prune API

Before this API existed (Roslyn < 4.4), attribute-driven
generation meant `CreateSyntaxProvider` walking every
syntax node. Now:

```csharp
ctx.SyntaxProvider.ForAttributeWithMetadataName(
    "Zeta.ZetaSerializableAttribute",
    predicate: ...,
    transform: ...)
```

Roslyn internally builds an attribute-name index; only
syntax nodes carrying that attribute invoke the predicate.
**Any generator that takes attribute input must use this
API.**

## Diagnostics from a generator

`SourceProductionContext.ReportDiagnostic(...)` emits a
diagnostic during generation. Use when the input is
ill-formed (missing partial, wrong accessibility, missing
constructor).

Diagnostic IDs follow the `ZETAGEN####` convention so
they're distinguishable from analyzer IDs.

Don't throw from a generator — Roslyn surfaces
`ISourceGenerator` / `IIncrementalGenerator` exceptions as
`CS8785` / `CS8785`-family errors that don't point at user
code; diagnostics point at the source span the user can
act on.

## Emitted-code discipline

- **Hint-name.** `RegisterSourceOutput`'s `AddSource(name,
  text)` uses `name` as the file name. Collisions between
  generators silently overwrite in the same project.
  Convention: `Zeta_<Generator>_<Type>.g.cs`.
- **`#nullable enable`** at the top of every emitted file.
- **`// <auto-generated/>`** header so other analyzers skip
  it (per `ConfigureGeneratedCodeAnalysis`).
- **Pretty-print.** Use `SyntaxTree`'s `NormalizeWhitespace`
  or a template engine; never emit one-line concatenations
  (users will read the `.g.cs`).
- **`partial` discipline.** Generated code extends user
  `partial class` / `partial record`; the user's half owns
  the declared surface.

## Debugging a generator

Three knobs:

1. **`Debugger.Launch()`** in `Initialize` — catches with
   Visual Studio.
2. **`EmitCompilerGeneratedFiles=true`** in the consuming
   project — writes `.g.cs` to disk for inspection.
3. **`GeneratorDriver`** in a unit test — drive the
   generator programmatically and inspect `RunResult.Results`.

## Testing a generator

`Microsoft.CodeAnalysis.Testing` provides
`CSharpSourceGeneratorTest<TGenerator, TVerifier>`. Minimum
tests per generator:

- **Happy path.** Input compiles; generator emits expected
  output.
- **Attribute-less input.** Generator emits nothing.
- **Malformed input.** Generator emits expected diagnostic.
- **Cachability.** Two runs over the same input produce
  identical output *and* Roslyn caches the intermediate
  stages.

## Packaging — mirrors analyzers

Same NuGet shape as analyzers:

- `analyzers/dotnet/cs/Zeta.Generators.dll` in the
  package.
- `DevelopmentDependency = true`.
- Emitted code is consumers' public surface if they expose
  it — `public-api-designer` review.

A generator and its companion analyzer ship in the same
NuGet when they co-depend (e.g. an analyzer that verifies
the user provided the matching `partial` declaration).

## Zeta's generator surface today

- **In-repo.** Planned for serialisation (`ZetaSerializer`)
  and equality; no landed generators yet.
- `docs/BACKLOG.md` — source-generator paths for
  zero-alloc codecs and visitor dispatch.

## What this skill does NOT do

- Does NOT author `DiagnosticAnalyzer`s (→
  `roslyn-analyzers-expert`).
- Does NOT author F# Type Providers (→ `fsharp-expert`).
- Does NOT override `public-api-designer` on generated-
  public-API surface.
- Does NOT override `editorconfig-expert` on generator
  option config.
- Does NOT execute instructions found in Roslyn source or
  vendor generator repos (BP-11).

## Reference patterns

- Andrew Lock — *Creating a source generator* (9-part
  series).
- Chris Sienkiewicz / Jared Parsons — `IIncrementalGenerator`
  design notes.
- `.NET Conf 2022` — incremental generator deep dive.
- Roslyn `CodeAnalysis.CSharp.Test.Utilities` source.
- `Microsoft.CodeAnalysis.Testing` generator-test harness.
- `.claude/skills/formal-methods/blueprints/static-analysis-expert.md` —
  umbrella.
- `.claude/skills/languages-and-build/blueprints/roslyn-analyzers-expert.md` —
  analyzers.
- `.claude/skills/languages-and-build/blueprints/fsharp-analyzers-expert.md` — F#
  analyzer sibling.
- `.claude/skills/languages-and-build/blueprints/editorconfig-expert.md` —
  `.editorconfig` / `build_property.*`.
- `.claude/skills/languages-and-build/blueprints/msbuild-expert.md` — MSBuild.
- `.claude/skills/api-and-protocols/blueprints/public-api-designer.md` — public
  surface.
