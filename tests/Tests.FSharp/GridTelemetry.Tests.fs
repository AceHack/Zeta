module Zeta.Tests.GridTelemetryTests

open global.Xunit
open Zeta.Core

module GT = Zeta.Core.GridTelemetry

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// GridTelemetry — the adapter from grid telemetry to the decorrelation instrument's inputs (closes the
// grid-trust explainer's [want]). Tests: the pure adapter (toDag/toObservables/actionIds), the honesty
// gauges (causalCoverage / wellFormed), and — the load-bearing one — an END-TO-END path from GridAction
// TELEMETRY through the adapter into the shipped DecorrelationExcessFusion, showing a hidden coordination
// channel is still flagged. Deterministic (seeded splitmix, no ambient randomness).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

let private mkGen (seed: uint64) =
    let mutable st = seed
    fun () ->
        st <- st + 0x9E3779B97F4A7C15UL
        let mutable z = st
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

let private set (xs: string list) = Set.ofList xs

// ── the pure adapter ──────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``toDag / toObservables / actionIds extract the instrument inputs from telemetry`` () =
    let acts: GT.GridAction list =
        [ { ActionId = "g0"; Basis = []; Touched = Set.empty }
          { ActionId = "a1"; Basis = [ "g0" ]; Touched = set [ "gen_1"; "breaker_2" ] } ]
    Assert.Equal<Map<string, string list>>(Map.ofList [ "g0", []; "a1", [ "g0" ] ], GT.toDag acts)
    Assert.Equal<Set<string>>(set [ "gen_1"; "breaker_2" ], (GT.toObservables acts).["a1"])
    Assert.Equal<string list>([ "g0"; "a1" ], GT.actionIds acts)

// ── the honesty gauge: causal coverage ────────────────────────────────────────────────────────────

[<Fact>]
let ``causalCoverage: 1.0 when every action declares provenance, 0.0 when none do (timestamps-only)`` () =
    let withBasis: GT.GridAction list =
        [ { ActionId = "a"; Basis = [ "g" ]; Touched = Set.empty }; { ActionId = "b"; Basis = [ "a" ]; Touched = Set.empty } ]
    Assert.Equal(1.0, GT.causalCoverage withBasis)
    // A stream with NO declared causality (only timestamps upstream, dropped) scores 0.0 — must not be metered.
    let noBasis: GT.GridAction list =
        [ { ActionId = "a"; Basis = []; Touched = Set.empty }; { ActionId = "b"; Basis = []; Touched = Set.empty } ]
    Assert.Equal(0.0, GT.causalCoverage noBasis)
    Assert.True(System.Double.IsNaN(GT.causalCoverage []))

// ── well-formedness ───────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``wellFormed: distinct non-empty ids pass; a duplicate id is rejected (would silently drop)`` () =
    let ok: GT.GridAction list =
        [ { ActionId = "a"; Basis = []; Touched = Set.empty }; { ActionId = "b"; Basis = []; Touched = Set.empty } ]
    Assert.Equal(Ok(), GT.wellFormed ok)
    let dup: GT.GridAction list =
        [ { ActionId = "a"; Basis = []; Touched = Set.empty }; { ActionId = "a"; Basis = []; Touched = Set.empty } ]
    Assert.True(match GT.wellFormed dup with Error _ -> true | _ -> false)
    let empty: GT.GridAction list = [ { ActionId = " "; Basis = []; Touched = Set.empty } ]
    Assert.True(match GT.wellFormed empty with Error _ -> true | _ -> false)

// ── END-TO-END: telemetry → adapter → shipped instrument → hidden-channel verdict ─────────────────────

// Build fork-merge-ladder TELEMETRY (each tick both operators act concurrently off the prior grid state,
// then a merge action records the combined state). `hidden` injects covert lockstep (every 2nd tick both
// take the identical action). This is the grid-trust demo expressed as GridAction telemetry and run THROUGH
// the adapter, proving the mapping faithfully feeds the instrument.
let private N = 30
let private subsystems =
    Array.concat [ [| for g in 0..5 -> sprintf "gen_%d" g |]; [| for l in 0..5 -> sprintf "load_%d" l |]; [| for b in 0..9 -> sprintf "breaker_%d" b |] ]
let private prev i = if i = 0 then "g0" else sprintf "m%d" (i - 1)
let private pick2 (g: unit -> uint64) =
    set [ subsystems.[int (g () % uint64 subsystems.Length)]; subsystems.[int (g () % uint64 subsystems.Length)] ]

let private telemetry (hidden: bool) : GT.GridAction list =
    let ga = mkGen 1001UL
    let a = [| for _ in 0 .. N - 1 -> pick2 ga |]
    let gb = mkGen 2002UL
    let b = [| for _ in 0 .. N - 1 -> pick2 gb |]
    if hidden then
        let gh = mkGen 424242UL
        for i in 0 .. N - 1 do
            if i % 2 = 0 then
                let shared = pick2 gh
                a.[i] <- shared
                b.[i] <- shared
    [ yield { ActionId = "g0"; Basis = []; Touched = Set.empty }
      for i in 0 .. N - 1 do
          yield { ActionId = sprintf "a%d" i; Basis = [ prev i ]; Touched = a.[i] }
          yield { ActionId = sprintf "b%d" i; Basis = [ prev i ]; Touched = b.[i] }
          yield { ActionId = sprintf "m%d" i; Basis = [ sprintf "a%d" i; sprintf "b%d" i ]; Touched = Set.empty } ]

let private meter (hidden: bool) =
    let acts = telemetry hidden
    Assert.Equal(Ok(), GT.wellFormed acts) // the telemetry is well-formed
    Assert.Equal(1.0, GT.causalCoverage (acts |> List.filter (fun x -> x.ActionId <> "g0"))) // every non-genesis action declares provenance
    DecorrelationExcessFusion.fuse 777UL 0.05 300 (fun _ -> 0) (GT.toDag acts) (GT.toObservables acts) (GT.actionIds acts)

[<Fact>]
let ``end-to-end: telemetry through the adapter meters ONLY the concurrent same-tick pairs`` () =
    Assert.Equal(N, (meter false).SpacelikePairs) // exactly the N (a_i,b_i) concurrent pairs

[<Fact>]
let ``end-to-end: independent telemetry is CLEARED, a hidden lockstep channel is FLAGGED`` () =
    let indep = (meter false).Excess
    let hidden = (meter true).Excess
    Assert.True(indep <= 3, sprintf "independent operators should clear; excess=%d/%d" indep N)
    Assert.True(hidden >= 11, sprintf "hidden lockstep channel should be flagged; excess=%d/%d" hidden N)
    Assert.True(hidden > indep * 3, "hidden-channel excess should dwarf the independent false-positive rate")
