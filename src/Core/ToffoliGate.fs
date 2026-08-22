namespace Zeta.Core

/// Toffoli gate type model — Z-set encoding for reversible computing.
///
/// The Toffoli gate (a, b, c) → (a, b, c ⊕ (a ∧ b)) is the canonical
/// universal reversible gate. It is self-inverse: applying it twice
/// returns the original input, so it erases nothing internally — which is
/// true of every reversible gate and is therefore not a claim about
/// dissipation. That claim lives at the boundary: see `garbageBitCount`.
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
//   - The retained wires carry the inverse function, so the circuit is
//     reversible over its full wire set. ("Ancilla" names the total allocated
//     capacity here, not a helper-wire subset.)
//   - This says NOTHING about erasure cost. A reversible network erases nothing
//     internally by construction; what Landauer prices is ancilla left dirty at
//     the boundary. See the garbage-accounting note below and, for the reason
//     this correction exists, 081M05M1R97087G0R0023Z4F9D.

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
///          By convention, wire indices occupy 0 .. Ancilla-1. This is a
///          CAPACITY, not a garbage count, and it is not evidence of anything:
///          it is set to the allocator's wire counter, so `Ancilla = Wires.Count`
///          is a restatement of construction, not a property. For the quantity
///          Landauer's principle actually prices, see `garbageBitCount`.
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


// ── Landauer garbage accounting (081M05M1R97087G0R0023Z4F9D) ────────────────────────────────
//
// WHAT ERASURE MEANS HERE, and what it does not.
//
// A reversible gate network erases nothing *internally* — that is true by construction
// (a bijection destroys no information) and it is therefore not a measurable property:
// any assertion of the form "this Toffoli network erased no bits while running" holds for
// every possible gate list and cannot fail. Counting wire ids that disappear from the wire
// map is the same non-property wearing a data-structure costume: the interpreter's
// `Map.add` never removes a key, so the count is identically zero.
//
// The quantity Landauer's principle actually prices sits at the circuit's BOUNDARY, not
// inside it. Helper (ancilla) wires are allocated in a KNOWN state. To run the next
// operation on the same hardware those wires must be returned to that known state, and
// resetting a wire whose value is unknown is a logically irreversible erasure costing
// kT·ln2 each (Landauer 1961). Bennett's compute → copy-out → uncompute schedule
// (Bennett 1973, 1989) exists precisely to drive that count to zero.
//
// So, operationally:
//
//     garbage(C) = | { w ∈ Ancilla(C) : final(w) ≠ initial(w) } |
//
// measured after the circuit's FULL schedule has run, over the wires designated ancilla —
// excluding the caller's input wires (retained, not erased) and the output register
// (carried away, not erased). This has real falsifiers: skip the uncompute pass, drop a
// gate, invert a control, or leave one ancilla dirty and the count goes positive.
//
// Consequence, stated plainly: `modelWeightMul` is a KEEP-ALL-GARBAGE circuit. It has no
// uncompute pass, so under this definition its garbage is LARGE, not zero — every partial
// product and every carry ends dirty. `modelWeightMulUncomputed` is the Bennett-scheduled
// variant, and it is the one for which zero garbage is a claim with evidence behind it.

/// A Bennett-scheduled fragment: compute → copy the result out → uncompute.
///
/// The three gate phases are kept separate so a test can mutate one of them
/// (skip the uncompute pass; drop a gate) and observe the garbage count move.
///
/// InputWires   — the caller's operands. Read-only; retained, never erased.
/// OutputWires  — a fresh register receiving a copy of the result. Carried away.
/// AncillaWires — every helper allocated at a known constant, INCLUDING the in-circuit
///                product wires: after copy-out they are uncomputed back to their
///                allocation value, which is the whole point of the schedule.
type UncomputedFragment = {
    Circuit               : ToffoliCircuit
    Source                : ToffoliCircuitFragment
    InputWires            : WireId list
    OutputSignWire        : WireId
    OutputMagnitudeWires  : WireId list
    AncillaWires          : WireId list
    ForwardGates          : ToffoliGateStep list
    CopyOutGates          : ToffoliGateStep list
    UncomputeGates        : ToffoliGateStep list
}

