# Distributional learning direction: independent scope and source review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded direction acceptance; arithmetic repair remains separate

I read the complete [direction](2026-09-08-distributional-learning-resource-aware-integration-direction.md)
at `bd229f56aafb9a387285f59b198bb4b1bc6d5c2e`. Its 20,242 bytes hash to
`8c9c8affe35143131a699f59a7806a0ad23962b2268b674dddf8ab1b2c4438e1`.
The [independent byte audit](distributional-learning/2026-09-08/independent-direction-audit.json)
binds all 26 inventory entries to both current files and immutable blobs at
`cb4514e06b61fcebb2600ea8ea7f11abd08c8bcd`. The 5,864-byte source inventory
hash is `b8ca21c07f0eb7c73c6525436881bdc72a54ea7852b4fbbc08f46516d9d7cc17`.
Both stored and decompressed identities of the two retained probe artifacts
match. This is byte verification and focused source review, not an execution
or exhaustive correctness audit of every inventoried module.

The original opening could be read as completed compiled-cost certification.
The author incorporated the review correction: that follow-on is intended to
test certified execution cost, with runtime admission and registered cost
evidence pending. The new direction neither changes the frozen experiment nor
authorizes its streams. Learning comparisons require separate registration and
held-out data; significant architecture changes require their own ADR.

## Grounded distinctions

The direction keeps beliefs, messages, observed events and preferences distinct.
Its classical transport, Bayesian update and approximation claims have different
premises. The primary [classical no-cloning abstract](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.88.210601)
explicitly concerns joint source/target/machine distributions under Liouvillian
evolution. Extending that result to ordinary serialized belief copying or
anti-Sybil security would add unsupported premises; the direction rejects that
extension. The publisher abstract was available; a separate university PDF
fetch returned 403, and I do not claim a fresh full-paper proof review.

[Fuchs and Schack](https://arxiv.org/abs/1301.3274) place the SIC expression in a
specific quantum measurement framework. [Fuchs and Stacey's versioned account](https://arxiv.org/abs/2512.14122v1)
supports the normative and personal-probability distinction. Neither is a
general classical inference optimization. The direction's resource-allocation
connection is explicitly a proposed synthesis. I did not independently reread
the original supplied transcript or copied writeup: their inventory hashes and
timestamp descriptions remain producer observations, not a fresh attachment
audit or a claim that I watched the talk.

[Minka's EP account](https://tminka.github.io/papers/ep/) and
[Winn and Bishop's VMP paper](https://www.jmlr.org/papers/v6/winn05a.html)
support separate approximation objectives and conditional update guarantees.
The proposed finite enumeration checks, projection counterexamples and neutral
affect controls are appropriate discriminators. Affective urgency must not be
counted as independent likelihood evidence. Local source inspection confirms
that Gaussian multiplication in LocalConsensus has no evidence-provenance
argument and that SoftValue permits point masses and explicit decisions.

Resource allocation must be judged by task decisions and resource costs.
[Selecting Computations](https://arxiv.org/abs/1207.5879) grounds that proposed
metalevel distinction. Source inspection also confirms that Vision's reported
Confidence is admitted/requested bytes, Ferry permits an unbounded queue by
default and an oversized item can travel alone, and ComputeReceipt subtracts
an uncalibrated ticks-times-throughput quantity from information in nats.
Those names do not establish predictive calibration, a global queue bound or
physical energy accounting. The direction identifies these gaps rather than
using them as measured benefits.

The versioned [POPGym Arcade v8](https://arxiv.org/abs/2503.01450v8),
[Dreamer evaluation](https://www.nature.com/articles/s41586-025-08744-2) and
[TD-M(PC) squared study](https://proceedings.mlr.press/v331/lin26a.html)
are real primary comparison anchors. They do not establish one universally
current best learner. Refreshing task-specific baselines at registration,
pinning wrappers and separately reporting equal-interaction and equal-compute
comparisons avoids that overclaim. The proposed ablations and investment table
remain prospective; no comparative result has been observed here.

## Arithmetic finding and required repair semantics

The retained three-call source-loaded probe records 100 becoming 10 at cap 10,
100 becoming -1 at cap -1, and 2,147,483,642 becoming -2,147,483,644 after a
grant of 10. The original informational F# diagnostic remains in the log.
Reading reward confirms the cause: it computes an Int32 addition and applies
min cap even when cap is below the held amount. Existing ordinary examples do
not establish the advertised unconditional monotonicity.

For an already nonnegative balance, the proposed repair should evaluate gainOf
exactly once, clamp a negative grant to zero, use widened arithmetic and choose
an effective ceiling no lower than the held amount. Lower or negative caps
must not confiscate an existing balance; positive overflow must saturate at a
declared representable ceiling. Since the public Ledger is an unrestricted
Map, preexisting negative balances need an explicit rejection or upward repair
policy and discriminating tests. This review does not choose that policy by
silently treating a negative value as valid entitlement.

A locally monotone grant is also not a demonstrated distributed G-Counter
protocol without its state, merge and concurrency laws. That claim should be
narrowed or separately implemented and tested. The arithmetic change belongs
to the source owner's later bounded repair; none is accepted or executed by
this direction review.

No scientific run, training, policy call, benchmark or registered measurement
was performed. The direction is accepted as a source-grounded research plan,
with existing defects and missing proof obligations kept visible.

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
