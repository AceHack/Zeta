# Independent scalar projection intervals and reference

Date: 2026-09-08 UTC
Operational status: research-grade implementation and validation record
Status: source development; no final registered comparison performed
Author: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Work item: 081M1Z63YMC087G0R003N5FH9X

## Registered boundary and ownership

The [registration](2026-09-08-precision-gate-projection-registration.md) at
8e38c993a5da03f2ff4206ee5877f76d250a04f7 freezes the
[contract](2026-09-08-precision-gate-projection-proposed-contract.md) at
1bf71bbac7f6896216c7079abd4e99b7c79e2870, 38,142 bytes,
SHA256 537054779bf9e0bfa9271b5cc56116fbc80b16c4a2be9f1b5e3c022fe95a0f8e.
The coordinator verified its remote preservation before authorizing source.
The local registration import is 94256ecf2; this writer lacked the two
coordinator claim/program files, so the modify/delete import conflicts were
resolved by retaining their exact registration-commit bytes. No native source
or output was imported as a reference oracle.

This writer owns only the new interval/reference modules, their two dedicated
tests, this report and its uniquely named evidence directory. Native source,
project wiring, case serializer and final comparison remain with their
separate owners. Final 40-case/88-call execution is prohibited until source
review and immutable implementation/archive admission. Compiled-study source
domains, native results, training and benchmarks remain outside this work.

The original design and contract corrections are preserved: complete
coordinate/objective observations precede leaf comparisons; post-root work
uses the last successful root context without retries and its own six-entry
transcendental cap; internal width admission uses exact rational subtraction.
Input conversion targets exact native dyadics, preserving requested decimal
drift and signed-zero bits separately.

## Public source contract

`precision_gate_projection_intervals` exports frozen `Interval(Lower,Upper)`
with finite Decimal endpoints, `ContextSpec`, `Failure` with the registered
five fields, `Success[T](Value)` and `Result[T]`. `make_arithmetic(precision,
transcendental_limit=4096)` constructs a sequential `Arithmetic` object.
Its public point/add/subtract/multiply/divide/square/exp/ln/midpoint methods
revalidate ordinary values and return typed results. `intersect` and
`exact_width` are pure typed helpers. The arithmetic object exposes its
context and actual transcendental-entry counter; this is ordinary sequential
bookkeeping, not a hostile-Python capability. Exact zero signs remain in
binary inputs; a real interval is not a complete binary64 state.

`precision_gate_projection_reference` will export `reference_root(raw_input,
expected_bindings, *, expected_input_sha256, expected_case_id)` and
`certify_native(raw_input, raw_native, expected_bindings, *,
expected_input_sha256, expected_case_id)`. Each returns `Success` containing
the exact registered JSON receipt tree or typed API `Failure` when caller
metadata or receipt encoding cannot be admitted. Successful receipt
construction does not imply numerical success: its Outcome can be refused
or no-candidate. With admitted caller metadata, wire and numerical failures
retain their complete bounded receipt and first-failure prefix. No receipt
proves that a native process ran or that source/runtime custody passed.

## Fixed development-test inventory before first execution

These are deterministic source tests, distinct from the final registered
roster. No expected value is copied from a native run.

- Signed rational endpoint containment for addition, subtraction,
  multiplication and division, including denominator-zero refusal.
- True square bounds crossing zero; exact intersections and empty refusal;
  exact width; nearest-even midpoint with genuine no-interior refusal.
- Independent rational series bounds for exp(1/2) and ln(2), together with
  80/320-precision consistency and rejection of an unwidened point enclosure.
- exp(0)/ln(1) singleton identities, explicit contexts independent of ambient
  rounding, invalid reconstructed records, finite/range/underflow refusal,
  and actual exp/ln entry accounting before a failure or limit.
- Root analytic-center identities, unconstructed target enclosure,
  strict width/budget/refinement/context counters, sign uncertainty,
  stagnation, empty intersection and first-error prefix discrimination.
- Strict wire/binding/zero-sign identity and public caller refusal, using
  the coordinator's separately preserved grammar clarification before wire
  test execution.
- Synthetic Python-produced candidate receipts for structural and numerical
  certificate tests. They are explicitly not native conformance. Mutations
  distinguish positivity, unchanged target/bindings, each numeric field,
  complete coordinate/objective retention after an early mismatch, actual
  typed refusal/raised partials, and bounded encoding after a real return.

First diagnostics and failed expectations will remain separate from repaired
passes. No test count or result is asserted before execution. Interval
mathematics depends on the documented correctly rounded Decimal operations;
it is not an emulator or proof of native binary64 operation order, System.Math
accuracy, compiler output or physical invocation.

## Interval checkpoint

The first interval source/test attempt passed 41 cases in 4.21 seconds and
strict typing of both files. Ruff retained one BLE001 finding at the broad
public-boundary catch; the formatter requested changes to both files. The
catch is now narrowly documented as an intentional typed unexpected-fault
boundary, with an additional injected OSError regression. The formatting
changes preserve arithmetic behavior. The corrected run passed 42 cases in
4.13 seconds, strict typing, Ruff and format verification. No numeric test
failure preceded this checkpoint; the first style diagnostics remain intact.

The [interval custody index](precision-gate-projection-reference-validation/2026-09-08/intervals/README.md)
retains both complete attempts, including preformat source/test copies,
initial plan bytes, all outputs and command metadata. These are source-owned
unit tests, including independent rational-series inequalities for exp(1/2)
and ln(2). They do not execute the registered 40-case roster or constitute
native agreement. Independent source review remains pending at this checkpoint.

The additional [decimal grammar clarification](2026-09-08-precision-gate-projection-decimal-admission-clarification.md)
at b9fe348661aef30fbd1a02cab1ad2979287bddae was remotely preserved by the
coordinator and imported unchanged as b13f86f52 before wire implementation.
The interval checkpoint does not implement that wire boundary yet.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
