module Zeta.Tests.ToyBosonFermionParityTests

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Bayesian

module Gen = ToyBosonFermionGenerator
module Bnn = ToyBosonFermionBnn

// Falsifiers for the toy boson/fermion study (docs/research/2026-08-27-*). Every assertion here
// is written to FAIL if the thing it names stops being true — including the two that exist to
// stop the study looking better than it is: the closed-form baseline already scores 1.0 on clean
// data, and the label-shuffle null must not learn.

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

// ── The structure: Cl(4), and the invariant that stops 16 being a coincidence ────────────────

[<Fact>]
let ``TBF-01 Cl(4) splits 8 even and 8 odd by popcount parity`` () =
    Assert.Equal(16, Gen.bladeCount)
    Assert.Equal(8, List.length Gen.evenBlades)
    Assert.Equal(8, List.length Gen.oddBlades)
    Assert.Equal<int list>([ 0; 3; 5; 6; 9; 10; 12; 15 ], Gen.evenBlades)
    Assert.Equal<int list>([ 1; 2; 4; 7; 8; 11; 13; 14 ], Gen.oddBlades)

[<Fact>]
let ``TBF-02 the even part is a subalgebra and the odd part is not — the discriminating invariant`` () =
    // A count of 16 identifies nothing (an N=8 adinkra has 16 nodes, SO(10)'s spinor rep is
    // 16-dimensional, one SM generation counts 16 Weyl fermions). What identifies Cl(4)'s
    // grading is that the even blades CLOSE under the product and the odd blades do not.
    let evenClosed, oddClosed, evenDim = Gen.evenPartIsClosed ()
    Assert.True(evenClosed, "even blades must be closed under mask XOR (Cl⁺(4) ≅ Cl(3))")
    Assert.False(oddClosed, "odd blades must NOT be closed — odd·odd is even")
    Assert.Equal(8, evenDim)

[<Fact>]
let ``TBF-03 the geometric-product reorder sign is a genuine anticommuting sign`` () =
    // e₁e₂ = −e₂e₁ (distinct generators anticommute); e₁e₁ = +1 (all squares +1).
    Assert.Equal(1, Gen.reorderSign 0b0001 0b0010)
    Assert.Equal(-1, Gen.reorderSign 0b0010 0b0001)
    Assert.Equal(1, Gen.reorderSign 0b0001 0b0001)
    // e₁e₂·e₁ = −e₁e₁e₂ = −e₂: one swap.
    Assert.Equal(-1, Gen.reorderSign 0b0011 0b0001)
    // e₃·e₁e₂ = e₃e₁e₂ = +e₁e₂e₃: two swaps, so this one is POSITIVE. My first draft
    // asserted −1 here and the code was right; kept as a case because the sign is easy to guess.
    Assert.Equal(1, Gen.reorderSign 0b0100 0b0011)

// ── The [8,4,4] code, computed rather than cited ──────────────────────────────────────────────

[<Fact>]
let ``TBF-04 the code is the [8,4,4] extended Hamming code with the known weight enumerator`` () =
    Assert.Equal<(int * int) list>([ (0, 1); (4, 14); (8, 1) ], Gen.weightEnumerator ())
    Assert.Equal(4, Gen.minimumDistance ())
    Assert.Equal(16, List.length Gen.codewords)
    Assert.Equal(16, Gen.codewords |> List.distinct |> List.length)

[<Fact>]
let ``TBF-05 all-ones is a codeword — the reason weight parity is constant on cosets`` () =
    Assert.True(Gen.allOnesIsCodeword ())
    // Doubly-even ⇒ every codeword has even weight ⇒ parity is a coset invariant.
    Assert.True(Gen.codewords |> List.forall (fun c -> Gen.popcount c % 4 = 0))

[<Fact>]
let ``TBF-06 the syndrome vanishes exactly on the code`` () =
    Assert.True(Gen.codewords |> List.forall (fun c -> Gen.syndrome c = 0))
    let nonCode = [ 0 .. 255 ] |> List.filter (fun w -> not (List.contains w Gen.codewords))
    Assert.True(nonCode |> List.forall (fun w -> Gen.syndrome w <> 0))

