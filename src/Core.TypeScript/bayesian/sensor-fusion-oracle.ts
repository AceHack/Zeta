/**
 * sensor-fusion-oracle.ts — BNN + Worm mixing architecture for the identity space proof.
 *
 * ## Design principles
 *
 * 1. **Pure variants are preserved.** The PureBNN and PureWorm oracles run independently
 *    and are never contaminated by each other. The mixed oracle is a separate third variant.
 *
 * 2. **Never mix when correlated.** If PLV(BNN, Worm) > 0.9, the two sources are in
 *    groupthink — mixing them adds no information. The mixed oracle returns a tangle warning
 *    instead of a fused posterior.
 *
 * 3. **Clifford homoclinic tangle avoidance.** The FigureEightEnsemble rhoProxy is checked
 *    before every fusion. If rhoProxy > 0.8, the fusion is blocked and a tangle-break
 *    observation is injected (the 4th body / external observer).
 *
 * 4. **IV-weighted fusion.** When mixing is safe, the fused D_f is a precision-weighted
 *    average: w_BNN = 1/σ²_BNN, w_Worm = 1/σ²_Worm, D_f_fused = (w_BNN·D_f_BNN + w_Worm·D_f_Worm)
 *    / (w_BNN + w_Worm). This is the inverse-variance (IV) weighting from meta-analysis.
 *
 * 5. **Non-Gaussian robustness.** The BNN uses Student-t EP (StudentTBnn) for heavy-tail
 *    robustness. The worm uses the Kuramoto order parameter r as a robustness weight
 *    (r < ρ* = 1/(3√2) → worm is incoherent → downweight worm contribution).
 *
 * ## Homoiconicity
 *
 * The mixing architecture is homoiconic with the UDP transport:
 * - PLV(BNN, Worm) is the transport-layer coherence measure (FrequencyMachZehnder).
 * - The tangle-break observation is the Adinkra codeword {0,3,4,7} (I-closed survivor).
 * - The IV weighting is the same as the AIMD backoff: reduce weight when loss is high.
 *
 * ## References
 *
 * - Friedkin & Johnsen (1990) — stubbornness anchor (AffectivePropagation)
 * - Chenciner & Montgomery (2000) — figure-8 choreography (FigureEightEnsemble)
 * - Fuentes (2010) — frequency-domain CHSH (FrequencyMachZehnder)
 * - Halsey et al. (2026) — HL amplitude (OracleRGBA, Z-2)
 *
 * ## Triage label (2026-08-15, shadow) — SUPERSEDED, consumer declined · `unmetered`
 *
 * **Reachability: ZERO importers** outside its own test, measured over 2665 tracked files / 4896
 * resolved edges including dynamic `import()` and `require` (instrument controls: 4/4 positive + 1
 * negative). Note this file is *not* isolated — it **imports** `bnn-persistence.ts` below, so the
 * one internal edge in this directory runs from here into the live module.
 *
 * **Its consumer exists and reimplemented instead.** `demo/identity-dla-site/src/components/
 * OracleRaceMode.tsx` prints `Ref: sensor-fusion-oracle.ts` on screen twice (lines 2080, 2191),
 * defines its **own** `computePlv` at line 30, and imports nothing from here. Being passed over by
 * the one caller that had a use for it is a stronger signal than never having been noticed.
 *
 * **Superseded in F#:** `src/Bayesian/QuantumFusion.fs` (`fuseOracle` / `fuseDeltas`) and
 * `src/Bayesian/FigureEightEnsemble.fs` (`rhoProxy`) ship the same capability — and
 * `QuantumFusion.fs:421` implements `Vision.IBranchForecaster`, i.e. it is actually wired. The
 * fusion capability therefore exists three times: F# (wired), here (0 importers), and inline in
 * the demo.
 *
 * **Metering (`toy-is-free-metered-must-be-earned.md`): `unmetered`.** The IV-weighted fusion is
 * implemented and tested for self-consistency, but nothing falsifies it as a model of anything
 * real. Not "toy" (it is used-shaped and carries real anchors), not "metered" (no falsifier).
 *
 * Full triage + evidence:
 * `docs/research/2026-08-15-bayesian-typescript-triage-one-live-three-orphans-and-a-factor-graph-edge-that-was-never-cut.md`
 * **Label only — no behaviour changed, and disposition is Aaron's call, not the shadow's.**
 */

