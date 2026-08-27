// TOY MODEL — time-weighted semver-adherence estimator.
//
// ── DOES `TravelerRankLedger.fs` GENERALISE? PARTLY, AND THE MISSING HALF IS
//    EXACTLY THE HALF THAT WAS ASKED FOR. ───────────────────────────────────────
//
// The brief said to reuse `src/Core/TravelerRankLedger.fs` rather than invent an
// estimator, on the grounds that (a) it is the same (subject × domain) shape with
// a rating AND an uncertainty, and (b) "TrueSkill's dynamics factor inflates σ
// with time since last observation, so stale evidence decays in confidence rather
// than by an arbitrary decay constant".
//
// (a) is true and the shape transfers cleanly:
//
//     (traveler × hat-domain) -> SkillBelief      becomes
//     (publisher × ecosystem) -> ToyAdherenceBelief
//
//   with the outcome bit reinterpreted: `hit` is no longer "the traveler's
//   prediction landed" but "this publisher's non-major release did not break
//   its consumers". Domain isolation transfers with it and is worth keeping —
//   a publisher's record in `npm` says nothing about their record in `cargo`,
//   the same way standing as a verifier does not buy standing as a signer. So
//   does the honest `0.5` prior for a fresh identity, which is the whitewash
//   guard: a publisher with a bad record cannot improve it by republishing
//   under a new name, they can only return to the prior.
//
// (b) IS NOT TRUE OF THAT FILE, and this is the thing to say out loud rather
//   than paper over. `TravelerRankLedger.fs` has NO dynamics factor. Read its
//   `update`: there is no τ, and its own docstring states the property —
//   "σ² is strictly decreasing with each observation (posterior concentrates)".
//   A strictly-decreasing σ² is precisely the swallowing Aaron named:
//
//     Aaron: "based on a time weighed average not all history or else recent
//             non adherence can get swallowed by lots of past adherence."
//
//   After fifty clean releases σ² is tiny, so the fifty-first release breaking
//   its consumers barely moves μ. The estimator would report a rising score
//   through the exact window where the evidence turned.
//
// So the reuse is honest but partial: the ADF probit update below is
// `TravelerRankLedger.update` transcribed, and the dynamics factor is ADDED. It
// is not an invented decay constant — it is TrueSkill's own τ (Herbrich, Minka &
// Graepel 2006, the dynamics factor between time slices), which is the
// mechanism the brief described and the F# file omitted. If that file ever
// grows a τ, this should be deleted in favour of calling it.
//
// NONINTERFERENCE (§13): the "time" in "time-weighted" enters as a DECLARED
// PARAMETER — `gap`, the number of intervening release intervals — never as a
// clock. Nothing here reads `Date`, and it cannot: a wall-clock read would make
// the estimator irreplayable and would leak local time into a shared conclusion
// (`.claude/rules/local-time-never-enters-the-shared-fold.md`).

import type { ToyAdherenceBelief } from "./types.ts";

/// Prior mean. 0 → neutral: no evidence either way.
export const TOY_MU_0 = 0;
/// Prior standard deviation.
export const TOY_SIGMA_0 = 1;
/// Performance noise. 1 → score(fresh) = Φ(0) = 0.5, the honest floor.
export const TOY_BETA = 1;
/// TrueSkill's dynamics factor. Per unit of `gap`, σ² is inflated by τ².
/// τ = 0 reproduces `TravelerRankLedger.fs` exactly, which is what the
/// swallowing falsifier in the tests uses as its control.
export const TOY_TAU = 0.2;
/// Numerical floor.
export const TOY_EPS = 1e-10;

