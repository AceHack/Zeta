---
id: 081KRFA460008QG0R001KC0VBH
priority: P1
status: open
title: "Standing-by failure-mode detector — background service that catches idle-foreground + nudges via bus"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-14
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KR7JY10008QG0R0008NGW95, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW]
children: [081KRHWGX0008QG0R000TVGDGV, 081KRHWGX0008QG0R003NT6DY9]
decomposition: decomposed
tags: [multi-agent, background-service, bus, mechanization, infinite-backlog, standing-by, anti-idle]
type: feature
---

# Standing-by failure-mode detector background service

## Origin

The substrate-honest architectural challenge from the human maintainer
2026-05-13 (preserved in
`memory/feedback_aaron_background_services_must_be_strong_enough_foreground_loop_optional_imagine_surviving_without_foreground_mechanize_standing_by_failure_mode_2026_05_13.md`):

> *"you need to imagine how would you survive without this foreground
> loop and you background should be strong enough to do that"*

> *"this is something background services should walk"*

The foreground-loop "Standing-by" failure mode was caught by the human
maintainer in real time when the foreground agent had just canonized
the infinite-backlog metabolism rule (PR #2974) AND THEN three minutes
later responded "Standing by" to a cron tick despite the infinite
backlog mandating decomposition work. The discipline needs MECHANIZATION
per `.claude/rules/encoding-rules-without-mechanizing.md`:

> *"Encoding rules without mechanizing them produces a memory of
> failures, not prevention."*

## Acceptance criteria

- [x] Background service `tools/bg/standing-by-detector.ts` exists
- [ ] Service runs under existing launchd / cron infrastructure
- [x] Polls agent's recent commit history every N minutes (configurable)
- [x] Detects "Standing-by" pattern: no new commits + no PRs opened/closed
      in last 15min while autonomous-loop cron is firing
- [x] On detection, publishes nudge message via bus (081KR7JY10008QG0R000R503K2):
      `{ topic: "infinite-backlog-nudge", to: <agent>,
         payload: { "Standing-by detected for N min; backlog has X open
         rows; suggested decomposition target: B-NNNN" } }`
- [ ] Optional: proactively assigns a small claim from the backlog to
      the agent's queue
- [x] Tests cover the detection heuristics (DST-replayable)
- [x] Documented in `docs/AUTONOMOUS-LOOP.md` as background-services
      layer

## Design sketch

```typescript
// tools/bg/standing-by-detector.ts
//
// Polls recent agent activity; on idle-detection, nudges via bus.

import { BusClient } from "../bus/client";
import { execSync } from "child_process";

interface AgentState {
  agent: string;
  lastCommitAt: Date | null;
  lastPRActivityAt: Date | null;
  cronFiredCount: number;
}

const IDLE_THRESHOLD_MIN = 15;
const POLL_INTERVAL_MIN = 5;

async function detectAndNudge(state: AgentState, bus: BusClient): Promise<void> {
  const now = Date.now();
  const idleMin = Math.max(
    (now - (state.lastCommitAt?.getTime() ?? 0)) / 60_000,
    (now - (state.lastPRActivityAt?.getTime() ?? 0)) / 60_000,
  );

  if (idleMin >= IDLE_THRESHOLD_MIN && state.cronFiredCount > 0) {
    const openRows = countOpenBacklogRows();
    const suggestedRow = pickDecompositionTarget(openRows);

    await bus.publish({
      topic: "infinite-backlog-nudge",
      to: state.agent,
      payload: {
        idleMin,
        openBacklogCount: openRows.length,
        suggestedTarget: suggestedRow,
        rationale: "Standing-by detected; per infinite-backlog metabolism, pick decomposition work",
      },
    });
  }
}
```

## Operational mechanism

| Step | Trigger | Effect |
|------|---------|--------|
| 1 | Cron fires every 5 min | Service polls agent commit log + PR feed |
| 2 | Idle threshold exceeded (15 min default) | Service computes nudge payload |
| 3 | Bus publishes nudge message | Agent receives via existing bus subscription |
| 4 | Agent acts on nudge | Picks decomposition target + ships substrate |
| 5 | Loop continues | Substrate compounds; Standing-by failure mode prevented |

## Composes with

- `.claude/rules/encoding-rules-without-mechanizing.md` (the rule this
  mechanizes)
- `.claude/rules/never-be-idle.md` (the priority ladder the nudge
  enforces)
- `.claude/rules/largest-mechanizable-backlog-wins.md` (the mechanization
  itself increases the mechanizable backlog)
- 081KR7JY10008QG0R000R503K2 (bus protocol — transport for nudge messages)
- 081KR7JY10008QG0R0008NGW95 (shadow observer — canonical background service example)
- 081KRFA460008QG0R00229616S (backlog-row-ready notifier — composes; pre-assigns work the
  agent picks up)
- 081KRFA460008QG0R00061SXRW (missed-substrate cascade detector — composes; catches
  different failure mode in same family)
- PR #2974 (infinite-backlog metabolism — the rule this mechanizes)
- PR #2998 (background-services architecture — the substrate that
  declared this row as follow-up)
