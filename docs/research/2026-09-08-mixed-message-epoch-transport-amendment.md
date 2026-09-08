# Mixed-message epoch: explicit process-boundary amendment

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation contract amendment
Lifecycle: active
Status: coordinator accepted; independent transport review pending
Work item: 081M1Z63YMC087G0R003N5FH9X

## Why this amendment exists

The [reviewed source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
at `84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c` remains unchanged and reachable.
During concrete implementation, the existing owners and coordinator found
three omissions: compact Start inputs did not carry compensation history;
Terminal's reference summary could not deliver actual returned artifacts/results;
and the peer could not observe the coordinator's actual budget reservations.
The prior design review did not establish these missing transport mechanisms.
This is an explicit amendment, not a claim that the original schema already
contained them or that executable controls have passed.

The [accepted ADR](../DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md)
uses this amendment with the original source contract. Only the finite records
below change. The 57-parameter learner, numerical rules, case inputs, M1-M8,
source-admission premises and absolute budgets remain fixed. Include this exact
repository path in the new independently admitted service/source manifest.
The scalar ProtocolSha256 still identifies the unchanged scalar contract.
No old numerical execution or manifest is reassigned.

## Complete actual return, once

Add exactly one administrative peer frame after runEpoch actually returns:

```text
EpochReturn = {Kind,Schema,SessionId,Sequence,Result,ResultSha256}
Kind = 'EpochReturn'; Schema = 'zeta.mixed-epoch.peer.v1'
```

Result is the complete passive actual EpochResult, including ProposedArtifacts,
Scheduler and observations. ResultSha256 hashes its canonical bytes. It contains
no Store snapshots, runtime type instantiation or later acknowledgment of itself.
Its Publication and numerical Counters are the actual core snapshot before
this final transmission; do not mutate them to manufacture later observations.
A maximum 16 MiB complete frame, including LF, is charged to the existing
64 MiB transcript and 256 MiB retention allowances. Oversize refuses; there is
no promise that every maximum plan fits a result frame. No chunking or retry.

After the scheduler stops, allocate exactly the next protocol sequence for this
one frame. Sequence now counts Checkpoint, ProjectionRequest and this final
EpochReturn; ACK/Commit still reuse their associated sequence. The frame creates
no numerical operation, scheduler entry, state swap or Commit. Retain it through
the one Store and acknowledge with the existing CheckpointAck variant, whose
CheckpointSha256 hashes the complete EpochReturn frame including LF. Add the
BudgetSnapshot field described below to that acknowledgment.

Terminal follows the acknowledged return, or reports its publication failure
only while output is still at a known intact frame boundary. After an unknown
or partial output write, stop; do not append a terminal to an incomplete
NDJSON frame. Retain the actual memory result and closure observations.
Reject duplicate returns or later operational frames. A valid full
result, its actual stored acknowledgment, the matching terminal and admitted
EOF/exit/cleanup are all required before a forecast bundle or training artifact
is available to the next session. That eligibility uses the actual outer
acknowledgment/closure bound to ResultSha256, not the earlier immutable
Result.Publication snapshot, which may still describe memory-only retention.
Raw bundle/source checks continue to require the separately admitted actual
closure premise. A missing return cannot be reconstructed from
prior checkpoints and labeled actual. If encoding, write or ACK fails, retain
the actual result in peer memory with its separate publication failure; no
publishable forecast is produced. Already committed state is not rolled back.

## Explicit terminal publication

Terminal.Publication has exact fields `{EpochReturn,ResultRetention,Failure,Transport}`.
EpochReturn is null or `{Sequence,ResultSha256,FrameSha256,Artifact}`, where
Artifact is the exact acknowledged existing Store descriptor. ResultRetention
is `acknowledged`, `memory-only` or `not-returned`. Failure is null or the
existing exact four-field `{Code,Stage,Field,Message}` Failure (Field may be
null), with stage
`publish` and the appropriate existing failure code. Original nested
transport/storage/raised observations remain separately retained in the actual
peer/coordinator outcome. Do not relabel this as the core numerical outcome.

Transport is `{Coordinator,Peer}`. Coordinator is the last exact observed
BudgetSnapshot; it may be null only for a pre-Start refusal with no returned
EpochResult. Every admitted session retains its actual snapshot. Peer is `{IncomingBytes,IncomingFrames,OutgoingReservedBytes,
OutgoingReservedFrames,OutgoingCompletedBytes,OutgoingCompletedFrames,PartialWrite}`.
PartialWrite is null or `{Sequence,ReservedBytes,ObservedWrittenBytes}`.
Sequence is an integer or null: Ready and Terminal have no operation sequence.
ObservedWrittenBytes is null when the actual written prefix is unknown.
Do not promote a full reservation to a successful physical write.

This publication snapshot is taken before encoding the containing terminal.
The terminal's own transmission and final closure totals remain separately
retained in the actual peer/coordinator outcome. No field recursively includes
the bytes of the record encoding that field. A terminal never invents the
EpochResult of a peer that stopped before returning.

## Observed budget transport

Add one exact `BudgetSnapshot` field to Start, CheckpointAck and
ProjectionResponse. Its exact fields are:

```text
{SnapshotIndex,CompletedSessions,PriorWork,Store,TranscriptBytes,
 TranscriptFrames,PeerLaunchAttempted,NativePreparationEntered,
 RemainingMilliseconds}
PriorWork = {SchedulerEntered,KernelEntered,ForwardEntered,LearnEntered,
 ProjectionRequested,NativeLaunchAttempted,CertificateEntered,
 NestedReferenceEntered,TrainingArtifacts}
Store = {ReservedCombinedBytes,ReservedArtifactSlots}
```

All are exact bounded integers. The coordinator samples before encoding the
containing frame. SnapshotIndex strictly advances; global nonrefunded
reservations, frame counts and launch/preparation counts cannot decrease.
RemainingMilliseconds is floored, nonnegative and at most 300000; it cannot
increase or extend the original cooperative deadline. This is no hard-real-time
or forced Decimal-preemption claim.

PriorWork includes numerical budget entries from completed prior sessions only,
and remains fixed with CompletedSessions throughout the current session.
Count a training artifact on its actual admitted training entry, not only on
successful publication. A failed session stops the outer route; its actual
failed prefix is retained separately, not omitted from the final outer ledger.
Admission checks prior work plus current session work against the fixed outer
caps. Each returned core result still reports that session's numerical entries.
Do not add prior entries into every session result and then sum them again.

Store is the nonrefunded external D/A reservation plus the actual existing
Store reservations. Observe repeated snapshots; never sum them. TranscriptBytes
and TranscriptFrames are charged original protocol positions: actual retained
incoming prefixes plus reserved full outgoing originals. Physical partial
writes/EOF have separate observations. They do not assert that every charged
outgoing byte reached the peer. Count an incoming frame position on its first
observed byte, including an incomplete EOF prefix; empty EOF adds no position.
An outgoing full-frame reservation remains charged even if its write fails.
The peer charges actual containing-frame bytes
separately after observing a pre-frame snapshot, without double charging earlier
positions already included. Core transport fields are explicitly the last
observed coordinator prefix, not an invented final global total. A typed
recorder Snapshot callback retains that exact snapshot index and timing;
final actual outer totals live in the coordinator result.

## Compensation context and finite dependent sessions

The first Compensate operation's source-specific Inputs is exactly
`{TargetRevision,RetainedPlan,RetainedResult,Checkpoint}`. RetainedPlan must be
query-only and nonrecursive. RetainedResult is its complete source-admitted
actual return, matching plan/source/cut and current InitialState. Checkpoint is
`{State,StateSha256,Prefix,PrefixSha256}`, the exact pre-target state and
observation prefix. TargetRevision identifies an actually applied update after
that checkpoint. Check hashes, content, state and source correspondence. Derive
descendants conservatively from the later committed revision chain and derive
restore versus active-cut replay independently; accept no Descendants or Replay
verdict. The original 1 MiB plan/depth/count limits apply. Oversize history
refuses. No opaque loader or recursive prior compensation plan crosses processes.

Forecast compact-binding admission retains the explicitly trusted coordinator
constructor; it does not turn raw JSON into proof of prior execution. Full
bundles and independently supplied expected identities are checked by that
coordinator before peer launch.

For M5, one private outer handle pre-admits exactly the four-session route:
child train, the two fixed target-hidden queries, then parent train. P is zero.
The complete later plans depend on actual prior artifacts; admit each full plan
before that session, after its dependencies exist. Reject skipped, reordered,
extra sessions or changed rows/cuts/ports/quotas. The four launches share the
same Store, deadline, work and transcript ledger; finalize once after completion
or first failure. This is a finite dependent construction, not a caller-defined
session program. Single-session/M4 derives P from its complete plan before setup.

## Validation status

The coordinator accepted the finite field maps after cross-owner review of
actual API needs. Independent amendment review and source checks must be retained
before the first actual integration invocation. Local declaration/compiler or
unit checks are separate evidence and cannot substitute for M4/M5 execution.
