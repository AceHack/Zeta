module Zeta.Tests.SocietyUnboundedTests

open global.Xunit
open Zeta.Core

module SU = Zeta.Core.SocietyUnbounded

// ═══════════════════════════════════════════════════════════════════
// SocietyUnbounded — 081KT7YW00008QG0R001DGZQKM rung-1 DST (Soraya-reviewed for vacuity 2026-06-06). CLOSED system, no
// external input after the init seed. THE CONTRAST: internal difference (distinct private evidence)
// drives unbounded NOVEL growth (distinct-belief count keeps rising); collapse the difference (identical
// evidence = register-collapse) and the system HALTS at uniformity (heat-death). Honest scope: bounded-
// budget DST evidence-for, not the unbounded proof (that's the TLC no-cycle + Lean pigeonhole rungs).
// ═══════════════════════════════════════════════════════════════════

let private seed = 42UL
let private n = 3
let private cands = 4
let private budget = 20

[<Fact>]
let ``teeth: collapsed private difference HALTS at uniformity (distinct=1, heat-death)`` () =
    match SU.run seed n cands budget true with
    | SU.Refute(_, distinct) -> Assert.Equal(1, distinct)
    | other -> Assert.True(false, sprintf "identical private state must REFUTE (halt at distinct=1); got %A" other)

[<Fact>]
let ``main: internal difference drives growth and NEVER halts/cycles within budget`` () =
    match SU.run seed n cands budget false with
    | SU.Pass curve -> Assert.True(List.last curve > List.head curve, "distinct-belief count must rise")
    | SU.Inconclusive curve -> Assert.True(List.last curve > List.head curve, "no clean strict growth, but must still net-grow")
    | SU.Refute _ -> Assert.True(false, "internal difference must NOT halt/cycle — that would refute privacy-as-constitutive")

[<Fact>]
let ``the contrast: difference grows distinct beliefs strictly more than collapse`` () =
    let grown =
        match SU.run seed n cands budget false with
        | SU.Pass c | SU.Inconclusive c -> List.last c
        | SU.Refute(_, d) -> d
    let collapsed =
        match SU.run seed n cands budget true with
        | SU.Refute(_, d) -> d
        | SU.Pass c | SU.Inconclusive c -> List.last c
    Assert.True(grown > collapsed, "internal difference (no external input) must out-differentiate collapse")

[<Fact>]
let ``DST: same seed replays the same outcome (deterministic, closed)`` () =
    Assert.Equal(SU.run seed n cands budget false, SU.run seed n cands budget false)
    Assert.Equal(SU.run seed n cands budget true, SU.run seed n cands budget true)
