# Guarded controller: sequential record-store review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source and retained implementation evidence accepted

This read-only review binds source/test commit
`f45a7aca501e2dc5125b5f3863ecb83862780eb0` in the independent reference writer.
The record-store module is 20,305 bytes, SHA-256
`75ba7825f7e925460b411c977c4f9f4f34d55ba40383b4f47482c1db652e1008`;
its test file is 27,249 bytes, SHA-256
`994137f9a83008649cb21d891c6bdafb3f06b090e7d6988f492785b50809a10e`.
Both current files match the committed bytes. I read the complete source,
tests and validation report. I executed no fixture, test, policy, native
process, registered source stream or measurement.

Opening calls the actual exclusive directory helper once and issues a handle
only after the expected typed return. Existing or ambiguously created paths
are not adopted, deleted or retried. Normal names are ordinal paths beneath
the owned attempt; role strings cannot redirect them. The immutable ledger
contains earlier admitted descriptors and attempted records. Caller-owned
values remain observations by reference, with stable values and sequential
access as explicit premises. Handle issuance is not a hostile-Python boundary.

The 256 MiB ceiling covers combined raw and stored reservations. The reserved
8 MiB final-journal budget is split into 4 MiB for each identity copy, and its
slot counts toward the 4,096-artifact ceiling. The encoder receives half the
remaining normal quota before expansion. A write begins only after its slot
and both exact byte reservations are charged; failures never refund them.
Small-limit tests distinguish the two charges, unavailable slots, empty files
and the inability of a normal record to consume the final reservation. These
are retention bounds, not caller-input, filesystem-quota or peak-memory claims.

Every saved descriptor requires the actual exclusive write and exact bounded
read-back. Wrong counts, wrong bytes, typed helper refusals and raised helper
exceptions remain separate actual observations. The ordinary Exception catch
preserves type/message and leaves Returned empty; it does not assert that an
interrupted helper returned a result. The first normal refusal stops further
normal work while preserving the supplied actual operation value. Serialization
does not execute that operation or turn a retained value into an execution
receipt.

Finalization is a once-only attempt using the existing reservation. The final
journal describes the preceding metadata snapshot and cannot certify its own
publication. A failed encoding leaves the exact supplied value in the returned
DTO, with no assertion of durable serialization. Successful byte observations
are summarized by length/hash and artifact links. A final write/read failure
is retained separately from the primary normal failure; repeated finalization
does not overwrite, retry or erase earlier evidence. Finite encoding bounds
can still refuse the journal despite a reserved budget.

I read the final 47-test pass in 4.09 seconds and passing strict source/test
mypy, Ruff and format logs. The original 39-pass/one-failure run is retained:
its fixture counted earlier numeric descriptor reuse during traversal as a
second close of the later file. The corrected witness begins repeat tracking
after the actual file close and injected error. This is an instrumentation
correction, not evidence of duplicate close by the storage implementation.
Other fixtures discriminate actual partial writes, fsync errors, real close
followed by an error, primary-plus-cleanup failure, modified read-back bytes,
collisions, unexpected returns and once-only finalization.

I independently checked all 46 compressed/original identities in the lossless
validation manifest, five current source/test pins, sixteen captured public
result references and nine owned file references. The five bounded filesystem
captures cover success, a four-byte partial prefix, quota refusal, final-file
collision and ambiguous post-mkdir refusal. The report correctly distinguishes
its outside-harness serialization of returned DTOs and deliberate collision
file from the tested stores' own reservations. The original partial bytes and
failure outcomes remain present.

No additional material source or reporting issue was found. This accepts the
bounded retention prerequisite only. Source/runtime admission, complete outer
outcome replay, the 92-case recorder, scientific phase admission and costs are
separate obligations. The author owns publication and canonical indexing of
this review alongside the retained validation.

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
