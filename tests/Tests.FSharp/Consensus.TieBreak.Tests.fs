module Zeta.Tests.ConsensusTieBreakTests

// ── `decide` is the SHARED FOLD: it must be a function of the evidence MULTISET ────────────────
//
// `.claude/rules/local-time-never-enters-the-shared-fold.md` states the litmus as
//   "if two nodes with different receive-times could fold different sets, local time has leaked."
// Receive ORDER is the same door as a receive-time FIELD. Two nodes that received the same votes
// in different orders hold the same evidence *set*; if `decide` reads the order, they commit
// different values and DIVERGE — which is the defect the rule was carved to prevent, arriving
// through arrival order instead of a clock.
//
// So the guard is stated as a property, not as a case: the committed value is invariant under
// every permutation of the vote list. These tests FAIL against the first-occurrence tie-break
// (`List.groupBy` preserves first-occurrence order and `List.sortByDescending` is stable) and
// pass against the ordinal-minimum tie-break.
//
// Blast radius, pinned below: a tie can also reach quorum only at n ∈ {2, 3, 6}.

open System
open Xunit
open FsCheck.Xunit
open Zeta.Core.Consensus

let private stamp = DateTimeOffset.UnixEpoch

let private ballot (values: string list) =
    // NOTE: `Timestamp` is the field name on `main`. The open PR #10738 renames it to
    // `LocalObservedAt`; whichever of the two lands second rebases this line.
    values |> List.mapi (fun i v -> { Node = NodeId $"n{i}"; Value = v; Timestamp = stamp })

/// The full observable decision, node identity dropped — what two nodes must agree on.
let private decisionOf (values: string list) =
    match decide (ballot values) with
    | Committed(v, q, t) -> (true, Some v, q, t)
    | Rejected(_, q, t) -> (false, None, q, t)

let rec private permutations lst =
    match lst with
    | [] -> [ [] ]
    | _ ->
        lst
        |> List.mapi (fun i x ->
            lst
            |> List.indexed
            |> List.filter (fun (j, _) -> j <> i)
            |> List.map snd
            |> permutations
            |> List.map (fun rest -> x :: rest))
        |> List.concat

/// THE FALSIFIER. Exhaustive over every multiset of size 1..6 drawn from three symbols, and over
/// EVERY permutation of each — the whole reachable space of the defect, not a sampled corner.
/// Against first-occurrence this reports the offending multisets; against ordinal-minimum it is empty.
[<Fact>]
let ``decide is permutation-invariant — exhaustive, multisets of size 1..6 over 3 symbols`` () =
    let symbols = [ "a"; "b"; "c" ]

    let rec tuples n =
        if n = 0 then [ [] ]
        else [ for s in symbols do for rest in tuples (n - 1) -> s :: rest ]

    let multisets =
        [ for n in 1..6 do yield! tuples n ] |> List.map List.sort |> List.distinct

    let offenders =
        multisets
        |> List.choose (fun ms ->
            let outcomes = permutations ms |> List.map decisionOf |> List.distinct
            if List.length outcomes > 1 then Some(ms, outcomes) else None)

    Assert.True(
        List.isEmpty offenders,
        $"decide is order-dependent on %d{List.length offenders} multiset(s); first: %A{List.truncate 1 offenders}"
    )

/// The headline pair, spelled out so the regression reads as itself rather than as a search result.
/// n=6, a perfect 3/3 tie, threshold 3 — the only even-n shape where a tie also reaches quorum.
[<Fact>]
let ``n=6, 3-3 tie — a-first and b-first commit the same value`` () =
    Assert.Equal(3, quorumThreshold 6)
    let aFirst = decisionOf [ "a"; "a"; "a"; "b"; "b"; "b" ]
    let bFirst = decisionOf [ "b"; "b"; "b"; "a"; "a"; "a" ]
    Assert.Equal(aFirst, bFirst)

/// The state-machine path, which INVERTS the arrival order (`vote :: state.Votes` prepends), so a
/// tie committed the value that arrived LAST. Two nodes given the same votes in opposite orders
/// must reach the same decided round.
[<Fact>]
let ``state machine — arrival order does not change the decided value`` () =
    let six = [ for i in 0..5 -> NodeId $"n{i}" ]

    let run (arrivals: (int * string) list) =
        let s0 = emptyRound six
        let s1 =
            match transitionAt stamp s0 (Propose(six[0], "a")) with
            | TransitionResult.Ok s -> s
            | InvalidTransition r -> failwith r
        let voted =
            arrivals
            |> List.fold
                (fun st (i, v) ->
                    match transitionAt stamp st (CastVote(six[i], v)) with
                    | TransitionResult.Ok s -> s
                    | InvalidTransition r -> failwith r)
                s1
        match transitionAt stamp voted Finalize with
        | TransitionResult.Ok s -> s.Result |> Option.bind committedValue
        | InvalidTransition r -> failwith r

    let aFirst = run [ 0, "a"; 1, "a"; 2, "a"; 3, "b"; 4, "b"; 5, "b" ]
    let bFirst = run [ 3, "b"; 4, "b"; 5, "b"; 0, "a"; 1, "a"; 2, "a" ]
    Assert.Equal(aFirst, bFirst)

/// Breadth over arbitrary values, not just the three-symbol alphabet. A list must decide the same
/// as its sorted, reverse-sorted, and reversed rearrangements — all of them the same evidence set.
/// n=3 with three distinct values is a tie at threshold 1, so random inputs reach the defect.
[<Property>]
let ``decide agrees on a list and on its sorted, descending, and reversed rearrangements``
    (values: string list)
    =
    let vs = values |> List.filter (isNull >> not)
    List.isEmpty vs
    || (let d = decisionOf vs
        d = decisionOf (List.sort vs)
        && d = decisionOf (List.sortDescending vs)
        && d = decisionOf (List.rev vs))

/// The tie-break RULE, stated positively so a future change is visible rather than incidental:
/// among the values tied at the top count, `decide` commits the ordinal minimum.
/// (`.claude/rules/culture-invariant-by-default.md` — ordinal, never culture-sensitive.)
[<Fact>]
let ``tie-break commits the ordinal-minimum tied value`` () =
    Assert.Equal(Some "p", committedValue (decide (ballot [ "r"; "q"; "p" ])))
    Assert.Equal(Some "p", committedValue (decide (ballot [ "p"; "q"; "r" ])))
    Assert.Equal(Some "a", committedValue (decide (ballot [ "b"; "b"; "b"; "a"; "a"; "a" ])))
    // Ordinal, not culture-sensitive: uppercase sorts BEFORE lowercase by codepoint, which is the
    // opposite of most linguistic collations. This is the byte-lockable answer.
    Assert.Equal(Some "Z", committedValue (decide (ballot [ "a"; "Z" ])))

/// Pins the blast radius: a tie can ALSO reach quorum only when floor(n/2) >= quorumThreshold n.
/// Closed form — write n-1 = 3q+r with r ∈ {0,1,2}; the condition is r >= q+1, so q <= 1, giving
/// n ∈ {2, 3} (q=0) and n = 6 (q=1). Scanned to 64 here; the algebra covers every n.
[<Fact>]
let ``a tie can also reach quorum only at n in 2, 3, 6`` () =
    let reachable = [ 0..64 ] |> List.filter (fun n -> n >= 2 && (n / 2) >= quorumThreshold n)
    Assert.Equal<int list>([ 2; 3; 6 ], reachable)
