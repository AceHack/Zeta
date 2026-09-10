# Mixed-message peer: bounded callback and lifecycle implementation

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, peer implementation owner
Operational status: research-grade implementation development
Lifecycle: active
Status: bounded peer source review accepted; assembled scientific admission pending
Work item: 081M1Z63YMC087G0R003N5FH9X

The [single peer script](../../src/Research.FSharp/MixedMessageEpochReplay.fsx)
now invokes the actual compiled epoch runtime, connects its storage/service
callbacks, and publishes its complete actual return. This extends the earlier
[framing and source checkpoint](2026-09-08-mixed-message-peer-direct-source-admission.md),
whose historical tests did not invoke runEpoch. The imported core is exactly
`15b43aa7271d100842c198a4378eef717e4acef8`, mapped locally by cherry-pick to
`746636e07`. It remains an incomplete scientific-control checkpoint; this peer
implementation does not admit the remaining core model/compensation controls.
The original contract, transport amendment, identity conventions, fixed
numerical inputs and named control roster are unchanged.

## Fixed entry and transport

The complete production argv is the independently admitted dotnet host,
`fsi`, `--quiet`, `--exec`, and the absolute admitted peer script, in that order.
There are no additional script arguments. Standard input carries one Start;
standard output contains only the fixed NDJSON protocol frames. A direct script
entry runs one session; loading its declarations through a local FSI harness
does not start a session. Exit 0 requires complete transport publication and a
completed core result. Exit 2 reports a typed refusal or handled peer failure;
an actual host failure remains independently observable by the coordinator.

Before Ready, the peer observes the actual script and three directly loaded
DLL file locations/hashes, admits the exact flat source map and complete plan,
and binds the initial budget carrier. FSI has already resolved its three local
references by this point. The coordinator's independent prelaunch source/file
admission is therefore load-bearing; the peer check does not retroactively
prove which instructions or initialization ran before it. After the actual
core return, the same four source observations are repeated and retained.
Neither observation is a transitive loaded-module or in-memory image proof.

The inherited finite byte/frame limits, same-descriptor macOS file reader,
first-byte incoming count, full outgoing reservation before write and no-refund
accounting remain in force. New Start/ACK/response snapshots must advance and
include all previously observed positions, excluding only their containing
frame. Local Snapshot callbacks revalidate the exact last admitted snapshot;
they do not refresh a clock, extend a quota or invent current global totals.
The outer coordinator owns the complete route deadline and process closure.

## Actual callback ownership

The private callback context retains each actual checkpoint, Commit and
projection request on entry. Its closed call ledger retains complete actual
codec returns, frame construction, I/O returns, parsed and decoded ACK/response
candidates, snapshot validation, callback outcomes and raised exceptions before
subsequent judgment. Source type names never select an implementation.
Projection responses remain passive data until the core separately checks the
complete Native/reference/proposal correspondence. A malformed or partial
response remains raw evidence; its received byte count/hash survives an EOF
refusal without becoming a parsed response.

Checkpoint writes use 64 KiB ordinarily and the declared 16 MiB limit for the
actual GaussianBlock operation. The ACK must bind its sequence and the complete
original frame including LF. Its unchanged actual Store descriptor must use
identity encoding and match original/stored lengths and hashes. The peer reads
no descriptor-named file. The coordinator's real Store/ACK route remains the
storage premise. Only an admitted proposal creates a pending Commit obligation;
a stored failed observation has no application and no invented Commit.

The core, not the peer, performs the immutable state swap after the successful
checkpoint callback. The peer then writes the actual Commit supplied by the
core and checks its stored sequence/hash correspondence. A failed Commit does
not undo an already applied state or erase the actual callback input. There is
one sequential callback owner and no generic RPC, retry, worker or scheduler
injection surface. The runtime's private admitted handle owns its actual
operational sequence allocations.

## Returned result and late failures

`runPeer` supplies these fixed callbacks to the actual tuple
`MixedMessageEpoch.runEpoch(admitted, service, recorder)`. It retains the actual
returned Task and EpochResult object before source rechecks, encoding or final
publication. A fault or cancellation with no returned EpochResult stays an
actual raised outcome; the peer never fabricates epoch, scheduler or committed
history for it. The independent local PeerRunResult retains the raw transport
and callback holders as well as all final publication attempts.

After the actual core return, one administrative EpochReturn uses the private
handle's next sequence. Its ResultSha256 hashes the exact canonical encoding
returned by the core; its frame hash additionally includes the fixed envelope
and LF. The return cannot contain its future ACK. The existing ACK admits its
stored descriptor, while Terminal independently links the result/frame hashes,
Artifact, latest coordinator snapshot and late peer transport counts. Original
core counters, failure, scheduler return and Publication snapshot stay unchanged.
A complete refused core result is still retained and published as that refusal.

