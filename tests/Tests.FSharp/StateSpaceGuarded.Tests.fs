module Zeta.Tests.StateSpaceGuardedTests

open global.Xunit
open Zeta.Core

let private none = [ SoftController.none ]
let private counter = [| 0x70uy; 0x01uy; 0x12uy; 0x00uy |] // 7001;1200: V0 grows ~4/frame
let private mk rom = Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

[<Fact>]
let ``exploreGuarded prunes states violating the invariant (the don't-die / no-downtime guard)`` () =
    // invariant: V0 stays below 20 -> states past that are forbidden, never entered
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 20
    let g = StateSpace.exploreGuarded inv 8 1000 none (mk counter)
    Assert.All(g.Frames, fun f -> Assert.True(int f.V.[0] < 20)) // every explored state is safe by construction
    Assert.True(g.StateCount > 0)

[<Fact>]
let ``a root that violates the invariant yields an empty safe subspace`` () =
    let inv (_: Chip8Cow.Frame) = false // nothing is safe
    let g = StateSpace.exploreGuarded inv 8 100 none (mk counter)
    Assert.Equal(0, g.StateCount)

[<Fact>]
let ``planTo finds a safe path to a goal predicate and replaying it satisfies the goal`` () =
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 100
    let goal (f: Chip8Cow.Frame) = int f.V.[0] >= 12
    let f0 = mk counter
    let g = StateSpace.exploreGuarded inv 8 200 none f0
    match StateSpace.planTo goal g with
    | Some plan ->
        let mutable f = f0
        for a in plan do
            f <- Chip8Cow.frameStep 8 { f with Keys = a }
        Assert.True(goal f) // replaying the recovered plan reaches a goal state
        Assert.True(inv f) // ...and it stayed safe (invariant held)
    | None -> Assert.True(false, "goal V0>=12 should be reachable safely")

[<Fact>]
let ``planTo returns None when no explored state meets the goal`` () =
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 5 // safe subspace caps V0 below 5
    let goal (f: Chip8Cow.Frame) = int f.V.[0] >= 50 // unreachable within the safe subspace
    let g = StateSpace.exploreGuarded inv 8 200 none (mk counter)
    Assert.Equal(None, StateSpace.planTo goal g)

// ─── Pruned: the erasure counter ─────────────────────────────────────────────
//
// `frameStep` runs BEFORE `invariant` is checked, so a pruned child is a fully
// materialised frame that is then dropped. Every other ending was already counted
// (`Revisits`, `SelfLoops`, `Truncated`); pruning alone left no trace, which is the
// asymmetry `Chip8ConsultCensus` warns about — "a bucket with count zero is a
// measurement, not an absence". These are the falsifiers for that counter.

[<Fact>]
let ``exploreGuarded COUNTS the children it computed and dropped`` () =
    // The counter's whole point: work was done and thrown away, and the amount is
    // now reportable rather than invisible.
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 20
    let g = StateSpace.exploreGuarded inv 8 1000 none (mk counter)
    Assert.True(g.Pruned > 0, "a guard that admits a bounded region must have dropped children")

[<Fact>]
let ``DEGENERATE: an all-refusing invariant is INDISTINGUISHABLE from no work attempted`` () =
    // Aaron 2026-09-08: "nothing is safe is a degenerate case and belongs to our
    // antibable to resist." He is right, and this test PINS THE GAP rather than
    // blessing it.
    //
    // An invariant admitting nothing is the rho -> 0 cliff in invariant space: total
    // exclusion, nothing survives contact. `exploreGuarded` handles it by refusing the
    // ROOT before the loop, so no child is ever computed and every counter reads zero.
    //
    // The result is a Graph that is FIELD-FOR-FIELD identical to a no-op: empty frames,
    // zero revisits, zero self-loops, not truncated, zero pruned. Nothing in the return
    // value says "your invariant excluded the entire space" versus "there was nothing to
    // explore". That is a check that did not run looking like one that passed, and it is
    // the one shape this repo names as its worst.
    //
    // Aaron 2026-09-08, sharpening it: "yes but they cost more heat than no-op." That is
    // the whole argument for a third axis in one line -- two runs can produce IDENTICAL
    // observable results at DIFFERENT cost, so heat is not recoverable from the output and
    // has to be counted separately. It is exactly why `Pruned` is a field and not a
    // derivation.
    //
    // NOT FIXED HERE. Fixing it means a distinguishable outcome for a degenerate guard
    // (a refusal, or a verdict constructor in the `OpenAtBound` spirit), which is a type
    // change with its own callers to consider. This test exists so the gap is recorded
    // and cannot be re-discovered as a surprise.
    let inv (_: Chip8Cow.Frame) = false
    let g = StateSpace.exploreGuarded inv 8 100 none (mk counter)
    Assert.Equal(0, g.StateCount)
    Assert.Equal(0, g.Pruned) // root refused before the loop — no child was ever computed
    // The indistinguishability, asserted explicitly so a future fix BREAKS this line:
    let noop = StateSpace.exploreGuarded inv 8 100 [] (mk counter)
    Assert.Equal(g.StateCount, noop.StateCount)
    Assert.Equal(g.Pruned, noop.Pruned)
    Assert.Equal(g.Revisits, noop.Revisits)

[<Fact>]
let ``explore takes no invariant and therefore reports zero pruning, not an unknown`` () =
    let g = StateSpace.explore 8 200 none (mk counter)
    Assert.Equal(0, g.Pruned)

[<Fact>]
let ``exploreKeyed also counts what it drops (the site a surviving mutant exposed)`` () =
    // `exploreKeyed` takes the same invariant and prunes identically, but every test above
    // exercises `exploreGuarded`. A first mutation run disabled the KEYED counter and all
    // seven tests still passed -- the counter was real and its test was not. This is that
    // test. Mutation testing earned its keep here in the ordinary way: it found a vacuous
    // falsifier, not a broken implementation.
    let inv (f: Chip8Cow.Frame) = int f.V.[0] < 20
    let key (f: Chip8Cow.Frame) = int f.V.[0]           // coarse key: many frames per bucket
    let g = StateSpace.exploreKeyed key inv 8 1000 none (mk counter)
    Assert.True(g.Pruned > 0, "a keyed guard that admits a bounded region must have dropped children")
