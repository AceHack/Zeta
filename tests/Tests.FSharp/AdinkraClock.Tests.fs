module Zeta.Tests.AdinkraClockTests

open Xunit
open Zeta.Core

// The fork-probe experiment (Aaron 2026-07-11, "lets try this"): does ∂_τ = {Q,Q} fall out as a
// VirtualTimeScheduler.AdvanceBy? These tests pin the honest outcome so it can't drift.

[<Fact>]
let ``Q on a boson raises to a fermion with no clock tick (up-edge)`` () =
    let s', tick = AdinkraClock.step AdinkraClock.initial
    Assert.Equal(AdinkraClock.Fermion, s'.Field)
    Assert.False(tick)
    Assert.Equal(0, s'.DTauOrder)

[<Fact>]
let ``Q on a fermion lowers to a boson and emits one d_tau (down-edge = clock tick)`` () =
    let fermion = { AdinkraClock.Field = AdinkraClock.Fermion; AdinkraClock.DTauOrder = 0 }
    let s', tick = AdinkraClock.step fermion
    Assert.Equal(AdinkraClock.Boson, s'.Field)
    Assert.True(tick)
    Assert.Equal(1, s'.DTauOrder)

[<Fact>]
let ``anticommutator {Q,Q} on the vacuum = one d_tau = one scheduler AdvanceBy(1)`` () =
    let scheduler = VirtualTimeScheduler()
    let finalState, clockAdvance = AdinkraClock.anticommutatorTick scheduler
    // Round-trip φ→ψ→φ̇ returns to a boson carrying exactly one ∂_τ...
    Assert.Equal(AdinkraClock.Boson, finalState.Field)
    Assert.Equal(1, finalState.DTauOrder)
    // ...and the injected clock advanced by exactly one tick. Q² = ∂_τ ↔ AdvanceBy(1).
    Assert.Equal(1L, clockAdvance)

[<Fact>]
let ``the d_tau count is intrinsic to the graph — computable with NO scheduler (layer B holds)`` () =
    // 3 full round-trips = 6 Q moves = 3 down-edges = 3 ∂_τ, computed with no clock at all.
    let s = AdinkraClock.runIntrinsic 6
    Assert.Equal(AdinkraClock.Boson, s.Field)
    Assert.Equal(3, s.DTauOrder)

[<Theory>]
[<InlineData(1)>]
[<InlineData(5)>]
[<InlineData(42)>]
let ``probe verdict is LayeringBToA — structure intrinsic (B) AND clock = injected advance (A-when-run), and they agree``
    (k: int)
    =
    let verdict, injectedClock, intrinsic = AdinkraClock.probe k
    // The clock the injected scheduler shows...
    Assert.Equal(int64 k, injectedClock)
    // ...equals the ∂_τ count the pure graph produces with no clock...
    Assert.Equal(k, intrinsic)
    // ...so time is neither in the graph (B) nor purely the run (A): it is the B→A transition.
    Assert.Equal(AdinkraClock.LayeringBToA, verdict)

// Lumen's Q4 discriminator (metric-freeness = fps-invariance). UNLIKE `probe`, this can fail — the
// negative control proves it. This is the honest repair of the #9713 tautology.

[<Fact>]
let ``the real adinkra step is metric-free — its frame sequence is invariant under fps rescale (Layer B holds)`` () =
    // Same animation at "1 tick/frame" and "7 ticks/frame": identical causal trace ⇒ metric-free.
    Assert.True(AdinkraClock.isMetricFree AdinkraClock.stepPure 6)

[<Fact>]
let ``the discriminator can FAIL — a step that reads the clock is NOT metric-free (Layer B violated)`` () =
    // The negative control overwrites DTauOrder with the injected metric, so its trace changes with
    // the fps. If this returned true the whole test would be tautological — it must be false.
    Assert.False(AdinkraClock.isMetricFree AdinkraClock.stepMetricDependent 6)

[<Fact>]
let ``metric-free traces differ ONLY in the injected clock, never in the causal frame sequence`` () =
    // The frame sequence (States) is identical under two fps; only scheduler.Now (the metric) differs.
    let traceFast = AdinkraClock.traceUnder AdinkraClock.stepPure 1L 6
    let traceSlow = AdinkraClock.traceUnder AdinkraClock.stepPure 7L 6
    Assert.Equal<AdinkraClock.State list>(traceFast, traceSlow)
