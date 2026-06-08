namespace Zeta.Core

/// **`SybilBft` — Byzantine fault tolerance whose quorum counts *distinct sources*, not *claimed identities*
/// (Aaron 2026-06-08: "the start of a unique BFT").**
///
/// Classical BFT (PBFT, HotStuff) assumes `n` participants are *already distinct* and needs `n ≥ 3f+1`,
/// quorum `2f+1`. The unhandled attack underneath that assumption is **Sybil**: one Byzantine node forging
/// `k` identities votes `k` times, inflating `n` and breaking the `f < n/3` bound. Permissionless chains
/// patch this *economically* (PoW/PoS make each identity expensive). This module patches it **physically**:
/// the quorum is taken over the **distinct entropy sources** found by `AntiSybil` (non-fungible drift, #7091),
/// so forged identities collapse to the one clock that produced them *before* votes are counted.
///
/// **Anti-Sybil comes first, then voting** — that ordering is the novelty (the prior-art search 2026-06-08
/// found PoW/PoS-gated committees and "consensus on the honest identity set," but none deriving the quorum
/// from a physical proof-of-distinctness). The classical bound is recovered exactly, but on `d` = distinct
/// sources rather than `k` = claims: safety needs `d ≥ 3f+1`, quorum `2f+1` distinct sources.
///
/// **Honest scope (peel):** inherits `AntiSybil`'s scope — sound against *exact* identity-replay; noisy
/// forgeries sit on the detection/length curve. An **equivocating** source (same clock, conflicting votes
/// across its claims) is detected and excluded — it cannot have its conflicting votes both counted, which is
/// the other half of Byzantine behaviour. This is a *reference model*, not a wire protocol: no network,
/// timeouts, view-change, or leader election yet. Route the adversary model to Aminata/Mateo; do not claim
/// "a new BFT" outward before naming-expert + Ilyana + human review.
module SybilBft =

    /// A vote: a *claimed* identity, the drift bit-stream that is supposed to certify its distinctness, and
    /// the value it votes for.
    type Vote<'v when 'v: comparison> =
        { Claimed: int
          Stream: int list
          Value: 'v }

    /// How a distinct source voted after collapsing its claims.
    type SourceVote<'v when 'v: comparison> =
        | Agreed of 'v // all of this source's claims voted the same value — one honest-shaped vote
        | Equivocated // this source's claims disagree — detected Byzantine equivocation, excluded from quorum

    /// Result of tallying votes by distinct source.
    type Tally<'v when 'v: comparison> =
        { /// Distinct entropy sources detected (`AntiSybil.DistinctCount`) — the *real* `n` for the BFT bound.
          DistinctSources: int
          /// Source id → how it voted (agreed value, or equivocated).
          BySource: Map<int, SourceVote<'v>>
          /// Value → number of **distinct, non-equivocating** sources that voted for it.
          VotesByValue: Map<'v, int>
          /// Distinct sources caught equivocating (Byzantine).
          Equivocators: int }

    /// Tally `votes` by distinct source: collapse Sybil-correlated claims via `AntiSybil` (`threshold`), then
    /// give **one** vote per distinct source — `Agreed v` if all its claims voted `v`, else `Equivocated`.
    /// This is the anti-Sybil-first step: vote-stuffing collapses before counting.
    let tally (threshold: float) (votes: Vote<'v> list) : Tally<'v> =
        let streams = votes |> List.map (fun v -> v.Stream)
        let verdict = AntiSybil.antiSybil threshold streams
        // Group claim indices by their detected source.
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

    /// The Byzantine quorum size for `f` tolerated faulty sources: `2f+1`.
    let quorumSize (f: int) : int = 2 * (max 0 f) + 1

    /// The max faulty sources the classical bound tolerates given `d` distinct sources: `⌊(d-1)/3⌋`.
    let maxFaults (distinctSources: int) : int = (max 0 distinctSources - 1) / 3

    /// Does `value` have a `2f+1` quorum of **distinct** sources? (Sybil inflation already collapsed.)
    let hasQuorum (f: int) (value: 'v) (t: Tally<'v>) : bool =
        (t.VotesByValue |> Map.tryFind value |> Option.defaultValue 0) >= quorumSize f

    /// The decided value, if any single value holds a `2f+1` distinct-source quorum. `f` is derived from the
    /// distinct-source count (`maxFaults`), so the bound tracks *real* participants, not claimed ones.
    let decide (t: Tally<'v>) : 'v option =
        let f = maxFaults t.DistinctSources
        let q = quorumSize f
        t.VotesByValue
        |> Map.toList
        |> List.tryFind (fun (_, n) -> n >= q)
        |> Option.map fst