// ── The two paths, and their join ────────────────────────────────────────────────────────────

[<Fact>]
let ``TBF-07 the Cl(4) grading and the adinkra coset parity agree on all 256 words`` () =
    // Path 1 = Cl(4) blade grade parity. Path 2 = weight parity of the adinkra node (coset).
    // They agree because 1 ∈ C = C⊥ and the four rows of H sum to 1, so coset parity IS
    // popcount(syndrome) & 1. Exhaustive, not sampled.
    Assert.Equal<int * int>((256, 256), Gen.pathsAgree ())

[<Fact>]
let ``TBF-08 the parity functional really is popcount of the syndrome, not merely correlated`` () =
    // The falsifier for TBF-07: if the agreement were an artifact of a symmetric labelling,
    // permuting the syndrome bits would preserve it. It does not — this pins the specific
    // functional rather than "some" agreement.
    let swapped w =
        let s = Gen.syndrome w
        ((s &&& 1) <<< 1) ||| ((s >>> 1) &&& 1) ||| (s &&& 0b1100)

    let agreementsUnderSwap =
        [ 0 .. 255 ]
        |> List.filter (fun w -> Gen.wordParityIsEven w = Gen.isBosonic (swapped w))
        |> List.length

    // A bit-swap keeps popcount, so this particular perturbation must still agree; the real
    // discriminator is that a NON-parity functional of the syndrome fails.
    Assert.Equal(256, agreementsUnderSwap)

    let notParity w = (Gen.syndrome w &&& 1) = 0

    let agreementsUnderProjection =
        [ 0 .. 255 ] |> List.filter (fun w -> Gen.wordParityIsEven w = notParity w) |> List.length

    Assert.True(
        agreementsUnderProjection < 256,
        "reading a single syndrome bit must NOT reproduce the grading"
    )

// ── The read-out spectrum: the result I nearly got wrong from a count ────────────────────────

[<Fact>]
let ``TBF-09 the grading is readable from exactly two received bits, in four ways`` () =
    // The code's minimum distance is 4 and it was tempting to expect the read-out to need 4
    // bits. It needs 2 — measured, not assumed (numerology-vs-number-theory).
    Assert.Equal<(int * int) list>([ (2, 4); (4, 8); (6, 4) ], Bnn.witnessSpectrum ())
    Assert.Equal(Some 2, Bnn.minimumWitnessWeight ())

    // No single received bit carries the label. This is what makes a degree-≤2 feature map an
    // earned choice rather than a convenient one: a linear read-out provably cannot do it.
    Assert.False(
        Bnn.witnessSpectrum () |> List.exists (fun (w, _) -> w <= 1),
        "a weight-1 witness would mean one bit carries the grading"
    )

[<Fact>]
let ``TBF-10 the witnesses are a coset of the code, so there are exactly 16`` () =
    let ws = Bnn.witnesses ()
    Assert.Equal(16, List.length ws)
    let u0 = ws |> List.filter (fun u -> Gen.popcount u = 2) |> List.head
    Assert.Equal<int list>(List.sort Gen.codewords, List.sort (ws |> List.map (fun u -> u ^^^ u0)))
    // The four minimum-weight witnesses pair each systematic bit with its A-block partner.
    Assert.Equal<int list>([ 0x11; 0x22; 0x44; 0x88 ], ws |> List.filter (fun u -> Gen.popcount u = 2) |> List.sort)

[<Fact>]
let ``TBF-11 the label's irrecoverability bound equals the code's minimum distance`` () =
    // An error destroys the grading beyond recovery only when it flips EVERY witness. The
    // minimum weight of such an error is computed from the code and lands on d = 4 — a
    // structural identification, not a count match: the offending set is exactly the
    // odd-overlap half of C.
    let count, minWeight = Bnn.labelIrrecoverableErrors ()
    Assert.Equal(8, count)
    Assert.Equal(Gen.minimumDistance (), minWeight)

[<Fact>]
let ``TBF-12 complementation preserves both the code and the grading`` () =
    // 1 ∈ C and popcount 1 = 8 is even, so damage d and damage 8−d are the same problem. This
    // is why the degradation curve is symmetric about damage 4 rather than monotone.
    Assert.Equal<bool * bool>((true, true), Bnn.complementSymmetry ())

