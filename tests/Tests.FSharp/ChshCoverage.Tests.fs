module Zeta.Tests.ChshCoverageTests

open System
open System.Text.Json
open Xunit
open Zeta.Core

module A = AntiSybil
module M = DecorrelationMeter

let private repeat n values = [for _ in 1..n do yield! values]
let private streams settings response =
    settings |> List.mapi (fun index (x,y) ->
        let a,b = response index x y
        ({Setting=x;Outcome=a}:A.ChshRound),({Setting=y;Outcome=b}:A.ChshRound)) |> List.unzip
let private constant _ _ _ = 1,1
let private fullSettings = repeat 100 [0,0;0,1;1,0;1,1]
let private missing () = streams (repeat 100 [0,0;1,0;1,1]) constant
let private oldMargin delta a b =
    let series = A.outcomeProductSeries a b
    let nEff = A.effectiveSampleSizeHAC series (A.neweyWestBandwidth series.Length)
    if nEff < 1.0 then infinity else sqrt (32.0 * log (1.0/delta) / nEff)

[<Fact>]
let ``each missing setting refuses both calibrated paths and the direct meter`` () =
    for absent in 0..3 do
        let a,b = streams (fullSettings |> List.filter (fun (x,y) -> 2*x+y <> absent)) constant
        Assert.Equal(infinity, A.chshMarginAutocorr 0.01 a b)
        Assert.Equal(2,(A.chshSybilCalibrated 0.01 [a;b]).DistinctCount)
        Assert.Equal(2,(A.chshSybilAutocorrCalibrated 0.01 0.0 [a;b]).DistinctCount)
        Assert.Equal(M.Unmeasured,M.classifyPair 0.01 a b)
    let a,b = missing ()
    Assert.Equal(3.0,A.chshS a b) // descriptive statistic deliberately unchanged
    Assert.True(3.0 > 2.0 + oldMargin 0.01 a b) // the preserved pre-fix failure

[<Fact>]
let ``one rare setting cannot borrow the other buckets sample size`` () =
    let settings = (0,1)::repeat 1000 [0,0;1,0;1,1]
    let a,b = streams settings (fun index x _ -> (if x=0 && index%2=0 then -1 else 1),1)
    Assert.Equal(3.0,A.chshS a b)
    Assert.True(A.isApproxStationaryMultiBlock 0.01 4 (A.outcomeProductSeries a b))
    Assert.True(3.0 > 2.0 + oldMargin 0.01 a b)
    Assert.Equal(A.chshMargin 0.01 4,A.chshMarginAutocorr 0.01 a b,12)
    Assert.Equal(2,(A.chshSybilCalibrated 0.01 [a;b]).DistinctCount)
    Assert.Equal(2,(A.chshSybilAutocorrCalibrated 0.01 0.01 [a;b]).DistinctCount)
    Assert.Equal(M.WithinClassicalBound,M.classifyPair 0.01 a b)

[<Fact>]
let ``balanced controls preserve the earlier HAC margin and measured behavior`` () =
    for conducted in [false;true] do
        let a,b = streams fullSettings (fun _ x y -> 1,(if conducted && x=0 && y=1 then -1 else 1))
        Assert.Equal(oldMargin 0.01 a b,A.chshMarginAutocorr 0.01 a b,12)
        let components = if conducted then 1 else 2
        Assert.Equal(components,(A.chshSybilCalibrated 0.01 [a;b]).DistinctCount)
        Assert.Equal(components,(A.chshSybilAutocorrCalibrated 0.01 0.0 [a;b]).DistinctCount)
        Assert.Equal((if conducted then M.AboveClassicalBound else M.WithinClassicalBound),M.classifyPair 0.01 a b)

[<Fact>]
let ``coverage cap never lowers the prior HAC margin across varied finite streams`` () =
    for seed in 0..255 do
        let rng = Random(seed)
        let a,b =
            [for _ in 0..seed%96 ->
                ({Setting=rng.Next(2);Outcome=2*rng.Next(2)-1}:A.ChshRound),
                ({Setting=rng.Next(2);Outcome=2*rng.Next(2)-1}:A.ChshRound)] |> List.unzip
        for delta in [0.001;0.01;0.2;0.9] do
            Assert.True(A.chshMarginAutocorr delta a b >= oldMargin delta a b)

