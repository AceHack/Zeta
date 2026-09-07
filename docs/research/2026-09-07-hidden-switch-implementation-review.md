# Hidden switch implementation review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Disposition: premeasurement review; implementation archive pending

## Registration and evidence boundary

The [protocol](2026-09-07-hidden-switch-protocol.md) was frozen before
implementation in commit `6a3150037a1e6be6ae89996dc8562f2061f7c75d`.
Its remotely verified annotated tag is
`archive/experiments/081M1XK02XM087G0R00043EW05-registration`, with tag
object `2474dc79558390b57362d131f6d1c849280331c2` and the same peeled
commit. Protocol SHA-256 is
`E6E2943D5991E70DBC95D3ED1E620AA7505D3E692315E80588729C9FCD03946A`.
The [design review](2026-09-07-hidden-switch-design-review.md) records
pre-freeze decisions. This report does not amend the protocol.

Three separately tasked writers within one OpenAI Codex team implemented
native execution, an independently authored Python reference, and receipt
admission/verdict tooling. This is implementation separation within one
team, not independent institutions or an empirical replication.
Registered source streams 9101 and 9203 have not been generated at this
review checkpoint. Synthetic receipt tests inject fixtures and forbid
actual source generation; hand tests use the four named deterministic tapes.

## Independent wrapper review

A separate reviewer inspected protocol conformance, source admission, replay
and verdict without running registered streams. Findings corrected before
archival include sequential retention of input hashes, exact declared-source
bytes and supplied replay metadata/environment, canonical native assembly
metadata, behavior-before-cost chronology, complete cost draw/payload/activity
and attempted rosters, persistent comparison progress, early output refusal
with exclusive publication, and finite derived cost arithmetic.

The verdict re-executes the admitted reference trajectories and computes the
integer gain threshold and ratios of per-arm medians. Missing or nonpositive
required wall/allocation denominators refuse admission. Zero-denominator or
overflowing descriptive CPU ratios are explicitly unavailable and do not
create a CPU gate. This interpretation preserves the protocol's wall and
allocation conditions and its descriptive CPU accounting.

Synthetic regressions cover these refusals, including serialization of a
structured failed verdict after finite inputs produce an overflowing ratio.
The final wrapper reread accepted all corrections. This bounded review
neither measures performance nor proves process isolation or a source-to-binary
theorem. Two named loaded assemblies are identified separately from the
nineteen admitted scientific files; this manifest includes directly used
`src/Core/Result.fs`, not a claim to the entire transitive toolchain.

## Hand comparison and local checks

The first independent comparison matched all sixteen transition rows, four
cue rows, forty conditioning rows, thirty planning rows and ninety-six
full hand episodes. Maximum absolute numerical difference was
`2.7755575615628914e-17`; discrete state/action/reward, rendered-frame hashes,
projection hashes and counters agreed. Both implementations executed all ten
specified falsifiers. The native input SHA-256 was
`A37CBDB7B62399FA0A74ADFE0ADAFF7395863F89A47131FCDF0ABC68C4260A84`.
The [retained comparison](hidden-switch-validation/2026-09-07/hand-comparison-attempt-1.json)
identifies its exact native hand attempt; final fixture admission will be
recorded separately if subsequent review changes its bytes.

The focused Python suite passed 129 cases in 5.97 seconds, with all six
source/test files passing mypy, Ruff and formatting. These checks do not
replace the forthcoming combined Interp and native Release gates.
[Validation records](hidden-switch-validation/2026-09-07/README.md)
retain commands, outputs, exit status and earlier checks. No result from
these deterministic hand and admission tests is a registered behavioral
or cost outcome.
