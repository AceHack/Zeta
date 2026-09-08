# Scalar projection decimal admission clarification

Date: 2026-09-08 UTC
Operational status: research-grade preregistration clarification
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

Before implementing the wire boundary, the native owner identified ambiguity
in the [registered contract](2026-09-08-precision-gate-projection-proposed-contract.md)
for decimal spellings outside its fixed roster. The coordinator fixes the
following conventional grammar, with ASCII-only full-string matching:

~~~text
-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?
~~~

A leading plus is refused. An exponent may have either sign; uppercase E
is refused. A mantissa has no leading zeros except its single zero before
an optional fraction. Fractional forms require a digit on both sides of the
decimal point. No whitespace or suffix is admitted, including a final newline.
Examples of admitted syntax are -0, 0.5, 1e+2 and -3.25e-2. Examples of
refused syntax are +1, 00.5, .5, 1., 1E2 and 1 followed by whitespace.
Numeric-domain admission remains separate from syntactic admission.

The original limits still apply before integer conversion: at most 128 ASCII
characters per literal and absolute exponent at most 400. This does not
change any of the 40 fixed cases, 88 calls, numerical operations, tolerances
or comparison criteria. No final comparison has run. Native numeric-core
implementation may proceed independently while this wire clarification is
preserved; wire implementation and tests wait for its remote registration.

The original 1bf71 contract and its ProtocolSha256 remain unchanged. This
clarification is additionally included by repository-relative path and exact
SHA256 in the independently expected finite source map. Its signed commit
is preserved on the existing wip/precision-projection-registration-20260908
ref before dependent work. The [registration](2026-09-08-precision-gate-projection-registration.md)
retains the original accepted cut and links this later interpretation.
