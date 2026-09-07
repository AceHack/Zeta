# Hidden switch: independent reference and native source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Delegated review identity: `codex/hidden-switch-reference-20260907`
Artifact status: pre-measurement implementation and source review

## Outcome and chronology

The reviewed native source implements the registered reward-unobserved,
action-conditioned machine and bounded planning contract. No material
state/reward timing, policy-input, planning-value or copy-isolation defect
remains in the inspected scope. Several admission and regression-test
improvements were accepted and applied. Native publication gates, immutable
implementation admission and registered measurements remain separate work;
this review is not a behavioral or resource result.

The [protocol](2026-09-07-hidden-switch-protocol.md) was remotely registered
before implementation under the annotated tag
`archive/experiments/081M1XK02XM087G0R00043EW05-registration`, resolving to
`6a3150037a1e6be6ae89996dc8562f2061f7c75d`. Its SHA256 is
`E6E2943D5991E70DBC95D3ED1E620AA7505D3E692315E80588729C9FCD03946A`.
The coordinator verified the remote tag at 09:41:48 UTC. The reference
writer independently fetched and checked the commit and protocol bytes
before writing implementation files.

The [Python reference](../../src/Interp.Python/zeta_interp/hidden_switch_reference.py)
and its [tests](../../src/Interp.Python/tests/test_hidden_switch_reference.py)
were first committed and pushed as
`21a758e78e52ea71a1d92df7045e66384edc2af3`. The reference author had not read
the new native implementation at that point. Subsequent native source
review was explicitly authorized after this independently committed
implementation existed. The follow-up accompanying this report narrows
the reference episode-index admission to 0..1023 and adds an edge/refusal
test; it does not change filtering, planning or any admitted trajectory.

Independence here concerns implementation paths. The protocol, receipt
schema and preexisting Zeta random-stream convention are shared. Both
implementations were authored by Vera, OpenAI Codex using GPT-6 Astra,
within one coordinated agent team. This is not independent social
replication or a claim that different model families supplied the checks.

## Reference construction and executed checks

The numerical reference owns its simulator, renderer, strict projection
and decoder, SplitMix64 implementation, policy chronology, filter and
depth-limited recursion. The policy receives admitted pixels and its own
bounded state; the evaluator retains the exogenous tape, hidden state,
scorer and diagnostic-band interventions. Every episode emits the agreed
17-observation/16-action trace and actual planning/filter counters.

The Fraction oracle uses separately constructed hidden-state transition
and emission tables. It enumerates all contingent policy trees as
two-coordinate alpha vectors: 2, 8 and 128 trees at depths 1, 2 and 3,
including 1, 4 and 64 trees for each fixed root action. It computes each
root-action maximum directly against the prior. It never calls the
numerical filter, planner or simulator transition/reward functions. A test
replaces those functions with failing stubs and still exercises the exact
oracle. This is stronger than translating the same belief recursion into
another language, although shared mathematical mistakes remain possible.

The author executed the focused tests, including:

- All 96 declared hand episodes, exact transition/reward/cue tables, the
  five-prior rational filter/grid checks, plus an auxiliary q=0 oracle unit
  check outside the registered q=1/8 hand grid.
- Action-before-feedback chronology, action-conditioned belief updates,
  natural/padded myopic agreement and the separate real-filter/tree counts.
- Real-runner suffix, private-band and scorer interventions; geometry and
  palette invariance; copied caller data; invalid-input refusal.
- Callable execution of the ten named falsifiers, with deliberately ignored
  actions and fabricated counters causing the corresponding flags to fail.
- All ten preexisting cross-language mixer golden vectors. A separate RNG
  unit check uses only seed/domain 17/29 and verifies 34 draws per tape;
  those tapes are not run as policy episodes.

Initial validation was 67 focused tests passing in 5.20 seconds with no
warnings, clean Ruff/format/mypy checks, and all sixteen pre-push checks.
After narrowing the index guard, the focused suite passed 68 tests in
5.64 seconds with no warnings. This records actual local conformance
execution, not a registered benchmark or an inference about performance.
No seed 9101 or 9203 source generation, behavioral panel, cost corpus,
training or registered replay was executed by this reviewer.

## Native findings and dispositions

The reviewer read `HiddenSwitchObservation.fs`, `HiddenSwitchCarrier.fs`,
`HiddenSwitchPolicy.fs`, `HiddenSwitchExperiment.fs`, the receipt/runtime
and hand-runner source, and `HiddenSwitch.Tests.fs`. The native writer was
still preparing its signed publication commit. The following dispositions
were checked in its source after the author applied them.

| Finding | Disposition |
| --- | --- |
| Suffix falsifier checked equal prefixes but did not assert that the intervention affected a later state. | The actual runner still executes both tapes from reset, and the witness now also requires different hidden states at position 9. Equal state/action prefixes through decision 8 plus opposite drift bit 8 make this a direct intervention-reachability check. |
| Native source generation accepted negative seed/domain through wrapping conversion and uncapped positive counts; episode entry accepted arbitrary indices. | Source admission now requires nonnegative seed/domain and count 1..1024. Episode indices are restricted to 0..1023, with typed refusals and regression tests. The Python follow-up adopts the same index range. |
| The projection comment described unrestricted lower-band substitution even though binary-domain validation intentionally observes the complete frame. | The comment now explicitly covers valid binary lower-band substitutions. Invalid/nonbinary frames may refuse; they are outside the successful noninterference comparison. |
| The test named for numerical-max recursion only exercised depth-two values and root selection tolerance. | A depth-three near-tie witness now checks a child whose switch Q is slightly greater while selection still favors harvest, and verifies that the parent propagates the numerical maximum. The implementation already used `max` correctly; this was a regression-test gap. |
| Reviewer initially suspected null-record dereference in frame admission. | **Retracted.** `GameEnvironment.Frame` is an F# struct. Its default value has zero dimensions and null Cells and is already rejected by the shape guard. The author added the appropriate default-struct refusal test. No null-record defect was established. |

