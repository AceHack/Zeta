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

## Root checkpoint plan before first execution

The source now implements `reference_root`; `certify_native` remains pending.
Public `ReceiptFailure(Failure,Receipt)` is a separate outer result for encoding
failure after actual work. It retains the complete in-memory receipt, without
claiming that value was encoded or durably published. The coordinator accepted
this distinction before these tests. Caller metadata refusal remains the
ordinary five-field Failure; Success.Value remains the registered receipt.

The rendered-zero clarification at 1d8fd0bb6 was imported as 914349fb2 before
conversion test execution. A registration-index conflict was resolved with the
exact coordinator commit's registration bytes; the source correction itself
was unchanged. Nonzero nominal U/K may render to signed zero. T/C rendering
to zero retains the target and refuses Domain after numerical entry, before
parameter work. No new blanket conversion-underflow rule is introduced.

The first root tests use three independently derived arithmetic centers,
one ordinary noncenter and its one-attempt profile, strict decimal/JSON cases,
rendered-zero drift/signs, independent binding failures, and injected numeric
and encoding faults. They do not invoke a native process or the final fixed
40-case/88-call runner. Complete first diagnostics will be retained.

## Root source checkpoint

The first run passed 41 cases and failed one encoding-fault fixture: its patch
intercepted JSON fixture construction before the public call. The repair
prepares the actual input before installing the encoder fault. The first
strict check reported eleven typing diagnostics; explicit nonreturning failure
annotations and typed union narrowing resolve them. Ruff passed initially;
formatting was then applied. All first source bytes and diagnostics remain.

Three added regressions exercise one recoverable midpoint stagnation, exhausted
precision and an empty proof intersection. They retain actual old bounds,
context/counter continuity and first-terminal failure. The corrected checkpoint
passes 45 tests in 5.12 seconds, strict typing, Ruff and format verification.
The [root checkpoint custody](precision-gate-projection-reference-validation/2026-09-08/root/README.md)
is separate from the earlier interval archive. This checkpoint implements the
root service only; candidate-certificate source and review remain pending.

## Certificate source plan before first execution

The new certificate API checks supplied native JSON shape, exact independently
expected input/binding identities and every finite numeric field. It then calls
the independent root service afresh. No native runner or native result is used.
The synthetic center fixture computes its objective independently as
47/32 + ln(2)/2 using a 100-digit Decimal test calculation and the integer
binary64 renderer; its diagnostic trace is explicitly a Python-built fixture.

Before execution, the added inventory covers all seven leaf mismatches,
strictly positive q/R/v admission including signed zero and negative subnormal,
source/target/key/counter mutations, non-strict endpoint containment, two fresh
root calls, no-candidate refusal preservation, failed root preservation,
maximum endpoint distance, R computed from independently enclosed exp(X),
late objective partials and complete observations surviving final encoding
failure. These test the pure certificate boundary, not native conformance.

An additional named source control, before its first execution, evaluates the
original objective at t=2,u=-1,k=3,c=1,m=1,v=2. Independent rational-series
bounds for exp(2) and ln(2) check F=3+exp(2)-ln(2)/2, derivative mean
1+exp(2), and derivative variance 3/4+exp(2)/2. This discriminates falsely
returning stationary gradients. A supplied x=-1/2 inside the synthetic
bracket separately discriminates using a native coordinate in place of the
independent root or exp check. Neither is a final registered evaluation row.

## Combined certificate checkpoint and retained corrections

The first certificate run passed 81 source tests. Four test typing diagnostics,
one unused lint suppression and requested formatting remain in attempt 1;
the corrected style/type pass is separate. Subsequent independent and author
review identified four root boundary defects, all present in the immutable
root checkpoint a04bba14c:

1. Author finding: a midpoint retry could lose its pending status when the
   next precision's initial endpoint sign was unresolved. The new fixture
   first returned zero midpoint evaluations instead of the owed one. The
   retry flag now survives that intervening preparation failure.
2. Independent reviewer finding: a typed context-factory refusal during a
   retry inherited the unregistered failure stage precision-retry. Parameter
   preparation now starts and is counted before context construction; its
   row Precision stays null until the requested context is actually admitted.
   A refused factory does not invent a context or discard earlier bounds.
3. Independent reviewer finding: input hashing preceded the 64-KiB ceiling.
   Exact bytes and length now precede hashing. The finite 65,537-byte trap
   first reached the forbidden hash; the repaired public API refuses before it.
4. Independent reviewer finding: a one-attempt budget refusal inherited the
   prior reconstruction stage. The guard now names midpoint without adding
   an entry, evaluation or fictitious trace row. Its original failed stage
   assertion remains retained.

The intermediate corrected passes are 82, 85 and 86 cases. The final combined
checkpoint passes 88 source unit tests in 5.36 seconds, strict mypy of the
module/test pair, Ruff and format verification. This number is unrelated to
execution of the frozen 88 top-level experimental calls: no final runner,
native result, registered vector batch or native process was invoked here.

The [combined custody index](precision-gate-projection-reference-validation/2026-09-08/certificate/README.md)
retains all five source/check attempts and the three separate fail-before
regression captures. Source/test copies, full diagnostic output and command
identity are losslessly preserved. The original a04 source is not rewritten.
Independent review of the combined root/certificate source remains pending.

The interval primitive's separate exact 9f0d5ca7 acceptance was committed by
the independent reviewer at 565c98ba0a6bd58605d22b95812b75ff588651a1. That review
covers neither these root repairs nor the certificate boundary. The numeric
reference continues to rely on reviewed helper source and explicit Decimal
semantics; its supplied native metadata is not process or trajectory evidence.
Output/entry quotas are finite refusal limits, not peak-memory guarantees.

## Returned root API failure correction

Independent review of 51a96fa11 found that a normal `reference_root` API
Failure was replaced with NoRootEnclosure before its original fields were
retained. Two new fixtures first failed: direct certificate publication and
an encoding failure after that actual return both lost the original error.
Their focused logs retain the complete actual public return in both versions.

The coordinator approved a schema-compatible repair: keep Reference=null
because no root receipt exists, retain ReferenceRootCalls=1, and put the exact
original five-field Failure unchanged in certificate Outcome.Failure. A root
receipt with a numerical refusal still remains in Reference and yields
NoRootEnclosure. Encoding failure continues to preserve the full certificate
in the separate ReceiptFailure wrapper. No registered field or union expanded.

The focused corrected pair passes, followed by 90 source tests in 5.09 seconds,
strict typing and style. The [returned-failure custody](precision-gate-projection-reference-validation/2026-09-08/root-return/README.md)
keeps both failures, both actual returns, and the corrected full check. This
repeat was required by the reviewer repair; no broad all-fixture outcome
capture or final experimental evaluation was added.

A further independent finding is pending: native trace admission must validate
complete structural prefixes/cardinality and their counter associations, not
only the types of rows present. Its exact failure-prefix grammar is being
coordinated with the native owner. No whole source acceptance is claimed yet.
