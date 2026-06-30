---
id: B-0459
priority: P1
status: shipped
title: "B-0440 slice 5.1 — infinite-backlog-nudge subscriber handler (standing-by failure-mode closer)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0440
depends_on: [B-0449]
composes_with: [B-0440, B-0441, B-0442, B-0448]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, infinite-backlog]
type: feature
---

# B-0440 slice 5.1 — infinite-backlog-nudge subscriber handler

## Origin

B-0449 (bg-services subscriber-agent architecture design pass) planned this row as the implementation
slice for the `infinite-backlog-nudge` topic handler specific to B-0440. B-0449 chose **Option C**
architecture: subscriber handling runs as a library call in the per-tick step 1 (refresh), not a
long-running daemon.

Verbatim from B-0449:

> Once Option C is adopted (or alternative chosen), three follow-up rows track per-topic handler
> implementation:
>
> - B-0459 — `infinite-backlog-nudge` handler (slice 5.1)

This row is that follow-up. It depends on B-0449 landing `tools/bus/subscribe.ts`; if B-0449 is
unstarted, this row is blocked.

## Context: what standing-by-detector produces

`tools/bg/standing-by-detector.ts` (B-0440 slices 1–4, shipped) publishes:

```json
{
  "topic": "infinite-backlog-nudge",
  "to": "*",
  "payload": {
    "idleMinutes": 18.3,
    "rationale": "Standing-by detected: 18.3min since last activity …"
  }
}
```

This slice implements the handler that reads and acts on that envelope.

## Acceptance criteria

- [x] `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)` per B-0449 AC
      (lands in B-0449; this row blocks until that is merged)
- [x] Handler for `infinite-backlog-nudge` (stub behavior per B-0449 slice-5 design):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, idleMinutes, rationale) to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - Triggers decomposition or backlog-grind action: inspects envelope payload and
    queues speculative work in step 3 (pick speculative work) of the same tick
    (per B-0449 §"Option C" design: subscriber wires into step 1 and queues into step 3)
- [x] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("infinite-backlog-nudge", handler)` after
      `bun tools/github/poll-pr-gate-batch.ts --all-open` + `git fetch origin main`
      (matching the current step-1 order: poll-pr-gate-batch first, then git fetch)
- [x] Unit tests for handler: DST-replayable with fake bus dir + injected envelopes
  - Test: envelope present → logged, consumed, no error
  - Test: no envelope → no-op, no error
  - Test: malformed envelope → logged as warning, consumed (not re-processed), no throw
- [x] `tools/bg/README.md` §"What's still pending" updated: slice 5.1 stub landed

## Scope clarification (what is NOT in scope)

Per B-0449's Option C design, B-0449 itself delivers **no-action stub handlers** (log + consume
only). B-0459 is the follow-up that **fleshes out** the `infinite-backlog-nudge` handler to
trigger decomposition or backlog-grind action (per B-0449 §"Subsequent slices flesh out:
`infinite-backlog-nudge` handler → triggers decomposition or backlog grind (slice 5.1)").

The Optional AC in B-0440 ("proactively assigns a small claim from the backlog to the agent's queue")
is a **proxy-pick** behavior: reading the envelope's suggested target row and queuing it for the
tick's step 3. That is the deliverable of this slice. A separate follow-up row (slice 5.2) would
handle more complex strategies (e.g., decomposing a large item rather than picking a leaf row).

## Dependency chain

```
B-0400 (bus protocol)
  └─ B-0449 (subscribe-once library + step-1 wiring design)
       └─ B-0459 (THIS ROW — infinite-backlog-nudge handler stub)
            └─ [future slice 5.2 — full backlog-grind trigger]
```

## Composes with

- B-0400 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- B-0440 (standing-by-detector — produces the nudge envelopes this handler consumes)
- B-0449 (subscribe-once library — the transport this handler uses)
- B-0448 (cloud routines integration — same per-tick discipline; subscriber wires in step 1)
- B-0441, B-0442 (sibling services slice 5.2 + 5.3 per B-0449 — B-0460, B-0461)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline — step 1 is where call lands)

## Pre-start checklist (per backlog-item-start-gate)

- [x] Prior-art search: verify B-0449 has landed `tools/bus/subscribe.ts` before starting
- [x] Dependency check: `grep -q "^status: closed" docs/backlog/P1/B-0449-*.md` — B-0449 row must show `status: closed` (merged)
- [x] Search committed memory for `infinite-backlog-nudge handler` to find any prior implementation
