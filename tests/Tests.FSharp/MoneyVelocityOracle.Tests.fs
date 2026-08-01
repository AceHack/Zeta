module Zeta.Tests.MoneyVelocityOracleTests

// BEHAVIOURAL tests for the money-velocity oracle — written 2026-08-01 ahead of the financial audit.
//
// WHY THESE DID NOT EXIST: the module had ZERO behavioural coverage. Its only appearance anywhere
// under tests/ was one row in DeterminismLint's ambient-entropy allowlist — a lint entry, not a test.
// Nothing called moneyRegime, moneyRho, m2VelocityToRho or tsirelsonAgeDays. That is exactly what let
// two real defects sit here: a docstring contradicting this file's OWN classifier by 2.3x (1184 vs
// ~517 days), and a regimeTable that ASSERTED a regime instead of calling the classifier beside it.
// With no test, a self-contradiction in money code can persist indefinitely and nothing objects.
//
// DISCIPLINE FOR THESE TESTS: every one must be able to FAIL. Boundaries are pinned on BOTH sides,
// monotonicity is checked with real ordering (not one sample), and the disputed 517-day boundary is
// asserted explicitly so it can never silently drift back. Where a property could be vacuous, a
// negative control accompanies it.

open System
open global.Xunit
open Zeta.Core
open Zeta.Core.MoneyVelocityOracle

let private approx (expected: float) (actual: float) (tol: float) (what: string) =
    Assert.True(abs (actual - expected) < tol, sprintf "%s: expected ~%f, got %f" what expected actual)

// ── moneyRho: ρ = 1/(1+L), L = age/365 ───────────────────────────────────────

[<Fact>]
let ``moneyRho: the documented reference points hold exactly`` () =
    approx 1.0 (moneyRho 0.0) 1e-9 "age 0 ⇒ ρ = 1 (maximal correlation)"
    approx 0.5 (moneyRho 365.0) 1e-9 "1 year ⇒ L=1 ⇒ ρ = 0.5"
    approx 0.1667 (moneyRho (5.0 * 365.0)) 1e-3 "5 years ⇒ ρ ≈ 0.167"
    approx 0.0909 (moneyRho (10.0 * 365.0)) 1e-3 "10 years ⇒ ρ ≈ 0.091"

[<Fact>]
let ``moneyRho: STRICTLY DECREASING in age — older money is sounder`` () =
    // The load-bearing direction. If this ever inverts, every regime call flips meaning.
    let ages = [ 0.0; 30.0; 90.0; 365.0; 730.0; 1825.0; 3650.0 ]
    let rhos = ages |> List.map moneyRho
    List.pairwise rhos
    |> List.iter (fun (a, b) -> Assert.True(b < a, sprintf "ρ must strictly decrease: %f then %f" a b))

[<Fact>]
let ``moneyRho: bounded in (0,1] and a NEGATIVE age cannot exceed 1`` () =
    for age in [ -1000.0; -1.0; 0.0; 1.0; 100000.0 ] do
        let r = moneyRho age
        Assert.True(r > 0.0 && r <= 1.0, sprintf "ρ(%f) = %f out of (0,1]" age r)
    // the `max 0.0 L` clamp is the reason — pin it so removing the clamp fails here
    approx 1.0 (moneyRho -500.0) 1e-9 "negative age clamps to ρ = 1, never above"

[<Fact>]
let ``moneyCondorcetBonus: bonus + ρ = 1 exactly, at every age`` () =
    for age in [ 0.0; 1.0; 365.0; 1184.0; 3650.0 ] do
        approx 1.0 (moneyCondorcetBonus age + moneyRho age) 1e-12 (sprintf "bonus+ρ at age %f" age)

// ── moneyRegime: the classifier boundaries, pinned on BOTH sides ─────────────

[<Fact>]
let ``moneyRegime: boundaries are pinned on both sides (0.9 and √2−1)`` () =
    let soundBoundary = 1.0 / (1.0 + sqrt 2.0) // = √2 − 1 ≈ 0.414214
    approx 0.414214 soundBoundary 1e-5 "the SoundMoney/Moderate boundary value itself"
    // Inflationary boundary
    Assert.Equal(Inflationary, moneyRegime 0.9001)
    Assert.Equal(Moderate, moneyRegime 0.9)        // NOT > 0.9 ⇒ Moderate
    // SoundMoney boundary — strictly greater is Moderate, equal-or-below is SoundMoney
    Assert.Equal(Moderate, moneyRegime (soundBoundary + 1e-9))
    Assert.Equal(SoundMoney, moneyRegime soundBoundary)
    Assert.Equal(SoundMoney, moneyRegime (soundBoundary - 1e-9))

[<Fact>]
let ``moneyRegime: NEGATIVE CONTROL — the three regimes are genuinely reachable and distinct`` () =
    // Without this, the boundary tests above could pass against a classifier that returns one value.
    let seen = [ moneyRegime 0.99; moneyRegime 0.6; moneyRegime 0.1 ] |> List.distinct
    Assert.Equal(3, List.length seen)

// ── The cross-consistency the audit disputed ─────────────────────────────────

