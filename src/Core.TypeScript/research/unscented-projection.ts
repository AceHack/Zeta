/**
 * unscented-projection.ts — the Unscented Transform as a Gaussian-projection rule, and
 * the measurement of where it beats linearisation and where it provably cannot.
 *
 * ## Why this file exists
 *
 * Aaron 2026-09-09, on 3DGUT (Wu, Martinez Esturo, Mirzaei, Moenne-Loccoz & Gojcic,
 * *"3DGUT: Enabling Distorted Cameras and Secondary Rays in Gaussian Splatting"*, NVIDIA
 * / University of Toronto, 2025):
 *
 * > *"we may be able to pull in some of our bayesian stuff and learn from this paper …
 * > we are not on nvidia so we will have to redo everything for more vendor neutral or
 * > take a different approach. but we have a lot of advanced bayesian inference stuff
 * > that ties directly to our clifford too."*
 *
 * 3DGUT replaces 3D Gaussian Splatting's EWA splatting step (Zwicker, Pfister, Van Baar
 * & Gross, *EWA Splatting*, IEEE TVCG 8(3), 2002) — which projects a Gaussian by
 * linearising the projection and conjugating the covariance, `Σ' = J Σ Jᵀ` — with the
 * **Unscented Transform** (Julier & Uhlmann, *New extension of the Kalman filter to
 * nonlinear systems*, SPIE Defense, Security & Sensing, 1997; weights per Wan & Van Der
 * Merwe, *The unscented Kalman filter for nonlinear estimation*, IEEE AS-SPCC, 2000),
 * which pushes `2N+1` deterministic sigma points through the projection *exactly* and
 * re-estimates the moments from their images.
 *
 * This module implements both, plus a Monte-Carlo reference, so the question
 * **"does the UT buy Zeta anything?"** is answered by measurement rather than by
 * enthusiasm. It is vendor-neutral by construction: plain TypeScript, no GPU, no CUDA,
 * runs under `bun`.
 *
 * ## The load-bearing result, stated up front because it is negative
 *
 * > **For an affine projection `g(x) = Ax + b`, the Unscented Transform and EWA
 * > linearisation produce the SAME answer, and both are exactly correct.**
 *
 * The proof is two lines and is worth stating because it settles the transfer question
 * before any benchmark runs. The sigma points are symmetric about `μ` and their mean
 * weights sum to 1, so the pushed mean is `Σᵢ wᵢ^μ (A xᵢ + b) = A μ + b`. The pushed
 * deviations are `A (xᵢ − μ)`, so the recombined covariance is
 * `A [Σᵢ wᵢ^Σ (xᵢ − μ)(xᵢ − μ)ᵀ] Aᵀ = A Σ Aᵀ` — which is precisely what EWA computes,
 * because for an affine map the Jacobian *is* `A` everywhere and the linearisation is not
 * an approximation at all. The UT's entire value proposition is the higher-order terms
 * that linearisation discards; an affine map has none.
 *
 * **Zeta's 8D→3D rendering projection is affine.** `clifford-e8-coxeter-projection.ts`
 * projects each E8 root by `x = ⟨r, e1⟩, y = ⟨r, e2⟩` against an orthonormal Coxeter-plane
 * frame, and `clifford-e8-eigenlayer-tessellation.ts` gets its 3D embedding by taking two
 * coordinates from one invariant eigenplane and one from another. Both are dot products
 * against fixed orthonormal vectors — a matrix multiply. So on the projection Zeta
 * actually ships, the UT is a **no-op with extra steps**, and `F2` below measures exactly
 * that against the real root set rather than a stand-in.
 *
 * The UT earns its cost only where the projection is genuinely nonlinear, which is the
 * paper's own finding: their Fig. 12/13 report UT and EWA "consistent for the static
 * pinhole camera case" and UT pulling ahead only under fisheye, radial distortion and
 * rolling shutter. `F3` reproduces that boundary in our own code.
 *
 * ## One place this is a STRONGER test than the paper's
 *
 * 3DGUT compares the UT against EWA using "the Jacobian from [3DGS], which does not
 * account for these additional distortions" — i.e. against a linearisation of the *wrong*
 * map. That inflates the UT's margin. Here `ewaProject` takes a Jacobian, and the tests
 * feed it a high-accuracy central-difference Jacobian **of the actual projection being
 * measured**. If the UT still wins, the win is attributable to discarded higher-order
 * terms and not to a mismatched derivative. This is the honest version of the comparison.
 *
 * ## Registers (`.claude/rules/toy-is-free-metered-must-be-earned.md`)
 *
 *   - `sigmaPoints` / `utProject` / `ewaProject` / `klDivergence2` — **metered**: each has
 *     a falsifier in `unscented-projection.test.ts` that fails when the construction is
 *     wrong, and the suite carries a control mutant that must survive.
 *   - The claim "the UT does not help Zeta's shipped projection" — **metered** by `F2`,
 *     which runs on the real 240 E8 roots.
 *   - This module is a MEASUREMENT INSTRUMENT, not a renderer. It fits nothing, learns
 *     nothing, and renders nothing. Nothing here proposes replacing Zeta's exact derived
 *     geometry with fitted Gaussians; see the accompanying research doc for why that
 *     trade is refused.
 *
 * ## Anchors (Beacon)
 *
 *   - Julier & Uhlmann 1997; Julier, Uhlmann & Durrant-Whyte 1995 — the Unscented
 *     Transform and its sigma-point construction.
 *   - Wan & Van Der Merwe 2000 — the scaled UT weights (`α`, `β`, `κ`) used below.
 *   - Zwicker et al. 2002 — EWA splatting, the linearisation this compares against.
 *   - Kerbl, Kopanas, Leimkühler & Drettakis 2023 — 3D Gaussian Splatting, which adopts
 *     the EWA step this replaces.
 *   - Wu, Martinez Esturo, Mirzaei, Moenne-Loccoz & Gojcic 2025 — 3DGUT, the paper under
 *     assessment. Read as a PDF and cited; no source from `nv-tlabs/3dgrut` was consulted
 *     or copied. The equations below are implemented from the paper's mathematics.
 */

