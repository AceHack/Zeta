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
a score-free, no-training **carry-state partition preflight**. It must emit
byte-stable receipts showing which state was created while solving source world
`A`, which state was discarded at the world boundary, and which explicitly
allow-listed state, if any, was offered to held-out world `B`. It must not choose
an agent, change weights, select a policy, report a transfer win rate, or make
an official ARC call. A score comparison can be proposed only after this
partition receipt and its mutations pass.

> A cleared source-owned level is an observation about that declared environment.
> It becomes evidence of carry-forward only when a separately declared held-out
> environment can distinguish the carried state from a reset-state control.

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

The distinction is material for the intended research direction. Carrying a
literal blocked-cell map, a source-world grid fingerprint, target coordinates,
or replay-derived action sequence into a different level is memorization or
leakage unless that representation is itself declared as part of the task
interface. Conversely, discarding every learned item at the boundary does not
test whether a useful generic update was possible. The preflight below exists to
make that separation observable before any performance comparison is made.

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
| `local_discard` | Canonically sorted identifiers of state created from world `A` and removed before `B`; absence of a discard entry is explicit rather than inferred. |
| `carry_offer` | Canonically sorted, versioned allow-list of the exact state offered to `B`; an empty list is valid and must differ from omitted. |
| `access_log` | Canonical event stream of inputs supplied to the agent: world identity, frame/input digest, legal-action digest, action chosen, transition digest, and boundary event. It must make an early read of `B` detectable. |
| `result` | Only `partition-observed`, `refused`, or `mutation-detected` for this preflight. No score, winner, policy rank, learning rate, or ARC claim is permitted. |

`world_b` may be selected before the run but its task payload must remain
unavailable to the world-`A` portion of the runner. The suite manifest must
state whether the holdout is source-visible to reviewers, because a public
source-visible holdout is still development data for any later claim. This
first preflight can establish **boundary enforcement**, not held-out
generalization.

## 5. Required state partition

The runner must place every persisted item in exactly one of these partitions;
an unclassified item is a refusal, not an implicitly transferable value.

<!-- prettier-ignore -->
| Partition | Examples in the present PixelAgent | Boundary rule |
| --- | --- | --- |
| `world_local` | Blocked cells, route plan, exact-grid inert-action entries, level-specific component positions, and source-world frame cache. | Must be removed or cryptographically proved absent before `B` begins. It is never carried as a convenience. |
| `candidate_transfer` | A versioned, declaratively named hypothesis such as an action-schema adapter or a self-motion calibration rule. | May be offered only via the explicit `carry_offer`, with provenance of the observations that created it. It cannot include raw coordinates, grid digests, target identity, or a source-world action sequence. |
| `static_program` | Action selection logic present before world `A`, fixed ordering, and declared policy constants. | Reported as pre-existing code. It is not called “learned” in the receipt. |
| `runner_metadata` | Seed, package lock, operation mode, source ref, and caller-owned tick envelope. | May be retained only as provenance; it cannot become an action feature unless the suite declares that interface. |

The current `PixelAgent` has no separately serializable `candidate_transfer`
partition. The preflight must therefore start with an explicit empty
`carry_offer` or a newly specified, independently inspectable carrier. It may
not silently reinterpret the existing in-memory object as generic knowledge.

## 6. Required controls and fault injections

Each control must be executed and emit a distinct receipt. A prose statement
that a fault “would be caught” is not an observed control.

<!-- prettier-ignore -->
| Control | Required observation |
| --- | --- |
| Deterministic replay | The same manifest, build, and seed yield byte-identical canonical receipts, excluding declared wall-duration measurement fields. |
| World-local leak | Inject one `world_local` blocked cell, frame digest, coordinate, or source-world action suffix into `carry_offer`. The runner must refuse before `B` receives any action. |
| Undeclared carry | Add a state field without a declared partition. The receipt must be `refused`; silent default classification fails. |
| Holdout early-read | Instrument an attempt to read `B`'s frame, level data, or task digest while `A` is active. The access log and checker must reject it. |
| Boundary reset removal | Disable the specified local-state clear. The checker must distinguish the altered `state_before_b` or reject the receipt; a control that reports the same partition is vacuous. |
| Carry removal | Remove a nonempty declared `candidate_transfer` value in a later comparison stage. The receipt must make the carrier difference observable; it does not have to change a score in the score-free preflight. |
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
4. an exact allow-list of carried state and a raw-byte audit demonstrating that
   the heldout task was not exposed during development execution; and
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
system carries a generic rule forward, make it possible to observe whether it
instead carried a map, coordinate, trace, cached task, or an undeclared runner
state across the boundary.

## References

[1]: ../../src/Arc.Python/README.md "Zeta ARC Python lane: current offline results, synthetic controls, and hosted boundary"
[2]: ../../src/Arc.Python/zeta_arc/play.py "Offline source-owned episode runner and BFS-reference score substitution"
[3]: ../../src/Arc.Python/tests/test_play_mode.py "Offline PixelAgent and decoy-environment score pins"
[4]: ../../src/Arc.Python/tests/test_pixel_agent.py "PixelAgent level progression, rescale/recolour, and map-reset controls"
[5]: ../../src/Arc.Python/zeta_arc/hosted.py "Hosted wrapper and source-owned scorecard seams"
[6]: ../../src/Arc.Python/zeta_arc/agent.py "PixelAgent state, world-change correction, and declared limits"
