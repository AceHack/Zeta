# Chronological rendered-signal prediction: preregistration

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Work item: 081M1W41PKD087G0R0024JFXHT
Author: Vera, OpenAI Codex using GPT-6 Astra
Baseline: `8efd66ea0613f6125beffa9bd7bda41f6af62367`

## Question and evidence boundary

Does the existing bounded recurrent learner retain useful chronological
prediction after observations cross a real rendered-frame boundary? Continue
the [handoff](../handoffs/2026-09-06-vera-to-vera-predictive-state-research-and-arc3-bridge.md)
and [factored results](2026-09-06-factored-predictive-results.md) without ARC
data. Preserve this protocol on a remote ref before generating experiment
results. Preserve implementation before measurement and keep both reachable
through an immutable `archive/experiments/081M1W41PKD087G0R0024JFXHT` tag.

The experiment is a source-owned CHIP-8 beacon animation with declared
left/right semantics, not learned vision, goal acquisition, an action policy,
or unseen-dynamics generalization. Held-out renderers are representation
controls of one known sequence law. A stronger counter learns that law from
observations; a recurrent win over only a bigram is insufficient promotion.
MiniGrid's current non-rendered conformance witness is excluded. The separate
relational-identity research does not supply predictor inputs or evidence.

## A. Frozen carrier contract

Each independent binary sequence starts with two fair draws. At position
`t >= 2`, copy `token[t-2]` with probability .75, otherwise complement it.
Use one persistent `ResearchRandom.Stream(domain(seed, tag))` per corpus or
panel, consuming rows in declared order. Consume exactly one draw per position:
initial bit is `floor(2*u)`; later copy iff `u < p`. This is
the earlier source-owned lag-two law, not a newly discovered process.

Compile each sequence into a fresh classic CHIP-8 ROM. Initialize V1 to the
declared Y coordinate and I to the appended sprite. For every symbol emit,
in order: `00E0` (clear), `60xx` (set V0 to the selected X), `D01N`
(draw N rows), `1000 | nextAddress` (jump to the next instruction group).
The last jump parks on itself. Initialization takes two instructions; each
frame is read immediately after its four-instruction group. ROM starts at
0x200, has at most 256 groups, and must fit below 0x1000 including sprite.
The runner checks the expected opcode and program counter before and after
each step, validates ROM length/operands/sprite bounds before loading, and
uses the actual `Chip8` emulator (its step returns unit).
No opcode patching during execution or host replacement of its display.

Frames use the existing 64 by 32 `GameEnvironment.Frame` contract. Pass
rendered cells to `FrameMotion.observe`, then decode current centroid X:
left half is symbol 0, right half is 1. Accept exactly one connected
foreground component whose entire bounds lie in one half, checked using
`FrameSignals.observe`. Refuse empty/ambiguous/cross-midline components,
dimension or palette errors, and malformed/over-budget ROMs. The model port
accepts only the resulting chronological binary array. ROM, source tokens,
seed, carrier name, generator probabilities and future observations never
enter the fitting or prediction API. Generator tokens serve only as a
separate extraction-conformance assertion, never as fallback observations.

Three frozen renderers:

| Name | X for 0 / 1 | Y | Sprite bytes | Frame palette |
| --- | --- | --- | --- | --- |
| train-dot | 16 / 48 | 8 | `80` | 0 background, 1 foreground |
| heldout-bar | 14 / 46 | 20 | `E0` | 0 background, 1 foreground |
| nuisance | 16 / 48 on even t; 14 / 46 on odd t | 8 / 20 by parity | `80` / `E0` by parity | complement both cells on odd t |

For nuisance, emit `61yy` and `Annn` before each four-instruction group to
select Y and either appended sprite, so it takes six instructions per frame;
read after all six. Retain the two global setup instructions for nuisance
too (Y=8, I=first sprite); its first group repeats them. Both sprites have
one row. This 256-frame ROM must also
fit. Palette complementation is an explicit rendered adapter operation,
not a latent input. The horizontal half, hence decoded symbol, is unchanged.
Record `FrameSignals.compare` structure/palette/placement deltas separately;
they are diagnostics, not extra learned features or generator-change labels.

