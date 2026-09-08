# Guarded controller: explicit RCPC decoder correction review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: exact source accepted for the separately authorized second attempt

This source-only review binds
`4a570eaf3ee2d5dccef07b5eeea229a363cd7365`. Current bytes match that commit:

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| decode_hidden_switch_methods.py | 18721 | 9fd4400b09bb81c43d7b9f76d8263ffdec0c639f7b7105d084554a2b9dac261a |
| test_decode_hidden_switch_methods.py | 10392 | f0b328c20930c3d229bb872f177bcfebfe4b5d84d0008aae2af30cae6e580cfd |

The original failed attempt is separately committed at `26cea24b5` by its
owner. Its generic-feature decoder exited 1 with twenty invalid-instruction
warnings on two LDAPR words. No parsed method was admitted. The retained stdout
also contains 851 separate immediate comments, which the earlier exact-line
parser would refuse. The original failure remains a failure; no new decoder
execution was performed by this reviewer.

The [version-specific source investigation](2026-09-07-hidden-switch-compiled-llvm-rcpc-review.md)
supports the minimal decoder feature `--mattr=+rcpc`. The inspected correction
adds only that feature while retaining the generic CPU, Darwin triple, exact
input/tool identities, byte comparison, empty diagnostics and process bounds.
The same explicit feature list appears in start and invocation metadata.
This does not establish captured-host capability or dynamic LDAPR execution.

The parser now counts instruction rows separately from text rows. At most one
exact lowercase hexadecimal comment may follow a decoded mov to w0 through
w30 or x0 through x30 with a signed decimal immediate. It checks the comment's
value modulo the register width and records the comment plus original text
line number beside the corresponding four-byte word. Orphan, repeated,
malformed, wrong-value, wrong-width, non-mov and unrecognized comments refuse.
Unknown lines are not stripped. Missing instructions and trailing extra text
still fail after preserving any earlier yielded prefix. Runtime addresses
remain independently supplied base-plus-offset labels; printed operands are
not admitted runtime branch targets.

I read the complete two-file correction and surrounding caller exhaustion and
terminal result logic. The final fifteen-fixture log passes in 0.004 seconds;
the earlier fifteen-fixture run also passes. The author reports the combined
45-fixture run passed in 0.130 seconds. The retained initial RUF015 fixture
warning is followed by a clean lint log; single-element unpacking exhausts
the generator and preserves its terminal cardinality check. No remaining
material finding exists in this narrowly specified decoder-text boundary.

A successful second attempt would establish only correspondence for the
already selected 130-method, 8,665-word input. Operand interpretation,
control-flow completeness, call closure, extra methods, literals and complete
runtime admission remain separate obligations. All three full admission flags
remain false in this source. A subsequent transfer inventory requires its own
finite source and evidence review.

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
