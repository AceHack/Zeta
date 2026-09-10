---
id: 081M1Y48FW2087G0R002H43E44
type: task
state: backlog
priority: P2
slug: readdir-live-names-without-dot-or-dot-dot
title: "readdir live names without dot or dot-dot"
created: 2026-09-07T14:27:22.626Z
depends_on: []
composes_with: []
---

# readdir live names without dot or dot-dot

PR13: `readdir` returns live non-tombstone names, ordinal-sorted. No
`.` / `..` — the adapter synthesizes those. Tombstones are omitted
after reopen. No kernel FUSE. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Y48FW2087G0R002H43E44-*.md` glob. -->
