# ARC online-memory provenance receipt contract

**Status:** Source-owned score-free preflight implemented and independently
replayed. No online learner, ARC score, transfer result, or official ARC-AGI-3
evaluation is introduced by this document.
**Date:** 2026-09-08
**Author:** Manus AI (Lumen)

## Key recommendation

Treat continuously updating memory as the intended learning substrate. An agent
may update its memory after every lawful interaction without re-running a batch
training process. The first bounded engineering unit is therefore not a reset
versus-memory comparison; it is an **online-memory provenance receipt** that
makes each update, its uncertainty, its retraction path, and its replay order
observable.

The receipt must distinguish two different questions that are often conflated:

<!-- prettier-ignore -->
| Question | Required answer |
| --- | --- |
| May an agent retain experience? | **Yes.** Declared prior-level and cross-game memory—including CHIP-8, Atari, or other task history—may persist and influence future lawful actions. |
| May an agent begin a level with that level’s unobserved answer-bearing data? | **No.** Before its first legal observation, memory cannot include the current ARC level’s hidden task payload, reference trace, target/solution metadata, or outcome. |

This contract depends semantically on the task-scoped memory correction in the
ARC carry-forward contract. It does not reinstate a broad cache ban.[1]

## 1. Purpose and boundary

The intended long-run system learns through ordinary interaction: it observes,
acts, records an outcome, revises memory, and carries that revised memory into
the next interaction. A durable sequence of such updates can support continual
online learning without treating each new fact as a reason to retrain a model
from scratch.

This is an engineering boundary, not a claim that any current Zeta agent has
solved continual learning. The existing `PixelAgent` retains beliefs, blocked
cells, inert-action observations, and within-episode route information. The new
preflight emits a separate pinned synthetic lawful-event carrier rather than
silently treating `PixelAgent`'s in-memory object as durable generic memory; an
adapter from PixelAgent observations remains a later, separately reviewed
unit.[2] The existing
multilayer factor-graph path provides a separately bounded online evidence
update, yet it is an inference update over a declared Gaussian model, not proof
of general online learning.[3]

> **Memory state is not an evidence CRDT merge.** Immutable evidence/update
> atoms may be retained and folded under declared ZSet rules. A materialized
> agent memory state is a deterministic replay/query over those atoms in its
> declared causal order. Two posterior or memory snapshots must never be merged
> by simply adding or last-writing their fields.[4] [5]

## 2. Normative update model

The first implementation must emit canonical UTF-8 JSON receipts conforming to
`arc-online-memory/v1`. The canonical carrier contains immutable update atoms;
the materialized memory state is derived, not independently authoritative.

Each atom describes one update after one lawful event. An atom is admissible
only if its predecessor memory digest is known or if it is the manifest-bound
genesis state. A successor is **unresolved**, not guessed, until its predecessor
is available. This preserves the unknown state rather than fabricating an order
for out-of-order delivery.

