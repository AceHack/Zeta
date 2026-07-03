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
    let ldaZp addr = DynamicValue.Object [ "op", DynamicValue.String "LDA_ZP"; "addr", DynamicValue.Int(int64 addr) ]
    let staZp addr = DynamicValue.Object [ "op", DynamicValue.String "STA_ZP"; "addr", DynamicValue.Int(int64 addr) ]
    let tax = DynamicValue.Object [ "op", DynamicValue.String "TAX" ]
    let inx = DynamicValue.Object [ "op", DynamicValue.String "INX" ]
    let adcImm nn = DynamicValue.Object [ "op", DynamicValue.String "ADC_IMM"; "imm", DynamicValue.Int(int64 nn) ]
    let ske nn = DynamicValue.Object [ "op", DynamicValue.String "SKE"; "imm", DynamicValue.Int(int64 nn) ]
    let jmp addr = DynamicValue.Object [ "op", DynamicValue.String "JMP"; "addr", DynamicValue.Int(int64 addr) ]
    let brk = DynamicValue.Object [ "op", DynamicValue.String "BRK" ]

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
    let rec private tryStatic (v: DynamicValue) (ins: DynamicValue) (known: System.Collections.Generic.Dictionary<int, int>) : int option =
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
                match tryStatic iv ins known with
                | Some idx ->
                    match known.TryGetValue idx with
                    | true, x -> Some x
                    | _ -> None
                | None -> None
            | _ -> None
        | Some(DynamicValue.String "add") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b ->
                match tryStatic a ins known, tryStatic b ins known with
                | Some x, Some y -> Some(x + y)
                | _ -> None
            | _ -> None
        | Some(DynamicValue.String "sub") ->
            match DynamicValue.get "a" v, DynamicValue.get "b" v with
            | Some a, Some b ->
                match tryStatic a ins known, tryStatic b ins known with
                | Some x, Some y -> Some(x - y)
                | _ -> None
            | _ -> None
        | _ -> None

    /// Register indices read inside `v` that are currently static (in `known`) — to materialize.
    let rec private readsInKnown (v: DynamicValue) (ins: DynamicValue) (known: System.Collections.Generic.Dictionary<int, int>) : int list =
        match DynamicValue.get "v" v with
        | Some(DynamicValue.String "reg") ->
            match DynamicValue.get "i" v with
            | Some iv ->
                let deeper = readsInKnown iv ins known
                match tryStatic iv ins known with
                | Some idx when known.ContainsKey idx -> idx :: deeper
                | _ -> deeper
            | None -> []
        | Some(DynamicValue.String "add")
        | Some(DynamicValue.String "sub") ->
            let a = DynamicValue.get "a" v |> Option.map (fun x -> readsInKnown x ins known) |> Option.defaultValue []
            let b = DynamicValue.get "b" v |> Option.map (fun x -> readsInKnown x ins known) |> Option.defaultValue []
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
                                match tryStatic iv ins known with
                                | None -> err <- Some "isaspec specialize: dynamic write index not supported"
                                | Some idx ->
                                    match tryStatic vv ins known with
                                    | Some v -> known.[idx] <- wrap v // fold
                                    | None ->
                                        // dynamic: materialize static reads, emit the op as-is, write goes dynamic
                                        for r in readsInKnown vv ins known do
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
