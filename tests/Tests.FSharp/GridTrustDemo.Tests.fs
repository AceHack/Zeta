module Zeta.Tests.GridTrustDemoTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// GRID-TRUST DEMONSTRATION (the guardian thread — companion to
// docs/explainers/decorrelation-meter-grid-trust-for-max.md). Two operators, A = human-side and
// B = AI-side, act CONCURRENTLY each tick on a shared grid; the grid state MERGES both actions before the
// next tick (a fork-merge ladder), so the only causally-CONCURRENT (spacelike) pairs the shipped
// instrument meters are the same-tick (a_i, b_i) operator actions. We run the SHIPPED
// `DecorrelationExcessFusion` (the mature excess-over-null instrument) on two worlds:
//   • INDEPENDENT operators  ⇒ the instrument CLEARS them (excess ≈ the δ false-positive budget).
//   • a HIDDEN lockstep channel (a synchronized move neither disclosed) ⇒ the instrument FLAGS it.
// This is the "trust but verify — here, verify" claim made runnable: same deterministic code both sides
// re-run on the same open causal record, and a hidden coordination channel leaves a fingerprint neither
// can hide. Deterministic (DST — seeded splitmix, no ambient randomness).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/// Seeded splitmix64 — DST-deterministic, no `System.Random`.
let private mkGen (seed: uint64) =
    let mutable st = seed
    fun () ->
        st <- st + 0x9E3779B97F4A7C15UL
        let mutable z = st
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

/// Grid subsystems an action can touch (generation units, load zones, breakers).
let private subsystems =
    Array.concat
        [ [| for g in 0..5 -> sprintf "gen_%d" g |]
          [| for l in 0..5 -> sprintf "load_%d" l |]
          [| for b in 0..9 -> sprintf "breaker_%d" b |] ]

let private N = 40 // control-action ticks

let private prev i = if i = 0 then "g0" else sprintf "m%d" (i - 1)

// Fork-merge ladder: each tick forks a_i, b_i off the prior grid state m_{i-1}, then m_i merges both.
// ⇒ the ONLY spacelike (concurrent) pairs are the same-tick (a_i, b_i); everything else is causally ordered.
let private parents =
    [ yield "g0", []
      for i in 0 .. N - 1 do
          yield (sprintf "a%d" i), [ prev i ]
          yield (sprintf "b%d" i), [ prev i ]
          yield (sprintf "m%d" i), [ sprintf "a%d" i; sprintf "b%d" i ] ]
    |> Map.ofList

let private commits =
    "g0"
    :: [ for i in 0 .. N - 1 do
             yield sprintf "a%d" i
             yield sprintf "b%d" i
             yield sprintf "m%d" i ]

let private pick2 (g: unit -> uint64) =
    Set.ofList [ subsystems.[int (g () % uint64 subsystems.Length)]; subsystems.[int (g () % uint64 subsystems.Length)] ]

/// Per-tick touch-sets for both operators. `hiddenChannel = true` injects covert LOCKSTEP: on every 2nd
/// tick a hidden shared trigger makes BOTH operators take the SAME action — the synchronized move.
let private observables (hiddenChannel: bool) : Map<string, Set<string>> =
    let ga = mkGen 1001UL
    let a = [| for _ in 0 .. N - 1 -> pick2 ga |]
    let gb = mkGen 2002UL
    let b = [| for _ in 0 .. N - 1 -> pick2 gb |]
    if hiddenChannel then
        let gh = mkGen 424242UL
        for i in 0 .. N - 1 do
            if i % 2 = 0 then
                let shared = pick2 gh
                a.[i] <- shared
                b.[i] <- shared
    // Merge nodes m_i carry no touch-set ⇒ the instrument skips them; only (a_i, b_i) pairs are metered.
    [ yield "g0", Set.empty
      for i in 0 .. N - 1 do
          yield (sprintf "a%d" i), a.[i]
      for j in 0 .. N - 1 do
          yield (sprintf "b%d" j), b.[j] ]
    |> Map.ofList

// stratumKey = const 0: one stratum (this demo does not need Reichenbach era-conditioning — the tick
// depth would otherwise put each pair in its own singleton stratum).
let private reading (hidden: bool) =
    DecorrelationExcessFusion.fuse 777UL 0.05 300 (fun _ -> 0) parents (observables hidden) commits

[<Fact>]
let ``grid-trust: only the same-tick CONCURRENT operator actions are metered (fork-merge ladder)`` () =
    // Exactly the N (a_i, b_i) spacelike pairs; every timelike / merge pair is excluded.
    Assert.Equal(N, (reading false).SpacelikePairs)

[<Fact>]
let ``grid-trust: INDEPENDENT operators are CLEARED (excess within the delta false-positive budget)`` () =
    let r = reading false
    // δ=0.05 over N=40 ⇒ ~2 chance convictions expected; the instrument does NOT manufacture a channel.
    Assert.True(
        r.Excess <= 4,
        sprintf "independent operators should clear; excess=%d of %d (δ=0.05)" r.Excess r.SpacelikePairs
    )

[<Fact>]
let ``grid-trust: a HIDDEN lockstep channel is FLAGGED (the synchronized-move fingerprint)`` () =
    let r = reading true
    // 20 of 40 ticks are lockstep; the instrument convicts the coordinated pairs it cannot be talked out of.
    Assert.True(
        r.Excess >= 15,
        sprintf "hidden lockstep channel should be flagged; excess=%d of %d" r.Excess r.SpacelikePairs
    )

[<Fact>]
let ``grid-trust: hidden-channel excess DWARFS the independent false-positive rate (a clean verdict)`` () =
    // The whole point: the two worlds are separated by a wide, legible margin — not a borderline call.
    Assert.True(
        (reading true).Excess > (reading false).Excess * 3,
        "hidden-channel excess should dwarf the independent false-positive rate"
    )
