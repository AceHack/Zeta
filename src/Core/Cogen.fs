namespace Zeta.Core

/// **Cogen — the 3rd Futamura projection, realized in our domain (`gen(gen) == gen`).**
/// (Aaron 2026-07-02: "Futamura i want to get to next level".)
///
/// The ladder so far: `Slr.build : Grammar → Tables` is the 1st projection (specialize the LR
/// interpreter to a grammar ⇒ the residual parser); `build >> toDynamicValue` is the 2nd (a
/// parser-GENERATOR: grammar → a serialized specialized parser). This module closes the loop.
///
/// `compile = mix ∘ read`:
///   - `read` (MetaGrammar) turns grammar-*notation text* into a `Grammar` — its input language is
///     defined by the homoiconic meta-grammar kernel;
///   - `mix` is `Slr.build` — our (domain-specific) specializer;
///   - the residual is serialized to byte-locked IR.
/// So `compile : notation text → serialized specialized parser`, in one arrow.
///
/// **The cogen FIXPOINT** (the lvl-3 content, proven to exact `DynamicValue` equality):
///
///     compile (emit kernel)  =  toDynamicValue (build kernel)
///
/// The compiler, fed the definition of *its own input language* (the kernel's notation), **reproduces
/// itself** — the self-application that characterises `cogen`. And the regenerated parser actually
/// works: it parses grammar-notation, including the kernel's own defining text (full circle).
///
/// **Honest scope (Beacon, not hype):** our `mix` is a *domain-specific* specializer (LR parsing),
/// not a general partial evaluator, so this is the 3rd projection realised **in-domain**. The
/// self-application and its fixpoint are real and machine-checked; a *fully general* cogen (mix
/// applied to mix over arbitrary programs) would need a general `mix`, which we do not claim to have.
///
/// Anchors: Futamura (1971 — the three projections; 3rd = cogen); Ershov (mixed computation); Jones/
/// Gomard/Sestoft (1993). Composes `MetaGrammar` + `Slr`.
[<RequireQualifiedAccess>]
module Cogen =

    /// Compile grammar-notation text into a byte-locked, serialized specialized parser (parser-IR).
    /// `mix ∘ read`: read the notation into a `Grammar`, specialize the LR interpreter to it
    /// (`Slr.build`), serialize the residual (`Slr.toDynamicValue`).
    let compile (src: string) : Result<DynamicValue, string> =
        MetaGrammar.read src
        |> Result.bind Slr.build
        |> Result.map Slr.toDynamicValue

    /// The meta-parser **regenerated** by compiling the kernel's own notation — the fixpoint's LHS.
    let regenerateMetaParser () : Result<DynamicValue, string> =
        compile (MetaGrammar.emit MetaGrammar.kernel)

    /// The meta-parser built **directly** from the kernel — the fixpoint's RHS.
    /// `regenerateMetaParser ()` equals this: `gen(gen) == gen`.
    let directMetaParser () : Result<DynamicValue, string> =
        Slr.build MetaGrammar.kernel |> Result.map Slr.toDynamicValue
