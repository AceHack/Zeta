# Guarded controller: identity fixture review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: corrected source accepted for the bounded identity fixture scope

This read-only review covers identity-lane source
`a7548b075b21b0c4fdc552844b66fac36789e305`:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_identity_fixtures.py` | 29,658 | `dae994d727ce96a6ca4c58d1f5ef1e02442d567dc37374586081e15e06596b64` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_identity_fixtures.py` | 15,006 | `9a44f836f5ba8dc2a1fa510ddcb6221b31f9da94b95efcc2b4f7f7b0a3f1a228` |

The seven source and eight Python fixture IDs match the accepted outer design.
Source cases create and mutate owned Git subjects and invoke the actual shared
source admission API. Expected source bytes are retained independently of
the mutated tree. Python cases launch the actual interpreter with a real
module entry and invoke the supplied shared identity collector. The foreign
entry and foreign helper fixtures isolate those subjects: the other fixed
package/collector/helper bindings remain in the intended root. Tests inspect
the actual before/after module facts and specific refusal, rather than merely
requiring some failure. Caller-admitted collector/IEEE source bytes remain a
separate prerequisite; this fixture module does not independently establish
their entire source closure.

Owned output creation, process groups, bounded process waiting and descriptor
cleanup preserve primary failure values. Close ownership is removed before
the close attempt, and actual operation outcomes are retained before later
return-event publication. The successful-operation counter is distinct from
whether final retention succeeds. Existing output roots are not overwritten.
These observations do not establish a hostile-process or filesystem theorem.

## Findings and agreed repair scope

1. **Abnormal child exit discards an available observed prefix.** The original
   Python path classifies timeout/nonzero exit before parsing the child's
   retained trace. Its initial summary consequently reports zero collector
   entries/returns and no result even if the child recorded an actual entry
   or returned result before crashing. Keep `CompletedOperation = 0` for an
   abnormal process close, while retaining independently observed trace
   counts/results. Missing or malformed evidence needs explicit status or
   unknown values rather than fabricated zero counts. The owner accepted
   actual child failures after entry and after returned-result publication as
   discriminating regressions.
2. **A time bound does not bound output or subsequent reads.** The original
   process path writes stdout/stderr directly for up to its time limit, and
   later stdout/trace/inventory paths use unbounded whole-file reads. A runaway
   diagnostic could produce large files or an excessive subsequent allocation.
   The owner accepted declared output/trace/file/inventory bounds, finite
   descriptor reads and polling within the existing child deadline. The
   proposed limits are 1 MiB per stdout/stderr, 2 MiB trace, 4 MiB per regular
   fixture file and 1,024 files/32 MiB inventory, with bounded directory-entry
   traversal. Polled output detection may overshoot and is not an OS quota.
   Finite oversized-output/source/read witnesses will cover this boundary.

The reviewer read all original source and test code and verified the source
identities without executing fixtures, tests, child processes, native policy,
registered streams, analyzer queries or measurements. The owner reports the
original 30 tests passed in 7.59 seconds with strict typing and style checks.
Those original checks do not resolve the two findings; final acceptance awaits
the repaired source and its retained validation. Actual outer 92-case replay,
complete source/runtime correspondence and scientific phase admission remain
separate obligations.

## Corrected source acceptance

Final reread accepts
`0e0f8664765c7157b153bed86da217b8bf81a5e4`; inspected current bytes match
that committed source:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_identity_fixtures.py` | 35,228 | `9f9915fce386175fbf2aa1de1073b831725fed70bf0b29520d85aacdd2569c8d` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_identity_fixtures.py` | 22,918 | `88af1d10d0eba67554e027895ad9260877ba9a65928b5de82c33ceb5042f6418` |

Both findings are resolved within the declared scope. Trace inspection occurs
before abnormal-close classification. Valid observed markers and any returned
record survive separately from `CompletedOperation = 0`, including a later
malformed suffix. Null counts and explicit status distinguish missing,
unreadable or invalid initial evidence from an observed zero return count.
These are counts of valid recorded markers, not inference about unobserved
process execution. Normal completion still requires exact trace/output
agreement and one complete typed collector result.

The source enforces the proposed finite output, trace, per-file and inventory
observation bounds, including 4,096 directory entries and depth 32. Subsequent
reads use the unchanged held-descriptor storage boundary and the admitted
initial length plus one byte, preserving first failure and bounded known
inventory prefixes. Input to Git comes from its retained owned file. Polled
overshoot, arbitrary descendants and ordinary owned-tree assumptions remain
explicit; this is not a disk quota, future path lock or hostile-kernel claim.

The sixteen added cases directly exercise both original findings: real child
crashes after entry/return, valid return plus malformed suffix, unknown initial
trace, small actual output overshoot, initial-size refusal before the reader,
a finite producing-read trap, and each inventory bound. The reviewer read the
full diff and tests without executing them. The owner reports final 46 cases
passed in 8.23 seconds with strict source/test typing, Ruff and format checks;
repair evidence is indexed at owner commit
`6b06f1b79`. Its aggregate test archive is distinct from a single fixture's
inventory limits and from actual coordinator conformance results. No remaining
material source finding was identified. Full outer replay, source/runtime
admission and registered experiment execution remain outside this acceptance.

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
