---
id: 081M1YVV9AG087G0R000THB9KS
type: task
state: backlog
priority: P2
slug: fuse-abi-init-headers-little-endian-no-dev-fuse
title: "FUSE ABI INIT headers little-endian no /dev/fuse"
created: 2026-09-07T21:19:35.760Z
depends_on: []
composes_with: []
---

# FUSE ABI INIT headers little-endian no /dev/fuse

PR13 kernel ABI encoder from man fuse(4) protocol 7.26. Little-endian
`fuse_in_header` / `fuse_out_header` / INIT. First-product INIT flags
are 0 (no writeback cache). No `/dev/fuse`. Recovery stays `toy`.
Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YVV9AG087G0R000THB9KS-*.md` glob. -->
