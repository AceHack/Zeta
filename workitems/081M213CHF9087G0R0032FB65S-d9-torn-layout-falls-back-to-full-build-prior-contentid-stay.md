---
id: 081M213CHF9087G0R0032FB65S
type: task
state: backlog
priority: P2
slug: d9-torn-layout-falls-back-to-full-build-prior-contentid-stay
title: "D9 torn layout falls back to full build prior ContentId stays"
created: 2026-09-08T18:09:50.057Z
depends_on: ["081M211SN5W087G0R00129M1E6"]
composes_with: []
---

# D9 torn layout falls back to full build prior ContentId stays

Layout is a hint. Garbage or crash-mid-write of `layout/<entity>`
must not lose a committed freeze. Next overwrite still matches a
full Jumprope build. Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M213CHF9087G0R0032FB65S-*.md` glob. -->
