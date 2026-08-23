# Student-t is not dropped — it is the *marginal*. Storing `(μ,σ,ν)` is the degrade — plus the API bridge for the predictor rewrite

**Register: `toy` throughout** (`.claude/rules/toy-is-free-metered-must-be-earned.md`), with **one
exception now earned**: §3 is `metered` — the GPU claim was executed on a real Apple Metal device via
WebGPU, not read off a spec. Everything else stays `toy`.

> *"did we decide with the RGB(A)/CMYK stuff that if we want to encode into GPU texture we don't need
> Student — it's actually a degrade? can you do a writeup?"* — Aaron, 2026-08-23

**This document is the decision plus the API bridge.** The measurements live in
[`2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-natural-parameters-round-trips-student-t-does-not.md`](2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-natural-parameters-round-trips-student-t-does-not.md)
(hereafter **the codec doc**) and are cross-referenced, not restated. What is new here is §0 (the
distinction that makes the answer usable), §2 (a **correction** to the codec doc's §3.1), §3 (the GPU
claim, promoted from *read* to *measured*), and §4 (**the API bridge** — the section the codec doc
does not have at all).

---

## 0. The answer, and the distinction that decides whether it is usable

**Yes — but the sentence has to be said precisely, and the imprecise version is wrong.**

> **The Student-t distribution is not dropped and is not a degrade. It is exactly what NG4 gives you:
> the Normal-Gamma marginal on the weight *is* a Student-t with `ν = 2α`.**
>
> **What degrades is storing `(μ, σ, ν)` as the texel parameterisation instead of the Normal-Gamma
> natural parameters. Same distribution. Worse carrier.**

If a reader leaves this document believing "we don't need Student-t," the document has misinformed
them. The heavy tail is **kept**. What changes is the four numbers written into the texel.

| | you keep | you lose |
|---|---|---|
| **NG4 naturals** `h = (h₁,h₂,h₃,h₄)` | the full joint over `(μ, τ)` — the t is read off it by `ngStudentT` whenever wanted | nothing; fusion is exact |
| **t triple** `(μ, σ, ν)` | a *picture* of the marginal | **the joint** — which is the only thing that fuses |

The one-line reason the triple fails: **`ngStudentT` is a 4→3 projection with no inverse.** Measured
(`/tmp` probe, reproduced in §4.3): from `NG4 {m: 0.4, λ: 10, α: 6, β: 1.5}` you get
`t {ν: 12, loc: 0.4, scale: 0.158113883008}` — and inverting with `λ = 1`, `λ = 10`, `λ = 100` all
reproduce that *same* t triple while giving three *different* Normal-Gammas. **The t triple round-trips;
the posterior does not.** Storing the marginal is storing the shadow and discarding the object.

---

## 1. Reason one — restated precisely, because the usual statement is *false*

The codec doc §3.1 says the family is not closed under fusion, measures
`(X*Y)*Z → ν=7` versus `X*(Y*Z) → ν=6`, and concludes:

> *"Under **any** projection rule, 'blend three parents' stops meaning one thing."*

**I re-ran it, and that last sentence is wrong. I am correcting it here.**

### 1.1 The reproduction (my numbers, this tree, `origin/main` @ `86ff1331`)

`bun src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts`, §4:

```
t(mu,s,nu) (X*Y)*Z mu=-0.823586206897  nu=7
           X*(Y*Z) mu=-0.823586206897  nu=6   |dmu|=1.110e-16
NG4        (P*Q)*R m=1.67358490566    P*(Q*R) m=1.67358490566    |d|=0.000e+0
```

The `ν=7` vs `ν=6` split reproduces exactly. But note what the same line shows: **`|dmu| = 1.110e-16`
— machine epsilon.** The mean is associative. A reader who stops at the ν row learns the wrong lesson,
and a reader who stops at the μ row learns the opposite wrong lesson. Digging one level:

```
(X*Y)*Z   mu=-0.823586206897  sigma=0.343840953037  nu=7
X*(Y*Z)   mu=-0.823586206897  sigma=0.332181919415  nu=6
          |dmu|=1.110e-16  |dsigma|=1.166e-2  |dnu|=1
implied sd  (X*Y)*Z=0.406838102172   X*(Y*Z)=0.406838102172
```