/// A Z-set join circuit assembled from Bennett-scheduled fragments at disjoint
/// wire offsets. Carries the wire roles the bare `ToffoliCircuit` cannot express,
/// which is what makes a garbage count possible at all.
type UncomputedJoinCircuit = {
    Circuit      : ToffoliCircuit
    InputWires   : WireId list
    OutputWires  : WireId list
    AncillaWires : WireId list
    /// Per matched key: the offset-shifted output register plus the two operands,
    /// so a test can compute the expected product independently of the circuit.
    Outputs      : (WireId * WireId list * Weight * Weight) list
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

    // ── Interpreter + Landauer garbage accounting (081M05M1R97087G0R0023Z4F9D) ──────────

    /// Apply one Toffoli step to a wire map:
    ///   Wires[Target] ← Wires[Target] ⊕ (Wires[ControlA] ∧ Wires[ControlB]).
    ///
    /// Deliberately TOTAL-ON-VALID-INPUT ONLY: a step naming a wire that was never
    /// allocated raises rather than silently defaulting the missing wire to Zero. A
    /// dangling wire reference is a malformed circuit, and a model that quietly invents
    /// a value for it would hide exactly the class of defect these laws exist to catch.
    let step (wires: WireMap) (s: ToffoliGateStep) : WireMap =
        let target =
            if wires.[s.ControlA] = One && wires.[s.ControlB] = One then
                match wires.[s.Target] with
                | Zero -> One
                | One -> Zero
            else
                wires.[s.Target]

        wires |> Map.add s.Target target

    /// Run a gate sequence over a wire map.
    let run (gates: ToffoliGateStep list) (wires: WireMap) : WireMap =
        gates |> List.fold step wires

    /// The wires Landauer's principle prices: ancilla NOT returned to their
    /// allocation value. See the type-level note above `UncomputedFragment`.
    ///
    /// This is a boundary measurement, not an internal one. It says nothing about
    /// whether the network is a bijection (it always is); it says how many known-state
    /// helper wires ended dirty and would have to be dissipated to reuse the hardware.
    let garbageWires (initial: WireMap) (final: WireMap) (ancilla: WireId list) : WireId list =
        ancilla |> List.filter (fun w -> final.[w] <> initial.[w])

    /// Count of ancilla wires that did not return to their allocation value.
    /// Zero is the Bennett-clean result; anything else is bits that must be erased.
    let garbageBitCount (initial: WireMap) (final: WireMap) (ancilla: WireId list) : int =
        garbageWires initial final ancilla |> List.length

    /// The ancilla of a keep-all-garbage fragment: every helper wire allocated at a
    /// known constant that is not one of the caller's operands.
    ///
    /// The product wires are NOT counted here because `modelWeightMul` has no
    /// copy-out — in that circuit the product wires are the output register. In the
    /// Bennett-scheduled variant they become ancilla, which is the difference the
    /// schedule buys.
    let keepAllAncillaWires (fragment: ToffoliCircuitFragment) : WireId list =
        (fragment.ConstantOneWire :: fragment.IntermediateWires) @ fragment.CarryWires

    /// The caller's operand wires — retained by the circuit, never erased.
    let operandWires (fragment: ToffoliCircuitFragment) : WireId list =
        (fragment.LeftSignWire :: fragment.LeftMagnitudeWires)
        @ (fragment.RightSignWire :: fragment.RightMagnitudeWires)

    /// Bennett-schedule a weight-multiplication fragment: compute → copy out → uncompute.
    ///
    /// A fresh output register (sign + 2W magnitude wires, all allocated Zero) receives a
    /// copy of the product via CNOTs — realised as Toffoli gates with the fragment's
    /// constant-one wire as the second control, which is how this model already spells
    /// CNOT. The output register is touched by no forward gate, so running the forward
    /// gates in reverse afterwards restores every other wire exactly: each step is an
    /// involution (no step targets one of its own controls), and the reverse-order
    /// composition of involutions is the inverse.
    ///
    /// Result: the product leaves on the output register and every ancilla returns to its
    /// allocation value — Landauer garbage zero, at 2× the gate count. That factor of two
    /// is the honest price of the schedule and is not an implementation inefficiency.
    ///
    /// Anchor: Bennett, "Logical Reversibility of Computation", IBM J. Res. Dev. 17(6),
    /// 1973; and "Time/Space Trade-offs for Reversible Computation", SIAM J. Comput.
    /// 18(4), 1989 for the space-time tradeoff this schedule sits at one end of.
    let modelWeightMulUncomputed (left: Weight) (right: Weight) : UncomputedFragment =
        let fragment = modelWeightMul left right
        let baseCircuit = fragment.Circuit
        let outputSignWire = baseCircuit.Ancilla
        let outputMagnitudeWires =
            fragment.ProductMagnitudeWires
            |> List.mapi (fun index _ -> baseCircuit.Ancilla + 1 + index)

        let outputWires = outputSignWire :: outputMagnitudeWires

        let wires =
            outputWires
            |> List.fold (fun (m: WireMap) w -> Map.add w Zero m) baseCircuit.Wires

        let forwardGates = baseCircuit.Gates

        let copyOutGates =
            { ControlA = fragment.ProductSignWire
              ControlB = fragment.ConstantOneWire
              Target = outputSignWire }
            :: List.map2
                (fun productWire outputWire ->
                    { ControlA = productWire
                      ControlB = fragment.ConstantOneWire
                      Target = outputWire })
                fragment.ProductMagnitudeWires
                outputMagnitudeWires

        let uncomputeGates = List.rev forwardGates

        let ancillaWires =
            keepAllAncillaWires fragment
            @ (fragment.ProductSignWire :: fragment.ProductMagnitudeWires)

        { Circuit =
            { Gates = forwardGates @ copyOutGates @ uncomputeGates
              Wires = wires
              Ancilla = baseCircuit.Ancilla + List.length outputWires }
          Source = fragment
          InputWires = operandWires fragment
          OutputSignWire = outputSignWire
          OutputMagnitudeWires = outputMagnitudeWires
          AncillaWires = ancillaWires
          ForwardGates = forwardGates
          CopyOutGates = copyOutGates
          UncomputeGates = uncomputeGates }

    /// Bennett-schedule a whole Z-set join: one uncomputed multiplication fragment per
    /// matched key, at disjoint wire offsets.
    ///
    /// This is the shape the closed row 081KRA5AR0008QG0R000CYY9ZN's "0 erased bits"
    /// criterion was reaching for. The bare `modelJoinCircuit` cannot support that
    /// criterion at all — it carries no wire-role information, so there is nothing to
    /// count against.
    let modelJoinCircuitUncomputed<'K when 'K : comparison>
        (a: ZSet<'K>)
        (b: ZSet<'K>)
        : UncomputedJoinCircuit =
        let sa = a.AsSpan()
        let sb = b.AsSpan()
        let pairs = ResizeArray<Weight * Weight>()

        if not (sa.IsEmpty || sb.IsEmpty) then
            let cmp = KeyComparerCache<'K>.Instance
            let mutable i = 0
            let mutable j = 0
            while i < sa.Length && j < sb.Length do
                let c = cmp.Compare(sa.[i].Key, sb.[j].Key)
                if c < 0 then i <- i + 1
                elif c > 0 then j <- j + 1
                else
                    pairs.Add(sa.[i].Weight, sb.[j].Weight)
                    i <- i + 1
                    j <- j + 1

        let shift offset (s: ToffoliGateStep) =
            { ControlA = s.ControlA + offset
              ControlB = s.ControlB + offset
              Target = s.Target + offset }

        let mutable gates = []
        let mutable wires : WireMap = Map.empty
        let mutable inputs = []
        let mutable outputs = []
        let mutable ancilla = []
        let mutable outputGroups = []
        let mutable offset = 0

        for (wA, wB) in pairs do
            let fragment = modelWeightMulUncomputed wA wB
            let o = offset
            gates <- gates @ (fragment.Circuit.Gates |> List.map (shift o))
            for KeyValue(wireId, value) in fragment.Circuit.Wires do
                wires <- Map.add (wireId + o) value wires
            inputs <- inputs @ (fragment.InputWires |> List.map (fun w -> w + o))
            let shiftedSign = fragment.OutputSignWire + o
            let shiftedMagnitude = fragment.OutputMagnitudeWires |> List.map (fun w -> w + o)
            outputs <- outputs @ (shiftedSign :: shiftedMagnitude)
            outputGroups <- outputGroups @ [ shiftedSign, shiftedMagnitude, wA, wB ]
            ancilla <- ancilla @ (fragment.AncillaWires |> List.map (fun w -> w + o))
            offset <- offset + fragment.Circuit.Ancilla

        { Circuit = { Gates = gates; Wires = wires; Ancilla = offset }
          InputWires = inputs
          OutputWires = outputs
          AncillaWires = ancilla
          Outputs = outputGroups }

    /// The signed-magnitude encoding a correct product must land on the output register:
    /// sign bit, then little-endian magnitude over leftWidth + rightWidth bits.
    ///
    /// Independent of the circuit — computed from the integers directly, so it is a
    /// genuine oracle for the circuit's output rather than a restatement of it.
    let expectedProductBits (left: Weight) (right: Weight) : Bit * Bit list =
        let width = magnitudeBitWidth (magnitude left) + magnitudeBitWidth (magnitude right)
        let product = left * right
        let sign = if product < 0L then One else Zero
        sign, magnitudeBits width (magnitude product)
