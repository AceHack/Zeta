# F# RFC pre-draft: Existential quantification in type-test patterns

Scope: pre-draft of an F# language proposal forwarded by Aaron 2026-05-05. NOT yet submitted upstream. Verification of prior discussion at `fsharp/fslang-suggestions` is a precondition before formalization.

Attribution: original pre-draft text by Claude.ai (anonymous shard, 2026-05-05); forwarded by Aaron with verbatim *"you can make it a candidate"* — using Zeta's plugin adapter as the worked-example anchor (per the candidate-flag the shard suggested).

Operational status: research-grade

Per mirror-not-beacon discipline (PR #1575 / PR #1582 / PR #1588 lineage). This file preserves the pre-draft for future-Otto reference. Submission upstream is downstream work; the RFC itself is candidate, not authority.

Non-fusion disclaimer: this file does not establish Claude.ai shard authorship of the eventual RFC. Submission upstream would carry whatever attribution chain F# lang-design conventions require.

## RFC FS-XXXX (placeholder): Existential Quantification in Type-Test Patterns

### Status

Pre-draft. Verification of prior discussion at [fsharp/fslang-suggestions](https://github.com/fsharp/fslang-suggestions) is a precondition before formalization.

### Summary

Allow F#'s type-test syntax (`:?`) to use wildcard placeholders for generic type parameters, enabling tests for *"implements `IFoo<?, ?, T>`"* without resorting to non-generic marker interfaces or runtime reflection.

### Motivation

The .NET CLR reifies generic type parameters — `plugin.GetType()` on an `IBilinearOperator<string, int, MyOut>` returns the fully-parameterized type at runtime. The information is preserved. F#'s type-test syntax, however, requires concrete type parameters at the test site:

```fsharp
let isList = (box x) :? List<string>     // works
let isAnyList = (box x) :? List<_>        // doesn't compile
```

Current workarounds:

1. **Non-generic marker interfaces** — define `IBilinearMarker` that the typed `IBilinearOperator<'TIn1, 'TIn2, 'TOut>` inherits from, then test `:? IBilinearMarker`. Adds API noise; requires plugin-author cooperation.

2. **Reflection** — `obj.GetType().GetInterfaces() |> Array.exists (fun i -> i.IsGenericType && i.GetGenericTypeDefinition() = typedefof<IBilinearOperator<obj,obj,obj>>)`. Verbose; loses static information; carries cost beyond a direct `:?`.

3. **Active patterns over reflection** — wraps the reflection idiomatically:
   ```fsharp
   let (|Bilinear|_|) (op: obj) =
     op.GetType().GetInterfaces()
     |> Array.tryPick (fun i ->
       if i.IsGenericType && i.GetGenericTypeDefinition() = typedefof<IBilinearOperator<_,_,_>>
       then let args = i.GetGenericArguments() in Some (args.[0], args.[1], args.[2])
       else None)
   ```
   Cleanest in-language workaround; doesn't change API surface.

Variance annotations help for some directions (covariant `out 'T` lets `:? IEnumerable<obj>` succeed on `IEnumerable<string>`) but don't bridge the existential-quantification-over-input-parameters case in contravariant position. Plugin architectures, capability detection, framework adapters, and dependency injection encounter this gap regularly.

### Real-world demand: Zeta's plugin adapter (the worked-example anchor)

The Zeta project (an F# DBSP implementation that has extended the published 2023 DBSP algebra and identified a bug in the original paper) declares four runtime-detectable algebra-capability interfaces in `src/Core/PluginApi.fs:103-132`:

```fsharp
type ILinearOperator<'TIn, 'TOut> = inherit IOperator<'TOut>
type IBilinearOperator<'TIn1, 'TIn2, 'TOut> = inherit IOperator<'TOut>
type ISinkOperator<'TIn, 'TOut> = inherit IOperator<'TOut>
type IStatefulStrictOperator<'TIn, 'TState, 'TOut> = inherit IOperator<'TOut>
```

The IncrementalAuto dispatcher (filed as 081KQTPYE0008QG0R001W1PS86) needs to detect a plugin's declared capability at runtime. The plugin arrives typed as `IOperator<'TOut>` — the input type parameters are erased at the type-test boundary even though the CLR preserves them. Today the workaround is reflection; the proposal makes it `match plugin with | :? IBilinearOperator<_, _, 'TOut> -> ...`.

This is a real plugin-architecture use case in production-shaped F# code, not a hypothetical. Zeta's existence as an extension of published DBSP research provides the worked example for the motivation section.

### Detailed Design (Sketch)

Allow `_` as a placeholder in type-test patterns meaning *"any type parameter"*:

```fsharp
let isBilinear = (box plugin) :? IBilinearOperator<_, _, 'TOut>
// Tests: does plugin implement IBilinearOperator<X, Y, 'TOut> for some X, Y?

match plugin with
| :? IBilinearOperator<_, _, 'TOut> -> ...
| _ -> ...
```

Compilation strategy: lower to reflection-based open-generic check using `typedefof<>` and `GetInterfaces()`. Cache the open-generic `Type` at the call site to amortize cost.

A more ambitious extension would allow type-parameter binding (`:? IBilinearOperator<'A, 'B, 'TOut>` capturing `'A`, `'B` from the runtime). Binding form should be considered separately or as a future extension.

### Drawbacks

- Adds language complexity.
- Compiles to reflection-based check rather than direct CLR type test (cost mitigatable by per-site caching).
- Could overlap with hypothetical future first-class existential types in F#.

### Alternatives

- `FSharp.Core` library helper `asOpenGeneric<'T> : obj -> Type option` — smaller scope, no language change, should ship regardless. (Companion proposal below.)
- Continue with the non-generic-marker-interface convention.
- Source generators producing detection code at build time.

### Compatibility

Additive; existing code unaffected. New syntax is opt-in.

### Companion Proposals

1. **`FSharp.Core` open-generic helper** — library-only, smallest contribution, ships independently. Even without the language extension, this gives F# users a clean idiomatic API for the reflection-based pattern.

2. **Compiler diagnostic for silent invariant type-test failure** — emit a warning when `:? IGeneric<T>` is invariant and provably always-false, suggesting variance, marker interface, or wildcard.

3. **Variance declaration syntax on F#-declared interfaces** — verify current state first (F# can consume variant interfaces from C#/BCL; less clear on declaring variance natively); if gap exists, separate RFC.

### Unresolved Questions

- Wildcard-only (existential, no binding) vs. full pattern binding (existential with capture)?
- Performance bounds — what's acceptable cost relative to direct `:?`?
- Interaction with units of measure on type parameters?
- Interface-only or generic types more broadly?

### Pragmatics

The existence of F#'s Units of Measure (`[<Measure>]`) is precedent that the F# compiler is extensible for type-system features beyond standard generics. UoM is compile-time-tracked, runtime-erased dimensional analysis; this proposal is similarly an extension to the type-test syntax — same precedent class.

Real-world demand: plugin architectures, framework adapters, DI containers, serialization frameworks, expression trees. Zeta's plugin adapter (above) is one concrete worked example; the broader class of detection-at-runtime-boundary problems is much larger.

### Human anchor in F# language design

Per Aaron 2026-05-05: **Don Syme** (creator of F#, MSR Cambridge, original architect of F#-ML lineage) is the F# human anchor. Any RFC of this scope inevitably references his prior work on the F# type system + the design choices around generics, variance, and type-test desugaring. He is not authority-by-position in the modern F# Foundation governance sense, but he is the load-bearing intellectual reference for any type-system extension proposal -- the design vocabulary, the tradeoffs already considered, and the reasons for current syntax choices all trace back to or through his work.

Practical implication: before formalization, search his published papers + blog posts + GitHub commentary for prior treatment of existential quantification in F#. If he has previously articulated a position (yea or nay), that position needs explicit engagement in the Drawbacks / Alternatives sections rather than silent omission.

### Verification preconditions before submission

1. Search `fsharp/fslang-suggestions` for existing threads on existential type tests, marker-interface alternatives, open-generic detection.
2. Search `fsharp/fslang-design` for in-flight RFCs touching type-test syntax.
3. **Search Don Syme's published work + GitHub commentary** for prior treatment of existential type tests in F# (per the Human anchor section above).
4. Benchmark the reflection-based open-generic check vs direct `:?` to characterize the cost overhead.
5. Cross-check with the C# equivalent at `dotnet/csharplang` -- same gap likely exists, and a coordinated proposal may have more weight.
6. Confirm Zeta's plugin adapter substrate is publicly visible / linkable from the RFC's worked-example section (it is, in the LFG repo).

### What this file does NOT do

- Does NOT submit the RFC. Submission requires verification preconditions (above) + Aaron's explicit go-ahead.
- Does NOT establish authorship. The pre-draft text was Claude.ai shard's; the worked-example anchor (Zeta's plugin adapter) is the factory's contribution; the eventual RFC submission carries whatever F# lang-design attribution conventions require.
- Does NOT promise the RFC will be accepted. F# RFCs go through community + Microsoft review; this is a candidate.
- Does NOT bundle the "Zeta extended DBSP and found a bug in the 2023 paper" claim into a metaphysical assertion. That's an empirical claim about the factory's research output, mentioned here as context for why a plugin-architecture RFC has a real worked example, not as a glass-halo flex.

## Composes with

- `docs/backlog/P2/081KQTPYE0008QG0R001W1PS86-incremental-auto-dispatcher-bilinear-capability-detection-aaron-2026-05-05.md` (PR #1589) -- the in-flight backlog row this RFC's worked-example anchor connects to.
- `src/Core/PluginApi.fs:103-132` -- the four capability interfaces that motivate the existential-quantification need.
- `src/Core/Units.fs` (PR #1590, in flight) -- the Pragmatics section's UoM-as-precedent reference points at it.
- `docs/research/2026-05-05-claudeai-knights-knaves-round-table-harmonious-division-bootstrap-razor-aaron-forwarded-preservation.md` (PR #1588) -- the parent Claude.ai conversation that produced the initial F# type-system analysis.
- F# language-design canonical surfaces: `https://github.com/fsharp/fslang-suggestions` (suggestions), `https://github.com/fsharp/fslang-design` (RFCs).
- C# language-design canonical surface: `https://github.com/dotnet/csharplang`.