**The first two moments agree to twelve digits; `σ` and `ν` disagree by 3.4% and by a whole degree of
freedom.** That is the sharpest available statement of the defect: *the projection preserves exactly
what it moment-matches and loses everything else* — and what it loses is **the tail**, which is the
only reason anyone chose a Student-t.

### 1.2 The correction: associativity is recoverable, so it is *not* the reason

I tested eight ν-closure rules on the same three parents:

| ν-closure rule | `(XY)Z` ν | `X(YZ)` ν | `\|dν\|` | `\|dσ\|` |
|---|---|---|---|---|
| `min+1` (the one in the tree) | 7 | 6 | 1 | 1.17e-2 |
| `min` | 5 | 5 | **0** | **0** |
| `max` | 30 | 30 | **0** | **0** |
| `sum` | 47 | 47 | **0** | **0** |
| `sum−1` | 45 | 45 | **0** | **0** |
| harmonic mean | 11.4286 | 7.74194 | 3.69 | 1.92e-2 |
| arithmetic mean | 19.25 | 13.0 | 6.25 | 1.09e-2 |
| geometric mean | 15.2440 | 9.74004 | 5.50 | 1.65e-2 |

**Four of the eight are perfectly associative** — because `min`, `max`, and `+` are associative binary
operations, and the `(μ, v)` half never depended on the ν-rule at all. So "no projection rule can be
associative" is **false**, and the codec doc overstates. Anyone rejecting the t triple *on
associativity grounds* can be rebutted in one line, which is why the real reason has to be stated.

### 1.3 The real reason: not non-associative — **non-representable**

I built the true product of the three t densities on a 2,000,001-point grid over `[-12, 12]` and
compared:

```
TRUE product of 3 t densities:  mu=-0.761554993700  var=0.185098952147
  projected[sum  ]  mu=-0.823586206897  var=0.165517241379  nu=47
  projected[min  ]  mu=-0.823586206897  var=0.165517241379  nu=5
  projected[min+1]  mu=-0.823586206897  var=0.165517241379  nu=7
  => mu error 6.203e-2   variance relative error 1.058e-1   FOR EVERY RULE
```

**Every rule is wrong by the same amount** — 6.2e-2 in the mean and **10.6% in the variance** —
because the ν-rule never touched the `(μ, v)` computation. Choosing an associative ν-rule buys you a
fold that is well-defined **and still not the posterior**.

And the family cannot be rescued by a cleverer projection:

```
BEST-FIT Student-t to the true product (moment-matched, nu swept 2.2..200):
  nu*=15.5800  sigma*=0.40166884   max density gap = 6.393e-2
  peak true density = 0.981236     => the BEST possible t misfits by 6.52% of peak
```

> **No `(μ, σ, ν)` triple represents the product of three Student-t densities.** Associativity is a
> symptom you can paper over by picking a nicer ν-rule; **non-closure is the disease, and it has no
> rule.**

The NG4 control, same experiment, four parents, all three groupings:

```
((PQ)R)S = [-9.2,104,-30.5,30.5]
P(Q(RS)) = [-9.2,104,-30.5,30.5]
(PQ)(RS) = [-9.2,104,-30.5,30.5]
identical: true
```

Bit-identical — and, crucially, **not a projection at all**: the product of two Normal-Gammas *is* a
Normal-Gamma, so nothing is thrown away and there is nothing to be wrong about.

---

## 2. Reason two — a stored `ν` is fitted; under NG4 it is **counted**

`src/Bayesian/HeavyTailFold.fs` is a shipped, measured refusal to store a bare `ν`. Its words,
checked verbatim against `origin/main` (module header, lines 53 and 76–79):

> *"there is no function here that takes a bare `nu` and returns a verdict"*
>
> *"`tryInfer` estimates `nu` by profile likelihood and returns an interval **only when the boundary
> likelihood-ratio test rejects the Gaussian**. Otherwise it refuses, because at society scale `nu` is
> not identifiable and the estimate is noise wearing a number."*

Its own table is the evidence: at `N = 6`, `ν_true = 3`, the 10th–90th percentile of the estimate is
`1.00` to `200` — **the entire admissible range** — at LRT power `0.080`. A `ν` channel in the texel
would be a 32-bit float carrying that.

**NG4 removes the failure structurally rather than by discipline.** `α` is not fitted; it starts at the
prior and increments by ½ per absorbed observation, so `ν = 2α` is *derived from the evidence count*.
Identifiable by construction. The tail heaviness is **earned**, exactly as
`.claude/rules/every-bug-has-economic-value.md` earns everything else.