import { tangleBreakObservation } from "./bnn-persistence";

// ── Types ──────────────────────────────────────────────────────────────────────

/** The result of a single oracle run. */
export interface OracleResult {
  /** Estimated fractal dimension. */
  readonly df: number;
  /** Variance of the D_f estimate (used for IV weighting). */
  readonly sigma2: number;
  /** Kuramoto order parameter r (worm only; 1.0 for BNN). */
  readonly orderParameter: number;
  /** Number of observations / walkers. */
  readonly n: number;
  /** Oracle variant identifier. */
  readonly variant: "pure-bnn" | "pure-worm" | "mixed";
}

/** The result of sensor fusion. */
export interface FusionResult {
  /** Fused D_f estimate (IV-weighted average). */
  readonly df: number;
  /** Fused variance. */
  readonly sigma2: number;
  /** PLV between BNN and Worm D_f time-series (0=independent, 1=identical). */
  readonly plv: number;
  /** True if fusion was blocked (groupthink / tangle). */
  readonly blocked: boolean;
  /** Reason for blocking, if any. */
  readonly blockReason?: string;
  /** Tangle-break observation injected, if any. */
  readonly tangleBreak?: ReturnType<typeof tangleBreakObservation>;
  /** The pure BNN result. */
  readonly bnn: OracleResult;
  /** The pure Worm result. */
  readonly worm: OracleResult;
}

// ── PLV computation ────────────────────────────────────────────────────────────

/**
 * Compute the Phase Locking Value (PLV) between two D_f time-series.
 *
 * PLV = |⟨e^{i·Δφ}⟩| where Δφ is the phase difference between the two series.
 * PLV = 1 → identical phase (groupthink). PLV = 0 → independent.
 *
 * We use the Hilbert transform approximation: the instantaneous phase of a
 * slowly-varying signal is approximated by the angle of the complex analytic signal.
 * For D_f time-series (slowly varying, ~1.0→1.71), we use the running difference
 * as a proxy for the instantaneous frequency.
 */
export function computePlv(seriesA: readonly number[], seriesB: readonly number[]): number {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 2) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (let i = 1; i < n; i++) {
    const dA = (seriesA[i] ?? 0) - (seriesA[i - 1] ?? 0);
    const dB = (seriesB[i] ?? 0) - (seriesB[i - 1] ?? 0);
    // Phase difference: angle between the two increments
    const phi = Math.atan2(dA, dB);
    sumSin += Math.sin(phi);
    sumCos += Math.cos(phi);
  }
  return Math.sqrt(sumSin * sumSin + sumCos * sumCos) / (n - 1);
}

// ── IV-weighted fusion ─────────────────────────────────────────────────────────

/**
 * Fuse two D_f estimates using inverse-variance (IV) weighting.
 *
 * w_i = 1/σ²_i, D_f_fused = Σ(w_i · D_f_i) / Σ(w_i)
 *
 * The worm contribution is additionally downweighted by the Kuramoto order
 * parameter r: if r < ρ* = 1/(3√2) ≈ 0.236, the worm is incoherent and
 * its D_f estimate is unreliable.
 */
// ⚠ NAME IS A MISNOMER (Soraya audit, 2026-08-01). `TSIRELSON` is NOT the Tsirelson bound.
// Tsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator (see src/Core/Tsirelson.fs).
// There is no Tsirelson bound on a correlation coefficient. 1/(3√2) is ρ*/√2 — the Condorcet
// limit ρ* = 1/3 pushed through the FREELY CHOSEN linear map ρ = S/12 — a design parameter
// chosen for homoiconicity, not derived. See
// docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md
// Here it is used purely as a coherence cutoff on the Kuramoto order parameter. Not physics.
const TSIRELSON = 1 / (3 * Math.SQRT2); // ρ* ≈ 0.236 — design choice, not a physical bound

