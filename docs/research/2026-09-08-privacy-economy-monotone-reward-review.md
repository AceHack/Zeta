# Privacy economy: independent monotone reward repair review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded source acceptance

I reviewed the exact two-file repair at
`e2a8f7fb23b57aba614da2499273f679bf0935ad`, following the three retained
failures in the [direction review](2026-09-08-distributional-learning-direction-review.md).
Current files equal their committed bytes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| src/Core/PrivacyEconomy.fs | 7279 | 5087fa8c89328ddc82691924870cdeef255637ade092e7c4c901c8693481002c |
| tests/Tests.FSharp/PrivacyEconomy.Tests.fs | 5977 | e10fd07b05f67191ea717ffef56ee016daaeaee64f73008e4d8547b940d0957e |

The formula first raises an invalid negative target balance to zero and clamps
a negative grant to zero. It evaluates gainOf exactly once, even when the cap
prevents growth. The effective ceiling is the greater of held balance and cap.
Both summands are nonnegative Int32 values, so their Int64 sum is representable;
clamping to the Int32 ceiling before conversion is safe. The result cannot be
below the normalized held balance or exceed that ceiling. Lower and negative
caps therefore cannot revoke existing entitlement, and overflowing positive
grants saturate rather than wrap.

Only the target map entry is updated; the input map and unrelated entries are
unchanged. The documentation explicitly states the upward normalization policy
for an invalid negative target. It also narrows the previous distributed
G-Counter claim to the actually implemented local grant ledger. No distributed
merge, transfer or validation of all other ledger entries is implied.

I read all seven explicit boundary cases and the 512-combination signed-boundary
grid. The tests distinguish expected amounts, one callback evaluation, unchanged
other entry and unchanged original map; the grid checks nonnegativity,
nondecrease, ceiling and no-growth cases. The initial compiler exit 139 occurred
before tests. An unchanged original-source retry then executed 16 tests with
seven failures and nine passes. The corrected run passed all 16 in 37 ms.
Those are separate outcomes; the compiler failure is not a test failure or a
diagnosis of this arithmetic defect.

No remaining material finding was identified in this source change. I ran no
test, probe, benchmark, user ledger operation or scientific measurement. The
owner's broader full gate remains separate from this targeted source acceptance.

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
