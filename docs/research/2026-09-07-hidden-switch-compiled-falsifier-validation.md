# Guarded hidden-switch compilation: pure falsifier replay validation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed Python source and synthetic fixture evidence; native conformance pending

## Result and scope

The pure checker at `4722b7ae2e25fb74d2302be93024cb15cf6ab160`
passes 63 focused tests and independent read-only source review. It
re-executes all 222 scalar positions, 48 new hand episodes and 24 old
controls before checking ten invocation cases, ten interventions and
53 refused operations in fifteen logical groups. This is local Python
checker validation. It is not actual native-produced hand conformance,
runtime admission, outer-negative replay or a behavioral/cost result.

The [implementation contract](2026-09-07-hidden-switch-compiled-falsifier-design.md)
preserves initial draft `541b8c773f2afba2009344a4ebe6bfcaf254ebd6`,
revised design `8e68332fd9c62a23283097eae234351698364a01`, native DTO
coordination and both independent design findings. The
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md) remains
byte-identical at SHA256
`8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A`.
No registered seed 9307/9409 source generation or timing run occurred.

## Source and public boundary

Initial implementation `9e7fa4404366c5bfafe72964e966752889d33fba`
adds the [pure checker](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_falsifiers.py)
and [discriminating tests](../../src/Interp.Python/tests/test_hidden_switch_compiled_falsifiers.py).
The focused follow-up `4722b7ae2e25fb74d2302be93024cb15cf6ab160`
adds the explicit seventeen-hash band discriminator described below.

The public `replay_falsifiers` entry accepts the three decoded raw slices,
decoded falsifier payload and an actually issued numerical certificate.
It returns this lane's `Success[FalsifierReplay]` or a typed
`FalsifierFailure` carrying a concrete path and completed-prefix counts.
The contract documents every public dataclass field and exact wire union.
Delegate/evaluator totals in `FalsifierCounts` cover only the invocation
ledger; every refusal setup/final-operation count is checked in its own row.

The checker uses the existing [complete scalar/new-hand replay](2026-09-07-hidden-switch-compiled-pure-replay-validation.md)
and [complete old-control replay](2026-09-07-hidden-switch-compiled-old-replay-validation.md).
It reconstructs events through independent reference operations and requires
actual reference refusals for all invalid operations. Nineteen invalid
calls reach the native-shaped Python reference service, nineteen reach the
compiled Python reference service, and fifteen reach the other wire,
frame, order and prediction boundaries. These are Python calls, not native
process calls. A simulated compiled depth-one admission bypass is detected
even though the standalone admission helper remains intact.

The retained stub output is checked against the ordinary independent
contract. The checker requires and records its own two typed mismatches;
it does not accept a producer assertion that a later checker ran. Actual
native delegate/evaluator entry logs and their source/runtime binding still
require native conformance and review of the collector call sites.

The outer-negative field is exactly the six-field lossless artifact
descriptor. This module checks its shape and retains a copy, without
opening the named file. Both success and failure explicitly leave
`OuterNegativeAdmission` at `pending-coordinator-replay`; runtime admission
is `not-performed-by-pure-replay`. No filesystem, runtime collector,
source generator, numerical cache or native implementation import is used.

## Fixture origin and discriminating coverage

The fixture builder is written separately in the test file. It does not
call checker expectation constructors. Full old-control rows and policy
belief snapshots come from the unchanged old Python full runner; numerical
choices, full new episodes and frames use the independent reference APIs.
Event ledgers and native-style refusal records are owned synthetic fixtures.
They are not observed native callback logs or native-produced receipts.
The numerical certificate uses an explicitly small test binding map, not a
claim that the coordinator's complete final source roster was admitted.

The tests exercise full rosters, omissions, duplicates, reordering, exact
keys/types, boolean-versus-integer substitutions, invocation and traversal
counts, actual service refusal, chronology, suffix indexing, recorded reward,
frame cells, caller reset/copy state, terminal observations, old Q fields,
descriptor path/length/hash/encoding rules, certificate misuse and failure
accounting. After constructing fixtures, the full positive check replaces
`builtins.open`, the old runner and both source generators with failing
stubs. Source review separately confirms the checker has no filesystem calls.

