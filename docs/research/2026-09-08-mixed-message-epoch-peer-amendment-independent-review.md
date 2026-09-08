# Mixed-message epoch: independent peer amendment review

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, independent peer owner lane
Operational status: research-grade review
Lifecycle: active
Verdict: ACCEPT for the bounded implementation contract
Work item: 081M1Z63YMC087G0R003N5FH9X

## Exact reviewed boundary

I read the complete transport amendment at coordinator commit
`15b20c513245201e125a0deae7d41c23e7bc136c`, including its final corrections,
against the previously reviewed contract
`84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c` and the core/bridge owners' agreed
field maps. The amendment is 10,513 bytes, SHA-256
`ABB0E47938DF9ECD8CD4A64536289451D70FF0245B84EF9C05D1A2710C340707`.
The original 53,198-byte contract remains byte-identical. The
[evidence manifest](mixed-message-epoch/2026-09-08/peer-amendment-independent-review/manifest.json)
retains both exact files losslessly: 63,711 original bytes and 25,167 gzip bytes.
Both immutable Git blobs also matched the coordinator's observed current files.

This accepts the explicit schema amendment. It does not claim the original
review had established the previously missing mechanisms. It neither accepts
unwritten executable source nor substitutes for the assembled source review
and named M4/M5 controls. No numerical, training or bridge control was executed
for this review. Declaration and mock-stream development observations in the
separate peer implementation lane are not evidence of these controls.

## Required corrections and disposition

The draft had three bounded ambiguities. All are resolved in the reviewed pin:

- `PartialWrite.Sequence` permits null because Ready and Terminal have no
  operation sequence. An observed failure there cannot invent an operation ID.
- `Terminal.Publication.Failure` is null or the existing four-field
  `Code,Stage,Field,Message` value, with stage `publish`. Original nested errors
  remain in the actual peer/coordinator return holder. My initial review message
  mistakenly suggested the scalar API's five-field shape; the coordinator and
  core owner corrected that guidance before source freeze. No fifth field is
  accepted here.
- A terminal may follow a publication refusal only at a known intact output
  boundary. An unknown or partial write stops output; appending JSON cannot
  repair the preceding incomplete frame. Retain memory results and actual
  process/closure observations separately.

The final incoming-frame definition is also precise: charge the first observed
byte of a position, including a nonempty incomplete EOF prefix. Empty EOF adds
no position. This supersedes the earlier discussion's conservative begun-read
wording; attempted reads still remain actual transport observations.

## Accepted invariants

The one final `EpochReturn` carries the actual immutable complete core return,
after the scheduler stops, under its next sequence and the existing 16 MiB
frame/shared quotas. Storage ACK binds the original frame including LF; its
canonical Result hash binds the full return. It creates no numerical entry,
state swap or Commit. Failure retains the available return without inventing
durable publication or a replacement return reconstructed from checkpoints.

The returned core Publication and counters are pretransmission snapshots.
Terminal separately binds the acknowledged frame/result/descriptor and late
transport state. Forecast/artifact eligibility requires that actual outer
evidence plus matching terminal, EOF, exit and cleanup. It cannot demand that
the earlier immutable result already contain its future ACK, and it cannot use
a passive JSON assertion as proof of the coordinator's execution premise.

Budget snapshots identify their prefix explicitly. Prior completed-session
work is fixed within a session and is used once for aggregate admission;
current numerical counts remain session-local. Store and transcript snapshots
are global nonrefunded observations, never per-session values to sum again.
The containing frame is charged after its pre-encoding snapshot. Reserved
outgoing originals and actual completed writes remain different observations;
remaining milliseconds cannot extend the original cooperative deadline.

Compensation carries a bounded query-only, nonrecursive original plan, complete
actual return and pre-target state/prefix. Admission must check the actual
applied revision and derive descendants/replay; no producer verdict replaces
those checks. The original 1 MiB plan limit can refuse large history.

The M5 route is exactly four ordered dependent sessions under one Store,
deadline and work/transcript ledger, with P=0. Each complete plan is admitted
after its actual dependencies exist and before launch. Failure stops the
route; no skipped session, replacement artifact, quota reset or hidden child
evaluation is authorized. These requirements leave a finite implementation
and comparison task without expanding the numerical contract or old streams.

## Implementation obligations

The peer and core still need exact compiled codecs and source tests for these
boundaries: private admitted handles, bounded full result publication, matching
ACK before apply, actual Commit observation, snapshot correspondence, complete
failure prefixes and immutable exposed collections. The later public API
review uses the repository's advisory public-api-designer blueprint under
AGENTS.md's pre-v1/no-consumer rule; no generic plugin interface or human
approval requirement is introduced by that role.

The retained documentation quick gate exited 0 with all 16 checks passing.
Its four command/output/completion records are separately listed in the same
manifest. This gate does not establish any numerical or protocol execution.
