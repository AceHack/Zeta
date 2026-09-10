# Mixed-message and learned-module epoch implementation register

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation coordination
Lifecycle: active
Status: assembled source capsule independently accepted; first actual controls pending
Work item: 081M1Z63YMC087G0R003N5FH9X

## Accepted boundary

The [ADR](../DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md)
accepts the exact [source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
at owner `84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c`:
53,198 bytes, SHA256
`4234015EE650FA7190CF3375C58654499F3BB9EC9C96E4BE21D2FC97A30EC979`.
[Independent acceptance](2026-09-08-checked-mixed-message-epoch-contract-independent-review.md)
is signed at `caa59da59281654016bffb90239c2fc09c03f092`.
The earlier proposal/census and original ADR remain reachable unchanged at
those source commits. The acceptance changes ADR status, not the reviewed
source contract or eight required controls.

[Scalar PR17051](https://github.com/Lucent-Financial-Group/Zeta/pull/17051)
is verified on main at `f59b6e395603062882dd1fe69fa8247406842e4d`.
Its [main receipt](research-main-publication/2026-09-08/pr-17051/README.md)
and [independent audit](2026-09-08-pr17051-publication-review.md)
retain the exact numerical source and first actual result. The new component
needs its own source identities and archive; it cannot inherit that execution.

## Disjoint implementation ownership

Existing sessions continue in their own writers, based on the reviewed
publication branch/current main. No new agent is created for this slice.
The [existing co-claim](../claims/task-distributional-learning-20260908.md)
records the same assignment.

| Session role | Owned paths and responsibility |
| --- | --- |
| `identity_formalization` | `BoundedModuleLearner.fs`, `MixedMessageEpoch.fs`, their two F# test files and Bayesian source/test project wiring. Define the exact compiled DTO/service/recorder signatures first and send them to the other owners. Implement the learner, checked blocks, real scheduler route and immutable state. |
| `predictor_audit` | `MixedMessageEpochReplay.fsx`: strict F# peer, actual core invocation, request/response correspondence, ACK-before-apply, Commit and terminal observation. Review the core implementation independently after its source is available. |
| `protocol_review` | `mixed_message_epoch_bridge.py` and its Python test file: actual direct-child coordinator, source/custody admission, fixed budgets, one Store and real native/certificate service. Review peer transport independently after its source is available. |
| Coordinator | Derived build graph, integration/source registration and archive, assembled review, first fixed M4/M5 controls, actual outcome record and publication. Review bridge implementation independently. |

These are the exact source additions from contract section 1. Necessary
interface clarifications must be shared before incompatible implementations
are committed. Each owner retains failures, actual check commands and results,
then normally signs and pushes its owned changes. No writer edits another
owner's paths or shared main. A claim is not evidence that implementation exists.

## One implementation cycle and actual execution boundary

Local development/unit controls may run and must retain their failures.
They do not stand in for the source-admitted integration control. Before the
named actual M4 and four-session M5 routes, assemble all direct source and
build/runtime identities, complete independent source review, freeze the
invocation/control roster and budgets, and preserve its immutable archive.
Only then execute once and retain every actual return, refusal and lost-prefix
observation. Do not replace a failed first attempt with a successful rerun.
An essential repair may lead to a separately named corrected attempt with the
changed identities and the original outcome preserved.

M4 is exactly the positive projection followed by the cancellation target in
one real peer session. M5 consumes the same four rows through child training,
two target-hidden frozen queries and parent training, within the shared outer
ledger. M1-M8 and one frozen nested query must be demonstrated; mocks alone
cannot close the cycle. A named failed control stops that configuration.

The [separate frozen nested-query registration](2026-09-08-mixed-message-frozen-nested-query-register.md)
fixes its hidden row, two learned nodes, parent input and composite output alias
before execution. It uses the two actual M5 artifacts without another fit and
does not extend the four-session M5 ledger.

After this bounded cycle, register one chronological learned comparison using
compatible individual, flat, shallow and deeper compositions and a feasible
pinned published comparator. Fix feature/label availability, inner forecasts,
embargo, scoring, choices and untouched holdout before fitting. Failed fits,
refusals, abstentions and resource use remain in the result. No component test
or four-row training loss is a held-out or state-of-the-art score.
Compiled investment remains paused and streams 9307/9409 remain unopened.

## Current external comparator census

The [current source/feasibility census](2026-09-08-current-forecast-comparator-source-census.md)
records exact Chronos-2 and TimesFM-3 source/model metadata and the observed
local package environment. It selects no held-out winner, downloads no weights
or data, and does not substitute an author-reported benchmark for Zeta's result.

## Process-boundary amendment

The [explicit transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md)
adds actual full-result delivery and measured budget snapshots, and fixes the
compensation context and dependent four-session construction. These omissions
were found during implementation coordination after the original design review.
The original contract remains unchanged; the amendment is a separate source
binding and requires independent review before actual integration execution.

[Independent amendment acceptance](2026-09-08-mixed-message-epoch-peer-amendment-independent-review.md)
is signed at `235c9a999646fce9ddad08c4f8d7f87cc4524f02` and binds the exact
coordinator amendment `15b20c513245201e125a0deae7d41c23e7bc136c`. This updates
the amendment document's historical pending-review status without changing
its reviewed bytes. No numerical/control input or limit was changed.

## Main publication and implementation conventions

The accepted design and transport amendment are
[verified on main through PR17052](research-main-publication/2026-09-08/pr-17052/README.md),
merge `84cc7a0cd2c78bff2ca01fc699fa4d054d3a8223`. The 124 changed paths and
complete tree match; final checks were 89 success and three skipped. This
publishes the design, not the still-in-progress implementation.

The [identity/codec conventions](2026-09-08-mixed-message-epoch-identity-codec-conventions.md)
make derived variable/model-factor identities and prior/input pairing explicit,
align canonical bytes, and fix the ChildCuts concrete shape. Independent draft
review found no remaining convention issue; final source review must bind the
committed note and implementation. The [minimal serialization witness](mixed-message-epoch-implementation/2026-09-08/codec-review-1/README.md)
preserves the real default-writer mismatch. Original contract/amendment bytes,
raw-query semantics, numerical roster and controls remain unchanged.

[Independent convention acceptance](2026-09-08-mixed-message-epoch-identity-codec-independent-review.md)
is signed at `442325f26cc4c86876f226f09ba0189a29cc4097` and binds the exact
6583-byte note at `02c2ac7249aba31cc8377c1804264c02fff35e47`, SHA256
`BB623AB96A329A075E8C9BC06953D7284DA62BA10766B0D06479D51A011F98C2`.
It verifies all eight retained witness members and their equal decoded strings
but unequal encoded bytes. This supersedes the note's historical pending-review
status without changing its source binding. It accepts conventions only;
concrete code, encoder golden tests and actual M4/M5 remain separate gates.

## First implementation checkpoint

The [core checkpoint](2026-09-08-mixed-message-core-implementation-checkpoint.md)
is normally pushed at owner `b097d56eccc630046cd3bf618a362b01edeba329` and
imported as `4c3757f7a` after fresh remote verification. Its 31 focused tests
and 16 quick checks are development evidence for the learner and codecs.
`runEpoch` and final assembled admission remain unfinished. No actual named
M4/M5 or frozen nested query has run. The derived build graph was re-derived
after import and reported already current.

The [coordinator import receipt](mixed-message-epoch-implementation/2026-09-08/root-core-import-1/README.md)
retains its actual 16-check quick pass and Bayesian Release build with zero
warnings/errors. Neither is a complete solution gate or an actual epoch run.

The [initial independent core review](2026-09-08-mixed-message-core-initial-independent-review.md)
is normally pushed at `81c4c983bfe89d9a4e0306c1996fb1b00b647dad` and
imported after fresh remote verification. It accepts the inspected learner and
codec checkpoint boundaries, while retaining three findings against a separately
identified uncommitted runtime draft: an unsettled task receipt, missing early
unpublished observation, and unavailable remote work incorrectly reported as
complete zero. The owner's subsequent repairs require their own source pin,
actual development evidence and follow-through review. This preliminary review
does not accept the unfinished runtime or execute the registered controls.

The [withdrawal admission clarification](2026-09-08-mixed-message-withdrawal-admission-clarification.md)
records a further M7 implementation gap: a TrainingCut hash does not establish
full ancestry for a new query owner. It proposes conservative refusal of learned
reuse under a withdrawing cut, with cold-start training separately budgeted.
Matching core/bridge implementation, actual discriminators and review remain
pending; inverse-SGD refusal alone cannot close M7.

The [fixed invocation artifact](mixed-message-epoch-implementation/2026-09-08/registered-source/README.md)
is prepared for M4, then the four actual M5 sessions and separately budgeted
frozen query. Static checks do not establish execution. Final source/runtime
identities, custody and assembled admission remain prerequisites.

The [Python bridge checkpoint](2026-09-08-mixed-message-epoch-bridge-implementation.md)
is normally pushed at source `8e1fe19a074368c3fd48f5f6cb871b1ce5d6b141`,
with report/custody `051d02c464e8927b868d158eb54d44f380767d22`, imported after
fresh remote verification as `9efb1f1c9` and `9b91e3c7b`. Its 85 development
fixtures and complete owner repository gate passed. The
[independent review](2026-09-08-mixed-message-epoch-bridge-independent-review.md)
audits the three source files and 1,352 archive members, but withholds complete
acceptance pending the counter-knowledge correction and assembled core/peer
correspondence. The complete actual bridge result is memory-retained; durable
summaries reference the existing original records and do not serialize that
entire object graph.

## Runtime and correction follow-through

The normally pushed [core runtime checkpoint](2026-09-08-mixed-message-core-runtime-checkpoint.md)
at `15b43aa7271d100842c198a4378eef717e4acef8` is imported as `ded9f886a`.
Its 48 focused owner tests and retained earlier failures extend the original
31-test learner/codec checkpoint. The coordinator's
[actual Release build](mixed-message-epoch-implementation/2026-09-08/root-runtime-build-1/manifest.json)
passed with zero warnings and errors in 27.68 seconds. This is not a complete
solution gate or a registered epoch run. Final M1-M8 coverage and withdrawal
admission are still being completed against separately identified source.
The runtime calls checked kernels and SoftScheduler; its typed site ledger
implements the exclusion/replacement laws without invoking FactorGraph itself.

Bridge counter/path corrections at `0e0369a` and `4402be8`, with evidence
`a6ca792`, are normally pushed and imported as `b8cda99ab`, `94695d197` and
`1967a7bed`. The
[independent follow-through](2026-09-08-mixed-message-epoch-bridge-independent-review.md#follow-through-on-the-counter-and-path-corrections)
accepts those concrete fixes and verifies all 858 correction archive members.
Withdrawal admission and final core/peer correspondence remain distinct gates.

The fixed invoker's source review found a blocking FIFO manifest read and a
secondary finalization/console exception that could replace the top-level
primary exception. The
[repaired invocation record](mixed-message-epoch-implementation/2026-09-08/registered-source/README.md#launcher-review-and-repair)
retains the actual failing source and subsequent three development controls,
plus strict/static checks of the corrected source. Independent review accepts
those two repaired boundaries for the declared ordinary-Exception scope.
No named M4, four-session M5, frozen query or new held-out comparison has run.


## Completed peer and bridge withdrawal checkpoint

The [completed peer](2026-09-08-mixed-message-peer-lifecycle-source.md) is now
imported through normal owner push `463102c0a`, with exact 99,661-byte script
SHA256 `5D0DD505F3849D7F989982DCAE5EBAB2898B8140AE74489540EC016B15AD7795`.
Its [independent lifecycle review](2026-09-08-mixed-message-peer-lifecycle-review.md)
is owner `95d7dca78`. That accepts bounded callback/publication behavior against
core runtime `15b43aa`; final model/compensation source remains a separate pin.

The [bridge withdrawal implementation](2026-09-08-mixed-message-epoch-bridge-withdrawal-admission.md)
and [independent follow-through](2026-09-08-mixed-message-epoch-bridge-independent-review.md#follow-through-on-conservative-withdrawal-admission)
now close its conservative admission gap at source `567a9f004`. The original
clarification remains byte-identical. All 562 owner custody originals and four
imported source identities match the reviewer audit. Neither static inert
compensation payloads nor peer zero-operation fixtures are actual assembled
historical-query evidence.

The fixed invoker's three contract links are repaired at `50610f191`; its
reviewed Python bytes remain `CC7FBF89...055E69`. No named route has run. Final
core controls/review, assembled gate, frozen service/source/runtime archive and
independent admission remain prerequisites to the unchanged first attempts.


## Complete core source and original assembled gate

Core model/compensation source `d7e8e3806` is imported, with 71 focused controls,
323 owner evidence records and [independent source acceptance](2026-09-08-mixed-message-core-model-independent-review.md)
at `419c7a81d`. This includes the actual local M1/M2/M3/M6/M7/M8 controls and
conservative withdrawal admission, with synthetic service premises explicitly
limited. The [invoker review](2026-09-08-mixed-message-invocation-independent-review.md)
at `2c8adb74c` binds the final CC7FBF89 Python bytes and repaired README.

The [assembled validation record](2026-09-08-mixed-message-assembled-validation.md)
preserves the first full-gate test-process crash and the original default-temp
Python fixture failure. The separate unchanged-source diagnostic recovery
passed 7,835 tests with six existing skips; the crash cause is unresolved.
The test owner is preserving its portability correction. Production bridge
source remains unchanged; no broad numerical criterion is relaxed.

The [finite observation-helper record](2026-09-08-mixed-message-observation-helper-review.md)
preserves original static findings, final freeze/capture identities and isolated
failure-retention controls. First source/runtime capsule admission and named
actual M4/M5/frozen-query execution remain outstanding. These development
checks do not supply the requested chronological or SOTA comparison.


Final test-only correction `cf5744d70` and signed helper review `2fccfeff6` are
now imported. The assembled clone passes 111 default-temp bridge tests and
strict typing with all three Python sources unchanged through that recheck.
The [final assembled validation section](2026-09-08-mixed-message-assembled-validation.md#final-test-correction-and-assembled-source-checks)
keeps original failed gates and successful recovery checks distinct. Source
implementation/review is complete for the bounded control; immutable capsule
admission and all actual named outcomes remain pending.


## Frozen assembled capsule

The [first source/direct-runtime capsule](mixed-message-epoch-implementation/2026-09-08/implementation-source/README.md)
is frozen from `3c3a76ad6674bb40b2e1309021735950c282d8d5`: 65 selected sources,
seven direct files, 69 flat bindings. Service manifest SHA256 is
`F92041F0DBC344DA877DFA970B3C5C7AD6817C8285AAA28E164872F2CE6D56F1`;
archive SHA256 is
`E51A00FC29FA2A13B09F152AB0F55908B7E03982036E5084F54A221815149445`.
All 298 archive members were reopened; source bytes equal the named commit,
direct-after identities match and passive manifest admission succeeds.
Independent assembled acceptance and every actual named outcome remain pending.


## Final assembled admission and model-switch checkpoint

The [independent assembled admission](2026-09-08-mixed-message-assembled-admission-review.md)
is normally pushed at owner `26eb850ed0282e3395ec54011408738e5cf181c6`, freshly
fetched and imported as `dec1050fd`. It accepts the exact F92041F0 manifest
and E51A00FC archive above, all 298 members, 65 sources, seven direct files
and 69 bindings. It finds no blocker for the unchanged first M4 invocation.
This supersedes historical pending-admission statements without changing the
frozen source or capsule. No numerical service ran in that review.

The [model-switch handoff](../handoffs/2026-09-08-vera-model-switch-execution-ready.md)
records the exact writer/remote branch, command, independently accepted full
hashes, original failures, M4-before-M5 inspection boundary and remaining
publication/comparison work. No named M4/M5/frozen query has run; both root
execution/parent directories were absent at the handoff probe. The user asked
to preserve this state before switching to a smaller model, so the next
session owns the first actual invocation and its assessment.
