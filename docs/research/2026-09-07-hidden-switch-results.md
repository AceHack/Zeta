# Hidden switch: registered planning and matched-work control

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Measurement status: complete; all registered criteria passed

The supplied-model depth-three planner improved mean normalized return over
natural myopic behavior by 0.124832, 0.106766 and 0.117310 on the three
registered action-effective panels. Each exceeds its separate 0.10 threshold.
Independent replay matched every one of 16,384 behavioral episodes and 1,440
cost executions with zero mismatches and zero maximum numerical error. The
registered whole-episode planner/padded-control ratios were 1.005629 for
wall time and 1.000000 for allocation, both below 1.25. The
[computed verdict](hidden-switch-results/2026-09-07/verdict-attempt-1.json)
admits the inputs and marks the bounded combined result eligible.

This result concerns a supplied correct model, decoder, action meanings and
goal. It does not establish model learning, representation discovery, ARC
performance or the necessity of online tree search. The matched-work control
intentionally performs and discards planning. Against natural myopic work,
the planner's observed median wall-time and allocation ratios are 1.280368
and 1.716583; matching discarded work does not make that work efficient.

## Frozen design and chronology

The [protocol](2026-09-07-hidden-switch-protocol.md) was remotely registered
at `6a3150037a1e6be6ae89996dc8562f2061f7c75d` before implementation.
The [reviewed implementation](2026-09-07-hidden-switch-implementation-review.md)
was archived at `4fc82b611012bd2620a26e02afe6baba491fe553` and independently
verified remotely at 12:15:01 UTC before any registered source generation.
Its nineteen admitted source/contract/hand-fixture hashes match the explicit
[manifest](hidden-switch-validation/2026-09-07/implementation-source-manifest.json).
The manifest's earlier source commit identifies the same scientific bytes;
the implementation archive additionally preserves the completed integration
and validation history. Both archives are annotated, immutable refs, and
registration is an ancestor of implementation. Original independent-reference
and native-authoring histories also have separate remote annotated archives.
Exact tag objects and peeled commits are in the
[archive verification](hidden-switch-results/2026-09-07/archive-verification.json).

The behavior CLI ran once, from 12:15:04.391 to 12:15:09.145 UTC; the cost CLI
ran once, from 12:15:12.418 to 12:15:15.862 UTC. These are receipt boundaries,
including admission; they are not the narrower timed-row measurements. Both
completed at the same archived HEAD, using unchanged Core and Core.Abstractions
DLL byte hashes and MVIDs on .NET 10.0.11 / macOS 26.6.2. The separate Python
replay completed at 12:17:05 UTC; the verdict independently reconstructed the
same trajectories again and completed at 12:17:52 UTC. All four recorded the
same archived source commit. No registered run failed, no row was replaced,
and no extra warmup or timing rerun was collected. Earlier implementation,
compiler and TLC failures remain in the separate
[validation history](hidden-switch-validation/2026-09-07/README.md).

Each panel has 1,024 exogenous tapes shared across its four arms. Actions
change subsequent state and observation histories, so sharing noise does not
mean that different policies see identical trajectories. The environment has
a hidden bit, noisy rendered cues and action-dependent transitions. Policies
receive the projected top-frame cue, their own state and the supplied model;
the private reward band and realized scorer output are withheld. Decisions
are committed before each environment step. The exact finite environment,
source seeds/domains, observation projection, tolerance and action order are
specified by the frozen protocol.

## Behavioral observations

Mean normalized return is the sum of integer reward-quarter units divided
by `64 * 1024` for each panel/arm. Natural and padded myopic traces have
identical actions, rewards and beliefs in every panel. The latest-cue arm is
descriptive, not a separately registered promotion threshold.

| Panel | Belief depth 3 | Natural myopic | Padded myopic | Latest-cue depth 3 | Planner gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| dot-switch | 0.612930298 | 0.488098145 | 0.488098145 | 0.429916382 | 0.124832153 |
| bar-switch | 0.605239868 | 0.498474121 | 0.498474121 | 0.433883667 | 0.106765747 |
| palette-switch | 0.607482910 | 0.490173340 | 0.490173340 | 0.417190552 | 0.117309570 |
| dot-null | 0.502258301 | 0.502258301 | 0.502258301 | 0.502258301 | 0.000000000 |

