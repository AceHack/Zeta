# Guarded controller: pure data-roster source review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded pure-helper acceptance; outer admission and reads pending

I read both complete files at
`9ce26b4bb6ea05ccdaaac4deef888a5b80fd25ba`. Current bytes match that immutable
source:

| File under src/Research.FSharp.Cli | Bytes | SHA-256 |
| --- | ---: | --- |
| hidden_switch_data_ranges.py | 7212 | 17e7a22c7775f0c3fc51bc8157a816e2d306da081c77fd61f138551de71a48df |
| test_hidden_switch_data_ranges.py | 5512 | d7fb2596cd0383b8417d42342415fe647ec1f411652edf6d48862236352b8f0d |

The helper assumes its caller has admitted the complete immutable transfer
inventory. It is not that artifact-admission wrapper and does not authenticate
arbitrary caller-created records. The default production counts are fixed at
130 methods, 8,665 words, 134 unknown-cell sites, 43 unique cells, ten literals
and 496 selected bytes. The optional smaller expected-count mapping is a
synthetic-fixture seam; the production wrapper must not let input data select it.

Methods retain ascending numeric roles and words retain original offsets and
addresses. Compiler words and decoder bytes agree. Each unknown static cell
requires an indirect-transfer shape with no target evidence; the reviewed
construction helper independently reconstructs the cell address and register
dependency from its original instruction words. The retained construction slice
must match. Exact repeated cell references group into one eight-byte range
while preserving their original method/word site order.

Literal addresses use the original opcode's signed 19-bit displacement times
four from the retained PC. Supported double/Q load widths match the opcode,
compiler label, exact expected-hex length and interval bounds. ExpectedHex is
the inherited admitted compiler declaration; no physical data is available or
implied. Repeated literal addresses, conflicting sizes/labels and all partial
overlaps refuse. Final order is cells then literals, unsigned numeric address
within each kind, with pairwise disjointness across all ranges.

The output remains ProposalOnly with zero new memory queries and false observed
execution/body/runtime/closure flags. A computed address confers no permission
to read a pointer target, object or additional cell. The helper imports no memory
API and was not used for an actual roster derivation in this review.

I read the eight synthetic-case pass (0.003 seconds), combined 77-case pass
(0.372 seconds), original Ruff import diagnostic, its correction and final
clean result. The fixtures discriminate source-word address/register changes,
same-kind and cross-kind overlap, omitted/reordered rows, fixed cardinalities,
false admission flags, literal label/width errors and accidental target evidence.
I did not rerun those tests.

This acceptance completes only the pure derivation source pass under the
previously [reviewed plan](2026-09-08-hidden-switch-compiled-transfer-inventory-evidence-review.md).
The finite wrapper must still admit exact source/input identities and preserve
its failure/output prefix. Its immutable hashed 53-range output and any later
held-descriptor physical reader require separate review and parent authorization.

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
