module Zeta.Tests.EvolutionTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module E = Zeta.Core.Evolution

// ═══════════════════════════════════════════════════════════════════
// Evolution — the 081KT7YW00008QG0R001DGZQKM DST experiment for privacy-as-anti-collapse.
//
// THEOREM (pigeonhole): a deterministic no-input step on a FINITE state space must halt-or-cycle within
// |states|+1 steps — so open-ended evolution REQUIRES unbounded/growing state.
// EXPERIMENT: with private differentiation the population evolves (unbounded novel growth: no fixpoint,
// no revisit); register-collapsed (no private difference) it halts (fixpoint). Deterministic (DST):
// same seed ⇒ identical orbit.
//
// Honest scope: evidence for the mechanism in a concrete model + the pigeonhole necessity bound; NOT a
// universal proof that every system halts without privacy.
// ═══════════════════════════════════════════════════════════════════

// Are the travelers differentiated (not all equal)? = is there private difference to drive evolution?
let private differentiated (travelers: int list) : bool =
    match travelers with
    | [] -> false
    | h :: t -> List.exists (fun x -> x <> h) t

// One evolution step over the accumulated stream: append a NOVEL value (the current length) iff the
// travelers carry private difference; otherwise leave the stream unchanged (a fixpoint — collapse).
let private evolveStep (travelers: int list) (stream: int list) : int list =
    if differentiated travelers then stream @ [ List.length stream ] else stream

// ── the experiment: differentiation ⇒ evolves; collapse ⇒ halts ──

[<Fact>]
let ``with private differentiation the population evolves — no halt, no cycle, unbounded growth`` () =
    let travelers = [ 1; 2; 3 ] // distinct private states
    let steps = 50
    let orbit = E.orbit (evolveStep travelers) [] steps
    Assert.False(E.reachedFixpoint (evolveStep travelers) [] steps) // never halts
    Assert.False(E.revisits orbit) // never cycles — every state is new
    Assert.Equal(steps, List.length (List.last orbit)) // strictly grew (unbounded novel growth)

[<Fact>]
let ``register collapse (no private difference) halts — fixpoint`` () =
    let travelers = [ 5; 5; 5 ] // identical → no private differentiation
    let steps = 50
    Assert.True(E.reachedFixpoint (evolveStep travelers) [] steps) // halts immediately
    let orbit = E.orbit (evolveStep travelers) [] steps
    Assert.True(E.revisits orbit) // the same state forever

[<Fact>]
let ``the contrast is the falsifiable signal: differentiation evolves, collapse halts`` () =
    Assert.True(E.evolves (evolveStep [ 1; 2; 3 ]) [] 30)
    Assert.False(E.evolves (evolveStep [ 7; 7; 7 ]) [] 30)

// ── the THEOREM: finite state + deterministic + no input ⇒ must halt-or-cycle (pigeonhole) ──

[<Fact>]
let ``a bounded deterministic step must revisit a state within |states|+1 steps (pigeonhole)`` () =
    // step confined to the 7 residues mod 7 — at most 7 distinct states.
    let boundedStep x = (x * 3 + 1) % 7
    let orbit = E.orbit boundedStep 0 7 // 8 states over a 7-element space
    Assert.True(E.revisits orbit) // pigeonhole forces a repeat — so bounded state cannot evolve forever

[<Property>]
let ``pigeonhole holds for any affine step mod m and any seed`` (a: int) (b: int) (seed: int) =
    let m = 11
    let step x = (((a % m) * x + (b % m)) % m + m) % m
    let s0 = ((seed % m) + m) % m
    // an orbit of m+1 states over an m-element space must contain a repeat
    E.revisits (E.orbit step s0 m)

// ── DST: the orbit replays identically from the seed ──

[<Property>]
let ``orbit is deterministic — same seed and step replay the identical orbit`` (seed: int) (n: int) =
    let k = (abs n) % 30
    let step x = (x * 3 + 1) % 100
    E.orbit step seed k = E.orbit step seed k
