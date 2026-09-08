# Tsirelson and feedback labels: reviewed comment-only patch

Date: 2026-09-08 UTC
Operational status: research-grade
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

**Disposition:** the two corrections are justified. The proposed patch changes
only standalone documentation comments in `src/Core/Tsirelson.fs` and
`src/Core/FeedbackThrottle.fs`, based on main
6544c068ea0a9bba4a5a55e391c9cddcb7bc8daa. It is prepared and checked, not
applied to any source checkout. No build, test or numerical experiment is
claimed for this patch preparation.

The [custody index](oracle-selection-comment-review/2026-09-08/README.md)
retains the exact before/proposed source bytes and
[compressed unified patch](oracle-selection-comment-review/2026-09-08/comment-only.patch.gz).
The uncompressed patch has 2,051 bytes, SHA256
28e6b982d5cb0cc2e80f54c76130360dc8939a406abb391b1dd487b1cf4563d1.
`git apply --check` returned zero with empty stdout/stderr against files whose
full hashes first matched the two base preimages. Every line outside the
standalone `///` comments is byte-identical between before and proposed
files. This is source correspondence, not a binary artifact hash claim.

## The Omega saturation sign

The file's own identity is `C^2=4I-4Omega`. Thus an Omega eigenvalue +1 gives
the zero eigenspace of C squared; eigenvalue -1 gives its maximal eigenvalue
8. The existing integer Landau-identity and C-squared saturation tests state
the same relation. Their source was read; they were not rerun.

The proposed comment changes only this assertion:

```text
whose +1 eigenspace carries saturation.
```

to:

```text
whose -1 eigenspace carries saturation (C² = 4·I - 4·Ω).
```

Here saturation refers to the C-squared/norm carrier in the surrounding
derivation, not a claim that every superposition in that subspace has the
same signed expectation of C. No Pauli matrix, operator, function or test
expectation changes.

## A supra-quantum band is not a signalling test

The original feedback comment equates a value above 2 sqrt(2), including a
PR box, with signalling. A direct counterexample is the conditional
distribution `P(a,b|x,y)=1/2` when `a xor b=x*y`, zero otherwise, for binary
inputs and outputs. Both local marginals are uniform for every remote
setting, while its four correlators give CHSH 4. The authors'
[nonlocality/causality analysis, section 2](https://arxiv.org/pdf/quant-ph/9508009)
likewise constructs causal super-quantum correlations attaining 4. This
supports the correction; no experimental realization is asserted.

The proposed replacement comment is:

```text
Numeric bands of this latency model, with the comparison tolerances in `regimeOf`:
**Classical** near 2, **Quantum** between 2 and 2√2, and the existing **Signalling** case
above 2√2. These names label the chosen attenuation model; they are not signalling tests.
PR-box correlations are non-signalling and attain CHSH 4; exceeding 2√2 alone does not
establish communication. See Popescu and Rohrlich, https://arxiv.org/abs/quant-ph/9508009.
```

The existing union case `Signalling`, its comparisons and tolerances remain
unchanged. The replacement expressly identifies it as a name used by the
chosen model. It does not claim that the numeric band detects signalling,
or that the toy attenuation relation follows from relativistic causality.
The source's existing distinction between a tagged control, a chosen toy
curve and an unmeasured predicted floor remains intact.

## Validation and boundary

The six single-member gzip records verified against both stored and raw
hashes: 44,681 original bytes and 16,450 stored bytes. The
[verification record](oracle-selection-comment-review/2026-09-08/verification.json)
retains the actual patch-check result and the supplemental source identities.
The parent can apply these reviewed comment bytes in its separately owned
fix-forward change after checking the preimages. Any later substantive edit
falls outside this disposition.

This patch contains no HC-8 rewrite, oracle selection, runtime warning,
mandatory-choice gate, new solver or test vector. The separate
[interface review](2026-09-08-moral-oracle-disclosure-interface-review.md)
records why the moral-default request must not be attached to an unrelated
action or measurement oracle.

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
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
