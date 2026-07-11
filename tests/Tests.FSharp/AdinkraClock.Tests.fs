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
