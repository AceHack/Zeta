# Guarded controller: native-dependent replay evidence audit

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded committed-byte and retained-association acceptance

This audit binds evidence `cb86d8085a2f9c0e86ccb99c28c35915867d6097`
and follows the [source review](2026-09-08-hidden-switch-compiled-native-replay-review.md).
The [stdlib-only audit](hidden-switch-compiled-validation/2026-09-07/native-replay-independent-audit/audit.py)
and [complete result](hidden-switch-compiled-validation/2026-09-07/native-replay-independent-audit/result.json)
check committed/current stored bytes, decompressed identities, source blobs and
retained result associations without importing or executing the replayer.

| Bundle | Records | Stored bytes | Original bytes | Manifest SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Initial e2dde77 capture | 104 | 3464338 | 72103126 | 321E32AD0B4487D61CE3A751243912886F478D5E620C96934C388D99B893F22A |
| Repaired e4946ec capture | 106 | 5338702 | 113048682 | E1208AA382BA11BA35AD9D2232C90A5D6D40C893FB124FC386EC32EFBA5FA4F5 |
| Original native reports/bindings | 32 | 21693 | 44465 | C4505D6FEE13A1CFCCB20012A832298A61F15BFB414103225E4F782BD3B7FC3D |

Each capture's 15 Python source/test pins match its immutable source cut. Its
14 recorded loaded-source observations agree with that roster. Three native
boundary snapshots in each capture match the immutable native source at
34b4395175cd58ee2caba179e6061e54521673f6. The 32 copied native input
artifacts also match the original preserved compressed bytes and decompressed
reports/bindings. These comparisons do not re-establish the old native launch
or imply that the copied boundary is the currently executing study binary.

All 160 public-result references resolve with exact lengths/hashes. The 38 cases
contain 74 producer slot returns: 43 Dispatched results and 31 NativeCallPending
requests. The 43 complete actual result trees match the recorded result bytes.
The 31 independently supplied full reports are exactly the original reports,
not newly generated native output. Complete replay retains 43 Python matches,
31 native comparisons and 38 matched cases; Pending retains 43 Python matches,
31 pending slots and seven matched cases. Missing final native evidence retains
31 returned Python calls, 30 native comparisons and 30 matched cases before its
fixed failure. Every matched call's actual and recorded encoded bytes agree.

The three normal replay output byte strings are identical across initial and
repaired source. The repaired capture additionally retains two actual injected
normal-return failures with started/returned/matched counts 1/1/0 and the
complete failing observation. Those fixture replacements are not completed
scientific operations. The capture's mixed provisional prerequisite bindings
remain explicitly unsuitable as proof of complete joint source/runtime custody.

My first local audit stopped at an unlocated hash assertion; its script and
stderr are retained. A diagnostic repeat did not reproduce that hash refusal,
but exposed an auditor assumption about the pending DTO's name. I corrected
PendingNative to the actual source-defined NativeCallPending and retained that
second failed script/stderr too. The final complete audit passes. No cause for
the first unlocalized assertion is established, and no source defect is inferred
from these reviewer attempts.

This acceptance is limited to the checked committed evidence and associations.
It does not rerun policy, native calls, fixtures or the Python replay, and does
not admit the complete 92-case envelope, source-to-runtime relation, call closure
or any registered measurement. Original implementation failures remain failed.

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
