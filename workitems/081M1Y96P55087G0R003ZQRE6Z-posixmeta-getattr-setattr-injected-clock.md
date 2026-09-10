---
id: 081M1Y96P55087G0R003ZQRE6Z
type: task
state: backlog
priority: P2
slug: posixmeta-getattr-setattr-injected-clock
title: "PosixMeta getattr setattr injected clock"
created: 2026-09-07T15:53:46.405Z
depends_on: []
composes_with: []
---

# PosixMeta getattr setattr injected clock

PR13: POSIX metadata satellite. Auto-stamps from injected
`ISimulationEnvironment` (`unixNs = ToUnixTimeMilliseconds * 1_000_000`).
Never `DateTime.UtcNow`. `utimensat` writes caller unix-ns. Getattr size
is dirty mutbuf length if present. No kernel FUSE. Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Y96P55087G0R003ZQRE6Z-*.md` glob. -->
