---
id: 081KR2E4K0008QG0R0015BCPF7
priority: P1
status: open
title: "Pages discoverability - sitemap, robots, and AI crawler policy"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQX9B50008QG0R0004N4HNK
depends_on: [081KR2E4K0008QG0R0028VW6B3]
classification: blocked-on-081KR2E4K0008QG0R0028VW6B3
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# 081KR2E4K0008QG0R0037MW8ET - Sitemap and crawler policy

Publish the machine-readable discovery files for search engines,
link-preview systems, and AI-agent crawlers.

## Acceptance criteria

- `sitemap.xml` is generated and reachable.
- `robots.txt` is generated and reachable.
- AI-agent crawler policy is explicit and matches the
  discoverability goal.
- Validation covers the published sitemap and robots URLs.
