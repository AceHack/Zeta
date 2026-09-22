---
id: 081M348VYZ1087G0R0002GQM11
type: task
state: in-progress
priority: P2
slug: wp15-liveness-probe-must-not-kill-startup-hindsight-crash-lo
title: "WP15: liveness probe must not kill startup (hindsight crash loop + catalog-wide audit)"
created: 2026-09-22T09:59:03.393Z
depends_on: []
composes_with: []
---

# WP15: liveness probe must not kill startup (hindsight crash loop + catalog-wide audit)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M348VYZ1087G0R0002GQM11-*.md` glob. -->

Assigned by the orchestrating architect session (human maintainer's standing request:
make the USB-installer first boot come up without crash loops). Defect measured by the
soak phase added on PR #17480: PR #17505's "live kind included" job failed with
`soak phase detected instability after the all-Healthy verdict: hindsight/hindsight-api-...
[api] restartCount 1 -> 2`, kubelet killing it on `Liveness probe failed: ... connect:
connection refused` while it was still running alembic migrations.

## Delivered

- `full-ai-cluster/k8s/applications/hindsight/Application.yaml`: `api.livenessProbe.failureThreshold`
  30 (kill budget 50s -> 320s); `api.env.HINDSIGHT_API_WORKER_ID` set to a stable literal
  (silences a real recovery-hazard warning the vectorize-io/hindsight image logs at boot);
  `controlPlane.livenessProbe.failureThreshold` 15 (50s -> 170s), found by the catalog audit
  below rather than by the measured defect.
- `src/Core.TypeScript/cluster/liveness-kill-budget.ts` (+ `.test.ts`): renders every
  Application in the catalog, flags any container with a `livenessProbe`, no `startupProbe`,
  and a kill budget under 120s. Wired into `.github/workflows/helm-validate.yml`'s `charts`
  job. First catalog run: 217 containers / 49 Applications, 46 flagged (2 fixed here --
  hindsight `api` + `controlPlane`; `postgresql` has no values coordinate to fix, chart
  hardcodes it), 44 unique (app, container) pairs grandfathered into `KILL_BUDGET_ALLOWLIST`
  pointing at 081M348H97G087G0R0020EA0NY (the follow-up work item enumerating them).

## Follow-up

081M348H97G087G0R0020EA0NY -- fix the 44 grandfathered containers, one chart at a time,
removing each `KILL_BUDGET_ALLOWLIST` entry as it's fixed.
