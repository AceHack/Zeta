namespace Zeta.Core

/// Reference quorum arithmetic over the correlation components reported by `AntiSybil`.
/// Each component contributes one agreed value, or is excluded if its claims disagree.
/// Nonempty exact/complemented replay records collapse at thresholds at most one.
///
/// Component count does not establish independent entropy or distinct controllers:
/// balanced recodings of one shared stream can contribute multiple votes. Consequently
/// the `2f+1` arithmetic is conditional on an external membership/admission and fault
/// model; this module does not prove BFT safety or resistance to general Sybil attacks.
/// The TLA+ model's given `SameId` relation is not implemented by this statistic.
module SybilBft =

    /// A claimed identity, a supplied bit-stream observation, and a vote value.
    /// The stream does not authenticate the claim or certify physical distinctness.
    type Vote<'v when 'v: comparison> =
        { Claimed: int
          Stream: int list
          Value: 'v }

    /// How a correlation component voted after grouping its claims.
    type SourceVote<'v when 'v: comparison> =
        | Agreed of 'v // all component claims supply one value
        | Equivocated // component claims disagree; excluded without inferring intent or provenance

    /// Result of tallying votes by observed component; source-named fields retain that meaning.
    type Tally<'v when 'v: comparison> =
        { /// Number of observed correlation components (`AntiSybil.DistinctCount`).
          DistinctSources: int
          /// Invocation-local component id to agreed value or disagreement.
          BySource: Map<int, SourceVote<'v>>
          /// Value to number of components with unanimous claims for that value.
          VotesByValue: Map<'v, int>
          /// Number of components containing different vote values.
          Equivocators: int }

    /// Group votes by the correlation-threshold graph, then count one vote for each component
    /// with a unanimous value. This limits identical record replay; deterministic recoding can
    /// evade grouping. `Claimed` is not used for admission or authentication here.
    let tally (threshold: float) (votes: Vote<'v> list) : Tally<'v> =
        let streams = votes |> List.map (fun v -> v.Stream)
        let verdict = AntiSybil.antiSybil threshold streams
        // Group input indices by their observed correlation component.
        let bySource =
            votes
            |> List.mapi (fun i v -> verdict.SourceOf.[i], v.Value)
            |> List.groupBy fst
            |> List.map (fun (src, pairs) ->
                let values = pairs |> List.map snd |> List.distinct
                let sv = match values with [ v ] -> Agreed v | _ -> Equivocated
                src, sv)
            |> Map.ofList

        let votesByValue =
            bySource
            |> Map.toList
            |> List.choose (fun (_, sv) -> match sv with Agreed v -> Some v | Equivocated -> None)
            |> List.countBy id
            |> Map.ofList

        let equivocators =
            bySource |> Map.toList |> List.sumBy (fun (_, sv) -> match sv with Equivocated -> 1 | _ -> 0)

        { DistinctSources = verdict.DistinctCount
          BySource = bySource
          VotesByValue = votesByValue
          Equivocators = equivocators }

    /// Quorum arithmetic for a caller-supplied fault budget: `2 * max(0,f) + 1`.
    let quorumSize (f: int) : int = 2 * (max 0 f) + 1

    /// Fault-budget arithmetic from a supplied participant count; the caller must justify that count.
    let maxFaults (distinctSources: int) : int = (max 0 distinctSources - 1) / 3

    /// Does `value` have at least `2f+1` unanimous component votes? No admission premise is checked.
    let hasQuorum (f: int) (value: 'v) (t: Tally<'v>) : bool =
        (t.VotesByValue |> Map.tryFind value |> Option.defaultValue 0) >= quorumSize f

    /// First value in comparison order meeting the component-derived quorum, if any.
    /// This reference arithmetic derives `f` from observed components; it does not establish
    /// their controller distinctness or supply a protocol agreement proof.
    let decide (t: Tally<'v>) : 'v option =
        let f = maxFaults t.DistinctSources
        let q = quorumSize f
        t.VotesByValue
        |> Map.toList
        |> List.tryFind (fun (_, n) -> n >= q)
        |> Option.map fst
