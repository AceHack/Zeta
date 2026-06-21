---
id: 081KRQ1AB0008QG0R002422Z9Q
priority: P1
status: open
title: "Scarcity tracker — surface limited shared resources (GitHub API GraphQL/REST, runner minutes, etc.) and inform agent disciplines"
tier: factory-infrastructure
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [081KR7JY10008QG0R000R503K2, 081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S]
tags: [multi-agent, scarcity, rate-limit, github-api, bandwidth, factory-infrastructure, observability]
type: feature
---

# Scarcity tracker — surface limited shared resources

## Origin

The human maintainer 2026-05-16T~21:50Z, after a session demonstrating GitHub GraphQL rate-limit saturation across 3-4 concurrent agents (Otto-CLI session + peer Otto background worker + Lior antigravity check + Aaron's manual `gh` usage):

> *"looks like we have a new limited resource gh graphql real scaracy not fake we need a scarcy tracker"*

Empirical anchor: the 2026-05-16 session burned the full 5000/hr GraphQL budget mid-session. The exhaustion blocked thread resolution on PR #3945 for ~13 minutes (full reset window). The 5000/hr limit is **shared across all tools and agents authenticating as the same GitHub user** — there's no per-agent quota.

This is "real scarcity not fake" because:

- The limit is hard (HTTP 429); not just guidance
- The shared bucket means multi-agent coordination affects each agent's available budget
- The reset is bounded but non-trivial (up to ~1hr)
- Recovery requires either waiting OR switching surface (REST has separate 5000/hr)

## What

A substrate component that:

1. **Inventories** known scarce resources (GraphQL/REST budgets, runner minutes, etc.)
2. **Polls** each resource periodically to surface remaining budget + reset time
3. **Publishes** state via bus (081KR7JY10008QG0R000R503K2) so all agents can read without each polling separately
4. **Informs** agent-side disciplines (defer / switch surface / wait)
5. (Optional, future) **Enforces** pre-call budget checks that abort or queue if remaining < threshold

## Initial inventory of scarce resources

Confirmed via this session's empirical evidence:

| Resource | Limit | Window | Shared across | Surface alternative |
|---|---|---|---|---|
| GitHub API GraphQL | 5000/hr | rolling 1hr | all gh CLI + API calls authenticating as same user | REST (separate budget) |
| GitHub API REST core | 5000/hr | rolling 1hr | same | GraphQL (separate budget) |

Likely also relevant (need verification):

| Resource | Limit | Window | Notes |
|---|---|---|---|
| GitHub Actions runner minutes | ~3000/mo free tier; LFG may have paid | monthly | repo-wide; impacts CI throughput |
| GitHub Actions concurrent jobs | tier-dependent | per-repo | impacts parallel PR landing |
| NuGet API throttle | unknown | unknown | impacts package operations |
| Claude API token budget | per-agent | session | already tracked elsewhere |

## Acceptance criteria

- [ ] `tools/bg/scarcity-tracker.ts` exists — background service that polls scarce resources
- [ ] Polls GitHub API rate-limit via cheap `gh api rate_limit` (returns BOTH GraphQL and REST counters; 1 REST call covers both)
- [ ] Publishes `scarcity-state` envelope to bus on each poll (or on change-detection): `{topic: "scarcity-state", payload: {graphql: {remaining, resetIso}, rest: {remaining, resetIso}, ...}}`
- [ ] Honest about latency — publishes with timestamp; consumers know how stale
- [ ] Default polling cadence: 60s (cheap; 1 REST call/min = 60/hr negligible vs 5000/hr)
- [ ] Tests cover the polling and publishing logic (DST-replayable with injected adapters)
- [ ] Documented in `docs/AUTONOMOUS-LOOP.md` (or new `docs/SCARCITY.md`)
- [ ] Composes with `holding-without-named-dependency-is-standing-by-failure.md` — "wait for budget reset" is a substrate-honest named dependency

## Why now

Today's session showed the failure mode in real time:

- 3-4 concurrent agents (Otto-CLI + peer Otto worker + Lior + Aaron manual) all hitting GitHub API
- Budget exhausted mid-session at 0/5000 GraphQL
- Thread resolution on PR #3945 blocked for ~13 min (full reset window)
- No agent knew the budget state without burning a call to check
- No coordination between agents to slow consumption

A scarcity tracker would have:

1. Surfaced the saturation pre-failure (agents could have deferred GraphQL calls)
2. Provided shared visibility (no need for each agent to burn a call to check)
3. Informed adaptive disciplines (Otto could switch to REST for what's REST-able)

## Design sketch

```typescript
// tools/bg/scarcity-tracker.ts
//
// Polls GitHub API rate-limit and publishes scarcity-state to bus.
// Other agents subscribe via bus envelope rather than burning their own calls.

interface ScarcityState {
  pollAtIso: string;
  graphql: { remaining: number; limit: number; resetIso: string };
  rest:    { remaining: number; limit: number; resetIso: string };
  // future: actions runner minutes, etc.
}

async function pollScarcity(): Promise<ScarcityState> {
  // 1 REST call covers both GraphQL + REST counters
  const r = await ghApi("rate_limit");
  return {
    pollAtIso: new Date().toISOString(),
    graphql: extractCounter(r.resources.graphql),
    rest:    extractCounter(r.resources.core),
  };
}

async function publishIfChanged(prev: ScarcityState | null, current: ScarcityState, bus: BusClient): Promise<void> {
  if (prev && !materialChange(prev, current)) return;
  await bus.publish({ topic: "scarcity-state", payload: current });
}
```

## Decomposition into implementation slices

| Slice | Description | Status |
|-------|-------------|--------|
| 1 | Skeleton — `scarcity-tracker.ts` with no-op poll | open |
| 2 | Real polling — `gh api rate_limit` integration; returns ScarcityState | open |
| 3 | Bus-publish wiring — `scarcity-state` topic per 081KR7JY10008QG0R000R503K2 | open |
| 4 | Change-detection — only publish on material delta | open |
| 5 | Agent-side discipline rule — `scarcity-aware-api-budget.md` (defer/switch/wait) | open |
| 6 | launchd plist + `docs/AUTONOMOUS-LOOP.md` wiring | open |

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — transport for `scarcity-state` envelopes)
- 081KRFA460008QG0R001KC0VBH (Standing-by detector — "rate-limit-wait" IS a real-named-dep, not Standing-by)
- 081KRFA460008QG0R00229616S (Backlog-ready notifier — sibling background service pattern)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (rate-limit-wait composes; THIS session's "real-dep-wait on graphql reset" is canonical example)
- `.claude/rules/bandwidth-served-falsifier.md` (scarcity tracking IS bandwidth engineering at API-call scope)
- `.claude/rules/dv2-data-split-discipline-activated.md` (scarce resources are stable hubs; their per-tick state is a satellite — DV2.0 partition applies)

## Substrate-honest caveats

- Design only; first implementation might prioritize GraphQL+REST and defer runner-minutes
- The "shared across all agents" claim depends on PAT auth pattern; per-agent PATs would partition the budget
- Polling itself consumes budget (~60/hr at 60s cadence); negligible but non-zero
- Reset epoch from `/rate_limit` is informational, not enforced — actual reset can drift

## Open questions

1. **Per-agent PAT vs shared PAT** — should each agent have its own PAT to partition the budget? Trade-off: more PATs to manage, but isolated failure domains.
2. **GraphQL vs REST routing discipline** — when an operation supports both, default to REST? Some operations are GraphQL-only (review thread resolution).
3. **Enforcement vs advisory** — should scarcity-state be advisory (agents may ignore) or enforced (pre-call hook aborts)?
4. **Other scarce resources** — Claude API tokens, runner minutes, disk space, etc. — separate trackers or one?

## Mitigation axes (orthogonal, composable)

Tracker = visibility. Mitigations = expanding the pools. They compose:

| Axis | Effect | Effort | Trade-off | Sibling row |
|---|---|---|---|---|
| **GitHub App for factory automation** | Separate rate-limit pool from human-user accounts; clean `[bot]` attribution; designed for automation | M (setup once; agents auth via app installation token) | Permissions config needed; PRs show as bot identity | 081KRQ1AB0008QG0R0038VQJZ0 |
| **Add user accounts (e.g., Addison's GitHub)** | +5000/hr GraphQL + 5000/hr REST per added account; linear scaling | S each (`gh auth login`); ongoing per-account management | Identity attribution muddied across human members; ethical questions for non-engaged family/friends | (no row — discretionary case-by-case) |
| **Verify LFG GitHub tier** | If GitHub Enterprise Cloud (or upgrade to it), per-user limit jumps 5000/hr → 15000/hr (3×) | XS (just check current tier) | None if already on Enterprise; cost if requires upgrade decision | 081KRQ1AB0008QG0R000GZEMCR |

The scarcity tracker (this row) is the **visibility layer**: surfaces budget state so agents know to defer / switch surface / wait. Mitigations are **capacity** changes: expand the pool the tracker measures. Both are needed for the full picture.

## Pre-start checklist

- [x] Prior-art search: no existing scarcity tracker in `tools/bg/`; related is `backlog-ready-notifier.ts` which detects agent-side queue state (different scope)
- [x] Dependency proof: 081KR7JY10008QG0R000R503K2 bus protocol exists and is in use by `backlog-ready-notifier.ts` (proven pattern)
- [ ] Empirical: confirmed via 2026-05-16 session that GraphQL saturation is a real ~13-min wait — documented in this row's Origin section
- [ ] Decomposition: 6 slices identified above