<!-- prettier-ignore -->
| Field | Requirement |
| --- | --- |
| `contract_version` | Literal `arc-online-memory/v1`; unknown versions are refused. |
| `suite_id` / `source_ref` / `agent_build` | Immutable canonical identities for the declared suite, source commit, and executable/package build. A receipt from a dirty tracked tree is refused. |
| `room_fingerprint` / `run_id` / `episode_id` / `level_id` | Separate a human-facing room, one run, one episode, and the level currently played. No identifier is inferred from a display name. |
| `update_id` | SHA-256 of the canonical immutable atom body. Duplicate bodies are exact-once; distinct bodies may not reuse an `update_id`. |
| `logical_seq` / `previous_update_id` | Per-memory-lineage causal order. The genesis atom names `previous_update_id = null` and binds its genesis memory digest. |
| `before_memory_digest` / `after_memory_digest` | SHA-256 of canonical typed memory-state snapshots. The digest binds all memory partitions, uncertainty fields, and declared update-rule state. |
| `event` | Canonical observation/action/outcome digest and schema identity. It records only input made lawfully available at this point. Raw current-level private payload is never emitted into a public receipt. |
| `memory_reads` | Canonically ordered identities of prior memory entries read by the update, including partition, origin task, acquisition phase, and digest. |
| `memory_writes` | Canonically ordered new or revised memory entries, including partition, provenance, transition rule, and digest. |
| `uncertainty` | Integer mean and precision contribution, or a declared named uncertainty representation with canonical bytes. A missing, malformed, or non-finite representation is refused. Both positive and retracting atoms carry uncertainty. |
| `update_rule` | Immutable rule identifier, canonical parameter digest, and declared input schema. Changing a rule or parameters creates a different atom; it is never hidden behind the same label. |
| `task_barrier` | The current level identity, its first-legal-observation event identity, and an availability classification for every read: `prior-level`, `cross-game`, `current-level-live`, or `current-level-preload`. |
| `weight` | Nonzero integer ZSet weight. `+1` asserts an update atom; `−1` retracts an exact prior atom. |
| `replacement_for` | Required for a correction that changes an earlier observed update: the exact retracted `update_id`, followed by a separate replacement `+1` atom. |
| `result` | One of `observed`, `unresolved-predecessor`, `refused`, or `retraction-observed`. It never reports score, policy winner, competence, or transfer success in this first unit. |

Wall-clock timestamps may be reported as caller-owned diagnostics, but they
cannot select causal order. `logical_seq` plus the predecessor relation are the
replay boundary. A duration tick may bound one caller-owned execution turn; it
is not a hidden reward, memory penalty, or learning-rate policy.[6]

## 3. Memory partitions and lawful availability

Every memory entry must name exactly one partition. A partition says where an
entry came from and when it becomes action-readable; it is not a value judgment
on whether memory should exist.

<!-- prettier-ignore -->
| Partition | Examples | Lawful availability |
| --- | --- | --- |
| `cross_game_memory` | A CHIP-8 motion prior, an Atari dynamics feature, or another declared game’s prior replay/cache. | Available from run genesis when its source, acquisition phase, and interface are declared. It is not ARC leakage merely because it predates the ARC run. |
| `prior_level_memory` | A map, coordinate, action suffix, target hypothesis, uncertainty statistic, or rule learned on an earlier level of the same declared run. | Available at a later level according to its recorded retain/transform/discard policy. It remains development data for any ARC evaluation unless the task/corpus split says otherwise. |
| `current_level_live` | Current-level frames, action consequences, live map revisions, and observations acquired after first legal observation. | Becomes readable only after the logged `first_legal_observation` event for this level. It may later be promoted to `prior_level_memory`. |
| `current_level_preload` | The current level’s unobserved frame/task bytes, solution/target metadata, reference trace, private score/outcome, or semantically equivalent answer-bearing cache. | Never action-readable before first legal observation. Its presence in pre-barrier state is a refusal, not a learning update. |
| `static_program` | Rules and parameters fixed before the run. | Available throughout, reported as pre-existing program rather than newly learned memory. |
| `runner_metadata` | Source, package, action-schema, egress, and tick-envelope identity. | Provenance only unless the suite explicitly declares it as an action feature. |

The preflight does not require a prior-level memory entry to improve a score,
nor does it require all live memory to survive a level boundary. It requires the
transition decision to be observable. A null result can mean that a particular
update did not help the declared task; it is not evidence that continual online
memory is impossible.

## 4. Fold, replay, retraction, and uncertainty semantics

The durable atom relation uses a canonical ZSet fold. Delivery order of the
same set of `+1` and `−1` atoms is irrelevant: a retraction arriving before its
assertion remains a negative in-flight atom, and the matching assertion later
cancels it. This is the existing room-evidence retraction law applied to update
atoms, not an attempt to reverse time or mutate history.[4]

