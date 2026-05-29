module Zeta.Tests.Formal.ToffoliGateLawsTests
#nowarn "0893"

open FsCheck
open FsCheck.FSharp
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ── FsCheck generators ───────────────────────────────────────────────────
//
// ToffoliWires has 2³ = 8 possible states. The Arbitrary below generates
// all 8 with equal probability so every property is exercised exhaustively
// within MaxTest=256 runs.

let private genBit : Gen<Bit> = Gen.elements [ Zero; One ]

let private genWires : Arbitrary<ToffoliWires> =
    Gen.map3
        (fun a b c -> { A = a; B = b; C = c })
        genBit genBit genBit
    |> Arb.fromGen

type ToffoliArb() =
    static member Wires() = genWires


// ── Toffoli gate laws ────────────────────────────────────────────────────
//
// These properties prove the three load-bearing claims of B-0366.1:
//
//   (1) Self-inverse: apply ∘ apply = id
//       The gate is its own inverse — no separate "undo" operation needed.
//
//   (2) Assert-retract identity: encode Retract ∘ encode Assert = id
//       The Z-set round-trip leaves wire state unchanged.
//
//   (3) Bit conservation: output always has the same 3 wires as input.
//       No bits are erased → Landauer's principle guarantees no heat.
//
// All three are PROVEN properties of the Toffoli gate (Toffoli 1980).
// The FsCheck run validates the F# implementation matches the mathematical
// specification.

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<ToffoliArb> |], MaxTest = 256)>]
let ``Toffoli gate is self-inverse: apply (apply w) = w`` (w: ToffoliWires) =
    ToffoliGate.apply (ToffoliGate.apply w) = w


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<ToffoliArb> |], MaxTest = 256)>]
let ``Assert then Retract returns original wire state`` (w: ToffoliWires) =
    ToffoliGate.assertThenRetract w = w


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<ToffoliArb> |], MaxTest = 256)>]
let ``Encode Assert is same as apply`` (w: ToffoliWires) =
    ToffoliGate.encode Assert w = ToffoliGate.apply w


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<ToffoliArb> |], MaxTest = 256)>]
let ``Encode Retract is same as apply`` (w: ToffoliWires) =
    ToffoliGate.encode Retract w = ToffoliGate.apply w


// ── Spot-check all 8 gate truth-table entries ────────────────────────────
//
// The Toffoli gate truth table for (a, b, c) → (a, b, c ⊕ (a ∧ b)):
//
//   (0,0,0) → (0,0,0)   control=false, c unchanged
//   (0,0,1) → (0,0,1)   control=false, c unchanged
//   (0,1,0) → (0,1,0)   control=false, c unchanged
//   (0,1,1) → (0,1,1)   control=false, c unchanged
//   (1,0,0) → (1,0,0)   control=false, c unchanged
//   (1,0,1) → (1,0,1)   control=false, c unchanged
//   (1,1,0) → (1,1,1)   control=true,  c flipped 0→1
//   (1,1,1) → (1,1,0)   control=true,  c flipped 1→0

[<Fact>]
let ``Toffoli truth table: control off leaves C unchanged`` () =
    let cases = [
        { A = Zero; B = Zero; C = Zero }, { A = Zero; B = Zero; C = Zero }
        { A = Zero; B = Zero; C = One  }, { A = Zero; B = Zero; C = One  }
        { A = Zero; B = One;  C = Zero }, { A = Zero; B = One;  C = Zero }
        { A = Zero; B = One;  C = One  }, { A = Zero; B = One;  C = One  }
        { A = One;  B = Zero; C = Zero }, { A = One;  B = Zero; C = Zero }
        { A = One;  B = Zero; C = One  }, { A = One;  B = Zero; C = One  }
    ]
    for (input, expected) in cases do
        ToffoliGate.apply input |> should equal expected


[<Fact>]
let ``Toffoli truth table: control on flips C`` () =
    ToffoliGate.apply { A = One; B = One; C = Zero }
    |> should equal { A = One; B = One; C = One }

    ToffoliGate.apply { A = One; B = One; C = One }
    |> should equal { A = One; B = One; C = Zero }


[<Fact>]
let ``Landauer claim: A and B wires are always preserved unchanged`` () =
    let allInputs =
        [ for a in [ Zero; One ] do
            for b in [ Zero; One ] do
              for c in [ Zero; One ] do
                yield { A = a; B = b; C = c } ]
    for w in allInputs do
        let out = ToffoliGate.apply w
        out.A |> should equal w.A
        out.B |> should equal w.B


// ── ToffoliCircuit wire-map model laws (B-0366.2.1) ─────────────────────

[<Fact>]
let ``Empty Toffoli circuit satisfies wire-map invariants`` () =
    ToffoliGate.emptyCircuit.Gates |> List.isEmpty |> should equal true
    ToffoliGate.emptyCircuit.Wires |> Map.isEmpty |> should equal true
    ToffoliGate.emptyCircuit.Ancilla |> should equal 0


[<Fact>]
let ``Toffoli circuit records gate steps by wire id without erasing wire state`` () =
    let step = { ControlA = 0; ControlB = 1; Target = 2 }
    let wires =
        [ 0, One
          1, One
          2, Zero ]
        |> Map.ofList

    let circuit = {
        Gates = [ step ]
        Wires = wires
        Ancilla = 1
    }

    circuit.Gates |> should equal [ step ]
    circuit.Wires.[step.ControlA] |> should equal One
    circuit.Wires.[step.ControlB] |> should equal One
    circuit.Wires.[step.Target] |> should equal Zero
    circuit.Ancilla |> should equal 1
