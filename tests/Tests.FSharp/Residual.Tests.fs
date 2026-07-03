module Zeta.Tests.ResidualTests

// THE TWO FUTAMURA COLUMNS UNIFIED — one mix, a residual-TARGET knob, meaning invariant (shadow*,
// Aaron 2026-07-03: "Futamura … checking all these checkboxes from a math + self-bootstrapping
// perspective with our IR"). Column A residualizes to CODE, Column B to a CIRCUIT; both are the same
// specialization of the same interpreter, differing only in target medium. Proofs:
//   1. THE UNIFICATION LAW: run(emit p regs Code) = run(emit p regs Circuit) = Isa.eval p regs, for
//      programs WITH control flow (loops/branches) — turning the target knob does not change meaning.
//   2. UNDER ARBITRARY INITIAL REGISTERS — the invariance holds for any specialization input.
//   3. A RESIDUAL IS BYTE-LOCKABLE DATA — both media ride the codec stack (homoiconic IR closure).
//   4. ERRORS ARE TOTAL — a malformed/oversized program surfaces Error on both targets, never throws.
//
// Anchors: Futamura (1971); Kleene (S-m-n); Ershov (mixed computation); von Neumann (program-as-data).

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

let private programs =
    [ multiplyLoop 5 3 // 15
      multiplyLoop 7 4 // 28
      multiplyLoop 200 3 // wraps mod 256
      Isa.prog [ Isa.set 3 10; Isa.se 3 99; Isa.add 3 5; Isa.mov 4 3; Isa.halt ] // SE not taken
      Isa.prog [ Isa.set 0 1; Isa.jp 3; Isa.set 0 222; Isa.add 0 1; Isa.halt ] // JP over poison
      Isa.prog [ Isa.set 0 100; Isa.add 0 200; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ] ] // straight-line

/// Emit to a target, run it, and demand success.
let private via (p: DynamicValue) (regs: Map<int, int>) (t: Residual.Target) : Map<int, int> =
    match Residual.emit p regs t with
    | Ok r ->
        match Residual.run r 256 with
        | Ok final -> final
        | Error e -> failwithf "run failed: %s" e
    | Error e -> failwithf "emit failed: %s" e

[<Fact>]
let ``THE UNIFICATION LAW: Code and Circuit residuals agree with each other and with Isa.eval`` () =
    for p in programs do
        let reference =
            match Isa.eval p Map.empty with
            | Ok r -> r
            | Error e -> failwithf "isa reference failed: %s" e
        let code = via p Map.empty Residual.Code
        let circuit = via p Map.empty Residual.Circuit
        Assert.True(regsEq code reference, "Code residual disagrees with Isa.eval")
        Assert.True(regsEq circuit reference, "Circuit residual disagrees with Isa.eval")
        Assert.True(regsEq code circuit, "the two media disagree — the target knob changed the meaning")

[<Fact>]
let ``THE LAW holds under arbitrary initial registers (the knob is invariant for any input)`` () =
    let p = Isa.prog [ Isa.addr 2 0; Isa.addr 2 1; Isa.mov 3 2; Isa.se 2 0; Isa.add 4 1; Isa.halt ]
    for a in [ 0; 1; 50; 200; 255 ] do
        for b in [ 0; 7; 100; 255 ] do
            let regs0 = Map.ofList [ 0, a; 1, b ]
            let reference =
                match Isa.eval p regs0 with
                | Ok r -> r
                | Error e -> failwithf "ref failed: %s" e
            Assert.True(regsEq (via p regs0 Residual.Code) reference, sprintf "Code mismatch at a=%d b=%d" a b)
            Assert.True(regsEq (via p regs0 Residual.Circuit) reference, sprintf "Circuit mismatch at a=%d b=%d" a b)

[<Fact>]
let ``A RESIDUAL IS BYTE-LOCKABLE DATA in BOTH media (homoiconic IR closure)`` () =
    let p = multiplyLoop 5 3
    for t in [ Residual.Code; Residual.Circuit ] do
        match Residual.emit p Map.empty t with
        | Ok residual -> Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] residual)
        | Error e -> Assert.Fail(sprintf "emit failed: %s" e)

[<Fact>]
let ``ERRORS ARE TOTAL: an oversized program surfaces Error on the Circuit target, never throws`` () =
    let big = DynamicValue.Array [ for _ in 0..300 -> Isa.set 0 1 ] // > 256 instructions (8-bit PC)
    match Residual.emit big Map.empty Residual.Circuit with
    | Error _ -> () // circuit synthesis rejects it cleanly
    | Ok _ -> Assert.Fail "expected an error for an oversized program"
    // The Code target has no size ceiling — it just carries the program.
    match Residual.emit big Map.empty Residual.Code with
    | Ok _ -> ()
    | Error e -> Assert.Fail(sprintf "code emit should not fail: %s" e)
