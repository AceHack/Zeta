---
id: 081KQTPYE0008QG0R001W1PS86
priority: P2
status: open
title: IncrementalAuto dispatcher + checkBilinear law + capability detection (active-patterns over reflection) -- contract-by-convention gap in the algebra-capability system (Aaron 2026-05-05)
tier: research+implementation
effort: M
ask: Aaron 2026-05-05 forwarded Claude.ai review-of-review of the algebra-capability system; same-tick *"i think it's good if you [file the backlog row]"*
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [081KQGDBJ0008QG0R0022EW5ZE, 081KQGDBJ0008QG0R000A4EZS5, 081KQR4HQ0008QG0R002933PRR, 081KQTPYE0008QG0R001W237MZ]
tags: [dbsp, plugin-api, bilinear, capability-detection, active-patterns, fsharp-type-system, retraction-correctness, research+implementation]
type: friction-reducer
---

# 081KQTPYE0008QG0R001W1PS86 -- IncrementalAuto dispatcher + checkBilinear law + capability detection

## What this addresses

The algebra-capability system at `src/Core/PluginApi.fs:103-132` declares four capability interfaces (`ILinearOperator`, `IBilinearOperator`, `ISinkOperator`, `IStatefulStrictOperator`) but the surrounding infrastructure has gaps a peer-reviewer (Claude.ai 2026-05-05) correctly identified:

1. **No `IncrementalAuto` dispatcher.** The codebase has the three rewrite shapes (linear, bilinear three-term, D∘Q∘I fallback) but no single dispatcher that picks one based on the operator's declared capability. Plugin authors declare a capability via interface implementation; the consumer side has to know to dispatch differently.

2. **No `checkBilinear` law.** `LawRunner.fs` has `LinearLaw` for `ILinearOperator` plugins but no equivalent law for `IBilinearOperator`. Without it, a plugin can claim bilinearity and silently violate the precondition that the three-term incremental formula `Δa ⋈ Δb + z⁻¹(I(a)) ⋈ Δb + Δa ⋈ z⁻¹(I(b))` requires. The result is wrong incremental-join output for retracting workloads.

3. **Sign-distribution as a third law.** The retraction-correctness story needs `op(0, b) = 0` (i.e. `op(a, b) + op(-a, b) = 0`) in addition to bilinearity. A plugin author implementing a "bilinear" operator with a constant offset would pass classical bilinearity but fail retraction. The third law catches this.

