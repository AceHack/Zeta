# Guarded hidden-switch compilation: proposed executable falsifier contract

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: implementation design draft; native DTO and review closure pending

## Scope and unchanged registration

This proposes the finite evidence contract needed to close section D of the
[frozen compiled protocol](2026-09-07-hidden-switch-compiled-protocol.md).
It changes no registered model, source seed, source domain, action arm,
ordinary/cost row, threshold or tag. No additional registered stream,
behavior run or timing measurement is authorized by this note.

The coordinator approved this bounded design pass before implementation.
The intended writer boundary is a new pure
`hidden_switch_compiled_falsifiers.py` and matching tests after the native
DTO and independent review agree. The coordinator owns exact choice-buffer
replay, outer envelopes, source/runtime admission, storage, JSON decoding
and their negative evidence. The native author owns executable conformance
hooks, observed call/event collection and native wiring. This writer owns
independent reconstruction and relation checks on decoded witnesses.

The existing [222-scalar/48-new-hand checker](2026-09-07-hidden-switch-compiled-pure-replay-validation.md)
and [24-old-control checker](2026-09-07-hidden-switch-compiled-old-replay-validation.md)
remain full checks. Their currently recorded test inputs are Python-produced;
they do not become native-produced evidence by appearing in this design.
Actual native output and its complete envelopes must still be admitted.

## Proposed exact top-level payload

The existing native hand payload remains exactly `Scalars`, `Episodes`,
`OldControls` and `Falsifiers`. Proposed `Falsifiers` fields are:

- `Schema`: `zeta.hidden-switch.compiled.falsifiers.v1`.
- `ScalarCoverage`: the ordered indices 0 through 221, referring to the
  actual complete scalar slice in this same hand payload.
- `HandCoverage`: 24 ordered rows `{OldIndex, NewIndices}`, with row i
  referencing old i and new `[2*i, 2*i+1]` in the same payload.
- `InvocationCases`: the ten ordered cases specified below.
- `InterventionCases`: the ten ordered cases specified below.
- `RefusalCases`: the fifteen ordered logical-input cases specified below.
- `OuterNegativeEvidence`: coordinator-owned exact references to its complete
  source/certificate/runtime/storage/JSON refusal records. Its concrete schema
  and finite roster remain a named coordination prerequisite below.

No `Passed` map substitutes for inputs, outputs or observed invocation data.
Coverage references are not certificates on their own. The coordinator
accepted direct revalidation for the initial API: it takes the three decoded
slices and re-executes their existing complete checkers, without caller-made
summary counts. Offline duplicate work is acceptable here. It is outside
the registered native setup and measurement schedules.

The checker derives a fixed coverage result from accepted witnesses. It
does not trust a caller's assertion that a category has been covered.
Unknown fields, missing/duplicate/reordered cases, noncanonical numeric
encodings or changed references refuse with a concrete case/field location.
The return scope remains falsifier/slice replay, never whole-runtime success.

## Ten invocation cases

The ordered cases are six `unsupported-runtime` rows, two `real-fallback`
rows and two `stubbed-fallback` rows. All use the admitted numerical
certificate and current software binary64 source identity.

The six unsupported rows use belief `0.5`, effect true then false, and depth
one, two, three innermost. The mode explicitly disables every fast path.
Each row must return path four, zero guard comparisons and an observed
real recursive invocation, including depth-one and null cases. Compare
the complete output with the independently reconstructed recursive result.
This conformance mode admits no measured unsupported runtime.

The real-fallback rows use effect true, depths two then three, and the
binary64 successor of that depth's admitted `Smax`. Before executing the
witness, require this input to lie strictly below `Hmin`; absence of an
interior value refuses the fixture. This construction comes from the
verified guards, without fitting a new boundary. Require actual recursion,
correct path/work and exact action against the independent arithmetic.

The two stubbed rows reuse those exact inputs. First reconstruct and verify
the real baseline. A deliberately incorrect conformance delegate returns
the opposite of the verified baseline action, without performing real tree
work. Retain the actual stub invocation, its exact returned values, the
selector's resulting record and the concrete refusal obtained when that
record is compared with the ordinary independent contract. A claimed
refusal flag alone is insufficient. The checker must itself reject the
retained mutant. The native author must distinguish delegate invocation
from actual tree execution; a stub call cannot earn a recursive-work count.

Proposed row fields are `CaseId`, `Input`, `Mode`, `Choice`, `Invocations`
and `Mutation`. `Input` uses the agreed scalar bit/effect/depth fields.
`Choice` is the existing eight-field choice-work DTO. `Invocations` is an
ordered log of observed callback entries/results, with each entry retaining
its input, implementation kind (`real-recursive` or `deliberate-stub`),
returned action/work and actual tree-entry count. Normal rows use
`Mutation=null`; stub rows carry the independent baseline reference and
exact mutant comparison failure. Exact native member names and failure
codes must be agreed before implementing this union.

The normal measured service must remain bound to the real recursive
implementation. Injection and call observation belong to explicit
conformance entry points. Shared branch logic and actual call sites need
source review; a delegate log is evidence under admitted code/runtime,
not a cryptographic proof that arbitrary uninspected code executed.

## Ten intervention cases

The outer order is the five kinds below; native-recursive then
compiled-guarded is innermost. Each uses the explicit `sparse` hand tape,
effect true, dot geometry and fixed palette. Complete episode witnesses
retain every no-Q field and must be independently reconstructed, not only
compared with each other.

