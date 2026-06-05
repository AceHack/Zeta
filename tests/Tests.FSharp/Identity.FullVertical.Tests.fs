module Zeta.Tests.IdentityFullVerticalTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Identity local-handle full-vertical — the G-Set/Clock TEMPLATE applied to the
// IDENTITY primitive (PROVEN-CORE-MAP #2). SCOPE: the LOCAL-HANDLE layer only —
// ZetaId as the absolute, injective, proven-base mechanism (a 128-bit composite
// key, bit-packed from a ZetaObservation). The perspectival belief-map / ε-ball-
// neighborhood layer is RESEARCH and is explicitly NOT in this vertical.
//
// math ∧ 4-lang already hold (registry: bijection + injectivity + env-invariance +
// key-embeds-clock ordering; F#/C#/TS cross-verify harness). This adds:
//   4-ser + Arrow : ZetaObservation ↔ its canonical DynamicValue (an Object of the
//                   decoded fields) → every serializer recovers it.
//   Bonsai        : identity RESOLVE (idempotent dedup of identity-sets) reified as
//                   a Bonsai Expr, round-tripped + applied. Resolve = G-Set union of
//                   packed-id sets — so identity reuses the proven G-Set merge.
//   homeostat     : a FOURTH homeostat-tie class (after semilattice-LUB, integrity-
//                   verify, monoid-aggregate): IDENTITY DEDUP. Two properties —
//                   (1) INJECTIVITY / no-bad-collapse: distinct observations pack to
//                       distinct keys (a bijection — unpack∘pack = id), so two
//                       distinct personas never silently merge in the homeostat;
//                   (2) IDEMPOTENT DEDUP: re-observing the SAME identity is a no-op
//                       (a G-Set of packed ids — re-adding is idempotent, order-
//                       independent), the GOOD collapse. So identity is "tied to an
//                       existing homeostat" (G-Set dedup) per the map's role taxonomy.
//
// Deterministic env (rand=0) makes `pack` a pure function of the observation, so the
// 128-bit key is fully determined by the decoded fields (the local handle).
//
// math + 4-lang (registry) ∧ this file's 4-ser + Arrow + Bonsai + homeostat →
// Identity (local-handle layer) joins G-Set + Clock + Serialization-seed as a
// FULL-PROVEN floor primitive (4 of 6).
// ═══════════════════════════════════════════════════════════════════

let private env : ISimulationEnvironment = DeterministicEnv.Instance

// ── carrier bridge: ZetaObservation ↔ DynamicValue.Object of decoded fields ──

let private obsToDynamic (o: ZetaObservation) : DynamicValue =
    DynamicValue.Object
        [ "version", DynamicValue.Int(int64 (byte o.Version))
          "timestamp", DynamicValue.Int(int64 o.Timestamp)
          "chromosome", DynamicValue.Int(int64 (byte o.Chromosome))
          "category", DynamicValue.Int(int64 (byte o.Category))
          "firefly", DynamicValue.Int(int64 (byte o.Firefly))
          "authority", DynamicValue.Int(int64 (Authority.toByte o.Authority))
          "persona", DynamicValue.Int(int64 (byte o.Persona))
          "momentum", DynamicValue.Int(int64 (Momentum.toByte o.Momentum))
          "location", DynamicValue.Int(int64 (byte o.Location)) ]

let private dynamicToObs (dv: DynamicValue) : ZetaObservation option =
    match dv with
    | DynamicValue.Object fields ->
        let m = Map.ofList fields
        let getB k =
            match Map.tryFind k m with
            | Some(DynamicValue.Int i) -> Some(byte i)
            | _ -> None
        let getI k =
            match Map.tryFind k m with
            | Some(DynamicValue.Int i) -> Some i
            | _ -> None
        match getB "version", getI "timestamp", getB "chromosome", getB "category", getB "firefly",
              getB "authority", getB "persona", getB "momentum", getB "location" with
        | Some ver, Some ts, Some chr, Some cat, Some ff, Some auth, Some per, Some mom, Some loc ->
            Some
                { Version = LanguagePrimitives.EnumOfValue ver
                  Timestamp = LanguagePrimitives.Int64WithMeasure<ms> ts
                  Chromosome = LanguagePrimitives.EnumOfValue chr
                  Category = LanguagePrimitives.EnumOfValue cat
                  Firefly = LanguagePrimitives.EnumOfValue ff
                  Authority = Authority.fromByte auth
                  Persona = LanguagePrimitives.EnumOfValue per
                  Momentum = Momentum.fromByte mom
                  Location = LanguagePrimitives.EnumOfValue loc }
        | _ -> None
    | _ -> None

// generator over VALID observations (named enum cases only — the local-handle vocabulary)
let private genObs : Gen<ZetaObservation> =
    gen {
        let! ts = Gen.choose (0, 1000000000) |> Gen.map int64
        let! chr = Gen.elements [ Chromosome.MetaCoherence; Chromosome.FinancialIntegrity ]
        let! cat =
            Gen.elements
                [ Category.Observation; Category.Emission; Category.Workflow; Category.Heartbeat
                  Category.Bus; Category.Spawn; Category.WorkItem ]
        let! ff = Gen.elements [ Firefly.Off; Firefly.On ]
        let! auth =
            Gen.elements
                [ Authority.HumanVerified; Authority.TrustedAgent; Authority.Standard
                  Authority.BestEffort; Authority.Simulated ]
        let! per = Gen.elements [ Persona.HumanMaintainer; Persona.FireflyCoherence ]
        let! mom =
            Gen.elements
                [ Momentum.Background; Momentum.Normal; Momentum.Elevated; Momentum.High; Momentum.Critical ]
        let! loc =
            Gen.elements
                [ Location.EastUsVa; Location.WestUsOr; Location.CentralUs; Location.WestEurope; Location.MultiRegion ]
        return
            { Version = IdVersion.V1
              Timestamp = LanguagePrimitives.Int64WithMeasure<ms> ts
              Chromosome = chr
              Category = cat
              Firefly = ff
              Authority = auth
              Persona = per
              Momentum = mom
              Location = loc }
    }

