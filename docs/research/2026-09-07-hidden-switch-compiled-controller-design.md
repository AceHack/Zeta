# Hidden switch: draft compiled-controller equivalence contract

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Original design context: completed task 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: UNREGISTERED design and paper derivation; no implementation or measurement

## Decision and scope

Use two certified binary64 guard constants at each effective depth, with
the original recursive evaluator as the fallback between them. Derive the
guards from a uniform forward-error bound against the exact action-value
envelopes. This can establish action equivalence without enumerating every
binary64 belief or executing the tree on every fast-path call.

This is a prospective follow-up to the
[unregistered advisory](https://github.com/Lucent-Financial-Group/Zeta/blob/f52b00065eb8055a32aea4bd93628df7537f4949/docs/research/2026-09-07-hidden-switch-prospective-model-identification.md)
and [exact envelopes](https://github.com/Lucent-Financial-Group/Zeta/blob/4fc82b611012bd2620a26e02afe6baba491fe553/docs/research/2026-09-07-hidden-switch-exact-envelopes.md). The
coordinator reported completion of the current registered experiment
before requesting this design. This author did not inspect its raw
behavioral/cost data for this task. No claimed current result or numerical
performance observation is needed for the derivation below.

The target source is `HiddenSwitchPolicy.evaluate` followed by `select`
in the current experiment's archived source commit
`4fc82b611012bd2620a26e02afe6baba491fe553`. Its implementation was previously
reviewed in the [independent source review](https://github.com/Lucent-Financial-Group/Zeta/blob/4fc82b611012bd2620a26e02afe6baba491fe553/docs/research/2026-09-07-hidden-switch-independent-review.md).
This note changes no archived source, receipt, tag, protocol or threshold.
It chooses no new seed, sample size, warmup schedule or performance
acceptance threshold. A separate reviewed registration and implementation
archive would be required before any new source generation or measurement.

The proposed first target is exact equality of the selected action for
every admitted finite binary64 belief in `[0,1]`, both effect flags and
depths one through three, on a declared arithmetic execution model.
Include both signed zeros. Invalid beliefs, depths and malformed
certificates refuse. Do not return harvest merely because a NaN makes
both comparisons false.

This target does not require bit-identical Q arrays, identical allocation,
identical tree counters or identical expression rounding. It is stronger
than action agreement on a finite episode roster, but conditional on the
specified source and arithmetic semantics. The end-to-end controller keeps
the same supplied decoder, model, reward meaning, filter and chronology.
It learns no representation, dynamics or objective and does not solve the
optimal full-horizon problem.

## The actual numerical selector

Let `b` denote the exact real value represented by the admitted binary64
input. Write `Q_d(a,b)` for the exact Bellman envelope and `Qhat_d(a,b)`
for the pinned recursive computation. Let `RN` mean the admitted binary64
rounding operation and let `epsilon_N` be the exact dyadic value represented
by the native `1e-12` literal, obtained from its verified bits.

The native action is switch exactly when

```text
Dhat_d(b) = RN(Qhat_d(S,b) - Qhat_d(H,b)) > epsilon_N.
```

The subtraction is part of the computation being certified. Substituting
the exact decimal tolerance, or comparing the exact envelope difference
without bounding this subtraction, would target a different selector.
Equality selects harvest. The recursion propagates the numerical maximum
of child Q values even when the selector would choose slightly lower
harvest under its tolerance.

For the effective model, the exact gap `Delta_d=Q_d(S)-Q_d(H)` is:

| Depth | Belief interval | Exact gap |
| --- | --- | --- |
| 1 | `[0,1]` | `-1/4-b` |
| 2 | `[0,1]` | `1/2-5b/2` |
| 3 | `[0,17/42]` | `51/64-95b/32` |
| 3 | `[17/42,25/42]` | `17/16-29b/8` |
| 3 | `[25/42,1]` | `43/64-95b/32` |

Adjacent depth-three pieces agree at their shared endpoint, and every
piece has strictly negative slope. The null model has gap `-1/4-b` at
every depth because its two actions have the same future law. These
identities follow from the exact-envelope certificate, not native timing.

## A conservative paper error bound

The following source-specific derivation offers a small certificate
obligation. It is not an executed proof-assistant result. Before a fast
path is admitted, an independent checker/reviewer must validate the range
and rounding premises, the recurrence, and the connection to the actual
loaded computation. Constants below are deliberately loose analytical
bounds, not fitted guard widths or empirical success thresholds.

Assume correctly rounded binary64 elementary operations, round to nearest
with ties to even and gradual underflow, with the source's operation
order. Let `eta=2^-48`. For each exact elementary-operation result with
absolute value at most eight, its rounding error is at most `eta`; this
is a coarse consequence of the binary64 half-ulp bound, also covering
subnormals. The range induction below keeps all such results inside
that interval. Flocq's documented rounding theorems supply the general
half-ulp framework; the bounds and application here are this draft's
own derivation. [Flocq rounding theorems](https://flocq.gitlabpages.inria.fr/theos.html#rounding-to-nearest)

The model's fixed probability and reward constants are exactly
representable; the selector tolerance is handled by its actual bits.
Starting from the exact value of a binary64 belief, the native prediction
has error at most `3*eta`: the effective complement contributes at most `eta`, followed
by multiplication and addition. Its exact counterpart lies in
`[1/8,7/8]`, so the rounded predicted prior remains strictly inside
`[0,1]`.

For conditioning at any admitted binary64 prior `v`, let
`m(v)=l1*v+l0*(1-v)` and `n(v)=l1*v`, with likelihoods `1/4` and `3/4`.
The source's computed mass differs from `m(v)` by at most `4*eta` and its
computed numerator differs from `n(v)` by at most `eta`. Since
`m(v)>=1/4`, the computed mass is greater than `1/8`. Also
`0<=n(v)<=m(v)`. Therefore the difference between the unrounded quotient
of computed numerator/mass and `n(v)/m(v)` is bounded by

```text
(eta + 4*eta) / (1/8) = 40*eta.
```

The final division rounding adds at most `eta`. The exact conditioning
map has derivative `3/(16*m(v)^2)`, at most three on `[0,1]`. Including
the predicted-prior error gives a posterior error at most `50*eta`
relative to conditioning the exact action-predicted prior. The computed
observation probability differs from its exact counterpart by at most
`6*eta`, since the exact mass is Lipschitz with constant `1/2`.

At an exact action-predicted prior the two possible exact posteriors lie
in `[1/22,21/22]`. The `50*eta` error cannot reach either admission edge.
Thus recursive posterior admission and positive denominators are part of
the proposed bound, not an assumption that failed calls disappear.

For a remaining depth `n`, every contingent tree's two hidden-state
values lie between `-n/4` and `n`. Its affine belief value is therefore
Lipschitz with constant at most `L_n=5n/4`. The maximum over trees has
the same Lipschitz bound, with exact Bellman value in `[0,n]`. This
bound does not require identifying which child tree wins near a kink.

Let `E_d` bound either native root Q error uniformly over admitted
binary64 beliefs. Depth one returns the exactly represented immediate
reward, so `E_1=0`. The maximum of two finite values is nonexpansive in
their maximum absolute error. A continuation with `n=d-1` then has
child-value error at most `E_n+50*L_n*eta`. Bound its computed probability
by two, the exact child value by `n`, and account for one product rounding:

```text
one weighted continuation error
  <= 2*E_n + (100*L_n + 6*n + 1)*eta.

E_d <= 4*E_(d-1) + (4 + 262*(d-1))*eta.
E_1 = 0; E_2 = 266*eta; E_3 = 1592*eta.
```

The last recurrence includes both continuation products and the two
left-associated additions to the immediate reward. It allows the two
rounded observation probabilities not to sum exactly to one.

The range premise closes by depth induction. Computed depth-one maxima
are in `[0,1]`; computed depth-two maxima are within `E_2` of `[0,2]`;
depth-three maxima are within `E_3` of `[0,3]`. Individual computed
probabilities are below one, using the conditioning bounds. Even the
looser intermediate sum of two child magnitudes plus an immediate reward
is below eight. Numerator/mass quotients are below four because
`(3/4+eta)/(1/4-4*eta)<4`. Prediction/conditioning intermediates and the final Q
subtraction also stay within eight. No overflow or unbounded cancellation
error is being omitted.

The final selector subtraction yields

```text
abs(Dhat_d(b) - Delta_d(b)) <= rho_d = 2*E_d + eta.
rho_1 = eta; rho_2 = 533*eta; rho_3 = 3185*eta.
```

This bound concerns the numerical maximum recursion, not the return of
the tolerance-selected contingent policy. It does not rely on exact
equality of any separately rounded harvest/switch continuation.

## Derive inward guard bits and fall back on uncertainty

For effective depths two and three, define exact rational cuts:

| Depth | Lower cut `r_minus` | Upper cut `r_plus` |
| --- | --- | --- |
| 2 | `1/5 - (2/5)*(epsilon_N+rho_2)` | `1/5 - (2/5)*(epsilon_N-rho_2)` |
| 3 | `51/190 - (32/95)*(epsilon_N+rho_3)` | `51/190 - (32/95)*(epsilon_N-rho_3)` |

Below `r_minus`, the exact gap minus its error bound is strictly greater
than `epsilon_N`, so the native selector must switch. At or above
`r_plus`, the exact gap plus its error bound is at most `epsilon_N`, so
it must harvest. The proposed certificate must check the cuts lie inside
the appropriate interval and in order. For depth three both cuts lie
strictly below `17/42`; continuity and monotonicity of all three gap
pieces extend the harvest proof through both continuation kinks to one.

Generate guard constants with exact rational arithmetic and an independent
binary64 encoder/decoder:

- `Smax` is the largest admitted binary64 value strictly below `r_minus`.
- `Hmin` is the smallest admitted binary64 value at or above `r_plus`.

Store their exact bit patterns, not unchecked decimal approximations.
Check the decoded rationals and their representable neighbors against the
strict/non-strict inequalities. A cut exactly representable as binary64
requires stepping downward for `Smax`; `Hmin` may include an exact cut.
No concrete guard bits are generated in this draft.

The runtime contract, after validating the source/certificate and input,
is: choose switch when `b<=Smax`; choose harvest when `b>=Hmin`; otherwise
invoke the admitted original `evaluate` and `select` unchanged. Because
the comparisons operate on finite represented values, no runtime
evaluation of a rational boundary or piecewise Q expression is needed.
Record which path actually executed. Do not use the nearest guard action
inside the uncertainty band, silently clamp the belief, or cache a
previous action there.

Depth one and all null depths have exact gap at most `-1/4`. Certifying
`-1/4+rho_d<=epsilon_N` establishes harvest over their entire admitted
domain. Until the applicable certificate is admitted, those cases also
use the original recursion. Invalid certificates refuse; an explicitly
unsupported runtime may use a labeled recursion-only mode with fast paths
disabled, but cannot claim that a numerical certificate covered it.

The uniform value bound covers changes in the maximizing child tree near
both continuation kinks, so an additional runtime kink band is unnecessary
for this action-only design. A future design that directly evaluates
piecewise Q formulas needs separate rounding/branch certification at those
kinks; it cannot inherit bitwise value equivalence from this action proof.

## Independent certification and runtime boundary

The certificate surface can stay small: the complete alpha-vector endpoint
certificate; the rounded arithmetic graph and range/error obligations;
the exact selector literal; the derived rational cuts and guard bits;
and the native source/runtime identity to which they apply. An independent
exact-rational checker should validate the inequalities and guard encoding
without importing the compiled policy. It should reject omitted pieces,
changed constants, invalid bounds, wrong strictness and different source
identities.

For a stronger formal claim, encode the rounded prediction and
conditioning expressions and the error recurrence in a proof system.
Gappa models rounding operators and can produce proof obligations usable
with a lower-level proof assistant; its documentation and the authors'
paper describe that workflow. This draft has not installed or run Gappa,
Flocq or a proof assistant, and choosing such a checker remains an
implementation decision. [Gappa tool integration](https://gappa.gitlabpages.inria.fr/gappa/tools.html),
[de Dinechin, Lauter and Melquiond, certifying floating-point implementations](https://arxiv.org/abs/0801.0523).

An inequality checker over a handwritten expression is not proof that
the source, IL and JIT executed that expression. Preserve source and loaded
assembly identities, record the runtime/architecture and rounding behavior,
and independently inspect the relevant compiled operation graph. Any
reassociation, fused operation, extended precision or different arithmetic
mode must be covered by the bound for its actual operation graph, or
disable the fast path. A hash alone does not prove source-to-binary
derivation, and a few floating-point probes do not certify a whole JIT.
State the resulting formal-model and inspected-runtime limits explicitly.
Cover every executable JIT/code version during the admitted run, or freeze
a configuration that prevents a transition to uninspected code. A single
disassembly and assembly hash do not cover later optimized tiers.

Useful implementation regressions, after separately reviewed registration
and implementation archival, include
both signed zeros, subnormal beliefs, one, malformed inputs, all depths,
both effect flags, exact decoded guard endpoints and their neighbors,
beliefs inside the fallback band, and neighbors of every rational kink
and tolerance-shifted root boundary. Require the real fallback strictly
between `Smax` and `Hmin`, including near ties, and in the labeled
unsupported-runtime mode. At guard endpoints and kink neighbors, check
the appropriate certified path and action. Malformed inputs/certificates
must refuse. Mutated
guard direction, inclusive switch tie, omitted final-subtraction error,
invalid source admission or an ignored fallback must fail. These checks
support the source connection and detect defects; finite grids cannot
replace the universal numerical certificate.

## Matched control and cost measurements

Keep the frozen experiment unchanged. A new small action-only wrapper
can use the existing public prediction, conditioning and decoder functions
in one shared filter/chronology adapter for both new strategies. Its native
strategy calls the original recursive evaluator and selector. Its compiled
strategy uses only the admitted belief, effect flag and remaining depth,
with recursion in the uncertain band. The policy receives no noise tape,
private state, score, source identity or future observations. Preserve
independent episode replay and same-prefix/private-field interventions.

This wrapper needs its own conformance comparison with the frozen complete
runner; do not assume that duplicating chronology around a private policy
record preserves behavior. Once the same action is established at each
prefix and the same filter/environment functions are used, identical
subsequent states, cues and rewards follow inductively for a shared tape.
The new roster should still be independently replayed to check the actual
adapter. Any action disagreement is an equivalence failure, irrespective
of whether aggregate return happens to match.

Use two explicitly distinct cost boundaries in a future registration:

Perform one-time archive/certificate validation symmetrically before
timing, disclose its setup cost separately, and retain per-choice input
admission, dispatch and actual guard/fallback work inside both timed arms.
The registration must state these boundaries explicitly; excluding setup
from only the compiled arm would compare different services.

- Choice-only: the same ordered admitted belief/effect/depth inputs for
  both strategies, prepared outside the timed region. Include complete
  declared ordinary-history and boundary/fallback-stress rosters, report
  them separately, and consume selected actions so work cannot disappear.
  Include argument admission, dispatch, actual guard/fallback work and
  equal action/work-record construction in both timings. Exclude fitting,
  rendering and source generation. Measure the original evaluator's real
  internal allocations rather than an analytically substituted count.
- Whole episode: match reset, admitted rendering/decoding, filtering,
  environment steps, private scorer and action-level trace/digest work.
  Count actual native expansions and compiled comparisons/fallbacks.
  Report timings, CPU and allocation with the same schedule and complete
  failure-retaining rows. No promise of a whole-episode speedup follows
  from fewer choice operations.

Both cost arms must use the same output contract. Requiring the original
full recursive Q arrays at every compiled choice would reintroduce the
discarded computation. Removing those arrays only from the compiled arm
would instead compare different services. The bounded recommendation is
a new matched action-level receipt schema for both arms, explicitly
distinct from the original full-Q experiment. A separate untimed audit
may retain native Q values and certificate/fallback diagnostics; its work
must never be hidden inside an alleged fast-path cost or represented as
work done by the compiled arm.

Report every fast-path and fallback count and all declared cost rows,
including a wholly recursive result. Freeze corpus sizes, runtime
admission, warmup, repeat/order schedule and reporting rules before any
new cost data. This draft does not set them. Never tune the proof band on
observed speed or observed beliefs; a tighter independently proved bound
would be a new certificate version with its own disclosed chronology.

Certified action equivalence plus lower measured choice cost would earn a
cheaper implementation of this fixed supplied controller on the admitted
runtime and measured input roster. Equal end-to-end cost would restrict
the practical claim. Failure to certify or accelerate remains informative:
it does not turn the earlier return advantage into proof that online tree
search is necessary. No outcome here establishes a general compilation
result, learned planning, unseen-model performance or full-horizon
optimality.

## Review disposition

The original draft is retained at `4332b1bed3ed2e516c8188e5d928e8bd6dd1af3e`.
Independent mathematical review reproduced the paper error recurrence
under its declared arithmetic/source premises. This follow-up resolves
four pre-registration clarifications: fallback wording had also appeared
to cover certified endpoints; execution depends on registration/archive
review rather than another human approval; runtime admission must cover
all code versions that can execute; and excluded one-time setup must be
symmetric and separately disclosed. No guard, policy, source stream,
proof assistant, test or performance measurement was run for this change.

The successor task imports the original design unchanged at `c04cdc867`,
its focused correction at `f5a56399f`, and the
[independent paper review](2026-09-07-hidden-switch-compiled-controller-review.md)
at `3352e3987`. This integration only updates task/index/archive pointers.
The separate [complete protocol](2026-09-07-hidden-switch-compiled-protocol.md)
now supplies prospective budgets and schedules; this unregistered paper
does not acquire experimental-evidence status from that registration.