/** A symmetric positive-definite matrix, row-major. */
export type Matrix = readonly (readonly number[])[];

/** A finite-dimensional point. */
export type Vec = readonly number[];

/** A projection: an arbitrary (possibly nonlinear) map between finite-dimensional spaces. */
export type Projection = (x: Vec) => Vec;

/** A Gaussian in `mean.length` dimensions. `cov` is symmetric positive-definite. */
export interface Gaussian {
  readonly mean: Vec;
  readonly cov: Matrix;
}

/**
 * Scaled-UT hyperparameters (Wan & Van Der Merwe 2000). 3DGUT uses `α = 1, β = 2, κ = 0`
 * throughout its evaluations; those are the defaults here so the reproduction is faithful.
 *
 *   - `alpha` spreads the sigma points around the mean.
 *   - `beta` injects prior knowledge of the distribution's tails (`β = 2` is optimal for
 *     a true Gaussian) and enters the covariance weight of the CENTRE point only.
 *   - `kappa` is a secondary scaling, conventionally 0.
 */
export interface UtParams {
  readonly alpha: number;
  readonly beta: number;
  readonly kappa: number;
}

export const DEFAULT_UT_PARAMS: UtParams = { alpha: 1.0, beta: 2.0, kappa: 0.0 };

const dot = (a: Vec, b: Vec): number => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

/**
 * Lower-triangular Cholesky factor `L` with `L Lᵀ = m`.
 *
 * The UT needs a matrix square root of `(N + λ) Σ`; any factor whose columns span the
 * right ellipsoid works, and Cholesky is the standard choice. 3DGUT avoids this step by
 * reading the factor off the 3DGS parametrisation `Σ = R S Sᵀ Rᵀ`, so `√Σ = R S` is
 * already stored — an optimisation available only when the Gaussian is *parametrised* by
 * rotation and scale, which is a property of their representation, not of the UT.
 *
 * Returns `null` when `m` is not positive-definite, rather than throwing or silently
 * emitting `NaN` — a non-PSD covariance is a caller error the caller must see.
 */
export function cholesky(m: Matrix): number[][] | null {
  const n = m.length;
  const l: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = m[i]?.[j] ?? 0;
      for (let k = 0; k < j; k++) sum -= (l[i]?.[k] ?? 0) * (l[j]?.[k] ?? 0);
      if (i === j) {
        if (!(sum > 0) || !Number.isFinite(sum)) return null;
        (l[i] as number[])[j] = Math.sqrt(sum);
      } else {
        const d = l[j]?.[j] ?? 0;
        if (d === 0) return null;
        (l[i] as number[])[j] = sum / d;
      }
    }
  }
  return l;
}

/** A sigma-point set: the points and their (distinct) mean and covariance weights. */
export interface SigmaSet {
  readonly points: readonly Vec[];
  readonly meanWeights: readonly number[];
  readonly covWeights: readonly number[];
}

