---
id: 081KR50HA0008QG0R001DX165X
priority: P3
status: open
title: A/B experiment infrastructure design — event-capture schema, experiment-registration, git-native result storage for dashboard
tier: engineering
effort: M
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5]
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R002DR44J1, 081KR50HA0008QG0R000TQKYGM, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R002NZENZJ, 081KR50HA0008QG0R0019KYAAS]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, a-b-experiments, event-capture, experiment-infrastructure, dashboard, git-native, operational-resonance]
type: engineering
---

# 081KR50HA0008QG0R001DX165X — A/B experiment infrastructure design

## What

Design and commit the A/B experiment infrastructure that every
dashboard interaction feeds into. This is a **design doc first**
(committed spec), then a minimal implementation skeleton.

The infrastructure must satisfy:

> *"Every interaction with the UI should be feeding into multiple
> UI experiments to improve the UI UX at all times."* — 081KQ0YZ80008QG0R0003GAYYN

> *"Every pixel and list and other elements count — make them earn
> their way through ongoing experiments."* — 081KQ0YZ80008QG0R0003GAYYN

### Infrastructure components to design

**1. Event schema** (TypeScript types)

Minimal event shape:
```typescript
type DashboardEvent = {
  sessionId: string;       // per-visit UUID
  experimentId: string;    // which experiment is active
  variantId: string;       // which variant of the experiment
  eventType: string;       // "page-load" | "tier-click" | "resolve" | ...
  timestamp: number;       // Unix ms
  durationMs?: number;     // time-to-answer proxy where applicable
  metadata: Record<string, unknown>;
};
```

The exact schema is a design decision; the above is a starting
hypothesis. The implementer must validate against 081KR50HA0008QG0R00223YZP8's
instrumented measurement modality definition.

**2. Experiment registration** (TypeScript types + storage)

- Experiment: an ID + description + variant definitions +
  start/end timestamps + target metric (defaults to
  time-to-answer proxy from 081KR50HA0008QG0R00223YZP8)
- Variant: an ID + feature-flag overrides for the UI
- Registration lives in a git-native file (YAML or JSON)
  checked into the repo, not a database. Append-only.

**3. Variant assignment**

- Assignment rule: user/session is deterministically assigned
  to a variant based on hash(sessionId + experimentId).
  Deterministic so a returning session stays in the same
  variant without a server.
- Static-site-compatible: no server needed; all assignment
  happens client-side from the registered experiment file.

**4. Result storage** (git-native)

- Event stream → local browser storage (IndexedDB) during session
- On session end: export as a JSON summary, prompt user to
  commit it to a git-native results directory
  (`experiments/results/YYYY-MM-DD/` or equivalent)
- Why git-native: consistent with the factory's git-native
  philosophy; no external analytics service; results are
  durable, versioned, searchable

**5. Analysis tooling** (TypeScript CLI)

- `bun tools/experiments/analyze.ts <experiment-id>` — reads
  result files, computes per-variant time-to-answer stats,
  outputs structured JSON
- Rule 0: no `.sh` files; TS only

### Design constraints

- **Zero external services**: no Mixpanel, Segment, Google Analytics.
  All instrumentation is self-hosted and git-native.
- **Privacy-safe**: no PII in events; sessionId is ephemeral per visit.
- **Agent-compatible**: agents using the dashboard also generate events;
  the schema must accommodate agent-origin sessions.
- **Static-site-compatible**: no server required; client-side only.

## Why after 081KR50HA0008QG0R00223YZP8 and 081KR50HA0008QG0R0036HGEJ5

- **081KR50HA0008QG0R00223YZP8**: the experiment's primary variable is the time-to-answer
  metric; the event schema must match 081KR50HA0008QG0R00223YZP8's instrumented
  measurement modality.
- **081KR50HA0008QG0R0036HGEJ5**: the infrastructure must be compatible with the GH Pages
  static hosting model (no server-side processing).

## Output artifacts

- `docs/research/frontier/ab-experiment-infrastructure-design.md`
  — full design doc with the above components specified
- `tools/experiments/` — TypeScript skeleton (types only, no
  implementation): `event-schema.ts`, `experiment-registry.ts`,
  `variant-assignment.ts`, `analyze.ts`
- `experiments/registry.json` — empty experiment registry file

## Focused check

```bash
ls tools/experiments/
cat docs/research/frontier/ab-experiment-infrastructure-design.md | head -5
```

Expected: tools directory and design doc both present.

## Acceptance signal

- Design doc committed with all 5 components specified
- TypeScript type files committed (may be skeleton/stub)
- `bun tools/experiments/analyze.ts --help` runs without error
- Experiment registry file committed (empty is OK)
- No TypeScript errors in the skeleton

## Pre-start checklist

- [x] Prior-art search: no existing A/B experiment infrastructure
  for this dashboard found in `tools/`, `docs/research/frontier/`,
  or memory files. The experiment-tracking concept is in 081KQ0YZ80008QG0R0003GAYYN
  but not yet designed. Check `tools/` for any existing analytics
  or event-capture tooling before creating new structure.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5]` —
  needs metric definition and host model. 081KR50HA0008QG0R002NZENZJ depends on this.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): implements "A/B experiment infrastructure
  designed" milestone
- 081KR50HA0008QG0R00223YZP8 (dependency): event schema implements instrumented
  measurement modality
- 081KR50HA0008QG0R0036HGEJ5 (dependency): static-site constraints govern the
  client-side architecture
- 081KR50HA0008QG0R002NZENZJ (downstream): MVP wires this infrastructure for
  first live experiments
