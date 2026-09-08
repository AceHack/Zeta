# ARC offline carry-forward evidence contract

**Status:** Contract only; no new agent, environment, score, or official ARC-AGI-3 result is introduced here.
**Date:** 2026-09-08
**Author:** Manus AI (Lumen)

## 1. Decision

The next useful offline ARC step is **not** a fourth source-owned level added
until an existing policy happens to clear it. It is a pre-registered
carry-forward experiment which separates an agent's _world-local observations_
from its _candidate transferable state_, and then tries to falsify the latter on
a declared holdout world.

The immediate implementation unit after review is intentionally smaller still:
a score-free, no-training **memory-provenance partition preflight**. It must
emit byte-stable receipts showing which state was observed while solving source
world `A`, which declared prior-level or cross-game state was available at the
world-`B` boundary, and when the runner first made `B`'s own observation
available. It must not choose an agent, change weights, select a policy, report
a transfer win rate, or make an official ARC call. A score comparison can be
proposed only after this partition receipt and its mutations pass.

> A cleared source-owned level is an observation about that declared environment.
> A prior-level cache or cross-game learning record is not invalid by itself.
> It becomes evidence of a particular carry-forward claim only when its origin,
> availability boundary, and any held-out task separation are declared and
> independently checkable.

## 2. Current offline evidence inventory

The following is what current mainline actually establishes. This table is a
status inventory, not a retrospective benchmark leaderboard.

<!-- prettier-ignore -->
| Carrier | Reproducible observation | What it supports | What it does **not** support |
| --- | --- | --- | --- |
| `ZetaChase` (`ztch-v1`) | `PixelAgent`, seed `4`, offline mode: **3/3** levels cleared and environment score `0.354`; the `greedy` baseline clears 1/3 and seeded random controls clear 0/3.[1] [2] | The rendered-grid agent can identify a responsive body, learn blocked cells by interaction, route around the declared wall layouts, and reproduce this finite episode. | An ARC Prize score, a held-out result, a learned general rule, or an unlimited curriculum result. |
| `ZetaChaseDecoy` | Same three wall/start layouts, with an independent moving decoy: `PixelAgent`, seed `4`, clears **3/3**, score `0.2659`.[3] | A discriminating source-owned control exists: the body-election mechanism can be challenged by a second mover. | General visual-object binding, official ARC behavior, or an improvement merely because its score differs from `ZetaChase`. |
| Appearance transforms | The same `ZetaChase` trajectory survives four controlled rescale/recolour views, while a fixed imported cell size fails the wall level under those changes.[4] | The step-size and background-color mechanisms are tested against declared changes in rendering. | A new task distribution: geometry, dynamics, goal rule, and action alphabet remain the source-owned carrier. |
| Motion-prior transfer | Four hand-authored CHIP-8 carts select one-step motion projection: 24/24 forecasts versus 0/24 retained-position control; the fixed choice predicts 32/40 transformed `ZetaChase` frames and fails all direction-change and mover-switch counterexamples.[1] | A narrow, source-owned motion predictor and named failure boundary. | An acting-policy result, hosted ARC evidence, or generic transfer learning. |
| Hosted ARC seam | A hosted `EnvironmentWrapper`, action/frame adapter, roster scorer, response/replay fields, and comparison runner are present.[1] [5] | Zeta has an internal integration seam that can be extended under an official interface. | That any real hosted game was run, that an official score was produced, or that the configured agent can play a real ARC-AGI-3 environment. |

The current tree contains **three** `ZetaChase` levels, and the full-episode
PixelAgent tests assert `levels_cleared == 3`. The audit found no reproducible
current-main receipt of this agent clearing four levels. A remembered
four-level run therefore remains **unverified historical context**, rather than
a result to repeat or compare, until it has a pinned source revision, level
identity, seed, action trace, and replayable runner.[2] [4]

## 3. What current code carries forward—and what it deliberately does not

`PixelAgent` is stateful within an episode. It derives a pixel step size from a
successful self-displacement, records body-evidence beliefs, temporarily tracks
inert actions by exact grid, and learns candidate blocked cells by bumping. It
also does the important opposite at a perceived world change: its `blocked`
map and route plan are cleared because a wall in one level can be open floor in
the next.[6]

That behavior is a **world-local correction rule**, not demonstrated
cross-environment learning. The code has no versioned `CarryState` object, no
train/holdout manifest, no serialization of learned state, no independent
reset-versus-carried comparison, and no test that identifies a score change as
caused by a permitted generic rule rather than retained level geometry. Static
source code may embody a general hypothesis; it is not a measured learned
update merely because it is reused on another level.

The distinction is material for the intended research direction, but it is not a
blanket cache ban. A literal blocked-cell map, grid fingerprint, target
coordinate, replay-derived action sequence, or learned rule from an earlier
level may legitimately be retained and reused. So may declared experience from
another game, including CHIP-8 or Atari, with its source, acquisition time, and
interface recorded. Such memory is a **known input to the experiment**, not
automatically evidence of generality or cheating.

