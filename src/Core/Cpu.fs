namespace Zeta.Core

/// **Cpu — Column B, rung 4: a clocked CPU, so CONTROL FLOW runs on the gate datapath.**
/// (Aaron 2026-07-03: "continue with b as well" — the fork held after the signed beacon. Straight-
/// line `Netlist.synthesize` (rung 2) hit a wall: it rejects `SE`/`JP` because a whole program with
/// branches is not one combinational circuit — it needs *state that sequences*. Rung 3 (`Sequential`)
/// built clocked state in the abstract; this rung spends it on a real processor.)
///
/// A CPU is the composition rungs 1–3 were built for: a **program counter as clocked state** driving a
/// **fetch → decode → execute** loop over the gate **datapath**. Each clock cycle executes ONE
/// instruction: read the register file, run the arithmetic and the branch test **through the gate
/// netlists** (`Netlist.adder` for `ADD`/`ADDR`, `Netlist.equal` for the `SE` comparison — the exact
/// circuits rung 1 proved exhaustively), write back one register, and step the PC (`+1`, `+2` on a
/// taken `SE`, or the `JP` target). It runs the FULL ISA — `SE`/`JP` included — which straight-line
/// synthesis could not.
///
/// **The correctness law** (machine-checked, incl. loops): for every program `p` and initial registers,
///
///     runGate p regs0  =  Isa.eval p regs0
///
/// The clocked CPU computes exactly what the reference interpreter does — now with the arithmetic and
/// the control decisions carried by gates. Since rung 1 proved `adder`/`equal` equal to integer `+`/`=`
/// exhaustively, this rung proves the SEQUENCER composes that gate datapath correctly across branches
/// and loops.
///
/// **Honest fidelity boundary** (named, not hidden): the *datapath* (arithmetic + branch condition) is
/// gate-level — evaluated by running the netlists. The *fetch* (ROM index by PC) and *register-file
/// addressing* (which of 16 registers to read/write) are still STRUCTURAL F#, not yet a gate-level mux
/// tree. Turning fetch/decode/regfile-select into gates too — one big combinational next-state circuit
/// clocked by `Sequential.run` — is rung 5 (the fully-synthesizable core). This rung closes the
/// control-flow gap; rung 5 closes the last structural seam.
///
/// Anchors: von Neumann (stored-program: the ROM is data the same machine reads) · the classic
/// fetch-decode-execute cycle · Mealy/Moore (the PC is the state, next-PC is the transition) ·
/// Shannon 1937 (the datapath gates). Built on `Isa` (the reference + program shape) and `Netlist`
/// (the gate datapath). Consumes only `DynamicValue`.
[<RequireQualifiedAccess>]
module Cpu =

    /// Combine two disjoint wire-assignment maps (right wins on overlap; here they never overlap).
    let private union (a: Map<string, int>) (b: Map<string, int>) : Map<string, int> =
        Map.fold (fun m k v -> Map.add k v m) a b

    // ── the gate datapath: arithmetic and comparison run THROUGH the netlists ──

    /// `(a + b) mod 256` computed by evaluating the 8-bit gate `adder` — the rung-1 circuit, not `+`.
    let private addGate (a: int) (b: int) : Result<int, string> =
        let inputs = union (Netlist.bitsOf "a" 8 a) (Netlist.bitsOf "b" 8 b)
        match Netlist.eval (Netlist.adder 8) inputs with
        | Ok outs -> Ok(Netlist.intOf "s" 8 outs)
        | Error e -> Error e

    /// `a = b` decided by evaluating the 8-bit gate `equal` comparator (single `eq` wire).
    let private eqGate (a: int) (b: int) : Result<bool, string> =
        let inputs = union (Netlist.bitsOf "a" 8 a) (Netlist.bitsOf "b" 8 b)
        match Netlist.eval (Netlist.equal 8) inputs with
        | Ok outs -> Ok(Map.tryFind "eq" outs = Some 1)
        | Error e -> Error e

    // ── shared field readers (the decode half — structural, mirrors Isa) ──

    let private opOf (ins: DynamicValue) : string =
        match DynamicValue.get "op" ins with
        | Some(DynamicValue.String s) -> s
        | _ -> "?"

    let private fieldOf (k: string) (ins: DynamicValue) : int option =
        match DynamicValue.get k ins with
        | Some(DynamicValue.Int v) -> Some(int v)
        | _ -> None

    [<Literal>]
    let private stepBudget = 1_000_000

    // ── the clocked fetch-decode-execute loop (PC is the state) ──

    /// Run a program as a clocked CPU: PC-driven fetch/decode/execute, with `ADD`/`ADDR` arithmetic and
    /// the `SE` comparison evaluated on the gate datapath. Returns the final register map (byte-wrapped)
    /// or an error (bad operands / unknown op / step-budget overrun). Equal to `Isa.eval` for every
    /// program — including those with branches and loops.
    let runGate (program: DynamicValue) (regs0: Map<int, int>) : Result<Map<int, int>, string> =
        match program with
        | DynamicValue.Array instrs ->
            let code = List.toArray instrs
            let regs = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in regs0 do
                regs.[k] <- ((v % 256) + 256) % 256
            let getr x =
                match regs.TryGetValue x with
                | true, v -> v
                | _ -> 0
            let setr x v = regs.[x] <- ((v % 256) + 256) % 256
            let mutable pc = 0 // the clocked program counter — the CPU's sequential state
            let mutable steps = 0
            let mutable halted = false
            let mutable err = None
            while not halted && pc >= 0 && pc < code.Length && err.IsNone do
                steps <- steps + 1
                if steps > stepBudget then
                    err <- Some "cpu: step budget exceeded (loop?)"
                else
                    let ins = code.[pc]
                    match opOf ins with
                    | "SET" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn ->
                            setr x nn
                            pc <- pc + 1
                        | _ -> err <- Some "cpu: SET operands"
                    | "ADD" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn ->
                            match addGate (getr x) nn with
                            | Ok s ->
                                setr x s
                                pc <- pc + 1
                            | Error e -> err <- Some e
                        | _ -> err <- Some "cpu: ADD operands"
                    | "MOV" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y ->
                            setr x (getr y)
                            pc <- pc + 1
                        | _ -> err <- Some "cpu: MOV operands"
                    | "ADDR" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y ->
                            match addGate (getr x) (getr y) with
                            | Ok s ->
                                setr x s
                                pc <- pc + 1
                            | Error e -> err <- Some e
                        | _ -> err <- Some "cpu: ADDR operands"
                    | "SE" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn ->
                            match eqGate (getr x) nn with
                            | Ok eq -> pc <- pc + (if eq then 2 else 1)
                            | Error e -> err <- Some e
                        | _ -> err <- Some "cpu: SE operands"
                    | "JP" ->
                        match fieldOf "addr" ins with
                        | Some a -> pc <- a
                        | _ -> err <- Some "cpu: JP operand"
                    | "HALT" -> halted <- true
                    | other -> err <- Some(sprintf "cpu: unknown op '%s'" other)
            match err with
            | Some e -> Error e
            | None -> Ok(regs |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq)
        | _ -> Error "cpu: program must be an array of instructions"