// ── The metered channel (§13 noninterference) ─────────────────────────────────────────────────

[<Fact>]
let ``TBF-13 entropy is metered exactly: 4 bits for the blade plus 3 per flip operation`` () =
    for flips in 0 .. 5 do
        let samples = Gen.generate 12345UL flips 200
        Assert.All(samples, fun s -> Assert.Equal(4 + 3 * flips, s.MeteredBits))

[<Fact>]
let ``TBF-14 metered bits and realized damage DIVERGE — the gap the metering buys`` () =
    // Two flip operations landing on the same bit cancel, so a "2-flip" bucket contains
    // undamaged samples. A study indexed by requested flips instead of measured damage
    // silently mixes them in. Theory says 1/8 at k = 2; this asserts the gap is real and in
    // the right neighbourhood without pinning a sampling fluctuation.
    let samples = Gen.generate 999UL 2 20000
    Assert.All(samples, fun s -> Assert.True(s.RealizedDamage <= s.FlipOperations))

    let undamaged =
        float (samples |> List.filter (fun s -> s.RealizedDamage = 0) |> List.length)
        / float (List.length samples)

    Assert.InRange(undamaged, 0.10, 0.15)

    // ...and at k = 1 there is no gap at all, which is the control that makes the k = 2
    // measurement mean something.
    let single = Gen.generate 999UL 1 2000
    Assert.All(single, fun s -> Assert.Equal(1, s.RealizedDamage))

[<Fact>]
let ``TBF-15 the source is deterministic under replay AND actually reads its seed`` () =
    // This test's first draft called `generate` twice and compared the results. That is
    // `f(x) = f(x)` — true by construction for any pure total function, including a broken one,
    // and a step WEAKER than the seed-ignoring generator it was supposed to catch. The repo's
    // own `audit-check-arity` R2 found it. The honest remedy is a byte-lock plus a
    // seed-sensitivity assertion, not a census row, so this test now anchors three ways:
    //
    //   (a) against the CHECKED-IN hex — an assertion that can fail, and fails readably;
    //   (b) batch API vs hand-threaded source — two different code paths, with an unrelated
    //       generation run in between as a decoy for hidden global state;
    //   (c) a different seed must produce different output.
    let batch = Gen.generate 42UL 2 32 |> List.map Gen.toHex

    // (a) The byte-lock. `generate 42 2 8` is vector 5 of the golden file; the first eight
    // samples of this run must reproduce it byte for byte.
    let goldenPath = Path.Join(repoRoot (), "src", "Bayesian", "toy-boson-fermion-golden-vectors.json")
    use goldenDoc = JsonDocument.Parse(File.ReadAllText goldenPath)

    let expectedHex =
        goldenDoc.RootElement.GetProperty("vectors").EnumerateArray()
        |> Seq.find (fun v -> v.GetProperty("seed").GetUInt64() = 42UL && v.GetProperty("flips").GetInt32() = 2)
        |> fun v -> v.GetProperty("hex").GetString()

    Assert.Equal(expectedHex, batch |> List.truncate 8 |> String.concat "")

    let decoy = Gen.generate 43UL 5 17
    Assert.Equal(17, List.length decoy)

    // (b) Same stream, produced by a different code path.
    let stepped, finalSource =
        List.fold
            (fun (acc, src) _ ->
                let sample, next = Gen.generateOne 2 src
                (Gen.toHex sample :: acc, next))
            ([], Gen.sourceOfSeed 42UL)
            [ 1 .. 32 ]

    Assert.Equal<string list>(batch, List.rev stepped)
    // Resumption also has to be metered consistently, or "replayable" is only half true.
    Assert.Equal(32 * (4 + 3 * 2), finalSource.BitsDrawn)
    Assert.Equal(32 * (1 + 2), finalSource.Draws) // one crossing for the blade, one per flip

    // (c) The half a seed-ignoring generator would fail.
    let other = Gen.generate 43UL 2 32 |> List.map Gen.toHex
    Assert.NotEqual<string list>(batch, other)

