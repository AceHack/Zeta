module Zeta.Tests.SerializationSeedFullVerticalTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Tests.Support

// ═══════════════════════════════════════════════════════════════════
// Serialization-seed full-vertical — the G-Set/Clock TEMPLATE applied to the
// SERIALIZATION-SEED primitive (PROVEN-CORE-MAP #5). The seed is the
// deterministic, cross-language byte-locked serialization meter: ByteCost
// (`src/Core/ByteCost.fs`), the UTF-8 byte length of a surface's canonical bytes.
// math ∧ 4-lang already hold: ByteCost.Laws.Tests.fs proves the commutative-monoid
// laws (Z3 symbolic + FsCheck) AND the golden-vectors cross-language byte-lock
// (F#/C#/Rust/TS agree on the canonical bytes — the 4-lang leg). This adds the
// carrier/operation legs:
//   4-ser + Arrow : ByteCost ↔ DynamicValue.Int Bytes → every serializer recovers it.
//   Bonsai        : the monoid operation (ByteCost.add) reified as a Bonsai Expr,
//                   round-tripped + applied to compute the sum.
//   homeostat     : Serialization-seed is a COMMUTATIVE MONOID, NOT a join-
//                   semilattice — so (like Merkle, but for a different reason) its
//                   homeostat-tie is NOT convergence-to-LUB. ByteCost.add is
//                   commutative + associative with Zero identity, but NOT idempotent
//                   (add a a ≠ a — adding a cost twice double-counts). Its homeostat
//                   role is ORDER-INDEPENDENT AGGREGATION: a fileset's total cost is
//                   the same regardless of fold order (the DORA-aggregate soundness —
//                   path-independent accounting), and the measure is deterministic
//                   (same text → same seed). That order-independence is the monoid's
//                   contribution to a homeostat (deterministic, path-independent
//                   accounting), explicitly distinguished from idempotent CRDT
//                   convergence.
//
// math + 4-lang (registry/golden-vectors) ∧ this file's 4-ser + Arrow + Bonsai +
// homeostat → Serialization-seed joins G-Set + Clock as a FULL-PROVEN floor
// primitive (3 of 6). The taxonomy now has all three operation classes worked:
// semilattice (G-Set ∪, Clock max → converge-to-LUB), integrity (Merkle → verify),
// commutative-monoid (seed → order-independent aggregate).
// ═══════════════════════════════════════════════════════════════════

let private bcToDynamic (bc: ByteCost) : DynamicValue = DynamicValue.Int bc.Bytes

let private dynamicToBc (dv: DynamicValue) : ByteCost option =
    match dv with
    | DynamicValue.Int i -> Some(ByteCost.ofBytes i)
    | _ -> None

// byte counts are non-negative; the seed measures sizes
let private genBc : Gen<ByteCost> =
    Gen.choose (0, 1000000) |> Gen.map (int64 >> ByteCost.ofBytes)

type BcArb() =
    static member B() = Arb.fromGen genBc

// ── 4-ser + Arrow legs (via the shared SerializerLegs helper) ──

[<Property(Arbitrary = [| typeof<BcArb> |])>]
let ``Seed × 4-ser: JSON+CBOR+YAML+XML all recover the same ByteCost`` (bc: ByteCost) =
    let dv = bcToDynamic bc
    SerializerLegs.fourSerAgree dv && (SerializerLegs.jsonRT dv |> Option.bind dynamicToBc = Some bc)

[<Property(Arbitrary = [| typeof<BcArb> |])>]
let ``Seed × Arrow: round-trips through Arrow IPC and recovers the same ByteCost`` (bc: ByteCost) =
    let dv = bcToDynamic bc
    SerializerLegs.arrowAgree dv && (SerializerLegs.arrowRT dv |> Option.bind dynamicToBc = Some bc)

