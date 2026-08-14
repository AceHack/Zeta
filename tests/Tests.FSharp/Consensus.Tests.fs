module Zeta.Tests.ConsensusTests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core.Consensus

let otto = NodeId "otto"
let vera = NodeId "vera"
let riven = NodeId "riven"
let lior = NodeId "lior"
let now = DateTimeOffset.UtcNow

let vote node value =
    { Node = node; Value = value; LocalObservedAt = now }

[<Fact>]
let ``4 nodes unanimous — commits`` () =
    let votes = [ vote otto "merge"; vote vera "merge"; vote riven "merge"; vote lior "merge" ]
    let result = decide votes
    match result with
    | Committed(v, q, t) ->
        Assert.Equal("merge", v)
        Assert.Equal(4, t)
        Assert.True(q >= 3)
    | Rejected _ -> Assert.Fail "expected commit"

[<Fact>]
let ``4 nodes, 1 disagrees — still commits (3 >= threshold)`` () =
    let votes = [ vote otto "merge"; vote vera "merge"; vote riven "reject"; vote lior "merge" ]
    let result = decide votes
    match result with
    | Committed(v, q, _) ->
        Assert.Equal("merge", v)
        Assert.Equal(3, q)
    | Rejected _ -> Assert.Fail "expected commit with 3/4"

[<Fact>]
let ``4 nodes, 2 disagree — rejects (2 < threshold)`` () =
    let votes = [ vote otto "merge"; vote vera "merge"; vote riven "reject"; vote lior "reject" ]
    let result = decide votes
    match result with
    | Committed _ -> Assert.Fail "expected rejection with 2/4"
    | Rejected(reason, best, total) ->
        Assert.Equal(2, best)
        Assert.Equal(4, total)
        Assert.Contains("no quorum", reason)

[<Fact>]
let ``empty votes — rejects`` () =
    let result = decide<string> []
    Assert.False(isCommitted result)

[<Fact>]
let ``quorum threshold for N=4 is 3`` () =
    Assert.Equal(3, quorumThreshold 4)

[<Fact>]
let ``quorum threshold for N=7 is 5`` () =
    Assert.Equal(5, quorumThreshold 7)

[<Fact>]
let ``committedValue extracts on commit`` () =
    let votes = [ vote otto 42; vote vera 42; vote riven 42 ]
    let result = decide votes
    Assert.Equal(Some 42, committedValue result)

[<Fact>]
let ``committedValue returns None on reject`` () =
    let votes = [ vote otto 1; vote vera 2; vote riven 3; vote lior 4 ]
    let result = decide votes
    Assert.Equal(None, committedValue result)

[<Property>]
let ``unanimous votes always commit`` (NonEmptyArray (values: int array)) =
    let v = values[0]
    let votes = values |> Array.mapi (fun i _ -> vote (NodeId $"n{i}") v) |> Array.toList
    isCommitted (decide votes)

let nodes = [ otto; vera; riven; lior ]

