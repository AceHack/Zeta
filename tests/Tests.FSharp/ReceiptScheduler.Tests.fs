module Zeta.Core.Tests.ReceiptScheduler

open System.Threading.Tasks
open Xunit
open Zeta.Core

// ── helpers ────────────────────────────────────────────────────────────────────────────────────

/// A trivial inner state: just an int counter.
type Counter = { N: int }

/// A handler that increments the counter by 1 on every TimerElapsed tick.
let counterHandler : SoftScheduler.Handler<Counter> =
    SoftScheduler.handler
        "counter"
        (function TimerElapsed _ -> true | _ -> false)
        (fun _ctx st -> Task.FromResult(Ok { N = st.N + 1 }))

/// IV function: the counter went from prior.N to posterior.N; IV = ln(posterior.N / max(prior.N,1)).
/// (Positive when the counter increases, zero when it stays flat.)
let ivFn (prior: Counter) (posterior: Counter) : float =
    if posterior.N > prior.N then
        log (float posterior.N / float (max prior.N 1))
    else 0.0

/// Entropy function: 0.0 (deterministic counter — no uncertainty).
let entropyFn (_st: Counter) : float = 0.0

/// A bare IntrCtx for tests.
let private ctx : IntrCtx =
    { Memetic = "test"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

// ── SCHED-1: wrapper emits a receipt per tick ──────────────────────────────────────────────────

[<Fact>]
let ``SCHED-1: wrapHandler emits a receipt on each matched tick`` () =
    task {
        let receipts = System.Collections.Generic.List<ComputeReceipt.Receipt>()
        let wrapped =
            ReceiptScheduler.wrapHandler
                ivFn 1.0 entropyFn
                (Some receipts.Add)
                counterHandler
        let initial = ReceiptScheduler.receipted { N = 1 }
        let! result = wrapped.Run ctx initial
        match result with
        | Ok st ->
            Assert.Equal(1, st.Tick)
            Assert.Equal(1, receipts.Count)
            // The receipt's DeltaJ should be exactly 1.0 (one abstract joule per tick)
            Assert.Equal(1.0, receipts.[0].DeltaJ)
        | Error e -> Assert.Fail(sprintf "unexpected error: %A" e)
    } :> Task

// ── SCHED-2: heat tick counted when IV = 0 ────────────────────────────────────────────────────

/// A handler that does NOT change the counter (IV = 0 → DeltaU = -DeltaJ < 0 → heat tick).
let noOpHandler : SoftScheduler.Handler<Counter> =
    SoftScheduler.handler
        "no-op"
        (function TimerElapsed _ -> true | _ -> false)
        (fun _ctx st -> Task.FromResult(Ok st))

[<Fact>]
let ``SCHED-2: heat tick is counted when IV = 0`` () =
    task {
        let wrapped =
            ReceiptScheduler.wrapHandler
                ivFn 1.0 entropyFn None noOpHandler
        let initial = ReceiptScheduler.receipted { N = 5 }
        let! result = wrapped.Run ctx initial
        match result with
        | Ok st ->
            Assert.Equal(1, st.HeatTicks)
            Assert.Equal(0, st.ProfitTicks)
            // DeltaU = IV - DeltaJ = 0 - 1 = -1
            Assert.Equal(-1.0, st.LastReceipt.Value.DeltaU)
        | Error e -> Assert.Fail(sprintf "unexpected error: %A" e)
    } :> Task

// ── SCHED-3: profit tick counted when IV > DeltaJ ─────────────────────────────────────────────

/// A handler that jumps the counter by a large amount so IV >> DeltaJ.
let bigJumpHandler : SoftScheduler.Handler<Counter> =
    SoftScheduler.handler
        "big-jump"
        (function TimerElapsed _ -> true | _ -> false)
        (fun _ctx st -> Task.FromResult(Ok { N = st.N * 100 }))

[<Fact>]
let ``SCHED-3: profit tick is counted when IV > DeltaJ`` () =
    task {
        let wrapped =
            ReceiptScheduler.wrapHandler
                ivFn 1.0 entropyFn None bigJumpHandler
        // Start at N=1 → jump to N=100; IV = ln(100/1) ≈ 4.6 >> DeltaJ=1.0
        let initial = ReceiptScheduler.receipted { N = 1 }
        let! result = wrapped.Run ctx initial
        match result with
        | Ok st ->
            Assert.Equal(0, st.HeatTicks)
            Assert.Equal(1, st.ProfitTicks)
            Assert.True(st.LastReceipt.Value.DeltaU > 0.0)
        | Error e -> Assert.Fail(sprintf "unexpected error: %A" e)
    } :> Task

// ── SCHED-4: TotalIV and TotalDeltaJ accumulate over multiple ticks ───────────────────────────

[<Fact>]
let ``SCHED-4: TotalIV and TotalDeltaJ accumulate correctly over 5 ticks`` () =
    task {
        let wrapped =
            ReceiptScheduler.wrapHandler
                ivFn 1.0 entropyFn None counterHandler
        // Run 5 ticks manually (each tick increments N by 1, starting at N=1)
        let mutable st = ReceiptScheduler.receipted { N = 1 }
        for _ in 1 .. 5 do
            let! result = wrapped.Run ctx st
            match result with
            | Ok s -> st <- s
            | Error e -> Assert.Fail(sprintf "unexpected error: %A" e)
        Assert.Equal(5, st.Tick)
        Assert.Equal(5.0, st.TotalDeltaJ)
        // TotalIV = sum of ln(n+1/n) for n=1..5 = ln(2)+ln(3/2)+ln(4/3)+ln(5/4)+ln(6/5) = ln(6)
        let expectedTotalIV = log 6.0
        Assert.InRange(st.TotalIV, expectedTotalIV - 1e-9, expectedTotalIV + 1e-9)
    } :> Task

// ── SCHED-5: adaptiveIntervalMultiplier backs off on heat, speeds up on profit ────────────────

[<Fact>]
let ``SCHED-5: adaptiveIntervalMultiplier returns > 1 on heat tick and < 1 on profit tick`` () =
    // Heat tick: DeltaU = -1.0 → backoff
    let heatReceipt = ComputeReceipt.fromIV 0.0 1.0 0.0
    let heatState =
        { ReceiptScheduler.receipted { N = 0 } with
            LastReceipt = Some heatReceipt }
    let heatMult =
        ReceiptScheduler.adaptiveIntervalMultiplier 2.0 0.5 0.1 10.0 heatState
    Assert.True(heatMult > 1.0, sprintf "expected backoff > 1.0, got %f" heatMult)

    // Profit tick: DeltaU = 3.6 (IV=4.6, DeltaJ=1.0) → speed up
    let profitReceipt = ComputeReceipt.fromIV 4.6 1.0 0.0
    let profitState =
        { ReceiptScheduler.receipted { N = 0 } with
            LastReceipt = Some profitReceipt }
    let profitMult =
        ReceiptScheduler.adaptiveIntervalMultiplier 2.0 0.5 0.1 10.0 profitState
    Assert.True(profitMult < 1.0, sprintf "expected speedup < 1.0, got %f" profitMult)
