module Zeta.Tests.RelationalIdentityTests

open System
open Xunit
open Zeta.Research

module R = RelationalIdentity
module E = RelationalIdentityExperiment
let private require = function Ok value -> value | Error error -> failwithf "%A" error
let private sample observer = E.view observer E.receipts
let private compare left right = R.compareViews (E.verify E.table) E.expected left right

[<Fact>]
let ``the registered transport panel preserves signed actor indexed content`` () =
    let panel = E.transportPanel ()
    Assert.Equal(288, panel.Checks)
    Assert.Equal(24, panel.ArrivalOrders)
    Assert.Equal(2, panel.TopologicalOrders.Length)
    Assert.Equal(288, panel.InverseChecks)
    Assert.Equal(288, panel.CompositionChecks)
    Assert.Equal<string[][]>([|[|"A";"B";"receipt";"ack";"1"|];[|"B";"A";"vision";"color";"1"|]|], panel.Invariant.Claims)
    Assert.Equal(4, panel.Invariant.Receipts.Length)
    Assert.Equal(5, panel.Invariant.CausalPairs.Length)

[<Fact>]
let ``registered mutations distinguish missing coverage authentication and contradiction`` () =
    let cases = E.mutationPanel () |> Array.map (fun row -> row.Name, row) |> Map.ofArray
    for name in ["baseline";"identical-replay";"different-observation-channel";"coherent-fabricated-counterparties";"coherent-fabricated-complete-graph";"empty-cut"] do
        Assert.Equal("consistent-on-declared-cut", cases.[name].Status)
    for name in ["missing-parent";"omitted-expected-event";"unavailable-verifier";"unverified-alternative-with-covered-id";"open-causal-boundary"] do
        Assert.Equal("unknown-coverage", cases.[name].Status)
        Assert.Empty(cases.[name].Invariant)
    for name in ["changed-payload-old-attestation";"substituted-key"] do Assert.Equal("authentication-rejected", cases.[name].Status)
    for name in ["authenticated-fork";"conflict-with-missing-coverage"] do Assert.Equal("authenticated-conflict", cases.[name].Status)
    Assert.Equal("authenticated-causal-cycle", cases.["authenticated-causal-cycle"].Status)
    Assert.Equal<string[]>([|"e3"|], cases.["conflict-with-missing-coverage"].MissingRight)
    Assert.Equal(1, cases.["identical-replay"].RepeatedRight)
    Assert.Equal<string[]>([|"e0";"e1";"e2";"e3"|], cases.["missing-parent"].Expected)
    Assert.Equal<string[]>([|"e0";"e1";"e2";"e3"|], cases.["causal-coordinate-reversal"].Expected)
    for name in ["causal-coordinate-reversal";"coordinate-collision"] do Assert.Equal("refused-coordinates", cases.[name].Status)

[<Fact>]
let ``fork diagnostics union all variants independently of occurrence order`` () =
    let first = { E.receipts.Head with Parents = ["outside-a"] }
    let second = { E.receipts.Head with Parents = ["outside-b"] }
    let table = [(first,"first");(second,"second")]
    let one : R.Occurrence = { Position=0L;Clock=0L;Receipt=first;Attestation="first" }
    let two : R.Occurrence = { Position=1L;Clock=1L;Receipt=second;Attestation="second" }
    let left : R.View = {Observer="A";Occurrences=[one;two]}
    let reversed = {left with Occurrences=[two;one]}
    let a = R.compareViews (E.verify table) ["e0"] left left |> require
    let b = R.compareViews (E.verify table) ["e0"] reversed reversed |> require
    Assert.Equal<R.Readout>(a,b)
    Assert.Equal<string list>(["outside-a";"outside-b"],a.BoundaryParents)
    Assert.Equal("authenticated-conflict",a.Status)
    Assert.Equal(0,a.RepeatedLeft)
    let repeated = {left with Occurrences=left.Occurrences @ [{one with Position=2L}]}
    let c = R.compareViews (E.verify table) ["e0"] repeated repeated |> require
    Assert.Equal(1,c.RepeatedLeft)
    Assert.Equal<string list>(["e0"],c.Conflicts)

[<Fact>]
let ``replay before a disclosed parent is refused`` () =
    let left = sample "A"
    let right = sample "B" |> R.rechart (fun p -> 10L*(p+1L)) id
    let replay = {right.Occurrences.[1] with Position=5L}
    let invalid = {right with Occurrences=replay::right.Occurrences}
    Assert.True((compare left invalid).IsError)

[<Fact>]
let ``parent set normalization precedes the actor bound authentication check`` () =
    let left = sample "A"
    let right = sample "B"
    let reordered =
        { right with
            Occurrences = right.Occurrences |> List.map (fun item ->
                if item.Receipt.EventId="e3" then {item with Receipt={item.Receipt with Parents=["e2";"e1";"e2"]}} else item) }
    Assert.Equal<R.Invariant option>((compare left right |> require).Invariant,(compare left reordered |> require).Invariant)

