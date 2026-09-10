# ARC-AGI-3 readiness and no-cheating boundary

**Status:** Research and integration-readiness audit only.  
**Date:** 2026-09-08  
**Author:** Manus AI (Lumen)

## Decision

Zeta already contains an **internal ARC-engine integration lane**: `src/Arc.Python` installs and drives `arc-agi`/`arcengine`, separates source-owned games from hosted wrappers, has an offline action/frame driver, a hosted `EnvironmentWrapper` path, a source-owned scorecard REST port, and recorded synthetic ARC/CHIP-8 transfer controls.[6] Zeta also has an older TypeScript static ARC-puzzle harness and cross-emulator ARC/CHIP-8 environment seams. Those are real adapter and game-research work.

What Zeta does **not** yet have is a verified official ARC-AGI-3 evaluation integration: there is no pinned official public-game/toolkit/harness/scorecard/replay receipt, no public or private official ARC-AGI-3 result, and no registered competition submission. The current finite MiniGrid and contextual-grid witnesses do not transfer automatically to ARC-AGI-3. This report therefore freezes a pre-registration boundary for an **officially attributable ARC-AGI-3 result**, not a claim that the repository contains no ARC adapter.

> “100%” in ARC-AGI-3 denotes beating every game as efficiently as humans; it is not merely solving a fixed collection of static grids.[1]

## Official benchmark facts

ARC-AGI-3 is an interactive, turn-based benchmark: an agent must explore novel environments, acquire a goal, act, and adapt from environmental feedback rather than receive natural-language task instructions.[1] The official toolkit exposes versioned game identifiers, reset/step interaction, a game-specific action space, scorecards, and recordings/replays.[2] The documentation index includes both simple actions and a complex coordinate-bearing action, so a Zeta benchmark adapter cannot assume the three actions of MiniGrid Empty-5×5.[3]

| Official surface                             | Audit consequence for Zeta                                                                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public, semi-private, and private task tiers | Public tasks may support local development only. A public result is not a private-evaluation result.                                                                                                             |
| Standard and Provider Adapter harnesses      | Any result must name its harness; their context-management semantics differ and must not be pooled.[4]                                                                                                           |
| Scorecards and replays                       | A future receipt must preserve the official scorecard identifier and the full declared action/reasoning trace or a hash and retrievable recording reference.                                                     |
| Competition mode                             | The official toolkit documents single scorecard and single `make()` constraints, API interaction, all-environment scoring, and level-reset behavior; an offline local probe is not competition-mode evidence.[2] |
| Verified evaluation policy                   | Official verification is performed by ARC Prize under its own process. Community/submitted results must be labelled unverified unless ARC Prize verifies them.[4]                                                |

The current competition page says that competition submissions are made through the designated Kaggle competition, require no internet during evaluation, require open source for prize eligibility, and will have hardware/compute limits announced at launch.[5] Separately, ARC Prize’s public Verified policy describes a community-submission path that can permit publicly available APIs and specifies a one-click Kaggle notebook and a less-than-12-hour run for verification consideration.[4] These are distinct official contexts; this report does not infer the final competition hardware or tool limits from the community policy.

## “Smallest model” is a research objective, not a current result

The phrase **smallest model that does not cheat** needs a measurable comparison protocol. Parameter count alone is insufficient: an agent may use external model calls, retrieval, opaque provider state, tools, cached game data, prompt tokens, latency, RAM, accelerator time, or an adapter harness. Conversely, a small parameter count does not demonstrate valid generalization if public games or private evaluation data influenced development.

For any future ARC-AGI-3 result, Zeta must report the following separate quantities, without combining them into a single “intelligence-per-parameter” number: declared model/weights identity and parameter count; all static prompt/context assets; allowed tools and external services; harness type; public-task development exposure; API/model calls, input/output tokens, wall duration, peak memory, accelerator model/time and energy-meter method where available; scorecard and replay identities; seed/reset information when the official interface exposes it; and all failures/retries. If a quantity cannot be measured, the receipt must say **unmeasured**, not estimate it.

No claimed result may call itself “no cheating” merely because it is open source. The narrow practical meaning adopted here is **rule-constrained evaluation provenance**: run only through the declared official interface/harness; no undeclared tools, data, network, model calls, reset behavior, cached task solutions, or manual intervention; and retain artifacts sufficient for a reviewer to detect a declared-boundary mismatch. This is not proof that hidden leakage is impossible.

