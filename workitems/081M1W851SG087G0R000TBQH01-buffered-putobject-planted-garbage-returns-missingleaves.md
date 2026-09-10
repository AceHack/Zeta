---
id: 081M1W851SG087G0R000TBQH01
type: task
state: backlog
priority: P2
slug: buffered-putobject-planted-garbage-returns-missingleaves
title: "Buffered putObject planted garbage returns MissingLeaves"
created: 2026-09-06T20:56:55.344Z
depends_on: []
composes_with: []
---

# Buffered putObject planted garbage returns MissingLeaves

Journaled freeze hash-verifies after putLeaves. Buffered `putObject` still
skipped an existing POSIX path, so garbage there could return Ok. Hash-verify
after write/skip; mismatch is MissingLeaves. Falsifier: plant wrong bytes,
Buffered freeze returns MissingLeaves, prior Journaled freeze stays readable.
Recovery stays `toy`.

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1W851SG087G0R000TBQH01-*.md` glob. -->