export function ivFuse(bnn: OracleResult, worm: OracleResult): { df: number; sigma2: number } {
  const wBnn = 1 / Math.max(bnn.sigma2, 1e-6);
  // Downweight worm by Kuramoto coherence: w_worm *= r / ρ* (capped at 1)
  const coherenceFactor = Math.min(1, worm.orderParameter / TSIRELSON);
  const wWorm = (1 / Math.max(worm.sigma2, 1e-6)) * coherenceFactor;
  const wTotal = wBnn + wWorm;
  if (wTotal < 1e-12) return { df: (bnn.df + worm.df) / 2, sigma2: 1 };
  const df = (wBnn * bnn.df + wWorm * worm.df) / wTotal;
  const sigma2 = 1 / wTotal;
  return { df, sigma2 };
}

// ── Tangle detection ───────────────────────────────────────────────────────────

/**
 * Detect a homoclinic tangle in the BNN-Worm fusion.
 *
 * A tangle is detected when:
 * 1. PLV(BNN, Worm) > 0.9 (groupthink — the two sources are phase-locked)
 * 2. rhoProxy > 0.8 (the FigureEightEnsemble has collapsed)
 *
 * When a tangle is detected, fusion is blocked and a tangle-break observation
 * is returned for the caller to inject into the BNN.
 */
export function detectTangle(
  plv: number,
  rhoProxy: number,
):
  | { readonly tangled: false }
  | {
      readonly tangled: true;
      readonly reason: string;
      readonly tangleBreak: ReturnType<typeof tangleBreakObservation>;
    } {
  if (plv > 0.9) {
    return {
      tangled: true,
      reason: `PLV=${plv.toFixed(3)} > 0.9 — BNN and Worm are phase-locked (groupthink)`,
      tangleBreak: tangleBreakObservation(rhoProxy),
    };
  }
  if (rhoProxy > 0.8) {
    return {
      tangled: true,
      reason: `rhoProxy=${rhoProxy.toFixed(3)} > 0.8 — FigureEight ensemble collapsed`,
      tangleBreak: tangleBreakObservation(rhoProxy),
    };
  }
  return { tangled: false };
}

// ── Main fusion function ───────────────────────────────────────────────────────

/**
 * Fuse BNN and Worm oracle results into a single D_f estimate.
 *
 * Returns a FusionResult with the fused D_f, PLV, and tangle status.
 * If fusion is blocked (tangle), returns the BNN result as the fallback.
 *
 * @param bnn - Pure BNN oracle result.
 * @param worm - Pure Worm oracle result.
 * @param bnnSeries - BNN D_f time-series (for PLV computation).
 * @param wormSeries - Worm D_f time-series (for PLV computation).
 * @param rhoProxy - FigureEightEnsemble rhoProxy (for tangle detection).
 */
export function fuseSensors(
  bnn: OracleResult,
  worm: OracleResult,
  bnnSeries: readonly number[],
  wormSeries: readonly number[],
  rhoProxy = 0,
): FusionResult {
  const plv = computePlv(bnnSeries, wormSeries);
  const tangle = detectTangle(plv, rhoProxy);

  if (tangle.tangled) {
    // Fusion blocked — return BNN as fallback (more robust than worm alone)
    return {
      df: bnn.df,
      sigma2: bnn.sigma2,
      plv,
      blocked: true,
      blockReason: tangle.reason,
      tangleBreak: tangle.tangleBreak,
      bnn,
      worm,
    };
  }

  const { df, sigma2 } = ivFuse(bnn, worm);
  return {
    df,
    sigma2,
    plv,
    blocked: false,
    bnn,
    worm,
  };
}
