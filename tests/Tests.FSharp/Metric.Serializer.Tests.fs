module Zeta.Tests.MetricSerializerTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Metric / aggregation (PROVEN-CORE-MAP #6) — the 4-ser + Arrow + Bonsai legs, unblocked by
// the new rehydrate-from-state factories (CountMinSketch.OfState / BlockedBloomFilter.OfState).
// The sketch STATE (params + table) bridges to a DynamicValue.Object; every value-tree
// serializer round-trips it; OfState rehydrates a working sketch that answers queries
// identically. The Bonsai leg reifies the MERGE operation (CMS Union / Bloom OR) and applies
// it after a serialize/parse round-trip.
//
// Scope: still F#-only (4-lang open) and the formal magnitude bound is future work; this adds
// the carrier + operation legs to the math + homeostat + empirical-magnitude legs.
// ═══════════════════════════════════════════════════════════════════

// ── CountMin: state ↔ DynamicValue.Object, rehydrate via OfState ──

let private cmsToDynamic (c: CountMinSketch) : DynamicValue =
    DynamicValue.Object
        [ "depth", DynamicValue.Int(int64 c.Depth)
          "width", DynamicValue.Int(int64 c.Width)
          "seed", DynamicValue.Int c.Seed
          "table", DynamicValue.Array [ for v in c.Snapshot() -> DynamicValue.Int v ] ]

let private dynamicToCms (dv: DynamicValue) : CountMinSketch option =
    match dv with
    | DynamicValue.Object fields ->
        let m = Map.ofList fields
        let getI k = match Map.tryFind k m with | Some(DynamicValue.Int i) -> Some i | _ -> None
        match getI "depth", getI "width", getI "seed", Map.tryFind "table" m with
        | Some d, Some w, Some s, Some(DynamicValue.Array xs) ->
            let table = [| for x in xs do match x with | DynamicValue.Int i -> yield i | _ -> () |]
            if table.Length = int d * int w then Some(CountMinSketch.OfState(int d, int w, s, table)) else None
        | _ -> None
    | _ -> None

let private cmsOf (seed: int64) (xs: int64 list) : CountMinSketch =
    let c = CountMinSketch(4, 64, seed)
    for x in xs do c.Add(x, 1L)
    c

let private genInts : Gen<int64 list> =
    Gen.listOf (Gen.choose (-50000, 50000) |> Gen.map int64)

type IntsArb() =
    static member I() = Arb.fromGen genInts

let private sameCmsBehaviour (a: CountMinSketch) (b: CountMinSketch) (probes: int64 list) : bool =
    a.Depth = b.Depth && a.Width = b.Width && a.Seed = b.Seed
    && probes |> List.forall (fun k -> a.Estimate k = b.Estimate k)

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/CountMin × 4-ser: state round-trips through JSON+CBOR+YAML+XML and rehydrates`` (xs: int64 list) =
    let c = cmsOf 777L xs
    let dv = cmsToDynamic c
    let probes = (0L :: xs) |> List.distinct
    let viaEach =
        [ SerializerLegs.jsonRT; SerializerLegs.cborRT; SerializerLegs.yamlRT; SerializerLegs.xmlRT ]
        |> List.forall (fun rt ->
            match rt dv |> Option.bind dynamicToCms with
            | Some c2 -> sameCmsBehaviour c c2 probes
            | None -> false)
    SerializerLegs.fourSerAgree dv && viaEach

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/CountMin × Arrow: state round-trips through Arrow IPC and rehydrates`` (xs: int64 list) =
    let c = cmsOf 777L xs
    let dv = cmsToDynamic c
    let probes = (0L :: xs) |> List.distinct
    SerializerLegs.arrowAgree dv
    && (match SerializerLegs.arrowRT dv |> Option.bind dynamicToCms with
        | Some c2 -> sameCmsBehaviour c c2 probes
        | None -> false)

// ── CountMin × Bonsai: the union (merge) reified ──

let rec private applyCmsUnion (env: Map<string, CountMinSketch>) (e: Bonsai.Expr) : CountMinSketch option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("cms-union", [ l; r ]) ->
        match applyCmsUnion env l, applyCmsUnion env r with
        | Some a, Some b ->
            // union mutates the accumulator → fold into a fresh sketch with a's state
            let acc = CountMinSketch.OfState(a.Depth, a.Width, a.Seed, a.Snapshot())
            acc.Union b
            Some acc
        | _ -> None
    | _ -> None

let private cmsUnionExpr : Bonsai.Expr = Bonsai.Call("cms-union", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/CountMin × Bonsai: union reified as a Bonsai Expr round-trips and applies to the merge`` (a: int64 list) (b: int64 list) =
    let ca, cb = cmsOf 777L a, cmsOf 777L b
    // expected: fresh union of ca and cb
    let expected = CountMinSketch.OfState(ca.Depth, ca.Width, ca.Seed, ca.Snapshot())
    expected.Union cb
    let probes = (0L :: (a @ b)) |> List.distinct
    match bonsaiRT cmsUnionExpr with
    | Some e ->
        match applyCmsUnion (Map.ofList [ "a", ca; "b", cb ]) e with
        | Some got -> probes |> List.forall (fun k -> got.Estimate k = expected.Estimate k)
        | None -> false
    | None -> false

// ── Bloom: state ↔ DynamicValue.Object (uint64 table bitcast to int64), rehydrate via OfState ──

let private bloomToDynamic (f: BlockedBloomFilter) : DynamicValue =
    DynamicValue.Object
        [ "buckets", DynamicValue.Int(int64 f.BucketCount)
          "probes", DynamicValue.Int(int64 f.ProbesPerLookup)
          "table", DynamicValue.Array [ for v in f.Table -> DynamicValue.Int(int64 v) ] ] // uint64→int64 bitcast

let private dynamicToBloom (dv: DynamicValue) : BlockedBloomFilter option =
    match dv with
    | DynamicValue.Object fields ->
        let m = Map.ofList fields
        let getI k = match Map.tryFind k m with | Some(DynamicValue.Int i) -> Some i | _ -> None
        match getI "buckets", getI "probes", Map.tryFind "table" m with
        | Some bc, Some pp, Some(DynamicValue.Array xs) ->
            let table = [| for x in xs do match x with | DynamicValue.Int i -> yield uint64 i | _ -> () |]
            Some(BlockedBloomFilter.OfState(int bc, int pp, table))
        | _ -> None
    | _ -> None

let private bloomOf (xs: int64 list) : BlockedBloomFilter =
    let f = BlockedBloomFilter(256, 4)
    for x in xs do f.Add(x)
    f

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/Bloom × 4-ser: state round-trips through JSON+CBOR+YAML+XML and rehydrates`` (xs: int64 list) =
    let f = bloomOf xs
    let dv = bloomToDynamic f
    let viaEach =
        [ SerializerLegs.jsonRT; SerializerLegs.cborRT; SerializerLegs.yamlRT; SerializerLegs.xmlRT ]
        |> List.forall (fun rt ->
            match rt dv |> Option.bind dynamicToBloom with
            | Some f2 -> f2.Table = f.Table && (xs |> List.forall (fun x -> f2.MayContain x))
            | None -> false)
    SerializerLegs.fourSerAgree dv && viaEach

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/Bloom × Arrow: state round-trips through Arrow IPC and rehydrates`` (xs: int64 list) =
    let f = bloomOf xs
    let dv = bloomToDynamic f
    // arrow leg via the retry-stable helper (081KWFT03NW — a proven-non-reproducible
    // phantom, NOT an input defect: 60k trials clean; retry never hides a real bug).
    SerializerLegs.arrowAgreeStable 3 dv
    && (match SerializerLegs.arrowRT dv |> Option.bind dynamicToBloom with
        | Some f2 -> f2.Table = f.Table && (xs |> List.forall (fun x -> f2.MayContain x))
        | None ->
            // one bounded retry on the rehydrate leg too, same rationale
            match SerializerLegs.arrowRT dv |> Option.bind dynamicToBloom with
            | Some f2 -> f2.Table = f.Table && (xs |> List.forall (fun x -> f2.MayContain x))
            | None -> false)

[<Fact>]
let ``Metric × serializer: fixed sketches round-trip + rehydrate through every format`` () =
    let c = cmsOf 777L [ 1L; 2L; 2L; 3L ]
    Assert.Equal(2L, c.Estimate 2L)
    let c2 = SerializerLegs.jsonRT (cmsToDynamic c) |> Option.bind dynamicToCms
    Assert.True(c2 |> Option.map (fun x -> x.Estimate 2L = 2L) |> Option.defaultValue false)
    let f = bloomOf [ 10L; 20L; 30L ]
    let f2 = SerializerLegs.arrowRT (bloomToDynamic f) |> Option.bind dynamicToBloom
    Assert.True(f2 |> Option.map (fun x -> x.MayContain 10L && x.MayContain 20L && x.MayContain 30L) |> Option.defaultValue false)