Materialization is deliberately different. After cancellation and validation,
the runner selects active atoms in canonical `(lineage, logical_seq,
update_id)` order and requires each `before_memory_digest` to equal the
previous materialized digest. It invokes the declared update rule once per
active atom and checks that the produced digest equals `after_memory_digest`.
An out-of-order delivery may therefore be safely retained before replay, but a
causally inconsistent chain is unresolved or refused; it is never repaired by
choosing a convenient posterior.

An update correction is represented as `−1` for the exact superseded atom and
`+1` for a replacement atom. The materialized suffix is re-derived from durable
atoms under the same declared replay rule. This does not claim that every
arbitrary learned update is algebraically invertible. It claims that the
evidence history is preserved and that a corrected replay can be checked.

Uncertainty is part of the update identity. A changed mean, precision, or named
uncertainty payload changes the atom digest. A `−1` retracts the exact
uncertainty contribution of the superseded update; it cannot silently erase an
earlier confidence value while retaining its mean. If the active evidence for a
memory entry has non-positive precision or no valid predecessor chain, the
materialized status is `unresolved`, not a fabricated confident state.[4]

## 5. Frozen score-free preflight

The first implementation is constrained to a source-owned, no-network carrier
and reports no policy score. It may drive a small declared `ZetaChase`/CHIP-8
fixture or an equally pinned successor, but its purpose is trace conformance:
it must emit lawful memory-update atoms and independently replay their state
digests. It may not train weights, choose a candidate, access `ARC_API_KEY`,
call a hosted ARC environment, access private tasks, submit a competition run,
or claim ARC transfer.

The receiver/verifier must be independently authored from the emitter where
practical. At minimum it must parse raw receipt bytes, reconstruct atom
identity, enforce state partition/barrier rules, perform canonical cancellation
and causal replay, and recompute each materialized memory digest without using
the emitter’s stored result as an oracle.

### Implemented source-owned preflight

The first bounded implementation is now in
`src/Arc.Python/zeta_arc/online_memory.py`, with an independently authored
raw-object verifier in `src/Arc.Python/tests/test_online_memory_receipt.py`.
The emitter produces canonical JSON update and retraction atoms over a pinned
two-event synthetic lawful sequence; it is deliberately not wired into
`PixelAgent.act`, a policy-selection loop, a score emitter, or a hosted ARC
interface. The verifier does not import the emitter's canonical-byte, digest,
or state-digest helpers.

The targeted conformance suite passes **14 tests**: byte-identical replay,
event-by-event state transition, positive prior-level and CHIP-8 cross-game
continuity, current-level preload and early-live-state refusal, duplicate
exact-once behavior, rule/uncertainty/task-identity tampering, retraction before
assertion, exact retraction-uncertainty matching, unresolved retraction,
replacement correction, missing predecessor, and query non-absorption. The
full `src/Arc.Python` suite passes **209 tests** in the declared project
environment. These are finite source-owned conformance observations only.

## 6. Required observed controls

Every row below must produce a distinct canonical receipt. A comment claiming a
fault “would be caught” is not an observed control.

