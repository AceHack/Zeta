namespace Zeta.Core

/// Toffoli gate type model — Z-set encoding for reversible computing.
///
/// The Toffoli gate (a, b, c) → (a, b, c ⊕ (a ∧ b)) is the canonical
/// universal reversible gate. It is self-inverse: applying it twice
/// returns the original input. No bits are erased.
///
/// Z-set assert (+1) maps to Toffoli forward; retract (-1) maps to
/// Toffoli reverse — which is identical to forward (self-inverse).
/// This is the bit-level realisation of the Landauer bridge established
/// in docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md.
///
/// 081KR50HA0008QG0R0021B5J87: smallest safe slice — pure F# type model, no FPGA required.
[<Struct>]
type Bit =
    | Zero
    | One


/// The three-wire state of a Toffoli gate.
[<Struct>]
type ToffoliWires = { A: Bit; B: Bit; C: Bit }


/// A Z-set operation expressible as a Toffoli gate application.
[<Struct>]
type ZSetGateOp =
    | Assert   // +1: add one unit of information
    | Retract  // -1: recover one unit of information


// ── Wire-map formal model (081KRA5AR0008QG0R002X77BEB) ──────────────────────────────────────
//
// A Toffoli circuit is a gate network over named wires. Each wire has an
// integer index (WireId) and carries a Bit value. A circuit step is a
// single Toffoli gate application that references three wire indices;
// the circuit itself is a sequence of steps plus the current wire state.
//
// Invariants:
//   - Every WireId in ToffoliGateStep.ControlA / ControlB / Target must
//     exist as a key in ToffoliCircuit.Wires.
//   - ToffoliCircuit.Ancilla >= 0.
//   - Ancilla records the allocated wire capacity for this closed model.
//     Wire indices occupy 0 .. Ancilla-1 by convention.
//   - No bit erasure: the retained wires carry the inverse function, so the
//     circuit is reversible over its full wire set. ("Ancilla" names the
//     total allocated capacity here, not a helper-wire subset.)

/// Integer index identifying a wire in a ToffoliCircuit.
type WireId = int

/// State of all wires in a circuit at a given point in execution.
/// Maps each wire index to its current Bit value.
type WireMap = Map<WireId, Bit>

/// A single Toffoli gate application, identified by wire indices.
///
/// Semantics: Wires[Target] ← Wires[Target] ⊕ (Wires[ControlA] ∧ Wires[ControlB]).
/// ControlA and ControlB wires are read-only in this step.
[<Struct>]
type ToffoliGateStep = {
    ControlA : WireId
    ControlB : WireId
    Target   : WireId
}

/// A Toffoli gate network (081KRA5AR0008QG0R002X77BEB formal model).
///
/// Gates:   ordered sequence of gate applications (wire-index based).
/// Wires:   current bit state of every named wire.
/// Ancilla: allocated wire capacity for this closed reversible circuit.
///          By convention, wire indices occupy 0 .. Ancilla-1. The
///          retained wires carry the inverse function — no bits are erased
///          when the circuit runs.
type ToffoliCircuit = {
    Gates   : ToffoliGateStep list
    Wires   : WireMap
    Ancilla : int
}

/// A bounded Toffoli sub-circuit with named wire groups.
///
/// 081KRA5AR0008QG0R001GQSVWE uses this fragment shape for one reversible join-weight
/// multiplication primitive. The circuit keeps the encoded inputs,
/// product target wires, and all partial-product/carry wires reachable
/// so exact reversal never depends on erased intermediates.
type ToffoliCircuitFragment = {
    Circuit               : ToffoliCircuit
    ConstantOneWire       : WireId
    LeftSignWire          : WireId
    LeftMagnitudeWires    : WireId list
    RightSignWire         : WireId
    RightMagnitudeWires   : WireId list
    ProductSignWire       : WireId
    ProductMagnitudeWires : WireId list
    IntermediateWires     : WireId list
    CarryWires            : WireId list
    PeresChains           : ToffoliGateStep list list
}