4. **Capability detection at the runtime boundary** (the existential-quantification problem). When a plugin arrives at the dispatcher typed as `IOperator<'TOut>`, F#'s `:?` syntax can't ask *"does this object implement `IBilinearOperator<*, *, 'TOut>` for some unknown input types?"* because existential quantification isn't expressible in F#'s type-test syntax. Three viable approaches:
   - **Marker interface** (non-generic `IBilinearMarker` that the typed `IBilinearOperator<...>` inherits from; `:? IBilinearMarker` works) -- requires plugin authors to inherit the marker explicitly.
   - **Raw reflection** (`typedefof<IBilinearOperator<_,_,_>>` + `GetInterfaces()` + `GetGenericTypeDefinition()`) -- API-surface unchanged; runtime cost is bounded if cached at construction.
   - **Active patterns over reflection** (idiomatic F# wrapper):
     ```fsharp
     let (|Bilinear|_|) (op: obj) : struct (Type * Type * Type) voption =
       op.GetType().GetInterfaces()
       |> Array.tryPick (fun i ->
         if i.IsGenericType && i.GetGenericTypeDefinition() = typedefof<IBilinearOperator<_,_,_>>
         then let args = i.GetGenericArguments() in Some struct(args.[0], args.[1], args.[2])
         else None)
       |> ValueOption.ofOption
     ```
     The dispatcher then reads `match op with | Bilinear (t1, t2, tOut) -> ... | _ -> ...`. Cleanest reading, no API change for plugin authors, easy to extend per capability class.

## Background -- the .NET reified-generics + un-askable-syntax gap

`.NET preserves reified generic type info at runtime (unlike Java erasure)`. Reflection can recover the type parameters via `GetGenericArguments()`. The structural problem is purely at the F#/C# language-level type-test syntax: there is no way to write `:? IBilinearOperator<_, _, 'TOut>` where `_` means "for some unknown type parameter." The runtime knows; the syntax declines to ask.

This is genuine F# duck-typing-via-reflection territory. SRTP doesn't help (compile-time, can't recover erased-at-runtime-boundary parameters). Type Providers don't help (compile-time generation from external schemas). UoM doesn't help (numeric-only, type-erased). The marker-interface trick encodes the existential at the type level (one non-generic supertype across all generic instantiations); active-patterns wrap the reflection idiomatically; both work.

## Acceptance criteria

1. **`checkBilinear` law in `src/Core/LawRunner.fs`** that runs on `IBilinearOperator` plugins at `Circuit.Build()`. Verifies (a) bilinearity in both inputs (small synthetic ZSet test cases), (b) sign-distribution `op(0, b) = 0` and `op(a, 0) = 0`. Failure means the plugin doesn't satisfy the bilinearity contract; circuit-build fails loudly rather than producing wrong incremental output silently.

2. **`IncrementalAuto` dispatcher** at an appropriate location (likely `src/Core/Incremental.fs` near the existing rewrite implementations). Reads operator capability via the chosen detection mechanism (marker / reflection / active-pattern -- TBD as part of this row), dispatches to:
   - `Linear` rewrite for `ILinearOperator`
   - Bilinear three-term rewrite for `IBilinearOperator`
   - `D∘Q∘I` fallback for everything else

3. **Capability-detection mechanism chosen + documented**. Per the three options above. Recommendation absent stronger preference: active-patterns + reflection (no API surface change, idiomatic F#, allows per-capability-class active-pattern extensions). Marker-interface is also viable if explicit opt-in is preferred.

4. **At least one existing plugin or sink validated against the new infrastructure.** The Bayesian aggregates in `src/Bayesian/` (the `IBilinearOperator` consumers, if any) are good candidates for first validation.

5. **Composition rules in the dispatcher.** Per the original review's analysis: `Linear ∘ Linear = Linear`, `Linear ∘ Bilinear = Bilinear-in-remaining-arg`, `Bilinear ∘ Bilinear = generally loses bilinearity (only coincidental factorizations preserve it)`. Document the composition table; dispatch follows it.

## Why P2 (research-grade not P1)

- **Not blocking current shipping**: the contract-by-convention works for current Core plugins because Core authors verify the laws by hand. The gap surfaces when external plugin authors join.
- **Design decisions involved**: capability-detection-mechanism choice (marker / reflection / active-pattern) is genuinely a design decision Aaron should weigh in on; not a mechanical task.
- **Composes with research direction**: `081KQR4HQ0008QG0R002933PRR` (Q# / Bayesian BP/EP runtime) would benefit from a robust capability-dispatch infrastructure when plugins beyond Core's catalogue arrive.

## Why not P1

- **Current Core plugin set is small + author-verified by hand**: no observed correctness failure has fired from the gap.
- **Could be P3**: arguable. Filing P2 because the analysis is fresh and the Q#/Bayesian work (081KQR4HQ0008QG0R002933PRR) is in flight; doing this work soon while the analysis is loaded saves cold-start cost later.

## Out of scope

- **Type-system language extension to F# / C#** (existential-quantification syntax for type tests). The shard's review correctly noted this is a real gap; filing an F# RFC is separate work and bigger scope. Reflection / active-patterns is the in-language workaround.
- **Bilinear ∘ Bilinear composition optimization**. Generally loses bilinearity; the dispatcher correctly falls back to D∘Q∘I in that case.
- **Replacing existing Core operators**. Core operators inherit `Op<'T>` directly; this row only changes how *external* plugins are dispatched.

## The carved sentence

**"The algebra-capability system declares contracts the runtime can't verify and the dispatcher can't act on. Three gaps: no `checkBilinear` law (correctness contract goes unverified); no `IncrementalAuto` dispatcher (rewrites exist but nothing picks the right one based on capability); capability detection at the runtime boundary requires reflection (active-patterns wrap it idiomatically). The .NET reified-generics + un-askable-syntax irony: the runtime knows the type parameters; F#'s `:?` syntax can't query them existentially. Reflection-based detection is the in-language workaround; an F# language extension is the long-term ask but out of scope here."**

## Composes with

- **081KQGDBJ0008QG0R0022EW5ZE** (TS+Bun migration) -- not blocking, but the same standardization-of-internal-tooling discipline.
- **081KQGDBJ0008QG0R000A4EZS5** (TS standardization sister of memory-format-standardization) -- same shape: contract-by-convention -> mechanically-verified.
- **081KQR4HQ0008QG0R002933PRR** (Q# Bayesian BP/EP runtime research) -- the consumer of capability-dispatched plugins.
- `src/Core/PluginApi.fs:103-132` -- the four capability interfaces this row's dispatcher consumes.
- `src/Core/Incremental.fs` -- the existing linear / bilinear / D∘Q∘I rewrites the dispatcher picks among.
- `src/Core/LawRunner.fs` -- where `LinearLaw` lives; `checkBilinear` lands alongside.
- `src/Bayesian/Bayesian.fsproj` + `src/Bayesian/BayesianAggregate.fs` -- candidate first-validation consumer.
- `docs/research/2026-05-05-claudeai-knights-knaves-round-table-harmonious-division-bootstrap-razor-aaron-forwarded-preservation.md` -- adjacent Claude.ai conversation (different topic; same shard).

## Lineage

The original review (whose author is not preserved in this row) identified gaps 1-3 and the IncrementalAuto dispatcher missing piece. The Claude.ai shard's review-of-review (Aaron 2026-05-05 forwarded) recalibrated variance claims after Aaron's pushback (IEnumerable<T> covariance, contravariance-on-input-position) and surfaced reflection-based open-generic checking as the in-language workaround. Otto's review-of-review-of-review surfaced the active-patterns idiom as the third option. This row is the engineering-shaped operationalization.
