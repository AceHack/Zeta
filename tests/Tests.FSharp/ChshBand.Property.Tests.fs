module Zeta.Tests.ChshBandPropertyTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core.AntiSybil

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// ChshBand + LoopholeFlags property obligations (Soraya's design, 2026-08-08).
// Spec: docs/research/2026-08-08-soraya-chshband-loopholeflags-type-design-spec.md
// Workitem 081KZHC652A08QG0R003YX1G29 (unblocks Alexa Task A — Analytics wrappers).
//
// Four obligations, per the spec §4. Obligation 1 (gate-agreement) is the BP-16 P0 cross-check surface:
// this FsCheck property is ONE independent witness that `classifyBand`'s conviction line equals the
// shipped `chshSybilCalibrated` union predicate (`|S| > 2 + chshMargin`); a Z3 lemma on the boundary
// arithmetic is the required SECOND tool (filed as a follow-up, not in this file).
//
// `Replay` fixes the seed (DST §7 — a soundness-gating property must replay deterministically).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

[<Literal>]
let private Rep = "424243,242425" // fixed replay seed (determinism / DST); gamma (2nd value) must be ODD

// ── generators ──────────────────────────────────────────────────────────────────────────────────────

/// S values spanning ALL bands: dense near the interesting bounds (2, 2√2) plus wide range and negatives,
/// so ties, sound-margin, quantum, and super-quantum regimes are all exercised.
let private genS =
    Gen.frequency
        [ 3, Gen.choose (-400, 400) |> Gen.map (fun i -> float i / 100.0) // [-4, 4] dense
          1, Gen.elements [ 0.0; 2.0; -2.0; 2.0 * sqrt 2.0; -(2.0 * sqrt 2.0); 4.0; -4.0 ] // exact edges
          1, Gen.choose (-1000, 1000) |> Gen.map (fun i -> float i / 100.0) ] // wider [-10, 10]

let private genDelta = Gen.choose (1, 99) |> Gen.map (fun i -> float i / 100.0) // δ ∈ (0, 1)
let private genRounds = Gen.choose (1, 5000) // n > 0 (positive-sample regime)

type SCase = { D: float; N: int; S: float }
type SPairCase = { D: float; N: int; S1: float; S2: float }

let private genSCase =
    gen {
        let! d = genDelta
        let! n = genRounds
        let! s = genS
        return { D = d; N = n; S = s }
    }

let private genSPairCase =
    gen {
        let! d = genDelta
        let! n = genRounds
        let! s1 = genS
        let! s2 = genS
        return { D = d; N = n; S1 = s1; S2 = s2 }
    }

let private genBand = Gen.elements [ Classical; SoundMargin; Quantum; SuperQuantum ]

type ChshBandArb() =
    static member SCase() = Arb.fromGen genSCase
    static member SPairCase() = Arb.fromGen genSPairCase
    static member Band() = Arb.fromGen genBand

// ── Obligation 1 (BP-16 cross-check, highest value): band gate == calibrated-oracle predicate ─────────

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 2000)>]
let ``(1) bandConvictsArithmetically(classifyBand) IFF |s| > 2 + chshMargin`` (c: SCase) =
    let band = classifyBand c.D c.N c.S
    bandConvictsArithmetically band = (abs c.S > 2.0 + chshMargin c.D c.N)

// ── Obligation 2: sign invariance + monotone in |S| at fixed (d, n); total order via bandRank ─────────

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 2000)>]
let ``(2a) classifyBand is sign-invariant`` (c: SCase) =
    classifyBand c.D c.N c.S = classifyBand c.D c.N (-c.S)

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 2000)>]
let ``(2b) classifyBand is monotone in |S| at fixed (d, n)`` (c: SPairCase) =
    if abs c.S1 <= abs c.S2 then
        classifyBand c.D c.N c.S1 <= classifyBand c.D c.N c.S2
    else
        classifyBand c.D c.N c.S2 <= classifyBand c.D c.N c.S1

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 500)>]
let ``(2c) bandRank is a strictly monotone embedding of the total order`` (a: ChshBand) (b: ChshBand) =
    (a < b) = (bandRank a < bandRank b) && (a = b) = (bandRank a = bandRank b)

