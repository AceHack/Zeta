---
id: B-0461
priority: P1
status: shipped
title: "B-0442 slice 5.3 — missed-substrate-cascade subscriber handler (branch-vs-merged-PR drift closer)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0442
depends_on: [B-0449]
composes_with: [B-0440, B-0441, B-0442, B-0448, B-0459, B-0460]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, missed-substrate-cascade]
type: feature
---

# B-0442 slice 5.3 — `missed-substrate-cascade` subscriber handler

## Origin

B-0449 (bg-services subscriber-agent architecture design pass) planned this row as the implementation
slice for the `missed-substrate-cascade` topic handler specific to B-0442. B-0449 chose **Option C**
architecture: subscriber handling runs as a library call in the per-tick step 1 (refresh), not a
long-running daemon.

Verbatim from B-0449:

> Once Option C is adopted (or alternative chosen), three follow-up rows track per-topic handler
> implementation:
>
> - B-0459 — `infinite-backlog-nudge` handler (slice 5.1)
> - B-0460 — `work-assignment` handler (slice 5.2)
> - B-0461 — `missed-substrate-cascade` handler (slice 5.3)

This row is that third follow-up. It depends on B-0449 landing `tools/bus/subscribe.ts`; if B-0449 is
unstarted, this row is blocked.

Filed 2026-05-14 to close the broken `composes_with` edge on B-0460 (which already referenced
B-0461 as its slice-5.3 sibling). The reference existed as a placeholder; this row makes it real.

## Context: what missed-substrate-detector produces

`tools/bg/missed-substrate-detector.ts` (B-0442 slices 1–4 + 6 shipped) publishes:

```json
{
  "topic": "missed-substrate-cascade",
  "to": "*",
  "payload": {
    "prNumber": 2980,
    "branchRef": "otto/section-2980-...",
    "headRefOid": "...",
    "squashCommit": "...",
    "missedCommitCount": 1,
    "rationale": "Branch tip is 1 commit ahead of the squash-merge..."
  }
}
```

This slice implements the handler that reads and acts on that envelope.

## Acceptance criteria

- [x] `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)` per B-0449 AC
      (lands in B-0449; this row blocks until that is merged)
- [x] Handler for `missed-substrate-cascade` (stub behavior per B-0449 slice-5 design):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, PR number, branch ref, missed-commit count, rationale)
    to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - Reports the drift to the tick output (visibility): names the PR and branch so the
    agent (or human reviewer) can decide whether to cherry-pick + open recovery PR
    (the full auto-recovery path is B-0503 / B-0504, not this row)
- [x] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("missed-substrate-cascade", handler)` alongside the
      `infinite-backlog-nudge` + `work-assignment` subscribers
- [x] Unit tests for handler: DST-replayable with fake bus dir + injected envelopes
  - Test: envelope present → logged, consumed, no error
  - Test: no envelope → no-op, no error
  - Test: malformed envelope → logged as warning, consumed (not re-processed), no throw
- [x] `tools/bg/README.md` §"What's still pending" updated: slice 5.3 stub landed

## Scope clarification (what is NOT in scope)

Per B-0449's Option C design, B-0449 itself delivers **no-action stub handlers** (log + consume
only). This row (B-0461) fleshes out the `missed-substrate-cascade` handler to **report drift**
to the tick output, but does NOT auto-open a recovery PR.

The auto-recovery path (cherry-pick the missed commits onto a fresh branch + open recovery PR)
is owned by:

- B-0503 (slice 5a — `openRecoveryPR` core function + RecoveryAdapters + DST tests)
- B-0504 (slice 5b — wire `openRecoveryPR` into `pollOnce` with `--auto-recover` flag)

This row is the consumer-side counterpart that surfaces the drift; B-0503/B-0504 close the
auto-recovery loop on the producer side.

## Dependency chain

```text
B-0400 (bus protocol)
  └─ B-0449 (subscribe-once library + step-1 wiring design)
       └─ B-0461 (THIS ROW — missed-substrate-cascade handler stub)
            └─ [B-0503 / B-0504 — auto-recovery PR opener]
```

## Composes with

- B-0400 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- B-0442 (missed-substrate-cascade detector — produces the envelopes this handler consumes)
- B-0449 (subscribe-once library — the transport this handler uses)
- B-0448 (cloud routines integration — same per-tick discipline; subscriber wires in step 1)
- B-0440, B-0441 (sibling slice-5 services per B-0449 — B-0459, B-0460)
- B-0459, B-0460 (sibling subscriber-handler rows for the other two topics)
- B-0503, B-0504 (auto-recovery PR opener — the action half of cascade response)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline — step 1 is where call lands)

## Pre-start checklist (per backlog-item-start-gate)

- [x] Prior-art search: verify B-0449 has landed `tools/bus/subscribe.ts` before starting
- [x] Dependency check: `grep -q "^status: closed" docs/backlog/P1/B-0449-*.md` — B-0449 row must show `status: closed` (merged)
- [x] Search committed memory for `missed-substrate-cascade handler` to find any prior implementation
- [x] Verify sibling B-0459 / B-0460 are not already implementing this handler under a different name (handler-shape collision risk)
