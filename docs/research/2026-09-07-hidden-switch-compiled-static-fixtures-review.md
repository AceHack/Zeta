# Guarded controller: static fixture review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: accepted for the declared preparation and single-call boundary

This read-only review covers coordinator commit
`fa1d34a89bc6bb2f40b6be66a10cde32d9698e1c`. Both inspected files matched
their committed bytes:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_static_fixtures.py` | 14,785 | `ce877fe343a241ce2589338208e4475eedad2ae464559eaf8b478228fb320b0e` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_static_fixtures.py` | 11,700 | `0c082a2926b7b4e45022e0d87254dfc899a4966f94e402592e19baafd1e45004` |

The source implements the fixed 32-case, 36-call static subset of the accepted
92-case design. Preparation constructs immutable input bytes and the seven
supporting link artifacts without executing an operation. Dispatch validates
the case, exact call index and ordered immutable input roles, then calls one
selected shared boundary over those supplied bytes. It returns that actual
result unchanged, allowing the coordinator to retain it before another call.
Preparation is not silently rerun during dispatch.

The artifact relation witness preserves correct individual hashes while making
the supplied gzip expand to different original bytes. The two link-byte
witnesses change only replay-envelope lexical representation (leading space
or an escaped existing key), retain the original expected raw identity, and
keep decoded trees equal. Their tests execute a byte-check omission mutant,
observe its incorrect acceptance, and require the witness checker to reject
that acceptance. Source/certificate/runtime substitutions refresh actual byte
links while preserving the independently expected context, so the intended
context check remains load-bearing. The separate four-operation mutant-audit
prerequisite still requires its own retained execution record.

Schedule fixtures preserve the intended discriminators after changing headers,
including resetting indices after reordering. Resource fixtures retain exact
integer half-threshold behavior beyond binary64 precision, distinguish a
false half condition from an admission refusal, and cover descriptive zero
ratios separately from a refused zero native allocation median. JSON control
preserves lexical negative zero through the actual parser and bit decoder.

No material source finding remains within this boundary. The owner reports
59 passing tests in 2.07 seconds and passing strict typing/style checks; the
reviewer inspected those tests without executing them. This source does not
authenticate fixture inputs, retain files, judge complete outer outcomes or
produce a 92-case artifact. The coordinator must retain all seven supporting
link artifacts and each full actual result, and outer replay must compare the
inputs to source-fixed preparation. Missing support bytes are not replaced
with reconstructed artifacts by dispatch. Registered draws, cost measurement,
source/runtime correspondence and complete envelope admission remain outside
this acceptance.

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