type ObsArb() =
    static member O() = Arb.fromGen genObs

// ── 4-ser + Arrow legs (via the shared SerializerLegs helper) ──

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × 4-ser: JSON+CBOR+YAML+XML all recover the same observation`` (o: ZetaObservation) =
    let dv = obsToDynamic o
    SerializerLegs.fourSerAgree dv && (SerializerLegs.jsonRT dv |> Option.bind dynamicToObs = Some o)

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × Arrow: round-trips through Arrow IPC and recovers the same observation`` (o: ZetaObservation) =
    let dv = obsToDynamic o
    SerializerLegs.arrowAgree dv && (SerializerLegs.arrowRT dv |> Option.bind dynamicToObs = Some o)

// ── Bonsai leg: identity RESOLVE (idempotent dedup of identity-sets) reified ──
// Resolve = G-Set union of packed-id sets; identity reuses the proven G-Set merge.

let rec private applyResolve (envM: Map<string, GSet<System.UInt128>>) (e: Bonsai.Expr) : GSet<System.UInt128> option =
    match e with
    | Bonsai.Param n -> Map.tryFind n envM
    | Bonsai.Call ("id-resolve", [ l; r ]) ->
        match applyResolve envM l, applyResolve envM r with
        | Some a, Some b -> Some(a + b) // G-Set union IS idempotent identity dedup
        | _ -> None
    | _ -> None

let private resolveExpr : Bonsai.Expr =
    Bonsai.Call("id-resolve", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × Bonsai: resolve reified as a Bonsai Expr round-trips and applies to the dedup-union`` (a: ZetaObservation) (b: ZetaObservation) =
    let sa = GSet.ofSeq [ ZetaIdCodec.pack a env ]
    let sb = GSet.ofSeq [ ZetaIdCodec.pack b env ]
    match bonsaiRT resolveExpr with
    | Some e -> applyResolve (Map.ofList [ "a", sa; "b", sb ]) e = Some(sa + sb)
    | None -> false

[<Fact>]
let ``Identity × Bonsai: the reified resolve expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some resolveExpr, bonsaiRT resolveExpr)

// ── homeostat leg: IDENTITY DEDUP (injectivity / no-bad-collapse + idempotent dedup) ──

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × homeostat: pack is a bijection (unpack∘pack = id) — the local handle is faithful`` (o: ZetaObservation) =
    ZetaIdCodec.unpack (ZetaIdCodec.pack o env) = o

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × homeostat: INJECTIVITY — distinct observations pack to distinct keys (no bad collapse)`` (a: ZetaObservation) (b: ZetaObservation) =
    // two distinct personas/observations must NEVER share a key (would merge in the homeostat)
    a = b || ZetaIdCodec.pack a env <> ZetaIdCodec.pack b env

[<Property(Arbitrary = [| typeof<ObsArb> |])>]
let ``Identity × homeostat: IDEMPOTENT DEDUP — re-observing the same identity is a no-op (order-independent)`` (a: ZetaObservation) (b: ZetaObservation) (c: ZetaObservation) =
    let ia, ib, ic = ZetaIdCodec.pack a env, ZetaIdCodec.pack b env, ZetaIdCodec.pack c env
    // identity-dedup is a G-Set of packed keys: union converges regardless of order + duplicates
    let lub = GSet.ofSeq [ ia; ib; ic ]
    let orders =
        [ GSet.ofSeq [ ia; ib; ic ]; GSet.ofSeq [ ic; ib; ia ]; GSet.ofSeq [ ib; ia; ic; ia ] ]
    let orderAndDupIndependent = List.forall (fun (x: GSet<System.UInt128>) -> x = lub) orders
    // re-observing any handle is a no-op (idempotent merge — the GOOD collapse)
    let idempotent = (lub + GSet.ofSeq [ ia ] = lub) && (lub + GSet.ofSeq [ ic ] = lub)
    orderAndDupIndependent && idempotent

[<Fact>]
let ``Identity × carrier: a fixed observation round-trips through every format`` () =
    let o =
        { Version = IdVersion.V1
          Timestamp = LanguagePrimitives.Int64WithMeasure<ms> 1700000000000L
          Chromosome = Chromosome.MetaCoherence
          Category = Category.Heartbeat
          Firefly = Firefly.On
          Authority = Authority.TrustedAgent
          Persona = Persona.FireflyCoherence
          Momentum = Momentum.Elevated
          Location = Location.WestEurope }
    let dv = obsToDynamic o
    Assert.Equal(Some o, SerializerLegs.jsonRT dv |> Option.bind dynamicToObs)
    Assert.Equal(Some o, SerializerLegs.cborRT dv |> Option.bind dynamicToObs)
    Assert.Equal(Some o, SerializerLegs.yamlRT dv |> Option.bind dynamicToObs)
    Assert.Equal(Some o, SerializerLegs.xmlRT dv |> Option.bind dynamicToObs)
    Assert.Equal(Some o, SerializerLegs.arrowRT dv |> Option.bind dynamicToObs)
    // bijection witness on the fixed case
    Assert.Equal(o, ZetaIdCodec.unpack (ZetaIdCodec.pack o env))
