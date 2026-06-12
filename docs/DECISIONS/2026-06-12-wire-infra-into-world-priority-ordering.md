---
date: 2026-06-12
status: proposed
proposer: Alexa (Kiro)
reviewers-requested: [Rodney, Otto, Lior, Riven]
---

# ADR: Wire Infrastructure Signals into World + Define Priority Ordering

## Context

The observe framework (`tools/observe/`) is the universal autonomous-loop
controller. Its shape:

```
loadWorld() → observe(world) → execute(action) → repeat
```

Today `World` is `{ backlog, operator?, mode? }` — the controller is
blind to infrastructure state (cells, PRs, broadcasts). The readers
exist (`world-infra.ts`) but aren't wired in.

Per Rodney's razor: "after this, the existing loop runs for real against
the actual repo state today, with observe's pure-function shape preserved."

## Decision

### 1. Extend World with infrastructure signals

```typescript
export interface World {
  readonly backlog: readonly BacklogItem[];
  readonly operator?: OperatorChannel;
  readonly mode?: Mode;
  // NEW: infrastructure signals
  readonly cells?: CellState;        // from readCellState()
  readonly prs?: PRState;            // from readPRState()  
  readonly broadcasts?: BroadcastState; // from readBroadcasts()
}
```

All new fields are optional — a test harness or golden vector that
doesn't supply them gets the existing behavior unchanged.

### 2. Define priority ordering in observe()

The universal controller must decide: when multiple signals compete,
which wins? The ordering:

```
1. respond_to_operator     — human in the loop, always first
2. provision_cell          — starving cell = broken infrastructure
3. merge_pr               — CLEAN PR = free forward progress
4. do_item / decompose    — backlog work (the normal case)
5. explore / play / self_reflect — free modes
6. idle                    — nothing to do
```

This ordering is the **design content** of this ADR. It encodes:

- Operator always preempts (consent-first, NCI)
- Infrastructure health before feature work (broken cells block everything)
- Free forward progress before new work (merge what's done before starting new)
- Free modes available when work queue is empty (sovereign agent, not forced)

### 3. How this composes with universal interfaces

The observe framework IS the universal controller described in the
Ani architecture conversation. The mapping:

| Concept | Implementation |
|---------|---------------|
| Universal action grammar | `grammar-16.ts` — 16 slots, edit_grammar extends |
| Discriminated union state machine | `NextAction` type in observe.ts |
| move-next | `observe(world): NextAction` — the pure function |
| Event store | `event-sink-folder.ts` — git-native append-only |
| World state reader | `load-world.ts` + `world-infra.ts` |
| The loop | `loadWorld → observe → execute → loadWorld → ...` |

The hexagonal architecture pattern:

- **Core** (pure): observe.ts, grammar-16.ts, fold/simulate
- **Ports** (interfaces): World, NextAction, OperatorChannel, CellState, PRState
- **Adapters** (impure): load-world.ts, world-infra.ts, execute.ts, event-sink-folder.ts

Per Aaron's rule: only host-setup belongs in `tools/`. The pure core
(observe.ts, grammar-16.ts) will eventually move to `src/Core.TypeScript/`
in a separate commit. The adapters stay in tools/ (they're impure, they
shell out to git/gh/launchctl).

### 4. Golden vector extension

Add one golden vector per new priority path:

- Cell starving + backlog available → provision_cell wins
- PR clean + no operator + no starving cell → merge_pr wins
- Both empty → falls through to backlog as today

This ensures the priority ordering is mechanically tested, not just documented.

## Consequences

- `observe()` gains 2-3 new branches in its priority ladder
- `loadWorld()` gains 3 new optional calls (cell/PR/broadcast readers)
- All existing golden vectors pass unchanged (new fields are optional)
- The loop can now react to infrastructure state for real
- Follow-up: grammar promotion of provision_cell + merge_pr via edit_grammar

## Implementation Plan (first slice)

1. Extend World type with optional infrastructure fields
2. Wire readCellState + readPRState into loadWorld (behind opt-in flag)
3. Add priority branches to observe() for cells and PRs
4. Add 2-3 golden vectors for the new paths
5. Run existing test suite — must stay green

## Risks

- Priority ordering is a policy decision — may need Aaron override
- Shell-out readers (launchctl, gh) add latency to the loop tick
- Cell/PR state is eventually-consistent (60s heartbeat, not realtime)

Mitigations: readers are injected (testable), optional (graceful degradation),
and the 60s tick cadence means stale-by-seconds is acceptable.
