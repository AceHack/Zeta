# Guarded controller: owned file fixture review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: one bounded first-failure finding; correction review pending

This read-only review covers coordinator source
`9e2201236f0bd7c2e2b32644554d0b847831b7e0`:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_compiled_file_fixtures.py` | 19,733 | `a6fc63111989f3975d1909775b82ff7b8ce3b0d5b1f592602aa30a9da71d2d87` |
| `src/Interp.Python/tests/test_hidden_switch_compiled_file_fixtures.py` | 12,798 | `b1c5d13b759a977475145e50deeb1357f039f7cf6ea7395fecbcf1c0236cecc4` |

The seven fixed cases contain eleven designated storage operations. Owned
root/input preparation records its setup separately. Each dispatch preserves
an actual typed API result and completed-operation count before later audit
observations; missing or untyped returns retain their observed value without
claiming completion. A typed refusal remains the actual API result, separately
from fixture/audit failure. Prefix finalization rejects later rows after a
fixture failure and preserves raw OS facts without normalizing timestamps or
identities. It does not independently authenticate a caller-constructed
prepared value or judge the intended complete outer outcome.

The partial-write hook performs an actual three-byte write before injecting
failure; the next exclusive write encounters the retained output. The changed
read hook captures actual fstat information and modifies the same admitted
inode before returning that observation. Hook matching distinguishes the
target descriptor/inode and delegates unrelated descriptors. The observation
boundary refuses oversized or nonregular leaves, retains symlink targets, and
checks observed metadata before/after bounded reads. These operations use the
ordinary owned-tree premise, not a hostile namespace guarantee.

One concrete first-failure edge remains in the initial source:
`_Faults.changed_metadata` closes its owned mutation descriptor in an unguarded
`finally`. If a mutation write, identity check or fsync already failed and
close also raises, the close error replaces that first failure before the
storage API can produce its typed refusal. Preserve the original mutation
error, attempt the close exactly once, and retain a cleanup error separately.
A close-only failure must still refuse. A real-close-then-error fixture paired
with a preceding mutation/fsync error discriminates the required behavior.
This finding was sent to the coordinator before source acceptance.

The reviewer read the complete source and 31-test suite without executing
tests, fixture operations, native code, dump queries, registered streams or
measurements. The owner reports 31 passing tests in 4.01 seconds with strict
typing and style checks. Existing tests cover actual filesystem outcomes,
before/after observation failures, output survival, unrelated-descriptor
delegation, missing/untyped returns and retained prefixes. No other material
source finding was identified. The stated one-MiB fixture encoding bound is
checked after the fixed small result projection; it is not a general streaming
encoder quota. Output retention, complete outer replay and runtime/scientific
admission remain separate coordinator obligations.

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