### 2.1 And the count is free — ν is exact even in f16

From the harness, both precision rows:

```
rgba32float   rel-err  nu=0.000e+0   scale=1.084e-5   abs loc=8.166e-8
rgba16float   rel-err  nu=0.000e+0   scale=7.395e-2   abs loc=7.623e-4
```

**`ν` has zero error at half precision while `scale` degrades by 7.4%.** The reason is structural, not
lucky: `h₄ = α − ½`, and `α = α₀ + n/2`, so `h₄` lands on a **half-integer grid**, which binary16
represents exactly.

**The honest bound, measured rather than assumed:** half-integers are exact in f16 up to `h₄ = 1024.5`,
so `ν = 2α` is exact up to **ν ≈ 2048** — about 2048 absorbed observations before the count channel
loses a step. Over the range the harness actually exercises (`h₄ ∈ [1.0, 200.5]`), **0 of 400
half-integers are inexact**. For contrast, on the same posteriors `h₁` is lossy in f16 every time.

So the heavy tail is **the cheapest field in the texel** — the one channel you could quantise hardest
and still get right — which is the exact inverse of the intuition that motivated storing `ν` directly.

---

## 3. Reason three — the GPU argument, and it is now **measured, not read**

This is the reason that decides it, and until today it was the weakest-supported: the codec doc §12
states plainly *"No GPU kernel was written or run."* **That is no longer true.** Aaron pointed out the
claim is testable here (*"you can execute gpu on mac in the browser with webgpu i think or canvas"*),
and it was.

**Register for this section: `metered`.**

### 3.1 What ran

WebGPU under headless Chrome 151.0.7922.170 on macOS 26.5.2, `--use-angle=metal`.

```
ADAPTER vendor=apple arch=metal-3
HAS_float32_blendable=true
DEVICE_OK float32blend_enabled=true
```

A real Apple GPU executing the arithmetic. Full feature list captured in the run log.

### 3.2 The whole claim, in one test: is conjugate update a *blend*?

Eight NG4 posteriors encoded as `vec4<f32>`, fused two ways on the device and compared against the CPU
`ngFuse` fold rounded to f32:

| path | result | vs CPU f32 |
|---|---|---|
| compute shader, `acc = acc + inp[i]` | `[-170.87875366210938, 134.14999389648438, -60, 64.5]` | **bit-exact**, max abs diff `0.000e+0` |
| **fixed-function additive blend** into `rgba32float` (`srcFactor: one, dstFactor: one, operation: add`) | `[-170.87875366210938, 134.14999389648438, -60, 64.5]` | **bit-exact**, max abs diff `0.000e+0` |

**The second row is the claim.** Fusing N Bayesian posteriors required **zero shader instructions** —
it ran in the blend unit, the fixed-function hardware that exists to composite pixels. "A blend rather
than a kernel" is now a measurement.

### 3.3 The precision guard — what I *got*, not what I *asked for*

A silently-downgraded target would fake this result, so the format was probed rather than trusted:

```
T3_ROUNDTRIP=[16777216, 70000, 1.0000001192092896, 9.99999993922529e-9]
```

`70000` survived (binary16 would have clamped it to `Infinity`, reproducing the τ-overflow finding as
a fake), `16777217 → 16777216` is correct binary32 rounding, and `1.0000001192092896` is the exact f32
neighbour of `1.0000001`. **The target really was 32-bit float.**

### 3.4 The contrast — the same blend on `(μ, σ, ν)`, and what the correct kernel costs

The measurement that makes this a *decision* rather than an endorsement. Same three parents, same
additive blend, same device:

```
T_TRUTH  (moment-matched projection, CPU) = [-0.823586207, 0.343840953,  7, 0]
T_BLEND  (same additive blend, GPU)       = [ 1.5,          3.4000000954, 47, 0]
  mu    ABS ERR = 2.324e+0
  sigma ABS ERR = 3.056e+0
  nu    47 vs 7  (the blend SUMS nu; the projection does not)
```

**Not close. Not usable. Not fixable by a scale factor.** The blend unit adds; the t fusion is not an
addition in those coordinates, so the hardware path is simply unavailable.

Doing it correctly requires leaving the blend unit for a custom compute kernel:

