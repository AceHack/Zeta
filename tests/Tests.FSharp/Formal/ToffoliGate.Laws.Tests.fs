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

type WeightPair = {
    Left : Weight
    Right : Weight
}

let private genSmallWeight : Gen<Weight> =
    Gen.choose (-15, 15) |> Gen.map int64

let private genWeightPair : Arbitrary<WeightPair> =
    Gen.map2
        (fun left right -> { Left = left; Right = right })
        genSmallWeight
        genSmallWeight
    |> Arb.fromGen

type WeightPairArb() =
    static member WeightPair() = genWeightPair


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
        Ancilla = 3
    }

    circuit.Gates |> should equal [ step ]
    circuit.Wires.[step.ControlA] |> should equal One
    circuit.Wires.[step.ControlB] |> should equal One
    circuit.Wires.[step.Target] |> should equal Zero
    circuit.Ancilla |> should equal 3


// ── Reversible join weight multiplication fragment (B-0366.2.2) ──────────

let private wireBits (fragment: ToffoliCircuitFragment) (wires: WireId list) =
    wires |> List.map (fun wire -> fragment.Circuit.Wires.[wire])


let private allGateWires (step: ToffoliGateStep) =
    [ step.ControlA; step.ControlB; step.Target ]


let private applyStep (wires: WireMap) (step: ToffoliGateStep) =
    let target =
        if wires.[step.ControlA] = One && wires.[step.ControlB] = One then
            match wires.[step.Target] with
            | Zero -> One
            | One -> Zero
        else
            wires.[step.Target]

    wires |> Map.add step.Target target


let private applySteps steps wires =
    steps |> List.fold applyStep wires


let private executionStates steps wires =
    steps |> List.scan applyStep wires


let private wireKeySet (wires: WireMap) =
    wires |> Map.toSeq |> Seq.map fst |> Set.ofSeq


let private erasedWireCount before after =
    Set.difference (wireKeySet before) (wireKeySet after)
    |> Set.count


[<Fact>]
let ``Weight multiplication fragment encodes signed magnitude inputs`` () =
    let fragment = ToffoliGate.modelWeightMul -3L 5L

    fragment.Circuit.Wires.[fragment.ConstantOneWire] |> should equal One
    fragment.Circuit.Wires.[fragment.LeftSignWire] |> should equal One
    fragment.Circuit.Wires.[fragment.RightSignWire] |> should equal Zero
    fragment.Circuit.Wires.[fragment.ProductSignWire] |> should equal Zero

    wireBits fragment fragment.LeftMagnitudeWires |> should equal [ One; One ]
    wireBits fragment fragment.RightMagnitudeWires |> should equal [ One; Zero; One ]
    wireBits fragment fragment.ProductMagnitudeWires
    |> should equal [ Zero; Zero; Zero; Zero; Zero ]


[<Fact>]
let ``Weight multiplication fragment records Peres-shaped chains`` () =
    let fragment = ToffoliGate.modelWeightMul 3L 5L
    let pairCount = fragment.LeftMagnitudeWires.Length * fragment.RightMagnitudeWires.Length

    fragment.PeresChains.Length |> should equal pairCount
    fragment.PeresChains
    |> List.forall (fun chain -> chain.Length >= 3)
    |> should equal true

    fragment.ProductMagnitudeWires.Length
    |> should equal (fragment.LeftMagnitudeWires.Length + fragment.RightMagnitudeWires.Length)
    fragment.IntermediateWires.Length |> should equal pairCount
    fragment.CarryWires.Length >= pairCount |> should equal true

    let highProductColumn = fragment.ProductMagnitudeWires |> List.last
    fragment.Circuit.Gates
    |> List.exists (fun step -> step.Target = highProductColumn)
    |> should equal true

    fragment.Circuit.Gates |> List.skip 2 |> should equal (fragment.PeresChains |> List.collect id)


[<Fact>]
let ``Weight multiplication fragment retains every referenced wire`` () =
    let fragment = ToffoliGate.modelWeightMul -2L -7L
    let knownWires =
        fragment.Circuit.Wires
        |> Map.toSeq
        |> Seq.map fst
        |> Set.ofSeq

    fragment.Circuit.Ancilla |> should equal fragment.Circuit.Wires.Count

    for step in fragment.Circuit.Gates do
        for wire in allGateWires step do
            knownWires.Contains wire |> should equal true


[<Fact>]
let ``Weight multiplication fragment keeps zero weight as one magnitude bit`` () =
    let fragment = ToffoliGate.modelWeightMul 0L 0L

    wireBits fragment fragment.LeftMagnitudeWires |> should equal [ Zero ]
    wireBits fragment fragment.RightMagnitudeWires |> should equal [ Zero ]
    fragment.ProductMagnitudeWires.Length |> should equal 2
    fragment.PeresChains.Length |> should equal 1