[<Fact>]
let ``malformed paired settings and outcomes remain unmeasured without evaluating the raw score`` () =
    let a,b = streams fullSettings constant
    let invalid =
        [ {a.Head with Setting = -1};{a.Head with Setting=2}
          {a.Head with Outcome=0};{a.Head with Outcome=2};Unchecked.defaultof<A.ChshRound> ]
    for round in invalid do
        let broken = round::a.Tail
        for left,right in [broken,b;b,broken] do
            Assert.Equal(infinity,A.chshMarginAutocorr 0.01 left right)
            Assert.Equal(2,(A.chshSybilCalibrated 0.01 [left;right]).DistinctCount)
            Assert.Equal(2,(A.chshSybilAutocorrCalibrated 0.01 0.0 [left;right]).DistinctCount)
            Assert.Equal(M.Unmeasured,M.classifyPair 0.01 left right)

[<Fact>]
let ``unmatched suffixes do not change the paired measurement contract`` () =
    let a,b = streams fullSettings constant
    let extended = a @ [{Setting=9;Outcome=0}]
    Assert.Equal(A.chshMarginAutocorr 0.01 a b,A.chshMarginAutocorr 0.01 extended b)
    Assert.Equal(A.chshMarginAutocorr 0.01 b a,A.chshMarginAutocorr 0.01 b extended)
    Assert.Equal(M.WithinClassicalBound,M.classifyPair 0.01 extended b)

let private dag = Map.ofList ["R",[];"X",["R"];"Y",["R"];"Z",["R"]]

[<Fact>]
let ``unmeasured public readings serialize absent bounds and fractions without nonfinite numbers`` () =
    let a,b = missing ()
    let components = A.chshSybilCalibrated 0.01 [a;b]
    use componentJson = JsonDocument.Parse(JsonSerializer.Serialize components)
    Assert.Equal(2,componentJson.RootElement.GetProperty("DistinctCount").GetInt32())
    for delta in [0.01;Double.NaN;infinity;0.0;1.0] do
        let reading = M.fuse delta dag (Map.ofList ["X",a;"Y",b]) ["X";"Y"]
        Assert.Equal(1,reading.SpacelikePairs)
        Assert.Equal(1,reading.UnmeasuredPairs)
        Assert.Equal(0,reading.WithinBound)
        Assert.Equal(0,reading.AboveBound)
        Assert.Equal<float option>(None,reading.Bound)
        Assert.Equal<float option>(None,reading.WithinBoundFraction)
        use json = JsonDocument.Parse(JsonSerializer.Serialize reading)
        Assert.Equal(JsonValueKind.Null,json.RootElement.GetProperty("Bound").ValueKind)
        Assert.Equal(JsonValueKind.Null,json.RootElement.GetProperty("WithinBoundFraction").ValueKind)

[<Fact>]
let ``mixed readings bound only eligible pairs and retain refused pairs separately`` () =
    let a,b = streams fullSettings constant
    let c = List.replicate a.Length ({Setting=0;Outcome=1}:A.ChshRound)
    let reading = M.fuse 0.01 dag (Map.ofList ["X",a;"Y",b;"Z",c]) ["X";"Y";"Z"]
    Assert.Equal(3,reading.SpacelikePairs)
    Assert.Equal(2,reading.UnmeasuredPairs)
    Assert.Equal(1,reading.WithinBound)
    Assert.Equal(0,reading.AboveBound)
    Assert.Equal<float option>(Some(2.0+A.chshMarginAutocorr 0.01 a b),reading.Bound)
    Assert.Equal<float option>(Some 1.0,reading.WithinBoundFraction)
    use json = JsonDocument.Parse(JsonSerializer.Serialize reading)
    Assert.True(Double.IsFinite(json.RootElement.GetProperty("Bound").GetDouble()))
    Assert.Equal(2,json.RootElement.GetProperty("UnmeasuredPairs").GetInt32())

[<Fact>]
let ``empty fusion serializes explicit absence`` () =
    let reading = M.fuse 0.01 dag Map.empty ["X";"Y"]
    use json = JsonDocument.Parse(JsonSerializer.Serialize reading)
    Assert.Equal(JsonValueKind.Null,json.RootElement.GetProperty("Bound").ValueKind)
    Assert.Equal(JsonValueKind.Null,json.RootElement.GetProperty("WithinBoundFraction").ValueKind)
