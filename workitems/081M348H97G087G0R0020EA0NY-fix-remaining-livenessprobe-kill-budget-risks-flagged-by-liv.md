---
id: 081M348H97G087G0R0020EA0NY
type: task
state: backlog
priority: P2
slug: fix-remaining-livenessprobe-kill-budget-risks-flagged-by-liv
title: "Fix remaining livenessProbe kill-budget risks flagged by liveness-kill-budget.ts"
created: 2026-09-22T09:53:13.456Z
depends_on: [081M348VYZ1087G0R0002GQM11]
composes_with: []
---

# Fix remaining livenessProbe kill-budget risks flagged by liveness-kill-budget.ts

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M348H97G087G0R0020EA0NY-*.md` glob. -->

## Origin

WP15 (branch `claude/liveness-must-not-kill-startup`) fixed the measured PR #17505
defect -- hindsight's `api` container being killed by its own liveness probe mid-migration
-- and then ran the new `src/Core.TypeScript/cluster/liveness-kill-budget.ts` auditor across
the whole `full-ai-cluster/k8s/applications/` catalog (`--report`). It found **45 more
containers** (217 examined, 49 Applications) that carry a `livenessProbe`, no `startupProbe`,
and a kill budget (`initialDelaySeconds + (failureThreshold-1)*periodSeconds`) under 120s --
the same shape as the hindsight defect, unproven to crash-loop in the same way but sharing
the risk. hindsight's OWN `postgresql` StatefulSet container is in this set too: its
`livenessProbe` is hardcoded in `templates/postgresql-statefulset.yaml` (no `toYaml
.Values.*` -- verified by extracting chart 0.9.2), so there is no values coordinate to fix
it from this repo at all; an upstream PR to vectorize-io/hindsight is the only route.

All 45 were added to `KILL_BUDGET_ALLOWLIST` in `liveness-kill-budget.ts` with this
work-item's id as the reason, so the CI gate (`.github/workflows/helm-validate.yml`) is
green today without a per-container investigation that was out of WP15's bounded scope --
matching this repo's own ratchet convention (`full-ai-cluster/k8s/tests/ratchet-app-failures.ts`:
a lane that is permanently red on day one is a lane people learn to skim).

## What "fixed" means, per container

For each entry below: either (a) the chart exposes a `startupProbe` key -- set one, the
kubelet-holds-liveness-until-ready mechanism, preferred; or (b) it exposes a
`*.livenessProbe` key but no `startupProbe` -- widen `failureThreshold`/`initialDelaySeconds`
the same way this PR did for hindsight's `api`/`controlPlane`, sized to the container's own
startup profile (not a blanket copy of hindsight's 320s); or (c) neither -- file upstream,
same disposition as hindsight's `postgresql`.

Remove the corresponding `KILL_BUDGET_ALLOWLIST` entry in the same PR that fixes a container
-- an allowlist entry outliving its fix is exactly the drift the audit exists to catch.

## The 45, as measured 2026-09-22 (app / kind/resource / container / kill budget)

Highest-priority first -- apps already on `liveness-kill-budget.ts`'s own
`KNOWN_SLOW_STARTERS` list (JVM/DB/migration-on-start shapes, marked with ★ in the tool's
own table output), where a short kill budget is most likely to reproduce hindsight's actual
crash loop rather than being a generically-cautious flag on a fast controller:

- `cockroachdb` StatefulSet/cockroachdb `db` -- 40s
- `gitlab` (7 containers: gitlab-exporter 20s, gitlab-gitlab-runner 80s, gitlab-shell 30s,
  kas 55s, gitlab-postgresql/metrics 55s, gitlab-postgresql/postgresql 80s,
  gitlab-redis-master/redis 40s, gitlab-registry 25s)
- `loki` (loki-canary/canary 35s, loki-gateway/exporter 50s, loki-backend/loki-sc-rules 90s)
- `mimir` Deployment/mimir-overrides-exporter `overrides-exporter` 65s
- `orleans` StatefulSet/orleans-silo `silo` 60s
- `temporal` (admin-tools 15s, temporal-web 30s -- temporal-frontend/history/matching are
  already `ok` at 170s in the same chart, so a values coordinate is proven to exist here)

Everything else (controllers, operators, webhooks, exporters -- mostly fast Go binaries whose
20-90s budgets are standard chart defaults rather than an observed crash-loop symptom, lower
priority than the group above): `argo-rollouts`, `argocd` (repo-server, server), `cdi`,
`cert-manager` (controller, webhook), `cilium` (operator, hubble-ui/frontend), `hat-system`,
`headlamp`, `headscale`, `hindsight` (postgresql -- see "no coordinate" note above), `keda`
(3 containers), `kube-prometheus-stack` (3 containers), `kubevirt`, `node-feature-discovery`
(2 containers), `ollama`, `open-policy-agent` (gatekeeper-audit, gatekeeper-controller-manager),
`sealed-secrets`, `spire` (3 containers), `tempo`.

Re-run `bun src/Core.TypeScript/cluster/liveness-kill-budget.ts --report` for the current
full table (kind/resource/container/probe-presence/kill-budget columns) rather than trusting
this list to stay in sync by hand -- the tool is the source of truth this work-item points at.