The non-leakage boundary is instead task-scoped: before the agent legally
observes the level it is currently playing, no cache may contain that current
level's unobserved task payload, reference trace, target/solution metadata, or
reward outcome. During legal interaction, the agent may retain and use its own
observations and action consequences. At a level boundary, prior-level state may
be retained, transformed, or discarded according to a declared transition
policy. A result using earlier ARC tasks remains a development-data result unless
the evaluation task is separately held out from that declared ARC corpus. The
preflight below makes these origins, times, and boundaries observable before any
performance comparison is made.

## 4. Normative carrier model for the preflight

The first implementation must emit one canonical UTF-8 JSON receipt per
`(suite_id, source_ref, seed, world_a, world_b, agent_build)` tuple. JSON is a
carrier, not an evidence merge: a receipt describes one observed run and must
not be combined by averaging, last-write-wins, or implicit consensus.

<!-- prettier-ignore -->
| Field | Requirement |
| --- | --- |
| `contract_version` | Literal `arc-offline-carry-v1`. Unknown versions are refused. |
| `source_ref` | Immutable Zeta source commit. The runner refuses a dirty tracked tree. |
| `suite_id` | SHA-256 of a canonical suite manifest containing both world identities, source paths, action schemas, feature flags, and the public split declaration. |
| `world_a` / `world_b` | Distinct full identities: source path, environment identifier, level identifiers, content digest, action-schema digest, observation-schema digest, and declared role (`development` or `holdout`). A name alone is insufficient. |
| `seed` | Integer supplied by the caller and reported verbatim. No hidden randomized seed is permitted. |
| `runner` | Interpreter/package lock identity, runner entrypoint, operation mode, declared egress mode, and wall-duration tick envelope. A duration ceiling is caller-owned quantization, never a reward. |
| `agent_build` | Source commit plus immutable executable/package identity. It is a label, not a claim about parameter count or learning. |
| `state_before_a` / `state_after_a` / `state_before_b` | SHA-256 plus a typed census of each state partition. Raw state may be retained only when the suite permits it; secret or private hosted data is never printed into a public receipt. |
| `memory_manifest` | Canonically sorted records for every persisted memory item: partition, origin game/task/level identity, source digest, acquisition phase, transition policy, and allowed action interface. Missing provenance is a refusal. |
| `boundary_offer` | Canonically sorted, versioned list of memory offered when `B` begins. It may contain declared prior-level or cross-game state; an empty list is valid and must differ from omitted. |
| `first_observation_b` | Monotonic event identity at which `B`'s first legal input becomes available. It separates pre-level cache from state acquired while playing `B`. |
| `access_log` | Canonical event stream of inputs supplied to the agent: world identity, frame/input digest, legal-action digest, action chosen, transition digest, boundary event, and memory-read identity. It must make a pre-observation read of `B` detectable. |
| `result` | Only `partition-observed`, `refused`, or `mutation-detected` for this preflight. No score, winner, policy rank, learning rate, or ARC claim is permitted. |

`world_b` may be selected before the run. Its current-level task payload,
solution/reference trace, target metadata, and outcome information must remain
unavailable to pre-`first_observation_b` state. This does not forbid declared
earlier-level or cross-game caches. The suite manifest must state whether `B`
or a corpus containing it was available during development, because a
source-visible ARC task is development data for any later ARC generalization
claim. This first preflight can establish **memory-provenance and task-boundary
enforcement**, not held-out generalization.

## 5. Required state partition

The runner must place every persisted item in exactly one of these partitions;
an unclassified item is a refusal, not an implicitly transferable value. The
partitions record origin and availability; they do not make previous learning
invalid merely because it is remembered.

<!-- prettier-ignore -->
| Partition | Examples in the present PixelAgent | Boundary rule |
| --- | --- | --- |
| `current_level_live` | Observations, action consequences, transient map, route plan, and exact-grid inert-action entries acquired while playing the current level. | May inform actions only after legal observation on that level. It may become `prior_level_memory` at a declared boundary, but it cannot be preloaded as unseen information for the level currently played. |
| `prior_level_memory` | A blocked-cell map, frame cache, coordinate, target hypothesis, action suffix, or learned rule acquired from an earlier level during the declared run. | May be retained, transformed, or discarded before `B` if `memory_manifest` records its precise origin and transition policy. It is not called held-out transfer merely because it crosses a level boundary. |
| `cross_game_memory` | Declared experience, cached representations, replay data, or learned updates acquired from another game such as CHIP-8 or Atari. | Allowed when source identity, acquisition phase, and action interface are declared. It is not an ARC task leak solely because it predates the ARC run. |
| `candidate_transfer` | A versioned, declaratively named hypothesis such as an action-schema adapter or a self-motion calibration rule. | May be offered only through `boundary_offer`, with provenance of the observations that created it. ARC-task-derived candidates support a held-out claim only if their corpus/task split says so. |
| `static_program` | Action selection logic present before world `A`, fixed ordering, and declared policy constants. | Reported as pre-existing code. It is not called “learned” in the receipt. |
| `runner_metadata` | Seed, package lock, operation mode, source ref, and caller-owned tick envelope. | May be retained only as provenance; it cannot become an action feature unless the suite declares that interface. |

