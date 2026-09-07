---
id: 081M1YP74QY087G0R002QMN71M
type: task
state: backlog
priority: P2
slug: fuse-opcode-dispatcher-over-fake-vfs-no-kernel
title: "FUSE opcode dispatcher over Fake VFS no kernel"
created: 2026-09-07T19:41:12.830Z
depends_on: []
composes_with: []
---

# FUSE opcode dispatcher over Fake VFS no kernel

PR13 FUSE opcodes over Fake VFS. Lookup/getattr/readdir/create/open/
read/write/release. Errnos are Linux values. No `/dev/fuse`, no kernel,
no FUSE-T binary. Recovery stays `toy`. Apple Developer Program is not
the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YP74QY087G0R002QMN71M-*.md` glob. -->
