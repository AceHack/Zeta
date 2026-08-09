/**
 * berry-keating-spectral-check.ts — Berry-Keating tick-sampling spectral check.
 *
 * Context (Doc 3, Connection 1, §B):
 *   §A #22 (T-1/12 Euler-Maclaurin tick-sampling theorem) establishes that the
 *   first Bernoulli correction to a discrete sum involves B₂/2! = +1/12.
 *   ζ(-1) = -1/12 (analytic continuation). Both involve 1/12 with opposite signs.
 *
 * This module checks whether the tick-sampling operator's spectrum has the same
 * B₂/2! = +1/12 correction structure as the Euler-Maclaurin formula for ζ(s).
 *
 * The Berry-Keating Hamiltonian H = xp has eigenvalues scaling as:
 *   t_n ~ 2π·n / log(t_n / 2πe)  (Riemann-von Mangoldt formula)
 *
 * The tick-sampling operator T_Δ has eigenvalues:
 *   λ_n(Δ) = ∫₀^∞ I(nΔ)·Δ  (discrete approximation to ∫₀^∞ I(ν)dν)
 *
 * The Euler-Maclaurin correction: λ_n(Δ) - ∫₀^∞ I(ν)dν = (Δ/2)I(0) - (Δ²/12)I'(0) + O(Δ⁴)
 *
 * The B₂/2! = +1/12 coefficient appears in the Δ² correction term.
 * This is the same 1/12 as ζ(-1) = -1/12, but with opposite sign.
 *
 * STATUS: §B interpretation — the standard mathematics is established;
 * the identification of the tick-sampling operator with the Berry-Keating
 * Hamiltonian is not yet proven.
 */

// ── Bernoulli numbers ─────────────────────────────────────────────────────────
export const B2 = 1 / 6; // Second Bernoulli number
export const B2_OVER_2_FACTORIAL = B2 / 2; // B₂/2! = 1/12 = +0.08333...
export const ZETA_MINUS_1 = -1 / 12; // ζ(-1) = -1/12

// ── Euler-Maclaurin correction ────────────────────────────────────────────────
export interface EulerMaclaurinResult {
  readonly continuousIntegral: number; // ∫₀^∞ I(ν)dν
  readonly discreteSum: number; // Σ I(nΔ)·Δ
  readonly correction: number; // discreteSum - continuousIntegral
  readonly predictedCorrection: number; // (Δ/2)I(0) - (Δ²/12)I'(0)
  readonly b2Term: number; // -(Δ²/12)I'(0) — the B₂/2! term
  readonly relativeError: number; // |correction - predicted| / |predicted|
}

/**
 * Verify the Euler-Maclaurin correction for a test function I(ν) = exp(-ν).
 * This is the simplest case: ∫₀^∞ exp(-ν)dν = 1, I(0) = 1, I'(0) = -1.
 * Predicted correction: (Δ/2)·1 - (Δ²/12)·(-1) = Δ/2 + Δ²/12.
 */
export function verifyEulerMaclaurin(delta: number, nTerms = 10000): EulerMaclaurinResult {
  // I(ν) = exp(-ν)
  const I = (nu: number) => Math.exp(-nu);
  const Iprime0 = -1; // I'(0) = -exp(0) = -1

  // Continuous integral: ∫₀^∞ exp(-ν)dν = 1
  const continuousIntegral = 1.0;

  // Discrete sum: Σ_{n=0}^{N} I(nΔ)·Δ
  let discreteSum = 0;
  for (let n = 0; n <= nTerms; n++) {
    discreteSum += I(n * delta) * delta;
  }

  const correction = discreteSum - continuousIntegral;
  const b2Term = -((delta * delta) / 12) * Iprime0; // -(Δ²/12)·I'(0) = +Δ²/12
  const predictedCorrection = (delta / 2) * I(0) + b2Term;
  const relativeError = Math.abs(correction - predictedCorrection) / Math.abs(predictedCorrection);

  return {
    continuousIntegral,
    discreteSum,
    correction,
    predictedCorrection,
    b2Term,
    relativeError,
  };
}

