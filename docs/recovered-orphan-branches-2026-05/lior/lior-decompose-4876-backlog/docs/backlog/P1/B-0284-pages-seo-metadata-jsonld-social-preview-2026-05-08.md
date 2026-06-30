---
id: B-0284
priority: P1
status: open
title: "Pages discoverability - SEO metadata, JSON-LD, and social previews"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0234
depends_on: [B-0233]
classification: blocked-on-pages-content
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0284 - SEO metadata and structured data

Define the metadata layer for the GitHub Pages site once the
content inventory exists.

## Acceptance criteria

- Each public page has title, description, and canonical URL.
- Open Graph and Twitter Card metadata are emitted for link
  previews.
- JSON-LD is present where it improves agent parsing.
- Metadata defaults are centralized instead of duplicated per
  page.
