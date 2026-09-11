---
id: 081M28X3E6E087G0R001Q58WVJ
type: task
state: backlog
priority: P2
slug: gate-jobs-on-graph-derived-affected-legs-instead-of-hand-wri
title: "Gate jobs on graph-derived affected legs instead of hand-written path filters"
created: 2026-09-11T18:53:55.790Z
depends_on: []
composes_with: []
---

# Gate jobs on graph-derived affected legs instead of hand-written path filters

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M28X3E6E087G0R001Q58WVJ-*.md` glob. -->

## What landed

`gate.yml` selects 28 jobs from `ace/build-graph.json` instead of from hand-written
path filters. `path-filter` publishes one output — `legs`, a JSON object keyed by job
slug — and each job carries one expression:

```yaml
if: fromJSON(needs.path-filter.outputs.legs).gate_lint_fsharp != false
```

The KEYS come from the graph at run time, so no roster of them lives in the workflow.
`!= false` is the fail-closed half: a leg the selector never emitted reads as `null`,
and `null != false` is true, so an unknown job RUNS.

Retired: the per-domain vector (`csharp`/`fsharp`/`go`/`markdown`/`python`/`rust`/
`workflows`) that gated the five language lints from `ci/path-domains.ts`. Two of those
seven outputs (`markdown`, `workflows`) were already dead — declared and consumed by
nothing.

## Follow-on

- `ci/local-checks.ts` still uses `path-domains.ts`, because the local runner has no
  graph query available to it. Two classifiers that can disagree is a real cost, named
  in that file's header. Converging them is the remaining work here.
- `cross-verify` and `full-verify` are deliberately not gated — 081M28X3E5P087G0R0004S8JJY.