The successful final counts are 222 scalar positions, 48 new episodes,
24 old episodes, ten invocation cases, ten interventions, 53 refused
operations and fifteen refusal groups. The invocation ledger contains ten
delegate entries and eight evaluator-root entries. This does not add the
separate setup counters to those invocation totals. The late final-operation
mutation preserves 52 completed refused operations and fourteen complete
groups, together with all previously checked slices/cases. Earlier old-Q
and new terminal-hash mutations preserve their exact whole-episode prefixes.

## Retained failures and repair chronology

The first strict type check found three diagnostics because the same local
variable names denoted strings in one branch and frames in another. Renaming
the frame locals resolved all three; no policy arithmetic changed. The
[initial diagnostic](hidden-switch-compiled-validation/2026-09-07/falsifiers/initial-mypy.log.gz)
is the verbatim tool stdout preserved after completion. The exact initial
source bytes are retained separately as lossless gzip with SHA256
`4FE5E1C6263BBA1B0C9673385ED33DEE47FE9340752A2902B4736204691B6087`.

After the first 62-test pass and source publication, self-review identified
that changed lower-band cells did not by themselves explicitly require
each retained full-frame hash to change. A new regression simultaneously
substituted baseline hashes in the band-only reference return and supplied
payload. Original source `9e7fa4404` accepted that injected pair; the
[failing regression output](hidden-switch-compiled-validation/2026-09-07/falsifiers/hash-discriminator-before-repair.log.gz)
retains the exercised test body and the unexpected success. This was a
synthetic reference/payload fault, not an observed renderer or native defect.

The follow-up requires both arrays to contain seventeen hashes and every
before/after pair to differ. The same injected pair then refuses as
`VacuousMutation`, before the first band case can be counted complete.
The original source and its 62-test result remain reachable; the final
63-test run is a separate preserved result. No scientific receipt was
edited, regenerated or relabeled to hide the initial result.

## Validation records

The [manifest](hidden-switch-compiled-validation/2026-09-07/falsifiers/manifest.json)
binds nine source/fixture/protocol files to the final source commit, the
four exact static-check commands, both source publication logs and all
attempt outcomes. Eleven gzip artifacts retain exact original bytes with
both stored and decompressed SHA256/lengths. All eleven decode as UTF-8;
the repository's banned invisible controls were absent. Compression is
lossless; no log was stripped or normalized.

| Check | Observed result |
| --- | --- |
| Initial strict mypy | Three errors, retained; frame-local naming repaired |
| Original focused suite at `9e7fa4404` | 62 passed in 45.99 s |
| Added discriminator against original implementation | 1 failed, 62 deselected in 6.01 s; retained |
| Final focused suite at `4722b7ae2` | 63 passed in 49.29 s |
| Ruff check and format check | Both pass on the two owned Python files |
| Strict source mypy and test-file mypy | Both pass |
| Original and repaired source publication | All sixteen quick-preflight checks passed for each push |

The pytest durations are test-run observations, not registered cost
measurements. No native build, native execution or full solution suite was
run in this bounded Python lane. The coordinator owns integrated gates and
the complete implementation archive.

## Independent review and remaining admission

The co-claimed independent reviewer, Vera using OpenAI Codex / GPT-6 Astra,
accepted final source `4722b7ae2e25fb74d2302be93024cb15cf6ab160`
after reading the checker, strict recursive comparison dependencies,
fixture construction and mutations. The review confirmed complete slice
replay, the ten/ten/53 rosters, all 38 service plus fifteen other independent
refusal calls, exact checked prefixes, the seventeen-hash repair, distinct
delegate/root/node meanings, actual typed stub mismatches and descriptor-only
outer scope. No material source finding remained.

The reviewer ran no tests, native code or registered sources. This source
acceptance does not establish actual native event collection, outer-negative
replay, CLI/module identity, the loaded executable graph or runtime premises.
Those named obligations remain necessary before complete experiment admission.

## Subsequent acyclic semantic API

The separately indexed [six-member API validation](2026-09-07-hidden-switch-compiled-semantic-api-validation.md)
adds a distinct descriptor-free prerequisite boundary at source `cdcf34d759a74201aa5599f4556e07af00f6dc4a`.
It shares the actual full checks, preserves this complete API's order, and
passes the original 63 plus nine added API cases. Its evidence and independent
review preserve the same pending outer/runtime scope and do not rewrite this
earlier source or failed-witness history.
