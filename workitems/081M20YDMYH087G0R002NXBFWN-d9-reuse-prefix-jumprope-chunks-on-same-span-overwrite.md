---
id: 081M20YDMYH087G0R002NXBFWN
type: task
state: backlog
priority: P2
slug: d9-reuse-prefix-jumprope-chunks-on-same-span-overwrite
title: "D9 reuse prefix Jumprope chunks on same-span overwrite"
created: 2026-09-08T16:43:03.506Z
depends_on: ["081M20W9GA4087G0R0015YDSNQ"]
composes_with: []
---

# D9 reuse prefix Jumprope chunks on same-span overwrite

Freeze still ran FastCDC on the whole snapshot. Same-span overwrite
hashes previous windows until the first mismatch, then FastCDC only
the suffix. Identical bytes reuse the trunk and put nothing in Cas.
Length change falls back to a full build. Layout only, not payloads
(D10). Recovery stays toy. Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M20YDMYH087G0R002NXBFWN-*.md` glob. -->
