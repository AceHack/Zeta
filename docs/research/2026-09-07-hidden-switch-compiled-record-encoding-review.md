# Guarded controller: bounded result encoder review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: accepted within the complete-record encoding boundary

This read-only review binds source
`ba5359b726b10521f5573b09d5ad73bcdfd7f668` in the catch-reference writer.
The encoder is 9,555 bytes, SHA-256
`892b59a1572b093805171e0f495126f006a72d56ca87260251c9544c29019744`;
its test file is 7,877 bytes, SHA-256
`29f07fa07b1381c2257f9e047ff2064e2a19a7cb371453fb42daa1f6563de702`.
Both current files matched their committed bytes. I read both complete files
and found no material source or scope defect. I executed no test, fixture,
policy, source stream, native process, analyzer or measurement in this review.

`encode_public_result` streams the existing full `Type`/`Fields`/`BytesHex`
projection into a bounded private buffer. It returns a complete immutable ASCII
JSON record including its newline, or the first typed encoding refusal. Every
actual dataclass field is retained; the type label is data, not authentication.
Canonical field/key ordering, exact integers, finite floats, Boolean types,
signed zero and strict Unicode are preserved. Unsupported objects are refused
without invoking an implicit string conversion. Ancestor tracking refuses
cycles while permitting shared acyclic values.

The aggregate record limit is at most 256 MiB. Separate limits cover 16 MiB
UTF-8 fields/raw byte fields, 4,096-character keys, 13,600-bit integers,
depth 128 and 100,000 nodes. String/hex chunks contain at most 512 source
characters/bytes. Expanded ASCII size is checked before constructing each
escaped or hexadecimal chunk and again before appending. The implementation
does not first construct an unbounded result tree. Python's integer conversion
limit remains effective; the encoder does not alter interpreter settings.

The tests distinguish exact canonical parity for all 36 actual static fixture
results, Unicode and all byte values, exact signed zero, aggregate limits on
both sides of a complete record including its newline, cycles versus sharing,
late unsupported fields, malformed Unicode, and per-value limits. A guarded
JSON-encoding seam checks that exhausted capacity prevents expanded chunk
construction; another observes finite append/chunk sizes. These checks do not
merely compare the encoder with its own output. The author reports 43 passing
tests in 2.12 seconds and successful strict/style checks from the configured
Interp working directory, retaining earlier typing/style/working-directory
diagnostics. Those are author-executed results, not a reviewer rerun.

The private incomplete JSON buffer is not a published operation result.
Storage of prior complete records and actual call observations on later
encoding failure remains the recorder's separate obligation. The final bytes
and capped bytearray can briefly coexist; input objects, serialization/runtime
overhead and allocator behavior are outside an exact peak-memory claim.
This acceptance authenticates neither operation results nor fixture inputs,
and establishes no 92-case outer conformance, runtime admission or cost result.

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
