# Guarded controller: LLVM RCPC recognition boundary

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: explicit decoder-only +rcpc proposal supported; new execution pending

The first actual decoder attempt used the previously reviewed source
`036c114c093d2021d5e9ff187ddceea2a0befbb5`, generic CPU and no explicit features.
I independently read its local metadata/stdout/stderr/input records. PID 48759
exited one; the driver refused at decoded-byte-admission, preserved its first
failure and reported no cleanup failure or admitted parsed methods. Raw input
contains 8,665 bracketed words. There are 20 warnings: eight B8BFC021 words and
twelve B8BFC000 words. The 658,155-byte stdout and 1,570-byte stderr remain
separate raw observations. No warnings were ignored or instructions admitted
from that refused stream. The native owner preserves this original attempt.
Its 571-byte outcome has SHA-256
`c844ded02fb6a0d7763bae01b53ed1e7bae7f33f27f57a96761ebd08b8ed6474`;
stderr SHA-256 is `b8039964dbe341f4f20fbc9f17dffa660b642559ae94b171acfbc2a89535aea0`.

Version-specific [AArch64InstrInfo.td](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/AArch64InstrInfo.td#L1926)
places LDAPRW/X under HasRCPC; the predicate at lines 333–334 requires
FeatureRCPC. [AArch64Features.td](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/AArch64Features.td#L177)
names that feature rcpc / FEAT_LRCPC. The additional rcpc-immo and rcpc3
features are separate and are not required by these two instruction forms.

The [RCPCLoad format](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/AArch64InstrFormats.td#L2174)
fixes bits 29–10 to binary 11100010111111110000, with size in bits 31–30,
Rn in 9–5 and Rt in 4–0. Both observed words match the 32-bit destination form:
B8BFC021 has Rn=Rt=1 and B8BFC000 has Rn=Rt=0. They therefore correspond to
ldapr w1,[x1] and ldapr w0,[x0] under that exact source format. This was integer
inspection of the two retained words, not another decoder or target execution.

The official [RCPC test](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/test/MC/AArch64/armv8.3a-rcpc.s)
includes explicit +rcpc recognition, exact LDAPR encodings and required-feature
diagnostics when the feature is absent. These primary sources support adding
only `--mattr=+rcpc` to the offline decoder while retaining the generic CPU,
triple and every exact byte/count/diagnostic gate. They do not establish actual
success of the corrected installed-tool invocation.

Fetched source identities under llvmorg-23.1.0:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| AArch64InstrInfo.td | 605616 | 2189d21e1eef11566dd1e217dd64e0915331e3b35eeb35708000d33cb803f5c7 |
| AArch64Features.td | 54425 | f2ab00a297a6ee70bdbe19824b9ccc918d017c5ebb4bd9166ee13040480b8678 |
| AArch64InstrFormats.td | 531611 | e2328467bf6ffae505db98dd53218c568cc00daa3eb8c1392a494a865cd28aff |
| armv8.3a-rcpc.s | 2075 | 896801f2ef7e05eb00b5b32a9b28338738d3f92417b2dbd02e444fc291aa3b65 |

These are public version-tag guidance, not demonstrated provenance for the
installed Homebrew binary. The proposed source change and subsequent numbered
attempt require their own reviewed pins and retained outcome. The original
failure stays failed. Enabling decoder recognition neither changes the
captured study process nor proves that its host supports or executed LDAPR.
Actual arithmetic, control flow, call closure and all full body/runtime
admission remain pending. This reviewer launched no decoder, analyzer, target,
policy, source generator or measurement, and opened no dump.

An additional read of the retained stdout found 851 standalone hexadecimal
immediate comments, all immediately following a mov-immediate line and agreeing
with its operand modulo the named 32/64-bit register width. They are additional
text lines, not additional decoded words. The original parser correctly refuses
the original stream before such a distinction can admit it.

[AArch64InstPrinter.cpp](https://github.com/llvm/llvm-project/blob/llvmorg-23.1.0/llvm/lib/Target/AArch64/MCTargetDesc/AArch64InstPrinter.cpp#L305)
shows that `--print-imm-hex` changes the comment to decimal rather than removing
it. Its PrintMovImm path always emits the opposite-base immediate comment when
a comment stream exists. This source is 88,598 bytes, SHA-256
`67c7bfcaaeba332f973ed5f490c60cc257de9b4099cc88d439eb26abd113d664`.
The bounded proposed parser should preserve and associate at most one exact
hexadecimal comment immediately after a mov to an integer register with a
signed-decimal immediate, checking the value against that operand and register
width. Orphan, repeated, wrong-value, non-mov and arbitrary comments must refuse.
Instruction count remains exactly 8,665 independently of text-line count.
Other comment emitters exist; their unsupported forms must not be silently
dropped. This grammar extension needs its own source/fixture review before a
new candidate attempt.

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
