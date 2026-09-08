---
id: 081M1ZHZ7EW087G0R00006H4BK
type: task
state: backlog
priority: P1
slug: d10-freeze-storm-alloc-bound-vs-groupcommit
title: "D10 freeze-storm alloc bound vs GroupCommit"
created: 2026-09-08T03:46:13.596Z
depends_on: ["081M1ZE5WSP087G0R002CVMVCN"]
composes_with: ["081M1HGD1QA087G0R001GRHPFW"]
---

# D10 freeze-storm alloc bound vs GroupCommit

Named ShortRun allocated ~94 MiB per 32-freeze storm vs ~351 KiB host.
First peel: skip FastCDC's 256 KiB buffer for files at or below min-chunk;
persist the volume catalog once per freeze, not per CAS put. Falsifier:
32 one-byte Jumpropes < 1 MiB; freeze storm thread alloc < 48 MiB
(measured 36 MiB after the cut; named ShortRun was ~94 MiB). Still
unmetered vs host 351 KiB. Not a speed claim. Recovery stays toy.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZHZ7EW087G0R00006H4BK-*.md` glob. -->
