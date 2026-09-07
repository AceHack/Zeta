# Guarded controller: finite method mapping review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: metadata-only candidate roster accepted

This read-only review binds mapper source
`37a8bc1ca61d7018310d6cfdf5a35efbd73df4b9` and retained evidence
`39ee571c101bdd85101a6d7c569efaa3890d944c` in the native writer.
The mapper is 7,717 bytes, SHA-256
`2b5f8fb9b1b8f4d8b6dd219fb6d4ec4fbecdc69ac2c2306637e19658577bb027`;
its three-fixture test is 2,387 bytes, SHA-256
`10e32b3191927ea58c21fe1147f074a8f20209b81087376b4254d029498b4104`.
Both current files match the committed source. The actual mapping is 185,092
bytes, SHA-256
`0d22a5c3679b5f47f874e8c1c10cfd34b17e9e4b7e3b649e2590f22f0f25a39a`.

I read the source, tests, invocation and retained outcomes. The mapper reads
only the already captured reflection/compiler metadata. It does not open the
dump, invoke a metadata helper, or launch a study target. Each prepared row
must have a unique compiler type/name match and cannot reuse a block already
assigned to another reflected module/token. Unprepared rows must retain their
actual refusal. Failure and unexpected cardinality keep the candidate mapping
incomplete; unmatched emitted compiler blocks remain explicit obligations.

I independently checked all eight input/source fingerprints and compared every
retained row with the fresh capture's reflection metadata. A separate small
word/literal reconstruction over the retained JIT text reproduced the mapped
compiler lengths and hashes, unique block assignments and declared literal
bytes without rerunning the mapper. The result is 139 observed rows, 130
mapped candidates, 34,660 candidate code bytes, a largest candidate of 1,664
bytes, and ten declared literal records. All nine unprepared observations
remain present.

There are also nine emitted but unmatched compiler blocks totaling 492 bytes:
eight 52-byte static initializers and the 76-byte concrete previous[int]
specialization. These are a separate set from the nine unprepared reflection
rows. Matching their cardinalities does not provide a one-to-one association
or justify excluding either set from later closure analysis. In particular,
refusing preparation of a generic definition does not show that no concrete
specialization executes.

I verified all nine compressed/original evidence identities against their
retained local originals. The three pure mapper fixtures passed in 0.001
seconds; the initial import-order lint finding and corrected zero-remaining
result are both retained. Tests distinguish duplicate or missing compiler
matches, mismatched lengths, duplicate token identity and unprepared rows
without a refusal. They also ensure that an unmatched specialization remains
an obligation. I executed no test, mapper, helper, target, policy, registered
stream or measurement, and read no raw dump memory.

This accepts a finite planning roster only. It does not promote compiler size
to actual method extent, bind runtime data or establish call closure. The
prospective next helper mode must bind the exact mapping bytes/order, compare
captured PE MethodDef token/declaring-type/name against native reflection,
retain the full actual ClrMD signature, and separately compare actual module,
current code and hot/cold ranges to physically backed candidate bytes. Local
PE/native-reflection correspondence is not a dump-proven module MVID or a
proof about generic instantiations. Unknown names, extents or associations
must refuse. Final framework/generated/indirect-call, guard-data, control-flow
and source/runtime obligations remain open, with all full admission flags
false. Exact-source review and owner coordination precede any expanded query.

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