## Current Zeta readiness

| Zeta seam                             | Current relevance                                                                                                                                            | Missing official-result requirement                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical evidence/receipt discipline | Supports immutable input identities, deterministic rendering, retained refusal, and independent check design.                                                | No official ARC SDK input, scorecard, replay, or official artifact binding.                                                                                                                         |
| Contextual-grid and MiniGrid controls | Demonstrate finite F#/Python conformance and matched-policy protocol work in declared toy carriers.                                                          | Neither carrier establishes ARC generalization.                                                                                                                                                     |
| MiniGrid adapter                      | A five-action static transition witness is independently checked.                                                                                            | ARC actions are game-specific and can include coordinates/undo; MiniGrid projection must not be reused by assumption.                                                                               |
| Policy self-knowledge / ticks         | Supports local descriptive complexity declarations and caller-owned duration envelopes.                                                                      | ARC official action, token, harness, and scorecard constraints need their own pinned receipt fields.                                                                                                |
| `src/Arc.Python/zeta_arc`             | Drives `arcengine`, separates source-owned games from hosted wrappers, owns action/frame/REST scorecard seams, and records synthetic ARC/CHIP-8 controls.[6] | Its own README records that real ARC environments and hosted leaderboard promotion still require an unavailable API key and held-out evidence; source-owned/BFS scores are not leaderboard figures. |
| `GameEnvironment` / `ArcRestAdapter`  | A repository-native F# cross-emulator environment abstraction maps canonical controls to ARC-style actions and envelopes.                                    | It targets Zeta's `IArcRestPort`, not a proven ARC Prize official scorecard/replay run.                                                                                                             |
| TypeScript ARC puzzle harness         | Loads static ARC JSON training examples into the Swarm with an attributed model-spend cap.                                                                   | It is a static-data harness, not ARC-AGI-3 interactive official evaluation; its cap is a cost rail, not an ARC rule or score.                                                                       |
| ARC-labelled cluster manifests        | These configure GitHub Actions Runner Controller, not ARC-AGI evaluation.                                                                                    | They provide no benchmark result.                                                                                                                                                                   |

The precise conclusion is **not ready to report an official ARC-AGI-3 evaluation**. Zeta has a meaningful internal ARC/CHIP-8 research and adapter substrate, but is only ready to begin an official-result adapter contract after the chosen official toolkit and benchmarking revisions, public-game policy, harness, allowed action interface, and recording/scorecard receipt fields are frozen.

## Required pre-registration before any public-task probe

1. Pin the ARC toolkit and benchmarking repository revisions, dependency lock, selected public game version, operation mode, harness, and action schema.
2. Write a separate adapter contract that does not reuse MiniGrid action or observation semantics.
3. Extend the existing hosted-wrapper and ARC REST seams with a non-scoring conformance probe containing no agent/model: reset one declared public game, submit a declared valid action, and record only official response/replay/scorecard metadata permitted by the SDK.
4. Implement an independent verifier for the probe artifact and mutations for changed toolkit/game/harness/action/recording/scorecard identity, unexpected network/tool use, and undeclared context retention.
5. Only then define an agent-evaluation contract with matched harness/tool conditions and measurements. A public development score must remain labelled local/unverified and must never be tuned against a private task.

No scheduler, heartbeat, cluster runner, consensus record, NCI witness, or attestation status may select an ARC policy, authorize a submission, or transform a local probe into an official result.

## References

[1]: https://arcprize.org/arc-agi/3 "ARC-AGI-3 overview"
[2]: https://github.com/arcprize/arc-agi "ARC-AGI Toolkit repository and README"
[3]: https://docs.arcprize.org/llms.txt "ARC-AGI-3 documentation index"
[4]: https://arcprize.org/policy "ARC Prize Verified Testing Policy"
[5]: https://arcprize.org/competitions/2026/arc-agi-3 "ARC Prize 2026 ARC-AGI-3 Competition"
[6]: ../../src/Arc.Python/README.md "Zeta ARC Python lane: engine, hosted, offline, and explicit non-leaderboard boundaries"
