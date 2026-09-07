# Hidden switch: unregistered compiled-control and model-identification advisory

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: UNREGISTERED prospective continuity note; not experimental evidence

## Status and purpose

This note preserves a prospective design discussion held before this author
inspected any registered hidden-switch behavioral, cost or replay outcome.
It creates no experiment, protocol, claim, source stream, policy arm or
promotion criterion. It supplies no seeds or new success thresholds. The
[frozen protocol](2026-09-07-hidden-switch-protocol.md), its implementation
archive, execution order and verdict remain unchanged. The coordinating
task intends to integrate this advisory only after the current behavioral
and cost work, preferably after independent replay and verdict as well.

The immediate scientific distinction is between using a supplied model for
delayed control and learning an action-conditioned model from observations.
The current task addresses the former. Before attributing an advantage to
online tree search, a separately verified compiled-controller comparison
would make the computational interpretation more precise. A subsequent
model-identification experiment could then keep the controller and visual
decoder fixed while changing where the transition model comes from.

This is bounded advisory reasoning from the protocol, the
[exact-envelope derivation](2026-09-07-hidden-switch-exact-envelopes.md), the
[implementation review](2026-09-07-hidden-switch-independent-review.md),
and the prior [passive prediction](2026-09-06-rendered-signal-predictor-results.md)
and [rendered-catch](2026-09-06-rendered-catch-actions-results.md) results.
No policy episodes, source tapes, training, benchmarks or new executable
checks were run to write it. The proposed falsifiers below are proposals,
not claims that additional tests have passed.

## Condition the next step on the current verdict

If source admission, hand conformance, registered falsifiers or independent
replay fails, the attempt remains incomplete or non-promotable under its
existing contract. Preserve the first failure and diagnose that defect
before using the result as a premise for learning or computational claims.
A correction needs its own reviewed disposition and applicable archive;
this advisory cannot authorize replacement evidence or a moved tag.

If admission and replay pass but a behavioral condition fails, report that
failure with every registered panel and comparison intact. An auxiliary
compiled-controller check may still clarify the finite model, but it
cannot rescue the failed behavioral criterion. A learning follow-up would
need a separately justified opportunity and its own prospective contract.
Do not choose that opportunity by silently screening variants until the
current intended return gap appears.

If the behavioral conditions pass but the required cost conditions fail
or complete matching costs are absent, retain only the qualified
behavioral finding permitted by the current protocol. A cheaper compiled
controller would be a separate result about a different implementation,
not a retroactive resource pass for the registered tree implementation.

If all required admission, behavioral, replay and cost conditions pass,
the earned claim remains delayed control with the supplied model under
the registered finite comparison. It does not establish that online search
is necessary, that the decoder or dynamics were learned, or that the
depth-limited controller is optimal for the full episode. A compiled
control is the strongest small next step for clarifying the computation;
model identification is the next substantive information-source boundary.

## First isolate the compiled-controller question

The exact-envelope note gives rational action-value envelopes for the
fixed supplied model. Its finite certificate compares every candidate
alpha-vector line with the asserted winner at each interval endpoint;
affinity then proves dominance throughout that interval. This supports a
possible compiled action rule in exact arithmetic. It does not establish
equivalence with the executed binary64 recursive implementation.

A future comparison should retain the same observation admission,
decoder, belief filter, reward units, remaining-depth schedule and policy
interface. Only the action-value evaluation changes. State separately
whether the target is agreement of selected actions, agreement of values
within a declared error bound, or bit-identical diagnostic Q values.
Algebraically equivalent expressions can have different rounding and
evaluation order; proving the first target does not prove the others.

The binary64 obligation includes the represented selection tolerance,
subtraction and expression rounding near every action boundary, as well as
continuation-envelope boundaries. It also includes the current distinction
between propagating the numerical maximum of child values and choosing a
slightly lower action under the tie tolerance. The exact rational
certificate alone does not settle any of those implementation details.

Useful finite checks include exact ties, immediately adjacent representable
beliefs, interval endpoints, both effect settings and each remaining depth.
Those examples are necessary regressions, not a universal equivalence
proof. For a claim covering all admitted binary64 beliefs, derive a sound
rounding-error or interval certificate for the actual recursive and
compiled computations. Alternatively, certify regions where the choice
is unambiguous and fall back to the original recursion everywhere the
bounds cannot decide. Do not guess a narrow exclusion band from sampled
agreement. Preserve the original operation and selection semantics in the
fallback, and count its actual executions and work.

Only after that separate implementation and admission work should a new
registration compare costs. Keep all ordinary episode services and traces
matched, and predeclare separate choice-only and whole-episode boundaries
if both computational and end-to-end claims matter. The passive result
already illustrates why renderer-dominated totals can hide a substantial
inference-cost difference. Record complete fast-path/fallback counts and
all scheduled cost rows; do not remove ambiguous beliefs or slow rows.

