---
id: B-0297
zetaid: 081KR2E4K0008QG0R002QNGJVX
priority: P1
status: open
title: "Pages discoverability - Playwright public surface validation"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0236
depends_on: [B-0232, B-0234, B-0284, B-0285]
classification: blocked-on-pages-content-and-seo-files
decomposition: atomic
owners: [qa, docs]
type: friction-reducer
---

# B-0297 - Pages Playwright validation

Add browser-level validation for the published GitHub Pages
surface so discovery regressions fail in automation instead of
being found by a crawler or visitor.

## Acceptance criteria

- Playwright covers the public Pages URL with an HTTP 200 check.
- Navigation links used by the public landing flow are exercised.
- Metadata, `sitemap.xml`, and `robots.txt` are validated once
  those files are published.
- Mobile viewport coverage catches layout or overflow regressions
  on the primary Pages surface.
