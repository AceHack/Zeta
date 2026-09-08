# Distributional learning: fixed composition rooms

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Artifact status: pre-execution engineering control protocol

This is the first executable control in the
[learning research program](2026-09-08-distributional-learning-resource-aware-integration-direction.md).
Expected answers are deliberately known. These controls test composition and
counterexamples, not generalization, learning, physical Liouville dynamics or
state-of-the-art performance. They use no registered compiled-controller stream.
Commit this protocol and the intended source before the first actual F# run.
Retain compilation failures and subsequent source corrections separately.

## Fixed exact reference

The independent Python reference uses `Fraction`; the actual F# room uses the
existing `ProbabilitySemiring.Rational` on these bounded inputs. Both emit the
same finite JSON schema, with reduced rational `Num` and `Den` encoded as
decimal integer strings and a positive denominator. Full support and zero
masses remain present. Compare every field and ordered row exactly.

- Support: `[-2,-1,0,1,2]`.
- P: `[0,1/2,0,1/2,0]`; Q: `[1/8,0,3/4,0,1/8]`.
- Actions, in tie order: `steady`, `tail-exposed`.
- Utilities: `[0,0,0,0,0]` and `[-7,1,1,1,-7]`.
- Tail event: strictly `abs(x) > 3/2`.
- Transport maps source index `i` to `[1,2,3,4,0][i]`; inverse `[4,0,1,2,3]`.
- Likelihoods: unit `[1,1,1,1,1]`; soft `[1/4,1/2,3/4,1,1/2]`;
  tail `[1,0,0,0,1]`.

The ten ordered rows are P/Q distribution summaries, P/Q transport summaries,
then P/Q crossed with unit/soft/tail conditioning. P and Q both have mean zero
and variance one, but tail probabilities zero and one quarter, giving opposite
best actions. The transport preserves mass and round-trips; its forward means
and variances are reported and need not be invariant. P/tail refuses with
`ZeroEvidence`; the five other posteriors normalize exactly. The independent
reference plan specifies the full shared DTO and invalid-input tests.

## Actual Zeta observations

The separate `ZetaObservations` projection contains sixteen ordered rows:

1. Two moment projections through `Gaussian.ofMeanVariance`, reporting actual
   natural parameters, mean and variance. The identical projection cannot
   retain the two different exact optimal actions.
2. Two `LocalConsensus.evaluate` calls with prior N(0,1), one or two copies of
   the same supplied N(1,1) message, and threshold 2.5. Expected precision is
   two/three and state Undecided/ResolvedYes. The source ID is experimental
   annotation: the API does not enforce evidence provenance. This demonstrates
   why precision alone cannot establish independent evidence.
3. Six `SoftValue.observe` calls on P/Q and the same likelihood roster.
   Compare all five reconstructed support masses with the exact posterior at
   absolute tolerance `1e-12`, without a relative tolerance. The only refusal
   is P/tail. Report actual maximum mass separately from correctness.
4. Six priority/budget rows: capacities zero, six and twelve bytes, each with
   neutral priority and attention ten on `attended`. Candidates `likely` and
   `attended` have posterior shares 3/4 and 1/4, equal declared six-byte costs
   and unit likelihoods. Each row executes both `predictWithPriority` and the
   direct `predict` control against the same inference and fresh tank.

There are twelve prediction calls and one `infer` call. Posterior shares and
best label stay unchanged. At capacity six, boarding chooses likely under
neutral priority and attended under attention ten. Both VisionConfidence
values are one half, while boarded posterior masses are three quarters and
one quarter. At capacity zero/twelve, confidence and boarded mass are zero/one.
Full report equality with direct prediction holds for neutral priority only:
ordered Requested/Boarded/Deferred lists retain the attention-induced order
even when the boarded sets coincide. All deferred branches remain explicit.

Six bytes is a declared forecast cost consumed by the existing port. It is
not measured retained/allocated memory, CPU, energy or an asymptotic bound.
This control exercises the Vision limiter and inference priority port; it
does not establish an end-to-end Ferry, scheduler, emotional propagation or
CHIP-8 learning result. A funded computation can retain an uncertain posterior.

## Journal, source and execution boundary

The intended runner is `src/Research.FSharp/DistributionalLearningRooms.fsx`,
referencing the existing Release Core, Bayesian and required public assemblies.
Build those dependencies before execution and record source files, actual
loaded assembly hashes, runtime description, command, exit and complete raw
stdout/stderr. Loaded assembly hashes are observations, not complete runtime
closure admission. Do not relabel a compiler refusal as a room observation.

The stdout format is bounded NDJSON: selected API-return checkpoints followed
by a terminal success/failure record. There are 25 designated checkpoints in
a complete run: two Gaussian projections, two consensus results, two SoftValue
constructors, six observations, one inference and twelve predictions. This
does not count every internal call or constructor. Write a checkpoint before
the next designated call; retain the first failure and all earlier records.
Bound the journal to 64 checkpoints, 64 KiB per line and 1 MiB total. A broken
sink or process crash can leave a raw partial prefix; do not claim crash-proof
publication or manufacture a terminal record after the fact.

Three separate deterministic fault controls request failure after checkpoint
2, 12 and 25. Each must exit nonzero, preserve exactly the corresponding prefix
of the ordinary run, and issue no later designated call. They are injected
engineering controls, not naturally occurring failures. The source also
returns a typed refusal for malformed control arguments. The complete ordinary
receipt is compared with the independently produced exact Python reference;
the floating Zeta projection and budget/consensus outcomes are checked using
the fixed criteria above. Preserve all attempted runs and corrections.

## Next investment decision

A moment-loss counterexample justifies retaining a mixture/finite alternative
on tasks where the lost distinctions change utility; it does not show that a
mixture learns better. A duplicate-evidence counterexample makes provenance
accounting a prerequisite for relational confidence. Priority/belief separation
is a control for later affect and resource policies, not a score improvement.
After these controls pass independent replay, preregister a separate learned
prediction/action comparison with fixed observation access, training and tuning
budgets, holdouts and cost reporting. Public benchmark claims require the
compatible official baselines specified in the parent program.
