---
id: 081M1YXW8X8087G0R001NS5Y0A
type: task
state: backlog
priority: P2
slug: fuse-byte-session-answers-init-with-first-product-flags-0
title: "FUSE byte session answers INIT with first-product flags 0"
created: 2026-09-07T21:55:05.256Z
depends_on: []
composes_with: []
---

# FUSE byte session answers INIT with first-product flags 0

PR13 byte session over the ABI encoder. INIT negotiates 7.26 with
flags 0 (no writeback cache). A newer kernel major gets only our
major. Unknown opcodes are ENOSYS. No `/dev/fuse`. Recovery stays
`toy`. Apple Developer Program is not the next blocker.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1YXW8X8087G0R001NS5Y0A-*.md` glob. -->
