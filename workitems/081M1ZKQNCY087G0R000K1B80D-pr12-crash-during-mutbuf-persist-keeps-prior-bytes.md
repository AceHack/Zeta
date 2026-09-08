---
id: 081M1ZKQNCY087G0R000K1B80D
type: task
state: backlog
priority: P1
slug: pr12-crash-during-mutbuf-persist-keeps-prior-bytes
title: "PR12 crash during mutbuf persist keeps prior bytes"
created: 2026-09-08T04:17:02.878Z
depends_on: ["081M1C59ZG4087G0R000VM8DZN"]
composes_with: []
---

# PR12 crash during mutbuf persist keeps prior bytes

Named PR12 scenario: crash during mutbuf write. persist uses tmp+rename.
Crash-mid-write of data.tmp leaves the prior data file. Reopen loads
prior bytes, not a mix. Recovery stays toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZKQNCY087G0R000K1B80D-*.md` glob. -->
