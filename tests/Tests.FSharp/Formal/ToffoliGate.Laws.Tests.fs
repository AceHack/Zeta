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
// These properties prove the three load-bearing claims of 081KR50HA0008QG0R0021B5J87:
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


// ── ToffoliCircuit wire-map model laws (081KRA5AR0008QG0R002X77BEB) ─────────────────────

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


// ── Reversible join weight multiplication fragment (081KRA5AR0008QG0R001GQSVWE) ──────────

let private wireBits (fragment: ToffoliCircuitFragment) (wires: WireId list) =
    wires |> List.map (fun wire -> fragment.Circuit.Wires.[wire])


let private allGateWires (step: ToffoliGateStep) =
    [ step.ControlA; step.ControlB; step.Target ]


// The interpreter now lives in Zeta.Core (ToffoliGate.step / .run) so that the
// garbage accounting and the laws are executing the SAME semantics. These aliases
// keep the existing test bodies unchanged.
let private applyStep = ToffoliGate.step


let private applySteps steps wires =
    steps |> List.fold applyStep wires


let private executionStates steps wires =
    steps |> List.scan applyStep wires


let private wireKeySet (wires: WireMap) =
    wires |> Map.toSeq |> Seq.map fst |> Set.ofSeq


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


// ── Reversibility laws over the retained join-weight fragment (081KRA5AR0008QG0R000CYY9ZN) ──

