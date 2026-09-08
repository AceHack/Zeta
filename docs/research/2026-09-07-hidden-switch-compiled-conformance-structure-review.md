# Guarded controller: coordinator structure review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: accepted for the declared structural boundary; no material finding

This read-only review covers source commit
`2e0d01b296d16ef8a67d78d50bcd4501900b089b` in the coordinator's writer.
The source and tests were unchanged from that commit when reviewed:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_conformance.py` | 17,853 | `a57c74457740bf1950c8f108ca179e4723e9911e919cbd4a30fe6eb58e0aada2` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_conformance.py` | 8,814 | `38f34e690fe102b2d315a209d398baedab0974b2ffcfd15675d6f1c7328acc40` |

The literal roster agrees with the accepted outer-negative design at
`7da46c7f1d2aea9fb4ee721aeb9fd34a7c438681`: 92 cases and 136 case-level
calls, exact operation names and ordered roles, fixed prior controls, and
first-occurrence role unions. The separately required four omission-mutant
audit operations are not silently included in that case-level counter.
This module does not implement or admit that separate prerequisite.

`admit_case_prefix` checks exact row/call keys, types, order and descriptor
shapes. A complete structural record requires every case and call. An
incomplete record may retain the accepted case prefix plus one unfinished
case's returned-call prefix. Returning every call in that last case does not
promote the case itself. A failure after all cases can retain all 136 calls
with completion false. Later malformed headers or result descriptors preserve
the structurally checked row/call counts, without asserting that referenced
bytes or recorded outcomes have been replayed.

`result_tree` implements the design's JSON projection of public results:
dataclass names and all declared fields, tuple/list arrays, uppercase byte
hex objects, and exact scalar kinds including signed floating zero. Type
labels remain data. It refuses nonfinite values, malformed Unicode, non-text
dictionary keys, unsupported objects, cycles and excessive depth/node counts.
Shared acyclic objects remain usable. This is the specified operation-bound
projection, not a general injective serializer or a decoder that executes
producer-named types. Structural/per-item bounds are not an aggregate output
byte quota; the eventual writer still owns output-size admission.

The reviewer read the tests for independent group counts/control ordering,
boundary prefixes, strict scalar domains, late header/call mutations, retained
failure counts, nested result fields and cycle/depth refusal. The owner reports
41 passing cases in 3.80 seconds with strict typing and Ruff checks passing.
The reviewer executed no tests, fixture operations, policy calls, native code,
registered sources or measurements. This acceptance does not establish actual
outcome replay, referenced artifact bytes, full conformance prerequisites,
source correspondence, runtime evidence or complete envelope admission.

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
