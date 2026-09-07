# Hidden switch dynamics: preregistration

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Registration basis: `a0ffd1bff714f4bcc6fbf31a9a64792aed5846ec`
Registration status: reviewed and frozen before implementation or measurement
Review freeze: 2026-09-07T09:37:25.397410+00:00

## Question and boundary

Does a finite belief planner earn more return than a myopic controller when
an action pays an immediate cost to change a partially observed machine's
future state? Both controllers receive the same supplied transition,
observation and reward model, and the same permitted rendered channel. A
second myopic arm expends the planner's complete tree-expansion budget but
uses only immediate values. This isolates use of future values from that
specific extra computation. A latest-cue planning arm separates the question
of retaining observation history from planning depth.

This continues the [rendered-catch result](2026-09-06-rendered-catch-actions-results.md)
and [indexed handoff](../handoffs/2026-09-06-vera-unattended-research-continuation.md).
That earlier task left target generation independent of action. Here actions
change the hidden state that produces later cues and harvest rewards.

This is a source-owned finite simulator with a supplied pixel renderer, not
a CHIP-8 ROM or an ARC environment. The semantic decoder, objective, action
meanings and correct stochastic model are supplied. Even a successful return gap would not identify online tree search as the
necessary computation: this two-state controller may admit a cheap compiled
threshold policy. No comparison with an optimal compiled controller is
registered, and no computational necessity or search efficiency claim is
permitted. No training, model
identification, learned representation, discovered goal, general planning,
unseen-dynamics generalization, intelligence or ARC claim follows. A
depth-three receding-horizon controller is not an optimal 16-step policy.
Preserve the earlier RNN rejection, conditional-entropy premises, separate
pairwise work model and finite classical functor limits unchanged.

## A. Exact environment and information boundary

One episode has hidden state `x_t in {0,1}` and sixteen decisions `t=0..15`.
The initial state is fair. A binary cue is emitted initially and after every
decision, including an unused terminal cue: seventeen observations total.
At each decision the action is either `harvest` (key 0) or `switch` (key 1).
Use integer quarter-units to retain rewards exactly:

```text
reward4(x, harvest) = 4*x
reward4(x, switch)  = -1
x_(t+1) = x_t XOR (effect AND action_is_switch) XOR drift_t
y_t = x_t XOR cue_error_t
```

All drift bits are independent Bernoulli `q=1/8`. All cue errors are
independent Bernoulli `1-p=1/4`; all streams are independent of policy state.
The `effect` flag is true in structured panels and false in the null panel.
The correct flag, `q`, `p`, horizon, action meanings and reward function are
provided to every policy. Reward depends on the pre-transition state.
Every action produces the same type and number of noisy observations.
Invalid keys, malformed configurations and calls after decision 15 refuse
with typed errors; they do not silently become no-ops.

The policy receives only a copied and admitted cue projection, its own past
actions, its remaining horizon and the declared model. It never receives
environment state, episode index, seed, noise tape, future cues, scorer
return, private frame bands, environment `Info`, paths or runtime handles.
The realized harvest reward would reveal state, so reward is deliberately
withheld. This is an explicit reward-unobserved POMDP; the reward function
is known but realized scores are visible only to the audit/scorer. A future
reward-observed comparison requires its own registration.

Keep the runner's environment state and policy state in separate values.
Use the existing `GameEnvironment.IEnvironment` action/observation shape,
with a source-owned adapter and explicit state. Never call the convenience
one-step helper that resets the environment or gives the chooser metadata.
Reset once, render the initial cue, observe it, then repeat exactly sixteen
choose/commit-action/step/render/observe operations. The chosen key is
committed to the trace before advancing the environment. Observe the final
cue for trace and state consistency, but do not request another action.

## B. Renderer and admission

Frames have width 64, height 32 and binary palette. A cue of 0 places a
foreground mark at x=16; cue 1 uses x=48. Dot geometry uses one pixel at
y=8; bar geometry uses pixels at x, x+1 and x+2, all at y=20. The baseline
background is zero and foreground one. For the palette panel complement
every emitted cell on odd observation indices, counting the initial cue as
index zero. This is a copied-frame rendering operation.

