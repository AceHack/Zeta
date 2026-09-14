---
id: 081M2F7F8CQ087G0R000HWR80K
type: bug
state: backlog
priority: P2
slug: org-store-stacked-doc-comments-left-readevents-undocumented
title: "org-store: stacked doc comments left readEvents undocumented"
created: 2026-09-14T05:50:00.000Z
depends_on: []
composes_with: []
---

# org-store: stacked doc comments left readEvents undocumented

`#17403` inserted the events snapshot between `readEvents`'s doc comment
and the function. The comment now sat above `SNAPSHOT`, so an editor
attributes "Every event ever stored" to a filename constant, and
`hygiene:no-orphaned-doc-comments` fails.

Move the block back onto `readEvents`.