[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Weight multiplication fragment forward then reverse restores retained wires`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires

    let afterForward =
        applySteps fragment.Circuit.Gates initial

    let afterReverse =
        applySteps (List.rev fragment.Circuit.Gates) afterForward

    afterReverse = initial


/// Renamed from `... forward execution never erases retained wires`, which overstated
/// what the body checks. The assertion is unchanged. What it can actually catch is a
/// gate naming a wire that was never allocated: a dangling Target would make `Map.add`
/// GROW the key set, and a dangling control raises. It cannot catch erasure, because
/// this interpreter has no operation that removes a wire.
[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Weight multiplication fragment references no unallocated wire`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let initialKeys = wireKeySet initial

    executionStates fragment.Circuit.Gates initial
    |> List.forall (fun state ->
        Map.count state = Map.count initial
        && wireKeySet state = initialKeys)


// ── Reversible Z-set join circuit laws (081KRA5AR0008QG0R000CYY9ZN) ──────────────────────────

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


/// Renamed from `... forward execution never erases wires`. Same reasoning as the
/// fragment-level property above: the assertion is a no-dangling-wire check, not an
/// erasure check.
[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Join circuit references no unallocated wire`` (a: ZSet<int>) (b: ZSet<int>) =
    let circuit = ToffoliGate.modelJoinCircuit a b
    let initial = circuit.Wires
    let initialKeys = wireKeySet initial

    executionStates circuit.Gates initial
    |> List.forall (fun state ->
        Map.count state = Map.count initial
        && wireKeySet state = initialKeys)


// ── Landauer garbage accounting (081M05M1R97087G0R0023Z4F9D) ────────────────────────────────
//
// Replaces two properties that could not fail. `erasedWireCount` counted wire ids dropped
// from the wire map; `ToffoliGate.step` ends `Map.add`, which never removes a key, so the
// count was identically zero for every circuit and every input. Mutation-verified before
// this change: deleting EVERY gate from the model left both properties green.
//
// Erasure is redefined at the circuit boundary — ancilla NOT returned to their allocation
// value, the garbage that must be dissipated to reuse the wires (Landauer 1961; Bennett
// 1973/1989). See the note above `UncomputedFragment` in src/Core/ToffoliGate.fs.
//
// The properties below come in pairs on purpose. `garbage = 0` alone is satisfied by a
// circuit that computes NOTHING, so every zero-garbage claim is paired with a claim that
// the output register holds the exact product, checked against an oracle computed from the
// integers rather than from the circuit.


[<Fact>]
let ``Keep-all-garbage fragment does NOT achieve zero Landauer garbage`` () =
    // The honest measurement of the shipped `modelWeightMul`: it has no uncompute pass, so
    // its partial products and carries end dirty. This is the corrected reading of the
    // "0 erased bits" criterion, and it is the opposite of what that criterion claimed.
    let fragment = ToffoliGate.modelWeightMul 3L 5L
    let initial = fragment.Circuit.Wires
    let final = ToffoliGate.run fragment.Circuit.Gates initial
    let ancilla = ToffoliGate.keepAllAncillaWires fragment

    ToffoliGate.garbageBitCount initial final ancilla
    |> should be (greaterThan 0)


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Keep-all-garbage fragment leaves garbage whenever a partial product is set`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMul pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let final = ToffoliGate.run fragment.Circuit.Gates initial
    let garbage = ToffoliGate.garbageBitCount initial final (ToffoliGate.keepAllAncillaWires fragment)

    // Zero garbage exactly when no partial product fired — i.e. when one operand is zero.
    if pair.Left = 0L || pair.Right = 0L then garbage = 0 else garbage > 0


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Bennett-scheduled fragment returns every ancilla wire to its allocation value`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMulUncomputed pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let final = ToffoliGate.run fragment.Circuit.Gates initial

    ToffoliGate.garbageBitCount initial final fragment.AncillaWires = 0


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Bennett-scheduled fragment output register holds the exact product`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMulUncomputed pair.Left pair.Right
    let final = ToffoliGate.run fragment.Circuit.Gates fragment.Circuit.Wires
    let expectedSign, expectedMagnitude = ToffoliGate.expectedProductBits pair.Left pair.Right

    final.[fragment.OutputSignWire] = expectedSign
    && (fragment.OutputMagnitudeWires |> List.map (fun w -> final.[w])) = expectedMagnitude


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<WeightPairArb> |], MaxTest = 128)>]
let ``Bennett-scheduled fragment returns the caller's operands unchanged`` (pair: WeightPair) =
    let fragment = ToffoliGate.modelWeightMulUncomputed pair.Left pair.Right
    let initial = fragment.Circuit.Wires
    let final = ToffoliGate.run fragment.Circuit.Gates initial

    fragment.InputWires |> List.forall (fun w -> final.[w] = initial.[w])


[<Fact>]
let ``Skipping the uncompute pass drives Landauer garbage positive`` () =
    // The falsifier, exhibited and resident: the SAME circuit minus its uncompute phase.
    // If this ever reads zero, the zero-garbage property above has stopped measuring
    // anything and is back to being a tautology.
    let fragment = ToffoliGate.modelWeightMulUncomputed 3L 5L
    let initial = fragment.Circuit.Wires
    let withoutUncompute =
        ToffoliGate.run (fragment.ForwardGates @ fragment.CopyOutGates) initial

    ToffoliGate.garbageBitCount initial withoutUncompute fragment.AncillaWires
    |> should be (greaterThan 0)


/// Re-schedule a mutated forward pass through the same compute → copy-out → uncompute
/// shape, so a mutant differs from the real circuit in exactly one place.
let private rescheduled (fragment: UncomputedFragment) (forward: ToffoliGateStep list) =
    ToffoliGate.run
        (forward @ fragment.CopyOutGates @ List.rev forward)
        fragment.Circuit.Wires


[<Fact>]
let ``Dropping one partial-product gate corrupts the product`` () =
    // Second resident falsifier, aimed at the other half of the pair: dropping a gate
    // from BOTH passes keeps the ancilla clean (the schedule still closes) but the copied
    // result is wrong. Garbage-alone would not catch it; the product oracle does.
    //
    // The gate dropped is the first Peres chain's partial-product Toffoli, chosen because
    // it demonstrably fires for 3 × 5. Note what this cost to learn: the first attempt
    // dropped the LAST forward gate, and the test failed — that gate routes a zero carry
    // into a zero top column, so removing it changes nothing. A mutant that a correct
    // circuit is allowed to survive is not evidence, so it was replaced rather than
    // accommodated.
    let fragment = ToffoliGate.modelWeightMulUncomputed 3L 5L
    let dropped = fragment.Source.PeresChains |> List.head |> List.head
    let mutatedForward = fragment.ForwardGates |> List.filter (fun g -> g <> dropped)
    List.length mutatedForward |> should equal (List.length fragment.ForwardGates - 1)

    let final = rescheduled fragment mutatedForward
    let _, expectedMagnitude = ToffoliGate.expectedProductBits 3L 5L

    ToffoliGate.garbageBitCount fragment.Circuit.Wires final fragment.AncillaWires
    |> should equal 0

    (fragment.OutputMagnitudeWires |> List.map (fun w -> final.[w]))
    |> should not' (equal expectedMagnitude)


[<Fact>]
let ``Inverting a Toffoli control corrupts the product`` () =
    // Third resident falsifier. Rewiring one control to the constant-one wire makes that
    // gate fire when it should not. The schedule still closes (garbage stays zero), so
    // only the product oracle catches it.
    //
    // The victim is chosen by SEARCH, not by index: the first partial-product gate whose
    // controls are not already both One. Rewiring a gate that was firing anyway is an
    // inert mutant — the first attempt here picked one, and the test correctly refused it.
    let fragment = ToffoliGate.modelWeightMulUncomputed 3L 5L
    let initial = fragment.Circuit.Wires
    let victim =
        fragment.Source.PeresChains
        |> List.map List.head
        |> List.find (fun g -> initial.[g.ControlA] = One && initial.[g.ControlB] = Zero)

    let mutatedForward =
        fragment.ForwardGates
        |> List.map (fun g ->
            if g = victim then { g with ControlB = fragment.Source.ConstantOneWire } else g)

    let final = rescheduled fragment mutatedForward
    let _, expectedMagnitude = ToffoliGate.expectedProductBits 3L 5L

    ToffoliGate.garbageBitCount fragment.Circuit.Wires final fragment.AncillaWires
    |> should equal 0

    (fragment.OutputMagnitudeWires |> List.map (fun w -> final.[w]))
    |> should not' (equal expectedMagnitude)


[<Fact>]
let ``Leaving one ancilla dirty drives Landauer garbage positive`` () =
    // Fourth resident falsifier, aimed back at the garbage half of the pair: the product
    // is computed and copied correctly, and a single ancilla is left flipped. The output
    // oracle is satisfied; the garbage count is what refuses it.
    let fragment = ToffoliGate.modelWeightMulUncomputed 3L 5L
    let dirtied = fragment.Source.IntermediateWires |> List.head
    let flip =
        { ControlA = fragment.Source.ConstantOneWire
          ControlB = fragment.Source.ConstantOneWire
          Target = dirtied }

    let final = ToffoliGate.run (fragment.Circuit.Gates @ [ flip ]) fragment.Circuit.Wires
    let expectedSign, expectedMagnitude = ToffoliGate.expectedProductBits 3L 5L

    final.[fragment.OutputSignWire] |> should equal expectedSign
    (fragment.OutputMagnitudeWires |> List.map (fun w -> final.[w]))
    |> should equal expectedMagnitude

    ToffoliGate.garbageBitCount fragment.Circuit.Wires final fragment.AncillaWires
    |> should equal 1


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Bennett-scheduled join circuit returns every ancilla wire to its allocation value``
    (a: ZSet<int>)
    (b: ZSet<int>)
    =
    let join = ToffoliGate.modelJoinCircuitUncomputed a b
    let initial = join.Circuit.Wires
    let final = ToffoliGate.run join.Circuit.Gates initial

    ToffoliGate.garbageBitCount initial final join.AncillaWires = 0


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<SmallZSetArb> |], MaxTest = 64)>]
let ``Bennett-scheduled join circuit lands the exact product on every output register``
    (a: ZSet<int>)
    (b: ZSet<int>)
    =
    let join = ToffoliGate.modelJoinCircuitUncomputed a b
    let final = ToffoliGate.run join.Circuit.Gates join.Circuit.Wires

    join.Outputs
    |> List.forall (fun (signWire, magnitudeWires, left, right) ->
        let expectedSign, expectedMagnitude = ToffoliGate.expectedProductBits left right
        final.[signWire] = expectedSign
        && (magnitudeWires |> List.map (fun w -> final.[w])) = expectedMagnitude)
