---
id: B-0500
priority: P1
status: closed
title: "B-0441 slice 3 — wire isAgentQueueEmpty guard into pollOnce"
tier: factory-infrastructure
effort: XS
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0441
depends_on: []
composes_with: [B-0441, B-0501, B-0502]
tags: [background-service, queue-state, bus, mechanization, anti-idle]
type: feature
---

# B-0441 slice 3 — queue-state guard wiring into `pollOnce`

## Origin

`tools/bg/backlog-ready-notifier.ts` already contains `isAgentQueueEmpty` (slices 1+2+4
landed; per `tools/bg/README.md`: "1+2+4 live"). However `pollOnce` publishes work-assignment
envelopes **unconditionally** whenever ready rows exist — the queue-state guard is never
consulted. The file header comment acknowledges this explicitly:

> "Queue-state detection (only assign when an agent's queue is empty) is slice 5;
> slice 4 publishes unconditionally when ready rows exist so the reactive loop is
> closed end-to-end."

The comment labels this as "slice 5" using B-0441's original design-sketch numbering;
the README's canonical per-service ordering calls it "slice 3" (second detection signal).
Either label — the gap is real: an agent actively grinding a branch will still receive
work-assignment envelopes on every poll cycle.

## Acceptance criteria

- [x] `pollOnce` consults `isAgentQueueEmpty(config.targetAgent, adapters)` before
      publishing any work-assignment envelopes
  - When queue is NOT empty → skip publish; include `"queueBusy: true"` in the
    `PollResult` note field; return early (no envelopes published)
  - When queue IS empty (or unknown agent) → proceed with current publish logic
  - Conservative default: adapter failures (`execGitLog → null`, `execGhPrList → null`)
    are treated as queue BUSY (do not trigger assignment) — matches the existing
    `isAgentQueueEmpty` behavior
- [x] `NotifierConfig` gains a `targetAgent` field (default `"otto"`); `parseArgs`
      wires `--target-agent <agent>` flag (accepts any string; not restricted to
      `SENDER_IDS` because the agent patterns map is the actual lookup)
- [x] `PollResult` gains a `queueBusy: boolean` field; `pollOnce` populates it
- [x] Adapters interface unchanged (already includes `execGitLog` + `execGhPrList`
      + `agentPatterns` — exactly what `isAgentQueueEmpty` needs)
- [x] Existing tests updated to pass `targetAgent` where `DEFAULT_CONFIG` is used
- [x] New tests added:
  - `pollOnce` with queue-busy adapters → `publishedEnvelopeIds` empty,
    `queueBusy: true`, no `publishAssignment` calls
  - `pollOnce` with queue-empty adapters AND ready rows → envelopes published,
    `queueBusy: false`
  - `--target-agent` parsed correctly by `parseArgs`

## Design sketch

```typescript
// In pollOnce, before the publish block:
const busy = !isAgentQueueEmpty(config.targetAgent, adapters);
if (busy) {
  return {
    pollAt: pollAt.toISOString(),
    totalOpenRows: openRows.length,
    readyRowsFound: readyRows.length,
    candidateIds: readyRows.slice(0, 10).map(r => r.id),
    publishedEnvelopeIds: [],
    lastPublishError: null,
    queueBusy: true,
    note: `queue busy for ${config.targetAgent} — skip publish`,
  };
}
// existing publish block continues...
```

## Why XS effort

The function `isAgentQueueEmpty` is already written and tested. This slice is wiring
one conditional check + adding one config field + one result field + a small set of
tests. Net change: ~30 lines of implementation + ~40 lines of tests.

## Dependency chain

```
B-0441 (slices 1+2+4 shipped — backlog-ready-notifier.ts functional)
  └─ B-0500 (THIS ROW — wire queue-state guard; slice 3)
```

## Pre-start checklist (per backlog-item-start-gate)

- [x] Verify `isAgentQueueEmpty` signature in `backlog-ready-notifier.ts` before writing
- [x] Run `bun tools/bg/backlog-ready-notifier.test.ts` to confirm all existing tests pass
      before adding new ones
- [x] Verify `PollResult` type is exported (it is — used in test file)
