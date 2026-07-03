module Zeta.Tests.CpuTests

// COLUMN B, RUNG 4 — a clocked CPU: control flow (SE/JP/loops) on the gate datapath (shadow*,
// Aaron 2026-07-03: "continue with b as well"). Straight-line synthesis (rung 2) rejects SE/JP;
// this rung runs the FULL ISA by making the PC clocked state and carrying the arithmetic + branch
// condition through the gate netlists (Netlist.adder / Netlist.equal). Proofs:
//   1. CONTROL FLOW RUNS — a loop program (multiply-by-repeated-add) computes the right answer.
//   2. THE LAW: runGate p = Isa.eval p for every program, incl. branches/loops (the sequencer
//      composes the gate datapath correctly).
//   3. GATE DATAPATH — the arithmetic really flows through the adder circuit (differential vs +).
//   4. BOUNDARY / ERRORS — HALT stops; a bad program surfaces an error, never throws.
//
// Anchors: von Neumann (stored program) · fetch-decode-execute · Mealy/Moore (PC = state) · Shannon 1937.

open global.Xunit
open Zeta.Core

/// Compare two register maps on all 16 registers (absent = 0).
let private regsEq (a: Map<int, int>) (b: Map<int, int>) =
    [ 0..15 ]
    |> List.forall (fun r -> (Map.tryFind r a |> Option.defaultValue 0) = (Map.tryFind r b |> Option.defaultValue 0))

/// V2 = V0 * 3 by a loop: add V0 into V2 three times, counting in V1 and breaking with SE+JP.
let private multiplyLoop (addend: int) (times: int) : DynamicValue =
    Isa.prog
        [ Isa.set 0 addend // V0 = addend
          Isa.set 1 0 // V1 = counter
          Isa.set 2 0 // V2 = product
          // loop @ pc=3:
          Isa.addr 2 0 // V2 += V0
          Isa.add 1 1 // V1 += 1
          Isa.se 1 times // if V1 == times, skip the jump (exit)
          Isa.jp 3 // else loop
          Isa.halt ]

[<Fact>]
let ``CONTROL FLOW: a loop program (multiply by repeated add) computes the right answer`` () =
    match Cpu.runGate (multiplyLoop 5 3) Map.empty with
    | Ok regs ->
        Assert.Equal(15, Map.tryFind 2 regs |> Option.defaultValue 0) // 5*3
        Assert.Equal(3, Map.tryFind 1 regs |> Option.defaultValue 0) // counter reached 3
    | Error e -> Assert.Fail(sprintf "cpu loop failed: %s" e)

[<Fact>]
let ``THE LAW: runGate p = Isa.eval p for programs with branches and loops`` () =
    let programs =
        [ multiplyLoop 5 3
          multiplyLoop 7 4
          multiplyLoop 0 2 // 0 * 2 = 0
          multiplyLoop 200 3 // wraps mod 256 (600 mod 256 = 88)
          // SE NOT taken then taken; MOV; straight-line mixed with a jump forward
          Isa.prog [ Isa.set 3 10; Isa.se 3 99; Isa.add 3 5; Isa.mov 4 3; Isa.halt ]
          // JP forward over a poisoned instruction (never executed)
          Isa.prog [ Isa.set 0 1; Isa.jp 3; Isa.set 0 222; Isa.add 0 1; Isa.halt ]
          // pure straight-line still agrees
          Isa.prog [ Isa.set 0 100; Isa.add 0 200; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ] ]
    for p in programs do
        let ref = Isa.eval p Map.empty
        let got = Cpu.runGate p Map.empty
        match ref, got with
        | Ok r, Ok g -> Assert.True(regsEq r g, "cpu vs isa register mismatch")
        | Ok _, Error e -> Assert.Fail(sprintf "cpu errored where isa succeeded: %s" e)
        | Error _, Ok _ -> Assert.Fail "cpu succeeded where isa errored"
        | Error _, Error _ -> () // both reject — agreement

[<Fact>]
let ``THE LAW holds under arbitrary initial registers`` () =
    let p = Isa.prog [ Isa.addr 2 0; Isa.addr 2 1; Isa.se 2 0; Isa.add 3 1; Isa.halt ]
    for a in [ 0; 1; 50; 200; 255 ] do
        for b in [ 0; 3; 100; 255 ] do
            let regs0 = Map.ofList [ 0, a; 1, b ]
            match Isa.eval p regs0, Cpu.runGate p regs0 with
            | Ok r, Ok g -> Assert.True(regsEq r g, sprintf "mismatch at a=%d b=%d" a b)
            | _ -> Assert.Fail(sprintf "eval/runGate disagreed on error at a=%d b=%d" a b)

[<Fact>]
let ``GATE DATAPATH: arithmetic flows through the adder circuit (wraps mod 256 like the gates)`` () =
    // 200 + 100 = 300 -> 44 mod 256, exactly what the ripple-carry adder (dropped carry) yields.
    match Cpu.runGate (Isa.prog [ Isa.set 0 200; Isa.add 0 100; Isa.halt ]) Map.empty with
    | Ok regs -> Assert.Equal(44, Map.tryFind 0 regs |> Option.defaultValue 0)
    | Error e -> Assert.Fail(sprintf "cpu add-wrap failed: %s" e)

[<Fact>]
let ``BOUNDARY: HALT stops; a bad op surfaces an error and never throws`` () =
    match Cpu.runGate (Isa.prog [ Isa.set 0 1; Isa.halt; Isa.set 0 222 ]) Map.empty with
    | Ok regs -> Assert.Equal(1, Map.tryFind 0 regs |> Option.defaultValue 0) // never reached the SET after HALT
    | Error e -> Assert.Fail(sprintf "unexpected error: %s" e)
    let bad = DynamicValue.Array [ DynamicValue.Object [ "op", DynamicValue.String "BOGUS" ] ]
    match Cpu.runGate bad Map.empty with
    | Error _ -> () // rejected cleanly
    | Ok _ -> Assert.Fail "expected an error on an unknown op"
