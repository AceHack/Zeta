# Guarded controller: finite transfer inventory plan review

Date: 2026-09-08
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded design supported; two distinctions requested before implementation

This source-free review binds the proposed inventory plan at
`b727dd4a7dc0342d76efbbab6e19ee1369872739`. It follows the independently
accepted [third decoder evidence](2026-09-07-hidden-switch-compiled-llvm-decoding-evidence-review.md).
The plan consumes only the exact existing 272-record decoder and 700-record
mapped-extent archives. It does not launch a target/decoder, open a dump, or
claim complete control-flow or runtime admission.

The plan correctly requires every word's actual retained address and bytes,
checked opcode-derived relative targets, explicit call continuation versus
return distinction, register-bearing indirect transfers, trap/exception
categories and missing-data status. Static target membership is not execution,
reachability or callee closure. Unknown instructions cannot become safe
fallthrough by default. The nine unprepared rows and nine additional compiler
blocks remain separate obligations; neither is confused with the other roster.
Historical graph-process addresses and guard bytes cannot be imported into
this dump's evidence. Compiler literal declarations remain expected bytes
without a fresh physical observation.

Two wording distinctions were requested. First, an unsupported word needs a
retained unresolved row rather than silently ending or shortening the complete
8,665-word inventory. This word-level status differs from a collector/storage
failure, which may stop computation but must preserve its exact active prefix.
An inventory may finish accounting while reporting unresolved obligations and
keeping all full admission flags false.

Second, unique membership in the 130 code spans classifies control-flow
targets. A literal-data address can legitimately lie outside every code span;
that fact alone must not be confused with a malformed control target. The
literal row must retain its computed address, supported width, uniquely bound
compiler declaration and explicit absence of physical binding. It is neither
an observed data value nor permission for another read. Invalid arithmetic,
ambiguous association or unsupported encoding retains its stated refusal.

For reuse of an already retained callable cell, the implementation should
require the same exact dump and role association, eight retained cell bytes,
and equality between its recorded cell hash and the little-endian encoding
of the unique claimed target. That corroborates the existing pointer-read
receipt without inventing a new pointer observation or an executed call.
Duplicate cells or conflicting target associations must remain unresolved or
refuse, never select an arbitrary candidate.

The proposed ten falsifier groups cover the relevant finite boundaries:
identity/cardinality, signed target arithmetic, control classes, traps,
register-dependent cell patterns, ambiguous cells, literal association,
untouched raw decoder evidence and first-failure/prefix retention. Exact opcode
masks, disjoint/ambiguous range handling, resource ceilings and output helpers
still require independent source review. This note does not accept an
unimplemented classifier, a complete CFG, additional memory scope or a new
scientific execution.

No target, decoder, dump query, fixture, policy or source stream was executed
for this design review. The author's subsequent correction and implementation
must retain this original disposition separately.

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
