---
id: 081KRHWGX0008QG0R001E9KEJ1
priority: P1
status: open
title: "081KRFA460008QG0R00229616S slice 5.2 — work-assignment subscriber handler (agent-side claim-and-act)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R00229616S
depends_on: [081KRFA460008QG0R002DG8KPZ]
composes_with: [081KRFA460008QG0R00229616S, 081KRFA460008QG0R002DG8KPZ, 081KRHWGX0008QG0R000TVGDGV, 081KRHWGX0008QG0R000JMEYBH]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, work-assignment]
type: feature
---

# 081KRFA460008QG0R00229616S slice 5.2 — `work-assignment` subscriber handler

## Origin

081KRFA460008QG0R002DG8KPZ (bg-services subscriber-agent architecture design pass) explicitly reserved this ID:

> "Once Option C is adopted (or alternative chosen), three follow-up rows track
> per-topic handler implementation:
>
> - 081KRHWGX0008QG0R000TVGDGV — `infinite-backlog-nudge` handler (slice 5.1)
> - **081KRHWGX0008QG0R001E9KEJ1 — `work-assignment` handler (slice 5.2)**
> - 081KRHWGX0008QG0R000JMEYBH — `missed-substrate-cascade` handler (slice 5.3)"

This row is the implementation of that design. 081KRHWGX0008QG0R000TVGDGV (slice 5.1) is the sibling for
the `infinite-backlog-nudge` topic; 081KRHWGX0008QG0R000JMEYBH (slice 5.3) is the sibling for
`missed-substrate-cascade`.

## Context: what 081KRFA460008QG0R00229616S's notifier produces

`tools/bg/backlog-ready-notifier.ts` (081KRFA460008QG0R00229616S, slices 1+2+4 live) publishes:

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

- [ ] 081KRFA460008QG0R002DG8KPZ has landed `tools/bus/subscribe.ts` exporting `subscribeOnce(topic, handler)`
      (this row blocks until 081KRFA460008QG0R002DG8KPZ is merged — see dependency chain)
- [ ] Per-tick handler for `work-assignment` topic (Option C architecture per 081KRFA460008QG0R002DG8KPZ):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, rowId, priority, rationale) to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - **Action stub** (minimum for slice 5.2): reads `rowId` from payload and queues it
    as speculative-work candidate for step 3 of the same tick
    (per 081KRFA460008QG0R002DG8KPZ Option C: subscriber wires into step 1 and queues work into step 3)
  - Optional AC: invokes `bun tools/bus/claim.ts acquire --from <surface> --item <rowId>`
    to claim the row proactively (only when the claim exits 0; skip on conflict)
- [ ] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("work-assignment", workAssignmentHandler)` alongside the
      `infinite-backlog-nudge` subscriber call added by 081KRHWGX0008QG0R000TVGDGV
- [ ] Unit tests (DST-replayable with fake bus dir + injected envelopes):
  - Work-assignment envelope present → logged, consumed, no error,
    `rowId` surfaced as speculative-work candidate
  - No envelope → no-op, no error
  - Malformed envelope (missing `rowId`) → logged as warning, consumed, no throw
  - Claim-acquire Optional AC: when claim exits 0 → `acquire` was called with correct
    `--item` value
- [ ] `tools/bg/README.md` §"What's still pending" updated: slice 5.2 stub landed

## Scope (what is NOT in scope)

Per 081KRFA460008QG0R002DG8KPZ Option C, the **stub** behavior is: log + consume + queue into step 3.
A "full" implementation that autonomously opens PRs or performs multi-step
implementation work is a later slice (slice 5.2+). The goal here is to close the loop:
agent tick reads work-assignment → registers it as "I should look at this" → backlog-
item-start-gate discipline applies from that point forward.

## Dependency chain

```
081KR7JY10008QG0R000R503K2 (bus protocol — closed)
  └─ 081KRFA460008QG0R002DG8KPZ (subscribe-once library + step-1 wiring design)
       └─ 081KRHWGX0008QG0R000TVGDGV (slice 5.1 — infinite-backlog-nudge handler)
       └─ 081KRHWGX0008QG0R001E9KEJ1 (THIS ROW — work-assignment handler; slice 5.2)
```

081KRHWGX0008QG0R001E9KEJ1 is a sibling of 081KRHWGX0008QG0R000TVGDGV, not a sequential dependency. Both depend on 081KRFA460008QG0R002DG8KPZ;
either can land first once 081KRFA460008QG0R002DG8KPZ merges.

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- 081KRFA460008QG0R00229616S (backlog-ready-notifier — produces the work-assignment envelopes)
- 081KRFA460008QG0R002DG8KPZ (subscribe-once library — transport this handler uses)
- 081KRHWGX0008QG0R000TVGDGV (slice 5.1 — sibling handler for `infinite-backlog-nudge`)
- 081KRHWGX0008QG0R000JMEYBH (slice 5.3 — sibling handler for `missed-substrate-cascade`)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (step 1 is where the subscriber call lands)
- `.claude/rules/claim-acquire-before-worktree-work.md` (Optional AC uses claim.ts)

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Verify 081KRFA460008QG0R002DG8KPZ is merged: `grep -q "^status: closed" docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-*.md`
- [ ] Verify `tools/bus/subscribe.ts` exists and exports `subscribeOnce`
- [ ] Read 081KRHWGX0008QG0R000TVGDGV implementation as the canonical sibling reference before writing
- [ ] Check `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 current text to know exact
      insertion point for the new `subscribeOnce("work-assignment", ...)` call
