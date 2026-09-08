# Guarded controller: decoder comment-column correction

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: actual refusal retained; minimal source proposal, no new execution

The earlier [RCPC source review](2026-09-07-hidden-switch-compiled-llvm-rcpc-source-review.md)
accepted a comment grammar with no leading spaces. That guidance was incomplete:
I described the comment payload without preserving its actual leading-column
bytes. Independent rereading now confirms that all 851 standalone comments in
both retained decoder stdout files begin with exactly forty ASCII spaces.
This reviewer-guidance defect is retained here; the earlier report is unchanged.

Attempt 2 ran source `4a570eaf3ee2d5dccef07b5eeea229a363cd7365` at preparation
head `386783454f0f11328e3ab39dba66a6081dfaf1d8`. LLVM PID 73912 exited 0 with
empty stderr, but the driver refused word 22, a mov x0 immediate 9480 followed
by the padded hexadecimal comment for 0x2508. Two complete methods and twelve
active words survived. The attempt remains incomplete and all full admission
flags remain false. The 659,615-byte stdout SHA-256 is
`b54c1af8e5ff4b59de42efc8ffb60436244e063cf81dd5b208bd20a6bdc872c6`;
the 4,409-byte outcome SHA-256 is
`7f95dc2f834fda3ff0aa0f9db08a3b5b841ebbe9e74e885ea2ab2001435248f4`.

The installed MCAsmInfo.h exactly matches the LLVM 23.1.0 public header: 28,940
bytes, SHA-256
`80841616357f00bba7ab16d1d1f1f038f9858769033168b1d2899440f813405e`.
Its [default comment column is forty](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/include/llvm/MC/MCAsmInfo.h#L422).
The [streamer pads each comment line to that column](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/MC/MCAsmStreamer.cpp#L588);
[FormattedStream emits spaces](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Support/FormattedStream.cpp#L125),
and the [Darwin target selects a semicolon](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/MCTargetDesc/AArch64MCAsmInfo.cpp#L143).
This explains the observed next-line padding. Version-tag source remains
guidance, not proof of the installed executable's build provenance.

The proposed correction is only an exact forty-space prefix before the existing
hexadecimal comment grammar. It must preserve the complete raw comment and
retain the prior mov association, width/value, cardinality and byte checks.
A fixture should consume the actual retained pair; zero, thirty-nine or
forty-one spaces, tabs and malformed comments must refuse. This note does not
accept unreviewed implementation or authorize another execution. Root separately
authorized one numbered third attempt after exact-source acceptance; no further
attempt, dump, target, source stream or timing scope is implied.

The previous RCPC preparation inventory was also independently checked: all
nine gzip stored hashes, decompressed lengths/hashes and available original
local bytes match, as do both source pins. Totals are 2,605 stored and 6,136
original bytes. Its 4,069-byte manifest SHA-256 is
`f1f10ba97c6db3e06769ffe0005fc6fc07501d2a3e962b8fd13680f7f317e5b3`.
I read the 45-fixture/0.130-second log and the retained author recheck reporting
142 unchanged records from failure commit
`26cea24b553e5b0792d706dedd97328793254d40`. This inventory validation does not
convert either actual decoder failure into successful coverage.

Additional public source identities read for this correction:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| MCAsmStreamer.cpp | 97174 | 1e7a44a66f49318774e89a3df66e9b8101a4ace70d5957d548e4fa2e3bbd51f3 |
| FormattedStream.cpp | 5616 | 4c50edf2b05e842ae862994bccbced27d127e7abf0e9ea57e431e0507febd1c4 |
| AArch64MCAsmInfo.cpp | 12021 | 8c225363890377dc7a9ac69547b688fcf2c46e20f7a28872e3d0811743865202 |

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
