---
id: B-0441
priority: P1
status: open
title: "Backlog-row-ready-to-grind notifier — background service that proactively assigns claims when agent queue empty"
tier: factory-infrastructure
effort: M
created: 2026-05-13
last_updated: 2026-05-14
depends_on: [B-0400]
composes_with: [B-0402, B-0440, B-0442]
children: [B-0500, B-0501, B-0502, B-0460]
tags: [multi-agent, background-service, bus, mechanization, infinite-backlog, work-assignment]
type: feature
---

# Backlog-row-ready-to-grind notifier background service

## Origin

Companion mechanization to B-0440. The substrate-honest architectural
challenge from the human maintainer 2026-05-13:

> *"this is something background services should walk"*

B-0440 catches the *failure mode* (Standing-by); this row prevents
the failure mode by *proactively surfacing work* when the agent's
queue is empty. The infinite-backlog metabolism rule (PR #2974)
mandates that backlog work is always available; this service makes
that availability operational at agent-tick scale.

Per the substrate-honest discipline triad (PR #2999): decomposition
dissolves ambiguity. When agent has no current task, the service
provides a less-ambiguous concrete claim — eliminating the
"what should I do next?" stuckness pattern.

## Acceptance criteria

- [ ] Background service `tools/bg/backlog-ready-notifier.ts` exists
- [x] Runs under existing launchd / cron infrastructure (B-0502 — `.gemini/launchd/com.zeta.backlog-ready-notifier.plist`)
- [ ] Periodically scans `docs/backlog/P*/B-*.md` for ready-to-grind
      rows (open, no blockers, dependencies satisfied)
- [ ] Detects agent queue state (commits in last N minutes; current
      branch / open PR ownership)
- [ ] When agent queue is empty AND ready-to-grind rows exist,
      publishes claim-assignment message via bus (B-0400):
      `{ topic: "work-assignment", to: <agent>,
         payload: { rowId: "B-NNNN", priority: "P1",
         rationale: "queue-empty + dependencies-satisfied + smallest-effort-match",
         decompositionSuggestion: <slice-breakdown> } }`
- [ ] Honors agent autonomy — assignment is suggestion, not directive
      (per `.claude/rules/no-directives.md`)
- [ ] Tracks assignment history to avoid re-assigning same row
      within short window
- [ ] Tests cover the readiness-detection heuristics
- [ ] Documented in `docs/AUTONOMOUS-LOOP.md`

## Design sketch

```typescript
// tools/bg/backlog-ready-notifier.ts
//
// Proactively surfaces ready-to-grind backlog rows when agent queue empty.

interface BacklogRow {
  id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: string;
  dependsOn: string[];
  effort: "S" | "M" | "L" | "XL";
  ready: boolean;  // true iff all dependsOn satisfied
}

async function findReadyRows(): Promise<BacklogRow[]> {
  const rows = scanBacklog("docs/backlog/P*/B-*.md");
  return rows.filter(r =>
    r.status === "open" &&
    r.dependsOn.every(dep => rowStatus(dep) === "closed")
  );
}

async function detectQueueEmpty(agent: string): Promise<boolean> {
  const recentCommits = gitLogSince(agent, "30 minutes ago");
  const ownedPRs = ghOpenPRsAuthoredBy(agent);
  return recentCommits.length === 0 && ownedPRs.length === 0;
}

async function notifyIfQueueEmpty(agent: string, bus: BusClient): Promise<void> {
  if (!await detectQueueEmpty(agent)) return;

  const readyRows = await findReadyRows();
  if (readyRows.length === 0) return;

  const pickSmallest = readyRows.sort(byEffortThenPriority)[0];

  await bus.publish({
    topic: "work-assignment",
    to: agent,
    payload: {
      rowId: pickSmallest.id,
      priority: pickSmallest.priority,
      rationale: "queue-empty + dependencies-satisfied + smallest-effort-match",
      decompositionSuggestion: suggestSlices(pickSmallest),
    },
  });
}
```

## Composing with B-0440

| Service | Trigger | Output |
|---------|---------|--------|
| B-0440 Standing-by detector | Idle threshold + cron fires | Nudge: "you should pick work" |
| B-0441 Backlog-ready notifier | Queue-empty + rows-ready | Assignment: "this row is ready" |

B-0440 is reactive (catches failure mode after it occurs); B-0441 is
proactive (prevents failure mode by pre-assigning work). Together they
form a two-layer defense against the Standing-by pattern.

## Composes with

- `.claude/rules/never-be-idle.md` (proactive work-surfacing satisfies
  the priority ladder)
- `.claude/rules/largest-mechanizable-backlog-wins.md` (the mechanization
  IS itself mechanizable-backlog growth)
- `.claude/rules/no-directives.md` (assignment is suggestion, not
  directive; agent retains autonomy)
- `.claude/rules/encoding-rules-without-mechanizing.md` (this row IS
  the mechanization of the "always have work" discipline)
- `.claude/rules/backlog-item-start-gate.md` (assignment payload could
  include start-gate-relevant context)
- B-0400 (bus protocol — transport for assignment messages)
- B-0402 (shadow observer — canonical background service pattern)
- B-0440 (Standing-by detector — composes; this prevents what B-0440
  catches)
- B-0442 (missed-substrate cascade detector — composes; full
  background-services suite)
- PR #2974 (infinite-backlog metabolism)
- PR #2998 (background-services architecture)
- PR #2999 (substrate-honest discipline triad —
  decomposition-suggestions in payload align with this discipline)

## Pre-start checklist

- [x] Prior-art search: existing audit scripts in `tools/hygiene/`
      (check for backlog-readiness-scan overlap) — no overlap found; `backlog-ready-notifier.ts`
      is distinct from the hygiene audit scripts
- [x] Dependency proof: B-0400 bus protocol slice ready — B-0400 status: closed (2026-05-13)
- [x] Verify readiness-detection heuristics handle edge cases
      (forked work, multi-agent claims, partial completion) — handled in existing tests;
      `isAgentQueueEmpty` conservative-busy on adapter failure covers edge cases
- [x] Decomposition: child rows created (B-0500, B-0501, B-0502, B-0460) — 2026-05-14

## Substrate-honest caveats

- Design sketch only
- The "smallest-effort-match" heuristic is speculative; first
  implementation might pick highest-priority or random-among-ready
- Agent autonomy must be preserved — service publishes, agent decides
- Per razor-discipline: claim is design-level

## Decomposition into implementation slices

Using the canonical per-service slice ordering from `tools/bg/README.md`:

| Slice | Description | Status | Child row |
|-------|-------------|--------|-----------|
| 1 | Skeleton + no-op poll loop | ✅ shipped | — |
| 2 | Real detection signal #1 (backlog-row scan: status + deps satisfied) | ✅ shipped | — |
| 3 | Queue-state guard wiring (`isAgentQueueEmpty` into `pollOnce`) | ❌ open | B-0500 |
| 4 | Bus-publish wiring (`work-assignment` topic) | ✅ shipped | — |
| 5a | Assignment history dedup / cooldown (avoid re-assigning same row) | ❌ open | B-0501 |
| 5.2 | Agent-side `work-assignment` subscriber handler (consume + act) | ❌ open | B-0460 |
| 6 | launchd plist + `docs/AUTONOMOUS-LOOP.md` wiring | ❌ open | B-0502 |

Slices 1, 2, 4 are live in `tools/bg/backlog-ready-notifier.ts` (per README "1+2+4 live").
B-0460 depends on B-0449 (subscriber library design pass); B-0500/B-0501/B-0502 are independent.
