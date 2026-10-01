---
id: 081M3TRSR03087G0R0035B51JA
type: bug
state: backlog
priority: P2
slug: gitlab-runner-bring-up-token-mint-had-one-attempt-runner-ski
title: "GitLab runner bring-up: token mint had one attempt, runner skipped untagged jobs, redis and runner were BestEffort, HPAs sized for a cluster"
created: 2026-10-01T03:40:45.443Z
depends_on: []
composes_with: []
---

# GitLab runner bring-up: token mint had one attempt, runner skipped untagged jobs, redis and runner were BestEffort, HPAs sized for a cluster

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3TRSR03087G0R0035B51JA-*.md` glob. -->

## Found (2026-09-30, paper audit + `helm template` of gitlab 8.7.0 after #17737)

Follow-up to 081M3K253BR087G0R001151P2A. Reachability and the auth-token flow landed; the
bring-up still had four defects that only show once the first pipeline or the first busy minute
arrives:

- The token Job made ONE `gitlab-rails runner` attempt. One cold-start blip left
  `runner-token` empty and the runner crash-looping (registration-token flow, removed in 17).
- The runner was created `run_untagged: false`: the first `.gitlab-ci.yml` without `tags:`
  stayed Pending behind a healthy runner.
- Redis (queues, sessions, cache) and its exporter, the postgres exporter and the runner manager
  rendered `resources: {}`; redis was a BestEffort pod. CI job pods had no requests either.
- The chart's HPAs (webservice/registry/shell min 2, all max 10) are live under k3s's
  metrics-server: a 5.2 GiB webservice floor, and sidekiq scaling to ten 2 GiB pods on the
  first-boot CPU spike. Runner `concurrent` defaulted to 10 on a single node.

## Fix

Retry the Rails call on a wall-clock budget inside `activeDeadlineSeconds`; create the runner
`run_untagged: true`; fall back to `reset_token!` if an existing runner yields no token; requests
on redis/exporters/runner/job pods; HPA floor 1 / ceiling <= 2; runner `concurrent: 4`.

Falsifier: `src/Core.TypeScript/cluster/gitlab-runner-bringup.test.ts` (red on the pre-fix tree:
6 of 8; the script is extracted from the render and executed against a stub kubectl).

## Not verified (needs a live node)

That GitLab 17.7's `Ci::Runners::CreateRunnerService` accepts these params, that `runner.token`
decrypts for an existing runner, that Cilium honours `Gateway.spec.addresses`, and that a runner
pod registers with the minted token and runs a job. The rendered-resource-requests snapshot and the
storage-profiles `ungovernedRequests` gitlab row still carry the pre-#17737 total (they include the
removed KAS pod) and were not re-measured here.
