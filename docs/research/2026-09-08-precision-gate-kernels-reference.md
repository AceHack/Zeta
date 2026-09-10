# Independent scalar precision-gate kernel reference

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: implemented and locally validated reference; independent review pending
Author: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Work item: 081M1Z63YMC087G0R003N5FH9X

## Source contract and retained review

The coordinator remotely co-claimed the three paths for this reference and
accepted independent implementation after the revised
[kernel ADR](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md),
commit `1393e65b439cf7a4b2a5018eeef37fed75d7d1bc`. This plan is recorded
before generating final retained vectors. The exact reference is independently
derived from the defining densities; it does not read the new F# implementation,
call F#, or copy its answers. The older
[equation review](2026-09-08-precision-gated-experts-equation-review.md) is context.

The initial read-only review of ADR
`6a80db0c6de20c883a20e2c842aa98afab1bf2b5` found no algebraic error in the
residual, VMP natural parameters, reverse Gamma increment, deterministic
orientation or Gaussian objective derivatives. It requested these closures:

1. Define arbitrary finite signed Gaussian kernel coefficients separately from
   proper-density admission; zero precision with nonzero linear coefficient
   is improper, not neutral.
2. Require finite strictly positive Gamma VMP expectations without rejecting
   arbitrary finite improper Gamma sites used in product, quotient or reverse
   deterministic operations.
3. Distinguish positive values underflowing to zero from exact residual zeros
   or clamped predictors, including proper Gamma means and continuous variances.
4. Expose nonzero shape-conversion roundtrip error, not only zero collapse.

At `1393e65b439cf7a4b2a5018eeef37fed75d7d1bc` these were accepted by bounded
read-only review. The ADR now permits signed Gaussian coefficients and checks
proper moments separately; uses positive Gamma expectations; exposes
RequestedShape, RepresentedShape and Kernel; and declares conservative binary64
multiply/divide-to-zero and exponential-to-zero refusals while preserving exact
zeros and cancellations. No material mathematical/domain finding remained.
That acceptance covers the paper contract, not implementation ordering,
numerical tolerance, compiled source or cross-language conformance.

## Owned surfaces and public boundary

Only the following source/test/report and unique evidence directory belong
to this slice:

- [Reference module](../../src/Interp.Python/zeta_interp/precision_gate_kernels_reference.py).
- [Dedicated tests](../../src/Interp.Python/tests/test_precision_gate_kernels_reference.py).
- This report.
- `precision-gate-kernels-reference-validation/2026-09-08/` beneath this directory.

Public outcomes are frozen `Success(Value)` or `Failure(Code,Field,Message)`.
Ordinary input records are revalidated. Algebraic inputs are exact int/Fraction,
excluding bool, float and subclasses. Outputs use Fraction. Records include
RealMoments(Mean,Variance), GaussianKernel(PrecisionMean,Precision) and
GammaKernel(LogPower,Rate), plus operation-specific returned records.

Public operations are soft_dot_vmp, normal_precision_vmp, gamma_rate_vmp,
Gaussian/Gamma product and quotient, Gaussian/Gamma proper moments,
gamma_from_shape, reverse_log_kernel and projection_objective. The last
two accept Decimal/int/Fraction scalar arguments in a private 80-digit,
ROUND_HALF_EVEN context. Transcendental outputs are finite Decimal.
The context is independent of the caller's decimal precision and traps.

The exact reference is not a binary64 range or expression-order emulator.
Exact shape encoding retains the exact requested shape as the represented
shape; binary64 encoding drift is a separate native observation. Exact
fractions cannot underflow. Decimal overflow/underflow and invalid operations
are typed reference numerical refusals. Neither high-precision agreement nor
finite differences is a rigorous interval certificate or all-input proof.
Implementation input-size/context limits will be disclosed with source.

## Fixed vector inventory before retained generation

The wire schema is `zeta.precision-gate-kernels.reference.v1` with Arithmetic
metadata and ordered Rows. Each row contains exactly Id, Operation, Input and
Outcome. Success has Kind=success and Value; refusal has Kind=refused and
Failure(Code,Field,Message). Rational values encode as canonical decimal integer
strings `{Num,Den}`, coprime with positive denominator and zero0/1. Decimal
values encode as finite Decimal strings. No JSON binary float represents
an exact reference scalar. Input dictionaries preserve the full named subject.

The ordered 24-row inventory is fixed here. A pair (m,v) denotes real moments;
a Gaussian pair is (PrecisionMean,Precision), a Gamma pair (LogPower,Rate).
All constants below are exact rationals except the explicitly generated
80-digit exponential coefficient in the stationary objective.

