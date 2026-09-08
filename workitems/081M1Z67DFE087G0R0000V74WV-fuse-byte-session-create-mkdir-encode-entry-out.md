---
id: 081M1Z67DFE087G0R0000V74WV
type: task
state: backlog
priority: P2
slug: fuse-byte-session-create-mkdir-encode-entry-out
title: "FUSE byte session CREATE MKDIR encode entry_out"
created: 2026-09-08T00:20:58.990Z
depends_on: []
composes_with: []
---

# FUSE byte session CREATE MKDIR encode entry_out

PR13 byte session CREATE/MKDIR over Fake VFS. MKDIR replies
`fuse_entry_out`. CREATE replies entry_out plus OPEN with
`FOPEN_DIRECT_IO`. No `/dev/fuse`. Recovery stays `toy`. Apple
Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z67DFE087G0R0000V74WV-*.md` glob. -->