```wgsl
fn tfuse(x: vec4<f32>, y: vec4<f32>) -> vec4<f32> {
  let vx = x.y*x.y*x.z/(x.z-2.0);
  let vy = y.y*y.y*y.z/(y.z-2.0);
  let px = 1.0/vx; let py = 1.0/vy;
  let mu = (x.x*px + y.x*py)/(px+py);
  let v  = 1.0/(px+py);
  let nu = min(x.z, y.z) + 1.0;
  return vec4<f32>(mu, sqrt(v*(nu-2.0)/nu), nu, 0.0);
}
```

It runs, and it agrees with the CPU projection (`mu err 1.006e-7`, `sigma err 3.651e-9` — f32
rounding). It costs **6 divides, 1 sqrt, a min, and a pipeline change** — and it computes the answer
§1.3 showed is 10.6% wrong in the variance regardless.

> **Stated in terms a graphics programmer would accept:** NG4 fusion is `ONE, ONE` additive blending on
> a float target — the same fixed-function path as accumulating light in a deferred renderer. It needs
> no fragment shader, no round-trip through a compute pass, and no barrier. `(μ,σ,ν)` fusion is a
> dependent-read compute kernel with transcendentals. You are trading fixed-function throughput for
> transcendental ALU work **in order to compute a worse answer.**

### 3.5 What is still not measured

- **No performance number.** Everything above is *correctness* and *which hardware path is available*.
  I did not benchmark throughput, and no timing claim is made.
- **One adapter, one browser.** Apple `metal-3` via Chrome/ANGLE. `float32-blendable` is an **optional**
  WebGPU feature; an adapter lacking it would fall back to a compute pass for NG4 too. That would cost
  NG4 its best row and leave §3.4's contrast intact.
- The evolutionary crossover/mutation kernel remains unbuilt — `081M0QMDMD3087G0R000ZTVT1Q`.

---

## 4. The API bridge — for the predictor rewrite

**This is the section the codec doc does not have.** Measured on `origin/main` @ `86ff1331`: it
mentions `createStudentTState`, `updateStudentT`, `StudentTState`, `bnn-key-predictor`, `ngStudentT`
and `obsVariance` **zero times each**.

### 4.1 What the live consumer actually uses

`src/Core.TypeScript/bayesian/bnn-key-predictor.ts` (155 lines):

| line | usage |
|---|---|
| 1 | `import { createStudentTState, updateStudentT, type StudentTState } from "../planning/student-t-bnn";` |
| 20 | `private agents: Map<string, Record<number, StudentTState>> = new Map();` |
| 36 | `const agentBeliefs: Record<number, StudentTState> = {};` |
| 39 | `agentBeliefs[k] = createStudentTState(4.0, 0.0, diversityVariance, 0.1);` |
| 117 | `const result = updateStudentT(beliefs[k]!, y);` |
| 121 | `const weight = Math.max(0, result.state.posterior.mu);` |

**The single most useful fact for the rewrite is line 121: the predictor reads `posterior.mu` and
nothing else.** Not `sigma2`, not `nu`, not `factorMu`/`factorSigma2`, not `robustnessWeight`, not
`isOutlier`, not `varianceOnFloor`. The *consumed* surface is one scalar per key per agent. Whatever
the storage becomes, that is the contract that must survive.

### 4.2 The exact signatures to preserve

```ts
// src/Core.TypeScript/planning/student-t-bnn.ts
export interface GaussianBelief { readonly mu: number; readonly sigma2: number; }

export interface StudentTState {
  readonly posterior: GaussianBelief;  // <- Gaussian. NOT a Student-t.
  readonly factorMu: number;           // diagnostic EP site message; never divided back out
  readonly factorSigma2: number;       // legitimately negative or +Infinity
  readonly nu: number;                 // LIKELIHOOD tail index. fixed. never updated.
  readonly obsVariance: number;        // sigma2_obs. fixed. never updated.
  readonly obsCount: number;
}

export interface StudentTUpdateResult {
  readonly state: StudentTState;
  readonly robustnessWeight: number;      // w = (nu+1)/(nu+z^2), Lange-Little-Taylor 1989
  readonly standardisedResidual: number;
  readonly isOutlier: boolean;            // |z| > 2
  readonly varianceOnFloor: boolean;      // precision manufactured by a clamp — do not read as an error bar
}

export function createStudentTState(
  nu: number,            // REQUIRED, first, validated: finite and > 0
  priorMu = 0.0,
  priorSigma2 = 1.0,     // finite and > 0
  obsVariance = 0.1      // finite and > 0
): StudentTState;

export function updateStudentT(state: StudentTState, y: number): StudentTUpdateResult;
export const EP_VARIANCE_FLOOR = 1e-10;
```

