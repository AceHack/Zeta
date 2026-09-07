# MiniGrid Empty-5x5 v3.1.0 Policy-Comparison Contract

**Status:** proposed, no score executed. This contract is the only path that may
open the no-policy-score gate in the merged
[`MiniGrid Empty-5x5 v3.1.0 Adapter Contract`](2026-09-06-minigrid-empty-5x5-v310-adapter-contract.md).
It creates a separate finite experiment; it does not alter the two internal
contextual-grid carriers or reuse their result receipts.

> **Decision:** compare four declared tabular policies only on the byte-pinned
> `MiniGrid-Empty-5x5-v0` source/transition carrier, under equal available
> actions and equal caller-owned duration ticks. Each policy reports its own
> parseable space/time shape. The comparison records outcomes and local novelty
> accounting; it contains no global reward, artificial byte/parameter cap,
> automatic winner, transfer conclusion, or deployment authorization.

## 1. Admission and Carrier Identity

The policy-comparison carrier is admitted only after the source-conformance
adapter’s exact input identities have been rechecked. Parsed equivalence,
moving upstream branches, and an ambient package installation are insufficient.

| Field                           | Required value                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Experiment schema               | `zeta.minigrid-empty-5x5/policy-comparison/v1`                                              |
| Parent adapter schema           | `zeta.minigrid-empty-5x5-adapter/v1`                                                        |
| Parent carrier path             | `docs/research/data/2026-09-06-minigrid-empty-5x5-v310-adapter-carrier.json`                |
| Parent carrier SHA-256          | `49db9a4f6fd415ba4f15b613eba858511e6cf116ec7574cd5ee50cc7c2e46b07`                          |
| Upstream commit                 | `90928729376741a41222a257911343b97103b548`                                                  |
| Environment ID                  | `MiniGrid-Empty-5x5-v0`                                                                     |
| Upstream Python fixture runtime | CPython `3.14.6`; `minigrid==3.1.0`; `gymnasium==1.3.0`; `numpy==2.5.1`; `pygame-ce==2.5.8` |
| Adapter state projection        | `position-direction-step-terminal-truncation/v1`                                            |
| Action alphabet/order           | `left/0`, `right/1`, `forward/2`                                                            |
| Maximum duration                | `100` environment steps per episode                                                         |

The full static adapter state is the policy input. It is not MiniGrid’s partial
7 × 7 × 3 image, mission text, or a claim of visual/language understanding.
Using the image, direction-only observation, mission string, an unpinned source
version, or a differently named action alphabet must refuse before action one.

## 2. Policy Self-Reports and Equal Access

Every candidate receives the same policy input, action alphabet, source adapter,
environment reset schedule, and caller-owned duration envelope. The self-report
is a versioned declaration checked using the syntax/boundary established in
[`Policy Self-Knowledge and Tick-Admissibility Contract`](2026-09-06-policy-self-knowledge-tick-admissibility-contract.md); it is **not** a runtime-complexity proof.

| Canonical policy row | Behavior declaration                                                                         | Time shape                             | Space shape | Input measure   |
| -------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- | ----------- | --------------- |
| `uniform-random/v1`  | Rejection-sampled uniform choice over the three allowed actions.                             | `O(1)`                                 | `O(1)`      | `episode-steps` |
| `q-epsilon/v1`       | Tabular Q update; ε-greedy choice with fixed ε.                                              | `O(1)` per visited state-action update | `O(         | S               | ×   | A   | )`  | `visited-state-actions` |
| `q-ucb/v1`           | Tabular Q update; UCB action choice over the three allowed actions.                          | `O(                                    | A           | )` per decision | `O( | S   | ×   | A                       | )`  | `visited-state-actions` |
| `count-first/v1`     | Choose a minimum pre-increment state-action count; update that count after action selection. | `O(                                    | A           | )` per decision | `O( | S   | ×   | A                       | )`  | `visited-state-actions` |

