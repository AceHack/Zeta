# Guarded controller: actual file replay evidence review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded actual capture inventory and correspondence accepted

The [accepted file replay source](2026-09-07-hidden-switch-compiled-file-replay-review.md)
remains `e6238f8acc89c4d619c6631f0cb0111aa9258c20`. This independent evidence
audit binds the root writer's capture manifest by exact bytes: 53,477 bytes,
SHA-256 `39899B118BD2C60F9BFC3BC69BE027A29741A60D6CA41A60C0D2EADD08B18CB5`.
The capture evidence was still awaiting its author's commit when inspected;
this review does not invent a publication commit. Root owns its final import
and index. No fixture, policy, source stream or measurement was rerun.

The retained [audit script](hidden-switch-compiled-validation/2026-09-07/file-replay-independent-audit/audit.py)
imports no task modules and operates only on retained files, source blobs and
archive metadata. Its [result](hidden-switch-compiled-validation/2026-09-07/file-replay-independent-audit/result.json)
records the following verified associations:

| Evidence | Independently verified result |
| --- | --- |
| Lossless artifacts | 132; 2,896,475 compressed and 44,122,574 original bytes |
| Available direct original records | 111 byte matches; remaining archive/source associations checked separately |
| Initial/final source versions | Eight immutable file blobs match their retained copies |
| Actual capture source roster | All 95 pins match source e623 and current files |
| Owned tar/inventory trees | 12 trees, 2,546 entries, 33,929,084 regular-file bytes |
| Full store-return receipts | 56; 33,339,959 separately retained bytes |
| Actual producer/fresh operations | Eleven each; full result and recorded-byte associations match |
| Fixed cases | Seven complete matches |
| Final journal | 83,017 bytes; exact descriptor, encoder, read and write receipts match |

Every gzip stored and decompressed identity was checked. Each inventory entry
matches its tar member and current owned lstat facts; regular bytes and symlink
targets match without extracting the archive. The two FIFO fixtures are checked
only by lstat and tar type, never opened. The first audit attempt did not yet
admit the inventory's explicit other-kind FIFO entries and refused there. Its
[source](hidden-switch-compiled-validation/2026-09-07/file-replay-independent-audit/audit-attempt-1.py.gz)
and [failure](hidden-switch-compiled-validation/2026-09-07/file-replay-independent-audit/attempt-1.stderr)
remain retained. The corrected metadata-only audit passed; this was an audit
coverage limitation, not a file replay defect.

For all 56 store calls, the independently read complete Stored return names the
same artifact as its attempt descriptor. Actual encoder and read return bytes,
write counts, supplied values, sequence and role match the retained record.
The seven complete FileReplay values include their actual preparation and call
observations. Their recorded inputs refer to the corresponding producer records;
eleven producer outcomes equal the actual fresh outcomes and both retained
comparison encodings. The outcome sequence is file-read, artifact-gzip, two
admissions for control, admission/existing-output for each reuse case,
file-write/existing-output for partial write, and file-changed for changed read.

The finalization receipt has no primary failure, retains 57 artifact slots
including its journal, and binds the journal's complete 56-record prefix.
Its encoding/read bytes and write length match the descriptor and actual file.
The capture harness calls finalize once. The separately encoded outer capture
receipt and 33,339,959 bytes of complete store-return receipts are outside the
store and explicitly bounded by the capture harness; they are not charged as
if they were ordinary record-store payloads. No exact process-memory bound is
claimed.

The source-reviewed filesystem projection intentionally permits the enumerated
OS identity variation across fresh roots; this audit checks the actual retained
associations and results, without rerunning that projection or promoting JSON
to proof of original host execution. Original failures, including the initial
encoding and overlap witnesses, remain in the lossless inventory. Full outer
conformance, source/runtime admission and registered study execution remain
unperformed by this slice.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
