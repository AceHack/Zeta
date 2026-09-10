# Density-consistent local kernels before learned circuit composition

Date: 2026-09-08 UTC
Status: accepted for the bounded scalar kernels; implemented and independently reviewed
Operational status: research-grade architectural decision
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

## Problem and intended behavior

The [composable-learning direction](../research/2026-09-08-composable-learning-circuit-continuation.md)
needs learned modules with explicit uncertainty and frozen parameter artifacts.
Existing Gaussian factor graphs, geometric modules and separate learners are
real integration surfaces. The next missing primitive is a reliable local
Gaussian/Gamma gate update, before implementing a mixed inference schedule or
claiming a combined learner.

The [precision-gating equation review](../research/2026-09-08-precision-gated-experts-equation-review.md)
and [pinned implementation audit](../research/2026-09-08-precision-gated-experts-design-and-source-audit.md)
find inconsistencies in the external update catalog. For example, a reverse
Gamma-rate message has shape alpha+1, and deterministic Exp and Log factors
have different Jacobians under fixed Lebesgue measures. Reproducing the pinned
upstream algorithm and implementing density-consistent rules are distinct
scientific objects. The latter is the proposed first Zeta implementation.

## Bounded first module

Add a scalar `PrecisionGateKernels` module under `src/Bayesian/`, with focused
F# tests and an independently derived Python reference. This is a local
mathematical API, not a new graph framework or a trained system. Reuse the
existing Gaussian natural-parameter record; do not call its throwing
constructor on unvalidated inputs. All new fallible public operations return
explicit error values. Mutable state, external reads and random draws are
unnecessary for this slice.

The module carries these objects:

- Real moments: finite mean and finite nonnegative variance. Zero variance
  means a clamped input; it is not a proper continuous Gaussian density.
- Gaussian site kernels: `exp(PrecisionMean*z - Precision*z*z/2)`, with
  arbitrary finite coefficients. Negative precision is allowed in quotient
  kernels. Zero precision with nonzero precision-mean is an improper
  linear-exponential kernel; only (0,0) is neutral. Proper belief admission
  requires positive finite precision, finite mean and strictly positive
  finite variance. Admission remains separate from site arithmetic.
- Gamma site kernels: `LogPower` and `Rate`, denoting
  `x^LogPower * exp(-Rate*x)` on positive x relative to dx. Products add the
  two coefficients; quotients subtract them. The neutral kernel is (0,0).
  Finite improper sites are allowed; a proper belief separately requires
  `LogPower+1 > 0` and positive rate, with finite representable moments.
- Explicit deterministic orientation: `ExpConstraint` denotes
  delta(gamma-exp(z)); `LogConstraint` denotes delta(z-log(gamma)). These
  share a constraint set but differ as factor densities under dgamma dz.

Public record construction does not imply admission. Every operation checks
its required domains and resulting finite arithmetic. A positive Gamma shape
that rounds to zero after natural-parameter conversion is refused rather than
silently admitted as a different family member. Finite arithmetic overflow or
an unrepresentable positive exponential is an explicit numerical refusal.
This does not introduce clamping that changes the stated density.

For shape-to-kernel encoding, return the requested shape, represented shape
`LogPower+1`, and kernel together. Nonzero roundtrip error is therefore visible;
only returning the requested shape would conceal the represented density.
Refuse a nonpositive represented shape. Proper Gamma admission and moments
refer to the represented shape, never a hidden requested value. The reference
keeps exact rational shape separately from this binary64 encoding receipt.

Use conservative checked arithmetic for the first implementation. A multiply
or divide of nonzero finite inputs that produces zero is an underflow refusal;
a positive exponential that produces zero is likewise refused. Nonfinite
results are numerical refusals. Exact zero inputs/products and exact signed
cancellation remain allowed, so clamped predictors and exact zero residuals
still yield valid improper sites. Proper continuous variances and Gamma means
must be finite and strictly positive; Gaussian means may be zero or negative.
This deliberately refuses some expressions whose later rescaling could have
recovered a representable result. It does not claim maximal numerical range,
correct rounding of a whole expression, or rigorous interval error bounds.

## Local rule contract

Gamma uses shape/rate. All VMP rules in this slice use the stated independent
current marginals; they do not consume BP cavities or assert structured
covariances that are absent from the inputs.

For N(z;w*x,tau^-1), use means mw,mx,mz, variances vw,vx,vz and t=E[tau]>0:

```text
R = (mz-mw*mx)^2 + vz + vw*vx + mx^2*vw + mw^2*vx
ToZ      = Gaussian(precision=t, precisionMean=t*mw*mx)
ToWeight = Gaussian(precision=t*(vx+mx^2), precisionMean=t*mz*mx)
ToInput  = Gaussian(precision=t*(vw+mw^2), precisionMean=t*mz*mw)
ToTau    = GammaKernel(LogPower=1/2, Rate=R/2).
```

The nonnegative expansion of R retains uncertainty in both multiplicands.
A singular standalone site is admissible as a kernel; combine it with a
proper prior before interpreting a posterior mean or variance.