Rows 24..31 form a private diagnostic band. Before the initial observation
it is entirely background. After a decision, put exactly one foreground
pixel at y=26: x=4 for reward4=0, x=12 for reward4=4, x=20 for reward4=-1.
All other cells in the band are background. Compose this band with the cue
before any whole-frame palette complementation. No other pixels are drawn.
The policy
projection derives the background by strict majority over rows 0..23,
refuses a tie, and fills the bottom eight rows with that background. The
decoder admits exactly one of the two cue positions in the declared
geometry, with all other cells background. It refuses wrong dimensions,
palette, geometry, extra marks and nonbinary cells. There is no geometry
search, fitted visual representation or decoding from metadata.

Geometry and palette variation test only this declared admission channel.
They do not constitute new dynamics or unseen visual reasoning.

## C. Belief and finite planning contract

Let `b=P(x=1 | admitted action/cue prefix)`. Start with prior `1/2`, update
on `y_0`, and retain a single scalar posterior. For action `a`, define
`z=1-b` for an effective switch and `z=b` otherwise. Predict
`b_minus=q+(1-2*q)*z`. The two observation probabilities and updates are:

```text
P(y=1) = p*b_minus + (1-p)*(1-b_minus)
B(b_minus,1) = p*b_minus / P(y=1)
P(y=0) = (1-p)*b_minus + p*(1-b_minus)
B(b_minus,0) = (1-p)*b_minus / P(y=0)
```

Initial conditioning uses the same `B` with prior `1/2`, without a
transition. Refuse nonfinite/out-of-range input or a nonpositive
denominator. No clipping or posterior reset repairs an invalid value.
Use IEEE float64 in the native implementation. Python replay independently
computes the same model; rational hand cases distinguish numerical agreement
from agreement about the intended semantics.

Use undiscounted finite-depth values in reward units, with `V_0(b)=0`:

```text
r(b,harvest)=b; r(b,switch)=-1/4
Q_d(b,a)=r(b,a)+sum_y P(y|b,a)*V_(d-1)(B(predict(b,a),y))
V_d(b)=max(Q_d(b,harvest),Q_d(b,switch))
```

At decision `t`, `d=min(3,16-t)`. Expand both actions and both cue outcomes
in the fixed order harvest, switch / cue 0, cue 1. Do not prune, cache,
sample rollouts, call the real environment, use private state or evaluate
beyond this depth. At depth one evaluate immediate rewards only; do not
compute unused terminal belief updates. Resolve ties within absolute
`1e-12` in favor of harvest; otherwise choose the greater value. Apply the
same tie rule in replay and the finite conformance fixture. Recursive
`V_d` uses the numerical maximum of its two Q values even when the
action-selection tolerance picks slightly lower harvest. Retain both
`DecisionQ` (the values actually used for selection) and `TreeRootQ`
(the expanded tree root); they differ intentionally for padded myopic.

| Arm, in fixed order | Decision and retained information |
| --- | --- |
| `belief-depth3` | Retain the model-correct Bayesian filter evaluated in float64; choose the depth-d root action. |
| `belief-myopic` | Retain the same filter; compute and use depth-one immediate values. |
| `belief-myopic-padded` | Retain the same filter; compute the entire depth-d tree, retain its root values in the receipt, then choose from immediate values. |
| `latest-cue-depth3` | Replace the posterior before each choice with `B(1/2,current_cue)`; expand depth d with the same supplied model. |

All four arms are deterministic. The padded arm's extra arithmetic is
intentional discarded computation, not an efficient alternative policy.
Retain the natural myopic arm's actual cost as well. The latest-cue arm is
a specified memory ablation with a deliberately reset prior, not the
optimal memoryless policy. No success threshold is attached to beating it.