The near-tie witness takes `b = 17/42 - 1e-13`. After harvest and cue zero,
the depth-two child's slightly larger switch value lies within the
selection tolerance, so its selected action is harvest. Correct root
harvest value is `39/64 + (53/32)*b`; propagating that child's selected
lower value would instead give `11/32 + (37/16)*b`. The roughly
`6.56e-14` separation makes a `1e-15` value assertion discriminate the
two computations. This is an algebraic hand check, not stream evaluation.

The inspected native policy record contains arm, effect, geometry, scalar
belief, chronology, own pending action and filter counters. It contains no
tape, environment state, score, runtime/path handle or frame-array field.
The adapter defensively copies its input tape arrays. Projection copies
the frame, and the policy retains decoded scalar state. Returned Q arrays
do not become retained policy inputs; mutation tests exercise this boundary.
These are inspected, bounded program interfaces, not process isolation.

Native pre-transition reward, subsequent action/drift update, post-transition
cue, initial conditioning and unused terminal observation follow the
protocol. The tree visits both actions and both observations in fixed
order without caching/pruning; depth-one leaves perform no unused belief
update. Recursive values use numerical maxima, while the decision tie rule
applies only to action selection. Planning counters remain separate from
the real-prefix filter counters.

The two scorer interventions are intentionally different. Native conformance
hooks can change the private audit score while leaving native reward pixels
unchanged. The reference's category-constrained `scorer_override` changes
its private score and associated diagnostic pixel. Both compare unchanged
policy-visible projections and decisions within their own runner. They are
not claimed to produce identical intervention traces. Registered wrappers
use neither runner's conformance overrides; normal episode paths are the
cross-implementation comparison.

## Coordinator comparison and source fingerprints

The coordinator ran the native hand comparison and retained
`docs/research/hidden-switch-validation/2026-09-07/hand-comparison-attempt-1.json`.
The reviewer read that comparison record but did not rerun the native
fixture or comparison. Its input is native hand attempt 2, SHA256
`A37CBDB7B62399FA0A74ADFE0ADAFF7395863F89A47131FCDF0ABC68C4260A84`.
It reports 16 transitions, 4 cues, 40 conditioning rows, 30 planning rows,
96 episodes, maximum absolute numerical error
`2.7755575615628914e-17`, and all ten native/reference falsifier names.
The native author subsequently reported hand attempt 3 with the same
raw digest. Final-source admission and the coordinator's final comparison
remain the publication authority; this report does not relabel those runs
as its own execution.

The following reviewed bytes identify this pass. Native fingerprints are
the repaired draft observed on 2026-09-07; their later implementation
commit/archive and final validation are retained by the coordinating task.

| File | SHA256 |
| --- | --- |
| `src/Interp.Python/zeta_interp/hidden_switch_reference.py` | `7130fbf88e4a5f7393ad59cffd6c56637b3d226f630b8cf547167d319bf880e2` |
| `src/Interp.Python/tests/test_hidden_switch_reference.py` | `aeeed7696f0e5d058228281ed6c47396fa1146ef337cfd8f2f0f41ba71b49fa5` |
| `src/Research.FSharp/HiddenSwitchObservation.fs` | `09468d775552259612af31ef7aaf3831474b5ae37f0063ea17aa632d04a4448e` |
| `src/Research.FSharp/HiddenSwitchCarrier.fs` | `eb21882259b482db5136824d7e9a10f348abc59e3dc8a9a1e80221aff0b3d868` |
| `src/Research.FSharp/HiddenSwitchPolicy.fs` | `4358b476fa4871b1c187f615133b35bac1139359919500cd3b05dbe1da0aafb1` |
| `src/Research.FSharp/HiddenSwitchExperiment.fs` | `21b33c22912d56dd1bdda071bb821279207e64c4a34ba05129564c4d81cbc55a` |
| `src/Research.FSharp/check-hidden-switch-kernel.fsx` | `3cfeabe6f4aa8dd0c4c4289373effb5da9db52e357e09a392b2e26ba183cb2b5` |
| `tests/Tests.FSharp/HiddenSwitch.Tests.fs` | `fcafd4925f06c98eda09b4ad73bc992b565ffb0b173feb2dac7abbd33ffecc9c` |

## Limits

This pass does not establish an advantage on the held-out stochastic
panels, a cost ratio, necessity of online search, active information
gathering, an optimal sixteen-step belief policy, or a fully observed
oracle gap. The decoder, model, action meanings and objective are supplied.
The reference oracle verifies bounded supplied-model values; a compiled
threshold controller could realize the same decisions more cheaply.

The reviewer did not execute the native build/test suite, inspect a
source-to-binary derivation proof, or replace the separate replay/verdict
wrapper review. Float64 agreement within the registered tolerance is not
exact rational execution. Neither two implementations nor matching hand
fixtures establish a general correctness theorem or process-level secrecy.

The [unregistered follow-up advisory](2026-09-07-hidden-switch-prospective-model-identification.md)
preserves a later prospective discussion of compiled-controller equivalence
and model identification. It is a separate continuity artifact, not part of
this pre-measurement review, the archived experiment or its promotion criteria.
