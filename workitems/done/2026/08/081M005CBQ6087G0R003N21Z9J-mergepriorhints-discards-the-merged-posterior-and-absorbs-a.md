---
id: 081M005CBQ6087G0R003N21Z9J
type: bug
state: done
priority: P2
slug: mergepriorhints-discards-the-merged-posterior-and-absorbs-a
title: "mergePriorHints discards the merged posterior and absorbs a constant severity instead"
created: 2026-08-14T12:54:03.238Z
completed: 2026-08-15T13:44:05.536Z
depends_on: []
composes_with: []
---

# mergePriorHints discards the merged posterior and absorbs a constant severity instead

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M005CBQ6087G0R003N21Z9J-*.md` glob. -->
## The defect (found 2026-08-14, NOT fixed: discovery/ was held by another agent)

`src/Core.TypeScript/discovery/zeta-transport-cell.ts` `mergePriorHints` computes
`mergePriorHint(local, hint, trustWeight)` into `merged`, then uses `merged` ONLY to
format a beacon string. The state update that follows is:

```
absorbError(this._bnn, { ... mirror: { dimension: hint.dimension, severity: "info" } })
```

and `toEpObservation` maps `severity: "info"` to the constant `SEVERITY_Z.info = 0.5`.
So the EP arithmetic the function is named for is thrown away, and EVERY prior hint --
whatever its `mu`, `sigma2` or `robustnessWeight` -- pushes the receiving dimension
toward the same fixed observation 0.5. A hint saying `mu = 4` and a hint saying
`mu = 0` are indistinguishable to the receiver.

## Why it was left

`src/Core.TypeScript/discovery/**` was held by another agent during the PR that found
this (the society-runner prior-publication repair). Reported rather than fixed.

## What the fix has to decide

Not merely "use `merged`". Writing a merged posterior straight into the state is a
different operation from absorbing an observation, and only one of them is EP. The
honest repair is probably to set the dimension state to `merged` directly and NOT to
route a prior hint through `absorbError` at all -- a peer belief is not an error.
See 081M005CFFE087G0R0026WF2DS (site messages, not posteriors) for the wire-type half.

## Falsifier the fix must carry

Two hints differing only in `mu` must leave the receiver in two different states.
That test fails against the code as written today.

## Resolution (2026-08-15)

`mergePriorHints` now writes the merged Gaussian through
`replaceDimensionPosterior` and no longer routes a peer belief through
`absorbError`. ZTC-18 is the falsifier: mu=4 and mu=0 leave different
receiver states. The wire-type follow-up (site messages, not posteriors)
stays on 081M005CFFE087G0R0026WF2DS.