For N(y;mu,gamma^-1), the two mean messages have precision E[gamma] and
precision-times-mean E[gamma] times the other input mean. Under independent
marginals, the Gamma kernel has LogPower=1/2 and
Rate=((my-mmu)^2+vy+vmu)/2. A correlated q(y,mu) needs a separately specified
rule retaining covariance; it is not admitted through this independent API.

For Gamma(gamma;alpha,beta), alpha, E[beta] and E[gamma] must be finite
and strictly positive. Fixed alpha gives the outgoing Gamma kernel
(LogPower=alpha-1, Rate=E[beta]) and the outgoing beta kernel
(LogPower=alpha, Rate=E[gamma]). This is the reverse shape increment that
must survive site multiplication with a prior. These positive expectation
requirements apply to this VMP rule, not to the arbitrary finite signed
Gamma site coefficients accepted by product, quotient or reverse-kernel
operations.

The reverse deterministic kernel on z, for an incoming Gamma kernel (a,b),
has log value `a*z-b*exp(z)` for ExpConstraint and
`(a+1)*z-b*exp(z)` for LogConstraint. These are unnormalized kernels; this
API does not invent a normalizing constant or claim that either is always
proper. The forward direction and positive-family projection remain outside
this first slice.

## Explicit projection objective, without an optimizer

Expose the local Gaussian reverse-KL objective and its two analytic derivatives
for the real target proportional to
exp(-t*(z-u)^2/2 + k*z - c*exp(z)), with t,c,v positive:

```text
r = exp(log(c) + m + v/2)
F(m,v) = t*((m-u)^2+v)/2 - k*m + r - log(v)/2
DerivativeMean = t*(m-u)-k+r
DerivativeVariance = (t+r-1/v)/2.
```

Evaluate r in log space before exponentiation, retain finite-domain refusals,
and disclose that F omits a parameter-independent constant. This is an
objective evaluator, not a projection result, solver, convergence proof or
exact posterior. An optimizer later needs its own bounded iteration and
refusal receipt; the positive Gamma projection additionally requires its own
special-function and orientation contract.

## Independent discriminators and acceptance

The reference derives site rules with exact rational arithmetic and the
objective with high-precision decimal arithmetic. It must not call the F#
implementation or copy its numerical answers. The F# suite checks at least:

- Bilinear uncertain inputs mw=2,vw=3,mx=4,vx=5,mz=7,vz=2,t=2 give R=86,
  ToTau rate43 and weight natural parameters (precisionMean56,precision42).
- Fixed alpha2 and E[gamma]=3 give reverse Gamma shape3/rate3. Multiplication
  with prior shape5/rate7 gives posterior shape7/rate10.
- A zero-residual Normal site has zero rate and is retained as an improper
  kernel; a suitable proper prior makes its product proper.
- For incoming Gamma shape1/rate1, the Exp reverse kernel at z=1 has log
  value -exp(1); the Log orientation has log value 1-exp(1). A shared rule
  for both orientations must fail the comparison.
- t=1,u=0,k=1,c=exp(-1/4),m=0,v=1/2 makes both objective derivatives zero
  within a declared binary64 tolerance. Additional finite-difference and
  independent decimal comparisons discriminate sign and missing-term errors.
- NaN, infinity, invalid moments, nonpositive expected precision, invalid
  proper-belief admission and arithmetic overflow return errors, not an
  apparently valid belief. Kernel multiplication and prior admission are
  checked separately; improper sites are not blanket-rejected.

Tests on binary64 arithmetic do not establish real-number associativity over
all magnitudes. Numerical tolerances and accepted input cases belong in the
focused test contract, with source-bound raw outputs retained. Run the local
repository gates and independent public API review before landing the module.

## Next composition boundary

After these local rules pass, specify the mixed VMP/BP schedule explicitly:
current marginals for VMP, cavities for the chosen deterministic BP rule, and
replacement of each site's contribution on a new sweep. Recomputing one site
must not accumulate the same evidence twice. The existing `FactorGraph` BP
schedule cannot acquire VMP semantics by changing only a function name.

A later training epoch consumes ordered evidence, a prior, objective and
randomness description and produces immutable parameter bytes and a work
receipt. Queries bind those bytes, the graph, evidence and numerical schedule.
A two-expert learned gate is a first integration candidate; matched flat
Bayesian fusion, neural gating and reusable-module ablations then test the
higher composition. Neural experts remain admissible modules. This first
kernel slice establishes no learned topology, trained neural module, global
convergence, calibration, cartel-detection improvement or state-of-the-art
performance.

## Implementation disposition

The scalar module is implemented at native source
7100eefea413c1dd34b899fd1b7ba639494568b7 and accepted by the
[independent equation and public API review](../research/2026-09-08-precision-gate-kernels-native-review.md).
The review's typed-refusal and independent nonstationary-gradient test
recommendations are included in the later 24-test suite. The
[independent reference](../research/2026-09-08-precision-gate-kernels-reference-review.md),
[reviewed replay](../research/2026-09-08-precision-gate-kernels-native-reference-replay-review.md)
and [fresh-main validation](../research/precision-gate-kernels/2026-09-08/publication-validation/README.md)
retain the bounded numerical and build evidence. This accepts local kernel
semantics only; a scalar optimizer, mixed schedule, learning-epoch interface
and learned-system comparison remain separate, unimplemented steps.
