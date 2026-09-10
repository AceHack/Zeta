# Independent native precision-gate kernel review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: completed bounded source and equation review
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Work item: 081M1Z63YMC087G0R003N5FH9X
Source reviewed: `7100eefea413c1dd34b899fd1b7ba639494568b7`
ADR reviewed: `1393e65b439cf7a4b2a5018eeef37fed75d7d1bc`

## Disposition and scope

Accept the native kernel source within the
[ADR's](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md)
declared finite-input, conservative-arithmetic scope. Independent derivation
from the densities agrees with every local rule and both objective
derivatives. I found no material equation or implementation defect in this
scope. Two test-strength recommendations below remain distinct from a
demonstrated wrong result. The full repository gate and independent
cross-language replay remain separate admission steps.

I read the complete native module, all 22 focused fixtures, both project
insertion hunks, the ADR, and the retained first-validation archive. I did
not run a native API, test, optimizer, learner, source generator or Q8
experiment, and edited no source or test. File/Git reads and archive
decompression were bookkeeping checks. The independent Python source
`9e6be94` was not used as a substitute for these derivations.

The accepted native rules implement the density contract developed in the
[PGE design audit](2026-09-08-precision-gated-experts-design-and-source-audit.md)
and independently checked in the
[equation review](2026-09-08-precision-gated-experts-equation-review.md),
review commit `e07496b870ffea15f7a24235edae7414bbcf8f1d`.
They are not a claim to reproduce the conflicting rules or global inference
behavior of upstream PGE at `6c0a4832373b953dc6478aecb3ff1ec55934939d`.

## Immutable source association

All five current coordinator files equal their Git blobs at the reviewed
native commit. The ADR bytes also equal its predecessor pin above.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| [PrecisionGateKernels.fs](../../src/Bayesian/PrecisionGateKernels.fs) | 17,206 | `4004196cb0ade8527dfebf83fbb3e6e42bd36208e38affd09906787a84901c02` |
| [PrecisionGateKernels.Tests.fs](../../tests/Bayesian.Tests/PrecisionGateKernels.Tests.fs) | 12,248 | `610c2acfcfcf679322aa921aa9d1a850c9770866585102e9e5f05c77b9978fa1` |
| [Bayesian.fsproj](../../src/Bayesian/Bayesian.fsproj) | 3,276 | `1d33fbcabf186390c582a53256ac4b3186cadf60129f1b37b2d636dd2ac74bac` |
| [Bayesian.Tests.fsproj](../../tests/Bayesian.Tests/Bayesian.Tests.fsproj) | 3,575 | `b96a098c57f89908b5b78c98506b039c24cfbdccdaf77493de69f2c43a4bffb7` |
| [ADR](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md) | 10,271 | `f4065d3b40d5e18a98b138fc4b02e4e4a586ffb0189dc4d0d395fbf7b026979e` |

The source compile entry follows `Message.fs`; it can reuse the Gaussian
record without changing that record or its existing unchecked operators.
The focused test module is explicitly included in the Bayesian test project.
This is a local API addition, not a heterogeneous `FactorGraph` integration.

## Independent density derivation

For independent current marginals of w, x and z, write their means as
mw, mx, mz and their variances as vw, vx, vz. The expected square residual is

~~~text
E[(z-w*x)^2]
  = (mz-mw*mx)^2 + vz + vw*vx + mx^2*vw + mw^2*vx.
~~~

This follows by using `E[w^2]=vw+mw^2`, `E[x^2]=vx+mx^2` and factoring
the cross-moments under the stated independence assumption. Expanding the
expected log density of `N(z;w*x,tau^-1)` gives Gaussian natural sites

~~~text
ToZ:      precision=t,             precisionMean=t*mw*mx
ToWeight: precision=t*(vx+mx^2),    precisionMean=t*mz*mx
ToInput:  precision=t*(vw+mw^2),    precisionMean=t*mz*mw
ToTau:    LogPower=1/2,             Rate=R/2,
where t=E[tau]>0.
~~~

The implementation retains both uncertain multiplicands, including the
`mw^2*vx` term missing from the external catalog. It does not insert an
extra t into a posterior mean or omit the half-rate. Its R expansion sums
nonnegative terms, and clamped zero inputs can produce a neutral Gaussian
site or zero-rate Gamma site without being mistaken for proper beliefs.

For independent y and mu, `E[(y-mu)^2]=(my-mmu)^2+vy+vmu`.
The two Gaussian messages have precision `E[gamma]`; their precision-means
multiply that expectation by the other input's mean. The Gamma site has
power one-half and rate half that residual. A structured covariance would
add `-2*Cov(y,mu)`; the API explicitly lacks and does not claim that rule.

For fixed alpha, the parameter-dependent log Gamma density is

~~~text
alpha*log(beta) + (alpha-1)*log(gamma) - beta*gamma.
~~~

Thus the gamma site has `(LogPower,Rate)=(alpha-1,E[beta])`, while the
beta site has `(alpha,E[gamma])`, a standalone shape alpha+1. Combining
the latter at alpha2 with a shape5/rate7 prior and E[gamma]=3 gives
power6/rate10, hence shape7/rate10. The source uses alpha in the reverse
site and the fixture discriminates the erroneous alpha-minus-one update.

All of these are analytic local variational messages conditional on the
supplied marginal factorization. They are not exact marginalization of a
general joint posterior. No scheduler here substitutes cavities for current
marginals or repeatedly accumulates an old site's evidence.

## Deterministic orientation and projection objective

For an incoming positive-variable kernel `gamma^a*exp(-b*gamma)`, integrate
the declared constraint against dgamma. `delta(gamma-exp(z))` contributes
no extra factor, yielding log kernel `a*z-b*exp(z)`. In contrast,
`delta(z-log(gamma))` contributes `exp(z)` through the reciprocal derivative
at its root, yielding `(a+1)*z-b*exp(z)`. These two source branches agree
with their fixed dgamma dz factor measures. Signed incoming kernel
coefficients remain allowed; neither branch invents a normalizer or
asserts properness of the result. The forward direction is intentionally
outside this module.

For target proportional to
`exp(-t*(z-u)^2/2+k*z-c*exp(z))` and candidate `N(m,v)`, reverse KL omits
only a constant independent of candidate m and v. Gaussian moments and
entropy give

~~~text
r = c*exp(m+v/2)
F = t*((m-u)^2+v)/2 - k*m + r - log(v)/2
dF/dm = t*(m-u)-k+r
dF/dv = (t+r-1/v)/2.
~~~

Each implemented term and sign agrees. Computing r as
`exp(log(c)+m+v/2)` avoids the particular premature overflow of `exp(m)`
when c is tiny. It does not establish a globally correctly rounded result.
The stationary witness `t=1,u=0,k=1,c=exp(-1/4),m=0,v=1/2` has r=1,
both derivatives zero and `F=1.25+log(2)/2` in exact arithmetic. Its native
comparison appropriately uses a stated binary64 tolerance.

The API returns an objective evaluation, not a projected distribution,
normalizing constant, optimizer result or convergence certificate. A later
parameter posterior requires actual priors, ordered observations, a mixed
schedule and retained output parameter bytes. None is implicitly learned by
calling these local functions.

## API and numerical-domain boundary

The immutable records are not admission tokens. Every operation rechecks
the numerical fields it consumes. Real moments allow finite nonnegative
variance, with zero explicitly identifying a clamped value. Proper Gaussian
admission instead requires positive precision and representable nonzero
variance. A zero-precision linear site is rejected as a belief even though
it remains legal site data.

Gamma and Gaussian products/quotients add or subtract finite natural
coefficients, permitting improper intermediate sites. Proper Gamma admission
separately checks positive represented shape and rate and representable
positive moments. Gamma encoding reports the requested and rounded-back
shape; the small-shape collapse is an explicit refusal. The returned kernel
and represented-shape receipt disclose that conversion instead of silently
claiming the requested density was represented exactly.

The checked multiply/divide operations refuse a zero result from nonzero
operands. Exponential zero or nonfinite results refuse. Exact zero products
and exact signed cancellation remain legal. All intermediate sums are
checked for nonfinite output. This is deliberately conservative: a later
rescaling or a zero coefficient might have made some refused expression
representable. The ADR explicitly declines maximal range, whole-expression
correct rounding and rigorous error bounds, so those conservative refusals
are not violations of its contract.

The new functions construct the existing Gaussian record directly and avoid
its throwing constructor and unchecked arithmetic operators. Consumers must
use the checked functions to inherit this contract; reusing the record does
not change the behavior of the older Gaussian module. There is no I/O,
mutable schedule, random draw or optimizer in the reviewed kernel source.

## Meaningful test coverage and bounded recommendations

The 22 fixtures discriminate the source's principal risks: both uncertain
multiplicands, half-rates, the reverse alpha increment, improper versus
proper admission, requested-versus-represented shape, neutral and linear
sites, exact zero versus arithmetic underflow, nonfinite fields, the
orientation-dependent Jacobian, objective signs and log-scale evaluation.
They check actual public calls rather than only unexposed arithmetic helpers.

Two improvements would strengthen the contract without changing the accepted
mathematics:

1. The shared `refused` helper accepts any `Error`. Add representative exact
   case/locator assertions for `InvalidInput`, `ImproperBelief` and
   `NumericalFailure`. For example, nonpositive MeanTau should identify input
   admission; a neutral Gamma requested as a belief should identify Gamma
   improperness; the squared nonzero-subnormal residual should identify its
   arithmetic operation. These distinguish refusal stages instead of allowing
   an unrelated early error to satisfy every negative fixture. Prose need not
   become an exact matching contract.
2. The off-stationary finite differences derive both differences from this
   same implementation's objective. Keep them, but add a separately derived
   nonstationary value/gradient oracle. One exact-density fixture is
   `t=2,u=-1,k=3,c=exp(-2),m=1,v=2`: r=1 gives
   `F=4-log(2)/2`, `dF/dm=2`, `dF/dv=5/4`. Use explicit binary64 tolerances
   or independently evaluated high-precision comparisons. A consistent error
   shared by the value and its derivative can otherwise pass finite differences.

These are coverage recommendations, not observed incorrect native returns.
No proposed new fixture was executed by this reviewer. The ADR's separate
independent reference remains useful for additional numerical falsification.

## Retained validation audit and final limits

The [first-validation archive](precision-gate-kernels/2026-09-08/native-first-validation/README.md)
contains thirteen records. I checked every stored length/hash, decompressed
length/hash, exact current-versus-committed gzip bytes and equality with each
declared local original. The totals are 3,994 raw bytes and 1,987 stored bytes.

The first invocation built the Bayesian library and then failed the test
module at FS0892 because it opened the RequireQualifiedAccess module. Its
process exit is one. The first source manifest's native-module and project
hashes equal the accepted source; its test hash differs after qualification.
The second retained invocation exited zero and its summary reports 22
passed, zero failed and zero skipped, with a 64 ms test duration. This is
retained author execution, not reviewer execution or a benchmark. The source
hash association preserves the first failure; it does not pretend the
changed initial test preimage is part of the final test blob.

This accepts source shape, equations and the bounded retained evidence.
It does not supply a full-suite gate, independent native/decimal replay,
mixed graph integration, trained parameter artifact, calibration, performance
or a globally exact inference claim. Document validation of this review is
separate from all such executable obligations.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
