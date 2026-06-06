---
id: B-0302
zetaid: 081KR2E4K0008QG0R000WYVJAF
priority: P1
status: open
title: "Pages content sources - stable route map before indexing"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0233
depends_on: [B-0301]
classification: blocked-on-B-0301
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0302 - Pages stable route map

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
  B-0284 and B-0285.
- Any deferred page class is called out with the prerequisite needed to
  add it later.

## Out of scope

- Implementing redirects.
- Publishing the sitemap or robots policy.
