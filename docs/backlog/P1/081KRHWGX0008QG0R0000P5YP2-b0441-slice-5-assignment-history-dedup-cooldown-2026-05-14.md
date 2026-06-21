---
id: 081KRHWGX0008QG0R0000P5YP2
priority: P1
status: closed
title: "081KRFA460008QG0R00229616S slice 5 — assignment history dedup cooldown (avoid re-assigning same row within short window)"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-20
parent: 081KRFA460008QG0R00229616S
depends_on: []
composes_with: [081KRFA460008QG0R00229616S, 081KRHWGX0008QG0R0025PX5SZ, 081KRHWGX0008QG0R001ZJ3W8R]
tags: [background-service, bus, mechanization, anti-idle, history-tracking]
type: feature
---

# 081KRFA460008QG0R00229616S slice 5 — assignment history dedup / cooldown

## Origin

081KRFA460008QG0R00229616S acceptance criterion:
> "Tracks assignment history to avoid re-assigning same row within short window"

The current `pollOnce` publishes the same top-N ready rows on every poll cycle with no
memory of prior assignments. An idle agent will receive the same `work-assignment` envelope
for `B-NNNN` every 10 minutes until either the agent claims it or the agent's queue becomes
busy. This produces noisy bus output and makes the assignment signal less meaningful.

## Acceptance criteria

- [x] `NotifierConfig` gains a `historyFile` field (default
      `"/tmp/zeta-bus/assignment-history.json"`; respects `ZETA_BUS_DIR` if set)
      and a `cooldownMin` field (default `30`)
- [x] Before publishing a work-assignment envelope for a given `rowId`, check the
      history file:
  - If `rowId` appears in the history with a timestamp within `cooldownMin` minutes
    of `now()` → skip that row (do not publish)
  - If absent or expired → publish and record `{ rowId, publishedAt: now().toISOString() }`
- [x] After publishing, write the updated history back to `historyFile`:
  - Prune entries older than `cooldownMin` before writing to bound file size
  - Use atomic write (write to `<historyFile>.tmp` then rename) to survive concurrent
    access from multiple notifier instances
- [x] `PollResult` gains a `skippedDueToCooldown: string[]` field listing any `rowId`s
      that were skipped because of cooldown
- [x] Adapters interface gains:
  - `readHistoryFile: (path: string) => AssignmentHistory | null`
    (returns null when file absent or unreadable)
  - `writeHistoryFile: (path: string, history: AssignmentHistory) => void`
  - Tests inject fake implementations; production uses `REAL_ADAPTERS` with
    `fs.readFileSync` / atomic-rename write
- [x] Tests added (DST-replayable with injected adapters):
  - Row assigned at T=0; same row at T=15min (within 30min cooldown) → skipped
  - Row assigned at T=0; same row at T=35min (after 30min cooldown) → re-assigned
  - History file absent → treated as empty; first assignment proceeds normally
  - Multiple rows in cooldown → only expired rows published; `skippedDueToCooldown`
    lists skipped IDs
  - History pruning: entries older than `cooldownMin` removed on write

## Resolution

Shipped in this PR. 8 new tests (45 total) cover all acceptance criteria + bonus
coverage of `defaultHistoryFile()` honoring `ZETA_BUS_DIR` + new `--history-file`
and `--cooldown-min` CLI flags. REAL_ADAPTERS uses atomic-rename via
`renameSync(tmp, path)` after `writeFileSync(tmp, ...)`. Default config resolves
the history-file path at module-load time via `defaultHistoryFile()` honoring
`process.env.ZETA_BUS_DIR`. 081KRFA460008QG0R00229616S parent acceptance criterion "Tracks assignment
history to avoid re-assigning same row within short window" is now satisfied.

## Design sketch

```typescript
export type AssignmentHistoryEntry = {
  rowId: string;
  publishedAt: string; // ISO-8601
};

export type AssignmentHistory = {
  entries: AssignmentHistoryEntry[];
};

// In pollOnce, before the publish loop:
const history = adapters.readHistoryFile(config.historyFile) ?? { entries: [] };
const cooldownMs = config.cooldownMin * 60_000;
const now = adapters.now();
const activeEntries = new Set(
  history.entries
    .filter(e => now.getTime() - new Date(e.publishedAt).getTime() < cooldownMs)
    .map(e => e.rowId),
);

// Filter ready rows before publish:
const toPublish = toAssign.filter(r => !activeEntries.has(r.id));
const skippedDueToCooldown = toAssign.filter(r => activeEntries.has(r.id)).map(r => r.id);

// After publish loop, update history:
const newEntries: AssignmentHistoryEntry[] = [
  ...history.entries.filter(
    e => now.getTime() - new Date(e.publishedAt).getTime() < cooldownMs
  ),
  ...publishedRowIds.map(id => ({ rowId: id, publishedAt: now.toISOString() })),
];
adapters.writeHistoryFile(config.historyFile, { entries: newEntries });
```

## Why separate from slice 3 (081KRHWGX0008QG0R0025PX5SZ)

Slice 3 gates on queue-state (external signal: is the agent busy?).
Slice 5 gates on publication history (internal memory: did we just assign this?).
Both can be done independently; both modify different aspects of `pollOnce`'s output logic.
Separating them makes each diff reviewable in isolation.

## Atomic-write note

History file lives in `/tmp/zeta-bus/` (same directory as bus envelopes). Multiple
notifier instances running on different surfaces could race to update it. Atomic rename
(`tmp → final`) prevents partial writes. Concurrent notifiers may still read stale history
between their read and write — acceptable for a cooldown mechanism (a double-assignment
within the race window is a minor noise issue, not a correctness bug).

## Dependency chain

```
081KRFA460008QG0R00229616S (slices 1+2+4 shipped)
  └─ 081KRHWGX0008QG0R0000P5YP2 (THIS ROW — assignment history dedup; slice 5)
```

Does NOT depend on 081KRHWGX0008QG0R0025PX5SZ (slice 3) — both slices modify `pollOnce` independently.
Coordinate merge order to avoid conflicts if both land in the same window.

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Verify `/tmp/zeta-bus/` write permissions and atomic-rename behavior on macOS
      (can use `bun tools/bus/claim.ts` as reference — it writes to the same directory)
- [ ] Run `bun tools/bg/backlog-ready-notifier.test.ts` to confirm all existing tests pass
- [ ] Check `tools/bus/bus.ts` for any existing atomic-write utility to reuse
