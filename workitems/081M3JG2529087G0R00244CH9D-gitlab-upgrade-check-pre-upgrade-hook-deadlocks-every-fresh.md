---
id: 081M3JG2529087G0R00244CH9D
type: bug
state: backlog
priority: P2
slug: gitlab-upgrade-check-pre-upgrade-hook-deadlocks-every-fresh
title: "gitlab upgrade-check pre-upgrade hook deadlocks every fresh ArgoCD install"
created: 2026-09-27T22:34:08.329Z
depends_on: []
composes_with: []
---

# gitlab upgrade-check pre-upgrade hook deadlocks every fresh ArgoCD install

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JG2529087G0R00244CH9D-*.md` glob. -->

## Evidence

Fresh bare-metal install (2026-09-27): ArgoCD app `gitlab` stuck OutOfSync/Missing; Job
`gitlab-gitlab-upgrade-check` Failed (BackoffLimitExceeded), log: "Please follow the upgrade
documentation at https://docs.gitlab.com/ee/update/#upgrade-paths". Also CI run 36221053730
("waiting for completion of hook batch/Job/gitlab-gitlab-upgrade-check").

## Root cause

gitlab chart 8.7.0's upgrade check is a `helm.sh/hook: pre-upgrade` Job that reads the NON-hook
ConfigMap `gitlab-gitlab-chart-info` and exits 1 when it is absent. ArgoCD maps pre-upgrade onto
PreSync, which runs on the first sync before chart-info exists; the failed hook blocks Sync, so
chart-info is never created. Deadlock on every fresh install.

## Fix

`upgradeCheck.enabled: false` in `full-ai-cluster/k8s/applications/gitlab/Application.yaml`,
falsifier `src/Core.TypeScript/cluster/upgrade-only-hook-first-sync.test.ts`.
