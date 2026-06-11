module Zeta.Tests.Chip9SelfTraceTests

// The smallest fully-self-reflective system: CHIP-9 ray-traces its own running instruction set onto
// its own planes (R=executed, G=data, B=speculation) — and can READ its own worldline through its own
// ISA (DRW collision = "have I been here?"). Soft mode, full ISA to the bone, tiny.

open global.Xunit
open Zeta.Core

// the BREATHE-style loop: I=0x208; draw; jump back — a closed worldline.
let private loopRom = [| 0xA2uy; 0x08uy; 0xD0uy; 0x01uy; 0x12uy; 0x00uy; 0x00uy; 0x00uy; 0xFFuy |]
let private frame () = Chip8Cow.create 7UL |> Chip8Cow.loadRom loopRom

[<Fact>]
let ``the executed path paints GREEN on the machine's own planes (mono stays the program's)`` () =
    let f = Chip9SelfTrace.run 0 3 (frame ())
    // PCs 0x200,0x202,0x204 -> slots 0,1,2 -> cells (0,0),(1,0),(2,0): G bit set
    Assert.True(Chip8Cow.colorAt 0 0 f &&& 2uy <> 0uy)
    Assert.True(Chip8Cow.colorAt 1 0 f &&& 2uy <> 0uy)
    Assert.True(Chip8Cow.colorAt 2 0 f &&& 2uy <> 0uy)
    Assert.Equal(0uy, Chip8Cow.colorAt 10 0 f &&& 6uy) // unvisited code: no trace channels lit

[<Fact>]
let ``the loop's worldline CLOSES: more steps add no new trace cells (the cycle is visible)`` () =
    let short = Chip9SelfTrace.run 0 3 (frame ())
    let long = Chip9SelfTrace.run 0 30 (frame ())
    let traceCells (f: Chip8Cow.Frame) =
        Set.ofList [ for x in 0..63 do for y in 0..31 do if Chip8Cow.colorAt x y f &&& 2uy <> 0uy then yield x, y ]
    Assert.Equal<Set<int * int>>(traceCells short, traceCells long) // the attractor, painted

[<Fact>]
let ``data flow paints CYAN: the sprite read via I shows on G|B`` () =
    let f = Chip9SelfTrace.run 0 2 (frame ()) // step 2 executes DRW which reads 0x208
    let gx, gy = Chip9SelfTrace.cellOf 0x208
    Assert.Equal(6uy, Chip8Cow.colorAt gx gy f &&& 6uy)

[<Fact>]
let ``speculation paints BLUE ahead of execution (the future, fork-honest)`` () =
    let f = Chip9SelfTrace.traceStep 2 (frame ()) // before executing 0x200, speculate 2 ahead
    let b1x, b1y = Chip9SelfTrace.cellOf 0x202
    let b2x, b2y = Chip9SelfTrace.cellOf 0x204
    Assert.True(Chip8Cow.colorAt b1x b1y f &&& 4uy <> 0uy)
    Assert.True(Chip8Cow.colorAt b2x b2y f &&& 4uy <> 0uy)

[<Fact>]
let ``THE JEWEL: the machine reads its own worldline THROUGH its own ISA — DRW collision says "I was here"`` () =
    // run the loop self-tracing, then have the MACHINE probe its own trace: select plane 1 (R),
    // draw a 1-pixel sprite at cell (0,0) — VF=1 iff the trace already lit that cell (it did: PC 0x200).
    let traced = Chip9SelfTrace.run 0 6 (frame ())
    let probeRom =
        [| 0xF2uy; 0x01uy // plane := 2 (the executed-path channel — G)
           0x60uy; 0x00uy; 0x61uy; 0x00uy // V0=0, V1=0 (cell 0,0 — its own first instruction's cell)
           0xA3uy; 0x00uy // I = 0x300 (probe sprite)
           0xD0uy; 0x11uy |] // draw 1 row at (0,0) -> collision iff its own past is there
    let probed =
        probeRom
        |> Array.indexed
        |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (0x200 + i) b m.Mem }) traced
        |> fun f0 -> { f0 with Mem = Map.add 0x300 0x80uy f0.Mem; PC = uint16 0x200 }
        |> fun f0 -> List.fold (fun acc _ -> Chip8Cow.step acc) f0 [ 1..5 ]
    Assert.Equal(1uy, probed.V.[0xF]) // "yes — I have been here": self-reflection via the ISA itself

