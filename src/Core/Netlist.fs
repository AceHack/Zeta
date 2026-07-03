namespace Zeta.Core

/// **Netlist — Column B, rung 1: computation as gates (the residual-target knob, turned to silicon).**
/// (Aaron 2026-07-02: "how do we make this general and intrinsic hardware?" — the two-column ferry
/// named the hardware column as `mix` with a *netlist* residual target. This is its first rung.)
///
/// Column A specialized an ISA interpreter to a program, residualizing to *code* (`DynamicValue`
/// instructions). Column B is the same `mix` residualizing to a *circuit*: a combinational
/// **netlist** of boolean gates. This module is the netlist IR + evaluator + the first lowering —
/// the ISA's byte arithmetic (`ADD`/`ADDR`, mod 256) realized as an 8-bit gate-level adder, proven
/// equal to integer addition **exhaustively** over all 65 536 byte pairs.
///
/// A netlist is `DynamicValue` like everything else — byte-locked, DST-replayable, and generated (not
/// sourced): the same generator that makes our parsers makes the gates, which is the supply-chain
/// closure "down to the gates". Full ISA→circuit synthesis (sequencing, registers as flip-flops) is a
/// further rung; this is the **combinational** core — the irreducible first step into hardware.
///
/// Encoding (all `DynamicValue`; wires are named bits, values ∈ {0,1}):
///   Gate    = {g:"and"|"or"|"xor"|"not", out:wire, in:[wire]}   (not: 1 input; others: 2)
///   Circuit = {inputs:[wire], outputs:[wire], gates:[Gate]}      (gates in topological order)
///
/// Anchors: Shannon (*A Symbolic Analysis of Relay and Switching Circuits*, 1937 — boolean algebra =
/// circuits) · the ripple-carry / full-adder construction (classic) · Lava / Chisel (circuits as
/// generated data) · `generator IS the ECC` (the hardware column of the two-column table). Consumes
/// only `DynamicValue`.
[<RequireQualifiedAccess>]
module Netlist =

    // ── gate / circuit constructors (the netlist as data) ──

    let gate (g: string) (out: string) (ins: string list) =
        DynamicValue.Object [ "g", DynamicValue.String g; "out", DynamicValue.String out; "in", DynamicValue.Array(ins |> List.map DynamicValue.String) ]

    let andG (out: string) (a: string) (b: string) = gate "and" out [ a; b ]
    let orG (out: string) (a: string) (b: string) = gate "or" out [ a; b ]
    let xorG (out: string) (a: string) (b: string) = gate "xor" out [ a; b ]
    let notG (out: string) (a: string) = gate "not" out [ a ]

    let circuit (inputs: string list) (outputs: string list) (gates: DynamicValue list) =
        DynamicValue.Object
            [ "inputs", DynamicValue.Array(inputs |> List.map DynamicValue.String)
              "outputs", DynamicValue.Array(outputs |> List.map DynamicValue.String)
              "gates", DynamicValue.Array gates ]

    // ── the combinational evaluator ──

    let private wireName (dv: DynamicValue) : string option =
        match dv with
        | DynamicValue.String s -> Some s
        | _ -> None

    /// Evaluate a combinational circuit: assign input wires, then compute each gate in listing order
    /// (which must be topological), returning the output wires' bits. Errors on a missing input, a
    /// bad gate, or the wrong fan-in for a gate kind.
    let eval (c: DynamicValue) (inputs: Map<string, int>) : Result<Map<string, int>, string> =
        let vals = System.Collections.Generic.Dictionary<string, int>()
        for KeyValue(k, v) in inputs do
            vals.[k] <- (v &&& 1)

        let readWire (w: string) : Result<int, string> =
            match vals.TryGetValue w with
            | true, v -> Ok v
            | _ -> Error(sprintf "netlist: wire '%s' has no value (input missing or gates out of order)" w)

        let gates =
            match DynamicValue.get "gates" c with
            | Some(DynamicValue.Array gs) -> gs
            | _ -> []

        let mutable err = None
        let mutable rest = gates
        while err.IsNone && not (List.isEmpty rest) do
            let g = List.head rest
            rest <- List.tail rest
            let kind =
                match DynamicValue.get "g" g with
                | Some(DynamicValue.String s) -> s
                | _ -> "?"
            let out =
                match DynamicValue.get "out" g with
                | Some(DynamicValue.String s) -> Some s
                | _ -> None
            let ins =
                match DynamicValue.get "in" g with
                | Some(DynamicValue.Array xs) -> xs |> List.choose wireName
                | _ -> []
            match out with
            | None -> err <- Some "netlist: gate without output wire"
            | Some o ->
                match kind, ins with
                | "not", [ a ] ->
                    match readWire a with
                    | Ok x -> vals.[o] <- 1 - x
                    | Error e -> err <- Some e
                | ("and" | "or" | "xor"), [ a; b ] ->
                    match readWire a, readWire b with
                    | Ok x, Ok y ->
                        vals.[o] <-
                            match kind with
                            | "and" -> if x = 1 && y = 1 then 1 else 0
                            | "or" -> if x = 1 || y = 1 then 1 else 0
                            | _ -> x ^^^ y // xor
                    | Error e, _
                    | _, Error e -> err <- Some e
                | _ -> err <- Some(sprintf "netlist: gate '%s' has wrong fan-in" kind)

        match err with
        | Some e -> Error e
        | None ->
            match DynamicValue.get "outputs" c with
            | Some(DynamicValue.Array outs) ->
                let names = outs |> List.choose wireName
                let mutable acc = Map.empty
                let mutable oerr = None
                for w in names do
                    match readWire w with
                    | Ok v -> acc <- Map.add w v acc
                    | Error e -> oerr <- Some e
                match oerr with
                | Some e -> Error e
                | None -> Ok acc
            | _ -> Error "netlist: circuit has no outputs"

    // ── lowering: an N-bit ripple-carry adder (ISA byte arithmetic as gates) ──

    /// An `n`-bit ripple-carry adder. Inputs `a0..a{n-1}`, `b0..b{n-1}` (bit i, LSB = 0); outputs
    /// `s0..s{n-1}` — the final carry is dropped, so the circuit computes `(a + b) mod 2^n`, exactly
    /// the ISA's register wrap. Gates are emitted bit-by-bit (LSB first) so listing order is
    /// topological. Bit 0 is a half-adder; bits 1.. are full adders threading the carry.
    let adder (n: int) : DynamicValue =
        let a i = sprintf "a%d" i
        let b i = sprintf "b%d" i
        let s i = sprintf "s%d" i
        let carry i = sprintf "c%d" i // c1..c{n}; c0 (carry-in of bit 0) is unused (half-adder)
        let axb i = sprintf "axb%d" i
        let aab i = sprintf "aab%d" i
        let cnd i = sprintf "cnd%d" i
        let gates = System.Collections.Generic.List<DynamicValue>()
        for i in 0 .. n - 1 do
            if i = 0 then
                // half adder: s0 = a0 ^ b0 ; c1 = a0 & b0
                gates.Add(xorG (s 0) (a 0) (b 0))
                gates.Add(andG (carry 1) (a 0) (b 0))
            else
                // full adder: axb = a^b ; s = axb ^ cin ; aab = a&b ; cnd = cin&axb ; cout = aab|cnd
                gates.Add(xorG (axb i) (a i) (b i))
                gates.Add(xorG (s i) (axb i) (carry i))
                gates.Add(andG (aab i) (a i) (b i))
                gates.Add(andG (cnd i) (carry i) (axb i))
                gates.Add(orG (carry (i + 1)) (aab i) (cnd i))
        let inputs = [ for i in 0 .. n - 1 -> a i ] @ [ for i in 0 .. n - 1 -> b i ]
        let outputs = [ for i in 0 .. n - 1 -> s i ]
        circuit inputs outputs (List.ofSeq gates)

    // ── bit <-> int helpers (drive the adder from bytes; read its result back) ──

    /// Map an integer to input-wire bits for prefix `p` (`p0..p{n-1}`, LSB first).
    let bitsOf (prefix: string) (n: int) (value: int) : Map<string, int> =
        [ for i in 0 .. n - 1 -> sprintf "%s%d" prefix i, (value >>> i) &&& 1 ] |> Map.ofList

    /// Read an integer from output-wire bits `s0..s{n-1}` of an eval result.
    let intOf (prefix: string) (n: int) (outs: Map<string, int>) : int =
        [ 0 .. n - 1 ]
        |> List.sumBy (fun i ->
            match Map.tryFind (sprintf "%s%d" prefix i) outs with
            | Some 1 -> 1 <<< i
            | _ -> 0)

    // ── ISA → circuit synthesis (Column B: a whole straight-line program becomes ONE circuit) ──
    //
    // The residual-target knob, fully turned. `synthesize` threads a *symbolic register file* (each
    // of the 16 registers = 8 wires) through a straight-line program, instantiating a sub-circuit
    // per instruction: SET wires to constants, ADD/ADDR to an adder instance, MOV a rewire. The
    // result is a single combinational circuit from the 16 initial register values (inputs) to the
    // 16 final ones (outputs) — the same computation `Isa.eval` does, as gates. Straight-line only
    // (SET/ADD/MOV/ADDR/HALT); control flow (SE/JP) needs sequential logic (a later rung).

    /// Synthesize a straight-line ISA program into one combinational circuit. Returns the circuit and
    /// the per-register output-wire names (`reg → its 8 wires`, LSB first). Inputs are `v{r}_{i}` for
    /// all 16 registers; `eval` on the bit-decomposed initial registers yields the final registers.
    let synthesize (program: DynamicValue) : Result<DynamicValue * Map<int, string list>, string> =
        match program with
        | DynamicValue.Array instrs ->
            let inputWire r i = sprintf "v%d_%d" r i
            let regfile = System.Collections.Generic.Dictionary<int, string list>()
            for r in 0..15 do
                regfile.[r] <- [ for i in 0..7 -> inputWire r i ]
            let gates = System.Collections.Generic.List<DynamicValue>()
            // constants derived from an input wire (no special inputs): const0 = v0_0 XOR v0_0 = 0.
            gates.Add(xorG "const0" (inputWire 0 0) (inputWire 0 0))
            gates.Add(notG "const1" "const0")
            let constBit b = if b = 1 then "const1" else "const0"
            let constWires (nn: int) = [ for i in 0..7 -> constBit ((nn >>> i) &&& 1) ]
            let mutable uid = 0
            // instantiate an 8-bit adder over the given wire lists; returns the 8 sum-wire names.
            let emitAdder (aw: string list) (bw: string list) : string list =
                let p = sprintf "add%d_" uid
                uid <- uid + 1
                let a = List.toArray aw
                let b = List.toArray bw
                let s i = sprintf "%ss%d" p i
                let carry i = sprintf "%sc%d" p i
                let axb i = sprintf "%saxb%d" p i
                let aab i = sprintf "%saab%d" p i
                let cnd i = sprintf "%scnd%d" p i
                for i in 0..7 do
                    if i = 0 then
                        gates.Add(xorG (s 0) a.[0] b.[0])
                        gates.Add(andG (carry 1) a.[0] b.[0])
                    else
                        gates.Add(xorG (axb i) a.[i] b.[i])
                        gates.Add(xorG (s i) (axb i) (carry i))
                        gates.Add(andG (aab i) a.[i] b.[i])
                        gates.Add(andG (cnd i) (carry i) (axb i))
                        gates.Add(orG (carry (i + 1)) (aab i) (cnd i))
                [ for i in 0..7 -> s i ]
            let field k ins =
                match DynamicValue.get k ins with
                | Some(DynamicValue.Int n) -> Some(int n)
                | _ -> None
            let mutable err = None
            for ins in instrs do
                if err.IsNone then
                    let opN =
                        match DynamicValue.get "op" ins with
                        | Some(DynamicValue.String s) -> s
                        | _ -> "?"
                    match opN with
                    | "SET" ->
                        match field "x" ins, field "nn" ins with
                        | Some x, Some nn -> regfile.[x] <- constWires nn
                        | _ -> err <- Some "synthesize: SET operands"
                    | "MOV" ->
                        match field "x" ins, field "y" ins with
                        | Some x, Some y -> regfile.[x] <- regfile.[y]
                        | _ -> err <- Some "synthesize: MOV operands"
                    | "ADD" ->
                        match field "x" ins, field "nn" ins with
                        | Some x, Some nn -> regfile.[x] <- emitAdder regfile.[x] (constWires nn)
                        | _ -> err <- Some "synthesize: ADD operands"
                    | "ADDR" ->
                        match field "x" ins, field "y" ins with
                        | Some x, Some y -> regfile.[x] <- emitAdder regfile.[x] regfile.[y]
                        | _ -> err <- Some "synthesize: ADDR operands"
                    | "HALT" -> ()
                    | other -> err <- Some(sprintf "synthesize: op '%s' not in the straight-line fragment (needs sequential logic)" other)
            match err with
            | Some e -> Error e
            | None ->
                let inputs = [ for r in 0..15 do for i in 0..7 -> inputWire r i ]
                let outMap = [ for r in 0..15 -> r, regfile.[r] ] |> Map.ofList
                let outputs = [ for r in 0..15 do yield! regfile.[r] ]
                Ok(circuit inputs outputs (List.ofSeq gates), outMap)
        | _ -> Error "synthesize: program must be an array of instructions"

    /// Input-wire assignment for `synthesize`: bit-decompose the initial register map into the 128
    /// `v{r}_{i}` input wires (absent registers default 0).
    let regInputs (regs: Map<int, int>) : Map<string, int> =
        [ for r in 0..15 do
              let v = Map.tryFind r regs |> Option.defaultValue 0
              for i in 0..7 -> sprintf "v%d_%d" r i, (v >>> i) &&& 1 ]
        |> Map.ofList

    /// Read the final register map from a synthesized circuit's eval result, given its output-wire map.
    let regOutputs (outMap: Map<int, string list>) (wires: Map<string, int>) : Map<int, int> =
        [ for KeyValue(r, ws) in outMap ->
              r,
              (ws
               |> List.mapi (fun i w -> i, w)
               |> List.sumBy (fun (i, w) ->
                   match Map.tryFind w wires with
                   | Some 1 -> 1 <<< i
                   | _ -> 0)) ]
        |> Map.ofList