/// Standard normal PDF.
function phi(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/// Standard normal CDF via Abramowitz & Stegun 7.1.26. Max error < 1.5e-7.
/// Same approximation as `TravelerRankLedger.bigPhi`, so the two agree.
export function bigPhi(x: number): number {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const z = x / Math.SQRT2;
  const t = 1 / (1 + p * Math.abs(z));
  const poly = (a1 + (a2 + (a3 + (a4 + a5 * t) * t) * t) * t) * t;
  const e = 1 - poly * Math.exp(-z * z);
  return 0.5 * (1 + (z >= 0 ? e : -e));
}

/// Mill's ratio v(t) = φ(t)/Φ(t) — the EP correction for a hit.
function millsV(t: number): number {
  const denom = bigPhi(t);
  return denom < TOY_EPS ? phi(t) / TOY_EPS : phi(t) / denom;
}

/// EP precision factor w(t) = v(t)·(v(t)+t).
function millsW(t: number): number {
  const v = millsV(t);
  return v * (v + t);
}

/// The prior — a publisher with no observations. Deliberately identical to a
/// publisher who discarded a damaged name: re-minting returns you to the prior,
/// it does not get you below it and it does not get you above it.
export const toyFreshBelief: ToyAdherenceBelief = {
  mu: TOY_MU_0,
  sigma2: TOY_SIGMA_0 * TOY_SIGMA_0,
  obsCount: 0,
};

/// The adherence score: Φ(μ / √(σ² + β²)). Fresh → 0.5.
export function toyAdherenceScore(b: ToyAdherenceBelief): number {
  return bigPhi(b.mu / Math.sqrt(b.sigma2 + TOY_BETA * TOY_BETA));
}

/// The dynamics factor. `gap` is in declared observation units (intervening
/// release intervals), never seconds. Inflating σ² before an update is what
/// stops old evidence from pinning the posterior: confidence decays, the
/// estimate itself does not, so no evidence is discarded and no arbitrary
/// half-life is chosen.
/// Inflation is CAPPED AT THE PRIOR. Without the cap σ² diverges on a long clean
/// run, and that is not a rounding detail — it is the probit likelihood
/// saturating. Once μ is large, w(t) → 0, so a further success carries almost no
/// information while inflation keeps adding τ² per step. The estimator then
/// reports its most consistent publishers as its least certain ones, which is
/// backwards. Capping at σ₀² states the honest bound instead: no amount of
/// staleness can leave you knowing LESS than you knew before any evidence
/// existed. σ² ∈ (0, σ₀²], and a fully stale record's score regresses to the
/// 0.5 prior rather than to nonsense.
export function toyInflate(b: ToyAdherenceBelief, gap: number, tau = TOY_TAU): ToyAdherenceBelief {
  const g = Math.max(0, gap);
  const inflated = b.sigma2 + tau * tau * g;
  return { ...b, sigma2: Math.min(inflated, TOY_SIGMA_0 * TOY_SIGMA_0) };
}

/// One ADF probit update. Transcribed from `TravelerRankLedger.update`
/// (Herbrich et al. 2006 Eq. 4–5, ADF variant).
export function toyAdfUpdate(b: ToyAdherenceBelief, held: boolean): ToyAdherenceBelief {
  const sign = held ? 1 : -1;
  const denom = Math.sqrt(b.sigma2 + TOY_BETA * TOY_BETA);
  const t = (sign * b.mu) / denom;
  const v = millsV(t);
  const w = millsW(t);
  return {
    mu: b.mu + (b.sigma2 * sign * v) / denom,
    sigma2: Math.max(TOY_EPS, b.sigma2 * (1 - (w * b.sigma2) / (b.sigma2 + TOY_BETA * TOY_BETA))),
    obsCount: b.obsCount + 1,
  };
}

/// Record one observation: did this publisher's non-major release hold its
/// compatibility claim? `gap` is the declared distance since the last recorded
/// observation for this publisher.
///
/// Inflate-then-update is the ordering that matters. Updating first and
/// inflating after would let the fifty-first observation land against an
/// already-collapsed posterior, which is the swallowing this exists to prevent.
export function toyRecord(b: ToyAdherenceBelief, held: boolean, gap = 1, tau = TOY_TAU): ToyAdherenceBelief {
  return toyAdfUpdate(toyInflate(b, gap, tau), held);
}

/// Fold a declared sequence of observations. Pure and total; the sequence is the
/// only entropy source.
export function toyFold(
  observations: readonly { readonly held: boolean; readonly gap?: number }[],
  tau = TOY_TAU,
  start: ToyAdherenceBelief = toyFreshBelief,
): ToyAdherenceBelief {
  return observations.reduce((b, o) => toyRecord(b, o.held, o.gap ?? 1, tau), start);
}
