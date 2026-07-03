namespace Zeta.Core

/// **ParseSoft — the ambiguous parse forest as a `SoftValue` superposition over parses.**
/// (Aaron 2026-07-02, shadow*: "infer.net style EP/BP/VMP plus our custom emotional propagation
/// to make this ambiguous superposition over our ISA.")
///
/// The GLR forest (`Slr.glrForest`) is the SUPPORT of a distribution over parses. This bridges
/// it to a `SoftValue` — a normalized distribution over the parse `DynamicValue`s — so an
/// ambiguous parse is carried as a soft superposition, not collapsed to accept/reject. `v1`
/// weights the parses UNIFORMLY (each equally likely); the real potentials come from running
/// message passing over the forest-as-factor-graph — and Zeta already has that infrastructure
/// (`Zeta.Bayesian.FactorGraph` / `.Ep` / `.Message` / `.InferNetTopology`), so the EP/BP/VMP
/// weighting rung builds on it (don't reinvent), with the custom emotional-propagation schedule
/// composed on the same graph (math-team formalization).
///
/// Once weighted, `SoftValue.resolve` snaps to the MAP parse when a definite value is forced;
/// otherwise the superposition rides on (uncertainty in the value). Each parse lowers to an ISA
/// program, so this is a soft superposition OVER THE ISA — what the soft scheduler / prediction
/// mode consume.
///
/// Doctrine: docs/research/2026-07-02-ambiguous-parse-forest-as-factor-graph-ep-bp-vmp-emotional-
/// propagation-soft-superposition-over-isa.md. Anchors: Tomita (GLR forest); SoftValue; Infer.NET.
[<RequireQualifiedAccess>]
module ParseSoft =

    /// A forest of parse trees → a `SoftValue` distribution. `None` if the forest is empty
    /// (no parse). Weights default to uniform; pass explicit potentials via `ofWeightedForest`.
    let ofForest (trees: DynamicValue list) : SoftValue.SoftValue option =
        SoftValue.ofWeighted (trees |> List.map (fun t -> t, 1.0))

    /// A forest with explicit per-parse potentials (e.g. from BP/EP over the forest) → a
    /// `SoftValue`. The shape the inference rung produces; `SoftValue` normalizes.
    let ofWeightedForest (weighted: (DynamicValue * float) list) : SoftValue.SoftValue option =
        SoftValue.ofWeighted weighted

    /// Parse ambiguous input into a `SoftValue` superposition over parse trees (uniform v1).
    /// `None` if there is no parse.
    let glrSoft (t: Slr.GlrTables) (maxTrees: int) (tokens: string list) : SoftValue.SoftValue option =
        ofForest (Slr.glrForest t maxTrees tokens)