All four null-panel arms selected harvest for every action and obtained
identical episode rewards. Each action-effective gain passed separately;
there was no pooling, threshold change, significance test or post-result
selection of favorable panels. Independent replay compared all 262,144
actions and their complete cue, belief, Q-value, state, reward, frame-hash,
projection-hash and counter traces. The hand comparison separately covers
96 episodes, 16 transitions, four cue rows, 40 conditioning rows and 30
planning rows, with maximum absolute error `2.7755575615628914e-17`.
All ten native/reference falsifiers passed: action effect, suffix isolation,
private-band isolation, scorer isolation, caller-frame isolation, geometry
and palette invariance, malformed-input refusal, padded equivalence,
counter accounting and null dominance.

## Resource observations

Each of five replicates executes all four arms in the fixed cyclic order.
Every row retains eight warmup and 64 timed episodes: 160 warmup and 1,280
timed executions total, from one separate 72-tape corpus consuming 2,448
draws. The twenty rows repeat this one corpus; they are not twenty
independent samples of tasks. Timed whole episodes include construction/reset, sixteen decisions
and transitions, seventeen renders/projections/decodes, filtering, scorer and
in-memory trace/hash/counter work. Corpus generation, admission, process
startup/JIT outside the fixed warmup and final JSON serialization are
excluded. Costs were not remeasured during either Python replay.

The following are medians of the five row totals divided by 64. Ratios use
the ratio of these per-arm medians, as registered; CPU is descriptive only.

| Arm | Wall ms/episode | Process CPU ms/episode | Allocated bytes/episode |
| --- | ---: | ---: | ---: |
| belief-depth3 | 0.202149734 | 0.202781250 | 220425.375 |
| belief-myopic | 0.157884125 | 0.160093750 | 128409.375 |
| belief-myopic-padded | 0.201018234 | 0.200937500 | 220425.375 |
| latest-cue-depth3 | 0.203484375 | 0.203296875 | 220425.375 |

| Planner divided by | Wall ratio | CPU ratio, descriptive | Allocation ratio |
| --- | ---: | ---: | ---: |
| belief-myopic | 1.280367702 | 1.266640640 | 1.716583193 |
| belief-myopic-padded | 1.005628843 | 1.009175739 | 1.000000000 |
| latest-cue-depth3 | 0.993441066 | 0.997463685 | 1.000000000 |

All twenty observed totals remain visible below. Early rows are substantially
higher than later rows; for example, the first planner row is 0.960579 ms per
episode, versus its 0.202150 ms median. Allocation also differs in early
rows. The fixed median criterion passes with those rows included; this is
not a steady-state or timing-stability claim. No cause is inferred from the
ordering, and no replacement or additional warmup is used to remove it.

| Replicate | Order | Arm | Wall ms total | Process CPU ms total | Allocated bytes total |
| ---: | ---: | --- | ---: | ---: | ---: |
| 0 | 0 | belief-depth3 | 61.477042 | 61.479 | 14162008 |
| 0 | 1 | belief-myopic | 56.211042 | 56.181 | 8272984 |
| 0 | 2 | belief-myopic-padded | 59.863042 | 68.553 | 14162008 |
| 0 | 3 | latest-cue-depth3 | 59.251250 | 59.196 | 14162008 |
| 1 | 0 | belief-myopic | 54.761791 | 80.599 | 8272984 |
| 1 | 1 | belief-myopic-padded | 23.470166 | 46.736 | 14127104 |
| 1 | 2 | latest-cue-depth3 | 12.492167 | 12.497 | 14107224 |
| 1 | 3 | belief-depth3 | 12.527042 | 12.529 | 14107224 |
| 2 | 0 | belief-myopic-padded | 12.367625 | 12.361 | 14107224 |
| 2 | 1 | latest-cue-depth3 | 13.038125 | 13.033 | 14107224 |
| 2 | 2 | belief-depth3 | 12.812125 | 12.798 | 14107224 |
| 2 | 3 | belief-myopic | 9.759916 | 9.762 | 8218200 |
| 3 | 0 | latest-cue-depth3 | 13.023000 | 13.011 | 14107224 |
| 3 | 1 | belief-depth3 | 13.154833 | 13.146 | 14107224 |
| 3 | 2 | belief-myopic | 10.104584 | 10.246 | 8218200 |
| 3 | 3 | belief-myopic-padded | 12.690917 | 12.681 | 14107224 |
| 4 | 0 | belief-depth3 | 12.937583 | 12.978 | 14107224 |
| 4 | 1 | belief-myopic | 9.661166 | 10.177 | 8218200 |
| 4 | 2 | belief-myopic-padded | 12.865167 | 12.860 | 14107224 |
| 4 | 3 | latest-cue-depth3 | 12.674166 | 12.635 | 14107224 |