/**
 * The `2N+1` scaled sigma points of a Gaussian, per 3DGUT Eq. (6)-(8) / Wan & Van Der
 * Merwe 2000.
 *
 *   x₀ = μ
 *   xᵢ = μ + (√((N+λ) Σ))_[i]      i = 1..N
 *   xᵢ = μ − (√((N+λ) Σ))_[i−N]    i = N+1..2N
 *
 * with `λ = α²(N + κ) − N`, and
 *
 *   w₀^μ = λ/(N+λ),  w₀^Σ = λ/(N+λ) + (1 − α² + β),  wᵢ^{μ,Σ} = 1/(2(N+λ)).
 *
 * `(√M)_[i]` is the i-th COLUMN of the factor. Returns `null` on a non-PSD covariance or
 * a degenerate `N + λ = 0`.
 *
 * Note the parameter interaction that matters for the affine theorem: with the paper's
 * `α = 1, κ = 0` we get `λ = 0`, hence `w₀^μ = 0` and `w₀^Σ = β = 2`. The centre point
 * therefore contributes nothing to the mean, and its `β`-weighted covariance term is
 * multiplied by the deviation `(v₀ − v_μ)`. For an AFFINE projection that deviation is
 * exactly zero, so `β` is inert and the covariance comes out exactly `A Σ Aᵀ`. For a
 * nonlinear projection `v₀ = g(μ) ≠ v_μ` and `β` genuinely acts. That asymmetry is why
 * `F1` can assert exact agreement while `F3` can still show a difference.
 */
export function sigmaPoints(g: Gaussian, params: UtParams = DEFAULT_UT_PARAMS): SigmaSet | null {
  const n = g.mean.length;
  const { alpha, beta, kappa } = params;
  const lambda = alpha * alpha * (n + kappa) - n;
  const scale = n + lambda;
  if (!Number.isFinite(scale) || scale === 0) return null;

  const scaled: Matrix = g.cov.map((row) => row.map((x) => x * scale));
  const l = cholesky(scaled);
  if (l === null) return null;

  const points: Vec[] = [g.mean];
  // Column i of L: the i-th spread direction.
  for (let i = 0; i < n; i++) {
    points.push(g.mean.map((m, k) => m + (l[k]?.[i] ?? 0)));
  }
  for (let i = 0; i < n; i++) {
    points.push(g.mean.map((m, k) => m - (l[k]?.[i] ?? 0)));
  }

  const wRest = 1 / (2 * scale);
  const meanWeights = [lambda / scale, ...new Array<number>(2 * n).fill(wRest)];
  const covWeights = [lambda / scale + (1 - alpha * alpha + beta), ...new Array<number>(2 * n).fill(wRest)];
  return { points, meanWeights, covWeights };
}

/**
 * Project a Gaussian by the Unscented Transform: push every sigma point through `g`
 * EXACTLY, then recombine (3DGUT Eq. (9)-(10)).
 *
 * `g` may be arbitrarily nonlinear, non-differentiable, or piecewise — no Jacobian is
 * required and none is formed. That derivative-freeness, not accuracy, is the UT's
 * headline property: 3DGUT's practical win is that one code path serves every camera
 * model, where EWA needs a hand-derived Jacobian per model.
 */
export function utProject(
  g: Gaussian,
  project: Projection,
  params: UtParams = DEFAULT_UT_PARAMS,
): Gaussian | null {
  const set = sigmaPoints(g, params);
  if (set === null) return null;

  const images = set.points.map((p) => project(p));
  const outDim = images[0]?.length ?? 0;
  if (outDim === 0) return null;

  const mean = new Array<number>(outDim).fill(0);
  images.forEach((v, i) => {
    const w = set.meanWeights[i] ?? 0;
    for (let k = 0; k < outDim; k++) mean[k] = (mean[k] ?? 0) + w * (v[k] ?? 0);
  });

  const cov: number[][] = Array.from({ length: outDim }, () => new Array<number>(outDim).fill(0));
  images.forEach((v, i) => {
    const w = set.covWeights[i] ?? 0;
    for (let a = 0; a < outDim; a++) {
      const da = (v[a] ?? 0) - (mean[a] ?? 0);
      for (let b = 0; b < outDim; b++) {
        const db = (v[b] ?? 0) - (mean[b] ?? 0);
        (cov[a] as number[])[b] = (cov[a]?.[b] ?? 0) + w * da * db;
      }
    }
  });
  return { mean, cov };
}

