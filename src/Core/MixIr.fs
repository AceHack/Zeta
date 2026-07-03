namespace Zeta.Core

/// **MixIr — reifying `mix` as data (the 3rd Futamura projection, slice 1: shadow*).**
/// (Aaron 2026-07-03: "yes, start reifying mix-as-data.")
///
/// The 3rd projection wants `mix` to be a value `mix` can consume, so `mix(mix, mix)` is a real
/// computation and `gen(gen) == gen` is a byte-lockable fixpoint — NOT the trivial currying reading
/// (which holds for free by referential transparency and says nothing). Getting there is a walk, not
/// a leap; this is the first honest step.
///
/// **What this slice does.** The native `IsaSpec.specializeMem` still had one non-data parameter — the
/// `loadImm` builder (a native closure that emits "set register r to constant v" when a static read is
/// materialized). This slice turns it into DATA: a `loadImm` *descriptor* the meta-runner reads. With
/// that, EVERY input to `mix` is a `DynamicValue` — the ISA spec, the program, the static state, AND
/// the materialization strategy — so a whole mix invocation is a single serializable `MixCall` value,
/// and `runMixCall` executes it. The mix is now a pure data→data transformation.
///
/// **The fixpoint (the real `gen(gen) == gen`).** A residual is a fixed point of `mix(·, ∅)`: running
/// the mix again, with nothing left static to fold, reproduces the residual byte-for-byte. So
/// `mix(mix(p, s), ∅) == mix(p, s)` — idempotence, machine-checked. This is the ISA-side analogue of
/// the parser-side `Cogen` fixpoint (`regenerate == direct`).
///
/// **Honest scope (named, not hidden).** This makes the mix *data-parameterized and self-idempotent*;
/// it does NOT yet reify the mix ALGORITHM into the IR (the loops/decision procedure are still native
/// F#). The deeper slice — expressing the partial evaluator itself as an IR program that `mix` can
/// specialize (true self-application) — is the next rung. This slice removes the last native *value*
/// from the mix's interface and lands the fixpoint law.
///
/// Anchors: Futamura (1971, the 3rd projection / cogen); Ershov (mixed computation); the parser-side
/// `Cogen` (`gen(gen)==gen` already proven there). Built on `IsaSpec`. Consumes only `DynamicValue`.
[<RequireQualifiedAccess>]
module MixIr =

    // ── the loadImm builder, now DATA ──

    /// A `loadImm` descriptor is one of two shapes (both `DynamicValue`):
    ///   single-op : `{ op, regInto, immInto }`  — one instruction sets any register (CHIP-8's `SET`).
    ///   per-reg   : `{ perReg:[{r,op}], immInto }` — a distinct op per register (the 6502's LDA/LDX/LDY).
    /// `buildLoad desc r v` fills it in: the instruction that sets register `r` to constant `v`.
    let buildLoad (desc: DynamicValue) (r: int) (v: int) : DynamicValue =
        let immField =
            match DynamicValue.get "immInto" desc with
            | Some(DynamicValue.String s) -> s
            | _ -> "imm"
        match DynamicValue.get "perReg" desc with
        | Some(DynamicValue.Array entries) ->
            let opName =
                entries
                |> List.tryPick (fun e ->
                    match DynamicValue.get "r" e, DynamicValue.get "op" e with
                    | Some(DynamicValue.Int rr), Some(DynamicValue.String o) when int rr = r -> Some o
                    | _ -> None)
                |> Option.defaultValue "NOP"
            DynamicValue.Object [ "op", DynamicValue.String opName; immField, DynamicValue.Int(int64 v) ]
        | _ ->
            let opName =
                match DynamicValue.get "op" desc with
                | Some(DynamicValue.String s) -> s
                | _ -> "NOP"
            let regField =
                match DynamicValue.get "regInto" desc with
                | Some(DynamicValue.String s) -> s
                | _ -> "x"
            DynamicValue.Object [ "op", DynamicValue.String opName; regField, DynamicValue.Int(int64 r); immField, DynamicValue.Int(int64 v) ]

    /// The load descriptors for our two ISAs — the mix's materialization strategy, as data.
    let chip8Load: DynamicValue =
        DynamicValue.Object [ "op", DynamicValue.String "SET"; "regInto", DynamicValue.String "x"; "immInto", DynamicValue.String "nn" ]

    let mos6502Load: DynamicValue =
        DynamicValue.Object
            [ "perReg",
              DynamicValue.Array
                  [ DynamicValue.Object [ "r", DynamicValue.Int 0L; "op", DynamicValue.String "LDA_IMM" ]
                    DynamicValue.Object [ "r", DynamicValue.Int 1L; "op", DynamicValue.String "LDX_IMM" ]
                    DynamicValue.Object [ "r", DynamicValue.Int 2L; "op", DynamicValue.String "LDY_IMM" ] ]
              "immInto", DynamicValue.String "imm" ]

    // ── register/memory maps ↔ DynamicValue (key-sorted array = canonical, byte-lockable) ──

    let private mapToDv (m: Map<int, int>) : DynamicValue =
        DynamicValue.Array
            [ for k in Map.toList m |> List.map fst |> List.sort do
                  DynamicValue.Object [ "k", DynamicValue.Int(int64 k); "v", DynamicValue.Int(int64 (Map.find k m)) ] ]

    let private mapOfDv (dv: DynamicValue) : Map<int, int> =
        match dv with
        | DynamicValue.Array xs ->
            xs
            |> List.choose (fun o ->
                match DynamicValue.get "k" o, DynamicValue.get "v" o with
                | Some(DynamicValue.Int k), Some(DynamicValue.Int v) -> Some(int k, int v)
                | _ -> None)
            |> Map.ofList
        | _ -> Map.empty

    // ── mix, driven entirely by data ──

    /// Run the mix with a DATA loadImm descriptor (the last native value removed from the interface).
    /// Thin over `IsaSpec.specializeMem`: identical result, but the materialization strategy is now a
    /// `DynamicValue` (`loadDesc`) rather than a native closure.
    let runMix
        (spec: DynamicValue)
        (loadDesc: DynamicValue)
        (program: DynamicValue)
        (staticRegs: Map<int, int>)
        (staticMem: Map<int, int>)
        : Result<DynamicValue * Map<int, int> * Map<int, int>, string> =
        IsaSpec.specializeMem spec (fun r v -> buildLoad loadDesc r v) program staticRegs staticMem

    /// Reify a whole mix invocation as ONE `DynamicValue` — the spec, the load descriptor, the program,
    /// and the static register/memory state, all as data. A `MixCall` is serializable and byte-lockable.
    let mixCall (spec: DynamicValue) (loadDesc: DynamicValue) (program: DynamicValue) (staticRegs: Map<int, int>) (staticMem: Map<int, int>) : DynamicValue =
        DynamicValue.Object
            [ "kind", DynamicValue.String "mix"
              "spec", spec
              "load", loadDesc
              "program", program
              "regs", mapToDv staticRegs
              "mem", mapToDv staticMem ]

    /// Execute a reified `MixCall`, returning a DATA result `{ residual, knownRegs, knownMem }`. Input
    /// data → output data: the mix is now a pure `DynamicValue → DynamicValue` transformation.
    let runMixCall (call: DynamicValue) : Result<DynamicValue, string> =
        match DynamicValue.get "spec" call, DynamicValue.get "load" call, DynamicValue.get "program" call with
        | Some spec, Some loadDesc, Some program ->
            let staticRegs = DynamicValue.get "regs" call |> Option.map mapOfDv |> Option.defaultValue Map.empty
            let staticMem = DynamicValue.get "mem" call |> Option.map mapOfDv |> Option.defaultValue Map.empty
            match runMix spec loadDesc program staticRegs staticMem with
            | Ok(residual, knownRegs, knownMem) ->
                Ok(
                    DynamicValue.Object
                        [ "residual", residual
                          "knownRegs", mapToDv knownRegs
                          "knownMem", mapToDv knownMem ]
                )
            | Error e -> Error e
        | _ -> Error "mixir: malformed MixCall (needs spec, load, program)"

    /// Extract the residual program from a `runMixCall` result.
    let residualOf (result: DynamicValue) : DynamicValue option = DynamicValue.get "residual" result