And the NG4 side, which **already exists** — no maths needs writing:

```ts
// src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts
export interface NormalGamma   { readonly m: number; readonly lambda: number;
                                 readonly alpha: number; readonly beta: number; }
export interface NormalGammaNp { readonly h1: number; readonly h2: number;
                                 readonly h3: number; readonly h4: number; }

export const ngToNp   = (p: NormalGamma) => NormalGammaNp;                    // :78
export const ngFromNp = (h: NormalGammaNp) => NormalGamma;                    // :85
export const ngFuse   = (a: NormalGammaNp, b: NormalGammaNp) => NormalGammaNp;// :96  componentwise +
export const ngStudentT = (p: NormalGamma):                                   // :104
  { nu: number; loc: number; scale: number };
```

### 4.3 THE MISMATCH — and it is the most important sentence in this document

The brief asked whether `createStudentTState`'s 4-argument shape maps onto NG4's 4 parameters
one-for-one. **It does not, and the reason is not arithmetic — it is that the two `ν`s are different
objects.**

> **`StudentTState.nu` is the tail index of the observation-noise LIKELIHOOD.
> `ngStudentT(p).nu = 2α` is the degrees of freedom of the POSTERIOR MARGINAL on the weight.
> Same letter. Different object. They are not convertible, and neither is a reparameterisation of the
> other.**

Measured, absorbing `[0.5, 0.7, 3.0, 0.6]` into `createStudentTState(4.0, 0.0, 1.25, 0.1)`:

```
init  : mu=0          sigma2=1.25        nu=4  obsVar=0.1  n=0
y=0.5 : mu=0.44380817 sigma2=0.14250672  nu=4  obsVar=0.1  n=1
y=0.7 : mu=0.58457439 sigma2=0.065919479 nu=4  obsVar=0.1  n=2
y=3   : mu=0.72000980 sigma2=0.069500166 nu=4  obsVar=0.1  n=3
y=0.6 : mu=0.67181345 sigma2=0.041907657 nu=4  obsVar=0.1  n=4
=> nu and obsVariance are INVARIANT.
```

`nu` and `obsVariance` are **likelihood configuration, not posterior state** — `updateStudentT` passes
both through untouched (verified in the source: they are destructured at the top and re-emitted
unchanged). Two consequences the rewrite must not paper over:

1. **The posterior in `StudentTState` is a *Gaussian*.** This module is an assumed-density filter: the
   t is the *likelihood*, and the belief is projected back to a Gaussian after every observation
   (`tiltedMoments`). In NG4 the arrow points the other way — the *stored object* is the joint and the
   *marginal* is a genuine t. **The heavy tail moves from the likelihood to the posterior.** That is a
   model change, not an encoding change, and it should be named as one in the rewrite's commit message.
2. **The four constructor arguments do not line up:**

| `createStudentTState` arg | NG4 home | honest status |
|---|---|---|
| `priorMu` | `m` | **clean** |
| `priorSigma2` | contributes to `β` via `scale² = β/(αλ)` | **needs a chosen `λ`** — underdetermined |
| `nu` (likelihood tail) | **none** | **no home.** Not `2α`. Must travel out of band or be dropped |
| `obsVariance` (σ²_obs) | **none** | **no home.** Likelihood config; NG4 infers precision instead of being told it |

So the arity coincidence `4 → 4` is exactly the kind of count-match
`.claude/rules/numerology-vs-number-theory.md` refuses: **two of the four do not map, and one of NG4's
four (`λ`) has no source.** Register: *coincidence*, not correspondence.

### 4.4 The adapter, both directions, with the loss measured

Not a rewrite of the maths — an adapter. But an **honest, lossy** one, and the losses are named:

```ts
/** StudentTState -> NormalGamma. Uses the convention already in the round-trip harness
 *  (`toy-bnn-rgba-roundtrip.ts` `layer()`): lambda = lambda0 + n, alpha = alpha0 + n/2.
 *  DOES NOT CARRY: state.nu, state.obsVariance, factorMu, factorSigma2. */
export const studentTStateToNg = (
  st: StudentTState, lambda0 = 1, alpha0 = 1
): NormalGamma => {
  const lambda = lambda0 + st.obsCount;
  const alpha  = alpha0 + st.obsCount / 2;
  const m      = st.posterior.mu;
  const beta   = st.posterior.sigma2 * alpha * lambda;   // scale^2 = beta/(alpha*lambda)
  return { m, lambda, alpha, beta };
};

/** NormalGamma -> StudentTState. The likelihood hyperparameters must be supplied by the
 *  caller because NG4 does not contain them. factorMu/factorSigma2 are reset to the
 *  uniform site — the EP diagnostic does not survive the trip and must not be faked. */
export const ngToStudentTState = (
  p: NormalGamma, nu: number, obsVariance: number, obsCount: number
): StudentTState => ({
  posterior: { mu: p.m, sigma2: ngStudentT(p).scale ** 2 },
  factorMu: p.m,
  factorSigma2: Number.POSITIVE_INFINITY,
  nu, obsVariance, obsCount,
});
```

Measured round-trip on the 4-observation state above:

```
StudentTState -> NG4: m=0.67181345 lambda=5 alpha=3 beta=0.62861486
   NG4 marginal nu = 2*alpha = 6   <-- NOT the state's nu (4)
NG4 -> StudentTState: mu=0.67181345 sigma2=0.041907657 n=4
   posterior.mu     round-trip exact: true
   posterior.sigma2 round-trip exact: false  (|d| = 6.939e-18, one ulp)
   factorMu     preserved: false   (0.598613 -> 0.671813)
   factorSigma2 preserved: false   (0.105557 -> Infinity)
CARRIED OUT OF BAND (no NG4 home): nu=4, obsVariance=0.1, obsCount=4
```

**Where it is lossless:** `posterior.mu` — exactly, which is the only field the predictor reads (§4.1).

**Where it is not, stated plainly:**

- `posterior.sigma2` is off by **one ulp** (`6.939e-18`) — multiply-then-divide, not a design flaw.
- **`factorMu` / `factorSigma2` do not survive.** They are the EP site message. NG4 has no slot for
  one, and manufacturing a plausible-looking site would be exactly the vacuity failure
  `.claude/rules/toy-is-free-metered-must-be-earned.md` names. The adapter resets them to the honest
  uniform site (`+Infinity` variance) and this must be *reported*, not hidden — same discipline as
  `varianceOnFloor`.
- **`nu`, `obsVariance`, `obsCount` must travel beside the texel.** Three scalars per *layer* (not per
  weight), since the predictor uses the same `(4.0, 0.1)` for every key. That is a cheap uniform, not a
  fifth channel — but it must exist, and pretending the texel is self-describing is the mistake to
  avoid.
- **`λ₀`/`α₀` are a chosen convention, not a derived fact.** The values `1` and `1` come from the
  harness's synthetic layer. Under a different convention the *same* `StudentTState` yields a different
  NG4. This is the `ngStudentT` non-invertibility of §0 reappearing at the API boundary, and it is why
  the adapter takes them as explicit parameters rather than hiding defaults.

### 4.5 What the rewrite can do today

- **Keep the call sites unchanged.** `createStudentTState(4.0, 0.0, v, 0.1)` and
  `updateStudentT(state, y)` can stay exactly as they are; the adapter sits underneath.
- **Do not widen the consumed surface.** Line 121 reads `posterior.mu`. If the rewrite starts reading
  `sigma2` or `nu`, §4.4's losses become live and this document's guarantees stop applying.
- **Do not route `StudentTState.nu` into `α`.** It is the single most likely bug in this rewrite: it
  type-checks, it runs, and it silently asserts a posterior tail that no evidence counted.
- **The GPU encoding is a separate lane.** Nothing above requires the predictor to move to textures.
  NG4-in-a-texel is the *storage* decision; the predictor's ADF filter is the *inference* decision.

---

## 5. On the four-channel width — deliberately carrying no weight

Per `.claude/rules/numerology-vs-number-theory.md`, and following the codec doc §6, which settled this:
**RGBA being 4-wide is worthless as evidence and none of the argument above rests on it.** The repo's
own precedent is *"sharing the length 8 identifies nothing."* `4` is the dimension of the sufficient
statistic `T = (τ, τμ, τμ², log τ)`; the family fixes the width, and the width does not endorse the
family. Had the statistics needed five parameters the answer would have been "two textures," and the
codec doc §10 already prices that.

