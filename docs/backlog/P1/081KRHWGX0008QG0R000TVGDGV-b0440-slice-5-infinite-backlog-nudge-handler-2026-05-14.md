---
id: 081KRHWGX0008QG0R000TVGDGV
priority: P1
status: open
title: "081KRFA460008QG0R001KC0VBH slice 5.1 — infinite-backlog-nudge subscriber handler (standing-by failure-mode closer)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R001KC0VBH
depends_on: [081KRFA460008QG0R002DG8KPZ]
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW, 081KRFA460008QG0R000CYBGKW]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, infinite-backlog]
type: feature
---

# 081KRFA460008QG0R001KC0VBH slice 5.1 — infinite-backlog-nudge subscriber handler

## Origin

081KRFA460008QG0R002DG8KPZ (bg-services subscriber-agent architecture design pass) planned this row as the implementation
slice for the `infinite-backlog-nudge` topic handler specific to 081KRFA460008QG0R001KC0VBH. 081KRFA460008QG0R002DG8KPZ chose **Option C**
architecture: subscriber handling runs as a library call in the per-tick step 1 (refresh), not a
long-running daemon.

Verbatim from 081KRFA460008QG0R002DG8KPZ:

> Once Option C is adopted (or alternative chosen), three follow-up rows track per-topic handler
> implementation:
>
> - 081KRHWGX0008QG0R000TVGDGV — `infinite-backlog-nudge` handler (slice 5.1)

This row is that follow-up. It depends on 081KRFA460008QG0R002DG8KPZ landing `tools/bus/subscribe.ts`; if 081KRFA460008QG0R002DG8KPZ is
unstarted, this row is blocked.

## Context: what standing-by-detector produces

`tools/bg/standing-by-detector.ts` (081KRFA460008QG0R001KC0VBH slices 1–4, shipped) publishes:

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

- [ ] `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)` per 081KRFA460008QG0R002DG8KPZ AC
      (lands in 081KRFA460008QG0R002DG8KPZ; this row blocks until that is merged)
- [ ] Handler for `infinite-backlog-nudge` (stub behavior per 081KRFA460008QG0R002DG8KPZ slice-5 design):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, idleMinutes, rationale) to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - Triggers decomposition or backlog-grind action: inspects envelope payload and
    queues speculative work in step 3 (pick speculative work) of the same tick
    (per 081KRFA460008QG0R002DG8KPZ §"Option C" design: subscriber wires into step 1 and queues into step 3)
- [ ] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("infinite-backlog-nudge", handler)` after
      `bun tools/github/poll-pr-gate-batch.ts --all-open` + `git fetch origin main`
      (matching the current step-1 order: poll-pr-gate-batch first, then git fetch)
- [ ] Unit tests for handler: DST-replayable with fake bus dir + injected envelopes
  - Test: envelope present → logged, consumed, no error
  - Test: no envelope → no-op, no error
  - Test: malformed envelope → logged as warning, consumed (not re-processed), no throw
- [ ] `tools/bg/README.md` §"What's still pending" updated: slice 5.1 stub landed

## Scope clarification (what is NOT in scope)

Per 081KRFA460008QG0R002DG8KPZ's Option C design, 081KRFA460008QG0R002DG8KPZ itself delivers **no-action stub handlers** (log + consume
only). 081KRHWGX0008QG0R000TVGDGV is the follow-up that **fleshes out** the `infinite-backlog-nudge` handler to
trigger decomposition or backlog-grind action (per 081KRFA460008QG0R002DG8KPZ §"Subsequent slices flesh out:
`infinite-backlog-nudge` handler → triggers decomposition or backlog grind (slice 5.1)").

The Optional AC in 081KRFA460008QG0R001KC0VBH ("proactively assigns a small claim from the backlog to the agent's queue")
is a **proxy-pick** behavior: reading the envelope's suggested target row and queuing it for the
tick's step 3. That is the deliverable of this slice. A separate follow-up row (slice 5.2) would
handle more complex strategies (e.g., decomposing a large item rather than picking a leaf row).

## Dependency chain

```
081KR7JY10008QG0R000R503K2 (bus protocol)
  └─ 081KRFA460008QG0R002DG8KPZ (subscribe-once library + step-1 wiring design)
       └─ 081KRHWGX0008QG0R000TVGDGV (THIS ROW — infinite-backlog-nudge handler stub)
            └─ [future slice 5.2 — full backlog-grind trigger]
```

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- 081KRFA460008QG0R001KC0VBH (standing-by-detector — produces the nudge envelopes this handler consumes)
- 081KRFA460008QG0R002DG8KPZ (subscribe-once library — the transport this handler uses)
- 081KRFA460008QG0R000CYBGKW (cloud routines integration — same per-tick discipline; subscriber wires in step 1)
- 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW (sibling services slice 5.2 + 5.3 per 081KRFA460008QG0R002DG8KPZ — 081KRHWGX0008QG0R001E9KEJ1, 081KRHWGX0008QG0R000JMEYBH)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline — step 1 is where call lands)

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Prior-art search: verify 081KRFA460008QG0R002DG8KPZ has landed `tools/bus/subscribe.ts` before starting
- [ ] Dependency check: `grep -q "^status: closed" docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-*.md` — 081KRFA460008QG0R002DG8KPZ row must show `status: closed` (merged)
- [ ] Search committed memory for `infinite-backlog-nudge handler` to find any prior implementation
