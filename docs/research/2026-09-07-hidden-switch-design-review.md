# Hidden switch preregistration: design review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Disposition: accepted before implementation and registered measurements

## Scope and independence

The root writer and two separately tasked Codex reviewers inspected the
[protocol](2026-09-07-hidden-switch-protocol.md), prior rendered-catch result,
existing environment/planning APIs, and primary POMDP literature. This is
separate review within one Codex team, not three independent institutions,
authors or empirical replications. No task implementation, registered tape
generation, outcome simulation or cost measurement occurred during review.

## Findings resolved before freeze

- Replaced the contextual-bandit action effect with a hidden-state switch
  carrying an immediate quarter-unit cost. Harvest scores pre-transition
  state; action, drift and next cue have a fixed order.
- Kept q=1/8 drift and p=3/4 cue accuracy. Independently hand-derived the
  registered-model depth-three switch advantage 7/128 at posterior 1/4,
  and the initial three-step expected gap 5/64 over always harvesting.
  These are analytic design checks, not the proposed sixteen-step result.
- Fixed all pixels, including bar offsets, initial private band, three
  reward markers and whole-frame palette complementation order. Removed
  optional renderer decisions after registration.
- Corrected the precision claim to model-correct Bayesian filtering evaluated
  in float64; independent rational conditioning and alpha-vector enumeration
  check intended semantics on a bounded grid.
- Fixed depth-one to immediate values only. A full planning episode executes
  300 belief nodes, 600 action values, 142 predicted priors and 284 planning
  posterior updates. Its actual-prefix filter adds sixteen predictions and
  seventeen updates; these are separate counters.
- Specified numerical V=max(Q) separately from tolerance-based action ties.
  Padded myopic retains both actual decision values and expanded tree values.
- Added the exact 2/8/128 contingent-policy-tree oracle and all 96 hand
  episodes. The oracle uses explicit hidden-state transition/emission tables,
  rather than copying the native belief recursion.
- Required suffix and private-input falsifiers to re-execute the actual
  runner. Valid private-band perturbations are distinguished from malformed
  frame refusals, which may alter admission status.
- Fixed cost comparison to the ratio of per-arm medians, with all five
  replicates retained. The padded arm discards intentional work; the natural
  myopic arm remains necessary to report the real cost tradeoff.

## Claims deliberately unearned

The known model, goal, action meanings and pixel decoder are supplied.
Realized reward is withheld to prevent an undeclared state observation.
Common noise tapes do not make action-dependent observation histories equal.
The latest-cue controller is a specified memory ablation, not an optimal
memoryless policy. The finite alpha oracle is not a fully observed behavioral
upper bound or an optimal sixteen-step policy. The existing full-state
CHIP-8 navigation machinery would be privileged and is not reused as the
source-hidden planner.

A return improvement cannot prove online search is necessary. This two-state
problem admits piecewise-linear finite-depth values and small action
thresholds; no best compiled-controller comparison is registered. Equal
cue quality across actions also earns no active-sensing claim. The proposed
0.10 normalized sixteen-step gain remains falsifiable even though a shorter
analytic planning opportunity exists. No threshold was chosen from generated
outcomes.

No RNN, learned dynamics, hosted ARC, identity-controller count, physical
invariance or CQM/WSet-equivalence claim is added. Earlier records and their
failed attempts remain unchanged.

## Publication and implementation boundary

Push the accepted protocol and this review before creating the immutable
registration tag named in the protocol. Tag resolution and protocol digest
will be recorded in the implementation report. The next phase may implement
only after the remote registration is verified, and may measure only after
its complete reviewed native/Python source archive is remotely preserved.
