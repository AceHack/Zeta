---
id: 081M21F108S087G0R003JK8WST
type: task
state: backlog
priority: P2
slug: d10-encode-catalog-with-stringbuilder-one-utf-8-pass
title: "D10 encode catalog with StringBuilder one UTF-8 pass"
created: 2026-09-08T21:33:14.905Z
depends_on: ["081M21BXYD3087G0R003NRYGTK"]
composes_with: []
---

# D10 encode catalog with StringBuilder one UTF-8 pass

Catalog persist built a string[] of ToHex lines, concat, UTF-8 for CRC,
then UTF-8 again for the slot write. One StringBuilder payload, CRC that
span, header plus payload bytes. Bound stays 48 MiB. Recovery stays toy.
Not Apple.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M21F108S087G0R003JK8WST-*.md` glob. -->
