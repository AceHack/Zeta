---
id: 081KRHWGX0008QG0R000JMEYBH
priority: P1
status: open
title: "081KRFA460008QG0R00061SXRW slice 5.3 — missed-substrate-cascade subscriber handler (branch-vs-merged-PR drift closer)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R00061SXRW
depends_on: [081KRFA460008QG0R002DG8KPZ]
composes_with: [081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW, 081KRFA460008QG0R000CYBGKW, 081KRHWGX0008QG0R000TVGDGV, 081KRHWGX0008QG0R001E9KEJ1]
tags: [multi-agent, background-service, bus, subscriber-pattern, anti-idle, missed-substrate-cascade]
type: feature
---

# 081KRFA460008QG0R00061SXRW slice 5.3 — `missed-substrate-cascade` subscriber handler

## Origin

081KRFA460008QG0R002DG8KPZ (bg-services subscriber-agent architecture design pass) planned this row as the implementation
slice for the `missed-substrate-cascade` topic handler specific to 081KRFA460008QG0R00061SXRW. 081KRFA460008QG0R002DG8KPZ chose **Option C**
architecture: subscriber handling runs as a library call in the per-tick step 1 (refresh), not a
long-running daemon.

Verbatim from 081KRFA460008QG0R002DG8KPZ:

> Once Option C is adopted (or alternative chosen), three follow-up rows track per-topic handler
> implementation:
>
> - 081KRHWGX0008QG0R000TVGDGV — `infinite-backlog-nudge` handler (slice 5.1)
> - 081KRHWGX0008QG0R001E9KEJ1 — `work-assignment` handler (slice 5.2)
> - 081KRHWGX0008QG0R000JMEYBH — `missed-substrate-cascade` handler (slice 5.3)

This row is that third follow-up. It depends on 081KRFA460008QG0R002DG8KPZ landing `tools/bus/subscribe.ts`; if 081KRFA460008QG0R002DG8KPZ is
unstarted, this row is blocked.

Filed 2026-05-14 to close the broken `composes_with` edge on 081KRHWGX0008QG0R001E9KEJ1 (which already referenced
081KRHWGX0008QG0R000JMEYBH as its slice-5.3 sibling). The reference existed as a placeholder; this row makes it real.

## Context: what missed-substrate-detector produces

`tools/bg/missed-substrate-detector.ts` (081KRFA460008QG0R00061SXRW slices 1–4 + 6 shipped) publishes:

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

- [ ] `tools/bus/subscribe.ts` exports `subscribeOnce(topic, handler)` per 081KRFA460008QG0R002DG8KPZ AC
      (lands in 081KRFA460008QG0R002DG8KPZ; this row blocks until that is merged)
- [ ] Handler for `missed-substrate-cascade` (stub behavior per 081KRFA460008QG0R002DG8KPZ slice-5 design):
  - Reads each matching envelope from the bus dir (honors `ZETA_BUS_DIR`)
  - Logs envelope content (topic, PR number, branch ref, missed-commit count, rationale)
    to the current tick shard
  - Marks envelope as consumed via `seen.json` per `subscribeOnce` contract
  - Reports the drift to the tick output (visibility): names the PR and branch so the
    agent (or human reviewer) can decide whether to cherry-pick + open recovery PR
    (the full auto-recovery path is 081KRHWGX0008QG0R0027YXBTB / 081KRHWGX0008QG0R000PVB6FF, not this row)
- [ ] `docs/AUTONOMOUS-LOOP-PER-TICK.md` step 1 (refresh) updated to call
      `subscribeOnce("missed-substrate-cascade", handler)` alongside the
      `infinite-backlog-nudge` + `work-assignment` subscribers
- [ ] Unit tests for handler: DST-replayable with fake bus dir + injected envelopes
  - Test: envelope present → logged, consumed, no error
  - Test: no envelope → no-op, no error
  - Test: malformed envelope → logged as warning, consumed (not re-processed), no throw
- [ ] `tools/bg/README.md` §"What's still pending" updated: slice 5.3 stub landed

## Scope clarification (what is NOT in scope)

Per 081KRFA460008QG0R002DG8KPZ's Option C design, 081KRFA460008QG0R002DG8KPZ itself delivers **no-action stub handlers** (log + consume
only). This row (081KRHWGX0008QG0R000JMEYBH) fleshes out the `missed-substrate-cascade` handler to **report drift**
to the tick output, but does NOT auto-open a recovery PR.

The auto-recovery path (cherry-pick the missed commits onto a fresh branch + open recovery PR)
is owned by:

- 081KRHWGX0008QG0R0027YXBTB (slice 5a — `openRecoveryPR` core function + RecoveryAdapters + DST tests)
- 081KRHWGX0008QG0R000PVB6FF (slice 5b — wire `openRecoveryPR` into `pollOnce` with `--auto-recover` flag)

This row is the consumer-side counterpart that surfaces the drift; 081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF close the
auto-recovery loop on the producer side.

## Dependency chain

```text
081KR7JY10008QG0R000R503K2 (bus protocol)
  └─ 081KRFA460008QG0R002DG8KPZ (subscribe-once library + step-1 wiring design)
       └─ 081KRHWGX0008QG0R000JMEYBH (THIS ROW — missed-substrate-cascade handler stub)
            └─ [081KRHWGX0008QG0R0027YXBTB / 081KRHWGX0008QG0R000PVB6FF — auto-recovery PR opener]
```

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — envelope schema + `ZETA_BUS_DIR` convention)
- 081KRFA460008QG0R00061SXRW (missed-substrate-cascade detector — produces the envelopes this handler consumes)
- 081KRFA460008QG0R002DG8KPZ (subscribe-once library — the transport this handler uses)
- 081KRFA460008QG0R000CYBGKW (cloud routines integration — same per-tick discipline; subscriber wires in step 1)
- 081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S (sibling slice-5 services per 081KRFA460008QG0R002DG8KPZ — 081KRHWGX0008QG0R000TVGDGV, 081KRHWGX0008QG0R001E9KEJ1)
- 081KRHWGX0008QG0R000TVGDGV, 081KRHWGX0008QG0R001E9KEJ1 (sibling subscriber-handler rows for the other two topics)
- 081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF (auto-recovery PR opener — the action half of cascade response)
- `docs/AUTONOMOUS-LOOP-PER-TICK.md` (canonical 7-step discipline — step 1 is where call lands)

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Prior-art search: verify 081KRFA460008QG0R002DG8KPZ has landed `tools/bus/subscribe.ts` before starting
- [ ] Dependency check: `grep -q "^status: closed" docs/backlog/P1/081KRFA460008QG0R002DG8KPZ-*.md` — 081KRFA460008QG0R002DG8KPZ row must show `status: closed` (merged)
- [ ] Search committed memory for `missed-substrate-cascade handler` to find any prior implementation
- [ ] Verify sibling 081KRHWGX0008QG0R000TVGDGV / 081KRHWGX0008QG0R001E9KEJ1 are not already implementing this handler under a different name (handler-shape collision risk)
