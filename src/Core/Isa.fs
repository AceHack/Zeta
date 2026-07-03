namespace Zeta.Core

/// **Isa — a minimal universal CHIP-8-shaped ISA interpreter over `DynamicValue`, and the first
/// *general* `mix`.** (Aaron 2026-07-02: "how do we make this general and intrinsic hardware?" →
/// the two-column ferry named this as the pivot rung: a universal interpreter both columns share.)
///
/// The in-domain Futamura ladder (#9266/#9269/#9271) specialized ONE interpreter — the LR parser.
/// This is the irreducible generalization step: a **universal interpreter** whose PROGRAMS ARE DATA
/// (`DynamicValue`), so a single `mix` specializes *it* — Futamura generally, not per-grammar. It is
/// CHIP-8-shaped on purpose: the ISA is the pivot that also opens the hardware column (specialize
/// this interpreter to a *program* ⇒ a compiled program; the same move with a netlist target ⇒ a
/// circuit — the residual *target* is a knob).
///
/// **The interpreter** (`eval`) runs a small register machine: 16 byte registers `V0..VF` (CHIP-8
/// semantics, values mod 256), a program counter, a step budget. Opcodes (CHIP-8 lineage in
/// brackets): `SET Vx nn` [6xkk] · `ADD Vx nn` [7xkk] · `MOV Vx Vy` [8xy0] · `ADDR Vx Vy` [8xy4,
/// carry elided] · `SE Vx nn` [3xkk, skip-if-equal] · `JP addr` [1nnn] · `HALT`. Instructions are
/// `DynamicValue.Object`s — homoiconic, so `mix` reads and emits them as data.
///
/// **The first general `mix`** (`specialize`) is **online partial evaluation** (binding-time
/// analysis integrated into specialization — Jones/Gomard/Sestoft's *online* PE, no separate BTA
/// pass): given some registers known statically, symbolically execute, **folding** static ops to
/// constants and **residualizing** dynamic ops (e.g. `ADDR Vx Vy` with static `Vy` becomes the
/// immediate `ADD Vx nn`). Scope (honest): `specialize` handles the **straight-line fragment**
/// (`SET ADD MOV ADDR HALT`); control flow (`SE JP`) is a residual boundary and rejected — a later
/// rung generalizes it. `eval` runs the full set.
///
/// **The correctness law** (the S-m-n / mix equation, machine-checked): for a straight-line `p` and
/// a static/dynamic split of the registers,
///
///     eval (fst (specialize p static)) dynamic  ⊕  (snd (specialize p static))  =  eval p (static ∪ dynamic)
///
/// i.e. running the residual on the dynamic input, overlaid with the folded static registers, equals
/// running the original on the full input. This is Kleene's S-m-n realized: `mix` is a practical
/// effective specializer, now over a *universal* interpreter.
///
/// Anchors: Kleene (S-m-n, 1938 — a general specializer exists) · Futamura (1971) · Ershov (mixed
/// computation) · Jones/Gomard/Sestoft (*Partial Evaluation*, 1993 — online vs offline PE) · CHIP-8
/// (the ISA lineage). Consumes only `DynamicValue`.
[<RequireQualifiedAccess>]
module Isa =

    /// CHIP-8 byte wrap (registers are 8-bit).
    let private wrap (v: int) : int = ((v % 256) + 256) % 256

    // ── instruction constructors (programs are DynamicValue — homoiconic) ──

    let private i (v: int) = DynamicValue.Int(int64 v)
    let private opObj (fields: (string * DynamicValue) list) = DynamicValue.Object fields

    let set (x: int) (nn: int) = opObj [ "op", DynamicValue.String "SET"; "x", i x; "nn", i nn ]
    let add (x: int) (nn: int) = opObj [ "op", DynamicValue.String "ADD"; "x", i x; "nn", i nn ]
    let mov (x: int) (y: int) = opObj [ "op", DynamicValue.String "MOV"; "x", i x; "y", i y ]
    let addr (x: int) (y: int) = opObj [ "op", DynamicValue.String "ADDR"; "x", i x; "y", i y ]
    let se (x: int) (nn: int) = opObj [ "op", DynamicValue.String "SE"; "x", i x; "nn", i nn ]
    let jp (addr: int) = opObj [ "op", DynamicValue.String "JP"; "addr", i addr ]
    let halt = opObj [ "op", DynamicValue.String "HALT" ]

    /// A program is an array of instructions.
    let prog (instrs: DynamicValue list) : DynamicValue = DynamicValue.Array instrs

    // ── shared field readers ──

    let private opOf (ins: DynamicValue) : string =
        match DynamicValue.get "op" ins with
        | Some(DynamicValue.String s) -> s
        | _ -> "?"

    let private fieldOf (k: string) (ins: DynamicValue) : int option =
        match DynamicValue.get k ins with
        | Some(DynamicValue.Int v) -> Some(int v)
        | _ -> None

    // ── the interpreter ──

    [<Literal>]
    let private stepBudget = 1_000_000

    /// Run a program from an initial register map (absent registers default 0). Returns the final
    /// register map (byte-wrapped), or an error (bad operands / unknown op / step-budget overrun).
    let eval (program: DynamicValue) (regs0: Map<int, int>) : Result<Map<int, int>, string> =
        match program with
        | DynamicValue.Array instrs ->
            let code = List.toArray instrs
            let regs = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in regs0 do
                regs.[k] <- wrap v
            let getr x =
                match regs.TryGetValue x with
                | true, v -> v
                | _ -> 0
            let setr x v = regs.[x] <- wrap v
            let mutable pc = 0
            let mutable steps = 0
            let mutable halted = false
            let mutable err = None
            while not halted && pc >= 0 && pc < code.Length && err.IsNone do
                steps <- steps + 1
                if steps > stepBudget then
                    err <- Some "isa: step budget exceeded (loop?)"
                else
                    let ins = code.[pc]
                    match opOf ins with
                    | "SET" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn -> setr x nn
                                             pc <- pc + 1
                        | _ -> err <- Some "isa: SET operands"
                    | "ADD" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn -> setr x (getr x + nn)
                                             pc <- pc + 1
                        | _ -> err <- Some "isa: ADD operands"
                    | "MOV" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y -> setr x (getr y)
                                            pc <- pc + 1
                        | _ -> err <- Some "isa: MOV operands"
                    | "ADDR" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y -> setr x (getr x + getr y)
                                            pc <- pc + 1
                        | _ -> err <- Some "isa: ADDR operands"
                    | "SE" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn -> pc <- pc + (if getr x = nn then 2 else 1)
                        | _ -> err <- Some "isa: SE operands"
                    | "JP" ->
                        match fieldOf "addr" ins with
                        | Some a -> pc <- a
                        | _ -> err <- Some "isa: JP operand"
                    | "HALT" -> halted <- true
                    | other -> err <- Some(sprintf "isa: unknown op '%s'" other)
            match err with
            | Some e -> Error e
            | None -> Ok(regs |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq)
        | _ -> Error "isa: program must be an array of instructions"

    // ── the first general `mix`: online partial evaluation (straight-line fragment) ──

    /// Partial-evaluate a straight-line program w.r.t. statically-known register values. Returns the
    /// residual program (`DynamicValue`) and the folded static registers (`known`). Online PE: static
    /// ops fold to constants; dynamic ops residualize (with static operands substituted as
    /// immediates). Rejects control flow (`SE`/`JP`) — the straight-line fragment only.
    let specialize (program: DynamicValue) (statics: Map<int, int>) : Result<DynamicValue * Map<int, int>, string> =
        match program with
        | DynamicValue.Array instrs ->
            let known = System.Collections.Generic.Dictionary<int, int>()
            for KeyValue(k, v) in statics do
                known.[k] <- wrap v
            let residual = System.Collections.Generic.List<DynamicValue>()
            // when a static register must go dynamic, reify its folded value first (SET), then drop it
            let materialize x =
                match known.TryGetValue x with
                | true, v ->
                    residual.Add(set x v)
                    known.Remove x |> ignore
                | _ -> ()
            let mutable err = None
            for ins in instrs do
                if err.IsNone then
                    match opOf ins with
                    | "SET" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn -> known.[x] <- wrap nn // becomes static
                        | _ -> err <- Some "isa: SET operands"
                    | "ADD" ->
                        match fieldOf "x" ins, fieldOf "nn" ins with
                        | Some x, Some nn ->
                            if known.ContainsKey x then known.[x] <- wrap (known.[x] + nn) // fold
                            else residual.Add(add x nn) // Vx dynamic
                        | _ -> err <- Some "isa: ADD operands"
                    | "MOV" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y ->
                            if known.ContainsKey y then known.[x] <- known.[y] // Vx := static Vy
                            else
                                known.Remove x |> ignore // Vx becomes dynamic (overwritten by dynamic Vy)
                                residual.Add(mov x y)
                        | _ -> err <- Some "isa: MOV operands"
                    | "ADDR" ->
                        match fieldOf "x" ins, fieldOf "y" ins with
                        | Some x, Some y ->
                            let kx = known.ContainsKey x
                            let ky = known.ContainsKey y
                            if kx && ky then known.[x] <- wrap (known.[x] + known.[y]) // fold
                            elif (not kx) && ky then residual.Add(add x known.[y]) // ADDR w/ static Vy ⇒ ADD immediate
                            elif kx && (not ky) then
                                materialize x // reify Vx's folded value, then dynamic add
                                residual.Add(addr x y)
                            else residual.Add(addr x y) // both dynamic
                        | _ -> err <- Some "isa: ADDR operands"
                    | "HALT" -> () // straight-line: no residual effect
                    | other -> err <- Some(sprintf "isa specialize: op '%s' not in the straight-line fragment" other)
            match err with
            | Some e -> Error e
            | None ->
                let knownMap = known |> Seq.map (fun (KeyValue(k, v)) -> k, v) |> Map.ofSeq
                Ok(DynamicValue.Array(List.ofSeq residual), knownMap)
        | _ -> Error "isa: program must be an array of instructions"
