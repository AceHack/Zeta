module Zeta.Tests.MixIrTests

// REIFYING mix-AS-DATA — the 3rd Futamura projection, slice 1 (shadow*, Aaron 2026-07-03: "yes,
// start reifying mix-as-data"). The mix's last native parameter (the loadImm builder) becomes a data
// descriptor, so a whole mix invocation is one serializable MixCall value and the mix is a pure
// data→data transformation. Proofs:
//   1. FAITHFUL (CHIP-8): runMixCall reproduces native specializeMem byte-for-byte with a DATA loadImm.
//   2. FAITHFUL (6502): same, over the memory-bearing ISA with its per-register load descriptor.
//   3. THE FIXPOINT gen(gen)==gen: a residual is a fixed point of mix(·, ∅) — mixing it again with
//      nothing static reproduces it exactly. So mix(mix(p,s), ∅) == mix(p,s), machine-checked.
//   4. A MixCall IS BYTE-LOCKABLE DATA — the whole reified mix invocation rides the codec stack.
//
// Anchors: Futamura (1971, cogen); Ershov (mixed computation); the parser-side Cogen (gen(gen)==gen).

open global.Xunit
open Zeta.Core

let private residual (call: DynamicValue) : DynamicValue =
    match MixIr.runMixCall call with
    | Ok r ->
        match MixIr.residualOf r with
        | Some res -> res
        | None -> failwith "no residual in result"
    | Error e -> failwithf "runMixCall failed: %s" e

[<Fact>]
let ``FAITHFUL (CHIP-8): the data-driven mix reproduces native specializeMem byte-for-byte`` () =
    // Straight-line: V0 folds static, V1 goes dynamic via ADDR (materializes V0 through the DATA loadImm).
    let p = Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]
    let statics = Map.empty
    let native =
        match IsaSpec.specialize IsaSpec.chip8 Isa.set p statics with
        | Ok(res, _) -> res
        | Error e -> failwithf "native specialize failed: %s" e
    let viaData = residual (MixIr.mixCall IsaSpec.chip8 MixIr.chip8Load p statics Map.empty)
    Assert.Equal<DynamicValue>(native, viaData)

[<Fact>]
let ``FAITHFUL (6502): the data-driven mix reproduces native specializeMem over the memory ISA`` () =
    let p =
        DynamicValue.Array
            [ IsaSpec.staZp 10; IsaSpec.ldaZp 10; IsaSpec.adcImm 5; IsaSpec.staZp 11; IsaSpec.adcZp 20; IsaSpec.staZp 12; IsaSpec.brk ]
    let statics = Map.ofList [ 0, 7 ]
    let native =
        match IsaSpec.specializeMem IsaSpec.mos6502 IsaSpec.load6502 p statics Map.empty with
        | Ok(res, _, _) -> res
        | Error e -> failwithf "native specializeMem failed: %s" e
    let viaData = residual (MixIr.mixCall IsaSpec.mos6502 MixIr.mos6502Load p statics Map.empty)
    Assert.Equal<DynamicValue>(native, viaData)

[<Fact>]
let ``THE FIXPOINT gen(gen)==gen: a residual is a fixed point of mix(., empty)`` () =
    // Mix a program, then mix the residual again with NOTHING static — it must reproduce itself.
    let cases =
        [ IsaSpec.chip8, MixIr.chip8Load, Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ], Map.ofList [ 0, 9 ]
          IsaSpec.mos6502, MixIr.mos6502Load, DynamicValue.Array [ IsaSpec.ldaImm 4; IsaSpec.staZp 3; IsaSpec.adcZp 30; IsaSpec.staZp 4; IsaSpec.brk ], Map.empty ]
    for (spec, load, p, statics) in cases do
        let once = residual (MixIr.mixCall spec load p statics Map.empty)
        let twice = residual (MixIr.mixCall spec load once Map.empty Map.empty)
        Assert.Equal<DynamicValue>(once, twice) // mix(mix(p,s), empty) == mix(p,s)

