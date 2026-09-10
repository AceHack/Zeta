# Mixed-message epoch Python bridge: implementation checkpoint

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation and development validation
Lifecycle: active
Disposition: immutable checkpoint for independent source review; actual controls pending
Work item: 081M1Z63YMC087G0R003N5FH9X

## Scope and source cut

The [bridge](../../src/Interp.Python/zeta_interp/mixed_message_epoch_bridge.py),
[inert builders](../../src/Interp.Python/zeta_interp/mixed_message_epoch_controls.py)
and [dedicated tests](../../src/Interp.Python/tests/test_mixed_message_epoch_bridge.py)
implement the Python coordination boundary at source commit
`8e1fe19a074368c3fd48f5f6cb871b1ce5d6b141`, based on parent
`cd794f8ac4550050c5523f149551e0fc5d3fe50a`. Their exact original bytes, development
preimages, commands, actual outputs and owned fixture trees are indexed by the
[checkpoint custody](mixed-message-epoch-bridge-validation/2026-09-08/checkpoint-1/README.md).
This report is the implementation owner's account, not independent acceptance.

The governing inputs are the unchanged
[source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md),
[transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md) and
[identity/codec conventions](2026-09-08-mixed-message-epoch-identity-codec-conventions.md).
The bridge additionally requires both unchanged scalar
[Decimal admission](2026-09-08-precision-gate-projection-decimal-admission-clarification.md)
and [rendered-zero](2026-09-08-precision-gate-projection-rendered-zero-clarification.md)
clarifications and the existing scalar protocol hash. It does not change the
scalar numerical implementation or call the old fixed-roster driver.

No named actual M4/M5 route, frozen nested query, standalone native numerical
producer or extra top-level reference root was invoked for this checkpoint.
The repository gate includes existing numerical unit/model tests; the dedicated
bridge tests use inert complete plans, injected services, a simulated peer, real owned
Store files, and small Python children for pipe transport. Existing reference
and process modules are imported; numerical callbacks in these tests are
injected. The F# core/peer runtime is separately owned and not established by
these Python tests. Assembly, immutable expected manifest construction and
independent source admission precede root's registered actual invocation.

## Public surface and finite routes

`open_bridge(source_root, attempt_parent, attempt_name, host, manifest_raw,
expected_manifest_sha256, first_plan_raw, route=...)` returns a privately issued
`Bridge` or the available `BridgeResult` on setup refusal. `run_session` consumes
the next complete plan and session identity; `finish_bridge` returns the same
once-only final result on repeated calls. Public invalid handles refuse. The
private handle is ordinary caller-trust state, not hostile same-process isolation.

The sole multi-session route is `m5-child-parent`: child training, the two fixed
target-hidden child queries, then parent training. Its initial complete plan
establishes P=0 before setup. Each later plan is reconstructed by an inert
fixed builder from actual earlier closed results and compared in full before
entry. There is no caller-programmable loop, skipped position, quota extension,
refund, hidden reset or automatic retry. Single-session projection allowance P
is derived from the complete admitted operation roster before native preparation.

The inert module exposes `m4_plan`, `m5_child_plan`, `m5_query_two_plan`,
`m5_query_three_plan`, `m5_parent_plan` and `frozen_nested_query_plan`. Import and
plan construction perform no I/O or numerical work. Builders consuming earlier
sessions require their actual closed, privately sealed result/artifact chain.
M5 keeps the fixed four original rows, eight SGD steps and ten forwards; its
child forecasts carry complete actual return bundles and explicit lineage.
The separate nested query selects the two returned training artifacts without
training or a training forecast bundle. Its row and separate session budget
require root's explicit registration; it does not enlarge the four-session M5
accounting.

Training forecast reuse is intentionally limited to sessions owned by this
same bridge. Cross-owner training forecast reuse needs a separate provenance
contract and control. The single frozen-query builder can consume the selected
versions from closed same-process training returns; no hidden fitting follows.
`LabelAvailable` remains a nonnegative int64, including target-hidden queries;
only `Target` is nullable. `ChildCuts` is an exact canonical hash to full cut map.
Variable/factor domain-separated hashes, independent prior owners and complete
artifact/version/vector hashes follow the pinned convention.

## Independent local manifest and measured budgets

