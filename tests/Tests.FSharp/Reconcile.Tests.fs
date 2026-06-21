module Zeta.Tests.ReconcileTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring
module RC = Zeta.Core.Reconcile

// ═══════════════════════════════════════════════════════════════════
// Reconcile — the relative-observer reconciliation (081KTAH8Q0008QG0R001YHSSA0's last rung, Aaron 2026-06-05). A 3-way merge
// of two diverged beliefs over their Merkle shared-ancestor: reconciled = a·b/ancestor = ancestor·dA·dB.
// The keystone is ORDER-INDEPENDENCE — all relative observers reach ONE common frame regardless of merge
// order (rides the proven NCI boundary: pointwise multiplication commutes). Exact ℚ; positive ancestor.
// ═══════════════════════════════════════════════════════════════════

let private r (n: int64) (d: int64) = PS.rat n d

let private genPosVecN (n: int) : Gen<PS.Rational[]> =
    Gen.arrayOfLength n (
        gen {
            let! num = Gen.choose (1, 10) |> Gen.map int64
            let! den = Gen.choose (1, 5) |> Gen.map int64
            return PS.rat num den
        })

let private genTriple : Gen<PS.Rational[] * PS.Rational[] * PS.Rational[]> =
    gen {
        let! n = Gen.choose (1, 4)
        let! anc = genPosVecN n
        let! a = genPosVecN n
        let! b = genPosVecN n
        return anc, a, b
    }

type TripleArb() =
    static member T() = Arb.fromGen genTriple

let private genManyBranches : Gen<PS.Rational[] * PS.Rational[] list> =
    gen {
        let! n = Gen.choose (1, 4)
        let! anc = genPosVecN n
        let! k = Gen.choose (2, 5)
        let! branches = Gen.listOfLength k (genPosVecN n)
        return anc, branches
    }

type ManyArb() =
    static member M() = Arb.fromGen genManyBranches

// ── the keystone: order-independence (relative observers reach ONE frame) ──

[<Property(Arbitrary = [| typeof<TripleArb> |])>]
let ``merge3 is commutative (order-independent reconciliation)``
    (t: PS.Rational[] * PS.Rational[] * PS.Rational[]) =
    let anc, a, b = t
    RC.merge3 anc a b = RC.merge3 anc b a

[<Property(Arbitrary = [| typeof<ManyArb> |])>]
let ``reconcileAll is independent of the order branches are merged (one common frame)``
    (m: PS.Rational[] * PS.Rational[] list) =
    let anc, branches = m
    match branches with
    | [] | [ _ ] -> true
    | _ ->
        let forward = RC.reconcileAll anc branches
        let reversed = RC.reconcileAll anc (List.rev branches)
        let rotated = RC.reconcileAll anc (List.tail branches @ [ List.head branches ])
        forward = reversed && forward = rotated

// ── ancestor is the identity of the merge (an unchanged fork contributes nothing) ──

[<Property(Arbitrary = [| typeof<TripleArb> |])>]
let ``merging a fork with the unchanged ancestor yields that fork`` (t: PS.Rational[] * PS.Rational[] * PS.Rational[]) =
    let anc, a, b = t
    RC.merge3 anc anc b = b && RC.merge3 anc a anc = a

// ── links to the proven floor: 3-way merge over states = replaying both branches' evidence ──

[<Property(Arbitrary = [| typeof<TripleArb> |])>]
let ``merge3 over diverged states = applying both branches' evidence to the ancestor (rides the NCI boundary)``
    (t: PS.Rational[] * PS.Rational[] * PS.Rational[]) =
    let anc, la, lb = t // treat la, lb as the per-branch likelihoods (evidence-since-ancestor)
    let branchA = PS.observe la anc
    let branchB = PS.observe lb anc
    RC.merge3 anc branchA branchB = PS.observeAll [ la; lb ] anc

[<Fact>]
let ``worked exact reconciliation`` () =
    let anc = [| r 2L 1L; r 3L 1L |]
    let a = [| r 4L 1L; r 3L 1L |]
    let b = [| r 6L 1L; r 3L 1L |]
    Assert.Equal<PS.Rational[]>([| r 12L 1L; r 3L 1L |], RC.merge3 anc a b)
    Assert.Equal<PS.Rational[]>([| r 2L 1L; r 1L 1L |], RC.delta anc a) // 4/2, 3/3

// ── BP-16 cross-check (Soraya's mandatory second tool for the P0 NCI safety invariant): the TLA+ spec
// (tools/tla/specs/NciSafety.tla) proved the ABSTRACT model is non-coercive; this proves the DEPLOYED
// merge never WRITES the counterparties' beliefs (it reads them, returns a new array) — closing the
// abstraction gap on the real F# code. ──
[<Property(Arbitrary = [| typeof<TripleArb> |])>]
let ``merge3 does not mutate the counterparties' beliefs (real-code NCI / non-coercion)``
    (t: PS.Rational[] * PS.Rational[] * PS.Rational[]) =
    let anc, a, b = t
    let ancBefore = Array.copy anc
    let aBefore = Array.copy a
    let bBefore = Array.copy b
    RC.merge3 anc a b |> ignore
    anc = ancBefore && a = aBefore && b = bBefore