| Id | Operation and fixed inputs | Discriminator |
| --- | --- | --- |
| soft/uncertain | w=(2,3), x=(4,5), z=(7,2), mean_tau=2 | Residual86, rate43, weight(56,42); all uncertainty terms. |
| soft/clamped-zero | w=(2,0), x=(0,0), z=(0,0), mean_tau=2 | Exact zero residual and neutral weight site remain allowed. |
| soft/fractional | w=(-1/2,1/3), x=(3/2,2/5), z=(1/4,3/7), mean_tau=5/2 | Signs and rational denominators. |
| normal/uncertain | y=(3,2), mu=(-1,5), mean_gamma=3/2 | Residual23 and rate23/2. |
| normal/zero | y=(2,0), mu=(2,0), mean_gamma=3 | Improper zero-rate site. |
| gamma/rate | alpha=2, mean_beta=7, mean_gamma=3 | ToValue(1,7), ToRate(2,3). |
| gamma/product | (4,7) times (2,3) | Product(6,10); posterior shape7. |
| gamma/quotient | (6,10) divided by (4,7) | Quotient(2,3), without shape subtraction error. |
| gamma/proper | (6,10) | Shape7, mean7/10, variance7/100. |
| gamma/improper | (1/2,0) | Typed improper-belief refusal. |
| gaussian/improper-product | (2,-3) times (1,5) | Product(3,2), despite an improper input site. |
| gaussian/linear-improper | (1,0) | Typed improper-belief refusal. |
| shape/small | alpha=1/10^16, rate=1 | Exact shape survives; no binary64 emulation. |
| reverse/exp | ExpConstraint, Gamma(0,1), z=1 | Negative exp(1). |
| reverse/log | LogConstraint, Gamma(0,1), z=1 | 1-exp(1). |
| reverse/signed | ExpConstraint, Gamma(-2,-1), z=1/2 | Signed improper kernel: -1+exp(1/2). |
| objective/stationary | t=1,u=0,k=1,c=Decimal80.exp(-1/4),m=0,v=1/2 | Both derivatives near zero; c itself is a rounded Decimal input. |
| objective/general | t=3/2,u=-1/3,k=-2/5,c=7/4,m=2/3,v=3/5 | Independent Decimal and central finite-difference checks. |
| invalid/negative-variance | soft-dot w=(2,-1), other inputs as soft/uncertain | Invalid moments. |
| invalid/nonpositive-gamma | gamma/rate with mean_beta=0 | Positive VMP expectation required. |
| invalid/proper-gaussian | Gaussian(2,-1) | Signed kernel is not a proper Gaussian. |
| invalid/objective-variance | objective/general with v=0 | Positive variational variance required. |
| shape/nonpositive | alpha=0,rate=1 | Invalid Gamma shape. |
| gamma/neutral | (0,0) times (1,2) | Neutral means coefficients0/0, not shape0. |

Tests additionally exercise invalid types/nonfinite Decimal, malformed ordinary
records, negative rates as sites versus proper beliefs, zero and improper
Gaussian kernels, both orientation labels, products/quotients, and public
error capture. Finite differences independently evaluate objective values at
plus/minus h with h=10^-20 at the stationary and general points. Compare central
differences to analytic derivatives with absolute tolerance10^-37 at
Decimal precision80; these numerical checks are distinct from the symbolic
derivations. No optimizer, training, benchmark, random source, Q8 experiment
or native process is in scope.

The agreed GammaRateVmp DTO additionally retains ValueEncoding beside ToValue
and ToRate. ValueEncoding has RequestedShape, RepresentedShape and Kernel;
ToValue equals its Kernel. The two shapes coincide in this exact reference.
This records the coordinator's accepted cross-language encoding boundary
without implementing binary64 conversion in the oracle.

## Validation record

The first source check passed 76 tests in 4.43 seconds and Ruff, while strict
mypy identified one union-narrowing issue in the private row encoder and the
formatter identified both new files. The actual initial source, complete
diagnostic streams and command records remain in attempt1. Using an explicit
Failure isinstance branch fixes the typing issue; formatting changes no
formula. A further cycle-refusal test guards the public encoder's depth32
limit. Attempt2 passed 77 tests in 4.28 seconds, strict mypy on both files,
Ruff and format check. These are actual independent Python checks, not
F# comparison, compiled runtime admission or training.

The local raw directories are .git/precision-gate-reference-attempt-1 and
.git/precision-gate-reference-attempt-2 in this writer, retained in the lossless
evidence index below. The initial command recorder explicitly recorded every child
exit despite its own zero exit; the second recorder uses check=True, retains
each CalledProcessError if present and exits nonzero on any failed check.
No failed child result is described as success.

Fraction arithmetic has no binary64 magnitude bound. The implementation does
not claim hostile-object or peak-memory isolation for arbitrary huge integers;
the host integer-to-string limit yields a typed EncodingFailure. Decimal uses
precision80, ROUND_HALF_EVEN, Emin=-999999 and Emax=999999 with traps for invalid
operation, division by zero, overflow and underflow. Conversion to Decimal
rounds under that owned context, independently of caller settings. This is
not an interval enclosure. The reference simplifies a reverse-kernel
exponential term with exact zero rate to zero, while native conservative
operation ordering may refuse intermediate range loss; that difference is
outside ordinary cross-language numerical equality.

The independent residual is implemented as E[z^2]-2E[z]E[w]E[x]+E[w^2]E[x^2],
not the native ADR's nonnegative expansion. Exact Fraction arithmetic avoids
cancellation error. An eight-point independent finite-support expectation
checks that derivation, in addition to literal86 and fractional1013/420.
Decimal100 tests separately form expected energy with a direct weighted
exponential; central finite differences independently check both derivatives.
Neither comparison promotes a local objective into an optimizer.

The [lossless evidence index](precision-gate-kernels-reference-validation/2026-09-08/README.md)
now retains both attempts and a final fixed-vector invocation from source
9e6be94a0ec2b153ba63e100463f91418ceed4fe. The exact
[vector bytes](precision-gate-kernels-reference-validation/2026-09-08/reference-vectors.json)
contain the declared 24 rows: 17 successful values and seven typed refusals.
They are 21985 bytes with SHA256
ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489.
The complete actual Success return, source copy and observed Python3.14.6
interpreter/import identities are retained separately. These observations
remain distinct from native comparison and full runtime/source admission.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