[<Fact>]
let ``Seed × carrier: the measured seed of a fixed text round-trips through every format`` () =
    // seed determinism: measureText is referentially transparent — same text → same ByteCost
    let bc = ByteCost.measureText "hello, world"
    Assert.Equal(bc, ByteCost.measureText "hello, world")
    let dv = bcToDynamic bc
    Assert.Equal(Some bc, SerializerLegs.jsonRT dv |> Option.bind dynamicToBc)
    Assert.Equal(Some bc, SerializerLegs.cborRT dv |> Option.bind dynamicToBc)
    Assert.Equal(Some bc, SerializerLegs.yamlRT dv |> Option.bind dynamicToBc)
    Assert.Equal(Some bc, SerializerLegs.xmlRT dv |> Option.bind dynamicToBc)
    Assert.Equal(Some bc, SerializerLegs.arrowRT dv |> Option.bind dynamicToBc)

// ── Bonsai leg: the monoid add reified, round-tripped, applied ──

let rec private applyAdd (env: Map<string, ByteCost>) (e: Bonsai.Expr) : ByteCost option =
    match e with
    | Bonsai.Param n -> Map.tryFind n env
    | Bonsai.Call ("bytecost-add", [ l; r ]) ->
        match applyAdd env l, applyAdd env r with
        | Some a, Some b -> Some(ByteCost.add a b)
        | _ -> None
    | _ -> None

let private addExpr : Bonsai.Expr =
    Bonsai.Call("bytecost-add", [ Bonsai.Param "a"; Bonsai.Param "b" ])

let private bonsaiRT (e: Bonsai.Expr) : Bonsai.Expr option =
    match Bonsai.serialize e with
    | Ok s -> (match Bonsai.parse s with | Ok e2 -> Some e2 | Error _ -> None)
    | Error _ -> None

[<Property(Arbitrary = [| typeof<BcArb> |])>]
let ``Seed × Bonsai: add reified as a Bonsai Expr round-trips and applies to the sum`` (a: ByteCost) (b: ByteCost) =
    match bonsaiRT addExpr with
    | Some e -> applyAdd (Map.ofList [ "a", a; "b", b ]) e = Some(ByteCost.add a b)
    | None -> false

[<Fact>]
let ``Seed × Bonsai: the reified add expression round-trips byte-stably`` () =
    Assert.Equal<Bonsai.Expr option>(Some addExpr, bonsaiRT addExpr)

// ── homeostat leg: ORDER-INDEPENDENT AGGREGATION (commutative monoid, NOT a semilattice) ──

[<Property(Arbitrary = [| typeof<BcArb> |])>]
let ``Seed × homeostat: monoid fold is order-independent (every order → the same total) + Zero identity``
    (a: ByteCost) (b: ByteCost) (c: ByteCost) =
    let total = ByteCost.sum [ a; b; c ]
    // commutativity + associativity → every fold order reaches the same total (DORA-aggregate soundness)
    let orders =
        [ ByteCost.add (ByteCost.add a b) c
          ByteCost.add a (ByteCost.add b c)
          ByteCost.add (ByteCost.add c a) b
          ByteCost.add (ByteCost.add b c) a
          ByteCost.add (ByteCost.add c b) a ]
    let orderIndependent = List.forall (fun x -> x = total) orders
    let identity = ByteCost.add a ByteCost.Zero = a && ByteCost.add ByteCost.Zero a = a
    orderIndependent && identity

[<Fact>]
let ``Seed × homeostat: the seed is a MONOID not a semilattice — add is NOT idempotent (re-adding double-counts)`` () =
    // The honest distinction from G-Set/Clock: a CRDT merge is idempotent (re-delivery is a
    // no-op); the seed's add is NOT (adding a cost twice double-counts). So the seed's homeostat
    // role is order-independent AGGREGATION, not idempotent convergence-to-LUB.
    let a = ByteCost.ofBytes 7L
    Assert.NotEqual(a, ByteCost.add a a)
    Assert.Equal(ByteCost.ofBytes 14L, ByteCost.add a a)
    // but it IS order-independent: the seed-aggregate is path-independent
    Assert.Equal(ByteCost.sum [ ByteCost.ofBytes 1L; ByteCost.ofBytes 2L; ByteCost.ofBytes 3L ],
                 ByteCost.sum [ ByteCost.ofBytes 3L; ByteCost.ofBytes 1L; ByteCost.ofBytes 2L ])
