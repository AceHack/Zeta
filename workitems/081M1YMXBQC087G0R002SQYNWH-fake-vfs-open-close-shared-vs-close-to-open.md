---
id: 081M1YMXBQC087G0R002SQYNWH
type: task
state: backlog
priority: P2
slug: fake-vfs-open-close-shared-vs-close-to-open
title: "Fake VFS open close shared vs close-to-open"
created: 2026-09-07T19:18:23.724Z
depends_on: []
composes_with: []
---

# Fake VFS open close shared vs close-to-open

PR13 Fake VFS open/close. Shared fds see each other's pwrite without
close. CloseToOpen publishes on last-close; the other fd does not see
it until reopen. Open of a directory is Eisdir. No kernel FUSE.
Recovery stays `toy`. Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YMXBQC087G0R002SQYNWH-*.md` glob. -->
