# Guarded controller: fixed static replay review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded static replay source and retained validation accepted

This read-only review binds source `dc42bd64b302981e9b9a093db8b02183b52e5d05`
and evidence `67a1bcd43d9831489c89523e1ef7d5fcb802734c` in the independent
reference writer. I read both complete new files and verified current bytes
equal their source commit:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| src/Interp.Python/zeta_interp/hidden_switch_compiled_static_replay.py | 15552 | 0ad063e0003637a22f6bfa3eb8cb55135b5d8a19e88d499f46ff097b4b07b252 |
| src/Interp.Python/tests/test_hidden_switch_compiled_static_replay.py | 24506 | 70dd52d43e0e1c467a628c073be40084516c8497069132c4f9019a75a8878ae8 |

No material implementation finding remains. The reviewed behavior is:

- The caller supplies the independent exact `BindingContext`. Fresh fixed
  preparation determines all 32 ordered case IDs, 36 operation slots and exact
  input/support bytes. Producer names and type labels do not select execution.
- Exact tuple/dataclass/string/bytes admission precedes use of recorded inputs.
  Every supporting artifact's complete File/Stored/Original content is checked.
  A present admitted slot invokes the unchanged fixed dispatcher once; missing
  slots do not invent calls.
- The actual return or raised outcome is appended before producer call metadata,
  result parsing or encoding can fail. Counts separately retain prepared cases,
  started calls, returned calls, matched calls and fully matched cases. Later
  malformed, missing, duplicate or extra data preserves the executed prefix.
- Complete canonical encoding compares actual returns with strict-decoded
  producer data without constructing a producer-named type. It preserves
  bool/int, int/float, signed zero and full byte values. Harmless result JSON
  whitespace may vary; input and support bytes must match exactly.
- Each admitted result has a one-MiB limit. The 36-MiB arithmetic applies only
  to admitted recorded result bytes. Caller-held objects, rejected oversized
  values and encoded/parsed copies are explicitly outside that total. Sequential
  use, stable observations and trusted loaded implementation remain premises.

I checked the 97-record evidence directory against its evidence commit and
verified all compressed/original byte identities plus all 15 current source
pins. Totals are 146,892 compressed and 3,460,606 original bytes. Its manifest
SHA-256 is `6DE3A358B35C26F570182802403FF36F93D8C044B8EC0C4B9D3A1AC9A035FFA9`.
This was artifact reading, not another fixture or replay execution.

The retained logs preserve the initial 39-pass/five-failure run caused by an
incorrect expected bare boolean in one parameterized test. The real half-median
helper returned the full ratio object. Subsequent logs show 44 passes in 4.53
seconds and final 47 passes in 4.36 seconds. The source/test strict and style
checks are reported as passed. I inspected the discriminating tests for numeric
type/sign differences, byte values, wrong refusal/success/type labels, malformed
late JSON, input/support changes, producer dispatch attempts and both encoder
failure boundaries. I did not rerun those checks.

The separate actual capture reports 36 producer calls followed by replay passes
of 36, 36 and 35 calls. I read the complete retained replay DTOs' type, call
array lengths, counts and failure locations. The complete result has counts
32/36/36/36/32. Late duplicate JSON has 32/36/36/35/31 and fails at
Cases[31].Calls[1].ResultRaw; a missing final call has 32/35/35/35/31 and fails
at Cases[31].Calls[1]. The 107 replay calls are distinct from the 36 producer
calls. These use fixed synthetic caller context and static shared APIs.

This accepts fresh static result agreement only. It does not authenticate
outer raw files, source/archive identity, loaded Python/native code, the whole
92-case envelope or scientific execution. Source-fixed helper correctness and
the later full outcome judgment remain separate dependencies. The report
correctly labels injected signed-zero/byte-return tests and separately retained
actual static captures; neither is native conformance or registered measurement.

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
