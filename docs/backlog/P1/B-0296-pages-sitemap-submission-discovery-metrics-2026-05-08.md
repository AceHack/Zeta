---
id: B-0296
zetaid: 081KR2E4K0008QG0R000GXGR6H
priority: P1
status: open
title: "Pages discoverability - sitemap submission and discovery metrics"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0235
depends_on: [B-0285, B-0295]
classification: blocked-on-sitemap-and-metadata
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0296 - Sitemap submission and discovery metrics

Define the external discovery handoff after the Pages metadata,
sitemap, and crawler policy are live.

## Acceptance criteria

- Google Search Console submission path is documented or
  completed.
- Bing Webmaster Tools submission path is documented or completed.
- Discovery metrics are defined: time-to-index, target-query
  ranking, crawler hit rate, and external contributor source.
- Measurement composes with the existing observability or
  timeseries lane instead of creating a second metrics substrate.