[<Fact>]
let ``Weight multiplication fragment normalizes zero product sign`` () =
    let cases =
        [ ToffoliGate.modelWeightMul 0L -5L
          ToffoliGate.modelWeightMul -5L 0L ]

    for fragment in cases do
        fragment.Circuit.Wires.[fragment.ProductSignWire] |> should equal Zero
        fragment.Circuit.Gates
        |> List.exists (fun step -> step.Target = fragment.ProductSignWire)
        |> should equal false


[<Fact>]
let ``Weight multiplication fragment propagates colliding partial-product carries`` () =
    let fragment = ToffoliGate.modelWeightMul 3L 3L
    let columnOne = fragment.ProductMagnitudeWires.[1]
    let columnTwo = fragment.ProductMagnitudeWires.[2]
    let columnThree = fragment.ProductMagnitudeWires.[3]
    let gates = fragment.Circuit.Gates

    gates
    |> List.filter (fun step -> step.Target = columnOne)
    |> List.length
    |> should be (greaterThanOrEqualTo 2)

    fragment.CarryWires
    |> List.exists (fun carry ->
        gates
        |> List.exists (fun step ->
            step.ControlA = carry
            && step.ControlB = fragment.ConstantOneWire
            && step.Target = columnTwo))
    |> should equal true

    fragment.CarryWires
    |> List.exists (fun carry ->
        gates
        |> List.exists (fun step ->
            step.ControlA = carry
            && step.ControlB = fragment.ConstantOneWire
            && step.Target = columnThree))
    |> should equal true


// ── Reversibility laws over the retained join-weight fragment (B-0366.2.3) ──

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Weight multiplication fragment forward then reverse restores retained wires`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires

    let afterForward =
        applySteps fragment.Circuit.Gates initial

    let afterReverse =
        applySteps (List.rev fragment.Circuit.Gates) afterForward

    afterReverse = initial


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Weight multiplication fragment forward execution never erases retained wires`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let initialKeys = wireKeySet initial

    executionStates fragment.Circuit.Gates initial
    |> List.forall (fun state ->
        Map.count state = Map.count initial
        && wireKeySet state = initialKeys)


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Weight multiplication fragment Landauer accounting reports zero erased bits`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let afterForward = applySteps fragment.Circuit.Gates initial
    let afterReverse = applySteps (List.rev fragment.Circuit.Gates) afterForward

    fragment.Circuit.Ancilla = Map.count initial
    && erasedWireCount initial afterForward = 0
    && erasedWireCount afterForward afterReverse = 0
    && erasedWireCount initial afterReverse = 0


// ── Reversible Z-set join circuit laws (B-0366.2.3) ──────────────────────────

let private smallZSet : Arbitrary<ZSet<int>> =
    let g =
        Gen.sized (fun size ->
            let n = min size 8
            Gen.zip (Gen.choose (-5, 5)) (Gen.choose (-3, 3) |> Gen.map int64)
            |> Gen.listOfLength n
            |> Gen.map ZSet.ofSeq)
    Arb.fromGen g

type SmallZSetArb() =
    static member ZSet() = smallZSet


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Join circuit forward then reverse restores all wires`` (a: ZSet<int>) (b: ZSet<int>) =
    let circuit = ToffoliGate.modelJoinCircuit a b
    let initial = circuit.Wires
    let afterForward = applySteps circuit.Gates initial
    let afterReverse = applySteps (List.rev circuit.Gates) afterForward
    afterReverse = initial


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Join circuit forward execution never erases wires`` (a: ZSet<int>) (b: ZSet<int>) =
    let circuit = ToffoliGate.modelJoinCircuit a b
    let initial = circuit.Wires
    let initialKeys = wireKeySet initial

    executionStates circuit.Gates initial
    |> List.forall (fun state ->
        Map.count state = Map.count initial
        && wireKeySet state = initialKeys)


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Join circuit Landauer accounting reports zero erased bits`` (a: ZSet<int>) (b: ZSet<int>) =
    let circuit = ToffoliGate.modelJoinCircuit a b
    let initial = circuit.Wires
    let afterForward = applySteps circuit.Gates initial
    let afterReverse = applySteps (List.rev circuit.Gates) afterForward

    circuit.Ancilla = Map.count initial
    && erasedWireCount initial afterForward = 0
    && erasedWireCount afterForward afterReverse = 0
    && erasedWireCount initial afterReverse = 0
