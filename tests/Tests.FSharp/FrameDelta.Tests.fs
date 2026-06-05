module Zeta.Tests.FrameDeltaTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module FD = Zeta.Core.FrameDelta
module TF = Zeta.Core.TravelerFrame

// ═══════════════════════════════════════════════════════════════════
// FrameDelta — the Layer-0 GROUP law of the traveler frame.
// The causal-join (TravelerFrame.transform) is a semilattice (irreversible merge, no inverses). The
// GROUP structure lives in the relative OFFSET between frames: deltas form an abelian group under
// composition (identity/associative/commutative/inverse) and ACT on frames by translation
// (apply identity, apply∘compose, `between` takes a→b, the cocycle, inverse-of-between). The discrete
// analog of the relativistic transformation group — distinct from the merge.
// ═══════════════════════════════════════════════════════════════════

let private genFrame : Gen<TF.Frame> =
    gen {
        let! n = Gen.choose (0, 4)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! a = Gen.elements [ "a"; "b"; "c"; "d"; "e" ]
                    let! v = Gen.choose (-50, 50) |> Gen.map int64
                    return a, Versionstamp.ofInt64 v
                })
        return { TF.Coords = Map.ofList pairs }
    }

// Generated deltas are normalized (zero shifts dropped) so structural `=` is semantic equality.
let private genDelta : Gen<FD.Delta> =
    gen {
        let! n = Gen.choose (0, 4)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! a = Gen.elements [ "a"; "b"; "c"; "d"; "e" ]
                    let! v = Gen.choose (-50, 50) |> Gen.map int64
                    return a, v
                })
        let m = (Map.ofList pairs) |> Map.filter (fun _ v -> v <> 0L)
        return { FD.Shifts = m }
    }

type FDArb() =
    static member F() = Arb.fromGen genFrame
    static member D() = Arb.fromGen genDelta

// ── abelian group axioms on the transformations ──

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``compose has identity`` (d: FD.Delta) =
    FD.compose d FD.identity = d && FD.compose FD.identity d = d

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``compose is associative`` (a: FD.Delta) (b: FD.Delta) (c: FD.Delta) =
    FD.compose (FD.compose a b) c = FD.compose a (FD.compose b c)

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``compose is commutative (abelian)`` (a: FD.Delta) (b: FD.Delta) =
    FD.compose a b = FD.compose b a

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``inverse cancels both ways`` (d: FD.Delta) =
    FD.compose d (FD.inverse d) = FD.identity && FD.compose (FD.inverse d) d = FD.identity

// ── the group ACTION on frames (translation) ──

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``apply identity is the frame`` (f: TF.Frame) =
    FD.sameFrame (FD.apply FD.identity f) f

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``apply respects composition (group action)`` (d1: FD.Delta) (d2: FD.Delta) (f: TF.Frame) =
    FD.sameFrame (FD.apply (FD.compose d1 d2) f) (FD.apply d1 (FD.apply d2 f))

// ── `between` is the transformation taking one frame to another ──

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``between takes a to b`` (a: TF.Frame) (b: TF.Frame) =
    FD.sameFrame (FD.apply (FD.between a b) a) b

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``between composes along the path (cocycle)`` (a: TF.Frame) (b: TF.Frame) (c: TF.Frame) =
    FD.compose (FD.between a b) (FD.between b c) = FD.between a c

[<Property(Arbitrary = [| typeof<FDArb> |])>]
let ``inverse of between reverses the endpoints`` (a: TF.Frame) (b: TF.Frame) =
    FD.inverse (FD.between a b) = FD.between b a