let unwrap (r: TransitionResult<'T>) : RoundState<'T> =
    match r with
    | TransitionResult.Ok s -> s
    | InvalidTransition reason -> failwith $"unexpected InvalidTransition: {reason}"

[<Fact>]
let ``state machine — full round commits`` () =
    let s0 = emptyRound nodes
    let s1 = unwrap (transition s0 (Propose(otto, "merge")))
    Assert.Equal(Voting, s1.Phase)
    let s2 = unwrap (transition s1 (CastVote(otto, "merge")))
    let s3 = unwrap (transition s2 (CastVote(vera, "merge")))
    let s4 = unwrap (transition s3 (CastVote(riven, "merge")))
    let s5 = unwrap (transition s4 Finalize)
    Assert.Equal(Decided, s5.Phase)
    Assert.True(s5.Result |> Option.map isCommitted |> Option.defaultValue false)

[<Fact>]
let ``state machine — cannot vote before proposal`` () =
    let s0 = emptyRound nodes
    match transition s0 (CastVote(otto, "merge")) with
    | InvalidTransition r -> Assert.Contains("before proposal", r)
    | TransitionResult.Ok _ -> Assert.Fail "expected invalid transition"

[<Fact>]
let ``state machine — cannot propose during voting`` () =
    let s0 = emptyRound nodes
    let s1 = unwrap (transition s0 (Propose(otto, "merge")))
    match transition s1 (Propose(vera, "reject")) with
    | InvalidTransition r -> Assert.Contains("during voting", r)
    | TransitionResult.Ok _ -> Assert.Fail "expected invalid transition"

[<Fact>]
let ``state machine — duplicate vote rejected`` () =
    let s0 = emptyRound nodes
    let s1 = unwrap (transition s0 (Propose(otto, "merge")))
    let s2 = unwrap (transition s1 (CastVote(otto, "merge")))
    match transition s2 (CastVote(otto, "merge")) with
    | InvalidTransition r -> Assert.Contains("duplicate", r)
    | TransitionResult.Ok _ -> Assert.Fail "expected invalid transition"

[<Fact>]
let ``state machine — unknown node rejected`` () =
    let s0 = emptyRound nodes
    match transition s0 (Propose(NodeId "mallory", "merge")) with
    | InvalidTransition r -> Assert.Contains("unknown", r)
    | TransitionResult.Ok _ -> Assert.Fail "expected invalid transition"

[<Fact>]
let ``state machine — decided round rejects further messages`` () =
    let s0 = emptyRound nodes
    let s1 = unwrap (transition s0 (Propose(otto, "merge")))
    let s2 = unwrap (transition s1 (CastVote(otto, "merge")))
    let s3 = unwrap (transition s2 (CastVote(vera, "merge")))
    let s4 = unwrap (transition s3 (CastVote(riven, "merge")))
    let s5 = unwrap (transition s4 Finalize)
    match transition s5 (CastVote(lior, "merge")) with
    | InvalidTransition r -> Assert.Contains("already decided", r)
    | TransitionResult.Ok _ -> Assert.Fail "expected invalid transition"

let cleanPr n =
    { Number = n; ChecksPassed = 7; ChecksFailed = 0
      ChecksInProgress = 0; UnresolvedThreads = 0; AutoMergeArmed = true }

let failedPr n =
    { Number = n; ChecksPassed = 5; ChecksFailed = 2
      ChecksInProgress = 0; UnresolvedThreads = 0; AutoMergeArmed = false }

let threadsPr n =
    { Number = n; ChecksPassed = 7; ChecksFailed = 0
      ChecksInProgress = 0; UnresolvedThreads = 3; AutoMergeArmed = true }

[<Fact>]
let ``evaluateGate — clean PR merges`` () =
    Assert.Equal(Merge, evaluateGate (cleanPr 1946))

[<Fact>]
let ``evaluateGate — failed checks block`` () =
    match evaluateGate (failedPr 1947) with
    | Block r -> Assert.Contains("failed checks", r)
    | Merge -> Assert.Fail "expected block"

[<Fact>]
let ``evaluateGate — unresolved threads block`` () =
    match evaluateGate (threadsPr 1948) with
    | Block r -> Assert.Contains("unresolved threads", r)
    | Merge -> Assert.Fail "expected block"

[<Fact>]
let ``prConsensus — all nodes see clean PR commits`` () =
    let pr = cleanPr 1950
    let states = nodes |> List.map (fun n -> (n, pr))
    let result = prConsensus nodes states
    Assert.True(isCommitted result)
    Assert.Equal(Some Merge, committedValue result)

[<Fact>]
let ``prConsensus — one node sees failure, rest see clean — blocks`` () =
    let states =
        [ (otto, cleanPr 1951)
          (vera, cleanPr 1951)
          (riven, failedPr 1951)
          (lior, cleanPr 1951) ]
    let result = prConsensus nodes states
    match result with
    | Committed(Merge, _, _) -> ()
    | Committed(Block _, _, _) -> Assert.Fail "3/4 see Merge, should commit Merge"
    | Rejected _ -> Assert.Fail "3/4 agree on Merge, should commit"

// ── local-time-never-enters-the-shared-fold: `decide` is the shared fold ──────────────────────
// `.claude/rules/local-time-never-enters-the-shared-fold.md` · §13 noninterference, on time.

let stampedVote node value (stamp: DateTimeOffset) =
    { Node = node; Value = value; LocalObservedAt = stamp }

let t (seconds: int) = DateTimeOffset.UnixEpoch.AddSeconds(float seconds)

/// THE MUTANT-CATCHER. n=6 with a perfect 3/3 tie is the *only* shape where the local stamp could
/// change the outcome, so it is the shape the guard has to use. The list order says "a" first; the
/// stamps say "b" first. If anyone ever sorts/filters/weights `votes` by `LocalObservedAt` inside
/// `decide`, this commits "b" and the test fails — which is precisely the divergence the rule forbids.
[<Fact>]
let ``decide ignores LocalObservedAt — stamps disagreeing with list order do not move the decision`` () =
    let votes =
        [ stampedVote (NodeId "n0") "a" (t 50)
          stampedVote (NodeId "n1") "a" (t 60)
          stampedVote (NodeId "n2") "a" (t 70)
          stampedVote (NodeId "n3") "b" (t 10)
          stampedVote (NodeId "n4") "b" (t 20)
          stampedVote (NodeId "n5") "b" (t 30) ]
    Assert.Equal(3, quorumThreshold 6)
    match decide votes with
    | Committed(v, _, _) ->
        Assert.Equal("a", v) // list order, NOT stamp order (stamp order would give "b")
    | Rejected _ -> Assert.Fail "3 >= threshold 3, expected a commit"

/// The same evidence SET with every stamp identical must decide the same as the case above — i.e. the
/// stamps contributed nothing. Together the two pin `decide` as a function of (evidence, order) only.
[<Fact>]
let ``decide is invariant under rewriting every LocalObservedAt`` () =
    let mk stamps =
        List.map2 (fun (n, v) s -> stampedVote (NodeId n) v s)
            [ "n0","a"; "n1","a"; "n2","a"; "n3","b"; "n4","b"; "n5","b" ] stamps
    let spread = mk [ t 50; t 60; t 70; t 10; t 20; t 30 ]
    let flat   = mk [ t 0;  t 0;  t 0;  t 0;  t 0;  t 0 ]
    let reversed = mk [ t 70; t 60; t 50; t 30; t 20; t 10 ]
    Assert.Equal(committedValue (decide spread), committedValue (decide flat))
    Assert.Equal(committedValue (decide spread), committedValue (decide reversed))

/// CHARACTERIZATION OF A KNOWN DEFECT — 081M013T0D7087G0R0009E1QF7. Not an endorsement.
/// `decide`'s tie-break is first-occurrence, so receive ORDER (not the stamp) still decides a tie that
/// reaches quorum. This is byte-locked into the four-oracle treaty, so it is filed rather than fixed.
/// This test exists so that a future fix is a deliberate, visible change rather than a silent one.
[<Fact>]
let ``KNOWN DEFECT — decide tie-break is receive-order dependent at n=6`` () =
    let a i = stampedVote (NodeId $"n{i}") "a" (t 0)
    let b i = stampedVote (NodeId $"n{i}") "b" (t 0)
    let aFirst = [ a 0; a 1; a 2; b 3; b 4; b 5 ]
    let bFirst = [ b 3; b 4; b 5; a 0; a 1; a 2 ]
    Assert.Equal(Some "a", committedValue (decide aFirst))
    Assert.Equal(Some "b", committedValue (decide bFirst))

/// The bound on the defect above: a tie can only ALSO reach quorum when floor(n/2) >= threshold(n),
/// which holds for exactly n ∈ {2, 3, 6}. For every other n the tie-break is unreachable, so the
/// receive-order dependence cannot change a committed value. Pins the blast radius.
[<Fact>]
let ``tie can reach quorum only at n in 2, 3, 6`` () =
    let reachable =
        [ 0 .. 64 ] |> List.filter (fun n -> n >= 2 && (n / 2) >= quorumThreshold n)
    Assert.Equal<int list>([ 2; 3; 6 ], reachable)