**Applied to this document specifically:** §4.3 is the live instance. `createStudentTState` takes 4
arguments and NG4 has 4 parameters, and that coincidence is *not* a correspondence — two of the four
do not map at all.

---

## 6. Registers — what is claimed and what is not

| claim | register | why |
|---|---|---|
| NG4 marginal is Student-t with `ν = 2α` | **fact** | standard conjugacy; `ngStudentT` implements it |
| `ngStudentT` has no inverse | **measured** | §0, three `λ` giving one t |
| t projection is non-representable, ~6.5%-of-peak misfit | **measured** (`toy`) | §1.3, dense grid, synthetic parents |
| Four ν-closure rules ARE associative | **measured** — corrects the codec doc | §1.2 |
| `ν` exact in f16 to `ν ≈ 2048` | **measured** (`toy`) | §2.1 |
| NG4 fusion runs in the fixed-function blend unit, bit-exact | **metered** | §3.2, Apple metal-3 |
| Additive blend cannot fuse `(μ,σ,ν)` | **metered** | §3.4 |
| `StudentTState.nu ≠ 2α` | **measured** | §4.3 |
| Adapter loses `factorMu`/`factorSigma2`; `mu` exact, `sigma2` 1 ulp | **measured** | §4.4 |

**Not claimed:**

- **No performance measurement of any kind.** §3 measures correctness and hardware-path availability.
- **The posteriors are still synthetic.** Every KL number inherited from the codec doc comes from
  4096 *synthetic* Normal-Gammas. **`081M0QMDMC7087G0R000W6QRCV`** (round-trip a real `MinimalBnn`
  layer) is the named weak point and it is still open. The whole quantitative half is a function of
  parameter ranges nobody has checked against a trained layer. **This document is not settled work.**
- **The adapter in §4.4 is not committed code.** It was executed as a probe against the real modules;
  it is written here for the rewrite to take, and it has no test yet.
- **One adapter, one browser** for §3 — `float32-blendable` is optional in WebGPU.
- **`α₀ = λ₀ = 1` is a convention**, inherited from a synthetic harness, not derived.

---

## 7. Owned correction

The codec doc §3.1 concludes *"Under **any** projection rule, 'blend three parents' stops meaning one
thing."* **That is false** — §1.2 exhibits four associative rules. The conclusion it supports survives
and is *stronger* under the corrected reasoning (§1.3: non-representable, not merely non-associative),
so nothing downstream changes. But the sentence as written is refutable in one line, and leaving it
would hand a reviewer a real objection to a correct decision. Flagged here rather than edited into the
sibling doc, so the correction carries its own evidence.

---

## 8. Pointers

- [`2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-natural-parameters-round-trips-student-t-does-not.md`](2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-natural-parameters-round-trips-student-t-does-not.md)
  — **the measurements.** §4 round-trip KL, §5 associativity, §6 the width question, §7 branchless ops,
  §8 the RGB→CMYK refutation, §10 layout cost. This document does not restate them.
- `src/Core.TypeScript/bayesian/toy-bnn-rgba-codec.ts` — `ngToNp`:78 · `ngFromNp`:85 · `ngFuse`:96 ·
  `ngStudentT`:104
- `src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts` — the falsifier runner (`bun` it)
- `src/Core.TypeScript/planning/student-t-bnn.ts` — `StudentTState`:114 · `createStudentTState`:199 ·
  `updateStudentT`:496
- `src/Core.TypeScript/bayesian/bnn-key-predictor.ts` — the live consumer (§4.1)
- `src/Bayesian/HeavyTailFold.fs` — the `ν`-identifiability refusal quoted in §2
- `workitems/081M0QMDMC7087G0R000W6QRCV-*` — real `MinimalBnn` layer round-trip (**the open weak point**)
- `workitems/081M0QMDMD3087G0R000ZTVT1Q-*` — the GPU kernel (fold + crossover + cone-guarded mutation)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `.claude/rules/numerology-vs-number-theory.md`
- **Beacon anchors:** Minka 2001 (EP / ADF) · Opper 1998 · Lange, Little & Taylor 1989 (t as scale
  mixture, the robustness weight) · Dawid 1973, O'Hagan 1979 (regularly varying tails reject conflict).
  Cited from the modules' own headers, which state they are cited from standing knowledge and not
  page-checked.
