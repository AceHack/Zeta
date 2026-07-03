namespace Zeta.Core

/// **CpuSynth — Column B, rung 5: the FULLY-SYNTHESIZABLE core (no structural seam left).**
/// (Aaron 2026-07-03: "continue with b as well". Rung 4's `Cpu` ran the full ISA with a clocked PC,
/// but named an honest seam: fetch and register-file addressing were still structural F#. This rung
/// closes it — the ENTIRE next-state function is one combinational **gate** circuit, clocked by
/// `Sequential.run`. Nothing about executing an instruction is F# anymore; it is all gates.)
///
/// `synthesize program regs0` emits a `Sequential` circuit whose state is the whole machine —
/// PC (8 wires), the 16×8 register file (128 wires), a halted flag — and whose combinational core
/// computes the next state from the current one with the program baked in as a **ROM of constants**:
///
///   - **fetch**   — `sel_a = (pc == a)` per address (gate comparator); the active instruction's
///                   fields are selected by OR-ing `sel_a AND const_field_a` over all addresses.
///   - **decode**  — opcode one-hot + operand fields fall out of the same ROM mux (constants).
///   - **read**    — `Vx`,`Vy` are 16:1 gate mux trees over the register file, addressed by the
///                   decoded `x`/`y` nibbles.
///   - **execute** — `ADD`/`ADDR` on the gate `adder`, `SE` on the gate `equal` comparator; the
///                   write value is muxed by the opcode one-hot (SET→nn, ADD/ADDR→sum, MOV→Vy).
///   - **write**   — each register latches `(x == k AND write-enable) ? value : itself` (gate mux).
///   - **next-PC** — `JP`→target, taken-`SE`→pc+2, else pc+1 (gate adders + muxes). Out-of-range
///                   or halted ⇒ the machine **freezes** (a gate-level "hold"), so extra clocks are
///                   no-ops and the register file is stable to read.
///
/// **The law** (machine-checked): `runFor program regs0 cycles = Isa.eval program regs0` for enough
/// cycles — the synthesized silicon computes exactly what the reference interpreter does. Combined
/// with rung 1's exhaustive `adder`/`equal` proofs, the whole processor is gates all the way down.
///
/// Programs are ≤ 256 instructions (8-bit PC). Anchors: von Neumann (stored program = ROM the machine
/// reads) · Shannon 1937 (the datapath + control as boolean gates) · the microarchitecture
/// fetch-decode-execute datapath · Mealy/Moore (PC = state). Built on `Netlist` + `Sequential` +
/// `Isa` (the reference). Consumes only `DynamicValue`.
[<RequireQualifiedAccess>]
module CpuSynth =

    /// Synthesize a program + initial registers into a `Sequential` circuit (the whole CPU as gates).
    let synthesize (program: DynamicValue) (regs0: Map<int, int>) : Result<DynamicValue, string> =
        match program with
        | DynamicValue.Array instrs ->
            let code = List.toArray instrs
            if code.Length > 256 then
                Error "cpusynth: program exceeds 256 instructions (8-bit PC)"
            else
                let len = code.Length
                let gates = System.Collections.Generic.List<DynamicValue>()
                let mutable uid = 0
                let fresh (p: string) =
                    uid <- uid + 1
                    sprintf "w_%s_%d" p uid
                // gate emitters that mint a fresh output wire and return its name
                let aG a b = let o = fresh "a" in gates.Add(Netlist.andG o a b); o
                let oG a b = let o = fresh "o" in gates.Add(Netlist.orG o a b); o
                let xG a b = let o = fresh "x" in gates.Add(Netlist.xorG o a b); o
                let nG a = let o = fresh "n" in gates.Add(Netlist.notG o a); o
                // constants 0 / 1, derived from a state input wire (no special inputs)
                gates.Add(Netlist.xorG "k0" "pc0" "pc0")
                gates.Add(Netlist.notG "k1" "k0")
                let cbit b = if b &&& 1 = 1 then "k1" else "k0"
                let cword v n = [ for i in 0 .. n - 1 -> cbit ((v >>> i) &&& 1) ]
                // 2:1 mux — sel=1 → a, sel=0 → b
                let mux2 sel a b =
                    let na = nG sel
                    oG (aG sel a) (aG na b)
                // AND-reduce a non-empty list (k1 for empty = vacuous true)
                let andReduce =
                    function
                    | [] -> "k1"
                    | h :: t -> List.fold aG h t
                let orReduce =
                    function
                    | [] -> "k0"
                    | h :: t -> List.fold oG h t
                // equality of a wire list to a constant (per-bit XNOR, AND-reduced)
                let eqConst (ws: string list) (v: int) =
                    ws
                    |> List.mapi (fun i w -> nG (xG w (cbit ((v >>> i) &&& 1))))
                    |> andReduce
                // equality of two wire lists
                let eqWires (a: string list) (b: string list) =
                    List.map2 (fun x y -> nG (xG x y)) a b |> andReduce
                // ripple-carry adder (carry-in 0, final carry dropped = mod 2^n); returns sum wires
                let addC (a: string list) (b: string list) =
                    let a = List.toArray a
                    let b = List.toArray b
                    let n = a.Length
                    let s = Array.zeroCreate n
                    let mutable carry = "k0"
                    for i in 0 .. n - 1 do
                        let axb = xG a.[i] b.[i]
                        s.[i] <- xG axb carry
                        carry <- oG (aG a.[i] b.[i]) (aG carry axb)
                    List.ofArray s
                // buffer a value wire into a fixed output name (OR(v,v) = v) — for feedback sources
                let bufInto name v = gates.Add(Netlist.orG name v v)

                // ── state wire names ──
                let pcW = [ for i in 0..7 -> sprintf "pc%d" i ]
                let regName k i = sprintf "R%d_%d" k i
                let regW k = [ for i in 0..7 -> regName k i ]

                // ── decode: structural constants per address, muxed by (pc == a) ──
                let fieldA a k =
                    match DynamicValue.get k code.[a] with
                    | Some(DynamicValue.Int n) -> int n
                    | _ -> 0
                let opA a =
                    match DynamicValue.get "op" code.[a] with
                    | Some(DynamicValue.String s) -> s
                    | _ -> "?"
                let selas = [ for a in 0 .. len - 1 -> eqConst pcW a ]
                // width-w signal selected from the ROM: bit i = OR_a (sel_a AND const_bit_a_i)
                let muxSignal (perAddr: int -> int list) (w: int) =
                    [ for i in 0 .. w - 1 ->
                          [ for a in 0 .. len - 1 -> aG selas.[a] (cbit (List.item i (perAddr a))) ]
                          |> orReduce ]
                let bitsOfInt v n = [ for i in 0 .. n - 1 -> (v >>> i) &&& 1 ]
                let muxBit (perAddr: int -> int) = (muxSignal (fun a -> [ perAddr a ]) 1) |> List.head
                let isOp name a = if opA a = name then 1 else 0
                let isSET = muxBit (isOp "SET")
                let isADD = muxBit (isOp "ADD")
                let isMOV = muxBit (isOp "MOV")
                let isADDR = muxBit (isOp "ADDR")
                let isSE = muxBit (isOp "SE")
                let isJP = muxBit (isOp "JP")
                let isHALT = muxBit (isOp "HALT")
                let xN = muxSignal (fun a -> bitsOfInt (fieldA a "x") 4) 4
                let yN = muxSignal (fun a -> bitsOfInt (fieldA a "y") 4) 4
                let nn8 = muxSignal (fun a -> bitsOfInt (fieldA a "nn") 8) 8
                let tgt8 = muxSignal (fun a -> bitsOfInt (fieldA a "addr") 8) 8

                // ── register read: 16:1 gate mux tree per bit, addressed by sel4 (LSB first) ──
                let read16 (sel4: string list) : string list =
                    [ for i in 0..7 ->
                          let mutable cur = [ for k in 0..15 -> regName k i ]
                          for s in sel4 do
                              cur <- [ for j in 0 .. (cur.Length / 2) - 1 -> mux2 s (List.item (2 * j + 1) cur) (List.item (2 * j) cur) ]
                          List.head cur ]
                let vx = read16 xN
                let vy = read16 yN

                // ── execute ──
                let sumImm = addC vx nn8 // ADD  Vx, nn
                let sumReg = addC vx vy // ADDR Vx, Vy
                let seEq = eqWires vx nn8 // SE   Vx == nn
                let value =
                    [ for i in 0..7 ->
                          orReduce
                              [ aG isSET (List.item i nn8)
                                aG isADD (List.item i sumImm)
                                aG isADDR (List.item i sumReg)
                                aG isMOV (List.item i vy) ] ]

                // freeze when halted OR pc out of range (prevents PC wrap re-entering the program)
                let inRange = orReduce selas
                let effHalt = oG "H" (nG inRange)
                let notFrozen = nG effHalt
                let writeEnable = aG (orReduce [ isSET; isADD; isMOV; isADDR ]) notFrozen

                // ── write-back: each register latches value iff (x == k) AND write-enable ──
                for k in 0..15 do
                    let wsel = aG writeEnable (eqConst xN k)
                    for i in 0..7 do
                        bufInto (sprintf "nR%d_%d" k i) (mux2 wsel (List.item i value) (regName k i))

                // ── next PC: JP→target, taken-SE→pc+2, else pc+1; frozen→hold ──
                let pcPlus1 = addC pcW (cword 1 8)
                let pcPlus2 = addC pcW (cword 2 8)
                let seTaken = aG isSE seEq
                for i in 0..7 do
                    let afterSE = mux2 seTaken (List.item i pcPlus2) (List.item i pcPlus1)
                    let afterJP = mux2 isJP (List.item i tgt8) afterSE
                    bufInto (sprintf "npc%d" i) (mux2 effHalt (List.item i pcW) afterJP)

                // halted latches once a real HALT executes
                bufInto "nH" (oG "H" isHALT)

                // ── assemble the sequential circuit ──
                let inputs = pcW @ [ for k in 0..15 do yield! regW k ] @ [ "H" ]
                let outputs = [ for i in 0..7 -> sprintf "npc%d" i ] @ [ for k in 0..15 do for i in 0..7 -> sprintf "nR%d_%d" k i ] @ [ "nH" ]
                let core = Netlist.circuit inputs outputs (List.ofSeq gates)
                let feedback =
                    [ for i in 0..7 -> sprintf "npc%d" i, sprintf "pc%d" i ]
                    @ [ for k in 0..15 do for i in 0..7 -> sprintf "nR%d_%d" k i, regName k i ]
                    @ [ "nH", "H" ]
                let init =
                    Map.ofList
                        ([ for i in 0..7 -> sprintf "pc%d" i, 0 ]
                         @ [ for k in 0..15 do
                                 let v = Map.tryFind k regs0 |> Option.defaultValue 0
                                 for i in 0..7 -> regName k i, (((v % 256) + 256) % 256 >>> i) &&& 1 ]
                         @ [ "H", 0 ])
                Ok(Sequential.seqCircuit core feedback init)
        | _ -> Error "cpusynth: program must be an array of instructions"

    /// Read the final register map (16 registers) from a run's latched state. Public so a caller
    /// that clocks a synthesized circuit itself (e.g. the unified `Residual` runner) can decode it.
    let readRegs (state: Map<string, int>) : Map<int, int> =
        [ for k in 0..15 ->
              k,
              ([ 0..7 ]
               |> List.sumBy (fun i ->
                   match Map.tryFind (sprintf "R%d_%d" k i) state with
                   | Some 1 -> 1 <<< i
                   | _ -> 0)) ]
        |> Map.ofList

    /// Synthesize, clock the gate CPU for `cycles`, and return the final register map. `cycles` must
    /// exceed the program's dynamic step count (the machine freezes on HALT / out-of-range, so surplus
    /// clocks are no-ops). Equal to `Isa.eval` for a sufficient `cycles`.
    let runFor (program: DynamicValue) (regs0: Map<int, int>) (cycles: int) : Result<Map<int, int>, string> =
        match synthesize program regs0 with
        | Error e -> Error e
        | Ok seqc ->
            match Sequential.run seqc Map.empty cycles with
            | Ok state -> Ok(readRegs state)
            | Error e -> Error e