An interior depth-three decision expands `1+4+16=21` belief nodes and 42
action values; depth two expands five nodes/ten values; depth one one
node/two values. There are ten predicted priors and twenty Bayesian
posterior updates at depth three, two priors/four updates at depth two,
zero at depth one. A sixteen-step depth-three or padded episode has 300 belief
nodes, 600 action values, 142 predicted priors and 284 Bayesian updates.
A natural myopic episode has sixteen nodes and 32 action values, with no
planning predictions or posterior updates. These planning counters exclude
the real-prefix filter: belief arms additionally make sixteen transition
predictions and seventeen cue-conditioning updates per episode. The
latest-cue arm instead conditions the fixed prior seventeen times and
retains no real-prefix transition predictions. Count actual executed
expansions and serialized root values; do not substitute these formulas for measurement.

The registered q=1/8, p=3/4 dynamics have an analytic design witness,
not experimental evidence. With q=1/8 and p=3/4,
`V_2(b)=max(1/8+7*b/4,5/8-3*b/4)`. Initial cue 0 gives b=1/4, where
`Q_3(harvest)=131/128` and `Q_3(switch)=69/64`, a switch advantage of
`7/128`. Initial cue 1 gives b=3/4 and value `133/64` by harvesting.
Averaging the equiprobable initial cues gives three-step value `101/64`,
versus `96/64` for always harvesting. These hand derivations were independently
checked before registration; they do not establish the 16-step empirical
threshold below. The symmetric cue channel tests delayed control under
partial observability; no active-sensing advantage is registered.

## D. Fixed streams and held-out roster

Use the existing `ResearchRandom.Stream(ResearchRandom.domain(seed,domain))`
SplitMix64 convention. Keep one stream per panel, in episode order. Consume
exactly 34 draws per episode: initial state, initial cue error, then for
each of sixteen steps one drift draw and one next-cue-error draw. A fair
initial bit is `floor(2*u)`; drift is `u<1/8`; cue error is `u>=3/4`.
Consume each draw even if an action or parameter makes it irrelevant.
Generate the exogenous tape once per episode and pass the same immutable
tape to all four arms. Policy calls cannot access the tape.

| Panel, in order | Episodes | Seed/domain | Effect | Geometry | Palette |
| --- | --- | --- | --- | --- | --- |
| `dot-switch` | 1,024 | 9101 / 911 | true | dot | fixed |
| `bar-switch` | 1,024 | 9101 / 912 | true | bar | fixed |
| `palette-switch` | 1,024 | 9101 / 913 | true | dot | odd complement |
| `dot-null` | 1,024 | 9101 / 914 | false | dot | fixed |

Each panel consumes 34,816 source draws. There are 16 arm-panels, 16,384
behavioral episodes, 262,144 actions and 278,528 emitted observations.
Common exogenous draws couple comparisons, but actions cause states and
subsequent observations to differ between arms. Do not call these identical
observation trajectories. Reset policy and environment state per episode.

These seeds and domains are held out from implementation/conformance work,
not secret from the authors. No fitting or model selection occurs. Before
the reviewed implementation archive is pushed, execute only explicit hand
tapes and conformance grids independent of this roster. Do not generate,
inspect, time or run a prefix of any registered behavior or cost stream.

## E. Falsifiers and conformance before measurement

Retain an executable fixture and its independent replay. Its complete hand
roster uses four tapes, with indices `t=0..15` and cue indices `j=0..16`:

| Tape | Initial state | Sixteen drift bits | Seventeen cue-error bits |
| --- | --- | --- | --- |
| `zero` | 0 | all zero | all zero |
| `one` | 1 | all zero | all zero |
| `alternating` | 0 | `t mod 2` | `j mod 2` |
| `sparse` | 1 | one exactly at `{0,7,15}` | one exactly at `{0,2,8,16}` |

Cross every tape with both effect flags, dot/bar/palette rendering modes and
all four arms: 96 complete hand episodes. These deterministic intervention
tapes need not be typical under the stochastic source. Retain the hand
outputs in the reviewed implementation archive before registered source
generation. Check the following in addition to this roster:

1. All eight `(x,action,drift)` state transitions for each effect flag and
   all four `(x,cue_error)` cue outcomes; exact reward quarter-units.
