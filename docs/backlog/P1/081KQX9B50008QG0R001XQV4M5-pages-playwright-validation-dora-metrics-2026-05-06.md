---
id: B-0236
zetaid: 081KQX9B50008QG0R001XQV4M5
priority: P1
status: open
title: "GitHub Pages discoverability - Playwright validation and DORA metrics"
created: 2026-05-06
last_updated: 2026-05-08
parent: B-0154
depends_on: [B-0147, B-0232, B-0234]
classification: blocked-on-pages-and-metrics-lane
decomposition: decomposed
children: [B-0297, B-0298]
owners: [qa, observability]
type: friction-reducer
---

# B-0236 - Pages validation and DORA metrics

Add the validation and measurement layer for the Pages
frontend deployment lane.

## Work scope

This row owns Playwright checks for HTTP 200, metadata,
navigation, sitemap, robots, mobile viewport, and the DORA
frontend metrics for Pages deployment frequency, lead time,
MTTR, and change failure rate.

## Acceptance criteria

- Playwright tests cover the public Pages surface and fail on
  404 regressions.
- The tests run in the appropriate CI or post-deploy lane.
- DORA metric definitions are written for the Pages frontend
  deployment path.
- The metrics path composes with the timeseries lane instead
  of inventing a second observability substrate.
