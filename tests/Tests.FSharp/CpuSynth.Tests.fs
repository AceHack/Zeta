module Zeta.Tests.CpuSynthTests

// COLUMN B, RUNG 5 — the fully-synthesizable core: the ENTIRE next-state function is gates (shadow*,
// Aaron 2026-07-03: "continue with b as well"). Rung 4 left a seam (structural fetch + register
// addressing); this rung closes it — fetch (ROM mux), decode, 16:1 register-read mux, ALU, write-back
// mux, and next-PC are ALL boolean gates, clocked by Sequential.run. Proofs:
//   1. THE LAW: runFor p = Isa.eval p — the synthesized silicon computes what the interpreter does,
//      including branches and loops, at the gate level (no structural execution left).
//   2. ARBITRARY INITIAL REGISTERS — the gate register file reads/writes correctly for any inputs.
//   3. IT IS BYTE-LOCKABLE DATA — the whole CPU circuit rides the codec stack.
//
// Anchors: von Neumann (stored program = ROM) · Shannon 1937 (datapath + control as gates) · the
// fetch-decode-execute datapath · Mealy/Moore (PC = state).

open global.Xunit
open Zeta.Core

let private regsEq (a: Map<int, int>) (b: Map<int, int>) =
    [ 0..15 ]
    |> List.forall (fun r -> (Map.tryFind r a |> Option.defaultValue 0) = (Map.tryFind r b |> Option.defaultValue 0))

let private multiplyLoop (addend: int) (times: int) : DynamicValue =
    Isa.prog
        [ Isa.set 0 addend
          Isa.set 1 0
          Isa.set 2 0
          Isa.addr 2 0 // @3: V2 += V0
          Isa.add 1 1 // V1 += 1
          Isa.se 1 times // exit when counter hits `times`
          Isa.jp 3
          Isa.halt ]

[<Fact>]
let ``THE LAW: the fully-gate CPU equals Isa.eval on branch/loop/straight-line programs`` () =
    let programs =
        [ multiplyLoop 5 3 // 15
          multiplyLoop 7 4 // 28
          multiplyLoop 200 3 // 600 mod 256 = 88 (gate adder wrap)
          Isa.prog [ Isa.set 3 10; Isa.se 3 99; Isa.add 3 5; Isa.mov 4 3; Isa.halt ] // SE not taken
          Isa.prog [ Isa.set 0 1; Isa.jp 3; Isa.set 0 222; Isa.add 0 1; Isa.halt ] // JP over poison
          Isa.prog [ Isa.set 0 100; Isa.add 0 200; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ] // straight-line
          Isa.prog [ Isa.set 5 255; Isa.add 5 1; Isa.halt ] ] // 255+1 = 0 wrap
    for p in programs do
        match Isa.eval p Map.empty, CpuSynth.runFor p Map.empty 128 with
        | Ok r, Ok g -> Assert.True(regsEq r g, "synth CPU vs isa register mismatch")
        | Ok _, Error e -> Assert.Fail(sprintf "synth CPU errored where isa succeeded: %s" e)
        | _ -> Assert.Fail "eval/runFor disagreed on error"

[<Fact>]
let ``THE LAW holds under arbitrary initial registers (the gate register file addresses correctly)`` () =
    let p = Isa.prog [ Isa.addr 2 0; Isa.addr 2 1; Isa.mov 3 2; Isa.se 2 0; Isa.add 4 1; Isa.halt ]
    for a in [ 0; 1; 50; 200; 255 ] do
        for b in [ 0; 7; 100; 255 ] do
            let regs0 = Map.ofList [ 0, a; 1, b ]
            match Isa.eval p regs0, CpuSynth.runFor p regs0 64 with
            | Ok r, Ok g -> Assert.True(regsEq r g, sprintf "mismatch at a=%d b=%d" a b)
            | _ -> Assert.Fail(sprintf "disagreement at a=%d b=%d" a b)

[<Fact>]
let ``THE LAW cross-checks rung 4 (Cpu.runGate) — three CPU realizations agree`` () =
    let p = multiplyLoop 9 5 // 45
    match Isa.eval p Map.empty, Cpu.runGate p Map.empty, CpuSynth.runFor p Map.empty 128 with
    | Ok a, Ok b, Ok c -> Assert.True(regsEq a b && regsEq b c, "the three CPU realizations disagree")
    | _ -> Assert.Fail "a realization errored"

[<Fact>]
let ``THE SYNTHESIZED CPU IS BYTE-LOCKABLE DATA: the whole circuit rides the codec stack`` () =
    match CpuSynth.synthesize (multiplyLoop 5 3) Map.empty with
    | Ok seqc -> Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] seqc)
    | Error e -> Assert.Fail(sprintf "synthesize failed: %s" e)
