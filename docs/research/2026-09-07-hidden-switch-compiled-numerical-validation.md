# Guarded hidden-switch compilation: independent numerical validation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: Python implementation and hand admission; native/runtime admission pending

## Scope and source identities

This record concerns the independent numerical lane of the
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md), following
its [ownership plan](2026-09-07-hidden-switch-compiled-implementation-plan.md).
The coordinator verified prior-study PR #16928 on main as `1193d505d` and
remotely published fresh co-claim `d6ec464f4` before this implementation.
This writer uses session `codex/20260907-c7b2a403` and isolated branch
`codex/hidden-switch-compiled-reference-20260907`.

Three separate signed source commits preserve the implementation sequence:

- `70b97f01b0e7db4e15cc2079d73c43bb85d7e7d9`: finite binary64 arithmetic.
- `4a17b600c8e3ef2e5debfc08e681806aadd8d8bc`: exact numeric certificate.
- `aa62eea53f3d896aa2805d2d554f82ec02f6eaf3`: independent scalar/episode reference.

All three were remotely published after normal sixteen-check hooks.
The [source/log manifest](hidden-switch-compiled-validation/2026-09-07/numerical/manifest.json)
records exact byte counts and SHA256 for all six source/test files at the
final source commit, plus the unchanged old-Python control source. The
working bytes used in validation were checked against that commit.
The [final publication log](hidden-switch-compiled-validation/2026-09-07/numerical/source-publication.log.gz)
retains all sixteen successful quick checks and the isolated branch push.
Both retained logs are losslessly compressed; the manifest binds stored
and decompressed bytes separately. Nothing is stripped or normalized.

The implementation imports no new native selector, saved native output,
or native runtime collector. The old source expression order and frozen
protocol are shared contracts. The separate exact alpha oracle enumerates
hidden-state contingent trees; the software floating-point evaluator
executes belief recursion. Neither numerical path calls the other as its
oracle. Only the new native receipt type file was inspected after this
independent reference implementation was written, to confirm DTO compatibility.

## Public and capability boundaries

Public numerical functions return `Success.value` or
`Failure.Code` / `Failure.Message`. The coordinator maps numerical refusal
to its independent evidence failure with stage/location fields. Invalid
arguments do not silently clamp or fall through to an action. Private
trusted helpers use an internal refusal caught by these public wrappers.

The IEEE implementation rounds integer ratios with nearest/even and gradual
underflow. Its admitted subset is finite operands and finite results;
NaN/infinity inputs, overflow and division by zero refuse. It preserves
signed-zero bit patterns and arithmetic. An exact `Fraction(0)` view is
explicitly insufficient to represent floating-point zero state. The
bounded host-arithmetic comparisons in its tests are secondary conformance
checks, not its implementation oracle or a universal equivalence proof.

The certificate rebuilds every ordered 2/8/128 contingent-tree candidate
for each effect/depth pair, including duplicate vectors. Every root-action
envelope is checked against every candidate at both interval endpoints;
coverage and affine dominance extend that finite check to whole intervals.
The monotone gaps link the envelopes to the rational cuts. The arithmetic
bounds preserve the registered eta, recurrence, rho and inward neighbor
inequalities. No fitted guard or altered threshold is introduced.

Its complete numeric tree and types are checked, including canonical
rational strings, source/protocol bindings and all candidate/interval
positions. Opaque certificate issuance is an accidental-misuse boundary,
not a Python security sandbox. The coordinator still supplies and admits
the finite complete source/checker binding roster; a nonempty map alone
proves no source coverage. Actual loaded-artifact and expression-graph
admission remain separate obligations.

Policy state holds extracted numeric guards, admitted belief/cue state,
and its own action chronology. It holds no certificate binding paths,
source tape, hidden state, scorer, output path or runtime handle. Observe
copies and validates projected cells; choose commits an action before the
next observation. Both timed-service models omit Q output. The exact
28-byte choice representation is one action byte, one path byte, two zero
reserved bytes, then six uint32 little-endian counts in registered order.
The explicit unsupported-runtime conformance mode executes recursion with
zero guard comparisons, including trivial cases; it admits no measured row.

## Executed Python validation and exact control provenance

The [focused log](hidden-switch-compiled-validation/2026-09-07/numerical/focused-python.log.gz)
records **87 passing Python tests**: 28 IEEE, 24 certificate and 35 reference
cases. Ruff and format checks passed for all six owned files, mypy passed
for all three implementation modules, and `git diff --check` passed.
These are focused Python and publication gates; this writer did not run a
new full .NET build/test or the complete Interp Python suite for this slice.

The reference tests execute all **222 indexed scalar positions**, preserving
both signed zeros and the complete ordered cross-product. They compare
software recursive action selection with the guarded choice, check Q error
for the source arithmetic model against the separate exact Fraction oracle,
and retain path
and executed-work assertions. These are Python executions of the native
source's arithmetic model, not observations of the new native executable.

