module Zeta.Tests.FeedbackThrottleTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``instant feedback (latency 0) reaches the algebraic max S=4 (the toy)`` () =
    Assert.Equal(FeedbackThrottle.AlgebraicMax, FeedbackThrottle.maxChsh 0.0, 12)
    Assert.True(FeedbackThrottle.canExceedTsirelson 0.0)

[<Fact>]
let ``no usable real-time feedback (huge latency) -> approaches classical bound S=2`` () =
    Assert.True(FeedbackThrottle.maxChsh 1.0e9 < FeedbackThrottle.ClassicalBound + 1e-6) // approaches 2 (asymptotic; 1/(1+L) never exactly 0)
    Assert.True(FeedbackThrottle.maxChsh 1.0e9 >= FeedbackThrottle.ClassicalBound) // never below classical

[<Fact>]
let ``finite latency interpolates 4 → 2, monotonically decreasing`` () =
    let xs = [ 0.0; 0.5; 1.0; 2.0; 5.0; 20.0 ] |> List.map FeedbackThrottle.maxChsh
    Assert.Equal<float list>(xs, List.sortDescending xs) // monotone non-increasing
    Assert.True(List.head xs > List.last xs) // strictly drops
    Assert.True(xs |> List.forall (fun s -> s <= 4.0 + 1e-12 && s >= 2.0 - 1e-12)) // stays in [2,4]

[<Fact>]
let ``2√2 is crossed at a finite latency — a real transport drops below the toy's S=4`` () =
    Assert.True(FeedbackThrottle.canExceedTsirelson 0.1) // fast feedback: supra-Tsirelson still reachable
    Assert.False(FeedbackThrottle.canExceedTsirelson 10.0) // slow feedback: capped below 2√2
    // somewhere between, maxChsh passes through exactly 2√2
    Assert.True(FeedbackThrottle.maxChsh 0.1 > FeedbackThrottle.Tsirelson)
    Assert.True(FeedbackThrottle.maxChsh 10.0 < FeedbackThrottle.Tsirelson)

[<Fact>]
let ``deterministic / replayable (DST)`` () =
    Assert.Equal(FeedbackThrottle.maxChsh 1.5, FeedbackThrottle.maxChsh 1.5, 12)
