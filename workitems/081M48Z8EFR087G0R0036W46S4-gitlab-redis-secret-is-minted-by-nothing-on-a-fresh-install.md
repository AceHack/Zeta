---
id: 081M48Z8EFR087G0R0036W46S4
type: bug
state: backlog
priority: P1
slug: gitlab-redis-secret-is-minted-by-nothing-on-a-fresh-install
title: "gitlab-redis-secret is minted by nothing on a fresh install: chart 10.4.1 shared-secrets has no redis branch, so Valkey (wave -2) never starts and gitlab-live-proof stalls at wave -2"
created: 2026-10-06T16:03:00.728Z
depends_on: []
composes_with: ["081M3VKM164087G0R001RJFB2Z"]
---

# gitlab-redis-secret is minted by nothing on a fresh install: chart 10.4.1 shared-secrets has no redis branch, so Valkey (wave -2) never starts and gitlab-live-proof stalls at wave -2

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M48Z8EFR087G0R0036W46S4-*.md` glob. -->

## Observed (shadow, PR sweep 2026-10-06)

`gitlab-live-proof` (kind + Cilium) is **NOT PROVEN** the same way in both runs read here — scheduled
run 37268639567 (main @ 5f944905, 2026-10-05) and PR run 37162430861 (2026-10-03), both after #17875
merged (2026-10-02T19:40Z). Not measured: whether every intervening run failed for this reason. The (a) checks report "no Deployment/StatefulSet labelled app=webservice exists yet" because
the gitlab Application's sync operation never leaves wave -2:

    operation: phase=Running message=waiting for healthy state of apps/StatefulSet/gitlab-valkey
    gitlab-valkey-0:Pending                       (every sample, 69 minutes)
    Warning  Failed  4m (x303 over 69m)  kubelet  spec.containers{valkey}: Error: secret "gitlab-redis-secret" not found

The PVC is not the cause (`data-gitlab-valkey-0` is Bound on `zeta-block-local`, as is `gitlab-rails-db-1`
whose pod is Running+ready), and the image tag exists (`valkey/valkey:7.2.14-alpine3.24`).

## Cause

`full-ai-cluster/k8s/applications/gitlab/Application.yaml` (Valkey StatefulSet + `global.redis.auth`)
reads `gitlab-redis-secret` key `secret`, with the comment *"It reuses the password the chart already
minted"*. That is true **only on the live cluster**, where the Secret is a leftover of the bundled-Redis
era. In chart **10.4.1** nothing mints it: `templates/shared-secrets/_generate_secrets.sh.tpl` contains
no `redis` branch at all (checked: `grep -i redis` over `templates/shared-secrets/` = 0 lines), while
`gitlab.redis.password.secret` is *consumed* in four templates (`charts/gitlab/templates/_redis.tpl`,
three in `charts/registry/templates/_redis.tpl`). So on any fresh install — this CI lane, a rebuilt node,
disaster recovery — Valkey can never start and the whole release stalls behind wave -2.

## Fix shape (design decision for the gitlab-upgrade owner — not taken here)

The live cluster depends on a Secret no manifest declares. Candidate shapes, none chosen:
an idempotent wave -3 Job that creates `gitlab-redis-secret` only if absent (no-op on live);
a SealedSecret; or minting it alongside the existing install-time secret Jobs. Whichever lands, the
comment at "reuses the password the chart already minted" should say what mints it.

Falsifier: `gitlab-live-proof` reaches the (a) checks (any gitlab Deployment exists) on a fresh kind cluster.

Origin: #17875 (2e324b03ab, datastores M1) / #17880. Composes with 081M3VKM164087G0R001RJFB2Z.
