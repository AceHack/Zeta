# Projection comparison and retention: bounded design review

Date: 2026-09-08 UTC
Operational status: research-grade design recommendation
Status: implementation source review still required
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

Use one sequential adapter over the
[accepted fixed case plan](2026-09-08-projection-case-adapter-independent-review.md),
the existing issued record-store handle, independently expected source/input
bindings and three coordinator-supplied service callbacks. This needs no new
general execution framework or producer-selected dispatcher. The frozen
40-ID/88-slot roster, expected outcomes and numerical thresholds remain
unchanged. No adapter implementation or experiment was run for this note.

## Minimum observation boundary

Each fixed slot has its index, outer case ID, service operation and exact
input-role descriptors. Retain actual preparation and input bytes before
dispatch. Immediately after the callback returns or raises, append its full
observation to the in-memory ledger before parsing, encoding, comparing or
starting another slot. A normally returned None, malformed object, launch
failure or ReceiptFailure remains an observed normal return; it is not
silently changed into a raised operation or a complete registered receipt.

Native observation needs actual launch/child/exit/stdout/stderr/cleanup facts
separate from the returned report bytes. The callback owns its one process
and returns its complete bounded observation on both success and failure.
The outer adapter cannot reconstruct a child's lost prefix from an exception
alone. Native exit status is admitted against the reviewed Replay's explicit
outcome convention; a nonzero typed refusal is not automatically a crash.
No callback or receipt establishes source-to-machine correspondence.

Keep distinct counts for entered callbacks, normal returns, raised callbacks,
started/closed native children, admitted complete receipts, durably retained
receipts and checked slots. A failed launch can increment callback-return
count while contributing no completed native receipt. A Python ReceiptFailure
retains its full actual in-memory receipt while its encoding admission fails.
Expected typed numerical refusals and NoCandidate outcomes remain actual
results, with core viability and expected-control satisfaction assessed
separately from collection completeness.

## Storage and first failure

Open the existing store once with 256 MiB combined raw-plus-stored quota,
8 MiB final-journal reservation and 512 artifact slots. The service result
limit remains 2 MiB. `append_result` alone uses the store's remaining quota,
so enforce the per-result limit with the existing bounded encoder before
`append_bytes`. Retain the complete actual result before that encoder call,
then retain the actual encoder and store returns before any subsequent step.
Native report bytes can be stored once with process metadata linking their
exact artifact identities; an in-memory actual callback observation must
not be silently replaced by a summary.

Each in-memory call entry can contain input associations, actual callback,
encoder, store and comparison observations. Do not repeatedly serialize
Stored/StoreFailed snapshots inside every new artifact: those snapshots
already refer to earlier supplied objects. Keep the complete helper returns
in memory and let the final disk envelope reference the independently stored
records once. Fixed roles and indices determine paths through the existing
store, never producer-supplied filenames.

A first infrastructure, encoding or retention failure stops new ordinary
service work. Preserve that primary failure, active slot and completed
prefix; cleanup, terminal publication and finalization errors are separate
secondary observations. The finalization attempt is once-only.

Existing `finalize()` serializes the store's Snapshot, not arbitrary adapter
state. If encoding fails before an append, the unencoded callback result
is memory-only unless separately retained by an explicitly declared path.
If a durable coordinator terminal summary is needed, reserve a small fixed
normal-pool byte budget and one slot for one bounded metadata append while
the store is healthy. That summary identifies admitted records and the
unencoded boundary; it does not pretend to contain the full failed result.
After StoreFailed, only the existing once-only store finalization remains.
Neither terminal attempt can replace the original primary failure.

## Certified-baseline dependency and final disposition

Latch the certificate-control baseline only after the actual
core/unconstructed native receipt, reference return and CertifyNative
Certified outcome are independently input/source-bound and durably retained.
Keep its exact original native bytes immutable. Every one of the twelve
controls derives afresh from those bytes, retains the mutation helper's
actual return, then invokes CertifyNative once. Missing or uncertified
baseline leaves dependent slots unexecuted/incomplete; a unit fixture cannot
substitute for it. Rounding-absorbed +1 mutations are retained as observed,
not replaced with more convenient perturbations.

The final run envelope should distinguish complete roster collection,
expected-control satisfaction, the twelve-core viability criterion, pending
slots, first failure and storage/finalization status. Its inputs, service
outcomes and baseline are exact artifact references. These are finite local
engineering results; runtime closure, learning, global posterior accuracy
and benchmark performance are not inferred.

This recommendation follows a read of the existing record-store public
types and append/finalize boundary, and the frozen contract. It does not
change either implementation. Exact source review must check actual callback
entry sites, counter placement, terminal reservation, source-fixed dispatch
and failure retention before the registered run.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
