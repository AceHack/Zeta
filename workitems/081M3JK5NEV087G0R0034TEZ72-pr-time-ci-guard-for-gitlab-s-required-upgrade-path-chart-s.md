---
id: 081M3JK5NEV087G0R0034TEZ72
type: task
state: backlog
priority: P2
slug: pr-time-ci-guard-for-gitlab-s-required-upgrade-path-chart-s
title: "PR-time CI guard for GitLab's required upgrade path (chart's own runcheck, run offline)"
created: 2026-09-27T23:28:29.147Z
depends_on: []
composes_with: []
---

# PR-time CI guard for GitLab's required upgrade path (chart's own runcheck, run offline)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JK5NEV087G0R0034TEZ72-*.md` glob. -->

PR #17711 disabled the gitlab chart's in-cluster `upgradeCheck` (its pre-upgrade hook
deadlocks ArgoCD's first sync). This moves the guard to the PR:
`src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.ts`, wired into
`.github/workflows/helm-validate.yml` (`charts` job). Verdict = the NEW chart's own
`runcheck`, executed offline against the OLD pin's rendered chart-info; downgrades
are refused by the guard itself (measured: the script allows them).
