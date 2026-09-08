# Mixed-message and learned-module epoch implementation register

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation coordination
Lifecycle: active
Status: bounded contract and transport amendment accepted; source implementation underway
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