A failed unpublished core allocation may leave a sequence gap. The peer can
publish the actual later return through intact I/O; the coordinator must retain
an admitted complete return before separately refusing the gap. Successful and
forecast closure still require contiguous frames. No missing checkpoint is
reconstructed. Failed or pending transport can prevent return publication;
the actual result then remains memory-only for this process lifetime.

Terminal is attempted only on an intact output boundary. A partial or unknown
write forbids any later frame. A known complete response/ACK refusal can still
produce a terminal with the late transport failure separate from the original
core result. Standard streams are borrowed and not disposed while an operation
may still own them; pending tasks/buffers remain in the local holder. The outer
coordinator must observe EOF, exit and its cleanup separately. The peer's
Complete flag is not process closure or a scientific-control verdict.

Stderr contains at most one bounded command diagnostic on a handled nonzero
entry outcome. It reports availability, not a reconstructed scientific result.
Its own publication failure is separately held. No promise covers catastrophic
allocation failure, hostile namespace mutation, arbitrary source-substituted
callers, or loss of all process memory without a completed frame/Store record.

## Retained development observations

The [development manifest](mixed-message-epoch/2026-09-08/peer-lifecycle-development/manifest.json)
retains the executed sources, harnesses, argv, complete outputs, original first
failures and later outcomes. The imported runtime build passed with zero
warnings/errors; no test or numerical workload was part of that build.

The callback declaration first failed F# record inference on a list-valued
Calls field. The correction explicitly types the private context. A later
source compile needed an int annotation on the bounded diagnostic helper.
Harness-only failures included an unparenthesized call, an obsolete target
record field name and duplicate top-level fixture binding. The first complete
callback run passed all 11 controls. They discriminate actual ACK-before-Commit
frames, refusal snapshots, original decoded return retention, partial-response
EOF bytes and duplicate-sequence rejection with synthetic stream counterparts.
No runEpoch, learner, kernel or numerical service entered those controls.

The first lifecycle declaration compile rejected a qualified F# record label;
the next rejected an unannotated optional return-reference record. That same
second diagnostic also stopped the first lifecycle harness before execution.
After correction, all eight lifecycle controls passed. These invoke the real
core scheduler on an admitted zero-operation plan and synthetic in-memory I/O:
Ready, actual EpochReturn, ACK and Terminal; exact returned Task/object and
canonical result/frame identities; late ACK failure; partial Ready, return and
Terminal writes; unexpected arguments and empty input. Every returned core has
zero scheduler-handler, kernel, forward, learner and projection entries. Its
actual scheduler return is Ok 0, not an invented observation.

The eight controls passed again after adding the guarded standard entry, which
also confirms that harness loading remains inert. Those are separate retained
runs. No actual named M4/M5, frozen nested query, native scalar/reference call,
external peer/coordinator route, data read or training observation is claimed.
Dedicated empty-input and extra-argument standard invocations are retained
separately from the in-memory checks. Final source review and assembled gates
remain required before the coordinator opens any named route.

## Final source gate and independent disposition

The immutable peer source is `d16bafa2a71e503878d645a8ea4f52244b5c227b`:
99,661 bytes, SHA256
`5D0DD505F3849D7F989982DCAE5EBAB2898B8140AE74489540EC016B15AD7795`.
Independent lifecycle review is signed at
`95d7dca78e771089237fec60eceba45482d1558c`; it checked all 96 stored, raw and
local original development records and all seven source pins, without an
additional peer/numerical execution. It found no further bounded source defect.
The review explicitly distinguishes held objects and test assertions from full
scientific receipts. Its normal preservation push and exact remote were verified
by its owner. This peer writer does not substitute that for assembled admission.

The [separate gate archive](mixed-message-epoch/2026-09-08/peer-lifecycle-gate/manifest.json)
retains the full preflight invocation and original outputs: exit 0, all 18
executed checks passed, including Release build and the full test suite. All
seven before/after source, test and project identities remained unchanged.
The gate began on the working bytes before their d16b source commit; the
record binds those exact bytes, rather than claiming d16b was already HEAD
at launch. Later prose/review commits did not change the admitted source set.

`dotnet format --verify-no-changes --include` for the peer path exited 0 and
left its source unchanged, but explicitly reported that F# projects are not
supported. This is a retained formatter limitation, not a verified F# formatting
claim. FSI compilation, focused controls and the repository F# lint are the
actual source checks reported above. The final quick push gate covers the
subsequent documentation receipts separately. This gate remains scoped to
core15b43; later core model/withdrawal corrections require their own final
source pins and assembled gate. No named M4/M5 or nested query is admitted
by these results.
