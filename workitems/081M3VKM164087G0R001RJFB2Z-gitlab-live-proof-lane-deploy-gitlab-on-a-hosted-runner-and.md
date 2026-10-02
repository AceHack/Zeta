---
id: 081M3VKM164087G0R001RJFB2Z
type: task
state: in-progress
priority: P2
slug: gitlab-live-proof-lane-deploy-gitlab-on-a-hosted-runner-and
title: "GitLab live proof lane: deploy gitlab on a hosted runner and assert (a)-(f) live"
created: 2026-10-01T11:29:29.796Z
depends_on: []
composes_with: []
---

# GitLab live proof lane: deploy gitlab on a hosted runner and assert (a)-(f) live

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3VKM164087G0R001RJFB2Z-*.md` glob. -->

## Why

GitLab was repaired on paper four times (#17711, #17737, #17763, #17796) and no CI lane had ever
deployed it. The WP11 installed-disk guest excludes `gitlab/**`; the shared kind lanes exclude it.
Every one of those fixes was a claim about a running system that nothing had run.

## What landed

`.github/workflows/gitlab-live-proof.yml` + `src/Core.TypeScript/cluster/gitlab-live-proof.ts`
(+ `.test.ts`): kind + the shipped Cilium + ArgoCD + SeaweedFS + the installer's own
`cilium-lb-ipam-pool` Application + the committed `gitlab` Application on ONE hosted ubuntu-24.04
runner, asserting (a)-(f) as separately named checks that each end `passed` / `failed` /
`did-not-run` (never a pass for a check whose prerequisite failed). Dispatch, weekly, and on a
path-filtered PR.

## Measured (GitHub Actions, public repo, standard runner)

| run | what it showed |
| --- | --- |
| 36855715576 | (a) five components Ready in 214 s; (f) Gateway Programmed at the pinned address and the external URL + `/v2/` answering from the runner host. Then: no runner token Job, no runner Deployment -- Application `OutOfSync/Degraded` |
| 36860368378 | metrics API installed (kind has none, k3s does): HPAs no longer Degraded, token Job completed, glrt- Secret, runner online. Pipeline failed with zero jobs: the lane's own `.gitlab-ci.yml` had a one-key YAML mapping in `script` |
| 36862429321 | every (a)-(f) check passed, inline address pin, 797 s |
| 36865265497 | production pin path (lb-pool Application + Job `gitlab-lan-address`): lane defect, lb-ipam is not in the served tree |
| 36871713092 | pin Job completed and patched all three leaves -- and the Application sat on `waiting for healthy state of Gateway/gitlab-lan` for 30+ min; **runner never created** |
| 36878157147 | exposure objects in wave 20: runner chain passes on the production path |
| 36881451548 | second sync stalled: sidekiq surge pod `Pending: Insufficient cpu` (3160m of 4000m requested) |
| 36951220893 | stable migrations Job name: an operation rendered with the sentinel before the pin landed reached wave 20 and waited 27 min on `Gateway/gitlab-lan` -- earlier passes had been rescued by an unrelated retry |
| 36955944272 | a gate Job failing the operation so ArgoCD retries FAILED on all eight retries: a retry re-renders from the source the operation STARTED with, not the patched Application |
| 36886512326 | maxSurge 0: **every blocking check passed on the production pin path**; peak 7.0 GiB memory used (9.0 GiB available), 13 GiB disk, load 5.1 |

## Defects found and fixed (each with an offline falsifier that fails without the fix)

1. Exposure Gateway/HTTPRoutes in sync-wave 0 held the token Job and the runner forever
   (the pin lands after ArgoCD's first sync). Wave 20 and a stale-render gate were both measured NOT to fix it (stale operations keep the
   sentinel they started with); the release no longer renders exposure at all -- PostSync hook Job `gitlab-exposure` reads the LIVE
   Application's address and applies Gateway/HTTPRoutes. `gitlab-exposure.test.ts` (a)(c)(f), the hook EXECUTED against a stub kubectl.
2. Default rolling-update surge needs a spare pod of CPU a single node lacks, and a fresh
   install rolls every Deployment once (the pin re-render) -> `maxSurge 0` on every Deployment.
   `gitlab-exposure.test.ts` (g).
3. Lane: kind has no `metrics.k8s.io` -> the chart's HPAs read Degraded in wave 0. The lane
   installs metrics-server (k3s ships it on metal).
4. Lane: the proof's own pipeline file was invalid YAML-as-GitLab-reads-it (`ciScriptProblems`).

## Still true / not proven

- ~~After the pin the chart renames its migrations Job and `prune: false` leaves the first one
  behind, so a healthy install reads `OutOfSync` forever.~~ FIXED (owner measured it on the real
  node: two Completed migrations pods): `global.job.nameSuffixOverride: zeta` + `Force=true,Replace=true`
  on the Job + PostSync Job `gitlab-migrations-gc`; lane checks a6/a7 are blocking.
- Not exercised: GitLab's own TLS/public-domain path (`platform-public-tls`), `docker push` to
  the registry, GitLab upgrade (8.7.0 -> 10.x), real metal (NixOS k3s, Longhorn, real L2 LAN).
  The host-reachability check proves the Cilium L2 announcement over the docker bridge, not a
  physical LAN.
- Larger hosted runners could not be queried (org admin scope); the standard runner suffices.