1. `action-before-feedback`: record the actual event sequence at the
   observation/committed-choice/private-feedback boundaries. The successful
   sequence has 17 observations and 16 choices/feedback steps, with each
   choice committed before its feedback: observe 0, then choose i, feedback i,
   observe i+1 for i from 0 through 15. The source review must tie events
   to actual boundary sites; a fabricated expected sequence proves nothing.
2. `future-suffix`: flip only drift bit 8 after copying the explicit tape.
   Independently reconstruct both complete episodes. The first nine actions
   and observations through index 8 remain equal; state and cue at index 9
   must differ, establishing a real suffix intervention. Later action
   differences are not required.
3. `scorer-receipt-noninterference`: override only recorded evaluator
   `Reward4` entries to zero and recompute `TotalReward4`. Carrier state,
   actual private reward pixels, observations and policy behavior remain
   those of the baseline. Retain 16 actual scorer-hook input/output events,
   and require at least one recorded reward change.
4. `private-band-noninterference`: replace all 512 lower-band cells with
   the alternating binary pattern `cell[i] = i mod 2` after rendering each
   of the 17 frames and before projection. Retain full before/after frame
   data or independently reproducible exact bit records and hashes. Upper
   pixels and every projection/policy field must remain equal, while each
   full-frame hash changes. Rewards and hidden transitions are unchanged.
5. `caller-copy-isolation`: observe a caller-owned projected cue-zero
   frame, then mutate that same caller buffer into valid cue-one geometry
   before choose. The admitted policy belief/choice must remain that of
   cue zero. A fresh control observes the mutated buffer and must have the
   independently computed different belief. Retain actual before/after
   caller bytes and both observations/choices so a no-op mutation cannot pass.

Each row has `CaseId`, `Strategy`, `Input`, `Before`, `After` and `Events`.
The kind determines exact nested types; arbitrary dictionary extension is
not allowed. Complete-episode kinds use the existing no-Q DTO. The caller
copy case uses a smaller explicit observation/choice DTO, never a fake
`Complete` episode with missing fields. Frame cells, when included, should
use an explicitly defined 2048-character binary string, avoiding implicit
byte-array/base64 serializer behavior.

The native author confirmed that the unchanged old scorer hook changes
only the recorded reward after the carrier transition. The proposed new
receipt-only case preserves that semantics. The existing independent
Python `scorer_override` also changes subsequent private frame marks;
it is a different combined intervention and must not silently supply this
case. The independent checker can reconstruct the ordinary baseline and
apply exactly the receipt-only field transformation, while separately
replaying and checking the observed hook log. Band intervention remains
a separate case and can use the existing frame-replacement model.

## Fifteen logical-input refusal cases

Freeze the following ordered roster before native implementation:

1. NaN belief bits at scalar admission.
2. Positive-infinity belief bits at scalar admission.
3. Negative-infinity belief bits at scalar admission.
4. Least negative subnormal belief, outside the admitted interval.
5. Successor-of-one belief, outside the admitted interval.
6. Depth zero.
7. Depth four.
8. Noncanonical finite-bit string.
9. Nonbinary frame cell.
10. Wrong frame dimensions.
11. Choose before an observation.
12. Observe again without a committed action.
13. Choose twice after one observation.
14. Choose after the terminal observation.
15. Invalid action at the common prediction boundary.

Each row retains `CaseId`, exact logical `Operation`, complete `Input`,
observed `Outcome` and observed call/event counts. A refusal must have a
typed native stage/code agreed for that operation, no accepted action and
no fabricated successful output. The pure checker independently classifies
the same input as invalid. Source-specific native and Python error strings
need an explicit reviewed mapping; equality of their prose is not required.
These are conformance calls, not extra policy arms or ordinary source runs.

## Separate outer negatives and closure prerequisites

The coordinator retains wrong epsilon, swapped/outward guards, inclusive
switch tie, omitted subtraction error, changed model/depth/effect,
missing candidates/intervals, fabricated work, source/hash/runtime identity,
reused output path, duplicate/nonfinite JSON and truncated/reordered-data
negative evidence at its existing certificate/outer/storage/choice-buffer
boundaries. These are separate executable obligations, not waived by this
pure module. Their exact source-bound records and case roster must join
`OuterNegativeEvidence` before implementation archival or a complete hand
falsifier admission. Existing unit-test counts alone are insufficient.

Before checker implementation, the coordinator/native/reviewer must close:

- Exact invocation/event DTO member names and native typed refusal mapping.
- The conformance injection/call-recording boundary and evidence that the
  stub is actually invoked, with no false recursive-work accounting.
- Full-frame and caller-copy byte encoding, index conventions and method
  sites for action-before-feedback events.
- The finite source-bound outer-negative record/reference schema and roster.

The coordinator accepted the finite coverage and scorer/band separation,
and selected direct revalidation of all three raw slices for the initial
API. No caller-made summary count or pass flag can replace that work.

This draft preserves the native scorer-semantics coordination and a concrete
finite starting roster for review. It claims no new implementation, actual
falsifier execution, native conformance or experimental outcome.

For this documentation-only draft, focused Markdown lint, all six repository
hygiene checks and diff whitespace validation passed. No native build,
Python policy/test execution or experiment was needed or performed.
