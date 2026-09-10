# Mixed-message peer lifecycle: independent source and custody review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade independent source review
Lifecycle: active
Disposition: accepted bounded peer lifecycle source and development custody
Work item: 081M1Z63YMC087G0R003N5FH9X

## Exact reviewed cut

This review binds `d16bafa2a71e503878d645a8ea4f52244b5c227b` and its single peer
source: 99,661 bytes, SHA256
`5D0DD505F3849D7F989982DCAE5EBAB2898B8140AE74489540EC016B15AD7795`.
The immutable Git bytes match the source read during the owner's unchanged
validation gate. This extends the earlier
[foundation review](2026-09-08-mixed-message-epoch-peer-foundation-review.md),
which explicitly did not accept the then-missing lifecycle. I read the complete
lifecycle additions, the foundation changes and their transport connections.
No new peer, core, codec, numerical service or fixture was executed for this
review. The owner report is an implementation account; this is the separate
review disposition.

No additional source defect was established within this bounded pass. Admission
still depends on the independently supplied source/service manifest and the
coordinator's actual process/Store observations. Source hashes do not establish
transitive execution, in-memory image identity or numerical correctness.

## Lifecycle and failure retention

The peer admits Start and its direct source/compiled context before Ready. Its
fixed callback ports retain actual inputs, codec returns, decoded ACK/response
candidates and callback outcomes before subsequent checks. A stored successful
proposal creates the one Commit obligation; a stored refused observation does
not invent an application. The core owns the actual state swap. A later Commit
publication failure retains that actual committed state and callback input.

The actual returned Task and EpochResult are held before source reobservation,
encoding and publication. EpochReturn hashes the exact core encoding, separately
from the complete frame/LF identity. Its acknowledged Store descriptor then
links the later Terminal. The original core failure/counters/Publication remain
unchanged; post-return transport status is a separate observation. A failed
allocation's sequence gap can expose the actual return and still refuse closure.
The coordinator must preserve that return before the independent gap judgment.

A partial or unknown output write latches the channel closed to later frames.
Borrowed streams are not disposed while pending I/O can own them. Their tasks
and buffers remain in the local holder, including late unadmitted input. The
peer Complete value describes its publication, not direct-child/pipe closure;
EOF, exit and cleanup are independently observed by the coordinator. Standard
entry retains the actual peer result in process memory and emits only a bounded
separate command diagnostic on failure. An absent actual core return does not
produce a fabricated epoch or terminal state.

Coordinator BudgetSnapshot values replace global prefixes and are tied to their
containing input frame. Repeated local Snapshot callbacks reobserve the existing
carrier and cannot refresh its deadline or add its global counters again. The
peer separately charges full outgoing originals and first observed incoming
bytes. These are retained-position/cooperative bounds, not an OS quota or peak
memory guarantee. The source report explicitly excludes catastrophic allocation
failure and arbitrary substituted callers.

## Independent retained-data audit

The owner development manifest at the same commit is 40,991 bytes, SHA256
`E665EBCF365E134326D48263C08C2AA722D6FD794895A3F545707C5C4CFBD7D6`.
I independently checked all 96 stored gzip records, every decompressed identity,
every local original and all seven source pins: 1,382,782 original bytes and
323,580 stored bytes. The read-only audit exited zero. Its exact script,
invocation, stdout, stderr, completion, reviewed source, immutable pin and owner
manifest are preserved in the [review custody](mixed-message-peer-lifecycle-review/2026-09-08/README.md).
The owner's DLL observations remain historical producer observations; this
review did not perform a new assembly or runtime measurement.

The archive retains the original compilation/harness refusals before their
corrections, an 11-check synthetic callback pass, two separate eight-check
lifecycle passes and standard empty-input/extra-argument invocations returning
exit 2. I read the harness's actual zero-entry and scheduler assertions. Its
successful core cases use an admitted zero-operation graph and observe the
actual scheduler returning Ok 0; some failure cases stop before core entry.
These are isolated peer/core development controls. The bridge's nonempty-node
plan boundary and named registered graph are separate admission requirements.
The recorded check summaries and harnesses are not full serialized EpochResult
receipts for every case; actual held objects have their stated process-lifetime
retention scope.

The peer owner's full repository gate was still running when this source cut
was pinned. This review does not invent its final outcome or reassign later
checks to earlier source. Any subsequent core model/withdrawal repair needs the
corresponding assembled source/build binding. Final independent service-manifest
admission and the coordinator's registered M4/M5/frozen-query controls remain
necessary before an actual mixed-message result is claimed.
