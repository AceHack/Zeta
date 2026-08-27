namespace Zeta.Core

/// **Discriminated unions expand into DynamicValue (collapsed) and SoftValue (Bayesian).**
///
/// Aaron 2026-08-26: DUs expand into DynamicValue and SoftValue — the bridge to
/// Bayesian stuff over **our own interpretation**. A local DU pick is a local
/// action; the global effect is a SoftValue `observe` (independent evidence
/// commutes) and, on the algebra side, a Z-set +1 of the collapsed case.
///
/// Wire shape matches `ObserveBridge.nextActionToDv`: an Object whose `"k"`
/// field is the case tag (ordinal). Collapsed = one case. Soft = a calibrated
/// distribution over cases. `SoftValue.snap` is the only legitimate collapse.
///
/// Overarching concert: **local actions lead to global effects.** One agent's
/// `localAction` is a +1; many independent locals `combine` / sequential
/// `observe` into one posterior. Same shape as `ZSetRx.connectQuery` and
/// `local-command` remote DU sync.
///
/// Anchors: F# discriminated unions (sum types); Pearl *Probabilistic Reasoning
/// in Intelligent Systems* (1988) — factor-graph / Bayesian update; SoftValue
/// never-collapse (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` SoftValue→DV snap).
[<RequireQualifiedAccess>]
module DuExpand =

    [<Literal>]
    let TagKey = "k"

    /// Collapsed DU case: `{ k: tag, ...fields }`. Extra fields are payload.
    let collapsed (tag: string) (fields: (string * DynamicValue) list) : DynamicValue =
        DynamicValue.Object((TagKey, DynamicValue.String tag) :: fields)

    let tagOf (dv: DynamicValue) : string option =
        match dv with
        | DynamicValue.Object kvs ->
            let rec find xs =
                match xs with
                | [] -> None
                | (n, DynamicValue.String t) :: _ when n = TagKey -> Some t
                | _ :: rest -> find rest
            find kvs
        | _ -> None

    /// Soft interpretation: a distribution over DU tags (our Bayesian reading).
    /// Each candidate is the collapsed object `{ k: tag }` with no extra fields.
    let interpret (weightedTags: (string * float) list) : SoftValue.SoftValue option =
        weightedTags
        |> List.map (fun (tag, w) -> collapsed tag [], w)
        |> SoftValue.ofWeighted

    /// Local action: emit one case. This is the +1. It does not rewrite anyone
    /// else's posterior — global effect is `globalEffect` / `SoftValue.observe`.
    let localAction (tag: string) (fields: (string * DynamicValue) list) : DynamicValue =
        collapsed tag fields

    /// Likelihood for a local pick: matching tag is boosted, other tagged cases
    /// stay positive (independent evidence must not wipe the support — a 0/1
    /// likelihood on mutually exclusive DU cases is a contradiction, not a vote).
    let likelihoodOf (action: DynamicValue) : DynamicValue -> float =
        let want = tagOf action
        fun candidate ->
            match want, tagOf candidate with
            | Some a, Some b when a = b -> 2.0
            | Some _, Some _ -> 1.0
            | _ -> 0.0

    /// Global effect of a local DU action: Bayesian update of the prior.
    /// Independent locals commute (`SoftValue.observe` multiplies likelihoods).
    /// `None` if the action zeros every candidate (contradiction, no fabricated certainty).
    let globalEffect (action: DynamicValue) (prior: SoftValue.SoftValue) : SoftValue.SoftValue option =
        SoftValue.observe (likelihoodOf action) prior
