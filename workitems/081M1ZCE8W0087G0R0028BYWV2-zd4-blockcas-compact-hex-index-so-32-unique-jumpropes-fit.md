---
id: 081M1ZCE8W0087G0R0028BYWV2
type: task
state: backlog
priority: P1
slug: zd4-blockcas-compact-hex-index-so-32-unique-jumpropes-fit
title: "ZD4 BlockCas compact hex index so 32 unique jumpropes fit"
created: 2026-09-08T02:09:35.104Z
depends_on: ["081M1ZA8S7C087G0R002P9NX40"]
composes_with: ["081M1HGD1QA087G0R001GRHPFW"]
---

# ZD4 BlockCas compact hex index so 32 unique jumpropes fit

UTF-8 32-hex ContentAddress128 names overflow one 4096-byte ZCA2
superblock at 32 unique 1-byte jumpropes (chunk+leaf+trunk = 96 names).
Encode lowercase even-length hex as raw bytes with the uint16 length
high bit set. Old UTF-8 slots still decode. Falsifier: 96 hex names
Put+CloneMedia, then ZD4 storm N=32 both legs.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1ZCE8W0087G0R0028BYWV2-*.md` glob. -->
