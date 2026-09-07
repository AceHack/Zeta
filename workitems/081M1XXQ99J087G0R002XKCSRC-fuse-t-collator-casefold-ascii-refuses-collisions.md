---
id: 081M1XXQ99J087G0R002XKCSRC
type: task
state: backlog
priority: P2
slug: fuse-t-collator-casefold-ascii-refuses-collisions
title: "FUSE-T collator CaseFold.Ascii refuses collisions"
created: 2026-09-07T12:33:07.378Z
depends_on: []
composes_with: []
---

# FUSE-T collator CaseFold.Ascii refuses collisions

PR13 first peel: mount-view collator algebra. Store stays ordinal. Linux
default is ordinal. FUSE-T default is `CaseFold.Ascii` (A-Z only) and
refuses a second live name that collides under the fold. Existing
collisions enumerate as `ConfusableWithExisting` facts; never silent
merge. No kernel FUSE yet. No Apple Developer Program yet. Recovery
stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1XXQ99J087G0R002XKCSRC-*.md` glob. -->
