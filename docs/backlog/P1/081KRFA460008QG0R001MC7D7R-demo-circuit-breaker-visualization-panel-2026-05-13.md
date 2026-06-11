---
id: B-0435
zetaid: 081KRFA460008QG0R001MC7D7R
priority: P1
status: open
title: "Demo — circuit breaker visualization panel (mock data → live bus data)"
tier: product-demo
effort: M
created: 2026-05-13
last_updated: 2026-05-14
parent: B-0401
depends_on: [B-0434]
tags: [demo, circuit-breaker, alignment-ui, github-pages, html, js]
type: feature
---

# B-0435 — Circuit breaker visualization panel

## What

Add a "Circuit Breaker" panel to `demo/index.html` (the 4th Alignment tab or a
5th tab) that shows cross-model loop detection state. Initially rendered with
mock/static data; a follow-up can wire to a live bus.

## Acceptance criteria

- [x] Panel renders without errors in `demo/index.html`
- [x] Shows at minimum: model name, loop-detection status, last-check timestamp
- [x] Static/mock data acceptable for slice-1 of this row
- [x] `dotnet build -c Release` → 0 warnings, 0 errors

## Blocked on

None; B-0434 (alignment tab) already shipped and provides the CSS/JS scaffolding.

## Pre-start checklist (2026-05-14)

**Prior-art search:**

- Searched `.claude/skills/`, `.claude/rules/` — no existing circuit-breaker UI skill.
- `demo/index.html` examined: 4-tab SPA, tab pattern clear, Alignment tab (B-0434) is direct scaffolding precedent.
- No existing circuit-breaker panel code found in `demo/`.

**Dependency check:**

- `depends_on: [B-0434]` — B-0434 (alignment tab) is merged on main. Scaffolding available. ✓
- `parent: B-0401` — bus protocol parent; slice-1 uses static mock, no bus runtime dependency.

**Claim:** `bun tools/bus/claim.ts acquire --from otto-cli --item B-0435` → exit 0 ✓

**Decomposition:**

- Slice-1 (this PR): static mock panel — model name, loop-detection state, last-check timestamp.
- Slice-2 (future): wire to live `/tmp/zeta-bus/` envelopes via a relay fetch.
