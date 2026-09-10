# Independent oracle publication composition review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded source, composition and custody acceptance
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the inspected publication at
c5f1fc0e6ff7b364404e602390cb37d5e2b51679. The
[audit and custody index](oracle-publication-composition-review/2026-09-08/README.md)
binds the source, complete tree reconstruction, retained validation and
the correction to my initial import-hash assumption. This is an independent
read of existing source, Git objects and records; no numerical, reference,
solver, vector or benchmark workload was run.

Relative to its observed-main parent cda10d7e70414e227237654abc7bc129ec08ac71,
the only changes under `src` and `tests` are the reviewed documentation
comments in `src/Core/Tsirelson.fs` and `src/Core/FeedbackThrottle.fs`.
Removing documentation-comment lines leaves every other line byte-identical.
Both complete files equal the previously reviewed proposed bytes. The
corrections identify Omega's minus-one saturation eigenspace under
`C² = 4·I - 4·Omega`, and distinguish the model's named numeric bands from
an actual signalling test: PR-box correlations can be non-signalling at
CHSH four. The [earlier comment review](2026-09-08-tsirelson-feedback-comment-patch-review.md)
retains the mathematical and primary-source grounding.

The `docs/ALIGNMENT.md` edit stays inside HC-8. Its operative non-coercion
paragraph is byte-identical, as is all text outside that section. The
explanation now puts enforceable constraints alongside highest regard and
removes the unsupported physical and universally positive-sum guarantees.
Removing only the new clarification from `docs/governance/MANIFESTO.md`
restores the entire original file byte-for-byte, including section 11.
The added text prefers deliberate multi-oracle choice and conspicuously
discloses an unchosen default. It prohibits representing silence as choice
and explicitly leaves fallback-versus-required-choice unresolved. Neither
an active moral-oracle aggregator nor a runtime selection interface is
introduced. Existing consent, privacy and protected-floor constraints remain.

All four current-state files are byte-identical to their earlier validated
source 4933a5f2af12f6b20f273488cf9174179d682fef. All 26 archived gzip records
match their stored identities, complete single-member decompression and
original local files: 84,150 original bytes and 14,313 stored bytes. The
17 original imported artifacts match the source import's exact root commit
and initial publication commit. Fifteen still match the final files exactly;
two research notes gained only separately inspected index paragraphs. The
original import manifest is historical evidence, not a claim that those
two final files retained their earlier hashes. My first audit incorrectly
required final equality for both notes; its source and tool-observed refusal
are preserved, followed by this explicit chronology check.

The ordinary current-main merge has parents
c3a5c729afef211cd666d652c332f3e02cd413c8 and
cda10d7e70414e227237654abc7bc129ec08ac71. An independent local
`git merge-tree --write-tree` reproduced precisely the two recorded document
conflicts. For each, the final file equals the premerge oracle bytes and
differs from the observed-main file only by the documented additive link
suffix. Restoring those two exact premerge entries in a reviewer-owned
temporary index yields tree 54e59a2a34720340779f2509962d197bbfb9f6ce,
exactly the complete publication tree. Generated Git objects and index
were confined to the reviewer's writer; the publication checkout was untouched.
No resolution discarded competing main text.

The archived source-4933 full gate passed all 18 checks. Its zero-exit
formatter retains its F#-unsupported diagnostics, and the independent F#
lint remains the separate gate result. The initial installation failure
and archive-path correction also remain labelled in the original receipt.
Current-main source changes warranted a fresh full gate rather than
inheriting the earlier result. The retained second invocation names c5f1,
starts at 2026-09-08T05:38:51.006532+00:00, and returns exit zero after
606.8923709392548 seconds with all 18 checks passing, including build and
tests. Its stderr is the exact retained Bun command line. This acceptance
does not infer a later remote publication or merge result.

No remaining material source, composition or custody discrepancy was found
within this bounded pass. The separate
[PR17041 merge-proof review](2026-09-08-pr17041-merge-proof-independent-review.md)
carries that earlier merge's corrected 347-path proof and raw check counts;
this pass does not reread or promote new native or reference results.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
