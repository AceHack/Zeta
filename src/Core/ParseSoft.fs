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

    /// The weighted bridge: an SPPF + production weights → a `SoftValue` over parses, each parse's
    /// mass ∝ the product of its production weights (its inside weight). This is `PredictProbability`
    /// over the decision forest — the inference-weighted superposition, not uniform. `None` if there
    /// is no parse. (`weight` comes from set potentials or EM-learned inside–outside expected counts.)
    let ofSppf (weight: int -> float) (maxTrees: int) (f: Sppf.Forest) : SoftValue.SoftValue option =
        ofWeightedForest (Sppf.weightedTrees weight maxTrees f)

    /// **Lowering as the Kleisli descent** (Aaron 2026-07-02: "build lowering as the kleisli
    /// descent"). Given a **semantic map** `lowerParse : parse-tree → SoftValue<lowered>` — a
    /// Kleisli arrow taking one parse to a *distribution* over its lowered forms (e.g. ISA
    /// programs) — lower a whole `SoftValue` over parses into a `SoftValue` over lowered forms by
    /// monadic **`bind`**. The distribution carries THROUGH: the parse superposition becomes a
    /// superposition over lowered programs, **never collapsed early** (only `SoftValue.resolve`
    /// snaps it, when the future forces a value). Lowering is the *descent* (Lucifer) dual of the
    /// parse's *ascent* (God) — the same monad, both poles.
    ///
    /// The specific parse→ISA *semantic* mapping is the **injected** `lowerParse` — deliberately
    /// not fixed here (that is a design decision, not something to guess). What this provides is the
    /// monad plumbing — the Kleisli composition itself — which is the part ANTLR has no concept of.
    let lower (lowerParse: DynamicValue -> SoftValue.SoftValue) (sv: SoftValue.SoftValue) : SoftValue.SoftValue =
        SoftValue.bind lowerParse sv

    /// A **runnable default** parse→program lowering (Aaron 2026-07-02: "run with it now while we can
    /// change things"). Structure-preserving: a parse tree `{rule,kids}` lowers to an op node
    /// `{op, args}` (rule → op, children → args), and a leaf `{term}` lowers to `{op:"EMIT", tok}`.
    /// Deterministic per parse ⇒ a point mass, so `lower lowerStructural` carries the parse
    /// distribution THROUGH to a distribution over *programs* (different tree shapes → different
    /// programs → the superposition survives). This is a sensible, ROLLABLE first map — not the
    /// final ISA semantics (that stays Aaron's design call); it makes the descent runnable end to
    /// end today so the whole pipeline `grammar → SoftValue over parses → SoftValue over programs`
    /// executes for real, and the mapping is swapped later behind the same `lower`.
    let rec lowerTree (parse: DynamicValue) : DynamicValue =
        match DynamicValue.tryField "term" parse with
        | Some tok -> DynamicValue.Object [ "op", DynamicValue.String "EMIT"; "tok", tok ]
        | None ->
            match DynamicValue.tryField "rule" parse, DynamicValue.tryField "kids" parse with
            | Some(DynamicValue.String rule), Some(DynamicValue.Array kids) ->
                DynamicValue.Object [ "op", DynamicValue.String rule; "args", DynamicValue.Array(kids |> List.map lowerTree) ]
            | _ -> parse

    /// The default lowering as a Kleisli arrow (point mass per parse).
    let lowerStructural (parse: DynamicValue) : SoftValue.SoftValue = SoftValue.certain (lowerTree parse)

    /// Run the full descent with the default map: a `SoftValue` over parses → a `SoftValue` over
    /// programs (structure-preserving; superposition preserved). Swap `lowerStructural` for the real
    /// ISA map behind `lower` when it's defined.
    let lowerDefault (sv: SoftValue.SoftValue) : SoftValue.SoftValue = lower lowerStructural sv
