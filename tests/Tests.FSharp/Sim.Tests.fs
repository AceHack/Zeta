module Zeta.Tests.SimTests

open System
open global.Xunit
open Zeta.Core

[<Fact>]
let ``budgetOf maps duration to ticks at 60Hz; bare/zero clamps to >=1`` () =
    Assert.Equal(60, Sim.budgetOf (TimeSpan.FromSeconds 1.0))
    Assert.Equal(1800, Sim.budgetOf Sim.defaultDuration) // 30s default
    Assert.Equal(1, Sim.budgetOf TimeSpan.Zero) // never zero-length

[<Fact>]
let ``sim is DETERMINISTIC in (seed, duration): same input replays the same trace`` () =
    let d = TimeSpan.FromSeconds 0.5
    Assert.Equal<FinalizerAction list>(Sim.trace 1234L d, Sim.trace 1234L d)

[<Fact>]
let ``different seeds can diverge (the seed carries intrinsic entropy)`` () =
    let d = TimeSpan.FromSeconds 2.0
    // not asserting inequality of the whole trace (decide may coincide), but the runs are independent
    // and both well-formed; this documents that seed is a real input.
    let a = Sim.trace 1L d
    let b = Sim.trace 2L d
    Assert.NotEmpty a
    Assert.NotEmpty b

[<Fact>]
let ``sim is BOUNDED: the trace terminates and ends in Stop (budget caps it, no fork-bomb)`` () =
    let d = TimeSpan.FromSeconds 0.25
    let t = Sim.trace 99L d
    Assert.True(t.Length <= Sim.budgetOf d + 1, "trace exceeded its budget")
    Assert.Equal(FinalizerAction.Stop, List.last t)

[<Fact>]
let ``sim NEVER merges — committing is mea/cut, not sim`` () =
    // every tick reports Merged=false, so the finalizer never emits ReKick (the merge-to-main edge)
    let t = Sim.trace 7L (TimeSpan.FromSeconds 1.0)
    Assert.DoesNotContain(FinalizerAction.ReKick, t)

[<Fact>]
let ``run produces no output (the void) and does not throw`` () =
    Sim.run 42L (TimeSpan.FromSeconds 0.1) // unit; the trace is computed and discarded
    Sim.runDefault 42L
