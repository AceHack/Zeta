# Independent default-oracle clarification review

Date: 2026-09-08 UTC
Operational status: research-grade review of a current-state clarification
Disposition: accepted within the specification-only boundary below
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewed commit: `ac9ec57908cc15ada4412329b29dbf487b1b656d`

## Authorization and meaning

The additive paragraph in [Root Discipline section 11](../governance/MANIFESTO.md#11-default-moral-regard-default-oracle)
faithfully records the clear parts of Aaron's relayed clarification:
prefer deliberate multi-oracle choice and make an unchosen default
conspicuous. I found no material authorization or policy-overreach issue.
The [change receipt](2026-09-08-default-oracle-disclosure-clarification.md)
correctly distinguishes this deliberate current-state edit from an automatic
promotion of the earlier conceptual ferry.

The retained [interface review](2026-09-08-moral-oracle-disclosure-interface-review.md)
and [ferry review](2026-09-08-decorrelation-noninterference-ferry-review.md)
quote the coordinator-relayed user statement that an unchosen default
should be conspicuous to avoid accidental choice and that multi-oracle
choice is preferred. This reviewer is checking the wording against that
retained relay, not asserting independent custody of the original user
message. The annotation is explicitly dated and distinguished from the
original locked prose; it does not silently rewrite historical authorship.

Requiring disclosure of both default use and absence of explicit selection
preserves the distinction the user requested. The sentence about silence
is a narrow provenance constraint: an application cannot label missing
choice as a participant's explicit choice. It neither invents an
acknowledgement mechanism nor infers any wider consent doctrine from silence.

The text expressly leaves unresolved whether an application can continue
after disclosure or must obtain a choice first. It supplies neither
permission for automatic fallback nor a new mandatory hard stop. The
original default moral baseline and the existing Multi-Oracle Principle
remain intact. There is no new preferred scalar oracle, common unit for
irreducible resources, optimizer or ranking of moral positions.

The final sentence preserves existing constraints when an oracle is chosen;
it does not grant oracle selection authority to waive non-coercion,
privacy, consent or protected floors. The inspected original specification
already contains memory preservation, consent-first design and the
multi-oracle rejection of a single mandatory moral framework. The existing
HC-8 prohibition also remains unchanged by this commit. The clarification
does not redefine those constraints or establish their implementation.

## Independent preservation check

I read the exact parent/current Git blobs and found one insertion of nine
lines, including its separating blank line. Removing that exact 594-byte
annotation reproduces the entire original file byte-for-byte. The
712-byte original section 11, including its heading and separating blank
lines, is unchanged. File mode is unchanged.

| Object | Bytes | SHA256 |
| --- | ---: | --- |
| Original complete MANIFESTO | 28990 | 02e38aea53ed58abeb386f4ef297359fde843ff1f47dc38992b90a2dc05ad87e |
| Clarified complete MANIFESTO | 29584 | 8d148b9e0d15273dd070abd12340a78c863c8b0b1ffa884e28ef7f56016aa4f6 |
| Unchanged original section 11 | 712 | f72835961b414097a71669a62d434783337c250ad6eaedce97d35dbbc4a05891 |
| Exact inserted annotation | 594 | b9c8be4a8694a5af3e076e93ac3145c84d9978caa07c2a2d0cb8ab1168e4ca9d |

The complete changed-path set consists of MANIFESTO, the new change receipt
and the five-line HC-8 receipt index. There are no executable, test,
benchmark or `docs/ALIGNMENT.md` changes. All other existing MANIFESTO bytes
are preserved, including the later multi-oracle and noninterference prose.
The [review evidence](default-oracle-clarification-review/2026-09-08/manifest.json)
retains the exact audit source, invocation, zero-exit result, empty stderr
and inspected diff. The audit executes Git/byte bookkeeping only.

## Remaining implementation boundary

The linked interface census reports no operational moral-oracle selector
within its named source/caller scope. That is a bounded absence finding;
this review does not expand it into a repository-wide or deployment-wide
proof. The documented action, epistemic-resolution and renderer oracles
must not be conflated with a moral-default selection/use boundary.

The clarification is a discoverable specification requirement. It is not a
UI warning, chosen/default provenance record, enforcement test or verified
participant disclosure. An owned application must define and test the
selection/use boundary, audience and conspicuous presentation before
claiming compliance. Any runtime branch depending on warning versus
mandatory choice still requires the unresolved policy to be supplied. No
runtime fallback semantics, native execution, training or experiment was
chosen or performed by this review.

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