The exact local manifest has four fields:
`{Schema,ExpectedBindings,SourceFiles,DirectFiles}`. Schema is
`zeta.mixed-epoch.service.v1`. Its expected original bytes and SHA256 are supplied
independently by the caller. `SourceFiles` is an ordinal, unique list of
`{Path,Bytes,Sha256}` rows: at most 128 paths, 8 MiB per original file and 64 MiB
aggregate source bytes. Required paths are explicit in `REQUIRED_SOURCES` and
include all three owned files, the five pinned documents, imports, peer/scalar
scripts, F# sources and project/toolchain declarations.

`DirectFiles` is the exact ordered seven-role list, each `{Role,Bytes,Sha256}`:

1. `@python` (actual resolved current interpreter image).
2. `@host` (caller-selected dotnet host).
3. `src/Research.FSharp/MixedMessageEpochReplay.fsx`.
4. `src/Research.FSharp/PrecisionGateProjectionReplay.fsx`.
5. `src/Core/bin/Release/net10.0/Zeta.Core.dll`.
6. `src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll`.
7. `src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll`.

Direct reads inherit the existing 128 MiB per-file admission cap. ExpectedBindings
contains the admitted source paths, repository direct-file paths and unchanged
`ProtocolSha256`; the two `@` roles stay outside it. The maximum flat map is 132
entries: 128 source paths, three additional DLL paths and the protocol key. Its
canonical encoding is also bounded by 64 KiB. Both scripts' exact three literal
`#r` paths and actual loaded Python `__file__`/module origin are checked. Actual
regular-file reads and identities are retained before later checks, with source
observations before setup, before the session and after the peer outcome.
These admission bounds do not promise peak memory or transitive runtime closure.

There is one cooperative 300-second deadline beginning at public setup entry,
one 64 MiB charged transcript with a 1 MiB terminal reserve, at most 16,384
charged frames, and one 256 MiB/4,096-slot Store budget with an 8 MiB journal.
For P>0 the nonrefunded native reservation is
`D = 2 * (script + three DLL copies + P * (64 KiB + 64 KiB + 2 MiB))`,
`A = 4 + 3P`; P=0 reserves zero. Inner Store limits subtract D and A, and must
leave its fixed journal, 2 MiB terminal room and ordinary capacity. This is an
owned-retention ledger, not an OS quota or all-cost accounting.

Start, ACK and ProjectionResponse carry the exact pre-containing-frame
BudgetSnapshot. It records completed-session work separately from global
reservations/charged transcript/launch prefixes. Incoming frames are charged
on their first observed byte, including an incomplete nonempty EOF prefix;
empty EOF costs no frame. Complete outgoing originals are reserved before a
write. Actual completed writes and partial/unknown writes remain separate.
No later frame is appended after output failure. Current complete plan and
actual remaining allowances are checked again before operations.

## Actual returns, publication and source limits

Projection requests bind the source-fixed binary64 target, exact original scalar
input, request/session/case identities and unchanged bindings. The coordinator
calls the existing `launch_native` and then the existing `certify_native` once,
retaining each actual normal return before type admission, encoding or comparison.
The certificate supplies its own nested reference entry. There is no extra
reference call or boolean verdict replacing the complete native/certificate DTOs.
First native/preparation failures survive later encoding failures.

A Checkpoint is stored as its complete original frame before its matching ACK;
Commit must bind that actual ACK and proposed state. Projection requests consume
wire sequence positions before the enclosing observation checkpoint. EpochReturn
carries the complete actual core result once, before Terminal. Its received
result is retained and admitted before sequence association: a failed allocation
gap remains a separate transport/publication refusal and cannot produce eligible
forecast closure. Malformed result candidates remain raw, with ReturnAdmitted=false.
The original core failure is not replaced by that later transport failure.

Closed forecast eligibility requires the actual full EpochReturn, stored ACK,
matching Terminal, EOF, child exit/cleanup and source observations. The core
result's earlier Publication snapshot remains unchanged even though later outer
publication can succeed. Complete recorder and ProjectionService returns are
bound to actual outgoing snapshots/ACKs/responses. Closed learner/kernel union
shapes, scheduler returns and normal failure payloads are checked against the
fixed catalog. Numeric Block Inputs and Proposal.Details remain bounded retained
values with the source premise; this is not a second numerical evaluator or a
claim of exhaustive arithmetic admission for every nested detail.

Mutable public SessionResult DTOs do not become finalization authority. Guarded
seals bind retained raw plan/result/terminal bytes and closure facts; an owned
pre-exposure summary supplies the original final state if caller mutation or
seal encoding fails. Eligibility is cleared on such failure. Store finalization
still has its once-only attempt. Comparison of raw trees preserves primitive
types, including bool versus int, within explicit node/depth bounds.

