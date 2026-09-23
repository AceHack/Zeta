---
id: 081M384M21W087G0R00202Q5Y2
type: task
state: backlog
priority: P2
slug: homemade-github-clis-wait-run-arm-auto-merge-explain-failure
title: "Homemade GitHub CLIs: wait-run, arm-auto-merge, explain-failures (REST-first, verified)"
created: 2026-09-23T22:01:47.836Z
depends_on: []
composes_with: []
---

# Homemade GitHub CLIs: wait-run, arm-auto-merge, explain-failures (REST-first, verified)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M384M21W087G0R00202Q5Y2-*.md` glob. -->

Agents improvised `waitjob.sh` / `watch.sh` and raw `gh api` loops for three jobs no CLI
covered. Built in `src/Core.TypeScript/forge-host/github/`:

- `wait-run.ts` — wait for one workflow run (by run id, PR + workflow, or SHA + workflow);
  REST only; 60 s default poll (20 s floor); back-off on 429 / 403 secondary limits;
  three-valued `completed` / `timed-out` / `unknown`, distinct exit codes.
- `arm-auto-merge.ts` — one GraphQL mutation (`enablePullRequestAutoMerge`, no REST form),
  verdict from a REST readback of `auto_merge`: `armed` / `already-merged` / `not-armed` /
  `unknown`. Optional `--update-branch` (REST).
- `explain-failures.ts` — failing check → job id (check-run id IS the job id) → failing
  steps → failure annotations; a 0-byte job log is `unknown`, never "no output".
- `github-rest-transport.ts` — token → `fetch`, else `gh api` argv via `io/safe-io.ts`.

Acceptance: falsifier suites for the pure decision logic, mutation-checked; docs name the
CLIs where `poll-pr-gate` is named.
