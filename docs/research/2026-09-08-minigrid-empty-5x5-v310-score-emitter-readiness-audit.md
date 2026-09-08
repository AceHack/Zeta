# MiniGrid Empty-5x5 v3.1.0 Score-Emitter Readiness Audit

**Status:** preparation only; no policy was executed and no MiniGrid score was emitted.

> **Recommendation:** begin with two independently authored 100-step episode
> runners—not a shared policy library. The F# runner must use the static
> adapter; the Python runner must use the pinned upstream fixture. They should
> first agree on a no-learning, single-policy trace receipt before adding the
> four-policy training/evaluation result emitter specified in the merged
> policy-comparison contract.[1] [2]

## Available, Verified Seams

| Surface                        | Present capability                                                                                                                                           | Boundary retained                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| F# `MiniGridEmpty5x5Adapter`   | Raw-byte carrier admission; static global state; action `left/right/forward`; single-step reward/terminal/truncation; canonical five-action witness.         | It does not reset an upstream environment, maintain policy state, select actions, count novelty, or aggregate episodes.     |
| Python upstream fixture        | Pins runtime/source identities; invokes `gym.make`, `reset(seed)`, and `step(action)`; validates upstream observation digest; canonical five-action witness. | It does not provide an F# policy implementation, training/evaluation split, table freeze, or aggregate comparison.          |
| Contextual-grid result receipt | Demonstrates canonical roster admission, seed rows, table digests, paired bootstrap accounting, and cross-oracle byte replay.                                | Its cardinal action set, reward carrier, seed scheme, policy code, and result identity must not be reused as MiniGrid data. |
| Policy-admissibility receipt   | Parses self-reported time/space shapes and rejects undeclared external caps.                                                                                 | It does not prove runtime complexity, schedule MiniGrid work, or rank policies.                                             |

## Smallest Independent Preflight

The first implementation must add one F# and one Python **single-episode
preflight** runner. Both receive the already pinned parent carrier, reset with
seed `2000`, use a contract-owned fixed action trace, and emit a canonical
row. They must not train, compute novelty, update Q/count tables, bootstrap,
compare policies, or label a result a score.

| Required canonical field                                                                           | Purpose                                                                     |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Parent carrier fingerprint, upstream commit, runtime identities, projection, action order          | Prevent substitution of a different environment or observation interface.   |
| Phase `preflight-evaluation-only/v1`, reset seed, tick-source identity, maximum 100 steps          | Distinguish the preflight from the later training/evaluation experiment.    |
| Per-action integer/name, projected next state, raw reward binary64 bits, terminal/truncation flags | Test transition parity without treating scalar return as a policy result.   |
| Action count, complete trace digest, terminal summary                                              | Permit byte-level cross-oracle replay and missing/extra-step refusal.       |
| `policyStateDigest: null`, `novelty: null`, `comparison: null`, `verdict: preflight-only-no-score` | Make unavailable learning/selection fields explicit rather than fabricated. |

Both runners must reject a parent identity mismatch before reset and must use
their own local transition/payload code. The Python runner may call the
upstream package; the F# runner must remain static and must not launch or parse
Python. A byte mismatch is a retained conformance finding, not a reason to
select one emitter as authoritative.

## Required Preflight Faults

The preflight cannot be admitted until all of the following are observed.

| Mutation                                                                                    | Required result                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------ |
| Change parent carrier/source/runtime/projection/action identity.                            | Refuse before reset.                 |
| Reorder, omit, or append an action; change its integer mapping.                             | Trace/receipt mismatch refusal.      |
| Change reward bits, terminal/truncation field, action count, or trace digest.               | Canonical receipt refusal.           |
| Introduce Q/count/novelty update, training roster, policy rank, winner, or authority field. | Schema/scope refusal.                |
| Inject an unlisted byte/reward/parameter/wall-clock limit.                                  | `refuse-undeclared-external-budget`. |
| Introduce a Python bridge in F# or a TypeScript/F# result dependency in Python.             | Cross-oracle-independence tripwire.  |

Only after this source/transition preflight, a separate implementation contract
may add the contract’s four policy rows, `1000…1999` training roster,
`2000…2099` frozen evaluation roster, pre-increment novelty diagnostic, and
paired bootstrap receipt. It must continue to report
`observation-only-no-winner`; no result can move into a heartbeat or society
loop.

## References

[1]: 2026-09-07-minigrid-empty-5x5-v310-policy-comparison-contract.md "Merged MiniGrid policy-comparison contract"
[2]: 2026-09-06-minigrid-empty-5x5-v310-adapter-conformance-result.md "Source/transition conformance boundary"
