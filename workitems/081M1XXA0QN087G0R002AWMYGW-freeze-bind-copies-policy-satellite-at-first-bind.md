---
id: 081M1XXA0QN087G0R002AWMYGW
type: task
state: backlog
priority: P2
slug: freeze-bind-copies-policy-satellite-at-first-bind
title: "freeze bind copies policy satellite at first bind"
created: 2026-09-07T12:25:52.629Z
depends_on: []
composes_with: []
---

# freeze bind copies policy satellite at first bind

PR5: freeze `bindFile` / `bindDirectory` / `bindName` call `copyAtFirstBind`
and persist a text `policy` satellite. First bind copies nearest ByPrefix
or VolumeDefault onto ByEntity. Later prefix edits do not rewrite the hub.
Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1XXA0QN087G0R002AWMYGW-*.md` glob. -->