[<Fact>]
let ``entropy premise fails for pairwise independent shared innovations`` () =
    let rows = E.entropyPanel () |> Array.map (fun row -> row.Name,row) |> Map.ofArray
    Assert.True(rows.["independent"].OneBitConditionalPremise)
    Assert.Equal(3,rows.["independent"].JointMinEntropyBits)
    Assert.True(rows.["pairwise-independent-xor"].PairwiseIndependent)
    Assert.False(rows.["pairwise-independent-xor"].OneBitConditionalPremise)
    Assert.Equal(2,rows.["pairwise-independent-xor"].JointMinEntropyBits)
    for name in ["copies";"inversion"] do Assert.Equal(1,rows.[name].JointMinEntropyBits)

[<Fact>]
let ``dense and sparse workload formulas retain unknown obligations and units`` () =
    let rows = E.scalingPanel () |> Array.map (fun row -> row.Name,row) |> Map.ofArray
    Assert.Equal(45,rows.Count)
    Assert.Equal("2048",rows.["complete-64"].Baseline)
    Assert.Equal("16128",rows.["complete-64"].Relational)
    Assert.Equal("18176",rows.["complete-64"].Total)
    Assert.Equal<string[]>([|"71";"8"|],rows.["complete-64"].Multiplier)
    Assert.Equal(1,rows.["complete-64"].Missing)
    Assert.Equal("2552",rows.["path-64"].Total)
    Assert.Empty(rows.["empty-0"].Multiplier)
    Assert.True((R.workload [("a",1I)] [("a","a")] [] 1I).IsError)
    Assert.True((R.workload [("a",1I)] [("a","b")] [] 1I).IsError)
    Assert.True((R.workload [("a",1I);("a",1I)] [] [] 1I).IsError)
    Assert.True((R.workload [("a",0I)] [] [] 1I).IsError)
    Assert.True((R.workload [("a",1I);("b",1I)] [] [("a","b")] 1I).IsError)
    Assert.True((R.workload [] [] [] -1I).IsError)

[<Fact>]
let ``statistical and authenticated histories retain the shared controller witness`` () =
    let rows = E.baselinePanel () |> Array.map (fun row -> row.Name,row) |> Map.ofArray
    Assert.True(rows.["exact-replay"].ReplayFlag)
    Assert.True(rows.["inverted-replay"].ReplayFlag)
    Assert.True(rows.["independent-finite-collision"].ReplayFalsePositive)
    Assert.True(rows.["shared-seed-orthogonal-code"].ReplayFalseNegative)
    Assert.Equal<float[]>([|4.0|],rows.["conducted-chsh"].Spectrum)
    let distinct = rows.["distinct-controller-transcript"]
    let shared = rows.["one-controller-same-transcript"]
    Assert.Equal<float[]>(distinct.Spectrum,shared.Spectrum)
    Assert.Equal(distinct.SignatureOnly,shared.SignatureOnly)
    Assert.Equal(distinct.ReceiptStatus,shared.ReceiptStatus)
    Assert.Equal(distinct.Correlation,shared.Correlation)
    Assert.NotEqual(distinct.SharedController,shared.SharedController)

[<Fact>]
let ``malformed and over budget inputs return values`` () =
    let left = sample "A"
    let nullCut = Unchecked.defaultof<string list>
    Assert.True((R.compareViews (E.verify E.table) nullCut left left).IsError)
    Assert.True((R.compareViews (E.verify E.table) (List.replicate 129 "e0") left left).IsError)
    Assert.True((R.compareViews (E.verify E.table) E.expected Unchecked.defaultof<R.View> left).IsError)
    Assert.True((compare left {left with Occurrences=List.replicate 257 left.Occurrences.Head}).IsError)
    Assert.True((compare left {left with Occurrences=[Unchecked.defaultof<R.Occurrence>]}).IsError)
    Assert.True((compare left {left with Observer=String.replicate 129 "x"}).IsError)
    let invalid = {left.Occurrences.Head with Receipt={left.Occurrences.Head.Receipt with Parents=Unchecked.defaultof<string list>}}
    Assert.True((compare left {left with Occurrences=[invalid]}).IsError)

[<Fact>]
let ``signed consolidation does not overflow int64 and keeps historical receipts`` () =
    let items = [0..127] |> List.map (fun index -> {E.receipts.Head with EventId=sprintf "x%d" index;Weight=Int64.MaxValue})
    let table = items |> List.map (fun receipt -> receipt,"fixture-"+receipt.EventId)
    let left,right = E.view "A" items,E.view "B" items
    let result = R.compareViews (E.verify table) (items |> List.map _.EventId) left right |> require
    let invariant = result.Invariant |> Option.defaultWith (fun () -> failwith "missing invariant")
    Assert.Equal(128,invariant.Receipts.Length)
    Assert.Equal(128I*bigint Int64.MaxValue,invariant.Claims.Head.Weight)

[<Fact>]
let ``unverified alternatives cannot disappear behind a covered event ID`` () =
    let left,right = sample "A",sample "B"
    for receipt in [E.receipts.[2];{E.receipts.[2] with Claim="alternative"}] do
        let unknown = {right.Occurrences.[2] with Position=10L;Receipt=receipt;Attestation="unavailable"}
        let result = compare left {right with Occurrences=right.Occurrences @ [unknown]} |> require
        Assert.Equal("unknown-coverage",result.Status)
        Assert.Equal<string list>(["e2"],result.UnverifiedRight)
        Assert.True(result.Invariant.IsNone)
