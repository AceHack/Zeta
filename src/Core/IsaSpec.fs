namespace Zeta.Core

/// **IsaSpec — the ISA itself as data (homoiconic instruction sets).** (Aaron 2026-07-02: "what's
/// next sonic mario" — Sonic = Genesis 68000, Mario = NES 6502: real console ISAs. The honest path
/// to them is not more hand-written interpreters but the ISA-as-*description*, so a new CPU is a
/// spec, not code.)
///
/// `Isa.eval` hard-codes seven opcodes in a `match`. This module makes the opcode set **data**: an
/// `IsaSpec` is a `DynamicValue` mapping each op-name to a list of **effects** built from a fixed,
/// irreducible primitive set (read/write register, read operand field, add, sub, set-pc,
/// skip-if-equal, halt). `evalSpec` interprets ANY ISA given its spec. Adding an instruction — or a
/// whole CPU — is writing a spec value, and the interpreter is never touched
/// (`only-the-irreducible-is-primitive-generate-the-rest`: the primitives are fixed; the opcodes are
/// generated/composed from them).
///
/// **Why this is the emulator connection Aaron named:** a fast emulator's *dynamic recompilation*
/// (dynarec) is Futamura's 1st projection — `mix(cpu-interpreter, ROM) = compiled game`. Making the
/// CPU a spec is what lets one `mix` (Isa.specialize's successor) specialize *any* ISA against *any*
/// ROM. CHIP-8 today; the same shape scales to the 6502 (Mario) and 68000 (Sonic) as specs.
///
/// **Proven:** `evalSpec chip8 p regs = Isa.eval p regs` for every program (differential equivalence
/// against the hand-written interpreter — the oracle). And a brand-new opcode (`SUB`) added *purely
/// as a spec value* runs under `evalSpec`, though `Isa.eval` rejects it — ISA extension is data.
///
/// Value/effect encoding (all `DynamicValue`, so an ISA rides the codec stack and is byte-lockable):
///   Val    = {v:"fld",k} | {v:"const",n} | {v:"reg",i:Val} | {v:"add",a,b:Val} | {v:"sub",a,b:Val}
///   Effect = {e:"setreg",i,val:Val} | {e:"setpc",to:Val} | {e:"ifeqskip",a,b:Val} | {e:"halt"}
///   Op     = {op:name, eff:[Effect]}     IsaSpec = {ops:[Op]}
///
/// Anchors: Futamura (1971 — dynarec = 1st projection); Jones/Gomard/Sestoft (interpreter as data);
/// `only-the-irreducible-is-primitive-generate-the-rest`; CHIP-8 / 6502 / 68000 (the ISA lineage).
[<RequireQualifiedAccess>]
module IsaSpec =

    let private wrap (v: int) : int = ((v % 256) + 256) % 256

    [<Literal>]
    let private stepBudget = 1_000_000

    // ── value / effect constructors (build the DynamicValue spec — the ISA as data) ──

    let fld (k: string) = DynamicValue.Object [ "v", DynamicValue.String "fld"; "k", DynamicValue.String k ]
    let cst (n: int) = DynamicValue.Object [ "v", DynamicValue.String "const"; "n", DynamicValue.Int(int64 n) ]
    let reg (i: DynamicValue) = DynamicValue.Object [ "v", DynamicValue.String "reg"; "i", i ]
    let addV (a: DynamicValue) (b: DynamicValue) = DynamicValue.Object [ "v", DynamicValue.String "add"; "a", a; "b", b ]
    let subV (a: DynamicValue) (b: DynamicValue) = DynamicValue.Object [ "v", DynamicValue.String "sub"; "a", a; "b", b ]

    /// Read memory at `addr` (a Val) — the addressable-store primitive real ISAs need.
    let memRead (addr: DynamicValue) = DynamicValue.Object [ "v", DynamicValue.String "mem"; "addr", addr ]

    let setReg (i: DynamicValue) (value: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "setreg"; "i", i; "val", value ]

    let setPc (target: DynamicValue) = DynamicValue.Object [ "e", DynamicValue.String "setpc"; "to", target ]

    /// Write `value` (a Val) to memory at `addr` (a Val) — the store effect. Wraps mod 256.
    let setMem (addr: DynamicValue) (value: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "setmem"; "addr", addr; "val", value ]

    let ifEqSkip (a: DynamicValue) (b: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "ifeqskip"; "a", a; "b", b ]

    let halt = DynamicValue.Object [ "e", DynamicValue.String "halt" ]

    /// Set the N/Z status flags from a result value (`from` a Val). The 6502 side effect of loads,
    /// transfers, and arithmetic. Z = (value == 0), N = (bit 7 set).
    let setFlags (from: DynamicValue) = DynamicValue.Object [ "e", DynamicValue.String "setflags"; "from", from ]

    /// A real flag-based branch: if flag `f` (∈ {"Z","N"}) equals `want` (0/1), pc ← `to` (a Val).
    let branchIf (f: string) (want: int) (target: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "branch"; "flag", DynamicValue.String f; "want", DynamicValue.Int(int64 want); "to", target ]

    let op (name: string) (effects: DynamicValue list) =
        DynamicValue.Object [ "op", DynamicValue.String name; "eff", DynamicValue.Array effects ]

    let isa (ops: DynamicValue list) = DynamicValue.Object [ "ops", DynamicValue.Array ops ]

    // ── value evaluation ──

    let rec private evalVal (v: DynamicValue) (ins: DynamicValue) (regs: System.Collections.Generic.Dictionary<int, int>) (mem: System.Collections.Generic.Dictionary<int, int>) : Result<int, string> =
        let binop f a b =
            match evalVal a ins regs mem, evalVal b ins regs mem with
            | Ok x, Ok y -> Ok(f x y)
            | Error e, _
            | _, Error e -> Error e
        match DynamicValue.get "v" v with
        | Some(DynamicValue.String "fld") ->
            match DynamicValue.get "k" v with
            | Some(DynamicValue.String k) ->
                match DynamicValue.get k ins with
                | Some(DynamicValue.Int n) -> Ok(int n)
                | _ -> Error(sprintf "isaspec: instruction missing field '%s'" k)
            | _ -> Error "isaspec: fld without key"
        | Some(DynamicValue.String "const") ->
            match DynamicValue.get "n" v with
            | Some(DynamicValue.Int n) -> Ok(int n)
            | _ -> Error "isaspec: const without n"
        | Some(DynamicValue.String "reg") ->
            match DynamicValue.get "i" v with
            | Some iv ->
                evalVal iv ins regs mem
                |> Result.map (fun idx ->
                    match regs.TryGetValue idx with
                    | true, x -> x
                    | _ -> 0)
            | _ -> Error "isaspec: reg without index"
        // memory read — `mem[addr]` (addr is itself a Val). Absent cells read 0. This is the
        // primitive real ISAs add over the register-only core: an addressable store.
        | Some(DynamicValue.String "mem") ->
            match DynamicValue.get "addr" v with
            | Some av ->
                evalVal av ins regs mem
                |> Result.map (fun a ->
                    match mem.TryGetValue a with
                    | true, x -> x
                    | _ -> 0)
            | _ -> Error "isaspec: mem without addr"
        | Some(DynamicValue.String "add") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b -> binop (+) a b
            | _ -> Error "isaspec: add operands"
        | Some(DynamicValue.String "sub") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b -> binop (-) a b
            | _ -> Error "isaspec: sub operands"
        | _ -> Error "isaspec: malformed value"

    // ── the spec-driven interpreter ──

    /// Interpret a program under an ISA-as-data, returning BOTH the final registers AND the final
    /// memory. Absent registers/cells default 0; writes wrap mod 256; a step budget guards loops. An
    /// opcode with no spec entry is an error. Effects: `setreg`, `setmem`, `setpc`, `ifeqskip`, `halt`.
    let evalSpecFull
        (isaSpec: DynamicValue)
        (program: DynamicValue)
        (regs0: Map<int, int>)
        (mem0: Map<int, int>)
        : Result<Map<int, int> * Map<int, int>, string> =
        let table = System.Collections.Generic.Dictionary<string, DynamicValue[]>()
        match DynamicValue.get "ops" isaSpec with
        | Some(DynamicValue.Array ops) ->
            for o in ops do
                match DynamicValue.get "op" o, DynamicValue.get "eff" o with
                | Some(DynamicValue.String name), Some(DynamicValue.Array effs) -> table.[name] <- List.toArray effs
                | _ -> ()
        | _ -> ()

        match program with
        | DynamicValue.Array instrs ->
            let code = List.toArray instrs
            let regs = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in regs0 do
                regs.[k] <- wrap v
            let mem = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in mem0 do
                mem.[k] <- wrap v
            let mutable pc = 0
            let mutable steps = 0
            let mutable halted = false
            let mutable err = None
            // Processor status flags (the 6502's status register, minimal N/Z subset). Set by `setflags`
            // from a result value; read by `branch`. Unused by register-only specs (chip8/mos6502).
            let mutable flagZ = false // zero flag: last result was 0
            let mutable flagN = false // negative flag: bit 7 of the last result
            while not halted && pc >= 0 && pc < code.Length && err.IsNone do
                steps <- steps + 1
                if steps > stepBudget then
                    err <- Some "isaspec: step budget exceeded (loop?)"
                else
                    let ins = code.[pc]
                    let opName =
                        match DynamicValue.get "op" ins with
                        | Some(DynamicValue.String s) -> s
                        | _ -> "?"
                    match table.TryGetValue opName with
                    | false, _ -> err <- Some(sprintf "isaspec: no spec for op '%s'" opName)
                    | true, effs ->
                        let mutable pcSet = false
                        let mutable j = 0
                        while j < effs.Length && err.IsNone do
                            let e = effs.[j]
                            match DynamicValue.get "e" e with
                            | Some(DynamicValue.String "setreg") ->
                                match DynamicValue.get "i" e, DynamicValue.get "val" e with
                                | Some iv, Some vv ->
                                    match evalVal iv ins regs mem, evalVal vv ins regs mem with
                                    | Ok idx, Ok value -> regs.[idx] <- wrap value
                                    | Error m, _
                                    | _, Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setreg operands"
                            | Some(DynamicValue.String "setmem") ->
                                match DynamicValue.get "addr" e, DynamicValue.get "val" e with
                                | Some av, Some vv ->
                                    match evalVal av ins regs mem, evalVal vv ins regs mem with
                                    | Ok addr, Ok value -> mem.[addr] <- wrap value
                                    | Error m, _
                                    | _, Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setmem operands"
                            | Some(DynamicValue.String "setpc") ->
                                match DynamicValue.get "to" e with
                                | Some tv ->
                                    match evalVal tv ins regs mem with
                                    | Ok p ->
                                        pc <- p
                                        pcSet <- true
                                    | Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setpc operand"
                            | Some(DynamicValue.String "ifeqskip") ->
                                match DynamicValue.get "a" e, DynamicValue.get "b" e with
                                | Some av, Some bv ->
                                    match evalVal av ins regs mem, evalVal bv ins regs mem with
                                    | Ok a, Ok b ->
                                        pc <- pc + (if a = b then 2 else 1)
                                        pcSet <- true
                                    | Error m, _
                                    | _, Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: ifeqskip operands"
                            // set the N/Z status flags from a result value (the 6502 side effect of a load/
                            // transfer/arithmetic op). Effects run in listing order, so `setflags (reg A)`
                            // after `setreg A …` reads the just-written result.
                            | Some(DynamicValue.String "setflags") ->
                                match DynamicValue.get "from" e with
                                | Some fv ->
                                    match evalVal fv ins regs mem with
                                    | Ok v ->
                                        let w = wrap v
                                        flagZ <- (w = 0)
                                        flagN <- (w &&& 128 <> 0)
                                    | Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setflags operand"
                            // real flag-based branch: if the named flag equals `want`, pc ← to; else fall through.
                            | Some(DynamicValue.String "branch") ->
                                match DynamicValue.get "flag" e, DynamicValue.get "want" e, DynamicValue.get "to" e with
                                | Some(DynamicValue.String f), Some(DynamicValue.Int w), Some tv ->
                                    let cur =
                                        match f with
                                        | "Z" -> (if flagZ then 1 else 0)
                                        | "N" -> (if flagN then 1 else 0)
                                        | _ -> -1
                                    if cur = -1 then
                                        err <- Some(sprintf "isaspec: unknown flag '%s'" f)
                                    elif cur = int w then
                                        match evalVal tv ins regs mem with
                                        | Ok p ->
                                            pc <- p
                                            pcSet <- true
                                        | Error m -> err <- Some m
                                    else
                                        () // not taken: fall through (pc advances via the not-pcSet path)
                                | _ -> err <- Some "isaspec: branch operands"
                            | Some(DynamicValue.String "halt") ->
                                halted <- true
                                pcSet <- true
                            | _ -> err <- Some "isaspec: malformed effect"
                            j <- j + 1
                        if err.IsNone && not halted && not pcSet then
                            pc <- pc + 1
            match err with
            | Some e -> Error e
            | None ->
                let regsOut = regs |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                let memOut = mem |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                Ok(regsOut, memOut)
        | _ -> Error "isaspec: program must be an array of instructions"

    /// Interpret a program under an ISA-as-data, returning the final registers (memory internal,
    /// starts empty). Backward-compatible: for a register-only ISA (e.g. `chip8`) this is unchanged,
    /// so `evalSpec chip8 p regs = Isa.eval p regs` still holds.
    let evalSpec (isaSpec: DynamicValue) (program: DynamicValue) (regs0: Map<int, int>) : Result<Map<int, int>, string> =
        evalSpecFull isaSpec program regs0 Map.empty |> Result.map fst

    // ── CHIP-8 as a spec (dogfood: the hard-coded ISA, now data) ──

    /// The CHIP-8-shaped opcode set of `Isa.eval`, expressed entirely as a data `IsaSpec`.
    /// `evalSpec chip8 p regs = Isa.eval p regs` for every program (proven differentially).
    let chip8: DynamicValue =
        isa
            [ op "SET" [ setReg (fld "x") (fld "nn") ]
              op "ADD" [ setReg (fld "x") (addV (reg (fld "x")) (fld "nn")) ]
              op "MOV" [ setReg (fld "x") (reg (fld "y")) ]
              op "ADDR" [ setReg (fld "x") (addV (reg (fld "x")) (reg (fld "y"))) ]
              op "SE" [ ifEqSkip (reg (fld "x")) (fld "nn") ]
              op "JP" [ setPc (fld "addr") ]
              op "HALT" [ halt ] ]

    // ── the 6502 (Mario's NES CPU) as a spec — a SECOND, REAL ISA, purely as data ──
    //
    // Aaron 2026-07-02 "sonic mario"; 2026-07-03 "build whatever you like." The generality claim of
    // ISA-as-data was only ever dogfooded on CHIP-8 (which `Isa.eval` also hard-codes). This is the
    // honest second witness: a real console CPU's register-transfer + zero-page-memory core, written
    // as a data spec, running under the SAME `evalSpecFull` with the interpreter untouched. The new
    // primitive that made it possible is `mem`/`setmem` (an addressable store) — the one thing the
    // register-only core lacked and every real ISA has.
    //
    // Register map: A = reg 0 (accumulator), X = reg 1, Y = reg 2. Zero-page = `mem` addressed by the
    // instruction's `addr` field. Fields: `imm` (immediate), `addr` (zero-page address / jump target).
    //
    // HONEST SCOPE (named, not hidden): this is the register + zero-page core, NOT the full 6502.
    // Absent: the processor status flags (C/Z/N/V/D/I) and therefore the *native* flag-based branches
    // (BEQ/BNE/BCC…) — control flow here uses the spec's `ifeqskip` compare-skip as a stand-in (a
    // status-register extension is the next rung); ADC has no carry-in; no indexed/indirect addressing
    // modes; no decimal mode; no stack; no PPU/APU. What it proves is exactly the checkbox: the general
    // machinery is ISA-general to a real, memory-bearing CPU — CHIP-8 was not special.
    let mos6502: DynamicValue =
        let a = cst 0 // accumulator = register 0
        let x = cst 1
        let y = cst 2
        isa
            [ op "LDA_IMM" [ setReg a (fld "imm") ] // A9 — A ← #imm
              op "LDX_IMM" [ setReg x (fld "imm") ] // A2 — X ← #imm
              op "LDY_IMM" [ setReg y (fld "imm") ] // A0 — Y ← #imm
              op "LDA_ZP" [ setReg a (memRead (fld "addr")) ] // A5 — A ← mem[addr]
              op "STA_ZP" [ setMem (fld "addr") (reg a) ] // 85 — mem[addr] ← A
              op "TAX" [ setReg x (reg a) ] // AA — X ← A
              op "TAY" [ setReg y (reg a) ] // A8 — Y ← A
              op "TXA" [ setReg a (reg x) ] // 8A — A ← X
              op "TYA" [ setReg a (reg y) ] // 98 — A ← Y
              op "INX" [ setReg x (addV (reg x) (cst 1)) ] // E8 — X ← X+1
              op "INY" [ setReg y (addV (reg y) (cst 1)) ] // C8 — Y ← Y+1
              op "DEX" [ setReg x (subV (reg x) (cst 1)) ] // CA — X ← X-1
              op "DEY" [ setReg y (subV (reg y) (cst 1)) ] // 88 — Y ← Y-1
              op "ADC_IMM" [ setReg a (addV (reg a) (fld "imm")) ] // 69 — A ← A+#imm (no carry; scoped)
              op "ADC_ZP" [ setReg a (addV (reg a) (memRead (fld "addr"))) ] // 65 — A ← A+mem[addr]
              op "JMP" [ setPc (fld "addr") ] // 4C — pc ← addr
              // SKE A,#imm — compare-skip stand-in for the flag-based BEQ (needs a status register; next rung)
              op "SKE" [ ifEqSkip (reg a) (fld "imm") ]
              op "NOP" [] // EA — no effect (pc advances)
              op "BRK" [ halt ] ] // 00 — stop

    // 6502 instruction constructors (programs are DynamicValue — homoiconic, like Isa.prog).
    let ldaImm nn = DynamicValue.Object [ "op", DynamicValue.String "LDA_IMM"; "imm", DynamicValue.Int(int64 nn) ]
    let ldxImm nn = DynamicValue.Object [ "op", DynamicValue.String "LDX_IMM"; "imm", DynamicValue.Int(int64 nn) ]
    let ldyImm nn = DynamicValue.Object [ "op", DynamicValue.String "LDY_IMM"; "imm", DynamicValue.Int(int64 nn) ]
    /// The `loadImm` builder for the 6502's registers (A/X/Y = 0/1/2) — sets register `r` to `v` in
    /// one instruction. Total over the ISA's actual registers; used to materialize static reads in `mix`.
    let load6502 (r: int) (v: int) : DynamicValue =
        match r with
        | 0 -> ldaImm v
        | 1 -> ldxImm v
        | 2 -> ldyImm v
        | _ -> DynamicValue.Object [ "op", DynamicValue.String "NOP" ] // unreachable: only A/X/Y exist
    let ldaZp addr = DynamicValue.Object [ "op", DynamicValue.String "LDA_ZP"; "addr", DynamicValue.Int(int64 addr) ]
    let staZp addr = DynamicValue.Object [ "op", DynamicValue.String "STA_ZP"; "addr", DynamicValue.Int(int64 addr) ]
    let tax = DynamicValue.Object [ "op", DynamicValue.String "TAX" ]
    let inx = DynamicValue.Object [ "op", DynamicValue.String "INX" ]
    let adcImm nn = DynamicValue.Object [ "op", DynamicValue.String "ADC_IMM"; "imm", DynamicValue.Int(int64 nn) ]
    let adcZp addr = DynamicValue.Object [ "op", DynamicValue.String "ADC_ZP"; "addr", DynamicValue.Int(int64 addr) ]
    let ske nn = DynamicValue.Object [ "op", DynamicValue.String "SKE"; "imm", DynamicValue.Int(int64 nn) ]
    let jmp addr = DynamicValue.Object [ "op", DynamicValue.String "JMP"; "addr", DynamicValue.Int(int64 addr) ]
    let brk = DynamicValue.Object [ "op", DynamicValue.String "BRK" ]

    // ── the 6502 with its STATUS REGISTER (N/Z) + REAL flag-based branches — the toy becomes real ──
    //
    // Aaron 2026-07-03 "i love to see it becoming real and not a toy over time … toys that turn into
    // trusted execution." `mos6502` above uses a `SKE` compare-skip as a stand-in for control flow.
    // This variant models the processor status flags (the minimal N/Z subset) and the REAL flag-based
    // branches — so the *idiomatic* 6502 loop (`DEX; BNE loop`) runs, not a substitute. Result-
    // producing ops carry a trailing `setflags (reg …)` (reading the just-written result), which makes
    // them MULTI-EFFECT — so this spec runs under `evalSpecFull` (which loops over effects) but is NOT
    // yet mix-able (the mix's straight-line fragment is single-effect; the multi-effect + flag-aware
    // mix is the next rung). HONEST SCOPE: N/Z only — carry (C) and overflow (V), and therefore
    // BCC/BCS/BVC/BVS and real ADC-with-carry, are the further flags rung.
    let mos6502nz: DynamicValue =
        let a = cst 0
        let x = cst 1
        let y = cst 2
        let withNZ effs resultReg = effs @ [ setFlags (reg resultReg) ] // append the N/Z side effect
        isa
            [ op "LDA_IMM" (withNZ [ setReg a (fld "imm") ] a)
              op "LDX_IMM" (withNZ [ setReg x (fld "imm") ] x)
              op "LDY_IMM" (withNZ [ setReg y (fld "imm") ] y)
              op "LDA_ZP" (withNZ [ setReg a (memRead (fld "addr")) ] a)
              op "STA_ZP" [ setMem (fld "addr") (reg a) ] // stores do NOT affect flags on the 6502
              op "TAX" (withNZ [ setReg x (reg a) ] x)
              op "TAY" (withNZ [ setReg y (reg a) ] y)
              op "TXA" (withNZ [ setReg a (reg x) ] a)
              op "TYA" (withNZ [ setReg a (reg y) ] a)
              op "INX" (withNZ [ setReg x (addV (reg x) (cst 1)) ] x)
              op "INY" (withNZ [ setReg y (addV (reg y) (cst 1)) ] y)
              op "DEX" (withNZ [ setReg x (subV (reg x) (cst 1)) ] x)
              op "DEY" (withNZ [ setReg y (subV (reg y) (cst 1)) ] y)
              op "ADC_IMM" (withNZ [ setReg a (addV (reg a) (fld "imm")) ] a)
              op "ADC_ZP" (withNZ [ setReg a (addV (reg a) (memRead (fld "addr"))) ] a)
              op "JMP" [ setPc (fld "addr") ]
              op "BNE" [ branchIf "Z" 0 (fld "addr") ] // D0 — branch if Z clear (result was nonzero)
              op "BEQ" [ branchIf "Z" 1 (fld "addr") ] // F0 — branch if Z set (result was zero)
              op "BPL" [ branchIf "N" 0 (fld "addr") ] // 10 — branch if N clear (result was >= 0)
              op "BMI" [ branchIf "N" 1 (fld "addr") ] // 30 — branch if N set (bit 7)
              op "NOP" []
              op "BRK" [ halt ] ]

    // faithful-6502 constructors (the extras beyond the mix-core set above).
    let iny = DynamicValue.Object [ "op", DynamicValue.String "INY" ]
    let dex = DynamicValue.Object [ "op", DynamicValue.String "DEX" ]
    let dey = DynamicValue.Object [ "op", DynamicValue.String "DEY" ]
    let bne addr = DynamicValue.Object [ "op", DynamicValue.String "BNE"; "addr", DynamicValue.Int(int64 addr) ]
    let beq addr = DynamicValue.Object [ "op", DynamicValue.String "BEQ"; "addr", DynamicValue.Int(int64 addr) ]

    // ── spec-driven `mix`: partial evaluation over ANY ISA-as-data (the dynarec, generalized) ──
    //
    // `Isa.specialize` hard-coded CHIP-8's opcodes; this specializes the *effects* generically, so
    // `mix` works for any ISA given only its spec. Straight-line, single-`setreg`-effect fragment
    // (like `Isa.specialize`): control flow / multi-effect ops are rejected. An instruction whose
    // value is fully static FOLDS into `known`; a dynamic one is residualized as-is, its static
    // register reads MATERIALIZED first via the ISA's load-immediate builder (passed in — CHIP-8's
    // is `Isa.set`), and its written register goes dynamic. The generic residual is correct but not
    // peephole-optimal (e.g. it materializes then emits `ADDR` rather than folding to `ADD`
    // immediate); the S-m-n law holds regardless, which is what the test checks.

    /// Is value `v` fully static under `known` (reads only known registers; indices resolvable)?
    let rec private tryStatic (v: DynamicValue) (ins: DynamicValue) (known: System.Collections.Generic.Dictionary<int, int>) (knownMem: System.Collections.Generic.Dictionary<int, int>) : int option =
        match DynamicValue.get "v" v with
        | Some(DynamicValue.String "fld") ->
            match DynamicValue.get "k" v with
            | Some(DynamicValue.String k) ->
                match DynamicValue.get k ins with
                | Some(DynamicValue.Int n) -> Some(int n)
                | _ -> None
            | _ -> None
        | Some(DynamicValue.String "const") ->
            match DynamicValue.get "n" v with
            | Some(DynamicValue.Int n) -> Some(int n)
            | _ -> None
        | Some(DynamicValue.String "reg") ->
            match DynamicValue.get "i" v with
            | Some iv ->
                match tryStatic iv ins known knownMem with
                | Some idx ->
                    match known.TryGetValue idx with
                    | true, x -> Some x
                    | _ -> None
                | None -> None
            | _ -> None
        // a memory read is static iff its address is static AND that cell is currently known.
        | Some(DynamicValue.String "mem") ->
            match DynamicValue.get "addr" v with
            | Some av ->
                match tryStatic av ins known knownMem with
                | Some a ->
                    match knownMem.TryGetValue a with
                    | true, x -> Some x
                    | _ -> None
                | None -> None
            | _ -> None
        | Some(DynamicValue.String "add") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b ->
                match tryStatic a ins known knownMem, tryStatic b ins known knownMem with
                | Some x, Some y -> Some(x + y)
                | _ -> None
            | _ -> None
        | Some(DynamicValue.String "sub") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b ->
                match tryStatic a ins known knownMem, tryStatic b ins known knownMem with
                | Some x, Some y -> Some(x - y)
                | _ -> None
            | _ -> None
        | _ -> None

    /// Register indices read inside `v` that are currently static (in `known`) — to materialize.
    let rec private readsInKnown (v: DynamicValue) (ins: DynamicValue) (known: System.Collections.Generic.Dictionary<int, int>) (knownMem: System.Collections.Generic.Dictionary<int, int>) : int list =
        match DynamicValue.get "v" v with
        | Some(DynamicValue.String "reg") ->
            match DynamicValue.get "i" v with
            | Some iv ->
                let deeper = readsInKnown iv ins known knownMem
                match tryStatic iv ins known knownMem with
                | Some idx when known.ContainsKey idx -> idx :: deeper
                | _ -> deeper
            | None -> []
        | Some(DynamicValue.String "mem") ->
            DynamicValue.get "addr" v |> Option.map (fun x -> readsInKnown x ins known knownMem) |> Option.defaultValue []
        | Some(DynamicValue.String "add")
        | Some(DynamicValue.String "sub") ->
            let a = DynamicValue.get "a" v |> Option.map (fun x -> readsInKnown x ins known knownMem) |> Option.defaultValue []
            let b = DynamicValue.get "b" v |> Option.map (fun x -> readsInKnown x ins known knownMem) |> Option.defaultValue []
            a @ b
        | _ -> []

    /// Partial-evaluate a straight-line program w.r.t. static registers, over ANY ISA given its
    /// `spec` and a `loadImm` builder (`reg → value → instruction`, e.g. `Isa.set` for CHIP-8).
    /// Returns the residual program and the folded static registers. The S-m-n law holds:
    /// `evalSpec spec (residual) dynamic ⊕ known = evalSpec spec p (static ∪ dynamic)`.
    let specialize
        (isaSpec: DynamicValue)
        (loadImm: int -> int -> DynamicValue)
        (program: DynamicValue)
        (statics: Map<int, int>)
        : Result<DynamicValue * Map<int, int>, string> =
        let table = System.Collections.Generic.Dictionary<string, DynamicValue[]>()
        match DynamicValue.get "ops" isaSpec with
        | Some(DynamicValue.Array ops) ->
            for o in ops do
                match DynamicValue.get "op" o, DynamicValue.get "eff" o with
                | Some(DynamicValue.String name), Some(DynamicValue.Array effs) -> table.[name] <- List.toArray effs
                | _ -> ()
        | _ -> ()

        match program with
        | DynamicValue.Array instrs ->
            let known = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in statics do
                known.[k] <- wrap v
            let noMem = System.Collections.Generic.Dictionary<int, int>() // register-only: no static memory
            let residual = System.Collections.Generic.List<DynamicValue>()
            let mutable err = None
            for ins in instrs do
                if err.IsNone then
                    let opName =
                        match DynamicValue.get "op" ins with
                        | Some(DynamicValue.String s) -> s
                        | _ -> "?"
                    match table.TryGetValue opName with
                    | false, _ -> err <- Some(sprintf "isaspec specialize: no spec for op '%s'" opName)
                    | true, [| eff |] ->
                        match DynamicValue.get "e" eff with
                        | Some(DynamicValue.String "halt") -> () // straight-line: no residual effect
                        | Some(DynamicValue.String "setreg") ->
                            match DynamicValue.get "i" eff, DynamicValue.get "val" eff with
                            | Some iv, Some vv ->
                                match tryStatic iv ins known noMem with
                                | None -> err <- Some "isaspec specialize: dynamic write index not supported"
                                | Some idx ->
                                    match tryStatic vv ins known noMem with
                                    | Some v -> known.[idx] <- wrap v // fold
                                    | None ->
                                        // dynamic: materialize static reads, emit the op as-is, write goes dynamic
                                        for r in readsInKnown vv ins known noMem do
                                            residual.Add(loadImm r known.[r])
                                        residual.Add ins
                                        known.Remove idx |> ignore
                            | _ -> err <- Some "isaspec specialize: setreg operands"
                        | _ -> err <- Some "isaspec specialize: only setreg/halt in the straight-line fragment"
                    | true, _ -> err <- Some(sprintf "isaspec specialize: op '%s' is not single-effect (control flow / multi-effect)" opName)
            match err with
            | Some e -> Error e
            | None ->
                let knownMap = known |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                Ok(DynamicValue.Array(List.ofSeq residual), knownMap)
        | _ -> Error "isaspec: program must be an array of instructions"

    /// The memory-aware spec-driven `mix` (the dynarec over a real, memory-bearing ISA — e.g. the
    /// 6502). Partial-evaluates a straight-line, single-effect program w.r.t. BOTH static registers
    /// AND static zero-page memory, over any ISA given its `spec` and a register `loadImm` builder.
    /// Returns the residual + the folded static registers + the folded static memory. Fragment:
    ///   - `setreg` with a fully-static value (incl. a static `mem` read whose cell is known) FOLDS;
    ///     a dynamic value residualizes (static register reads materialized first via `loadImm`).
    ///   - `setmem addr,val` with a static `addr`: a static `val` FOLDS into known memory; a dynamic
    ///     `val` residualizes (static reg reads materialized) and marks that cell dynamic. A dynamic
    ///     `addr` is out of the fragment (rejected) — real zero-page ops address a constant cell.
    /// The extended S-m-n law holds (proven differentially against `evalSpecFull`):
    ///   `evalSpecFull spec residual dynReg dynMem  ⊕  (knownReg, knownMem)  =  evalSpecFull spec p full`.
    let specializeMem
        (isaSpec: DynamicValue)
        (loadImm: int -> int -> DynamicValue)
        (program: DynamicValue)
        (staticRegs: Map<int, int>)
        (staticMem: Map<int, int>)
        : Result<DynamicValue * Map<int, int> * Map<int, int>, string> =
        let table = System.Collections.Generic.Dictionary<string, DynamicValue[]>()
        match DynamicValue.get "ops" isaSpec with
        | Some(DynamicValue.Array ops) ->
            for o in ops do
                match DynamicValue.get "op" o, DynamicValue.get "eff" o with
                | Some(DynamicValue.String name), Some(DynamicValue.Array effs) -> table.[name] <- List.toArray effs
                | _ -> ()
        | _ -> ()

        match program with
        | DynamicValue.Array instrs ->
            let known = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in staticRegs do
                known.[k] <- wrap v
            let knownMem = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in staticMem do
                knownMem.[k] <- wrap v
            let residual = System.Collections.Generic.List<DynamicValue>()
            let mutable err = None
            for ins in instrs do
                if err.IsNone then
                    let opName =
                        match DynamicValue.get "op" ins with
                        | Some(DynamicValue.String s) -> s
                        | _ -> "?"
                    match table.TryGetValue opName with
                    | false, _ -> err <- Some(sprintf "isaspec specializeMem: no spec for op '%s'" opName)
                    | true, [| eff |] ->
                        match DynamicValue.get "e" eff with
                        | Some(DynamicValue.String "halt") -> ()
                        | Some(DynamicValue.String "setreg") ->
                            match DynamicValue.get "i" eff, DynamicValue.get "val" eff with
                            | Some iv, Some vv ->
                                match tryStatic iv ins known knownMem with
                                | None -> err <- Some "isaspec specializeMem: dynamic write index not supported"
                                | Some idx ->
                                    match tryStatic vv ins known knownMem with
                                    | Some v -> known.[idx] <- wrap v // fold (a static mem read folds here too)
                                    | None ->
                                        for r in readsInKnown vv ins known knownMem do
                                            residual.Add(loadImm r known.[r])
                                        residual.Add ins
                                        known.Remove idx |> ignore
                            | _ -> err <- Some "isaspec specializeMem: setreg operands"
                        | Some(DynamicValue.String "setmem") ->
                            match DynamicValue.get "addr" eff, DynamicValue.get "val" eff with
                            | Some av, Some vv ->
                                match tryStatic av ins known knownMem with
                                | None -> err <- Some "isaspec specializeMem: dynamic memory address not in the fragment"
                                | Some addr ->
                                    match tryStatic vv ins known knownMem with
                                    | Some v -> knownMem.[addr] <- wrap v // fold into known memory
                                    | None ->
                                        for r in readsInKnown vv ins known knownMem do
                                            residual.Add(loadImm r known.[r])
                                        residual.Add ins
                                        knownMem.Remove addr |> ignore // cell goes dynamic
                            | _ -> err <- Some "isaspec specializeMem: setmem operands"
                        | _ -> err <- Some "isaspec specializeMem: only setreg/setmem/halt in the straight-line fragment"
                    | true, _ -> err <- Some(sprintf "isaspec specializeMem: op '%s' is not single-effect (control flow / multi-effect)" opName)
            match err with
            | Some e -> Error e
            | None ->
                let knownRegMap = known |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                let knownMemMap = knownMem |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                Ok(DynamicValue.Array(List.ofSeq residual), knownRegMap, knownMemMap)
        | _ -> Error "isaspec: program must be an array of instructions"
