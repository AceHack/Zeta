module Zeta.Tests.SoftChip8SchedulerTests

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

// ROM at 0x200: 6A 0C (V[A] = 0x0C) ; 12 02 (jump 0x202 — tight infinite loop).
let private setRegRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]

// ROM at 0x200: 60 05 (V0=5) ; F0 15 (Delay=V0) ; 12 04 (jump 0x204 — loop, timers keep ticking).
let private delayRom = [| 0x60uy; 0x05uy; 0xF0uy; 0x15uy; 0x12uy; 0x04uy |]

let private get (r: Result<Chip8Cow.Frame, InterruptFeedback>) =
    match r with
    | Ok f -> f
    | Error e -> failwithf "scheduler errored: %A" e

[<Fact>]
let ``CHIP-8 runs on the soft scheduler: the CPU steps and sets V[A]`` () =
    task {
        let! r = SoftChip8Scheduler.run 1UL setRegRom 5
        let f = get r
        Assert.Equal(0x0Cuy, f.V.[0xA])
    }

[<Fact>]
let ``deterministic replay: same (seed, rom, frames) => identical frame (DST)`` () =
    task {
        let! a = SoftChip8Scheduler.run 42UL setRegRom 30
        let! b = SoftChip8Scheduler.run 42UL setRegRom 30
        let fa, fb = get a, get b
        Assert.Equal(fa.PC, fb.PC)
        Assert.Equal<byte[]>(fa.V, fb.V)
        Assert.Equal(fa.Delay, fb.Delay)
    }

[<Fact>]
let ``the 60Hz timer interrupt decrements the delay timer to zero over frames`` () =
    task {
        // delay set to 5 on frame 1; each subsequent TimerElapsed decrements it. 20 frames => 0.
        let! r = SoftChip8Scheduler.run 7UL delayRom 20
        Assert.Equal(0uy, (get r).Delay)
    }

[<Fact>]
let ``the delay timer is still counting down partway (proves the timer ISR fires per frame)`` () =
    task {
        // frame 1: tick (delay 0->0), then CPU sets Delay=5. frame 2: tick 5->4. ... frame k: 5-(k-1).
        let! r = SoftChip8Scheduler.run 7UL delayRom 3
        Assert.Equal(3uy, (get r).Delay) // 5 - (3-1) = 3
    }

[<Fact>]
let ``cyclesPerTick governs CPU advance: 0 cycles => CPU never steps (V[A] stays 0)`` () =
    task {
        let! r = SoftChip8Scheduler.runWith 0 1UL setRegRom 5
        Assert.Equal(0uy, (get r).V.[0xA]) // timers tick, but the CPU is held at DoP-of-cycles=0
    }

// ── ComputeReceipt telemetry tests (small rooms — Eve's principle) ────────────────────────────────
// Each test is one property; one failure = one cause.

[<Fact>]
let ``SCR-1: runWithReceipt returns a Some receipt for a deterministic ROM`` () =
    task {
        let! _result, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 5
        Assert.True(Option.isSome receipt, "receipt should be Some for a valid ROM")
    }

[<Fact>]
let ``SCR-2: runWithReceipt result matches run result (receipt does not change the frame)`` () =
    task {
        let! runResult = SoftChip8Scheduler.run 1UL setRegRom 5
        let! receiptResult, _ = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 5
        let rf = get runResult
        let rr = get receiptResult
        Assert.Equal(rf.PC, rr.PC)
        Assert.Equal<byte[]>(rf.V, rr.V)
    }

[<Fact>]
let ``SCR-3: deterministic ROM has IV >= 0 (no negative information)`` () =
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        Assert.True(r.IV >= 0.0, sprintf "IV should be >= 0, got %f" r.IV)
    }

[<Fact>]
let ``SCR-4: deterministic ROM has DeltaJ > 0 (compute was spent)`` () =
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        Assert.True(r.DeltaJ > 0.0, sprintf "DeltaJ should be > 0, got %f" r.DeltaJ)
    }

[<Fact>]
let ``SCR-5: DeltaU = IV - DeltaJ (net useful work identity holds)`` () =
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        let expected = r.IV - r.DeltaJ
        Assert.True(abs (r.DeltaU - expected) < 1e-9, sprintf "DeltaU identity failed: %f vs %f" r.DeltaU expected)
    }

[<Fact>]
let ``SCR-6: LandauerRatio >= 0 (efficiency is non-negative)`` () =
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        Assert.True(r.LandauerRatio >= 0.0, sprintf "LandauerRatio should be >= 0, got %f" r.LandauerRatio)
    }

[<Fact>]
let ``SCR-7: deterministic ROM (tight loop, no input branch) has IV = 0 (no uncertainty resolved)`` () =
    // setRegRom is a tight loop with no input branch — the prior is a point-mass, so IV = 0.
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        // IV should be 0 because the prior is already a point-mass (deterministic ROM, no input branch).
        Assert.True(r.IV < 1e-9, sprintf "IV should be ~0 for deterministic ROM, got %f" r.IV)
    }

[<Fact>]
let ``SCR-8: deterministic ROM has Heat = DeltaJ (all compute is wasted when IV = 0)`` () =
    task {
        let! _, receipt = SoftChip8Scheduler.runWithReceipt 1UL setRegRom 10
        let r = receipt.Value
        Assert.True(abs (r.Heat - r.DeltaJ) < 1e-9, sprintf "Heat should equal DeltaJ when IV=0, got Heat=%f DeltaJ=%f" r.Heat r.DeltaJ)
    }