[<RequireQualifiedAccess>]
module ToffoliGate =

    let private signBit (w: Weight) : Bit =
        if w < 0L then One else Zero

    let private magnitude (w: Weight) : uint64 =
        if w < 0L then uint64 (~~~w) + 1UL else uint64 w

    let private magnitudeBitWidth (m: uint64) : int =
        let rec loop width value =
            if value = 0UL then max 1 width
            else loop (width + 1) (value >>> 1)

        loop 0 m

    let private magnitudeBits (width: int) (m: uint64) : Bit list =
        [ for bit in 0 .. width - 1 do
            if ((m >>> bit) &&& 1UL) = 1UL then One else Zero ]

    /// The Toffoli gate: (a, b, c) → (a, b, c ⊕ (a ∧ b)).
    ///
    /// Properties (all proved in ToffoliGate.Laws.Tests.fs):
    ///   - Self-inverse: apply gate (apply gate x) = x
    ///   - Bit-conservative: output has exactly 3 wires (same as input)
    ///   - Universal: can simulate any reversible boolean circuit
    let apply (w: ToffoliWires) : ToffoliWires =
        let control = w.A = One && w.B = One
        let c' = if control then (if w.C = Zero then One else Zero) else w.C
        { w with C = c' }

    /// Encode a Z-set operation as a Toffoli gate application.
    ///
    /// Assert and Retract both map to the same Toffoli forward application —
    /// the self-inverse property makes them indistinguishable at the gate
    /// level, which is exactly what the Landauer bridge requires:
    /// neither operation erases information.
    let encode (op: ZSetGateOp) (w: ToffoliWires) : ToffoliWires =
        match op with
        | Assert  -> apply w
        | Retract -> apply w  // same gate — self-inverse makes retract = apply once more

    /// Assert followed immediately by Retract returns the original wire state.
    ///
    /// This is the gate-level proof of Z-set's assert-retract identity:
    ///   w = Retract (Assert w)
    let assertThenRetract (w: ToffoliWires) : ToffoliWires =
        w |> encode Assert |> encode Retract

    /// Empty circuit: no gate steps, no wires initialised, zero ancilla.
    ///
    /// Use as the base for circuit construction. Satisfies all ToffoliCircuit
    /// invariants trivially — empty gate list implies no WireId constraints.
    let emptyCircuit : ToffoliCircuit =
        { Gates = []; Wires = Map.empty; Ancilla = 0 }

    /// Model one reversible Z-set join weight multiplication fragment.
    ///
    /// Signed weights are encoded as sign plus little-endian magnitude
    /// bits. A constant-one helper turns Toffoli into CNOT where the
    /// fragment needs XOR-style sign/product wiring. Each magnitude bit
    /// pair emits a Peres-shaped chain:
    ///
    ///   1. compute and retain the partial product,
    ///   2. route it into the matching product column,
    ///   3. retain the column carry dependency for reversal.
    ///
    /// Carries can advance into the final high product column, so the
    /// fragment retains leftWidth + rightWidth product magnitude wires even
    /// though no partial product starts in the high column. Product sign
    /// gates are emitted only for nonzero products, keeping zero products in
    /// canonical signed-magnitude form.
    ///
    /// Modeled domain: this fragment encodes the exact mathematical product
    /// in leftWidth + rightWidth signed-magnitude bits. The Z-set join weight
    /// product (ZSet.cartesian / ZSet.join / IndexedZSet.join) multiplies with
    /// Checked.(*), which throws on int64 overflow; reconciling this fragment's
    /// unbounded product with that checked semantics (an overflow/error wire or
    /// a bounded-domain law) is deferred to 081KRA5AR0008QG0R000CYY9ZN.
    ///
    /// This is intentionally the core multiplication primitive only;
    /// 081KRA5AR0008QG0R000CYY9ZN layers laws over the fragment before full join(A,B).
    let modelWeightMul (left: Weight) (right: Weight) : ToffoliCircuitFragment =
        let leftMagnitude = magnitude left
        let rightMagnitude = magnitude right
        let leftWidth = magnitudeBitWidth leftMagnitude
        let rightWidth = magnitudeBitWidth rightMagnitude
        let productWidth = leftWidth + rightWidth
        let partialCount = leftWidth * rightWidth
        let productIsZero = leftMagnitude = 0UL || rightMagnitude = 0UL

        let mutable nextWire = 0
        let mutable wireValues = []

        let takeWire value =
            let wire = nextWire
            nextWire <- nextWire + 1
            wireValues <- (wire, value) :: wireValues
            wire

        let takeZero () = takeWire Zero

        let takeWires values =
            values |> List.map takeWire

        let leftBits = magnitudeBits leftWidth leftMagnitude
        let rightBits = magnitudeBits rightWidth rightMagnitude

        let constantOneWire = takeWire One
        let leftSignWire = takeWire (signBit left)
        let leftMagnitudeWires = takeWires leftBits
        let rightSignWire = takeWire (signBit right)
        let rightMagnitudeWires = takeWires rightBits
        let productSignWire = takeZero ()
        let productMagnitudeWires = takeWires (List.replicate productWidth Zero)
        let intermediateWires = takeWires (List.replicate partialCount Zero)
        let carryWires = ResizeArray<WireId>()

        let addBitToProductColumn (sourceWire: WireId) (column: int) : ToffoliGateStep list =
            let rec loop currentSource currentColumn acc =
                if currentColumn >= productWidth then
                    List.rev acc
                else
                    let productWire = productMagnitudeWires.[currentColumn]
                    let carryWire = takeZero ()
                    carryWires.Add carryWire

                    let carryStep = {
                        ControlA = currentSource
                        ControlB = productWire
                        Target = carryWire
                    }

                    let routeStep = {
                        ControlA = currentSource
                        ControlB = constantOneWire
                        Target = productWire
                    }

                    loop carryWire (currentColumn + 1) (routeStep :: carryStep :: acc)

            loop sourceWire column []

        let indexedBitPairs =
            [ for leftIndex, leftWire in List.indexed leftMagnitudeWires do
                for rightIndex, rightWire in List.indexed rightMagnitudeWires do
                    yield leftIndex, rightIndex, leftWire, rightWire ]

        let peresChains =
            indexedBitPairs
            |> List.mapi (fun index (leftIndex, rightIndex, leftWire, rightWire) ->
                let partialWire = intermediateWires.[index]
                let productColumn = leftIndex + rightIndex

                [ { ControlA = leftWire
                    ControlB = rightWire
                    Target = partialWire } ]
                @ addBitToProductColumn partialWire productColumn)

        let signGates =
            if productIsZero then
                []
            else
                [ { ControlA = leftSignWire
                    ControlB = constantOneWire
                    Target = productSignWire }
                  { ControlA = rightSignWire
                    ControlB = constantOneWire
                    Target = productSignWire } ]

        let circuit =
            { Gates = signGates @ List.collect id peresChains
              Wires = wireValues |> List.rev |> Map.ofList
              Ancilla = nextWire }

        { Circuit = circuit
          ConstantOneWire = constantOneWire
          LeftSignWire = leftSignWire
          LeftMagnitudeWires = leftMagnitudeWires
          RightSignWire = rightSignWire
          RightMagnitudeWires = rightMagnitudeWires
          ProductSignWire = productSignWire
          ProductMagnitudeWires = productMagnitudeWires
          IntermediateWires = intermediateWires
          CarryWires = carryWires |> Seq.toList
          PeresChains = peresChains }

    /// Model a Z-set join as a Toffoli-gate network.
    ///
    /// The join of two Z-sets A and B on equal keys computes:
    ///   join(A, B) = { (key) -> w_A(key) * w_B(key) }
    ///
    /// For each key present in both A and B, we allocate a weight multiplication
    /// fragment using `modelWeightMul w_A w_B`.
    ///
    /// Wires from different fragments are mapped to disjoint global wire IDs.
    /// The total Ancilla capacity of the circuit is the sum of the capacities of all fragments.
    let modelJoinCircuit<'K when 'K : comparison> (a: ZSet<'K>) (b: ZSet<'K>) : ToffoliCircuit =
        let sa = a.AsSpan()
        let sb = b.AsSpan()
        if sa.IsEmpty || sb.IsEmpty then
            emptyCircuit
        else
            let cmp = KeyComparerCache<'K>.Instance
            let mutable i = 0
            let mutable j = 0
            let fragments = ResizeArray<ToffoliCircuitFragment>()
            while i < sa.Length && j < sb.Length do
                let c = cmp.Compare(sa.[i].Key, sb.[j].Key)
                if c < 0 then
                    i <- i + 1
                elif c > 0 then
                    j <- j + 1
                else
                    let wA = sa.[i].Weight
                    let wB = sb.[j].Weight
                    let frag = modelWeightMul wA wB
                    fragments.Add frag
                    i <- i + 1
                    j <- j + 1

            if fragments.Count = 0 then
                emptyCircuit
            else
                let mutable globalGates = []
                let mutable globalWires = Map.empty
                let mutable offset = 0

                for frag in fragments do
                    // Shift the gate wire IDs
                    let shiftedGates =
                        frag.Circuit.Gates
                        |> List.map (fun step ->
                            { ControlA = step.ControlA + offset
                              ControlB = step.ControlB + offset
                              Target = step.Target + offset })

                    // Shift the wire map keys
                    let shiftedWires =
                        frag.Circuit.Wires
                        |> Map.toSeq
                        |> Seq.map (fun (wireId, bitValue) -> (wireId + offset, bitValue))
                        |> Map.ofSeq

                    globalGates <- globalGates @ shiftedGates

                    // Merge wires
                    for KeyValue(wireId, bitValue) in shiftedWires do
                        globalWires <- Map.add wireId bitValue globalWires

                    offset <- offset + frag.Circuit.Ancilla

                { Gates = globalGates
                  Wires = globalWires
                  Ancilla = offset }