The canonical policy row order is exactly the order shown. Ties use the same
canonical action order, except where the policy’s declared rejection-sampled
tie stream is specified below. The candidate names are experiment identifiers,
not identities, rankings, capability certificates, or society roles.

No candidate receives a parameter cap, observed byte cap, reward quota, wall
clock deadline, cache exemption, or secret hardware characteristic. A caller
may invoke one policy decision/update at each action boundary and may end an
episode when its 100th environment step completes. This is a bounded-duration
tick envelope, not a measurement or enforcement of internal computational work.

## 3. Deterministic Training, Evaluation, and Tick Semantics

The experiment consists of 1,000 training episodes followed by 100 frozen
evaluation episodes per policy. The environment fixture must call
`reset(seed)` before every episode. The environment starts identically for this
specific carrier, but each reset seed remains a load-bearing receipt field.

| Phase      | Exact reset seed roster                          | Policy-state rule                                                    | Tick envelope                 |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------- |
| Training   | Ascending integers `1000…1999`, one per episode  | Update only in this phase.                                           | 100 action boundaries/episode |
| Evaluation | Ascending integers `2000…2099`, one per seed row | Freeze every learned/count table before the first evaluation action. | 100 action boundaries/episode |

The policy random stream is SplitMix64 with initial state
`0x4d47504f4c435631 XOR uint64(resetSeed)`. Sampling of an action or tie index
uses rejection sampling: accept a 64-bit word only when it is below
`UInt64.MaxValue - (UInt64.MaxValue % 3)` and return word modulo three. The
stream’s draw/rejection counts are receipt fields. No ambient RNG, local time,
CPU count, device identity, process ID, thread timing, or network input may
enter a policy, source fixture, result receipt, or canonical serialization.

Q policies use the following frozen update whenever an action has produced its
transition reward `r`, terminal flags, and next static state `s'`:

```text
Q(s,a) ← Q(s,a) + 0.10 × (r + 0.95 × max_b Q(s',b) − Q(s,a))
```

The bootstrap maximum is zero after either `terminated=true` or
`truncated=true`. `q-epsilon/v1` uses ε = 0.10, selecting a uniform sampled
action when its fixed ten-way draw is zero; otherwise it selects the earliest
canonical maximum-Q action. `q-ucb/v1` chooses an unseen action first, ties by
the declared three-way stream, then maximizes
`Q(s,a) + sqrt(2 × ln(max(1,t+1)) / visits(s,a))`, with earliest canonical tie
break. `t` is the completed training-action count. `uniform-random/v1` does
not update Q or counts.

## 4. Local Novelty Accounting

Novelty is a receipt-local training diagnostic, never an external reward,
fitness function, society objective, or policy-selection authority. For a
chosen training pair `(s,a)` with count before action `n_before(s,a)`, record:

```text
preIncrementNovelty(s,a) = 1 / (1 + n_before(s,a))
```

The action policy sees only its own declared information. `count-first/v1`
uses pre-increment counts to choose an action; it updates the chosen count after
the action is selected. All policy rows record the mean of the same
`preIncrementNovelty` diagnostic across their training actions. Evaluation
records no novelty and makes no update. This order is load-bearing: computing
novelty after increment or updating during evaluation is a protocol failure.

## 5. Result Receipt and Statistics

Two independently authored result emitters are required: an F# emitter using
the merged static adapter and a Python emitter using the pinned upstream
MiniGrid fixture. Neither may import, spawn, parse, or use the other’s policy,
transition, or receipt output. Both must first validate all parent source,
runtime, and carrier identities.

Each canonical UTF-8 result receipt must include the following fields in the
shown logical order and preserve binary64 result values as 16-character
lowercase IEEE-754 bits:

