---
id: 081M21BXYD3087G0R003NRYGTK
type: task
state: backlog
priority: P2
slug: d10-skip-layout-persist-for-single-leaf-jumpropes
title: "D10 skip layout persist for single-leaf jumpropes"
created: 2026-09-08T20:39:08.963Z
depends_on: ["081M219CMZE087G0R000GSEAQJ"]
composes_with: []
---

# D10 skip layout persist for single-leaf jumpropes

Layout is a hint. A one-leaf jumprope rebuilds cheaply, so freeze does
not write `layout/<entity>`. LastLayout stays in memory. The 32×1-byte
storm creates no layout files. Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21BXYD3087G0R003NRYGTK-*.md` glob. -->
