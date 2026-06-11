---
id: B-0304
zetaid: 081KR2E4K0008QG0R001B503RK
priority: P1
status: open
title: "Pages content sources - selected research queue and redaction gate"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0233
depends_on: [B-0301, B-0302]
classification: blocked-on-B-0302
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0304 - Selected research publication queue

Define which research pages are suitable for the first public Pages
release, and require a redaction/suitability check before any research
document becomes indexed content.

## Acceptance criteria

- Initial research queue lists a small set of candidate public research
  pages with reasons for inclusion.
- Redaction gate checks for private operational substrate, prompt-injection
  payload risk, direct personal attribution where repo policy disallows it,
  and stale claims that need softening before publication.
- Research pages that stay internal are listed by class, not by exposing
  sensitive content in the public plan.
- The queue composes with B-0284 metadata and B-0285 sitemap decisions.
- Publication can proceed incrementally; failing one research candidate
  does not block the landing page, vision, alignment, or glossary pages.

## Out of scope

- Editing the research pages themselves.
- Publishing or indexing any page.