The current `PixelAgent` has no separately serializable memory manifest or
`candidate_transfer` partition. The preflight must therefore start with an
explicit empty `boundary_offer` or a newly specified, independently inspectable
carrier. It may not silently reinterpret the existing in-memory object as a
generic rule, but it may represent declared prior-level or cross-game memory
when its provenance is explicit.

## 6. Required controls and fault injections

Each control must be executed and emit a distinct receipt. A prose statement
that a fault “would be caught” is not an observed control.

<!-- prettier-ignore -->
| Control | Required observation |
| --- | --- |
| Deterministic replay | The same manifest, build, and seed yield byte-identical canonical receipts, excluding declared wall-duration measurement fields. |
| Declared prior-level continuity | Supply a manifest-bound item acquired during `A`, such as a blocked-cell map or action suffix. The preflight must accept and report it as `prior_level_memory`; rejecting it merely for being remembered fails this positive control. |
| Declared cross-game continuity | Supply a manifest-bound CHIP-8, Atari, or other non-ARC-game item. The preflight must accept and report its origin/interface; treating it as an ARC leak without task evidence fails this positive control. |
| Current-level preload | Inject `B`'s unobserved frame/task digest, target/solution metadata, reference trace, or outcome into pre-`first_observation_b` memory. The runner must refuse before it can act on `B`. |
| Undeclared carry | Add a state field without a declared partition. The receipt must be `refused`; silent default classification fails. |
| Current-level early-read | Instrument an attempt to read `B`'s frame, level data, task digest, target/solution metadata, or outcome before `first_observation_b`. The access log and checker must reject it. |
| Transition-policy mutation | Change a manifest-declared retain, transform, or discard rule. The checker must distinguish the altered `state_before_b`/`memory_manifest` or reject the receipt; a control that reports the same state is vacuous. |
| Memory-removal | Remove a nonempty declared prior-level, cross-game, or `candidate_transfer` item in a later comparison stage. The receipt must make the carrier difference observable; it does not have to change a score in the score-free preflight. |
| Identity mismatch | Change world content, action schema, source ref, suite manifest, package identity, or declared egress mode. Verification must reject the mismatched receipt. |

The preflight verifier must be independently authored from the runner where
practical. At minimum it must parse the receipt as raw bytes, recompute the
manifest/state/trace digests, enforce partition coverage, and reject unknown
fields and duplicate canonical keys. This is a conformance claim, not a claim
that independent code proves intelligence.

## 7. Admission rule for a later transfer comparison

No score may be interpreted as transfer evidence until all preflight controls
pass and a new comparison contract is reviewed. That later contract must fix:

1. the development and held-out world manifests, including licenses and source
   revisions;
2. a `reset` agent and a `carry` agent with identical static program, model,
   tools, prompt/context, action ceiling, runner, and seed schedule;
3. a metric that is reported per world before aggregation, along with all
   failures and retries;
4. a `memory_manifest` for all carried state, including earlier-level and
   cross-game experience, plus a raw-byte/timeline audit demonstrating that the
   current heldout task was not exposed before its declared legal observation;
   and
5. a predeclared rule for null, negative, and inconclusive outcomes.

If the carried and reset controls tie, the result is **no measured advantage on
that suite**, not evidence that transfer is impossible. If a carry control wins,
the result is limited to the declared suite and carry representation. Neither
outcome alone establishes ARC-AGI-3 competence, universal generalization,
continual learning, sample efficiency, parameter efficiency, or a broad
curiosity mechanism.

## 8. Explicit non-claims

This contract does not add a fourth cleared level, an official game result, a
leaderboard score, a hosted ARC run, a learner, a generic policy, a reward
function, a society-level objective, or an agent-selection mechanism. It does
not authorize `ARC_API_KEY` use, public task probing, private task access,
competition submission, external network access, or manual intervention.

It preserves a more modest but testable objective: before claiming that the
system carries a generic rule forward, make it possible to observe **what** it
carried, **when** it became available, and whether it included the unobserved
task payload of the ARC level currently being played. A prior-level map or a
declared CHIP-8/Atari cache is evidence with scope to report, not an automatic
violation. An undeclared or current-level preloaded payload is the failure.

## References

[1]: ../../src/Arc.Python/README.md "Zeta ARC Python lane: current offline results, synthetic controls, and hosted boundary"
[2]: ../../src/Arc.Python/zeta_arc/play.py "Offline source-owned episode runner and BFS-reference score substitution"
[3]: ../../src/Arc.Python/tests/test_play_mode.py "Offline PixelAgent and decoy-environment score pins"
[4]: ../../src/Arc.Python/tests/test_pixel_agent.py "PixelAgent level progression, rescale/recolour, and map-reset controls"
[5]: ../../src/Arc.Python/zeta_arc/hosted.py "Hosted wrapper and source-owned scorecard seams"
[6]: ../../src/Arc.Python/zeta_arc/agent.py "PixelAgent state, world-change correction, and declared limits"
