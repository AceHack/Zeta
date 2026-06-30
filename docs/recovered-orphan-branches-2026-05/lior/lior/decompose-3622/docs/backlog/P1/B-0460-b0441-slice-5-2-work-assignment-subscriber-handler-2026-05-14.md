---
id: B-0460
priority: P1
status: shipped
title: "B-0441 slice 5.2 — work-assignment subscriber handler (agent-side claim-and-act)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0441
depends_on: [B-0449]
composes_with: [B-0441, B-0449, B-0459, B-0461]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, work-assignment]
type: feature
---

# B-0441 slice 5.2 — `work-assignment` subscriber handler

## Origin

B-0449 (bg-services subscriber-agent architecture design pass) explicitly reserved this ID:

> "Once Option C is adopted (or alternative chosen), three follow-up rows track
> per-topic handler implementation:
>
> - B-0459 — `infinite-backlog-nudge` handler (slice 5.1)
> - **B-0460 — `work-assignment` handler (slice 5.2)**
> - B-0461 — `missed-substrate-cascade` handler (slice 5.3)"

This row is the implementation of that design. B-0459 (slice 5.1) is the sibling for
the `infinite-backlog-nudge` topic; B-0461 (slice 5.3) is the sibling for
`missed-substrate-cascade`.

## Context: what B-0441's notifier produces

`tools/bg/backlog-ready-notifier.ts` (B-0441, slices 1+2+4 live) publishes:

```json
{
  "topic": "work-assignment",
  "to": "*",
  "payload": {
    "rowId": "B-NNNN",
    "priority": "P1",
    "rationale": "Ready-to-grind: B-NNNN is open with all deps satisfied. ..."
  }
}
```

This slice implements the per-tick handler that reads and acts on that envelope.

## Acceptance criteria

- [x] B-0449 has landed `tools/bus/subscribe.ts` exporting `subscribeOnce(topic, handler)`
      (this row blocks until B-0449 is merged — see dependency chain)
- [x] Per-tick handler for `work-assignment` topic (Option C architecture per B-0449):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, rowId, priority, rationale) to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - **Action stub** (minimum for slice 5.2): reads `rowId` from payload and queues it
    as speculative-work candidate for step 3 of the same tick
    (per B-0449 Option C: subscriber wires into step 1 and queues work into step 3)
  - Optional AC: invokes `bun tools/bus/claim.ts acquire --from <surface> --item <rowId>`
    to claim the row proactively (only when the claim exits 0; skip on conflict)
- [x] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("work-assignment", workAssignmentHandler)` alongside the
      `infinite-backlog-nudge` subscriber call added by B-0459
- [x] Unit tests (DST-replayable with fake bus dir + injected envelopes):
  - Work-assignment envelope present → logged, consumed, no error,
    `rowId` surfaced as speculative-work candidate
  - No envelope → no-op, no error
  - Malformed envelope (missing `rowId`) → logged as warning, consumed, no throw
  - Claim-acquire Optional AC: when claim exits 0 → `acquire` was called with correct
    `--item` value
- [x] `tools/bg/README.md` §"What's still pending" updated: slice 5.2 stub landed

## Scope (what is NOT in scope)

Per B-0449 Option C, the **stub** behavior is: log + consume + queue into step 3.
A "full" implementation that autonomously opens PRs or performs multi-step
implementation work is a later slice (slice 5.2+). The goal here is to close the loop:
agent tick reads work-assignment → registers it as "I should look at this" → backlog-
item-start-gate discipline applies from that point forward.

## Dependency chain

```
B-0400 (bus protocol — closed)
  └─ B-0449 (subscribe-once library + step-1 wiring design)
       └─ B-0459 (slice 5.1 — infinite-backlog-nudge handler)
       └─ B-0460 (THIS ROW — work-assignment handler; slice 5.2)
```

B-0460 is a sibling of B-0459, not a sequential dependency. Both depend on B-0449;
either can land first once B-0449 merges.

## Composes with

- B-0400 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- B-0441 (backlog-ready-notifier — produces the work-assignment envelopes)
- B-0449 (subscribe-once library — transport this handler uses)
- B-0459 (slice 5.1 — sibling handler for `infinite-backlog-nudge`)
- B-0461 (slice 5.3 — sibling handler for `missed-substrate-cascade`)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (step 1 is where the subscriber call lands)
- `.claude/rules/claim-acquire-before-worktree-work.md` (Optional AC uses claim.ts)

## Pre-start checklist (per backlog-item-start-gate)

- [x] Verify B-0449 is merged: `grep -q "^status: closed" docs/backlog/P1/B-0449-*.md`
- [x] Verify `tools/bus/subscribe.ts` exists and exports `subscribeOnce`
- [x] Read B-0459 implementation as the canonical sibling reference before writing
- [x] Check `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 current text to know exact
      insertion point for the new `subscribeOnce("work-assignment", ...)` call
