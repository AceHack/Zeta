module Zeta.Tests.TimeGenTests

// Amara's "next proof should be small", executed: given seed σ and time-generator G and the four CHSH
// corners — ClassicalCommonCause stays inside the classical bound; PhasorTsirelson reaches S = 2√2;
// StagedCoincidence reaches S = 4 BY EXPLICIT STAGED SCHEDULE (labeled, never physical); and every
// replay produces identical corner traces. Time-as-generator: a treaty primitive, not a metaphor.

open global.Xunit
open Zeta.Core

let private gen regime = TimeGen.mk "timegen-test" 1 0xC0FFEEUL regime

[<Fact>]
let ``REPLAY: the same seed produces identical corner traces and instants (the common cause)`` () =
    let g = gen TimeGen.PhasorTsirelson
    Assert.Equal(TimeGen.chsh g 512, TimeGen.chsh g 512)
    let t1 = TimeGen.at g 7UL 42
    let t2 = TimeGen.at g 7UL 42
    Assert.Equal(t1, t2)
    // distinct contributors get distinct (but each replayable) phases — local clocks from one cause
    Assert.NotEqual(t1.Phase, (TimeGen.at g 8UL 42).Phase)

[<Fact>]
let ``CLASSICAL: the seeded hidden-variable scheduler stays inside the classical bound (S <= 2 + eps)`` () =
    let s = TimeGen.chsh (gen TimeGen.ClassicalCommonCause) 4096
    Assert.True(abs s <= 2.0 + 0.05, sprintf "classical S = %f exceeded the bound" s)

[<Fact>]
let ``PHASOR: the unit-circle scheduler reaches Tsirelson exactly (S = 2*sqrt 2)`` () =
    let s = TimeGen.chsh (gen TimeGen.PhasorTsirelson) 1
    Assert.Equal(2.0 * sqrt 2.0, s, 10)

[<Fact>]
let ``STAGED: S = 4 by explicit staged schedule — and the label SAYS it is staged, not physical`` () =
    let g = gen TimeGen.StagedCoincidence
    Assert.Equal(4.0, TimeGen.chsh g 1, 12)
    let l = TimeGen.label g
    Assert.Contains("STAGED", l)
    Assert.Contains("not physical", l)

[<Fact>]
let ``the generator is versioned and addressed — changing time semantics can never be silent`` () =
    let g = gen TimeGen.PhasorTsirelson
    Assert.Equal("timegen-test", g.Id)
    Assert.Equal(1, g.Version)
    // a different seed IS a different common cause: traces diverge
    let g2 = { g with Seed = 0xBEEFUL }
    Assert.NotEqual(TimeGen.at g 7UL 1, TimeGen.at g2 7UL 1)

[<Fact>]
let ``FEEDBACK is deterministic and bounded: the four-corner adjustment replays and clamps`` () =
    let f1 = TimeGen.feedback (2.0 * sqrt 2.0) 2.0 0.1 0.0
    Assert.Equal(f1, TimeGen.feedback (2.0 * sqrt 2.0) 2.0 0.1 0.0)
    Assert.True(f1 <= 0.1 + 1e-12) // clamped
    Assert.True(f1 > 0.0) // pushing toward the target
