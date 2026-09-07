# Guarded controller: pure falsifier and schedule source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Disposition: bounded source acceptance; native and outer admission remain separate

This records read-only review of the falsifier checker at
`4722b7ae2e25fb74d2302be93024cb15cf6ab160`, following initial source
`9e7fa4404366c5bfafe72964e966752889d33fba` and accepted design
`8e68332fd9c62a23283097eae234351698364a01`. The reviewer read the complete
checker, its strict comparison dependencies, fixture construction and mutation
tests. No reviewer test, policy, native target, source generation or measurement
ran. Test outcomes below are author-reported validation, not reviewer execution.

## Falsifier checker

The checker replays all 222 scalar positions, 48 new hand episodes and 24 old
controls before admitting the fixed falsifier roster. Strict recursive equality
checks exact nested types, fields, values, order and length. It does not trust
producer success flags or accept a truncated successful sub-replay. Failure
counts include only completed comparisons, including the partially checked
refusal group.

The 10 invocation cases distinguish delegate entries, evaluator-root entries
and returned traversal counters. Both wrong-action stub results are compared
against the ordinary contract and produce separate typed mutant refusals.
The 10 interventions reconstruct the declared chronology, suffix change,
receipt-only score change, private-band replacement and caller-copy control.
The 53 invalid operations reach independent service, parser, policy and
prediction boundaries: 38 invalid-belief/depth service calls and 15 remaining
wire/frame/order/prediction calls. Setup calls and final refused operations
remain separate. Native stage/code mapping is fixed; nonempty detail prose may
differ. No general native event-authenticity claim follows from Python replay.

The author found that initial `9e7fa4404` lacked an explicit requirement for
all 17 private-band full-frame hashes to change. A simultaneous reference-return
and payload mutation could therefore pass that version. The final correction
adds this relation and a regression that substitutes matching baseline hashes
on both sides; the reviewer inspected its discriminating refusal path. The
original failed witness and subsequent 63-test pass are retained by the author.
This is a checker-quality correction, not an observed native defect.

The fixtures use Python/synthetic records, old-Python snapshots and public
numerical APIs, without calling the checker's expectation constructors. Source
spies exercise invalid service calls and prohibit the old runner, source
generators and file reads during replay. These fixtures still are not actual
native conformance inputs. The six-field external descriptor is checked for
shape and internal identity consistency only; gzip contents, actual external
bytes, runtime identity and full source admission remain the coordinator's
separate obligations. No material source finding remains at the final pin.

## Declared schedule headers

The separate root source `33f66f382767f36dfde9933b87f76aa1144cbdaa` was also
reviewed against the frozen protocol. Its pure schedule module admits exactly
50 ordered rows: 20 ordinary, 10 boundary and 20 whole-episode rows. Only the
strategy order rotates by replicate. The exact nine-field schema rejects
boolean integers, changed values, reordered rows and partial rosters.

Ordinary rows declare 128 warmup and 65,536 measured calls; boundary rows
declare 160 and 40,960 calls. Whole rows declare 8 warmup and 64 measured
episodes, corresponding to 128 and 1,024 action calls. The latter are distinct
from 136/1,088 observation counts and the separate 2,304-call old setup prelude.
The header totals are 6,720 warmup and 1,740,800 measured action calls, with
160 warmup and 1,280 measured whole episodes. These are declared schedule
counts, not evidence that the work ran. Actual buffers, chronology, runtime,
timing and cost admission remain separate. No material source finding remains;
the author's 80-test validation was not rerun by the reviewer.

This review belongs to the current compiled-controller work item. It does not
reopen the completed prior study, amend registration, admit a final graph or
authorize registered source generation or measurements.