2. Exact rational filtering checks over priors `0,1/4,1/2,3/4,1`, both
   actions, both observations and effect flags. Compare native float64
   posteriors and depth-1/2/3 root values with independent Python rational
   filtering and exhaustive contingent-policy alpha vectors, built from
   hidden-state transition/emission tables rather than native belief
   recursion. There are 2, 8 and 128 policy trees at depths 1, 2 and 3,
   respectively; retain the maximum per fixed root action at each prior.
   Use both effect flags, q=1/8 and p=3/4; tolerance `1e-10`.
3. The q=1/8 analytic opportunity above, null identical-future action
   dominance, and terminal depth-one harvest at every admitted prior. With
   effect=false both actions have the same future distribution, while
   harvest strictly dominates the switch cost at all horizons.
4. Counterfactual same-state/same-noise switch versus harvest: in structured
   dynamics the next hidden bits differ, and in null dynamics they agree.
   Rewards still follow their distinct declared definitions in either case.
5. Alter unrevealed tape suffixes while keeping an admitted observation and
   action prefix fixed: current policy state, root values and next action
   must be unchanged. Re-execute the real runner from reset with altered
   evaluator inputs, comparing the common-prefix boundary; do not merely
   mutate a local value that the runner never reads. Do not demand equal
   later actions once cues diverge.
6. Alter admitted binary private-band patterns and scorer fields while holding the cue projection
   fixed: every policy choice must be unchanged. Mutating a caller's frame
   after observation must not mutate retained policy state.
7. Geometry/palette transformations preserve the decoded cue and decisions
   for identical semantic histories; malformed projections refuse.
8. Actual padded/natural myopic actions and returns agree on every full hand
   episode; padded/planner expansion counts agree. Altered tree depth,
   transition timing, reward timing or action mapping must be detected.
9. Duplicate/nonfinite JSON, omitted/reordered arms or episodes, changed
   protocol/source hashes, truncated traces and reused output paths refuse.

The suffix and private-field tests are bounded regression witnesses plus
an inspected policy boundary, not an adversarial process-isolation proof. A malformed
frame may cause an admission refusal; noninterference compares valid binary
frames with identical admitted upper-band pixels.
Do not claim multiple authors or independent social review from two
implementations written within this Codex team.

## F. Behavioral decision and independent replay

For each arm/episode retain complete cue, action, hidden-state, reward4,
posterior, root-Q, executed-counter and frame/projection-digest traces.
The private scorer may record hidden truth only after the selected action
is committed. Retain every episode in roster order, including failures.
Normalized return is `sum(reward4)/(4*16)`; its range is `[-1/4,1]`.

The registered behavioral conditions are all conjunctive:

- On each structured panel, the mean paired normalized return of
  `belief-depth3` exceeds `belief-myopic` by at least `0.10`.
- On every panel, natural and padded myopic actions and reward4 traces
  agree exactly; their belief histories agree within `1e-10`.
- On the null panel, all four arms always harvest and match action/return
  traces exactly. No null planning advantage may be reported.
- Every registered native/replay episode, renderer digest, action, state,
  reward and executed counter agrees exactly; posterior/Q absolute error
  is at most `1e-10`, with identical tie decisions.
- All falsifiers pass. Report the latest-cue comparison descriptively.

Report panel means and every paired difference without pooled substitution,
selected episodes, significance claims or retrofitted thresholds. This is a
finite registered benchmark, not a population inference about other tasks.
Independent replay reconstructs noise, transitions, renderer, filter and
planning values from the admitted contract and sources; it does not trust
the native receipt's `Passed` field or use its hidden states to choose.

## G. Matched resource accounting

After complete behavioral receipts and before replay, run the four arms on
one separate `dot-switch` cost corpus, seed/domain `9203/921`, 72 episodes:
eight fixed warmup episodes then 64 timed episodes. Use five replicates in
cyclic arm order, starting each replicate at arm `replicate_index mod 4`.
This gives twenty measured arm/replicate rows, 160 warmup executions and
1,280 timed executions. Reuse the same exogenous tapes in all rows, with
fresh policy/environment state per episode. Consume 2,448 source draws
once to generate the cost corpus. Do not reuse behavioral episodes.

