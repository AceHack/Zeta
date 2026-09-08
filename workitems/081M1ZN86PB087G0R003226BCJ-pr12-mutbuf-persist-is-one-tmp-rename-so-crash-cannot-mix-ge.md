---
id: 081M1ZN86PB087G0R003226BCJ
type: task
state: backlog
priority: P2
slug: pr12-mutbuf-persist-is-one-tmp-rename-so-crash-cannot-mix-ge
title: "PR12 mutbuf persist is one tmp-rename so crash cannot mix gen and bytes"
created: 2026-09-08T04:43:33.451Z
depends_on: ["081M1ZKQNCY087G0R000K1B80D"]
composes_with: []
---

# PR12 mutbuf persist is one tmp-rename so crash cannot mix gen and bytes

persist used to write `data` then `gen`. Crash after the data rename
left new bytes with the old generation. One `slot` file, tmp+rename.
Legacy `data`/`gen` still load. Recovery stays toy. Not Apple. Not FUSE.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZN86PB087G0R003226BCJ-*.md` glob. -->