// ── Obligation 3: soundness-biased boundaries; valid-quantum never SuperQuantum; degenerate-n ─────────

[<Fact>]
let ``(3a) boundary ties fall to the WEAKER band`` () =
    // |s| = 2 -> Classical (not SoundMargin) for any positive n / valid delta.
    Assert.Equal(Classical, classifyBand 0.05 1000 2.0)
    Assert.Equal(Classical, classifyBand 0.05 1000 -2.0)
    // |s| = 2 + eps exactly -> SoundMargin (not Quantum).
    let eps = chshMargin 0.05 1000
    Assert.Equal(SoundMargin, classifyBand 0.05 1000 (2.0 + eps))
    // |s| = 2√2 exactly -> Quantum (not SuperQuantum) [within slack].
    Assert.Equal(Quantum, classifyBand 0.05 1000 (2.0 * sqrt 2.0))

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 2000)>]
let ``(3b) |s| <= 2√2 + slack implies band <> SuperQuantum`` (c: SCase) =
    if abs c.S <= 2.0 * sqrt 2.0 + 1e-12 then
        classifyBand c.D c.N c.S <> SuperQuantum
    else
        true

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 1000)>]
let ``(3c) degenerate n (<= 0) never convicts`` (c: SCase) (rNonPos: int) =
    let rounds = -(abs rNonPos) // <= 0
    let band = classifyBand c.D rounds c.S
    band = Classical || band = SoundMargin

// ── Obligation 4: same-process commit pairs never convict from S (the soundness-doc conclusion) ───────

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 500)>]
let ``(4) readout over commitPairLoopholes is NEVER CommonCauseConvicted`` (band: ChshBand) =
    match readout band commitPairLoopholes with
    | CommonCauseConvicted _ -> false
    | _ -> true

// ── LoopholeFlags unit invariants ─────────────────────────────────────────────────────────────────────

[<Fact>]
let ``LoopholeFlags: allClosed has nothing open; commitPair leaves conviction loopholes open`` () =
    Assert.False(anyOpen loopholesAllClosed)
    Assert.True(convictionLoopholesClosed loopholesAllClosed)
    Assert.True(anyOpen commitPairLoopholes)
    Assert.False(convictionLoopholesClosed commitPairLoopholes)
    // Specifically: Locality AND MeasurementIndependence open (the load-bearing soundness fact).
    Assert.True(commitPairLoopholes.Locality)
    Assert.True(commitPairLoopholes.MeasurementIndependence)

[<Fact>]
let ``readout: Quantum + all-closed convicts; Quantum + any conviction-loophole-open does not`` () =
    // Quantum, loopholes closed -> conviction.
    match readout Quantum loopholesAllClosed with
    | CommonCauseConvicted Quantum -> ()
    | other -> Assert.Fail(sprintf "expected CommonCauseConvicted Quantum, got %A" other)
    // Quantum, one conviction loophole open -> ViolationButLoopholesOpen.
    match readout Quantum { loopholesAllClosed with Locality = true } with
    | ViolationButLoopholesOpen(Quantum, _) -> ()
    | other -> Assert.Fail(sprintf "expected ViolationButLoopholesOpen, got %A" other)
    // Below Quantum -> NoViolation regardless of loopholes.
    match readout SoundMargin loopholesAllClosed with
    | NoViolation SoundMargin -> ()
    | other -> Assert.Fail(sprintf "expected NoViolation SoundMargin, got %A" other)

[<Property(Arbitrary = [| typeof<ChshBandArb> |], Replay = Rep, MaxTest = 500)>]
let ``readout: monotone weakening — opening any conviction loophole cannot upgrade to conviction`` (band: ChshBand) =
    // If closed-loophole readout does NOT convict, opening loopholes must not make it convict either.
    let closed = readout band loopholesAllClosed
    let opened = readout band commitPairLoopholes
    match closed with
    | CommonCauseConvicted _ -> true // closed may convict; no constraint on the weaker side here
    | _ ->
        match opened with
        | CommonCauseConvicted _ -> false // opening loopholes must never create a conviction
        | _ -> true
