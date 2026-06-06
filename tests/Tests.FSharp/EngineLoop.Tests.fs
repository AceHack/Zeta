module Zeta.Tests.EngineLoopTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module PS = Zeta.Core.ProbabilitySemiring

// ═══════════════════════════════════════════════════════════════════
// The full engine loop end-to-end (Aaron 2026-06-05) — proving the four proven modules COMPOSE into one
// cycle: bifurcation (split from a common ancestor) → diplomacy (read each other's shape, NCI-safe) →
// reflection (each diverges on its own evidence, deterministic) → reconciliation (merge diverged beliefs
// over the common ancestor into ONE frame, order-independent). NCI-respecting at every step. F#-only,
// composing YinYang + Diplomacy + ReflectionEngine + Reconcile (all individually proven).
// ═══════════════════════════════════════════════════════════════════

let private r (n: int64) (d: int64) = PS.rat n d

// An agent: its yin-yang identity/behaviour cell + its belief (priors).
type private Agent = { Cell: YinYang.Cell; Belief: PS.Rational[] }

let private kernel =
    Bonsai.Call("sync", [ Bonsai.Call("observe", [ Bonsai.Param "x" ]) ])

let private ancestorBelief = [| r 1L 1L; r 1L 1L; r 1L 1L |]

let private mkAgent (role: string) : Agent =
    { Cell = { YinYang.Remains = DynamicValue.Object [ "role", DynamicValue.String role ]; YinYang.Acts = kernel }
      Belief = ancestorBelief }

[<Fact>]
let ``the full loop composes: split -> diplomacy -> reflect -> reconcile (one frame, NCI-safe)`` () =
    // BIFURCATION: two agents fork from one common ancestor (same shape + kernel; distinct identity value)
    let alice = mkAgent "alice"
    let bob = mkAgent "bob"

    // DIPLOMACY: they can interoperate (same identity shape {role: string} + shared capabilities), and the
    // handshake is NCI-safe — identical public profiles despite different hidden role values.
    Assert.True(Diplomacy.canInteroperate alice.Cell bob.Cell)
    Assert.Equal<Diplomacy.Profile>(Diplomacy.describe alice.Cell, Diplomacy.describe bob.Cell)

    // REFLECT: each diverges on its OWN (non-coercive) evidence — self-reflection, deterministic.
    let aliceEv = [ [| r 2L 1L; r 1L 1L; r 1L 1L |] ]
    let bobEv = [ [| r 1L 1L; r 3L 1L; r 1L 1L |] ]
    let aliceBelief, _ = ReflectionEngine.reflect alice.Belief aliceEv
    let bobBelief, _ = ReflectionEngine.reflect bob.Belief bobEv

    // RECONCILE: merge the diverged beliefs over the common ancestor → ONE frame, order-independent
    // (both agents reach the same merged frame regardless of who merges first).
    let merged = Reconcile.merge3 ancestorBelief aliceBelief bobBelief
    Assert.Equal<PS.Rational[]>(merged, Reconcile.merge3 ancestorBelief bobBelief aliceBelief)
    // …and the merge equals replaying both forks' evidence on the ancestor (the proven NCI boundary).
    Assert.Equal<PS.Rational[]>(merged, PS.observeAll (aliceEv @ bobEv) ancestorBelief)

let private genEvN (n: int) : Gen<PS.Rational[] list> =
    gen {
        let! k = Gen.choose (1, 3)
        return!
            Gen.listOfLength k (
                Gen.arrayOfLength n (
                    gen {
                        let! num = Gen.choose (1, 8) |> Gen.map int64
                        let! den = Gen.choose (1, 4) |> Gen.map int64
                        return PS.rat num den
                    }))
    }

type EvArb() =
    static member E() = Arb.fromGen (genEvN 3)

[<Property(Arbitrary = [| typeof<EvArb> |])>]
let ``the loop is order-independent and deterministic for any non-coercive divergence``
    (aliceEv: PS.Rational[] list, bobEv: PS.Rational[] list) =
    let aliceBelief, _ = ReflectionEngine.reflect ancestorBelief aliceEv
    let bobBelief, _ = ReflectionEngine.reflect ancestorBelief bobEv
    let merged = Reconcile.merge3 ancestorBelief aliceBelief bobBelief
    // order-independent reconciliation + equals the combined-evidence replay (deterministic, NCI-safe)
    merged = Reconcile.merge3 ancestorBelief bobBelief aliceBelief
    && merged = PS.observeAll (aliceEv @ bobEv) ancestorBelief