[<Fact>]
let ``deterministic: the self-trace replays bit-identically (soft mode, DST to the bone)`` () =
    Assert.Equal<Chip8Cow.Frame>(Chip9SelfTrace.run 2 12 (frame ()), Chip9SelfTrace.run 2 12 (frame ()))

[<Fact>]
let ``THE DEEP VIEW (SelfTrace x PixelLens): the drawn past survives honest colorize; the foreseen future collapses`` () =
    // ONE trace step: the PC's cell is painted executed (G), the lookahead cells are painted
    // foreseen (B) and have NOT yet executed — pure future. (A longer run closes the loop and the
    // future becomes past everywhere — itself the honest behavior.)
    let f = Chip9SelfTrace.traceStep 2 (frame ())
    let deep = Chip9SelfTrace.deepView f
    // an executed cell: certain — colorize keeps its full color
    let gx, gy = Chip9SelfTrace.cellOf 0x200
    let gCell = Map.find (gx, gy) deep
    Assert.Equal(0, PixelLens.uncertainty.Get gCell)
    Assert.Equal(PixelLens.color.Get gCell, PixelLens.colorize 500 gCell)
    // a speculative-only cell: 900 milli uncertain — colorize collapses it below the mono bit
    let specCells =
        deep |> Map.filter (fun _ c -> PixelLens.uncertainty.Get c = 900)
    Assert.False(Map.isEmpty specCells) // the future was foreseen somewhere
    for KeyValue(_, c) in specCells do
        Assert.Equal(0uy, PixelLens.colorize 500 c &&& 6uy) // no trace channel survives
        Assert.Equal(PixelLens.color.Get c &&& 1uy, PixelLens.colorize 500 c) // mono stays the program's
    // and the payload rides with the pixel: the slot index is readable through the lens
    Assert.Equal(gy * 64 + gx, PixelLens.payload.Get gCell)

// ── greenfield correctness pass (2026-06-13): hot-path totality + the fault register ──

[<Fact>]
let ``TOTAL DIV: fix16 divide-by-zero saturates by sign, never throws (Result-over-exception on the hot path)`` () =
    Assert.Equal(System.Int32.MaxValue, Chip9Phys.div (Chip9Phys.ofInt 5) 0)
    Assert.Equal(System.Int32.MinValue, Chip9Phys.div (Chip9Phys.ofInt -5) 0)
    Assert.Equal(System.Int32.MaxValue, Chip9Phys.div 0 0) // 0 >= 0 -> +max, deterministic
    // and a normal divide still works
    Assert.Equal(Chip9Phys.ofInt 2, Chip9Phys.div (Chip9Phys.ofInt 6) (Chip9Phys.ofInt 3))

[<Fact>]
let ``THE FAULT REGISTER: 00EE on an empty stack is RECORDED, not silently swallowed (the machine never hides a fault)`` () =
    // 00EE (RET) as the very first instruction: nothing was ever CALLed, so the stack is empty
    let rom = [| 0x00uy; 0xEEuy |]
    let f = Chip8Cow.create 7UL |> Chip8Cow.loadRom rom |> Chip8Cow.step
    match f.Fault with
    | Some msg -> Assert.Contains("underflow", msg)
    | None -> Assert.True(false, "stack underflow was swallowed — the fault register stayed None")
    // a healthy program keeps Fault = None
    let healthy = Chip8Cow.create 7UL |> Chip8Cow.loadRom [| 0x60uy; 0x05uy |] |> Chip8Cow.step
    Assert.Equal<string option>(None, healthy.Fault)

[<Fact>]
let ``THE STACK-DEPTH FAULT: the 17th nested CALL is refused and recorded; 16 deep stays healthy (the underflow's pair)`` () =
    // rom: address 0x200 holds CALL 0x200 — infinite self-call; each step pushes one frame
    let f0 = Chip8Cow.create 7UL |> Chip8Cow.loadRom [| 0x22uy; 0x00uy |]
    let after16 = [ 1..16 ] |> List.fold (fun f _ -> Chip8Cow.step f) f0
    Assert.Equal<string option>(None, after16.Fault) // 16 deep: classic budget, healthy
    Assert.Equal(16, List.length after16.Stack)
    let after17 = Chip8Cow.step after16
    Assert.Equal(16, List.length after17.Stack) // the 17th CALL refused — no growth
    Assert.Contains("overflow", after17.Fault |> Option.defaultValue "")