Exact action agreement with lower measured choice cost would support a
cheaper implementation of this supplied finite controller. Lack of a
whole-episode speedup would limit the practical cost claim. A disagreement
would reject the claimed implementation equivalence and require diagnosis;
it would not refute the exact rational envelope by itself. None of these
outcomes demonstrates that arbitrary planning can be compiled cheaply.

## Then vary the source of the transition model

A bounded substantive follow-up could supply the same pixel decoder,
observation reliability, reward function, action meanings, horizon and
two-state model family, while withholding only the transition parameter
and whether switching changes state. Choose a small finite family before
collecting any new data, including an effective-switch and a null case.
The family and calibration/held-out budgets would require a new reviewed
registration; this note selects neither their roster nor their thresholds.

Collect one fixed, policy-independent calibration set per setting using
the same predeclared action schedule for all estimators. The learner sees
only those committed actions and admitted cues. Hidden states, realized
private rewards, source identities, true parameter labels and future
held-out data remain evaluator-owned. Fit a transition model using a
bounded exact forward-likelihood comparison over the supplied family,
then freeze and hash that fitted artifact before held-out control. This
first step needs no learned pixel representation, architecture search or
online adaptive exploration.

Use the same controller with the fitted model, the supplied true model
and a fixed default model. Add an action-blind estimator given the same
calibration records and fitting budget but prohibited from conditioning
transitions on action. Its exact likelihood family and refusal behavior
must be specified; do not silently give it a different observation
channel. A matched myopic control helps distinguish use of an acquired
model for future values from a predictive fit with no control benefit.

The supplied-true-model depth-limited controller is a reference, not an
optimal full-horizon upper bound. A misspecified fitted model can
accidentally compensate for horizon truncation. Therefore a return
difference from that reference must not be called nonnegative regret, and
beating it alone is not evidence of more accurate dynamics learning.

Report held-out action-conditioned predictive loss and, where identifiable
in this declared family, parameter recovery alongside every control-return
comparison. Better prediction without better control would support model
identification under the supplied family, not useful planning. Better
control without the prediction diagnostics or action-conditioning
ablation would not establish that learning dynamics caused the gain.
Agreement of both types of evidence would support use of an acquired
action-conditioned model for finite control within this supplied family.

## Identifiability limits and proposed falsifiers

The observation channel must carry state information, and calibration must
exercise actions that distinguish the candidate transition laws. For an
auxiliary channel with independent fair cue noise, the observation law
contains no transition information; a learner cannot identify dynamics
from those cues and exogenous actions. More generally, parameter recovery
is meaningful only when different admitted candidates induce different
observable action/cue laws under the actual calibration design.

The supplied cue orientation and reliability above chance fix a semantic
state-label convention. The supplied reward mapping also names which
state has harvest value, although realized private rewards are not
learner inputs. This removes an ambiguity by assumption; it is not
discovery of latent meanings. Finite sample error remains even when the
candidate family is identifiable. The future contract should distinguish
non-identifiability, estimation failure and correct refusal instead of
requiring a confident parameter choice in every case.

Before source generation, an independent exact-likelihood checker and
bounded hand fixtures should exercise at least these failure modes:

- Changing action labels or transition timing must change the likelihood
  on an explicitly distinguishing hand history. A fitter that ignores
  effective actions must fail that witness.
- Altering future held-out data, hidden states, private scorer fields or
  source metadata must leave the fitted artifact and each common-prefix
  decision unchanged. Execute the real fitting and runner boundaries,
  rather than mutating an unused local variable.
- For a constructed information-free observation channel, candidate
  likelihoods must agree where the mathematical law says they agree.
  Parameter confidence cannot be obtained from hidden labels or metadata.
- A frozen fitted artifact must replay from its admitted calibration
  records and source identity; missing, changed or reordered inputs and
  malformed artifacts must refuse with retained failure evidence.
- Any compiled-controller certificate or fallback claim must still hold
  for the parameters actually used. The fixed-model envelope cannot be
  reused for a learned parameter without a new derivation or safe
  recursive path.

Implementation can remain limited to the finite-family likelihood fitter,
immutable fitted-model receipt, independent likelihood checker and
matched source-hidden evaluation wrappers. Reuse the existing admitted
renderer and policy chronology. Model fitting and control replay should
have distinct source paths, while shared protocol assumptions remain
explicit. No general learning framework or new perception stack is needed
for this boundary.

Even a successful follow-up would not earn learned representation,
discovered objectives, learned model structure, generalization to an
unseen dynamics family, active information gathering or online-search
necessity. Those are separate questions. This advisory remains prospective
until a new registration and its own retained evidence exist.