## B. Data, learning and controls

Training corpus: 4,096 independent length-33 sequences, seed 1009/domain 101,
rendered only by train-dot. Render and decode once before fitting. Reuse the
same corpus and original row order for every model. Four passes produce
1,024 updates, batch 16, 32 conditional targets, 524,288 target visits per
model. Reset recurrent state between sequences. No first-symbol target.

Use existing `SmallRnn`, alphabet 2, width 8, initialization seeds
41/53/67 with domain 1. Existing Adam uses learning rate .003, beta .9/.999,
epsilon 1e-8 and gradient norm cap 1. Retain initial/final parameters and
every emitted progress row. No hyperparameter search, early stop or
best-seed selection. A failed run remains in the receipt.

Fit Laplace-one unigram, bigram and order-two counts from the decoded
training corpus once, not once per optimizer revisit. Unigram and bigram
use target indices 1..32; order-two uses 2..32. For contexts shorter than
two, order-two backs off to the bigram/unigram. Include known-law .75
lag-two predictions, fair-coin prediction, last-observation .95/.05
persistence, and each untrained network. All arms get the same observations.

Evaluate 2,048 independent contexts per panel at lengths 16 and 64,
plus one next-symbol target, seed 1009. Domains 103/104 use train-dot;
105/106 use heldout-bar; 107/108 use nuisance. These are independent draws,
not guaranteed-distinct strings. Score only the final next-symbol target
per context. Reset state between contexts. No refitting on any panel.

Report sampled log loss in bits, binary Brier `(p1-y)^2`, argmax accuracy
(ties predict 0), and ten equal-width reliability bins of p1, with 1 in
the last bin. Retain bin count, sum p1 and sum y. Also report known-law
expected cross-entropy and excess KL, clearly labeled oracle diagnostics.
Retain each context's target, probabilities and paired loss differences
against order-two; aggregate by panel/model without pooling model seeds.
There is no action return: its receipt is explicitly `not-measured-passive-carrier`.
Prediction accuracy must not be renamed action benefit.

## C. Frozen change-detection panels

Use 2,048 sequences of length 256 per panel, seed 2003, domains 201..205:
unchanged/train-dot; unchanged/nuisance; permanent copy probability .5;
permanent .25; transient .5 for 16 positions. Changed panels use train-dot
and begin at zero-based position 128. Other positions retain .75.

The numerator is the uniform mixture of eight complete alternative sequence
laws: switch at 32/64/96/128 to .5 or .25 forever. Before switching, each
alternative uses .75; its first two symbols are fair. Denominators: known
law, fitted order-two, fair IID, and each trained RNN. The RNN starts with
fair probability for the first symbol, then predicts from all earlier
symbols, using its carried hidden state; no reset within a stream. Fitted
order-two uses its stated backoff. Calculate each complete sequence ratio
in log space, crossing once at 20 with no restart. Pre-change means `t<128`;
eligible streams exclude pre-change alarms. Eligible detection is a crossing
at `t>=128`, miss is -1, and delay is `t-128`, including transient-panel
detections after position 143. Never use only the
post-change numerator with a different pre-change denominator.

Only the true known-law denominator has the likelihood-ratio martingale
.05 time-uniform bound. Learned denominators have empirical results only;
IID is an intentionally wrong null. Report every first crossing or -1,
final log ratio, pre-128 alarms, post-change eligible detections, misses,
and conditional delay distribution. For null panels report Wilson 95%
intervals for the observed alarm fraction (not a new guarantee). Rendering
changes under the nuisance null are ordinary transitions, not true alarms.

## D. Resource and reproduction receipts

Record source SHA-256, configuration, runtime/OS, corpus/ROM/frame/token
fingerprints and all model parameters. Hash binary data with explicit
ordering: ROM bytes; frame cells after palette adapter; decoded token bytes,
concatenated in corpus/panel row order. No platform-endian serialization.
Use incremental hashes and release frames as each row is consumed, retaining
only current/previous frames for comparison, decoded rows and numerical
receipts. Do not retain the more than six GiB of generated raw frame cells.
Include source hashes for Core emulator/extractors, random mixer, learner,
research modules and runners, plus hashes of input model receipts.