// ── Berry-Keating eigenvalue approximation ────────────────────────────────────
export interface BerryKeatingResult {
  readonly eigenvalues: number[]; // t_n for n = 1..N
  readonly spacings: number[]; // t_{n+1} - t_n
  readonly meanSpacing: number; // mean spacing
  readonly gueVariance: number; // variance of spacings (GUE prediction: π²/3 - 1 ≈ 2.29)
  readonly b2Connection: number; // B₂/2! = 1/12 as the Euler-Maclaurin coefficient
}

/**
 * Compute the Berry-Keating eigenvalue approximation using the Riemann-von Mangoldt formula.
 * t_n is the imaginary part of the n-th nontrivial zero of ζ(s).
 * Approximation: t_n ≈ 2π·n / log(n) for large n.
 */
export function computeBerryKeatingEigenvalues(nEigenvalues = 50): BerryKeatingResult {
  const eigenvalues: number[] = [];

  // Use the asymptotic formula t_n ≈ 2π·n / log(n/2πe) for n ≥ 1
  for (let n = 1; n <= nEigenvalues; n++) {
    // Riemann-von Mangoldt: N(T) ≈ T/(2π) * log(T/2πe) + 7/8
    // Invert: t_n ≈ 2π·n / log(2π·n / 2πe) = 2π·n / log(n/e)
    // Better approximation using Newton's method on N(T) = n
    let t = (2 * Math.PI * n) / Math.log(n + 1);
    for (let iter = 0; iter < 5; iter++) {
      const nt = (t / (2 * Math.PI)) * Math.log(t / (2 * Math.PI * Math.E)) + 7 / 8;
      const dnt = Math.log(t / (2 * Math.PI)) / (2 * Math.PI);
      t = t - (nt - n) / dnt;
    }
    eigenvalues.push(Math.max(t, 14.0)); // First zero is at t ≈ 14.135
  }

  // Compute spacings
  const spacings: number[] = [];
  for (let i = 0; i < eigenvalues.length - 1; i++) {
    const current = eigenvalues[i];
    const next = eigenvalues[i + 1];
    if (current !== undefined && next !== undefined) spacings.push(next - current);
  }

  const meanSpacing = spacings.reduce((s, x) => s + x, 0) / spacings.length;

  // Normalised spacings (divide by mean)
  const normSpacings = spacings.map((s) => s / meanSpacing);

  // Variance of normalised spacings (GUE prediction: π²/3 - 1 ≈ 2.29)
  const mean = normSpacings.reduce((s, x) => s + x, 0) / normSpacings.length;
  const gueVariance = normSpacings.reduce((s, x) => s + (x - mean) ** 2, 0) / normSpacings.length;

  return {
    eigenvalues,
    spacings,
    meanSpacing,
    gueVariance,
    b2Connection: B2_OVER_2_FACTORIAL, // The Euler-Maclaurin B₂/2! coefficient
  };
}

// ── Tick-sampling operator spectrum ──────────────────────────────────────────
export interface TickSamplingResult {
  readonly delta: number;
  readonly eulerMaclaurin: EulerMaclaurinResult;
  readonly b2Coefficient: number; // +1/12 (positive)
  readonly zetaMinus1: number; // -1/12 (negative)
  readonly signDifference: boolean; // true: B₂/2! and ζ(-1) have opposite signs
  readonly connectionNote: string; // honest epistemic status
}

/**
 * Check the tick-sampling operator's B₂/2! correction structure.
 * This is the Connection 1 check from the Riemann doc.
 */
export function checkTickSamplingSpectrum(delta = 0.1): TickSamplingResult {
  const em = verifyEulerMaclaurin(delta);

  return {
    delta,
    eulerMaclaurin: em,
    b2Coefficient: B2_OVER_2_FACTORIAL, // +1/12
    zetaMinus1: ZETA_MINUS_1, // -1/12
    signDifference: B2_OVER_2_FACTORIAL > 0 && ZETA_MINUS_1 < 0,
    connectionNote:
      "§B interpretation: B₂/2! = +1/12 appears in the Euler-Maclaurin correction; " +
      "ζ(-1) = -1/12 from analytic continuation. Both involve 1/12 with opposite signs. " +
      "The connection is real but not a sign equation. " +
      "Promoting to §A requires formalising the tick-sampling operator as a spectral object.",
  };
}
