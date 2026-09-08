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
artifact review is accepted at `d4aa1f8566c521a9d2c4376a8b3be5160da002f3`.
No new read, target, metadata-helper or
decoder invocation is authorized by this document.

## Roster before a read

Pure helper source `9ce26b4bb6ea05ccdaaac4deef888a5b80fd25ba` implements
the proposed fixed range selection. Independent source acceptance is signed
at `0775085e5dae8bfebe35ddc8ef820103ca75e4b8`. The
[six preparation records](hidden-switch-compiled-validation/2026-09-07/data-range-helper-preparation/manifest.json)
retain eight focused and 77 combined passing synthetic tests, the initial
Ruff import-format finding and correction, and all sixteen passing quick
preflight checks. The initial test log redirection used a wrong relative
path and failed before Python ran; the successful invocation used the
explicit writer test directory. No actual roster has been derived in this
preparation. Its immutable-inventory wrapper and eventual physical reader
still require separate review. The helper's count override is fixture-only;
the actual wrapper must use its fixed default counts.

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

## Metadata-only proposal wrapper

Wrapper source is `a80211d357d548d97caf850f367543abfbf91638`. Its
[seven preparation records](hidden-switch-compiled-validation/2026-09-07/data-proposal-wrapper-preparation/manifest.json)
bind all fourteen source/import files plus two tests to that commit. Twelve
focused tests passed, followed by 73 selected related tests and 89 with the
retained decoder grammar fixtures included. The initial Ruff import-format
finding and fixed pass remain separate. Quick preflight passed all sixteen
executed checks. Independent read-only source review accepted the exact pin
at `7252b7419aedf581982cc61d29ab7c8a4eb988f2`; the actual proposal
observation remains separate.

The proposed file-backed wrapper admits exactly the inventory manifest and
mapped-extent manifest, then 132 selected archived records: the inventory
outcome, all 130 method reports and the mapped helper input. Their manifest
tables declare 7,809,397 original record bytes plus 345,987 manifest bytes,
8,155,384 bytes total. This footprint was calculated from the two manifest
tables only. It is not an actual range derivation. Maximum selected record
sizes are 344,800 original and 60,406 stored bytes.

The wrapper requires the completed inventory's exact source, counts,
read-scope flags, ordered method identities and unresolved rosters. The
selected mapped helper's manifest/stored/original identities must each occur
exactly once in that earlier inventory's recorded input roster. Each method
must equal its mapped current-method metadata and retained complete record.
This reuses the independently audited immutable inventory; it does not repeat
the original 534-record classifier or establish new physical correspondence.
The dump path/size/hash are retained metadata and are never opened here.

The existing retained reader supplies regular nonblocking/no-follow leaf
descriptors, exact-size-plus-one reads, ten-second checked read deadlines,
single-member bounded gzip and strict JSON. Its existing per-record two-MiB,
600-selected-record and sixteen-MiB original-input caps remain in force.
The wrapper pins its two new entry files plus the inventory's twelve local
source/import files and rechecks those identities and selected input files.
These are stable-writer observations; no hostile namespace, kernel I/O
cancellation or complete Python/framework loading theorem is claimed.

Exclusive attempt/journal/proposal/terminal files reuse the reviewed
two-MiB per-record and 32-MiB aggregate output bounds. The terminal reserve
includes the two-MiB main report plus independent sixteen-KiB secondary
report and sixteen-KiB console. Each observed input/source pin and admitted
current method reaches in-memory diagnostics before fallible publication.
The complete pure proposal reaches those diagnostics before recheck/output.
A later failure keeps the first error and separate cleanup/publication
failures; oversized terminal metadata is explicitly omitted with counts and
a refusal. Successful writes are flushed and fsynced. These are bounded
retention attempts, not survival guarantees for storage or abrupt failure.

Only the pure helper's fixed defaults are used in production. The wrapper
has no count override, dump reader, subprocess or target entry point. Final
source review and an exact retained invocation precede the actual proposal;
the resulting roster still needs independent review before any physical
reader may consume it.

The [four launcher preparation records](hidden-switch-compiled-validation/2026-09-07/data-proposal-launcher-preparation/manifest.json)
retain the original unexecuted draft and two reviewer findings: a poll/kill
exception skipped the later join, and final publication could replace an
established failure. The corrected launcher guards poll, kill and join
separately before each owned stream close. It attempts an exclusive terminal
file, independent failure file and bounded console; console failure has its
own separate file. Each terminal channel is limited to 64 KiB. Original
files are never overwritten. Four fixtures compile only these exact
AST-extracted functions and inject failures around real file closes/writes;
they do not execute the child path.

The one proposed launcher checks sixteen source/test identities against the
reviewed source commit, then records exact arguments, execution head, Python
file identity, preparation and its own source identity before its child.
The owned child has a sixty-second checked deadline and a polled 64-KiB
limit on each stdout/stderr file. The launcher rechecks the source pins and
retains PID, exit code and direct-child join outcome. These bounds do not
promise an OS quota or descendant quiescence. Final launcher rereview and
preparation preservation precede the separately authorized metadata-only
attempt; they authorize no physical read.

Two final review refinements are retained in a
[separate three-record preparation](hidden-switch-compiled-validation/2026-09-07/data-proposal-launcher-final-preparation/manifest.json):
an already observed main-wait exit code survives a later cleanup-join
failure, and the bounded console flushes inside its exception guard. Main
and cleanup wait codes are separate fields; a failed join never becomes a
closed-child claim. All five final extracted-function fixtures pass. The
earlier four-test source/preimages remain unchanged in their archive;
stable local copy paths now accompany their original capture paths so later
edits cannot erase the inspected draft. No child ran during these repairs.

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