/**
 * Project a Gaussian by EWA linearisation (Zwicker et al. 2002, as used by 3DGS):
 * `mean' = g(μ)`, `Σ' = J Σ Jᵀ` for a Jacobian `J` of `g` at `μ`.
 *
 * `jacobian` is supplied by the caller, `J[out][in]`. Callers that want the fairest
 * possible EWA baseline should pass `numericalJacobian(project, μ)` — the derivative of
 * the map actually under test — rather than a Jacobian borrowed from a different camera
 * model, which is the comparison 3DGUT reports.
 */
export function ewaProject(g: Gaussian, project: Projection, jacobian: Matrix): Gaussian {
  const outDim = jacobian.length;
  const inDim = g.mean.length;
  // (J Σ)[a][k] = Σ_j J[a][j] Σ[j][k]
  const js: number[][] = Array.from({ length: outDim }, () => new Array<number>(inDim).fill(0));
  for (let a = 0; a < outDim; a++) {
    for (let k = 0; k < inDim; k++) {
      let s = 0;
      for (let j = 0; j < inDim; j++) s += (jacobian[a]?.[j] ?? 0) * (g.cov[j]?.[k] ?? 0);
      (js[a] as number[])[k] = s;
    }
  }
  // (J Σ Jᵀ)[a][b] = Σ_k (JΣ)[a][k] J[b][k]
  const cov: number[][] = Array.from({ length: outDim }, () => new Array<number>(outDim).fill(0));
  for (let a = 0; a < outDim; a++) {
    for (let b = 0; b < outDim; b++) {
      let s = 0;
      for (let k = 0; k < inDim; k++) s += (js[a]?.[k] ?? 0) * (jacobian[b]?.[k] ?? 0);
      (cov[a] as number[])[b] = s;
    }
  }
  return { mean: project(g.mean), cov };
}

/**
 * Central-difference Jacobian of `project` at `x`, `J[out][in]`.
 *
 * Central differences are `O(h²)` accurate, so with `h ≈ 1e-5` this is near machine
 * precision for the smooth maps used here — deliberately, so that EWA is measured at its
 * best and any UT advantage is attributable to higher-order structure rather than to a
 * sloppy derivative.
 */
export function numericalJacobian(project: Projection, x: Vec, h = 1e-5): number[][] {
  const inDim = x.length;
  const probe = project(x);
  const outDim = probe.length;
  const j: number[][] = Array.from({ length: outDim }, () => new Array<number>(inDim).fill(0));
  for (let k = 0; k < inDim; k++) {
    const fwd = x.map((v, i) => (i === k ? v + h : v));
    const bwd = x.map((v, i) => (i === k ? v - h : v));
    const a = project(fwd);
    const b = project(bwd);
    for (let o = 0; o < outDim; o++) {
      (j[o] as number[])[k] = ((a[o] ?? 0) - (b[o] ?? 0)) / (2 * h);
    }
  }
  return j;
}

/**
 * A deterministic PRNG (mulberry32) — the Monte-Carlo reference must replay bit-identically
 * from a seed or it is not admissible evidence here (manifesto §7 DST; the seven
 * disciplines' #4). This is a research sampler, NOT a cryptographic generator, and is used
 * for nothing but reference moments.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The reference projection: sample the source Gaussian, push every sample through `g`
 * exactly, and take the sample moments. Slow and unbiased — the arbiter both UT and EWA
 * are scored against, exactly as 3DGUT scores them (their Fig. 2 and Sec. C, at 500
 * samples per reference; the default here is larger because we are not budget-bound).
 */
