---
id: 081KR2E4K0008QG0R002QNGJVX
priority: P1
status: open
title: "Pages discoverability - Playwright public surface validation"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQX9B50008QG0R001XQV4M5
depends_on: [081KQX9B50008QG0R001J6ARGX, 081KQX9B50008QG0R0004N4HNK, 081KR2E4K0008QG0R0028VW6B3, 081KR2E4K0008QG0R0037MW8ET]
classification: blocked-on-pages-content-and-seo-files
decomposition: atomic
owners: [qa, docs]
type: friction-reducer
---

# 081KR2E4K0008QG0R002QNGJVX - Pages Playwright validation

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
