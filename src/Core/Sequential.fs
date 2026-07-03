namespace Zeta.Core

/// **Sequential — Column B, rung 3: clocked state (flip-flops), so a circuit evolves over cycles.**
/// (Aaron 2026-07-03: "next please continue building column b" → the sequential-logic rung, the fork
/// held until now.) The combinational netlist (`Netlist`) computes outputs from inputs *once*. Real
/// hardware — and any program with a loop — needs **state that persists across clock cycles**. This
/// is the minimal honest model: a **combinational core** whose designated output wires **feed back**
/// into designated state-input wires at each clock edge (the flip-flops), plus an initial state and a
/// `run` loop that clocks it.
///
/// A `SeqCircuit` is `DynamicValue` like everything else:
///   { core: <combinational circuit>, feedback: [{from: outWire, to: stateWire}], init: [{w, b}] }
///
/// `run seqc external cycles` threads state: each cycle it evaluates the core on (external inputs ∪
/// current state), then latches the `from` outputs into the `to` state wires. This is what lets
/// control flow / full (non-straight-line) programs synthesize later — the state machine steps. This
/// rung proves the primitive with a **counter** (`next = state + 1`) and an **accumulator**
/// (`next = state + x`): state persisting and evolving purely through gates + clocked feedback.
///
/// Anchors: Huffman / Mealy / Moore (finite-state machines, 1954–56); the D flip-flop (clocked
/// state); Lava/Chisel (sequential circuits as generated data). Built on `Netlist`.
[<RequireQualifiedAccess>]
module Sequential =

    // ── constructors ──

    /// Build a sequential circuit from a combinational `core`, a feedback map (`outWire → stateWire`),
    /// and the initial state (state-wire → bit).
    let seqCircuit (core: DynamicValue) (feedback: (string * string) list) (init: Map<string, int>) : DynamicValue =
        DynamicValue.Object
            [ "core", core
              "feedback", DynamicValue.Array [ for (f, t) in feedback -> DynamicValue.Object [ "from", DynamicValue.String f; "to", DynamicValue.String t ] ]
              "init", DynamicValue.Array [ for KeyValue(w, b) in init -> DynamicValue.Object [ "w", DynamicValue.String w; "b", DynamicValue.Int(int64 (b &&& 1)) ] ] ]

    // ── the clock ──

    /// Clock a sequential circuit for `cycles` steps with fixed external inputs. Returns the final
    /// state (state-wire → bit). Each cycle: evaluate the core on (external ∪ state), latch the
    /// feedback outputs into the state wires.
    let run (seqc: DynamicValue) (external: Map<string, int>) (cycles: int) : Result<Map<string, int>, string> =
        match DynamicValue.get "core" seqc with
        | None -> Error "sequential: no core"
        | Some core ->
            let feedback =
                match DynamicValue.get "feedback" seqc with
                | Some(DynamicValue.Array xs) ->
                    xs
                    |> List.choose (fun o ->
                        match DynamicValue.get "from" o, DynamicValue.get "to" o with
                        | Some(DynamicValue.String f), Some(DynamicValue.String t) -> Some(f, t)
                        | _ -> None)
                | _ -> []
            let init =
                match DynamicValue.get "init" seqc with
                | Some(DynamicValue.Array xs) ->
                    xs
                    |> List.choose (fun o ->
                        match DynamicValue.get "w" o, DynamicValue.get "b" o with
                        | Some(DynamicValue.String w), Some(DynamicValue.Int b) -> Some(w, int b)
                        | _ -> None)
                    |> Map.ofList
                | _ -> Map.empty

            let rec loop (state: Map<string, int>) (k: int) : Result<Map<string, int>, string> =
                if k <= 0 then
                    Ok state
                else
                    let inputs = Map.fold (fun m kk v -> Map.add kk v m) external state
                    match Netlist.eval core inputs with
                    | Ok outs ->
                        let next =
                            feedback
                            |> List.map (fun (f, t) -> t, (Map.tryFind f outs |> Option.defaultValue 0))
                            |> Map.ofList
                        loop next (k - 1)
                    | Error e -> Error e

            loop init cycles

    // ── example sequential circuits (the primitive, demonstrated) ──

    // a ripple-carry adder over explicit wire-name functions → sum wire names, appended to `gates`.
    let private emitAdd (gates: System.Collections.Generic.List<DynamicValue>) (n: int) (aw: int -> string) (bw: int -> string) (sw: int -> string) =
        let carry i = sprintf "car%d" i
        let axb i = sprintf "cax%d" i
        let aab i = sprintf "caa%d" i
        let cnd i = sprintf "ccn%d" i
        for i in 0 .. n - 1 do
            if i = 0 then
                gates.Add(Netlist.xorG (sw 0) (aw 0) (bw 0))
                gates.Add(Netlist.andG (carry 1) (aw 0) (bw 0))
            else
                gates.Add(Netlist.xorG (axb i) (aw i) (bw i))
                gates.Add(Netlist.xorG (sw i) (axb i) (carry i))
                gates.Add(Netlist.andG (aab i) (aw i) (bw i))
                gates.Add(Netlist.andG (cnd i) (carry i) (axb i))
                gates.Add(Netlist.orG (carry (i + 1)) (aab i) (cnd i))

    /// An `n`-bit counter: state `q` increments by 1 each clock. `run (counter n) Map.empty k` ⇒
    /// state `q = k mod 2^n`. The `+1` constant is derived from a state wire (no external inputs).
    let counter (n: int) : DynamicValue =
        let q i = sprintf "q%d" i
        let s i = sprintf "s%d" i
        let gates = System.Collections.Generic.List<DynamicValue>()
        gates.Add(Netlist.xorG "const0" (q 0) (q 0)) // 0
        gates.Add(Netlist.notG "const1" "const0") // 1
        let bw i = if i = 0 then "const1" else "const0" // the increment value = 1
        emitAdd gates n q bw s
        let core = Netlist.circuit [ for i in 0 .. n - 1 -> q i ] [ for i in 0 .. n - 1 -> s i ] (List.ofSeq gates)
        let feedback = [ for i in 0 .. n - 1 -> s i, q i ]
        let init = [ for i in 0 .. n - 1 -> q i, 0 ] |> Map.ofList
        seqCircuit core feedback init

    /// An `n`-bit accumulator: state `q += x` each clock, where `x0..x{n-1}` is a fixed external
    /// input. `run (accumulator n) (x bits) k` ⇒ `q = k*x mod 2^n`.
    let accumulator (n: int) : DynamicValue =
        let q i = sprintf "q%d" i
        let x i = sprintf "x%d" i
        let s i = sprintf "s%d" i
        let gates = System.Collections.Generic.List<DynamicValue>()
        emitAdd gates n q x s
        let core = Netlist.circuit (([ for i in 0 .. n - 1 -> q i ]) @ ([ for i in 0 .. n - 1 -> x i ])) [ for i in 0 .. n - 1 -> s i ] (List.ofSeq gates)
        let feedback = [ for i in 0 .. n - 1 -> s i, q i ]
        let init = [ for i in 0 .. n - 1 -> q i, 0 ] |> Map.ofList
        seqCircuit core feedback init