The full BridgeResult remains in memory, including actual callbacks/process
objects and preparation/source observations; it is not a bounded public-encoder
DTO. The existing outer terminal explicitly says so. Its durable fields are
Schema, ServiceSha256, Route, Failure, Sessions and Counters. Each session summary
contains SessionId, PlanSha256, Closed, ForecastEligible, Failure, EpochReturn's
six-field stored Artifact, TerminalSha256, ReturnAdmitted and the actual last
observed committed state. The Store journal, original protocol records, source
summaries, bounded process summary and actual direct native artifacts provide
additional descriptor/byte coverage. Root's registration must describe that
coverage honestly rather than claiming a serialized full BridgeResult.

## Development findings retained before correction

The archive preserves original source/test snapshots and actual failed checks:

- Transport charged no frame for an unterminated nonempty EOF prefix and allowed
  an append after a partial write. Both original discriminators failed; charged
  frame accounting and the output-failure latch were corrected.
- The closed Error variant accepted `Failure=null`; optional failures elsewhere
  legitimately remain nullable. Error now requires its actual non-null payload.
- A late clock exception escaped finalization; native and preparation refusals
  could be replaced by a later encoding failure. Actual first failures and
  available returns now survive, with once-only finalization attempted.
- Seal construction escaped the public boundary, and caller-mutated session
  state could change final output. Guarded sealing and original owned summaries
  preserve the prior prefix and remove eligibility on failure.
- Required scalar clarification bindings were missing. Four missing/wrong-file
  controls failed before the exact path/hash requirements were added.
- The deadline started after admission, refunding startup time. The retained
  fake-clock control now counts actual public-entry elapsed time.
- An unparsed PendingRequest could leave a complete result marked admitted.
  The original fixture later refused transport for an independent byte-counter
  mismatch, so it is not evidence of successful closure. The specific erroneous
  ReturnAdmitted=true observation is preserved and corrected.
- Python equality admitted M4 Sweep=false, M5 Pass=true and the corresponding
  bool-valued checkpoint operation. All three controls failed before repair.
  Bounded type-preserving equality now also binds complete service/checkpoint/
  result/bundle/seal copies. A passive return's unchanged integer field passes;
  substituting false for zero refuses. Primitive counters separately retain
  their strict integer admission.

The separate fixture error that tried to gzip-decompress an identity-encoded
Store artifact is retained, followed by the encoding-correct read. Typing and
format diagnostics remain in their original attempts. One repair script stopped
on its own overlapping replacement assertion before writing source; its original
script and explicitly labeled tool-output transcription are retained. Neither
packaging failure is represented as a numerical result or missing runtime call.

## Final local checks and handoff

The final dedicated suite reports 85 passing development fixtures in 2.29 seconds.
Strict mypy reports no issues in the three owned files; Ruff and format checks
pass. The two nonnumerical canonical golden values are 273 bytes with SHA256
`BEB199B5B256A3735BC238BA0801493F271D5A7AC028254F6CDA06E5DE2E10F8` and a
1,235-byte nonempty Gamma state/BlockAttempt with SHA256
`7EC5B37CA1D3998375A50432765E7241E1FD0F9108BB2F72CE04602CBB7C6009`.
The core owner independently reported identical F# codec bytes; this checkpoint
retains the Python golden captures, not a newly executed F# comparison.

The full repository preflight passed all 18 checks at the same three source
bytes, including Release build and full tests. The formatter exited zero but
explicitly supports only C#/VB and reported its workspace-loading warning and
unsupported F# projects; it is not F# formatting coverage. The gate began on
the parent HEAD with these source files present and continued through their
source-only commit. The later report/custody paths receive separate normal
push checks. Complete command/source observations are in the custody index.

The first preservation archive captured its own still-empty redirected stdout;
a subsequent actual audit found that one original had grown to 1,641 bytes.
The original archive and the failed audit remain intact. A separately named
preserver writes its stdout outside the selected roster and rechecks every
current original and stored member without rerunning tests or codecs.

All source-bound focused tests remain development checks. Independent bridge review,
assembled peer/core integration, exact service/source manifest admission and
root's immutable actual-control registration remain outstanding.

## Subsequent source corrections

The [counter/path correction report](2026-09-08-mixed-message-epoch-bridge-corrections.md)
binds the later `0e0369` and `4402be8` source cuts, original failed controls,
100-fixture final validation and both unchanged-source repository gates. The
initial source and checkpoint archive above remain historical. The source-only
[peer foundation review](2026-09-08-mixed-message-epoch-peer-foundation-review.md)
keeps final lifecycle acceptance pending.
