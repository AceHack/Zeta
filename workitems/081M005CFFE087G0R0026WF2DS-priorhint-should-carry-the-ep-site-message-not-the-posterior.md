---
id: 081M005CFFE087G0R0026WF2DS
type: task
state: backlog
priority: P2
slug: priorhint-should-carry-the-ep-site-message-not-the-posterior
title: "PriorHint should carry the EP site message not the posterior"
created: 2026-08-14T12:54:07.086Z
depends_on: []
composes_with: []
---

# PriorHint should carry the EP site message not the posterior

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M005CFFE087G0R0026WF2DS-*.md` glob. -->
## The mathematical statement

Under EP the message a peer owes its neighbours is its SITE contribution
(`posterior / cavity`), not its posterior (Minka 2001, ch. 4). `PriorHint` carries
`mu` / `sigma2` -- the posterior. Every receiver therefore folds in the SHARED PRIOR
once per sender: N peers exchanging posteriors count the same prior N times, which is
exactly the prior-double-counting the cavity distribution exists to prevent.

`StudentTState` already carries the right object as `factorMu` / `factorSigma2`, today
marked DIAGNOSTIC ONLY. For a never-observed dimension it is exactly uniform
(`factorSigma2 = +Infinity`, precision 0), which is why the interim `obsCount` guard in
`mergePriorHint` is a no-op for a correct sender: sending the right object would
already have contributed nothing.

## Scope

Changes the wire type (`PriorHint` in `src/Core.TypeScript/protocol/batch-teaching-envelope.ts`) and every
producer and consumer, including `src/Core.TypeScript/discovery/zeta-transport-cell.ts`. Not a drive-by.

## Honest limit to state in the fix

A site message is still not idempotent under redelivery -- `mergePriorHint` has no
dedup key, so the same site folded twice counts twice. Pinned today by SHR-6 in
`src/Core.TypeScript/planning/society-heat-readout.test.ts` so nobody reads the interim guard as having
fixed idempotency (discipline #6) as well.

## Related

- 081M005CBQ6087G0R003N21Z9J -- the receiver discards the merge result entirely.
- #10563 -- `dimensionPosterior` still returns an ungated `mu`; the named TS gap.
