module Zeta.Tests.SequentialTests

// COLUMN B, RUNG 3 — clocked sequential logic (shadow*, Aaron 2026-07-03: "next please continue
// building column b" → the sequential-logic fork). State that persists and evolves across clock
// cycles, purely through gates + feedback. Proofs:
//   1. COUNTER — an 8-bit counter's state = k mod 256 after k clocks (state evolves by +1/cycle).
//   2. ACCUMULATOR — an 8-bit accumulator's state = (k*x) mod 256 after k clocks with fixed input x.
//   3. SEQ CIRCUIT IS BYTE-LOCKABLE DATA — a sequential circuit rides the codec stack.
//
// Anchors: Huffman/Mealy/Moore (finite-state machines); the D flip-flop; Lava/Chisel.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``COUNTER: state = k mod 256 after k clock cycles (state persists and evolves by +1)`` () =
    let c = Sequential.counter 8
    for k in [ 0; 1; 5; 100; 255; 256; 257; 300 ] do
        match Sequential.run c Map.empty k with
        | Ok state -> Assert.Equal(k % 256, Netlist.intOf "q" 8 state)
        | Error e -> Assert.Fail(sprintf "counter run failed at k=%d: %s" k e)

[<Fact>]
let ``ACCUMULATOR: state = (k*x) mod 256 after k clocks with fixed external input x`` () =
    let c = Sequential.accumulator 8
    for x in [ 1; 3; 7; 50 ] do
        for k in [ 0; 1; 4; 10; 60 ] do
            let external = Netlist.bitsOf "x" 8 x
            match Sequential.run c external k with
            | Ok state -> Assert.Equal((k * x) % 256, Netlist.intOf "q" 8 state)
            | Error e -> Assert.Fail(sprintf "accumulator run failed at x=%d k=%d: %s" x k e)

[<Fact>]
let ``SEQ CIRCUIT IS BYTE-LOCKABLE DATA: a sequential circuit rides the codec stack`` () =
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] (Sequential.counter 8))
