---
id: 081M1WDZ3XM087G0R0006H2KY6
type: task
state: backlog
priority: P2
slug: volume-root-loads-the-crockford-26-hub
title: "Volume.Root loads the Crockford-26 hub"
created: 2026-09-06T22:38:32.372Z
depends_on: []
composes_with: []
---

# Volume.Root loads the Crockford-26 hub

Freeze writes ROOT on first create but Volume does not expose it. Load
`Volume.Root` from the ROOT file at construct (after create writes it).
Reopen yields the same EntityId. TagBinding objects still not persisted.
Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1WDZ3XM087G0R0006H2KY6-*.md` glob. -->
