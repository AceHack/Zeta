module Zeta.Tests.MixCogenTests

// mix(mix, mix) — the compiler-as-data + the compiler-generator, honestly (shadow*, Aaron 2026-07-03:
// "back to the ladder for mix(mix,mix) self-application"). cogen emits a compiler for an ISA as a
// byte-lockable data value; compile runs it. Proofs:
//   1. THE GENERATED COMPILER COMPILES: compile (cogen spec) program = native specializeMem, byte-
//      for-byte (CHIP-8 + 6502) — the 2nd projection realized as data.
//   2. cogen IS DETERMINISTIC (gen(gen)==gen at the generation level): same inputs → byte-identical
//      compiler; and the compiler is byte-lockable data.
//   3. THE THREE RUNGS AGREE: compile(cogen …) = runFullyReifiedMix = native specializeMem.
//   4. A COMPILER IS SHIVA-COLLECTIBLE: an unreferenced generated compiler is reclaimed by the GC
//      (a compiler is a reified row in the database of intelligence).
//
// Honest boundary (docstring): projections realized as DATA over the reified config; the universal
// driver stays native (bounded reify) — NOT literal mix-is-an-ISA-program self-application.
//
// Anchors: Futamura (1971, the projections); Ershov; the parser-side Cogen (regenerate == direct).

open global.Xunit
open Zeta.Core

let private v (s: string) = DynamicValue.String s

let private compileResidual compiler program statics =
    match MixCogen.compile compiler program statics Map.empty with
    | Ok r -> (match MixCogen.residualOf r with Some res -> res | None -> failwith "no residual")
    | Error e -> failwithf "compile failed: %s" e

let private nativeResidual spec load program statics =
    match IsaSpec.specializeMem spec load program statics Map.empty with
    | Ok(res, _, _) -> res
    | Error e -> failwithf "native specializeMem failed: %s" e

[<Fact>]
let ``THE GENERATED COMPILER COMPILES: compile (cogen spec) = native specializeMem (both ISAs)`` () =
    // CHIP-8
    let chip8Compiler = MixCogen.cogen IsaSpec.chip8 MixIr.chip8Load
    let chip8P = Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]
    Assert.Equal<DynamicValue>(nativeResidual IsaSpec.chip8 Isa.set chip8P Map.empty, compileResidual chip8Compiler chip8P Map.empty)
    // 6502
    let m6502Compiler = MixCogen.cogen IsaSpec.mos6502 MixIr.mos6502Load
    let m6502P = DynamicValue.Array [ IsaSpec.staZp 10; IsaSpec.ldaZp 10; IsaSpec.adcImm 5; IsaSpec.staZp 11; IsaSpec.adcZp 20; IsaSpec.staZp 12; IsaSpec.brk ]
    Assert.Equal<DynamicValue>(nativeResidual IsaSpec.mos6502 IsaSpec.load6502 m6502P (Map.ofList [ 0, 7 ]), compileResidual m6502Compiler m6502P (Map.ofList [ 0, 7 ]))

[<Fact>]
let ``cogen IS DETERMINISTIC: same inputs yield a byte-identical compiler (gen(gen)==gen)`` () =
    let a = MixCogen.cogen IsaSpec.mos6502 MixIr.mos6502Load
    let b = MixCogen.cogen IsaSpec.mos6502 MixIr.mos6502Load
    Assert.Equal<DynamicValue>(a, b) // regenerating the compiler gives the same data
    // and the compiler is byte-lockable — a first-class, shippable value.
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] a)

[<Fact>]
let ``THE THREE RUNGS AGREE: compile(cogen ...) = runFullyReifiedMix = native specializeMem`` () =
    let p = DynamicValue.Array [ IsaSpec.ldaImm 4; IsaSpec.staZp 3; IsaSpec.adcZp 30; IsaSpec.staZp 4; IsaSpec.brk ]
    let compiler = MixCogen.cogen IsaSpec.mos6502 MixIr.mos6502Load
    let viaCompiler = compileResidual compiler p Map.empty
    let viaFullyReified =
        match MixIr.runFullyReifiedMix MixIr.defaultMixDef MixIr.defaultEvalDef IsaSpec.mos6502 MixIr.mos6502Load p Map.empty Map.empty with
        | Ok(res, _, _) -> res
        | Error e -> failwithf "runFullyReifiedMix failed: %s" e
    let viaNative = nativeResidual IsaSpec.mos6502 IsaSpec.load6502 p Map.empty
    Assert.Equal<DynamicValue>(viaNative, viaCompiler)
    Assert.Equal<DynamicValue>(viaNative, viaFullyReified) // the whole ladder is one answer

[<Fact>]
let ``A COMPILER IS SHIVA-COLLECTIBLE: an unreferenced generated compiler is reclaimed by the GC`` () =
    // A compiler is a reified row in the database of intelligence — keyed and collectible.
    let heap =
        ShivaGc.heap
            [ ShivaGc.object' "toolchain" (v "t") [ "active-compiler" ]
              ShivaGc.object' "active-compiler" (MixCogen.cogen IsaSpec.mos6502 MixIr.mos6502Load) []
              ShivaGc.object' "stale-compiler" (MixCogen.cogen IsaSpec.chip8 MixIr.chip8Load) [] ] // nothing points at it
    let _, collected = ShivaGc.collect [ "toolchain" ] heap
    Assert.Equal<string list>([ "stale-compiler" ], collected) // the unreferenced compiler is reclaimed (paused)