The **48 new Python hand episodes** are compared with **24 fresh calls to
the unchanged old Python reference**:
`hidden_switch_reference.run_episode("belief-depth3", ...)`, using its
four explicit hand tapes, both effect flags and the three registered hand
rendering modes. The old-Python source SHA256 is
`7130fbf88e4a5f7393ad59cffd6c56637b3d226f630b8cf547167d319bf880e2`.
These controls are neither retained native hand receipts nor fresh native
calls. Actions, states, cues, rewards, frame/projection hashes, filter
chronology and belief bits match those Python controls. Native certificate,
Q/hand output and runtime comparison remain outstanding.

Additional executed witnesses cover:

- Exact epsilon equality versus successor, and a child whose numerical
  maximum differs from its tolerance-selected action. Replacing numerical
  child maximum with tolerance propagation changes the root Q bits.
- A strict-interior guard witness that calls the real recursion, endpoint
  fast paths, and detection of a deliberately wrong fallback replacement
  through action/work disagreement.
- Counter agreement with instrumented prediction/conditioning calls;
  fixed 28-byte encoding; signed-zero and subnormal arithmetic; invalid
  bits, counts, certificate inputs, frames, depths and chronology.
- Future-suffix intervention with unchanged prior actions and a changed
  next hidden state; valid private-band and scorer interventions with
  unchanged policy behavior; copied-cell isolation and bounded policy slots.
- Fifteen named numeric-certificate mutations, including missing or reordered
  candidates, altered margins/guards/epsilon/rho/source bindings, extra keys,
  noncanonical rational encodings and boolean substitution for an index.

A separate bounded source fixture uses seed **1**, domain **11**, count
**2** to compare the independently implemented integer mixer/draw order
with the old Python source. It is a development conformance fixture, not
one of the new registered source streams. No seed 9307 or 9409 source call,
registered behavior run or timing measurement occurred in this lane.

The initial reference-focused run reported one failed assertion and 33
passes: a test wrongly expected fewer than 37 distinct **bit strings**.
The roster correctly has 37 bit strings, including distinct positive and
negative zeros. The test was corrected to compare exact **real values**
for the duplicate-zero assertion while preserving all 37 bit positions
and 222 indexed cases. No implementation, roster, threshold or observed
behavior was changed to resolve that test-author error. The final 87-case
run then passed. Hand fixture outcomes were visible during implementation
and are not described as unseen registered behavioral evidence.

## Bounded independent review retained

The coordinator separately read immutable IEEE source `70b97f01b` and its
tests. The source review found no mathematical defect in integer exponent
adjustment, nearest/even quotient rounding, subnormal-to-normal carry,
finite overflow refusal, signed-zero arithmetic or neighbors. It accepted
the explicit finite-subset and secondary-host-conformance qualifications,
and required the scalar evaluator to keep numerical child maximum distinct
from tolerance-based root selection. That distinction has an executed
regression witness in the final reference tests.

The independently co-claimed reviewer, Vera using OpenAI Codex / GPT-6
Astra in session `codex/20260907-c7b2a404`, read IEEE `70b97f01b` and
certificate `4a17b600c` without running tests, deriving new guard outputs or
executing a native/registered stream. The reviewer found no material
arithmetic or admission issue in the finite RN-even implementation, ordered
candidate reconstruction, whole-interval endpoint dominance, fixed bounds,
strict switch/inclusive harvest neighbors or full typed binding comparison.
The review expressly retained the accidental-misuse scope of opaque
issuance and the outstanding complete source/runtime graph obligations.

The independent reviewer subsequently read final reference source
`aa62eea53f3d896aa2805d2d554f82ec02f6eaf3` and sent a bounded acceptance
to the coordinator. No material issue was found for registered inputs in
operation/recursion order, numerical maximum, strict epsilon selection,
fallback/counter execution sites, scalar roster chronology, source mixer
thresholds, projection or the copied scalar-policy boundary. The tests
were assessed as discriminating fallback and maximum-selection faults.
The reviewer ran no tests, guard generation, episodes or source RNG.

These are bounded source-review acceptances of the Python implementation.
Actual native/runtime conformance and final integrated evidence admission
remain pending. The old-Python hand agreement is not relabeled as native
agreement. The preserved source identities allow later integration review
to identify changes precisely.

## Outstanding admission and experimental limits

No implementation archive, actual machine-arithmetic certificate admission,
native-versus-software comparison, registered behavior receipt, cost receipt,
independent full replay or speed verdict is established by this document.
Those remain coordinator/native/reviewer work under the unchanged protocol.
A later implementation repair must preserve these earlier source identities
and distinguish its new conformance evidence. Unknown runtime premises or
failed comparisons refuse admission; they do not authorize replacement
streams, moved tags, adjusted thresholds or universal-equivalence claims.
