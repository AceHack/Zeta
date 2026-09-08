# Scalar projection rendered-zero admission clarification

Date: 2026-09-08 UTC
Operational status: research-grade preregistration clarification
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

Before wire tests and implementation freeze, the two implementers identified
an ambiguity outside the fixed roster: whether a nonzero requested decimal
that rounds to binary64 zero should be rejected at the conversion boundary.
The coordinator retains the [registered](2026-09-08-precision-gate-projection-registration.md)
exact-rendered-target interpretation. Decimal conversion rounds once to
nearest-even binary64. A finite signed-zero result is an admitted rendering,
with the original requested spelling, sign-bearing bits, exact dyadic value
and exact conversion delta retained. There is no blanket input underflow
refusal added to the registered conversion rule.

U and K may therefore render to signed zero. If T or C render to zero,
the rendered target fails the positive-parameter domain check: report Domain
before root work and preserve that actual target snapshot. Do not manufacture
a nonzero replacement. Nonfinite rendering remains refused and cannot
provide a finite dyadic snapshot. An exact requested signed zero retains its
sign in the bits even though its rational value is zero.

This interpretation is specific to requested-to-rendered input conversion.
It does not weaken conservative nonzero multiply/divide-to-zero or positive
exp-to-zero refusal within the named numerical operations. Rendering error
and subsequent arithmetic failure remain separately observable.

The native owner's untested draft initially used a blanket conversion
NumericalUnderflow rule. This clarification is recorded before dependent
wire tests or source freeze; no final subject result was used to choose it.
No fixed literal, case, call count, tolerance or solver operation changes.
The original contract's ProtocolSha256 remains fixed. This clarification is
included as an additional path/hash in the independently expected source map,
and its signed commit is remotely preserved before dependent tests proceed.
