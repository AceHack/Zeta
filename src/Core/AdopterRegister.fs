namespace Zeta.Core

/// **The `adopter` register — folding adoption declarations into a Z-set.**
///
/// Models adoption of the Zeta Manifesto as a declared stance (Adopted) and
/// un-adopting as a retraction (Retracted). The fold maintains a Z-set of
/// active adopters.
///
/// This serves as the register for the N_eff constitutional promotion gate
/// defined in MANIFESTO.md. The gate is necessary but not sufficient: passing
/// it licenses a positive human act of promotion, failing it blocks.
module AdopterRegister =

    /// An event on the adopter stream (+1 or -1 fold).
    type AdoptionEvent =
        | Adopted of identity: string * lineage: ProvenancePoly
        | Retracted of identity: string * lineage: ProvenancePoly

    /// The active register is a Z-set of identity strings with provenance polynomial weights.
    type Register = ZSetW<string, ProvenancePoly>

    /// Empty register
    let empty : Register = ZSetW.empty

    /// Apply a single event, maintaining Z-set semantics.
    let apply (reg: Register) (ev: AdoptionEvent) : Register =
        match ev with
        | Adopted (id, lineage) ->
            ZSetW.sumBy (ProvenanceRing()) reg (ZSetW.singletonBy (ProvenanceRing()) id lineage)
        | Retracted (id, lineage) ->
            let retracted = ZSetW.singletonBy (ProvenanceRing()) id (Provenance.negate lineage)
            ZSetW.sumBy (ProvenanceRing()) reg retracted

    /// Fold a sequence of events into a register.
    let fold (events: AdoptionEvent seq) : Register =
        Seq.fold apply empty events

    /// Retrieve the currently active adopters and their provenance lineage.
    let activeAdopterLineages (reg: Register) : (string * ProvenancePoly) list =
        reg
        |> Seq.map (fun e -> e.Key, e.Weight)
        |> Seq.toList

    /// Retrieve the currently active adopters.
    let activeAdopters (reg: Register) : string list =
        activeAdopterLineages reg |> List.map fst

    /// The number of unique active adopters.
    let activeCount (reg: Register) : int =
        reg.Count

    /// The fixed, manually chosen constitutional threshold.
    /// As stated in the manifesto review: "A threshold is chosen, not derived."
    [<Literal>]
    let RequiredNEff = 10.0

    /// Evaluate whether the current register state licenses the human act of
    /// constitutional promotion, utilizing the structural correlation estimator.
    ///
    /// N_eff = n / (1 + (n-1)*rho)
    /// 
    /// If N_eff >= 10.0, promotion is licensed.
    let isPromotionLicensed (reg: Register) : bool =
        let n = activeCount reg
        if n = 0 then false
        else
            let lineages = activeAdopterLineages reg |> List.map snd
            let rho = LineageDisjointnessEstimator.lineageDisjointness lineages
            // Uses the Kish design effect implemented in DeclaredStanceLedger
            let nEff = DeclaredStanceLedger.effectiveIndependentCount n rho
            nEff >= RequiredNEff
