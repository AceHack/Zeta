# Guarded controller: owned file replay review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance after preserved repairs

This read-only review covers initial replay source
`e5b7720215e01ac7204dbe7888c8e7cb7bdfa7d2` and the final four-file correction
`e6238f8acc89c4d619c6631f0cb0111aa9258c20`. The current files matched that
final commit exactly when inspected:

| File under src/Interp.Python | Bytes | SHA-256 |
| --- | ---: | --- |
| zeta_interp/hidden_switch_compiled_file_fixtures.py | 21212 | deb65f08b364923a7f78b7cc56e60b92f877f1cb1f8814891e8b352ab8f4427c |
| zeta_interp/hidden_switch_compiled_file_replay.py | 18140 | 257d8280d03609d8a0f82a44796f402ba9901e1a9e6b101dc15524adb0798efc |
| tests/test_hidden_switch_compiled_file_fixtures.py | 15134 | 4c0e2f9f8f0179219924079f3bc838def828d12743928a4e306edb78e4a80195 |
| tests/test_hidden_switch_compiled_file_replay.py | 16999 | 899eee7dcddc21f661502fcfdb4b64dcd17f83a47c514b34e258b4c7effd7466 |

The independent fixed case ID selects one of seven source-defined fixtures,
with eleven operations across the roster. Producer data cannot select arbitrary
operations. Every fresh actual return is retained before producer result parsing
or comparison. Raised or untyped helper outcomes cannot acquire an invented
completed-operation count. Missing, extra and malformed late entries preserve
the actual prefix. Complete results use the unchanged strict
Type/Fields/BytesHex convention, including numeric type and signed-zero
agreement, with a one-MiB recorded-result bound.

The original fixture audit comparison uses explicit FileState and
FaultObservation schemas. It validates and retains OS observations while
allowing specified device/inode, timestamp, permission and directory-size
variation across fresh roots. Device/inode associations must be consistent per
logical file, distinct between logical files, and match each fault target.
Kinds, contents, relative paths, symlink targets, setup and operation results,
fault order, byte counts and remaining fields compare exactly. This is a
specified projection, not arbitrary key deletion or path-text rewriting.

Two additional gaps are retained and repaired. First, the author demonstrated
that a valid initial replay could not be encoded because its complete actual
PreparedFileFixture contained a Path. The retained 207-byte encoding refusal
has SHA-256
`870f0960f60fe352d027ef77e5a33fbc09bf183f9c08beb3b922977019bedfae`
and identifies result-type at `$.Preparation.Returned.Root`. The final DTO
stores explicit root strings and constructs Path privately at I/O boundaries.
Positive cases now encode the complete actual preparation observation through
the unchanged encoder; no generic implicit Path conversion was introduced.

Second, this reviewer found that initial replay did not prohibit the fresh
root from overlapping an independently supplied producer root. After moving
the original tree away, equality could recreate and operate that original
pathname. All three equal/ancestor/descendant regressions failed against the
initial source; complete unexpected results were retained. The final source
checks both lexical containment directions, including equality, before any
preparation call. The regressions require no preparation, empty calls, zero
completed operations and no recreated original path. Original producer paths
remain association data and are never opened or resolved. The actual fresh
parent's canonical-directory admission remains part of preparation; this does
not establish hostile namespace or future path immutability guarantees.

The earlier truncated-gzip witness correction is independently recorded in
[the focused review](2026-09-07-hidden-switch-compiled-gzip-fixture-review.md).
Its intended artifact-gzip refusal is retained by this final replay. Earlier
helper-return type failures, the original encoding refusal and all three
overlap failures remain diagnostic history rather than successful evidence.

I read the final retained log showing 81 passes in 3.68 seconds: 34 fixture
and 47 replay cases. The four-file strict typing and Ruff logs pass. I read
the full initial replay and tests plus the complete final correction; I ran
no tests, fixture operations, policy, source stream or measurement. No material
source finding remains within this bounded replay contract. Actual seven-case
capture and complete outer/source/runtime admission remain separate work.

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
