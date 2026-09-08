# Guarded controller: actual identity replay inventory review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded capture inventory and associations accepted

This review binds evidence commit
`5a75a5eb05518394450dfd3631d0e27523b456c9` and unchanged source
`d3bd541e1d043e199c4b54b5390450028473c1cd`, already covered by the
[independent source review](2026-09-07-hidden-switch-compiled-identity-replay-review.md).
The manifest is 25,132 bytes, SHA-256
`A79B42D54F9D195EE3AFDEB8CCFFC3A7132060CE2E159481541950B359DB3319`.

The [independent audit script](hidden-switch-compiled-validation/2026-09-07/identity-replay-independent-audit/audit.py)
ran only retained-file, source-blob and metadata checks. Its
[result](hidden-switch-compiled-validation/2026-09-07/identity-replay-independent-audit/result.json)
records all 68 gzip stored/decompressed identities: 9,014,517 stored and
74,728,326 original bytes. All twelve source pins match the immutable source
commit and current files. Four tar/inventory pairs match every available
original regular file, directory mode and symlink target without extraction.

| Retained owned tree | Regular files | Regular bytes | Symlinks |
| --- | ---: | ---: | ---: |
| Separate actual capture | 976 | 2452262 | 2 |
| First test attempt | 3689 | 10068327 | 21 |
| Expanded test attempt | 3730 | 10088110 | 23 |
| Final test attempt | 3730 | 10088110 | 23 |

These aggregate test-tree counts are not one fixture's resource cap or
scientific sample counts. The earlier test expectation failure remains
historical evidence; archive integrity does not reclassify its result.

All 32 public-result references match their complete retained bytes: fifteen
producer fixtures, the recorded-case tuple, the full replay and fifteen fresh
fixtures. The replay embeds exactly those recorded rows and actual fresh
returns. Its counts are fifteen starts, fifteen returns, fifteen completed
operations and fifteen matched cases. Every case/operation/role and independent
producer/fresh root association agrees with the capture's fixed roster. Source
case results compare exactly with their producer records. For Python cases,
original and fresh child bytes match their recorded/same-descriptor read
observations, stdout agrees with its own collector result, both trace rows bind
the correct case and result, and stderr is empty. Positive raw PIDs match the
explicit retained associations.

Ten observed loaded-module source pins and the two supplied child-source pins
also match their retained files. These are capture observations, not a complete
Python entry/loader/runtime admission. I read the source-fixed capture harness
and report, which distinguish these scopes. I did not launch fixtures, Git or
Python children, policies, sources, native code or measurements; no task modules
were imported by the audit. Exact cross-root normalization remains established
by the accepted implementation and its recorded result, not by a second replay
execution in this review. Complete outer/source/runtime admission stays open.

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
