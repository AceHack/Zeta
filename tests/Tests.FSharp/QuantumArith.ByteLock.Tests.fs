module Zeta.Core.Tests.QuantumArith.ByteLock

open Xunit
open Zeta.Core

/// **QuantumArith byte-lock conformance tests.**
///
/// All 9 golden vectors must match exactly (or within 1 ULP for transcendentals).
/// These tests are the §A conformance gate for the QuantumArith port.
///
/// If any test fails, the substrate is NOT byte-locked and must not be used
/// as a reference for other substrates.

let private qa = QuantumArith.canonical
let private lambda0 = 0.004
let private theta = System.Math.PI / 4.0

// ── QA-1: complex_add ─────────────────────────────────────────────────────────

[<Fact>]
let ``QA-1 complex_add(1+2i, 3+4i) = 4+6i`` () =
    let a = qa.OfReal 1.0 |> fun r -> qa.Add r (qa.OfPolar 2.0 (System.Math.PI / 2.0))
    // Simpler: just use the tuple directly
    let a2 = QuantumArith.add (QuantumArith.mk 1.0 2.0) (QuantumArith.mk 3.0 4.0)
    Assert.Equal(4.0, fst a2)
    Assert.Equal(6.0, snd a2)

// ── QA-2: complex_mul ─────────────────────────────────────────────────────────

[<Fact>]
let ``QA-2 complex_mul(1+2i, 3+4i) = -5+10i`` () =
    let result = QuantumArith.mul (QuantumArith.mk 1.0 2.0) (QuantumArith.mk 3.0 4.0)
    Assert.Equal(-5.0, fst result)
    Assert.Equal(10.0, snd result)

// ── QA-3: complex_mag_sq ──────────────────────────────────────────────────────

[<Fact>]
let ``QA-3 complex_mag_sq(3+4i) = 25.0`` () =
    let result = QuantumArith.magSq (QuantumArith.mk 3.0 4.0)
    Assert.Equal(25.0, result)

// ── QA-4: blaschke ────────────────────────────────────────────────────────────

[<Fact>]
let ``QA-4 blaschke(0.5+0.3i, sqrt(lambda0)*e^{i*pi/4}) matches golden vector`` () =
    let a = QuantumArith.hlBumpParam lambda0 theta
    let z = QuantumArith.mk 0.5 0.3
    let result = QuantumArith.blaschke z a
    Assert.InRange(fst result, 0.47458659267475197 - 1e-12, 0.47458659267475197 + 1e-12)
    Assert.InRange(snd result, 0.26034831334370395 - 1e-12, 0.26034831334370395 + 1e-12)

// ── QA-5: blaschkeDerivMagSq ──────────────────────────────────────────────────

[<Fact>]
let ``QA-5 blaschkeDerivMagSq(0.5+0.3i, sqrt(lambda0)*e^{i*pi/4}) matches golden vector`` () =
    let a = QuantumArith.hlBumpParam lambda0 theta
    let z = QuantumArith.mk 0.5 0.3
    let result = QuantumArith.blaschkeDerivMagSq z a
    Assert.InRange(result, 1.1474510082682012 - 1e-12, 1.1474510082682012 + 1e-12)

// ── QA-6: invSqrt2 ────────────────────────────────────────────────────────────

[<Fact>]
let ``QA-6 invSqrt2 = 0.707106781186547`` () =
    Assert.InRange(QuantumArith.invSqrt2, 0.7071067811865476 - 1e-15, 0.7071067811865476 + 1e-15)

// ── QA-7: Born probability of Bell state ──────────────────────────────────────

[<Fact>]
let ``QA-7 bornProb(1/sqrt(2) + 0i) = 0.5`` () =
    let amp = QuantumArith.mk QuantumArith.invSqrt2 0.0
    let result = QuantumArith.bornProb amp
    Assert.InRange(result, 0.5 - 1e-14, 0.5 + 1e-14)

// ── QA-8: Tsirelson bound ─────────────────────────────────────────────────────

[<Fact>]
let ``QA-8 tsirelsonS = 2*sqrt(2) = 2.828427...`` () =
    Assert.InRange(QuantumArith.tsirelsonS, 2.8284271247461903 - 1e-15, 2.8284271247461903 + 1e-15)

// ── QA-9: blaschkeDerivMagSq inverse ─────────────────────────────────────────

[<Fact>]
let ``QA-9 1/blaschkeDerivMagSq(z=i, a=sqrt(lambda0)) matches golden vector`` () =
    let a = QuantumArith.hlBumpParam lambda0 0.0  // theta=0
    let z = QuantumArith.mk 0.0 1.0               // z = i
    let derivSq = QuantumArith.blaschkeDerivMagSq z a
    let invDerivSq = if derivSq > 0.0 then 1.0 / derivSq else 0.0
    Assert.InRange(invDerivSq, 1.0161287721165787 - 1e-12, 1.0161287721165787 + 1e-12)

// ── Anti-self-certifying tests ────────────────────────────────────────────────

[<Fact>]
let ``QA-ANTI-1 blaschke with a ON unit disk gives wrong result (negative control)`` () =
    // If |a| = 1, the derivative is 0 — NOT the canonical result
    let aOnDisk = QuantumArith.ofPolar 1.0 theta  // |a| = 1, NOT inside disk
    let z = QuantumArith.mk 0.5 0.3
    let derivSq = QuantumArith.blaschkeDerivMagSq z aOnDisk

    // Asserted with the same 1e-12 tolerance every POSITIVE golden vector in this file uses —
    // not bit-exact equality. `magSq (ofPolar 1.0 theta)` is `cos²θ + sin²θ`, which is 1.0 ± 1ulp
    // depending on the platform's trig implementation and whether the multiply-add is fused. So
    // `1.0 - aMagSq` is ±ε rather than 0, and the squared numerator is ~1e-32 rather than exactly 0.
    //
    // This is not a platform quirk to work around; the test was fragile by construction. Measured
    // on macOS: **2308 of 10001 sampled θ values** give `cos²θ + sin²θ ≠ 1.0` exactly. This test's
    // particular θ happened to land in the passing 77% on macOS and the failing 23% on Windows,
    // which is why it was green here and red on windows-2025 for the identical input.
    Assert.InRange(derivSq, 0.0, 1e-12)

    // And the part that makes it a NEGATIVE CONTROL rather than merely a small-number check: the
    // degenerate case must not produce the canonical QA-5 result. Without this, the test would
    // still pass if `blaschkeDerivMagSq` were changed to always return 0.
    Assert.True(
        abs (derivSq - 1.1474510082682012) > 1e-9,
        "degenerate |a| = 1 must not produce the QA-5 golden vector")

[<Fact>]
let ``QA-ANTI-2 OpenQASM adapter delegates to canonical (stub verification)`` () =
    // The adapter is a stub — it should produce the same results as canonical
    let a = QuantumArith.hlBumpParam lambda0 theta
    let z = QuantumArith.mk 0.5 0.3
    let canonical = QuantumArith.blaschke z a
    let adapted = OpenQASMAdapter.adapter.Blaschke z a
    Assert.Equal(fst canonical, fst adapted)
    Assert.Equal(snd canonical, snd adapted)
