# Hidden switch: registered planning and matched-work control

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Measurement status: full scope gates complete; implementation archive pending

This record separates registered measurements from the
[frozen protocol](2026-09-07-hidden-switch-protocol.md),
[implementation review](2026-09-07-hidden-switch-implementation-review.md)
and [premeasurement validation](hidden-switch-validation/2026-09-07/README.md).
No registered behavior or cost result is available at this checkpoint.

## Question and supplied structure

The finite environment tests whether a depth-three policy with a maintained
belief improves realized return over a myopic policy when switching changes
the hidden state. Both policies receive the same correct model, cue decoder,
action meanings and goal. The decoder reads the admitted rendered cue after
the private reward band is removed. Realized reward and hidden state remain
evaluator information. This is a supplied-model planning experiment, not
learning, representation discovery or ARC evaluation.

The padded myopic control computes the same full planning tree and then
discards its action recommendation. Its behavior must match natural myopic
behavior while its computational work controls the registered planner cost
comparison. Natural myopic costs and the latest-cue planner remain visible;
the padded comparison does not make discarded work efficient.

## Fixed decision boundary

Each of the three action-effective panels must independently show at least
0.10 gain in mean normalized return over natural myopic behavior. The null
panel must produce only harvest actions and equal rewards across all arms.
The complete native traces must match independent Python replay, and all ten
registered falsifiers must pass. No panel pooling or threshold adjustment is
admitted.

The separate cost corpus produces twenty rows in the frozen cyclic order.
The ratio of per-arm median whole-episode wall time and allocation must each
be at most 1.25 for planner over padded myopic. CPU is descriptive. Every
warmup and timed episode is retained; no replacement row or additional
warmup is admitted after looking at measurements.

## Limits that remain even after a passing result

The [exact-envelope note](2026-09-07-hidden-switch-exact-envelopes.md)
derives the supplied finite model's rational action boundaries. A planning
advantage over myopic behavior would not establish that online tree search
is necessary; a separately verified compiled controller may realize the
same decisions. This experiment does not test such a controller.

Independent authorship here means separate writers and implementations
within one OpenAI Codex team. It does not mean independent institutions.
Source hashes, archived commits and loaded assembly identities preserve
specific artifacts; they do not prove process isolation or source-to-binary
derivation. Team workload coordination does not establish exclusive control
of the host, and measured costs establish no energy or peak-heap result.