The three planning arms each expand 300 nodes, evaluate 600 action values,
and perform 142 hypothetical predictions plus 284 hypothetical updates per
episode. Natural myopic work uses 16 nodes and 32 action values with no
hypothetical prediction/update. Belief filters perform 16 predictions and
17 updates; the latest-cue arm performs zero filter predictions and 17
updates. These logical counts are distinct from measured allocations.

Every arm reports one Float64 belief slot, zero stored Float64 model slots
(the probabilities are code constants), one model Boolean, four Int32
chronology slots, a 2,048-byte frame and a 2,048-byte projection. This is a
partial numeric/frame ledger. It excludes object headers, strings, options,
recursion, Q arrays, traces, digests, allocator overhead and peak heap.
There is no energy, resident-memory or peak-allocation claim.

Team builds, tests, lints, training and push hooks were held idle during
costs. The user session, system services, browsers and other agent
applications remained running; unrelated writers were outside that
coordination. Before/after process-name snapshots contain no command
arguments. They disclose sampled activity, not proof of exclusive host
control or absence of overlap throughout every timed row. Exact declarations
and snapshots are indexed in the [raw records](hidden-switch-results/2026-09-07/README.md).

## Validation, review and interpretation

The [postmeasurement review](2026-09-07-hidden-switch-result-review.md)
independently verifies original-byte bindings, chronology, roster counts and
all scalar returns, medians and ratios. It performs no new measurement or
third full reference replay.

Before archival, the combined mapped Release build passed with zero
warnings/errors, and the full native suite passed 7,552 cases with six
existing skips. All 52 registered TLC model cases, eighteen TLC metadata
and synthetic checks, and sixteen native hidden-switch tests passed.
The Interp suite passed 431 cases. Final unrelated-main/receipt integration
passed 63 Core.Python tests and 26 TypeScript tests with 54 assertions on
Bun 1.3.13; quick preflight and the implementation push hook each passed all
sixteen checks. These are scope-specific engineering gates, not empirical
support for the behavioral hypothesis. Their exact commands, source hashes,
failures and raw logs are retained in the validation index.

The [exact-envelope note](2026-09-07-hidden-switch-exact-envelopes.md) derives
rational action boundaries for this supplied finite model. A separately
verified compiled controller may realize the same actions, so this result
does not establish that online tree search is necessary. The depth-three
controller is also not claimed optimal for the full sixteen-step horizon.
The [prospective follow-up advisory](2026-09-07-hidden-switch-prospective-model-identification.md)
is explicitly unregistered and introduces no replacement criterion for this
completed experiment.

Independent authorship means separate writers and implementations within
one OpenAI Codex team, not independent institutions. Source hashes, archived
commits and loaded assembly identities preserve specific artifacts; they do
not prove process isolation or source-to-binary derivation. The raw replay
and verdict establish conformance of these retained finite observations to
the archived contract, not a universal empirical or physical claim.


## Descriptive figure from the retained observations

The [figure and reproducible rendering record](hidden-switch-results/2026-09-07/descriptive-figure/README.md)
show all sixteen panel/arm means and every original timing row. Values are
recomputed from the retained receipts and checked against the original
verdict. The cost panel preserves collection order and includes the first
planner row, `61.477042 / 64 = 0.96057878125` milliseconds per whole episode.
The twenty rows repeat the same corpus; they are not twenty independent
task samples. No row is removed, and no uncertainty interval, steady-state
interpretation or cause of the early higher costs is inferred.

This figure was prepared after measurement and is a descriptive rendering,
not a newly preregistered analysis or an additional experiment. The original
receipt bytes, eighteen-record manifest and results archive remain unchanged.
