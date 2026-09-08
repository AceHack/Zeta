# History, generators and hidden evolution under repetition

Date: 2026-09-08 UTC
Operational status: research-grade conceptual bridge
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

## The insight being preserved

Aaron identifies the magnet with retained memory/history. Generators operate
on that structure; their outcomes and changing versions can become further
history. He connects this cycle to Rodney's Razor and Zeta's quasi-time-crystal
vocabulary: evolution can be difficult to recognize when an observed pattern
repeats. The [supplied talk and exact transcript](../ip-questionable/2026-09-08-magnet-paradox-memory-history-transcript.md)
are preserved separately because Aaron identifies them as the stimulus for
this insight. The argument here does not require the transcript to remain.

The proposed learning structure is a composable probabilistic DAG whose nodes
may contain neural modules, distributions or further DAGs. Retained evidence,
current interpretations, generator versions and their outcomes have distinct
roles. This is a direction for integrating existing parts, not evidence that
an integrated learner already outperforms other systems.

## What the present algebra actually supplies

This source reading is pinned to `e6fdbe676a87750fc3ba2f4f79a55b043d6b3ba1`.
In [WSet.FourCornerTrace](../../src/Core/WSet.fs), a generator acts on an
interpretation I and retained history H. Writing C for consolidation, its
emission is E = C(gen(I,H)). Changing I at fixed H produces the signed correction
Delta = C(-gen(I_old,H) + gen(I_new,H)). `step` updates the interpretation and
accumulated emission. It does **not** append an event to H.

`appendCorrection` constructs a causally ordered correction after checking its
sequence against the snapshot boundary. The caller must persist it. Therefore
the proposed generator-to-history cycle requires an explicit recording layer;
the algebra alone does not establish that every generator result is durable.
`foldRecorded` retains ordered turn records, including empty deltas. The
existing [formal laws](../../tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs)
and [treaty tests](../../tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs)
are source anchors, not newly executed experiments for this analogy.

An empty visible delta can coexist with a changed interpretation. For an
analytic illustration, let an integer interpretation advance by one each turn
and emit the key floor(I/2). Moving from I=0 to I=1 leaves that key unchanged;
the next turn changes it to 1. Equal observed output therefore does not imply
equal future behavior. This is an illustrative construction, not a reported
run of the repository. It motivates retaining the state that determines future
transitions instead of treating a repeated projection as permission to stop.

## Rodney's Razor and recurrence

[Rodney's reducer](../../.claude/skills/code-review-and-quality/blueprints/reducer.md)
separates essential from accidental complexity while preserving behavior and
contracts. Applied here, a compressed history or reusable generator should
retain the distinctions needed for future prediction and correction. A repeated
display alone does not justify discarding those distinctions. The project's
[glossary](../GLOSSARY.md) also distinguishes reducing a design from judging a
persona's worth; this proposal does not authorize erasing persona memory.

[Orbit.period](../../src/Core/Orbit.fs) searches for approximate return within
a finite bound. Its `Quasiperiodic` classification after no detected return
does not establish mathematical quasiperiodicity: a longer period, drift or
other dynamics can also exceed the search. Likewise the lag statistic in
[four-corner feedback](../../src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts)
is binary agreement across acknowledgements; constant success and constant loss
can both have perfect agreement. Recurrence needs an outcome-quality and
state-change interpretation before it can safely control scheduling.

The project's quasi-time-crystal vocabulary is useful for retained patterns
under repeated interaction. No physical time-crystal phase, rigidity theorem,
quantum computation or cost-free memory follows from that vocabulary.

## Physics boundary

A static support can exert force without mechanical work on a stationary
object; that statement concerns force and displacement, not an unlimited
energy source. See [Feynman Lectures I-14](https://www.feynmanlectures.caltech.edu/I_14.html).
Magnetic domains, hysteresis and barriers complicate the transcript's stronger
eternal-ground-state language; see [Feynman Lectures II-37](https://www.feynmanlectures.caltech.edu/II_37.html).
Neither fact makes recording, inference or communication free. Resource
accounting must continue to separate compute, storage, bandwidth and other
irreducible resources from belief probabilities and variational objectives.

## Testable integration direction

The [distributional learning program](2026-09-08-distributional-learning-resource-aware-integration-direction.md)
is the parent experiment direction. The next learning comparison should record
history identifiers, generator versions, interpretation changes and predictions
before outcomes arrive. Chronological holdout and resource budgets must be
registered before comparing results or choosing the next investment.

- Compare retained history with independently constructed empty-history and
  shuffled-history controls in disposable experimental copies; no persona
  history is deleted. Match interaction and compute budgets. Failure to improve held-out predictions
  weakens the proposed benefit of retaining this particular history.
- Compare a fixed generator with an updating generator, separating evidence
  accumulation from parameter or structure learning. Repetition alone is not
  evidence of learning.
- Construct cases with the same visible projection and different hidden
  histories. Measure whether a recurrence shortcut changes future predictions
  or loses recovery after a regime change.
- Compare compositional DAG models with feasible strong probabilistic-circuit
  and neural baselines. Report calibration, predictive score, task success and
  resource costs separately; no single score silently converts all resources.
- Include repeated, fabricated and cartel-coordinated evidence as the expected
  adversarial setting, using the existing detector/formal-analysis lineage.
  An apparently stable consensus must not count as independent corroboration.

These are proposed comparisons, not completed ARC-AGI-3 trials or current
state-of-the-art results. Local kernel agreement and a source-level analogy
cannot substitute for actual fitting and held-out evaluation.

The [independent source and learning review](2026-09-08-magnet-history-generator-learning-review.md)
verifies the supplied transcript bytes and corrected consolidation/control
wording. It traces existing ARC layers and scoped local outcome learning,
while distinguishing these from an integrated ARC-AGI-3 evaluation.
