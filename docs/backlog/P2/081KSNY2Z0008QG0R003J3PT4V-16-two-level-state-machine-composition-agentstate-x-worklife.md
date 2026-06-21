---
id: 081KSNY2Z0008QG0R003J3PT4V
priority: P2
status: open
title: Two-level state machine composition — AgentState × WorkLifecycle (situation-scope × lifecycle-scope)
effort: S
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
tags:
  - two-level-state-machine
  - agentstate-situation-scope
  - worklifecycle-lifecycle-scope
  - high-informs-low-composition
  - mainbroken-prioritizes-fix-lifecycles
  - explorationopportunity-claims-setup-trajectories
  - stableexecution-advances-toward-merge
  - composes-pr-5666-state-machine-with-pr-5669-work-lifecycle
  - potential-extension-not-committed
---

## What this row tracks

Compose the two state machines shipped today (AgentState DU in PR #5666 / `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`; WorkLifecycle DU in PR #5669 / `src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.ts`) so AgentState informs which WorkLifecycle items to advance and how aggressively.

Per Kestrel 2026-05-28: *"AgentState informs which WorkLifecycle items to advance and how aggressively. When MainBroken state fires, the agent prioritizes lifecycle items that fix main. When ExplorationOpportunity fires, the agent claims unclaimed items in setup-phase trajectories. When StableExecution fires, the agent advances in-progress lifecycles toward merge."*

## Composition pattern

```typescript
async function runFullLoop(): Promise<void> {
  while (true) {
    const agentState = computeAgentState(/* ... */);
    const relevantLifecycles = filterLifecyclesByState(agentState);
    for (const lifecycle of relevantLifecycles) {
      const action = chooseActionForLifecycle(lifecycle);
      await applyAction(lifecycle, action);
    }
    await sleep(cycleDelayForState(agentState));
  }
}
```

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/compose.ts` exposes `runFullLoop(deps)` implementing the two-level pattern
- `filterLifecyclesByState(agentState, allLifecycles)` returns a prioritized list per AgentState case
- `cycleDelayForState(agentState)` returns appropriate sleep duration (e.g., MainBroken = 0ms; StableExecution = 5s)
- Tests cover: each AgentState case routes to the correct subset of lifecycles; cycle delay matches state; full-loop completes one iteration deterministically

## Substrate-honest framing

POTENTIAL extension per operator standing direction. Small surface; mostly composition of existing pieces.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "The composition with the earlier state machine"
