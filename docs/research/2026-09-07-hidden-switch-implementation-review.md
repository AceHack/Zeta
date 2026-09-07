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
archival include sequential retention of input hashes, annotated archive-ref types, exact declared-source
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

## Independent source review

The [independent reference/native review](2026-09-07-hidden-switch-independent-review.md)
retains authoring chronology, exact rational oracle construction, inspected
source fingerprints, source-boundary findings, their dispositions and a
retracted default-frame concern. Its reference index guard was narrowed to
0..1023 before archival; no admitted trajectory semantics changed.

The native runtime admission review separately requires explicit raw DTO
fields before typed decoding, so missing zero/false/null values cannot
silently acquire defaults. It also requires matching declared source commits
before cost execution and maps an unlaunchable git process into a retained
admission failure. All these corrections passed the final independent admission reread before
archival; final validation records identify the reviewed bytes.

A source check of [.NET 10 Process on macOS](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.Diagnostics.Process/src/System/Diagnostics/Process.OSX.cs)
confirmed that the current-process CPU getter reads the current CPU usage.
No extra process-refresh operation or timing-boundary change was introduced.

## Final native admission reread

A separate reviewer read the native runtime and behavior, cost and hand CLIs.
Accepted corrections include equality of the declared source commit, exact
recursive DTO property/scalar/container shape before F# deserialization,
refusal of omitted zero/false fields and malformed JSON, exactly one nonblank
behavior argument, output-path preflight, and typed Win32 process-launch
failure. Exact archived bytes, loaded assembly identities, complete roster
and value checks, and behavior-before-cost chronology remain enforced.

Hand-mode negative mutations cover omitted Failure, Index, Effect and zero
counter fields, extra/wrong-typed fields, and empty/blank/wrong-count arguments,
with valid controls. A missing-git child-process attempt was retained with
Complete=false, git-launch and empty Panels. No new source or receipt blocker
remained in the final reread. The reviewer ran no native build, tests or
registered streams. This is admission review, not a process-isolation or
source-to-binary derivation proof.

## Auxiliary exact envelopes

The [exact-envelope note](2026-09-07-hidden-switch-exact-envelopes.md)
derives the supplied model's depth-two and depth-three action boundaries,
1/5 and 51/190, with exact rational endpoint certificates over all contingent
tree values. It records tolerance shifts and binary64 qualifications.
No source tape, episode or cost run was executed for that note, and it adds
no registered policy arm or criterion. It makes the already stated limit
concrete: an advantage over myopic behavior would not establish that online
tree search is necessary to realize the supplied finite controller.

## Integrated checkpoint before implementation archival

The [integrated validation record](hidden-switch-validation/2026-09-07/README.md)
contains the nineteen-file source manifest, successful mapped Release build,
sixteen focused native tests, fresh identical hand fixture, full 431-case
Python gate and exact earlier failures. The full-solution BftConsensus gate
has not recovered. Its TLC trace-recovery error and subsequent in-run JVM
SIGBUS are being investigated without changing the model, jar, registered
experiment or verdict. No registered stream or timing has run.
