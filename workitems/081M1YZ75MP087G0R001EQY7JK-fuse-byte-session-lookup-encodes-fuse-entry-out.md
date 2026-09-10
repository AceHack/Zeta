---
id: 081M1YZ75MP087G0R001EQY7JK
type: task
state: backlog
priority: P2
slug: fuse-byte-session-lookup-encodes-fuse-entry-out
title: "FUSE byte session LOOKUP encodes fuse_entry_out"
created: 2026-09-07T22:18:30.934Z
depends_on: []
composes_with: []
---

# FUSE byte session LOOKUP encodes fuse_entry_out

PR13 byte session LOOKUP over Fake VFS. Name is NUL-terminated.
`fuse_entry_out` carries `st_ino` and zero cache timeouts. Missing is
ENOENT. No `/dev/fuse`. Recovery stays `toy`. Apple Developer Program
is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YZ75MP087G0R001EQY7JK-*.md` glob. -->
