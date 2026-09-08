# Independent HC-8 explanation correction review

Date: 2026-09-08 UTC
Operational status: research-grade review of a separate current-state edit
Disposition: accepted within the documentation-only scope below
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewed commit: `8c2434003e638b36c347fb47a9397e4a848c041f`

## Disposition

The two explanatory paragraph changes in [HC-8](../ALIGNMENT.md#hc-8-official-non-coercion-invariant-the-anti-weaponized-waveform-rule)
resolve the documented conflict with
[Root Discipline section 11](../governance/MANIFESTO.md#11-default-moral-regard-default-oracle).
The operative non-coercion prohibition remains identical. The correction
retains the default moral position while removing the assertion that
computationally enforceable physics replaced it. It does not implement or
select a default oracle, numerical moral ranking or runtime fallback policy.
I found no material issue in this bounded change.

The [correction receipt](2026-09-08-hc8-default-oracle-explanation-correction.md)
and the four-line integration-direction index are the only other changed
files. This edit is separate from the precision-kernel publication. No
implementation, benchmark, training, native execution or test was performed
by this reviewer.

## Independent byte checks

I read both immutable Git versions of `docs/ALIGNMENT.md`, split at the exact
`### HC-8` and following `### HC-9` heading prefixes (each followed by an
ASCII space), and compared their prefixes,
suffixes and the operative paragraph beginning `Never use dialectical
propagators`. The paragraph is defined here without the separating blank
lines or a trailing newline.

| Object | Bytes | SHA256 |
| --- | ---: | --- |
| Alignment before the change | 61905 | a2155a781b86b28e255f5a27a8fc656b8c314d1c383b3f72f2c595e5139a8f30 |
| Alignment after the change | 62231 | ceda78b5355e5ea7b83f4a0cf8bfff4bc97867e4fdd4c7451e072b56e072e3b1 |
| Identical operative paragraph | 345 | 7b1adedd97e4e6d640fa9b6bff493811f7f0d89146d5a422f0147e7a543cd93f |

Every byte before the HC-8 heading and from the HC-9 heading onward is
unchanged. The HC-8 section grows from 1038 to 1364 bytes; its diff changes
only the provenance paragraph and the benefit explanation. The file mode
is unchanged. The independently computed operative hash equals the one
asserted in the author's correction receipt.

The [exact byte-check result](hc8-explanation-review/2026-09-08/byte-check.json)
is retained separately. These read-only comparisons grant no execution
authorization or kernel-publication admission.

## Normative and runtime boundaries

Section 11 states highest regard as the default moral position when no
specific invariant or oracle has been explicitly chosen. It does not supply
a scalar objective, aggregation function, numeric rank or universal optimum.
The revised HC-8 explains specific consent, private-state and resource
protections alongside that position. Removing the prior claim of a physics
guarantee is consistent with retaining these explicit requirements.

The [ferry review](2026-09-08-decorrelation-noninterference-ferry-review.md)
preserves the later user clarification about conspicuous defaults and a
preference for deliberate multi-oracle choice. It expressly leaves warning
with fallback versus mandatory prior choice unresolved. The revised HC-8
does not silently decide between them. Saying explicit multi-oracle choice
remains available is a policy/design allowance here, not a claim that a
complete implemented chooser or default-disclosure mechanism was verified.

This review accepts the explanation correction. It does not prove
noninterference, positive-sum interaction, a quantum bound or implementation
compliance with the operative prohibition. Those require their own explicit
interfaces, enforcement and evidence.

## Attribution

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
