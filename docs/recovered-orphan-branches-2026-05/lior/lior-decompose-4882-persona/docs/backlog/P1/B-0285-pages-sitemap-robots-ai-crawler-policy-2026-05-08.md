---
id: B-0285
priority: P1
status: open
title: "Pages discoverability - sitemap, robots, and AI crawler policy"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0234
depends_on: [B-0284]
classification: blocked-on-B-0284
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0285 - Sitemap and crawler policy

Publish the machine-readable discovery files for search engines,
link-preview systems, and AI-agent crawlers.

## Acceptance criteria

- `sitemap.xml` is generated and reachable.
- `robots.txt` is generated and reachable.
- AI-agent crawler policy is explicit and matches the
  discoverability goal.
- Validation covers the published sitemap and robots URLs.
