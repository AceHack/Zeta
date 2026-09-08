---
id: 081M1Z5ZW1T087G0R0002KPWJ8
type: task
state: done
priority: P2
slug: publish-reviewed-compiled-replay-and-native-custody-evidence
title: "Publish reviewed compiled replay and native custody evidence"
created: 2026-09-08T00:16:51.770Z
completed: 2026-09-08T02:04:18.214Z
depends_on: []
composes_with: ["081M1XXWTTF087G0R000X1HMD0"]
---

# Publish reviewed compiled replay and native custody evidence

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1Z5ZW1T087G0R0002KPWJ8-*.md` glob. -->

## Scope and acceptance

Preserve the reviewed static/file/identity replay, outer structure/read/store
boundaries and native current-extent/instruction evidence after PR #16982.
Retain every failed attempt and its exact correction. Run the full local gate,
independent review and required CI; verify all final PR paths and exact merge
publication. The original study and frozen protocol remain unchanged. This
finite publication does not complete the parent experiment or create its
implementation archive.