[<Fact>]
let ``THE DISPUTED BOUNDARY: the SoundMoney threshold is ~517 days, NOT tsirelsonAgeDays (~1184)`` () =
    // Soraya's audit (2026-08-01) found the old `tsirelsonAgeDays` docstring claiming it was "the age
    // at which the oracle enters the Classical regime". It is not — this file's OWN classifier puts
    // that boundary at ρ = √2 − 1 ⇒ L = √2 years ≈ 517 days. The two differ by 2.3x. This test pins
    // the real boundary so the claim cannot silently drift back.
    let boundaryDays = sqrt 2.0 * 365.0
    approx 516.2 boundaryDays 1.0 "SoundMoney boundary age"
    // just younger than the boundary ⇒ still Moderate; just older ⇒ SoundMoney
    Assert.Equal(Moderate, moneyRegime (moneyRho (boundaryDays - 1.0)))
    Assert.Equal(SoundMoney, moneyRegime (moneyRho (boundaryDays + 1.0)))
    // and tsirelsonAgeDays is NOT that boundary — it is well inside SoundMoney
    approx 1184.0 tsirelsonAgeDays 2.0 "tsirelsonAgeDays value is unchanged"
    Assert.Equal(SoundMoney, moneyRegime (moneyRho tsirelsonAgeDays))
    Assert.True(tsirelsonAgeDays > boundaryDays * 2.0, "the two ages differ by more than 2x — not interchangeable")

// ── M2 velocity ──────────────────────────────────────────────────────────────

[<Fact>]
let ``m2VelocityToRho: STRICTLY INCREASING in velocity — faster money is more correlated`` () =
    let vels = [ 0.1; 0.3; 0.707; 1.1; 1.4; 2.1; 5.0 ]
    let rhos = vels |> List.map m2VelocityToRho
    List.pairwise rhos
    |> List.iter (fun (a, b) -> Assert.True(b > a, sprintf "ρ must strictly increase with velocity: %f then %f" a b))

[<Fact>]
let ``m2VelocityToRho: velocity ≈ 0.707 sits at the SoundMoney boundary`` () =
    // ρ = √2 − 1 ⇒ L = √2 ⇒ velocity = 1/√2 ≈ 0.7071. Pins the M2 side of the same boundary.
    let v = 1.0 / sqrt 2.0
    approx (1.0 / (1.0 + sqrt 2.0)) (m2VelocityToRho v) 1e-9 "ρ at velocity 1/√2"
    Assert.Equal(SoundMoney, moneyRegime (m2VelocityToRho (v - 0.01)))
    Assert.Equal(Moderate, moneyRegime (m2VelocityToRho (v + 0.01)))

[<Fact>]
let ``m2VelocityToRho: real M2 velocities are all Moderate-or-worse (a sanity anchor, and it can fail)`` () =
    // Historical M2 velocity has ranged roughly 1.1–2.1. Every one of those must be non-SoundMoney;
    // if a refactor ever made real-world money classify as sound, that is a defect worth failing on.
    for v in [ 1.1; 1.4; 1.7; 2.1 ] do
        Assert.NotEqual<MoneyRegime>(SoundMoney, moneyRegime (m2VelocityToRho v))

[<Fact>]
let ``m2VelocityToRho: the zero-velocity guard clamps rather than dividing by zero`` () =
    let r = m2VelocityToRho 0.0
    Assert.True(Double.IsFinite r && r > 0.0 && r <= 1.0, sprintf "ρ(0 velocity) = %f must be finite" r)

// ── medianUtxoAgeDays ────────────────────────────────────────────────────────

[<Fact>]
let ``medianUtxoAgeDays: an empty distribution falls back to 365, not to zero or NaN`` () =
    // A zero fallback would silently classify empty data as maximally inflationary (ρ=1).
    let empty = utxoAgeBuckets |> Array.map (fun b -> { b with Count = 0 })
    approx 365.0 (medianUtxoAgeDays empty) 1e-9 "empty ⇒ 1-year default"
    Assert.Equal(Moderate, moneyRegime (moneyRho (medianUtxoAgeDays empty)))

[<Fact>]
let ``REGRESSION: the open-ended top bucket must not overflow int32 and invert the regime`` () =
    // THE BUG THIS CAUGHT (2026-08-01, first behavioural test ever written for this module):
    // the top bucket is open-ended (MaxAgeDays = Int32.MaxValue), and the old midpoint
    // (Min + Max)/2 overflowed int32 — 3650 + 2147483647 wraps to -2147479999, giving a median of
    // -1073739999.5 DAYS. moneyRho's `max 0.0 L` clamp then silently turned that into ρ = 1.0, so
    // the SOUNDEST possible money (all UTXOs held >10 years) classified as INFLATIONARY. A total
    // semantic inversion, hidden by a defensive clamp.
    let idx = utxoAgeBuckets.Length - 1
    let loaded = utxoAgeBuckets |> Array.mapi (fun i b -> if i = idx then { b with Count = 1000 } else { b with Count = 0 })
    let med = medianUtxoAgeDays loaded
    Assert.True(med > 0.0, sprintf "median must be POSITIVE — got %f (int32 overflow returns)" med)
    Assert.True(med >= 3650.0, sprintf "an all->10y distribution must read as at least 3650 days, got %f" med)
    // the load-bearing consequence: the soundest money must classify as SoundMoney, not Inflationary
    Assert.Equal(SoundMoney, moneyRegime (moneyRho med))

[<Fact>]
let ``medianUtxoAgeDays: a mid-range concentration lands inside that bucket`` () =
    // Negative control for the test above: a NON-open-ended bucket must still use the midpoint,
    // so the fix cannot have degenerated every bucket to its lower bound.
    let target = utxoAgeBuckets |> Array.findIndex (fun b -> b.MinAgeDays = 730)
    let loaded = utxoAgeBuckets |> Array.mapi (fun i b -> if i = target then { b with Count = 1000 } else { b with Count = 0 })
    let med = medianUtxoAgeDays loaded
    approx 1277.5 med 1.0 "midpoint of the 730-1825 bucket"
