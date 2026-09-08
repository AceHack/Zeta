# Guarded controller: actual LLVM correspondence review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: exact column repair and third-attempt word correspondence accepted

The final source pin is `20043d1408bfa3a515f5d59864ad858595044707`.
The complete two-file correction was independently reviewed before launch:

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| decode_hidden_switch_methods.py | 18726 | 95542b00fe4a16728bc1f04de1914f91a952bfebb61654143882b47e6afd211b |
| test_decode_hidden_switch_methods.py | 13438 | 4deda191005c3a50925dad1fffc265bcbe947aa54f083ef8a07fe8fcf9800fbb |

The only executable decoder change admits exactly forty leading ASCII spaces
before the existing standalone hexadecimal comment. The actual failed-attempt
stdout fixture binds its retained bytes and atomic input, exhausts all 8,665
words and 851 comments, and mutates the actual first pair to require zero,
thirty-nine, forty-one or tab indentation to fail. Previous width/value,
association, cardinality and byte checks remain. I read the 16-fixture pass in
0.063 seconds, combined 46-fixture pass in 0.180 seconds and clean Ruff log.
The [prior reviewer guidance defect](2026-09-07-hidden-switch-compiled-llvm-comment-column-correction.md)
and both failed decoder attempts remain preserved. Source acceptance did not
convert either old attempt into successful evidence.

The separately authorized third attempt is retained in evidence commit
`0fe0c33dc88e2cbfe291bc5ac60aeef0b5210587`, from execution preparation head
`1be0fa57b256d34045f3b3e5a9b2f55ce0dfe550`. Its manifest is 108,216 bytes,
SHA-256 `DDBAE0C9820E8D02B221466D1E3F9677A350A5CE4F7C66BD4D5158652ACFE8E7`.
LLVM PID 89193 exited 0. The retained finish is
2026-09-08T00:06:24.424737+00:00. Diagnostics and cleanup are empty.

The independent [read-only audit](hidden-switch-compiled-validation/2026-09-07/llvm-decode-independent-audit/audit.py)
imports no task collector and invokes no decoder, target or dump. Its
[result](hidden-switch-compiled-validation/2026-09-07/llvm-decode-independent-audit/result.json)
verifies all 272 compressed/decompressed/original record identities: 473,052
stored and 4,907,243 original bytes. All 144 current file pins match, including
the explicit tool/library files and prior admitted mapping metadata.

For each of the 130 ordered methods, I independently checked contiguous
four-byte offsets, retained runtime base-plus-offset addresses, input bytes and
body hash, and correspondence to its earlier physical-read and DAC current-hot
extent receipts. The complete atomic decoder input matches the concatenated
word roster. Every one of the 9,516 stdout lines is accounted for as one of
8,665 concrete instruction re-encodings or one of 851 exact attached immediate
comments. Every re-encoding equals its supplied four bytes; comment values and
register widths match, and the complete raw comment plus text line is retained
in its decoded record. There are 34,660 instruction bytes in total.

The physical correspondence here uses the unchanged previously accepted mapped
capture and its read receipts. This audit did not independently reread dump
memory or reconstruct new code spans. Tool-file hashes and declared dependency
pins do not establish actual complete loaded-image closure. Decoder +rcpc
recognition does not establish captured-host capability or dynamic execution.
Printed operands are not admitted runtime targets. No control-flow, exception,
indirect-call, literal, arithmetic or source-to-native closure follows merely
from successful word decoding. The nine unprepared rows and nine extra compiler
blocks remain separate obligations. BodyResolved, ClosureAdmitted and
RuntimeAdmitted remain false throughout the retained outcome and decoded files.

This finite decoding slice is accepted. A separately reviewed transfer/literal
inventory may use these retained inputs; no extra memory range or process
execution is authorized by this review.

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
