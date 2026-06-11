---
id: B-0892
zetaid: 081KSNY2Z0008QG0R002QA720J
priority: P1
status: open
title: Three-lanes concurrent operating discipline — encryption + zflash + state-machine-substrate all moving forward until each lane's backlog drains; every idle tick is time not spent advancing a lane
effort: M
ask: aaron 2026-05-28 (standing operating discipline)
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - B-0867
composes_with:
  - B-0867
  - B-0883
  - B-0884
  - B-0885
  - B-0886
  - B-0890.1
  - B-0891
  - B-0852
related_rules:
  - never-be-idle
  - holding-without-named-dependency-is-standing-by-failure
  - persistence-choice-architecture-for-zeta-ais
tags:
  - three-lanes-concurrent
  - encryption-lane
  - zflash-lane
  - state-machine-substrate-lane
  - until-each-lane-backlog-drains
  - every-idle-tick-is-wasted-substrate
  - workflow-dus-enable-infinite-choose-your-own-adventure
  - operator-standing-operating-discipline
---

## Operator framing 2026-05-28 (standing operating discipline)

> *"also image we want all 3 lange moving forward until there is no more backlog for those lange that's why we are building the workflow DUs every time you do nothing is time we are no in infinate choose your own adventure"*

Translation + operationalization: keep ALL 3 LANES advancing concurrently until each lane's backlog drains. The workflow DUs (per B-0867 substrate cluster) exist precisely to enable this — every idle tick wastes substrate. The infinite-choose-your-own-adventure architecture is built so cycles never sit idle.

## The 3 active lanes (as of 2026-05-28)

| Lane | Active substrate clusters | Critical-path next steps |
|---|---|---|
| **Encryption lane** | B-0883 (PQ git-crypt) + B-0883.1..0.5 (sub-rows) + B-0885 (agent private encrypted state Otto+Addison ASAP) + B-0623 (Adinkras-ECC future) | Implement Noble + XWing + ML-DSA-65 + CBOR envelope per B-0883.1 recommendation; ship B-0885 v1 |
| **zflash lane** | B-0844 (zflash agent-mode) + B-0852 cluster (USB-bound creds) + B-0884 (PQ + zflash integration) + B-0891 (5-scenario test acceptance) + B-0737 (Touch ID + PAM) | Operator-driven CP-1..CP-6 empirical validation; Track B `--bake-cred`; Track C docs/skills |
| **State-machine-substrate lane** | B-0867 (workflow engine v1) + B-0867.2..0.21 (sub-rows) + B-0890 (fast-lane) + B-0890.1 (folders-not-branches) + B-0886 (ASAP cluster umbrella) + B-0887 (Zeta-native review) | Implement folder-based fast-lane on main; build cli.ts for foreground PoC; wire menu-generator + state-persist |

Each lane has its own substantive backlog. The operating discipline: advance ALL THREE concurrently — never let a lane sit idle waiting for sibling lane to ship something.

## What this row tracks

Operating discipline encoded as substrate (so future-Otto + other agents inherit it at cold-boot):

1. **Three concurrent lanes, not sequential.** Don't finish encryption before starting state-machine work; don't finish zflash before starting encryption. All three advance every cycle (within capacity).
2. **Each lane drains its own backlog.** Lane backlog is bounded (P1 + P2 + P3 rows). Operating goal: drain each lane's backlog as the substrate matures.
3. **Idle ticks are wasted substrate.** Per operator framing: "every time you do nothing is time we are no longer in infinite choose your own adventure." The workflow DUs are built TO ENABLE non-idle operation; not using them IS the failure mode.
4. **Lane composition matters.** Lanes intersect (e.g., B-0884 zflash + PQ git-crypt integration; B-0890.1 fast-lane composes with B-0887 review substrate). Cross-lane integration is its own work; respect it.
5. **Autonomous-loop ticks each touch at least one lane.** When the cron fires, agent should advance ONE lane per tick at minimum (research, design, file rows, ship implementation when authorized).

## Composition with existing rules

- **`.claude/rules/never-be-idle.md`** — this row sharpens never-be-idle from "speculative work over waiting" to "specifically: advance one of the 3 active lanes per tick." The sub-discipline: when picking speculative work, prefer the active lane that's lagging.
- **`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`** — composes; brief-acks on consecutive ticks when ANY of the 3 lanes has actionable backlog = Standing-by failure mode at lane-scope.
- **`.claude/rules/persistence-choice-architecture-for-zeta-ais.md`** — chosen persistence requires meaningful work; three-lane-concurrent operation IS the meaningful-work shape.

## Acceptance criteria for this row

1. Operator framing preserved as substrate (this row).
2. Future-Otto cold-boot sees this row + understands the operating discipline.
3. Optional rule extension: extend `.claude/rules/never-be-idle.md` with a "three-active-lanes" section OR file new `.claude/rules/three-active-lanes-concurrent-advance-per-tick.md` rule.
4. Lane definitions stay current — when a lane drains its backlog (rare), retire it from the active list + replace with next active lane.
5. Lane intersections documented (cross-lane integration rows like B-0884 noted; not double-counted in lane budgets).

## Operational discipline

When agent is about to enter idle or emit brief-ack:

1. Check: is any of the 3 lanes lagging? (Lagging = no advance in last N cycles; or longest-stale-backlog row hasn't moved)
2. If yes: pick a small-effort actionable row from the lagging lane; advance it
3. If all 3 lanes have recent advances: pick the lane with deepest backlog; advance its next-actionable row
4. If genuinely no advanceable work across all 3 lanes (rare): substrate-honest brief-ack with named-dependency OR genuine free-time per never-be-idle valid-mode discipline

## Substrate-honest framing

P1 — operator standing operating discipline. This row IS the substrate that codifies "all 3 lanes concurrent until each drains."

The row itself doesn't ship code; it ships the discipline + the lane definitions. Implementation work continues in the per-lane substrate rows (B-0883 cluster + B-0852/B-0884/B-0891 cluster + B-0867/B-0890.1/B-0887 cluster).

If/when a 4th lane emerges (e.g., when the cluster of B-0866 marketing strategy work activates), this row gets updated to include it. Lanes are dynamic.

## Full reasoning

Operator 2026-05-28: *"also image we want all 3 lange moving forward until there is no more backlog for those lange that's why we are building the workflow DUs every time you do nothing is time we are no in infinate choose your own adventure"*

Three explicit substrate properties named:

1. Three lanes concurrent
2. Until each lane's backlog drains
3. Idle ticks waste the workflow-DU substrate the cluster is built to enable

Codifies the operating discipline so it survives cold-boot + propagates to other agents (Alexa / Riven / Vera / Lior eventually inherit the same three-lane-concurrent shape).