[<Fact>]
let ``TBF-GOLDEN the generator conforms to the checked-in hex-in-JSON vectors`` () =
    let path = Path.Join(repoRoot (), "src", "Bayesian", "toy-boson-fermion-golden-vectors.json")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let vectors = doc.RootElement.GetProperty("vectors").EnumerateArray() |> Seq.toArray
    Assert.True(vectors.Length >= 9, "expected the v1 vector set")

    for v in vectors do
        let seed = v.GetProperty("seed").GetUInt64()
        let flips = v.GetProperty("flips").GetInt32()
        let count = v.GetProperty("count").GetInt32()
        let samples = Gen.generate seed flips count
        let actual = samples |> List.map Gen.toHex |> String.concat ""
        Assert.Equal(v.GetProperty("hex").GetString(), actual)
        Assert.All(samples, fun s -> Assert.Equal(v.GetProperty("meteredBits").GetInt32(), s.MeteredBits))

    let structure = doc.RootElement.GetProperty("structure")
    Assert.Equal(structure.GetProperty("minimumDistance").GetInt32(), Gen.minimumDistance ())

    Assert.Equal(
        structure.GetProperty("labelIrrecoverableMinimumWeight").GetInt32(),
        snd (Bnn.labelIrrecoverableErrors ())
    )

// ── The baselines the model must be reported against ─────────────────────────────────────────

[<Fact>]
let ``TBF-16 the closed form is perfect on the clean structure — which is why clean accuracy proves nothing`` () =
    let clean = Gen.cleanStructure ()
    Assert.Equal(16, List.length clean)
    Assert.All(clean, fun s -> Assert.Equal(s.Bosonic, Bnn.closedFormBaseline s.TrueBlade))
    Assert.All(clean, fun s -> Assert.Equal(s.Bosonic, Bnn.baselineNaive s.Observed))
    Assert.All(clean, fun s -> Assert.Equal(s.Bosonic, Bnn.baselineEccDecode s.Observed))

[<Fact>]
let ``TBF-17 the ECC decoder is exact up to the code's unique-decoding radius and no further`` () =
    // t = ⌊(d−1)/2⌋ = 1. Every weight-1 error is corrected; some weight-2 error is not. The
    // second half is the falsifier — without it the claim is unfalsifiable.
    let allWeightOneCorrected =
        [ 0 .. 15 ]
        |> List.forall (fun blade ->
            [ 0 .. 7 ]
            |> List.forall (fun bit ->
                Bnn.baselineEccDecode (Gen.encode blade ^^^ (1 <<< bit)) = Gen.isBosonic blade))

    Assert.True(allWeightOneCorrected, "weight-1 errors must all be corrected")

    let someWeightTwoFails =
        [ 0 .. 15 ]
        |> List.exists (fun blade ->
            [ 0 .. 7 ]
            |> List.exists (fun i ->
                [ 0 .. 7 ]
                |> List.exists (fun j ->
                    i <> j
                    && Bnn.baselineEccDecode (Gen.encode blade ^^^ (1 <<< i) ^^^ (1 <<< j))
                       <> Gen.isBosonic blade)))

    Assert.True(someWeightTwoFails, "a weight-2 error must be able to defeat the decoder")

[<Fact>]
let ``TBF-18 the exact Bayes posterior is a real posterior, not a relabelled point estimate`` () =
    // Clean channel: certainty. Damaged channel: strictly interior probabilities.
    Assert.Equal(1.0, Bnn.baselineExactBayes 0 (Gen.encode 3), 9)
    let p = Bnn.baselineExactBayes 3 (Gen.encode 3 ^^^ 0b1010)
    Assert.InRange(p, 0.01, 0.99)
    Assert.True(Bnn.effectiveFlipProbability 0 = 0.0)
    Assert.InRange(Bnn.effectiveFlipProbability 2, 0.218, 0.219)

// ── The toy BNN, always as a delta, and the null that guards it ───────────────────────────────