Separate carrier generation, emulation/extraction, fitting, prediction and
detection elapsed/process CPU/current-thread allocated bytes. Model/state
numeric payload is separate from allocated bytes and actual retained heap.
Do not infer peak heap or joules from .NET counters returning zero.

Benchmark frozen models serially, after training and correctness checks:
256 common length-64 contexts from seed 3001/domain 301, 256 warm-up calls,
five repetitions of 4,096 whole-context calls with candidate order rotated.
Measure predict-from-token inference separately from end-to-end ROM,
rendering, extraction and prediction. For the more expensive end-to-end
path use train-dot, 16 warm-ups and five repetitions of 256 calls, same
256 contexts. Candidate order is unigram, bigram, order-two, known-law,
fair, persistence, untrained seeds 41/53/67, trained seeds 41/53/67;
rotate left by repetition index 0..4. Warm-ups cycle over the same contexts.
Consume probability checksums. No own builds/tests/training concurrently;
ordinary host activity may remain and must be disclosed.

Independent Python replay regenerates sequences and tiny ROMs, interprets
only the declared opcode subset, decodes rendered centroids/components,
and checks all fingerprints, scores and detector crossings. This interpreter
is a restricted carrier reference, not a full CHIP-8 emulator. Reuse the
existing independent NumPy network for inference. Independently retrain
seed 41 with PyTorch binary64 and retain maximum parameter/trace differences;
numeric tolerance 1e-8, prediction/score tolerance 1e-10, hashes and discrete
decisions exact. Record disagreements; never loosen tolerance after inspection.

## E. Refusals, falsifiers and promotion

Required tests: malformed frames, absent/multiple/cross-midline beacon,
bad ROM budget/opcode, invalid tokens, nonfinite or nonnormalized predicted
probabilities (require both strictly between 0 and 1 and sum within 1e-12
of 1, without clipping or renormalizing), unknown/missing model seed or panel, edited source/weight
fingerprint, and wrong row/target count. Replay must refuse mutations.
Future-frame edits cannot change earlier predictions. Palette renaming
preserves decoded symbols. Histories `001` and `010` have the same symbol
bag but different lag-two predictions; sorting their chronology cannot
preserve both. Conformance compares every extracted token to source truth.

A neural memory sanity result requires every trained seed to beat fitted
bigram by at least .05 mean bits on both heldout-bar panels. The stronger
candidate comparison is against fitted order-two, with no seed discarded.
RNN promotion to the next acting-carrier experiment requires at least .01
mean-bit improvement against order-two for every seed on both heldout-bar
panels, no worse Brier by more than .005, no worse nuisance alarm fraction
by more than .02, and measured end-to-end median time/allocation no more
than twice order-two, separately for each trained seed. These are engineering thresholds, not a statistical
significance claim. Otherwise retain the simpler arm as the next candidate.
Even passing all thresholds earns a newly registered acting-carrier trial,
not an ARC default change. No ARC policy is promoted by this experiment.

Scientific changes after publication require a dated amendment before the
affected results. Implementation fixes require explicit defect witnesses
and retained pre-fix receipts. Never overwrite an existing result file.

## Prepublication review

An independent agent reviewed the carrier, leakage, detection and resource
contract. Corrected jump-prefix bit corruption, replaced a nonexistent
emulator step-result check with explicit PC/opcode validation, and froze
random-stream, probability, detector, benchmark and frame-retention details.
No experiment results were collected during that review.

## Grounding

The existing [predictive-state protocol](2026-09-06-predictive-state-batch-protocol.md)
and [factored protocol](2026-09-06-factored-predictive-protocol.md) supply
the declared source law, native optimizer and independently checked filter
controls. This protocol adds a carrier boundary, not a new learning theorem.
[Adam](https://arxiv.org/abs/1412.6980) grounds the unchanged optimizer;
[Howard et al.](https://doi.org/10.1214/18-PS321) grounds the known-null
martingale distinction. No theorem from either source guarantees a learned
rendered model's calibration or game performance.