export function monteCarloProject(
  g: Gaussian,
  project: Projection,
  samples: number,
  seed: number,
): Gaussian | null {
  const l = cholesky(g.cov);
  if (l === null) return null;
  const rng = mulberry32(seed);
  const n = g.mean.length;

  const gauss = (): number => {
    // Box-Muller; the uniform is clamped off zero so the log is finite.
    const u1 = Math.max(rng(), Number.MIN_VALUE);
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const images: number[][] = [];
  for (let s = 0; s < samples; s++) {
    const z = Array.from({ length: n }, gauss);
    // x = μ + L z  gives  cov(x) = L Lᵀ = Σ.
    const x = g.mean.map((m, i) => m + dot(l[i] ?? [], z));
    images.push([...project(x)]);
  }

  const outDim = images[0]?.length ?? 0;
  if (outDim === 0) return null;
  const mean = new Array<number>(outDim).fill(0);
  for (const v of images) for (let k = 0; k < outDim; k++) mean[k] = (mean[k] ?? 0) + (v[k] ?? 0) / images.length;
  const cov: number[][] = Array.from({ length: outDim }, () => new Array<number>(outDim).fill(0));
  for (const v of images) {
    for (let a = 0; a < outDim; a++) {
      for (let b = 0; b < outDim; b++) {
        (cov[a] as number[])[b] =
          (cov[a]?.[b] ?? 0) + (((v[a] ?? 0) - (mean[a] ?? 0)) * ((v[b] ?? 0) - (mean[b] ?? 0))) / images.length;
      }
    }
  }
  return { mean, cov };
}

/**
 * `KL(p ‖ q)` between two 2D Gaussians, in nats — the scoring function 3DGUT uses to
 * rank projection methods against a Monte-Carlo reference (their Sec. C).
 *
 *   KL = ½ [ tr(Σq⁻¹ Σp) + (μq−μp)ᵀ Σq⁻¹ (μq−μp) − k + ln(det Σq / det Σp) ]
 *
 * Restricted to `k = 2` because that is the only case the tests need and a closed-form
 * 2×2 inverse keeps it exact. Returns `null` on a singular or non-positive determinant
 * rather than emitting a meaningless number.
 */
export function klDivergence2(p: Gaussian, q: Gaussian): number | null {
  const det = (m: Matrix): number => (m[0]?.[0] ?? 0) * (m[1]?.[1] ?? 0) - (m[0]?.[1] ?? 0) * (m[1]?.[0] ?? 0);
  const dp = det(p.cov);
  const dq = det(q.cov);
  if (!(dp > 0) || !(dq > 0)) return null;

  const qi = [
    [(q.cov[1]?.[1] ?? 0) / dq, -(q.cov[0]?.[1] ?? 0) / dq],
    [-(q.cov[1]?.[0] ?? 0) / dq, (q.cov[0]?.[0] ?? 0) / dq],
  ];
  let trace = 0;
  for (let a = 0; a < 2; a++) {
    for (let k = 0; k < 2; k++) trace += (qi[a]?.[k] ?? 0) * (p.cov[k]?.[a] ?? 0);
  }
  const d = [(q.mean[0] ?? 0) - (p.mean[0] ?? 0), (q.mean[1] ?? 0) - (p.mean[1] ?? 0)];
  let maha = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) maha += (d[a] ?? 0) * (qi[a]?.[b] ?? 0) * (d[b] ?? 0);
  }
  return 0.5 * (trace + maha - 2 + Math.log(dq / dp));
}

/** Largest absolute entrywise difference between two same-shaped matrices. */
export function maxAbsDiff(a: Matrix, b: Matrix): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < (a[i]?.length ?? 0); j++) {
      worst = Math.max(worst, Math.abs((a[i]?.[j] ?? 0) - (b[i]?.[j] ?? 0)));
    }
  }
  return worst;
}

/** Largest absolute difference between two same-length vectors. */
export function maxAbsDiffVec(a: Vec, b: Vec): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  return worst;
}

/**
 * Build an affine projection `x ↦ A x + b` — the class Zeta's Coxeter-plane and
 * eigenlayer projections belong to, and the class on which the UT is provably redundant.
 */
export function affineProjection(a: Matrix, b: Vec): Projection {
  return (x: Vec) => a.map((row, i) => dot(row, x) + (b[i] ?? 0));
}

/**
 * Pinhole projection `(x, y, z) ↦ f (x/z, y/z)`. Mildly nonlinear: the perspective divide
 * is the only nonlinearity, and 3DGUT measures UT and EWA as "consistent" on it.
 */
export function pinholeProjection(focal: number): Projection {
  return (p: Vec) => {
    const z = p[2] ?? 0;
    return [(focal * (p[0] ?? 0)) / z, (focal * (p[1] ?? 0)) / z];
  };
}

/**
 * Equidistant fisheye `(x, y, z) ↦ f θ (x, y)/r`, with `θ = atan2(r, z)`, `r = hypot(x, y)`.
 * Strongly nonlinear — the regime where 3DGUT reports the UT pulling clearly ahead, and
 * the regime `F3` uses to establish that the UT's advantage is real but conditional.
 */
export function fisheyeProjection(focal: number): Projection {
  return (p: Vec) => {
    const x = p[0] ?? 0;
    const y = p[1] ?? 0;
    const z = p[2] ?? 0;
    const r = Math.hypot(x, y);
    if (r === 0) return [0, 0];
    const theta = Math.atan2(r, z);
    const s = (focal * theta) / r;
    return [s * x, s * y];
  };
}