| Field group         | Required content                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity            | Experiment schema, parent carrier/source/runtime hashes, implementation identity, static projection, and canonical action/policy orders.                                 |
| Self-reports        | Exact policy declaration bytes/fingerprints and parsed declared time/space shapes.                                                                                       |
| Tick source         | Explicit `benchmark-fixed-duration/v1`, 100 steps per episode, caller/experiment identity, and no unlisted limit.                                                        |
| Training row        | Per-policy return bits/diagnostic ppm, terminal/truncation totals, pre-increment novelty bits, unique state-actions, stream draws/rejections, and training table digest. |
| Evaluation seed row | Reset seed, return bits/ppm, actions, terminal/truncation status, action count, stream draws/rejections, and table digest before/after evaluation.                       |
| Aggregates          | Mean return ppm, terminal count, mean evaluation action count, means for the training diagnostics, and the exact roster identities.                                      |
| Comparison only     | Candidate-minus-baseline paired return deltas, a predeclared bootstrap receipt, and `observation-only-no-winner`.                                                        |

The bootstrap uses 10,000 paired resamples of the 100 evaluation row indices.
The deterministic index stream has initial SplitMix64 state
`0x4d47504f4c435631`; it uses the same rejection procedure for bound 100;
the receipt records number of draws, rejections, complete accepted-index
digest, and empirical 2.5th/97.5th percentile indices
`floor(0.025×9999)` and `ceil(0.975×9999)`. The comparison sign is
`baselineReturnPpm − candidateReturnPpm`, so a negative delta means only that
the named candidate’s mean return was higher on this carrier.

No interval, mean, terminal count, novelty statistic, rank, or sign may permit
automatic selection, deployment, tick allocation, agent admission, social
standing, authority, or a claim of general transfer. The only allowed result
label is `observation-only-no-winner`.

## 6. Required Refusals and Mutations

Every item below must be observed to fail before a result receipt is admitted.

| Invalid input or mutation                                                                                 | Required observation                           |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Parent source/runtime/carrier hash, projection, or action identity differs.                               | Refuse before reset/action one.                |
| Policy order, policy self-report, action order, or policy RNG initialization differs.                     | Canonical roster/self-report mismatch refusal. |
| Training/evaluation seed rosters overlap, duplicate, omit, or reorder a value.                            | Result-roster refusal.                         |
| Evaluation update changes a Q/count/table digest.                                                         | Frozen-evaluation refusal.                     |
| Novelty is calculated after increment or used as a transition reward.                                     | Novelty-order/reward-channel refusal.          |
| One policy receives a byte/reward/parameter/wall-clock cap not carried by the caller-owned tick envelope. | `refuse-undeclared-external-budget`.           |
| Candidate/baseline action alphabet, horizon, reset sequence, or source adapter differs.                   | Equal-access refusal.                          |
| One emitter invokes/parses the other implementation or receipt.                                           | Cross-oracle-independence refusal.             |
| A result field requests winner, ranking, authority, consensus, NCI, or society effect.                    | Schema refusal; no canonical receipt.          |
| Bootstrap seed, accepted-index digest, or percentile ordering differs.                                    | Statistical-replay refusal.                    |

## 7. Non-Claims

This contract does not claim an official MiniGrid benchmark reproduction or
comparison to published MiniGrid agents. The full static adapter state is more
informative than MiniGrid’s usual partial observation and is admitted solely as
a separately named interface. The contract does not test visual perception,
mission/language processing, stochastic environment generalization, transfer
across carriers, non-Gaussian learning, tangle steering, semantic grounding,
social cooperation, consent, NCI preservation, consensus, parameter efficiency,
energy efficiency, or general intelligence.

The declared asymptotic shapes are self-reports checked for syntax and configured
scope only. The tick envelope is a duration quantization supplied by the
experiment; it is neither a physical tick theorem nor a universal resource law.

## References

[1]: https://github.com/Farama-Foundation/Minigrid/tree/v3.1.0 "MiniGrid v3.1.0 source and Apache-2.0 license"
[2]: https://minigrid.farama.org/ "MiniGrid documentation"
[3]: 2026-09-06-minigrid-empty-5x5-v310-adapter-contract.md "Pinned MiniGrid source/transition adapter contract"
[4]: 2026-09-06-policy-self-knowledge-tick-admissibility-contract.md "Policy self-report and tick-envelope boundary"