[<Fact>]
let ``TBF-19 the toy BNN matches the closed form on clean data — delta zero, which is the point`` () =
    let fitted = Bnn.train (Gen.generate 7UL 0 512 |> List.map (fun s -> s.Observed, s.Bosonic))
    let clean = Gen.cleanStructure ()

    let bnnAccuracy =
        Bnn.accuracy (clean |> List.map (fun s -> Bnn.predict fitted s.Observed, s.Bosonic))

    let baselineAccuracy =
        Bnn.accuracy (
            clean
            |> List.map (fun s -> (if Bnn.closedFormBaseline s.TrueBlade then 1.0 else 0.0), s.Bosonic)
        )

    Assert.Equal(1.0, baselineAccuracy, 9)
    Assert.Equal(1.0, bnnAccuracy, 9)
    // Delta against the closed form is exactly zero. Reported, not hidden.
    Assert.Equal(0.0, bnnAccuracy - baselineAccuracy, 9)

[<Fact>]
let ``TBF-20 the label-shuffle null does not learn — averaged over seeds, because its variance is large`` () =
    // The null's effective sample size is the number of DISTINCT structures, not the number of
    // rows, so a single seed straddles chance widely. Averaging across seeds is the honest
    // check, and the band is wide enough that only a real leak breaks it.
    let accuracies =
        [ 1UL .. 8UL ] |> List.map (fun s -> (Bnn.study s 2 2000 2000).ShuffledAccuracy)

    let mean = List.average accuracies
    Assert.InRange(mean, 0.42, 0.58)
    // And the fitted model on TRUE labels must beat it by a wide margin at the same settings —
    // without this the null passing would be consistent with the pipeline learning nothing.
    let row = Bnn.study 2026UL 1 2000 2000
    Assert.True(row.BnnAccuracy - row.ShuffledAccuracy > 0.3)

[<Fact>]
let ``TBF-21 the BNN tracks the exact Bayes ceiling and never exceeds it beyond noise`` () =
    let row = Bnn.study 2026UL 2 4000 4000
    Assert.True(
        row.BnnAccuracy <= row.ExactBayesAccuracy + 0.02,
        "nothing may beat the exact posterior by more than sampling noise"
    )

    Assert.True(row.BnnAccuracy >= row.ExactBayesAccuracy - 0.05, "the BNN should get close to the ceiling")

[<Fact>]
let ``TBF-22 the posterior degrades AT the code's unique-decoding radius, not before it`` () =
    // The headline. Stratified by MEASURED damage, so the code's bound (a Hamming weight) and
    // the curve share an axis.
    let rows = Bnn.studyByDamage 555UL 2 4000 [ 0 .. 3 ] 4000
    let at d = rows |> List.find (fun r -> r.RealizedDamage = d)

    // Inside the radius: perfect and confident.
    Assert.Equal(1.0, (at 0).BnnAccuracy, 6)
    Assert.Equal(1.0, (at 1).BnnAccuracy, 6)
    Assert.True((at 1).BnnMeanConfidence > 0.95)
    Assert.True((at 1).BnnEce < 0.02)

    // One step outside it: accuracy collapses AND the posterior widens to say so.
    Assert.True((at 2).BnnAccuracy < 0.70, "accuracy must collapse past t = 1")
    Assert.True((at 2).BnnMeanConfidence < 0.75, "and the posterior must widen rather than stay certain")

[<Fact>]
let ``TBF-23 at damage 3 the posterior is confidently WRONG — and so is the exact Bayes one`` () =
    // The negative half of the headline, pinned so it cannot quietly disappear. Beyond the
    // decoding radius the nearest codeword is systematically the wrong-parity one, so a
    // calibrated posterior does not rescue you: high confidence, below-chance accuracy. This is
    // a property of the structure, not a defect of the model — the closed-form Bayes column
    // does the same thing.
    let rows = Bnn.studyByDamage 555UL 2 4000 [ 3 ] 8000
    let at3 = rows |> List.find (fun r -> r.RealizedDamage = 3)
    Assert.True(at3.BnnAccuracy < 0.5, "below chance at damage 3")
    Assert.True(at3.BnnMeanConfidence > 0.9, "yet confident — the failure a bare accuracy hides")
    Assert.True(at3.BnnEce > 0.3, "which is exactly a large calibration error")
    Assert.True(abs (at3.BnnAccuracy - at3.ExactBayesAccuracy) < 0.02, "the closed form fails identically")