Time whole episodes including policy construction, reset, sixteen choices,
environment transitions, all seventeen renders/projections/decodes, filter
updates, private scorer and in-memory trace/digest/counter construction.
Exclude corpus generation, source admission, process startup/JIT outside
the fixed warmup, and final disk JSON serialization. Do not add warmups,
discard a replicate, collect a replacement, disable tracing or move work
across the measured boundary after seeing costs. Retain first failures.

Record monotonic wall time, process CPU time and current-thread allocated
bytes for each timed row; divide totals by 64 for per-episode values.
Report all rows and per-arm medians. Define each cost ratio as the ratio
of the two arm medians, for example
`median(W_planner,0..4)/median(W_padded,0..4)`, not a median of paired ratios.
Require whole-episode wall and allocation ratios of planner/padded-myopic
each at most `1.25` for the combined performance claim. Refuse nonpositive
denominators, nonfinite values or missing/reordered cost rows. Report
planner/natural-myopic and latest-cue ratios regardless of outcome, without calling padded work efficient.
No CPU gate, speed-advantage, energy or resident-heap claim is registered.

Also retain observed expansion totals and logical policy-state payload
accounting separately from runtime heap/allocations. Record process/runtime,
OS, loaded binary identities, timestamps and other known local activity.
Coordinate this team's builds/tests to be idle during costs; do not claim
exclusive control of the user's host or unrelated writers.

## H. Freeze, failure preservation and publication

Review and push this exact protocol under the immutable remote tag
`archive/experiments/081M1XK02XM087G0R00043EW05-registration` before any task
implementation. Preserve an explicit source manifest and its reviewed
implementation commit under
`archive/experiments/081M1XK02XM087G0R00043EW05-implementation` before
registered tape generation, behavior or cost runs. Include both native and
Python implementations, renderer/decoder, RNG, wrappers, verdict logic and
this protocol in the manifest. Require byte equality with the archived
sources and current declared source commit. Registration must be an
ancestor of implementation; later squash-main ancestry need not retain the
implementation commit, so exact remote archives remain load-bearing.

No implementation exists when the registration tag is created. Complete
hand fixtures and independent code review precede the implementation tag.
Source corrections before registered measurement are separately committed
and reviewed. After measurement starts, never move a tag or silently amend
the protocol. A broken run remains an incomplete/non-promotable attempt;
a corrected contract requires a new version/ref and explicit disposition.

Write new receipts exclusively, retaining `.partial` output after interrupted
writes. Every receipt includes complete/failure status, protocol hash,
source manifest, arguments, environment and the exact roster attempted.
Keep raw behavior, cost, independent replay and computed verdict separately;
the verdict hashes and independently recomputes conditions from its inputs.
Absence of matching complete costs permits only a qualified behavioral
finding, not the combined promotion. No synthetic success receipt or
success-by-agreement is allowed. Source/DLL hashes identify artifacts but
do not prove a source-to-binary relationship.

Index the reviewed protocol, all outcomes (including failure) and recovery
instructions from durable research and handoff files. Publish focused PRs
with required gates and full attribution; release claims before the final
head. No hosted policy or ARC default changes are part of this experiment.

## Primary grounding

- Kaelbling, Littman and Cassandra, *Planning and Acting in Partially
  Observable Stochastic Domains*, [Brown CS-96-08](https://cs.brown.edu/research/pubs/techreports/reports/96/cs96-08.pdf),
  sections 3.1-3.3 and 4: supplied POMDP models, belief conditioning and
  finite-horizon action values. The final article appeared in *Artificial
  Intelligence* 101 (1998). The source-owned switch fixture and its
  thresholds are this registration's design choices.
- Moss, Corso, Caers and Kochenderfer, [BetaZero, arXiv:2306.00249v4](https://arxiv.org/abs/2306.00249v4),
  RLC 2024: a distinct approach combining belief planning and learned
  approximations under search budgets. This fixture neither implements nor
  competes with BetaZero, and supplies no evidence about high-dimensional
  or long-horizon planning.

Sources checked 2026-09-07. Literature supplies the mathematical framework;
it is not empirical support for this unmeasured implementation.
