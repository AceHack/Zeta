---
id: 081M21080ZQ087G0R0037YY66R
type: task
state: backlog
priority: P2
slug: d9-persist-jumprope-layout-so-reopen-still-reuses-prefix
title: "D9 persist Jumprope layout so reopen still reuses prefix"
created: 2026-09-08T17:14:56.375Z
depends_on: ["081M20YDMYH087G0R002NXBFWN"]
composes_with: []
---

# D9 persist Jumprope layout so reopen still reuses prefix

`buildFromPrev` only saw in-memory LastLayout. Reopen full-built.
Persist starts + chunk ids (not payloads) under `layout/<entity>`.
Hint only: a torn layout falls back to a full build. Recovery stays
toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21080ZQ087G0R0037YY66R-*.md` glob. -->
