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

    let setReg (i: DynamicValue) (value: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "setreg"; "i", i; "val", value ]

    let setPc (target: DynamicValue) = DynamicValue.Object [ "e", DynamicValue.String "setpc"; "to", target ]

    let ifEqSkip (a: DynamicValue) (b: DynamicValue) =
        DynamicValue.Object [ "e", DynamicValue.String "ifeqskip"; "a", a; "b", b ]

    let halt = DynamicValue.Object [ "e", DynamicValue.String "halt" ]

    let op (name: string) (effects: DynamicValue list) =
        DynamicValue.Object [ "op", DynamicValue.String name; "eff", DynamicValue.Array effects ]

    let isa (ops: DynamicValue list) = DynamicValue.Object [ "ops", DynamicValue.Array ops ]

    // ── value evaluation ──

    let rec private evalVal (v: DynamicValue) (ins: DynamicValue) (regs: System.Collections.Generic.Dictionary<int, int>) : Result<int, string> =
        let binop f a b =
            match evalVal a ins regs, evalVal b ins regs with
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
                evalVal iv ins regs
                |> Result.map (fun idx ->
                    match regs.TryGetValue idx with
                    | true, x -> x
                    | _ -> 0)
            | _ -> Error "isaspec: reg without index"
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

    /// Interpret a program under an ISA given as data. Absent registers default 0; register writes
    /// wrap mod 256; a step budget guards loops. An opcode with no spec entry is an error.
    let evalSpec (isaSpec: DynamicValue) (program: DynamicValue) (regs0: Map<int, int>) : Result<Map<int, int>, string> =
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
                                    match evalVal iv ins regs, evalVal vv ins regs with
                                    | Ok idx, Ok value -> regs.[idx] <- wrap value
                                    | Error m, _
                                    | _, Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setreg operands"
                            | Some(DynamicValue.String "setpc") ->
                                match DynamicValue.get "to" e with
                                | Some tv ->
                                    match evalVal tv ins regs with
                                    | Ok p ->
                                        pc <- p
                                        pcSet <- true
                                    | Error m -> err <- Some m
                                | _ -> err <- Some "isaspec: setpc operand"
                            | Some(DynamicValue.String "ifeqskip") ->
                                match DynamicValue.get "a" e, DynamicValue.get "b" e with
                                | Some av, Some bv ->
                                    match evalVal av ins regs, evalVal bv ins regs with
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
            | None -> Ok(regs |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq)
        | _ -> Error "isaspec: program must be an array of instructions"

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
