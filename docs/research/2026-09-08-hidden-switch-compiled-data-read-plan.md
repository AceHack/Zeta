# Guarded controller: proposed finite cell and literal reads

Date: 2026-09-08
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: proposed finite roster; no new memory read

The [retained transfer inventory](2026-09-08-hidden-switch-compiled-transfer-inventory.md)
identifies 43 distinct unknown call-cell addresses and ten prospective
literal addresses. This proposal would inspect only those 53 named ranges:
43 eight-byte cells plus 152 literal bytes, 496 bytes total. Actual inventory
artifact review is still pending. No new read, target, metadata-helper or
decoder invocation is authorized by this document.

## Roster before a read

Derive a separately hashed, ordered roster from the 130 method files in
inventory evidence `a489e850847e240e131e502aa745c69899a146ba`. The manifest
is 56,373 bytes, SHA256
`87CCFFFF3EDBA26779FD00A936D8CF6EF6616B6745817EAF59611CE335208555`.
Its exact compressed/original record identities, method/word associations
and all false admission flags must be checked before deriving any address.
The derivation opens archived JSON only, never the dump.

For cells, select only supported static shapes with
`PhysicalValueReused=false`; retain all 134 site references grouped by the
43 unique addresses. Each reference keeps role, offset, original word,
construction words/registers and compiler/decoder text. The requested size
is exactly eight bytes. No current pointer value or target identity is
invented in the roster.

For literals, retain all ten opcode-driven records with supported eight-
or sixteen-byte width, unique compiler label and exact expected byte string.
Their 152 bytes are compiler declarations, not already observed physical
data. Preserve method/offset/word and declared label at each of the ten
addresses. A prospective literal outside the code spans remains valid data
planning, not an invalid code target.

Order cells first and literals second; within each kind, sort by unsigned
numeric address. Preserve each range's site references in original mapped
method order and ascending word offset. After grouping exact repeated cell
references, require every selected interval to be pairwise disjoint,
including same-kind partial overlaps as well as cross-kind overlaps.

Require canonical uint64 addresses, checked interval ends, exact order and
counts, and no conflicting width/value declarations for a repeated address.
The final source and hashed roster need independent
review before a physical reader can accept them. A roster mismatch refuses;
it does not expand the allowed ranges.

## One held local dump, no chained query

The proposed physical file is the already captured local-only dump 2:
6,208,508,456 bytes, SHA256
`7584B8D3E56DAFA79CAE8C954C03C2587AC25134CAA970F67CE530FDE17D3709`.
The original target is closed. No new capture, target run, attach, ClrMD/DAC
query, heap/stack/object inspection or symbol lookup belongs to this step.

The reader should use one held regular descriptor for exact-size bounded
hashing, Mach-O header/segment admission and every selected physical range.
It must reject a different size/hash, unsupported format/flags, ambiguous
mapping, overlap, absent backing, zero fill or short read. The existing
reviewed physical parser's metadata reads remain explicit; full-file
hashing reads the complete file. Do not describe this as reading only 496
bytes overall or as a kernel-enforced I/O/time quota.

Only the exact predeclared intervals may be read as selected data. An
eight-byte cell read yields a recorded little-endian uint64 target value,
which is metadata alone. Zero/unaligned or otherwise unassociated targets
remain explicit unresolved observations. They authorize no target-code,
second-cell or object read. Membership in a previously retained code range
can be computed from existing metadata but cannot establish that a dispatch
executes or that all possible targets are known.

For each literal, compare the actual selected physical bytes exactly with
its declared expected bytes. Retain the successful physical-read metadata
before comparison. A mismatch is a typed refusal with the observed hash,
expected hash and locator; stop subsequent dependent reads and preserve the
actual prefix. A match establishes only that specific literal-byte
correspondence in this captured process image.

Publish only bounded range metadata: address, file offset, byte length,
hash, associated input references, declared literal expectation, comparison
result and decoded cell target where applicable. Raw range bytes remain in
the local dump; do not ingest or publish broader process memory. Per-range
records must exist before later parsing/comparison/publication can fail.
An independent final report retains the first failure and active available
record if the journal breaks. Cleanup/reporting errors stay separate.

## Limits, falsifiers and remaining scope

The implementation must declare finite hash/read deadlines, source and input
identities, per-record/aggregate output caps and independent terminal reserve
before review. Its outer diagnostic invocation must retain the exact command,
source/runtime identity and bounded completion or failure. Stable-writer and
immutable-captured-file premises remain distinct from hostile namespace
isolation, atomicity, general process quiescence and OS resource limits.

Required fixtures include:

- Changed inventory/roster identity; omitted, extra, reordered or duplicated
  ranges/site references; width/hex/address overflow and conflicting expected
  bytes; exact same-dump association and no fallback to another file.
- Wrong file identity, unsupported/ambiguous/zero-filled backing, selected
  short reads and the already recognized `SG_HIGHVM` boundary.
- Correct little-endian pointer decoding, zero/unaligned target retention and
  proof that the collector issues no chained target read.
- Actual literal equality versus mismatch, with the actual read locator/hash
  retained before refusal and no further dependent range read after it.
- Failed checkpoint/close/final publication retaining the original failure,
  completed range prefix and active available record within explicit bounds.

This would not settle the 39 unsupported indirect dependency shapes, 468
outside direct-call sites, all possible target sets, framework/dynamic
callee behavior, nine unprepared/nine extra blocks, GuardSet object/register
association, arithmetic effects or exception/unwind coverage. The three full
admission flags remain false even if all 53 selected reads complete and all
ten literals match. Further callee/range work needs a separate reviewed
proposal and authorization.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
