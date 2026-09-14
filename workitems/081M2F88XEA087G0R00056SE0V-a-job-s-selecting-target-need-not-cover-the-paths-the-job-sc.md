---
id: 081M2F88XEA087G0R00056SE0V
type: bug
state: backlog
priority: P2
slug: a-job-s-selecting-target-need-not-cover-the-paths-the-job-sc
title: "a job's selecting target need not cover the paths the job scans so a lint skipped its own subject"
created: 2026-09-14T06:04:36.170Z
depends_on: []
composes_with: []
---

# a job's selecting target need not cover the paths the job scans so a lint skipped its own subject

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2F88XEA087G0R00056SE0V-*.md` glob. -->

## The measurement

`gate/lint-bash-retirement-inventory` is claimed by exactly one target:

```
ts:hygiene   sources: ["src/Core.TypeScript/hygiene/**"]
             legs:    [..., "gate/lint-bash-retirement-inventory", ...]
```

One of that job's steps runs

```
bun ./src/Core.TypeScript/hygiene/lint-orphaned-doc-comments.ts src/Core.TypeScript/corporate
```

**The job SCANS `corporate/`. Nothing that selects it COVERS `corporate/`.** A PR touching only
that directory does not select the leg, the job skips, and the lint never looks at the very tree
it exists to lint.

## What it cost, measured

PR #17403 changed 17 files, all under `src/Core.TypeScript/corporate/`. It moved `readEvents`
away from its docstring, stranding a doc comment above `const SNAPSHOT` — exactly the defect
`lint-orphaned-doc-comments` detects.

| where | outcome |
|---|---|
| on the PR | `lint (bash retirement inventory + hygiene unit tests)` = **skipped** |
| after merge, on `main`'s tip | the same job = **failure** |

Verified against `origin/main~2`: before #17403 the docstring sat directly above
`export function readEvents`. The PR introduced the orphan and the gate could not see it.

It surfaced only because an unrelated PR (#17406) touched `src/Core.TypeScript/hygiene/**`, which
IS a selecting source — so a defect in one directory became a failure on a PR that never went
near it.

## Why the existing audit does not catch this

`audit-build-graph-completeness.ts` checks direction C: every job is claimed by SOME target, and
a rostered infrastructure job is not also claimed. Both hold here — `ts:hygiene` claims the leg,
so the graph is "complete" by that definition.

What is unchecked is whether **the claiming target's sources cover the paths the job actually
reads**. A job can be fully claimed and still be unselectable by the changes it is meant to judge.
That is the same shape as a check that did not run looking like one that passed, one level up: the
check exists, is claimed, and is invisible to its own subject.

## Candidate fixes, not chosen here

1. Claim the leg from `ts:repo` (`**/*.ts`), so any TypeScript change selects it. Correct and
   heavier; the job's steps genuinely read across directories.
2. Split the job so each step's scan scope matches a claiming target's sources.
3. Derive the claim: parse each job's commands for the paths they scan and require the union to be
   covered by its claiming targets' sources. This is the version that cannot rot, and it would
   have found this without anyone noticing the symptom.

Option 3 is the one worth building — it turns "somebody checked" into a falsifier. Not done here
because re-wiring leg claims changes what runs on every PR in the fleet, which is a decision, not
a fix.

## Immediate repair (done)

The stranded docstring is reattached to `readEvents`, so `main` is green on this lint again. That
repairs the instance and leaves the mechanism open — which is why this row exists.