[<Fact>]
let ``A MixCall IS BYTE-LOCKABLE DATA: the reified mix invocation rides the codec stack`` () =
    let call = MixIr.mixCall IsaSpec.mos6502 MixIr.mos6502Load (DynamicValue.Array [ IsaSpec.ldaImm 1; IsaSpec.brk ]) (Map.ofList [ 0, 2 ]) Map.empty
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] call)

// ── slice 2: the mix ALGORITHM as data (shadow*, Aaron 2026-07-03 "this sounds great lets continue").
// specializeMem's per-effect decision (setreg→registers, setmem→memory, halt→drop) was F# match arms;
// now it is a `mixDef` rule table read by a fixed engine. Proofs:
//   5. FAITHFUL: specializeReified defaultMixDef = specializeMem, byte-for-byte (CHIP-8 and 6502).
//   6. ONE ALGORITHM, EVERY ISA: the SAME defaultMixDef value drives both ISAs (it is over the effect
//      vocabulary, not opcodes) — the partial-evaluation algorithm is a single data object.
//   7. THE ALGORITHM IS BYTE-LOCKABLE DATA: defaultMixDef rides the codec stack.

let private reifiedResidual mixDef spec load p statics =
    match MixIr.runReifiedMix mixDef spec load p statics Map.empty with
    | Ok(res, _, _) -> res
    | Error e -> failwithf "runReifiedMix failed: %s" e

let private nativeMemResidual spec load p statics =
    match IsaSpec.specializeMem spec load p statics Map.empty with
    | Ok(res, _, _) -> res
    | Error e -> failwithf "native specializeMem failed: %s" e

[<Fact>]
let ``FAITHFUL: the reified algorithm reproduces native specializeMem byte-for-byte (both ISAs)`` () =
    let chip8P = Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]
    Assert.Equal<DynamicValue>(
        nativeMemResidual IsaSpec.chip8 Isa.set chip8P Map.empty,
        reifiedResidual MixIr.defaultMixDef IsaSpec.chip8 MixIr.chip8Load chip8P Map.empty
    )
    let m6502P =
        DynamicValue.Array [ IsaSpec.staZp 10; IsaSpec.ldaZp 10; IsaSpec.adcImm 5; IsaSpec.staZp 11; IsaSpec.adcZp 20; IsaSpec.staZp 12; IsaSpec.brk ]
    Assert.Equal<DynamicValue>(
        nativeMemResidual IsaSpec.mos6502 IsaSpec.load6502 m6502P (Map.ofList [ 0, 7 ]),
        reifiedResidual MixIr.defaultMixDef IsaSpec.mos6502 MixIr.mos6502Load m6502P (Map.ofList [ 0, 7 ])
    )

[<Fact>]
let ``ONE ALGORITHM, EVERY ISA: the same mixDef value drives CHIP-8 and the 6502`` () =
    // The identical defaultMixDef object specializes correctly for two different ISAs.
    let chip8P = Isa.prog [ Isa.set 0 9; Isa.addr 1 0; Isa.halt ]
    let m6502P = DynamicValue.Array [ IsaSpec.ldaImm 9; IsaSpec.staZp 3; IsaSpec.adcZp 30; IsaSpec.brk ]
    let a = reifiedResidual MixIr.defaultMixDef IsaSpec.chip8 MixIr.chip8Load chip8P Map.empty
    let b = reifiedResidual MixIr.defaultMixDef IsaSpec.mos6502 MixIr.mos6502Load m6502P Map.empty
    Assert.Equal<DynamicValue>(nativeMemResidual IsaSpec.chip8 Isa.set chip8P Map.empty, a)
    Assert.Equal<DynamicValue>(nativeMemResidual IsaSpec.mos6502 IsaSpec.load6502 m6502P Map.empty, b)

[<Fact>]
let ``THE ALGORITHM IS BYTE-LOCKABLE DATA: defaultMixDef rides the codec stack`` () =
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] MixIr.defaultMixDef)
