namespace Zeta.Core

/// **Residual — the two Futamura columns unified: ONE `mix`, a residual-TARGET knob, meaning invariant.**
/// (Aaron 2026-07-03: "Futamura … checking all these checkboxes from a math + self-bootstrapping
/// perspective with our IR." This is the checkbox that closes the two-column ferry on itself.)
///
/// The whole build has been walking the Futamura ladder over a homoiconic IR (`DynamicValue`):
///   - Column A specialized the universal interpreter to a program, residualizing to **code**
///     (`Isa.specialize` — online partial evaluation; the mix/S-m-n law is machine-checked).
///   - Column B specialized the SAME interpreter to the same program, residualizing to a **circuit**
///     (`CpuSynth.synthesize` — a gate-level CPU; `runFor = Isa.eval` is machine-checked).
///
/// Both columns are the same act of specialization; only the **residual target differs**. This module
/// makes that a single knob — `emit program regs target` — and states the law that turning the knob
/// does not change the meaning:
///
///     run (emit p regs Code)  =  run (emit p regs Circuit)  =  Isa.eval p regs        (for enough clocks)
///
/// i.e. the interpreted-code residual and the gate-circuit residual compute the SAME function as the
/// source. This is the ferry's thesis as an equation: **the residual target is a free choice of medium;
/// the specialized program's semantics are invariant under it.** Interpret it, or burn it to silicon —
/// same answer, from one `mix`. (The deeper per-column laws — the S-m-n static/dynamic fold for Code,
/// the exhaustive `adder`/`equal` proofs under Circuit — live in `Isa`/`Netlist`/`CpuSynth`; this module
/// is the join.)
///
/// A residual is `DynamicValue` like everything else — tagged, byte-lockable, DST-replayable. Anchors:
/// Futamura (1971, the projections) · Kleene (S-m-n) · Ershov (mixed computation) · von Neumann (the
/// program is data the machine reads — true of BOTH media here). Built on `Isa` + `CpuSynth`.
[<RequireQualifiedAccess>]
module Residual =

    /// The residual-target knob: which medium the specialized program is realized in.
    type Target =
        /// Interpreted code — the program stays `DynamicValue` instructions, run by `Isa.eval`.
        | Code
        /// A gate circuit — the program becomes a synthesized CPU (`CpuSynth`), run as clocked gates.
        | Circuit

    // ── register-map ↔ DynamicValue (key-sorted array = canonical, byte-lockable) ──

    let private regsToDv (regs: Map<int, int>) : DynamicValue =
        DynamicValue.Array
            [ for k in 0..15 do
                  match Map.tryFind k regs with
                  | Some v -> DynamicValue.Object [ "r", DynamicValue.Int(int64 k); "v", DynamicValue.Int(int64 v) ]
                  | None -> () ]

    let private regsOfDv (dv: DynamicValue) : Map<int, int> =
        match dv with
        | DynamicValue.Array xs ->
            xs
            |> List.choose (fun o ->
                match DynamicValue.get "r" o, DynamicValue.get "v" o with
                | Some(DynamicValue.Int r), Some(DynamicValue.Int v) -> Some(int r, int v)
                | _ -> None)
            |> Map.ofList
        | _ -> Map.empty

    // ── emit: one mix, the target is a knob ──

    /// Specialize `program` to the register state `regs`, realized in `target`. The residual is a
    /// self-contained, byte-lockable `DynamicValue`:
    ///   Code    → `{ target:"code", program, regs }` — the instructions + the state they run against.
    ///   Circuit → `{ target:"circuit", seqc }` — the synthesized gate CPU with `regs` baked into init.
    /// Errors only if the circuit synthesis does (e.g. a program over 256 instructions).
    let emit (program: DynamicValue) (regs: Map<int, int>) (target: Target) : Result<DynamicValue, string> =
        match target with
        | Code ->
            Ok(DynamicValue.Object [ "target", DynamicValue.String "code"; "program", program; "regs", regsToDv regs ])
        | Circuit ->
            match CpuSynth.synthesize program regs with
            | Ok seqc -> Ok(DynamicValue.Object [ "target", DynamicValue.String "circuit"; "seqc", seqc ])
            | Error e -> Error e

    // ── run: dispatch on the tag; both media compute the same function ──

    /// Run a residual to its final register map. `cycles` bounds the circuit clock (ignored by Code);
    /// it must exceed the program's dynamic step count (the CPU freezes on HALT / out-of-range, so
    /// surplus clocks are no-ops). By the unification law, the result is independent of the target.
    let run (residual: DynamicValue) (cycles: int) : Result<Map<int, int>, string> =
        match DynamicValue.get "target" residual with
        | Some(DynamicValue.String "code") ->
            match DynamicValue.get "program" residual, DynamicValue.get "regs" residual with
            | Some program, Some regsDv -> Isa.eval program (regsOfDv regsDv)
            | _ -> Error "residual: malformed code residual"
        | Some(DynamicValue.String "circuit") ->
            match DynamicValue.get "seqc" residual with
            | Some seqc ->
                match Sequential.run seqc Map.empty cycles with
                | Ok state -> Ok(CpuSynth.readRegs state)
                | Error e -> Error e
            | None -> Error "residual: malformed circuit residual"
        | _ -> Error "residual: unknown or missing target tag"