<!-- prettier-ignore -->
| Control | Required observation |
| --- | --- |
| Deterministic lawful replay | Same fixture, source/build, genesis, and event stream produce byte-identical canonical receipts and materialized digests, excluding declared wall-duration diagnostics. |
| Event-by-event update | A lawful current-level observation/action/outcome changes memory through exactly one declared update rule and links `before_memory_digest` to `after_memory_digest`. |
| Prior-level positive continuity | A declared earlier-level map, coordinate, trace, or uncertainty entry is retained across a level boundary and is accepted with exact origin and transition provenance. Rejection merely because it is remembered fails this control. |
| Cross-game positive continuity | A declared CHIP-8, Atari, or other cross-game item is accepted with exact source/interface provenance. It must not be misclassified as an ARC current-level preload. |
| Current-level preload | Insert the current level’s unobserved task/frame digest, solution/target metadata, reference trace, or outcome before its first legal observation. The verifier refuses it before action selection. |
| Current-level early read | Attempt to read a current-level entry before its barrier event. The access log and verifier reject it. |
| Duplicate update | Submit the same `+1` atom twice. Exact-once materialization must leave the memory digest unchanged on the duplicate. |
| Update-rule substitution | Change the rule identifier, parameter digest, or input schema while preserving visible summary labels. Atom/digest verification must fail. |
| Uncertainty tamper | Alter a mean or precision contribution without changing its claimed update identity. Verification must fail. |
| Retraction before assertion | Deliver an exact `−1` before its matching `+1`. The fold retains the in-flight retraction; final cancellation/replay converges once both arrive. |
| Replacement correction | Retract one prior update and assert a named replacement. The old atom remains durable, the replacement is distinct, and replay reaches the replacement-derived digest. |
| Missing predecessor | Supply a successor without its predecessor. The state is `unresolved-predecessor`, never assigned a guessed order or post-state. |
| Retraction uncertainty | Change the retraction's uncertainty payload even after recomputing its own identity. Verification must refuse because it no longer retracts the exact asserted update. |
| Retraction without assertion | Deliver a valid retraction whose asserted atom is absent. The state remains `unresolved-retraction`; it is not silently treated as complete cancellation. |
| Query non-absorption | Query a replayed materialized memory state repeatedly without a new atom. Result digests are stable and no additional update is recorded. |
| Identity mismatch | Change suite, source, room/level, action schema, agent build, memory origin, or task barrier. The receipt is rejected rather than relabelled. |

## 7. Admission rule for later online-memory experiments

A later experiment may compare memory policies only after this preflight and
all controls pass. That later contract must predeclare the environment corpus,
the exact memory sources allowed at run start, the current-level legal
observation barrier, update rules and uncertainty representations, retraction
behavior, reset/carry comparison, and per-task result reporting.

It must report a learning curve separately from a zero-shot result. An agent
that improves after interacting with a current task has demonstrated an
interaction-conditioned observation on that task, not zero-shot generalization.
An agent whose prior-level or cross-game cache helps has demonstrated only the
declared memory-source effect unless a separately held-out corpus and
provenance protocol say more.

## 8. Explicit non-claims

This contract does not prove a model can learn forever without future retraining
for every possible distribution. It does not prove resistance to all poisoning,
catastrophic forgetting, sycophancy, reward hacking, or memory corruption. It
does not claim that event sourcing, uncertainty, retraction, anti-Sybil, or
multiple oracles automatically solve those problems; they are separately scoped
mechanisms with their own assumptions.[5]

It introduces no online learner implementation, non-Gaussian inference result,
policy score, ARC level win, official ARC-AGI-3 run, performance ranking,
parameter-efficiency claim, consent/authority mechanism, or social objective.
It freezes a narrower first claim: **an online memory update can be made
provenance-addressable, uncertainty-carrying, retractable, causally replayable,
and distinguishable from preloaded current-task information.**

## References

[1]: ./2026-09-08-arc-offline-carry-forward-evidence-contract.md "ARC offline carry-forward evidence contract"
[2]: ../../src/Arc.Python/zeta_arc/agent.py "PixelAgent state and within-episode correction rules"
[3]: ./2026-09-02-multilayer-factor-graph-online-update-contract.md "Multilayer Factor-Graph Online Update Contract"
[4]: ./2026-08-25-durable-uncertain-room-evidence-contract.md "Durable uncertain room evidence contract"
[5]: ./2026-07-11-three-continual-learning-traps-for-a-bayesian-updater-ai-and-their-guards.md "Three continual-learning traps and guards"
[6]: ./2026-09-07-policy-self-knowledge-tick-admissibility-contract.md "Policy self-knowledge and tick-admissibility contract"
