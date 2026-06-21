---
id: 081KR2E4K0008QG0R000WYVJAF
priority: P1
status: open
title: "Pages content sources - stable route map before indexing"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQX9B50008QG0R0001XDTDQ
depends_on: [081KR2E4K0008QG0R0035QVX6S]
classification: blocked-on-081KR2E4K0008QG0R0035QVX6S
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# 081KR2E4K0008QG0R000WYVJAF - Pages stable route map

Turn the approved public source inventory into stable URL paths before
search engines and AI-agent crawlers begin indexing the site.

## Acceptance criteria

- Route map assigns stable paths for the landing page, vision,
  alignment, glossary, contributor on-ramp, and selected research pages.
- URL scheme is documented as pre-indexing frozen unless a later PR
  explicitly includes redirects.
- Route map avoids leaking internal directory names such as `memory`,
  `hygiene-history`, `backlog`, or `claims`.
- Route naming composes with sitemap generation and canonical URLs in
  081KR2E4K0008QG0R0028VW6B3 and 081KR2E4K0008QG0R0037MW8ET.
- Any deferred page class is called out with the prerequisite needed to
  add it later.

## Out of scope

- Implementing redirects.
- Publishing the sitemap or robots policy.
