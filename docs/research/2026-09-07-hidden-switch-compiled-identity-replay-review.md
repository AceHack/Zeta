# Guarded controller: fixed identity replay review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance

This read-only review binds source
`d3bd541e1d043e199c4b54b5390450028473c1cd`. Both current files equal their
committed bytes:

| File under src/Interp.Python | Bytes | SHA-256 |
| --- | ---: | --- |
| zeta_interp/hidden_switch_compiled_identity_replay.py | 36876 | 00522b05e4679fbda8d201f8b3847bc8cf00ee10beac5d03f8fd5ca1c7eb1150 |
| tests/test_hidden_switch_compiled_identity_replay.py | 21660 | 0f15b0f967b281e17902304e6d8d5c1cb7870efd051f2bed04d9228fecd87d8a |

I read the complete implementation and test file. The public whole-roster API
fixes seven source and eight Python cases; the single-case API requires an
independent caller-selected member of the same finite roster. Producer labels
and operation names cannot choose dispatch. The fresh existing fixture runner
executes the source-selected operation, and its complete returned or raised
observation is retained before producer parsing and comparison. Started,
returned, completed-operation and matched-case counts are distinct. Missing
later records stop before inventing a call; extra or malformed late records
retain the preceding actual observations.

Independent producer-root labels are canonical lexical absolute strings.
Every generated fresh target is checked against every supplied producer root
for equality and both containment directions before any fixture call. Original
roots are never resolved, read or executed. The existing fixture runner admits
the actual fresh canonical parent and exclusively creates its root; existing
outputs are not adopted. The tests cover moved originals, equality, both
ancestor directions and cross-case overlap. This is an ordinary owned-path
boundary, not hostile namespace or future path immutability proof.

Fresh source-fixed input bytes are reconstructed from actual preparation.
Only the declared repository or A/B clone and expected CloneRoot fields are
associated with the independent producer labels. The existing fixed serializer
then produces the exact required input bytes; arbitrary lexical input changes
or generic string substitution do not pass. Complete source results, including
commit/blob and byte identities, compare through the canonical typed encoding.
Fresh source refusal codes must also match the fixed case specification.

For Python cases, three bounded child artifacts are read from the fresh owned
root through the existing same-descriptor storage boundary. Original child
bytes are supplied data. Both sides require empty stderr, the complete stdout
result and exactly two trace records with one entry and one return. Each trace
binds its own collector result and the fixed before/after module facts, including
foreign-entry/helper association and changed source bytes. Thus a producer
cannot merely alter a result while retaining contradictory child evidence.

The complete Python result is compared after only explicitly enumerated path
fields and the positive process PID are associated. Environment names, order
and values are exact apart from those named root values. Return code, signal,
timeout, cleanup and resource status must show a normal completed child. Module
roster and path roles are checked; other module and interpreter identities
remain exact. The tests include an internally consistent fabricated interpreter
identity across result/stdout/trace, which still must fail full result comparison.
No producer type label is instantiated as code. Strict decoded value encoding
preserves type distinctions and permits harmless result JSON whitespace.

The implementation retains raw recorded rows, actual fixture returns, helper
observations and fresh child-read outcomes when subsequent decoding, encoding,
comparison or read admission fails. Actual child crashes remain incomplete even
when a collector-return prefix survives. The fixed source/fixture limits apply;
the per-result bound is one MiB and caller-held inputs remain outside an exact
peak-memory claim. Successful whole-roster results encode through the unchanged
bounded encoder, including their complete actual fixture observations.

I read the final log showing 55 passes in 17.63 seconds and clean strict typing
and Ruff logs for both files. The author retains an earlier 51-case pass and a
later 54-pass/one-failure test expectation correction; no production defect is
inferred from that fixture mistake. No remaining material source finding was
identified. I ran no fixture, Git/Python child, policy, source stream, target or
measurement. A separate actual capture inventory, complete outer artifact/source
binding and runtime admission are not established by this source review.

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