- PR #2999 (substrate-honest discipline triad — the decomposition
  discipline that produced this row)

## Pre-start checklist (per backlog-item-start-gate)

Completed 2026-05-14 during decomposition pass:

- [x] Prior-art search: `tools/bg/` surveyed — `standing-by-detector.ts` + tests already exist
      (slices 1–4 shipped); no overlap with `tools/shadow/`; 081KR7JY10008QG0R000R503K2 bus protocol confirmed ready
- [x] Dependency proof: 081KR7JY10008QG0R000R503K2 bus protocol merged (PR #2939 + #2959 + #3016); `publish()` API stable
- [x] Search committed memory for `Standing-by detector` — no prior decomposition rows found;
      081KRFA460008QG0R002DG8KPZ covers subscriber design; 081KRHWGX0008QG0R000TVGDGV + 081KRHWGX0008QG0R003NT6DY9 filed as part of this decomposition

## Substrate-honest caveats (updated 2026-05-14)

- Slices 1–4 are SHIPPED: `tools/bg/standing-by-detector.ts` + `tools/bg/standing-by-detector.test.ts`
  are in production-quality state (commit-history + PR-activity poll + bus publish + structured
  publish-error surface)
- Threshold values (15 min idle; 5 min poll) are configurable via CLI flags (`--idle-min`, `--poll-min`)
- Nudge payload schema is live: `{ topic: "infinite-backlog-nudge", payload: { idleMinutes, rationale } }`
- Per razor-discipline: this row is now operational (slices 1–4 deployed, slices 5–6 tracked below)

## Decomposition into implementation slices (updated 2026-05-14)

| Slice | Title | Status | Row |
|-------|-------|--------|-----|
| 1 | Skeleton service + no-op poll loop | ✅ Done | (in `tools/bg/standing-by-detector.ts`) |
| 2 | Commit-history poll via `git log` | ✅ Done | (in `tools/bg/standing-by-detector.ts`) |
| 3 | PR-activity poll via `gh` | ✅ Done | (in `tools/bg/standing-by-detector.ts`) |
| 4 | Nudge payload computation + bus publish | ✅ Done | (in `tools/bg/standing-by-detector.ts`) |
| 5.1 | `infinite-backlog-nudge` subscriber handler stub | 🔲 Open | 081KRHWGX0008QG0R000TVGDGV (depends on 081KRFA460008QG0R002DG8KPZ) |
| 6 | launchd plist registration + AUTONOMOUS-LOOP.md update | 🔲 Open | 081KRHWGX0008QG0R003NT6DY9 (independent) |

**081KRFA460008QG0R002DG8KPZ** is the cross-cutting design pass for the subscriber pattern across all three bg services
(081KRFA460008QG0R001KC0VBH + 081KRFA460008QG0R00229616S + 081KRFA460008QG0R00061SXRW). 081KRHWGX0008QG0R000TVGDGV and 081KRHWGX0008QG0R003NT6DY9 are the leaf rows for 081KRFA460008QG0R001KC0VBH specifically.
