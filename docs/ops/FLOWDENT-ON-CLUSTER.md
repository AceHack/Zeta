# Running the flowdent `fd-core` API on this cluster

Work item 081M3XNG5C6087G0R00223X96E. The application repository is `flowdent/fd-core` on the
cluster's own GitLab; its pipeline (`.gitlab-ci.yml`, branch `feat/gitlab-ci-deploy`) builds the image
and deploys it. This repository supplies what the pipeline deploys INTO, as two independent, opt-in
pieces, and **changes nothing that already runs**.

| piece | where | on by default? | what it does |
| --- | --- | --- | --- |
| public listeners | `full-ai-cluster/k8s/public-tls/` (`resources.yaml`, `argocd-application.yaml.in`) | **yes, on installs that already carry a public domain** | `api.<domain>` and `api-staging.<domain>` become Gateway listeners 5 and 6 of `zeta-public-gateway`, each with its own certificate, exactly as `git.<domain>` is listener 4 |
| tenancy | `full-ai-cluster/k8s/flowdent/` | **no** — an operator applies one Application once | namespaces, quotas, two Postgres databases + roles, the in-cluster credential Job, the GitLab deployer ServiceAccounts |

## What is, and is not, in the tree

**Public listeners — the cost, stated.** An install with a public domain gets two more HTTPS listeners
and two more cert-manager `Certificate`s that cannot issue until DNS exists for them (a missing record
costs only that name; every earlier listener already works this way). The alternative — an opt-in
overlay on the shared Gateway — was rejected: a Gateway's listeners are one object owned by one
Application, and a second owner either fights it or needs a nixos module change this repository cannot
test. The listeners carry **no route**; the HTTPRoutes ship with the app (in `fd-core/k8s/`), so until a
pipeline deploys, each listener serves nothing. **No DNS record is created, and `api.flowdent.net`
still resolves to Azure.**

**Tenancy — `flowdent-platform`.** Not under `k8s/applications/`, so the app-of-apps root never sees
it and every ledger that enumerates the default catalog is untouched (it adds no pod and no PVC that
outlives a Job; the databases live on the existing 20 Gi `postgres-shared` volume). It owns:

- namespaces `flowdent-staging` / `flowdent-prod` (`baseline` enforced, `restricted` warned) with
  ResourceQuota ceilings (cpu, memory, **ephemeral storage**, no PVC) — an **unmetered** ceiling, not a
  reservation — and two non-preempting PriorityClasses (`flowdent-prod`, `flowdent-staging`; see "The
  node's disk");
- two `Database` CRs (`flowdent_staging`, `flowdent_prod`, `databaseReclaimPolicy: retain`) and one
  plain-LOGIN **owner role each** on the shared Cluster — no superuser, `enableSuperuserAccess` stays
  `false`;
- a create-only Job that draws the two passwords from `/dev/urandom` into tmpfs and writes **both**
  copies in one act: the role's Secret in `postgres-shared` (CNPG requires the role, the Cluster and its
  `passwordSecret` in one namespace) and Secret `flowdent-db` in each app namespace (key
  `ConnectionStrings__DefaultConnection` in Npgsql format, plus `host`/`port`/`database`/`username`/
  `password`). It then registers the roles with one `kubectl patch` on `spec.managed.roles`;
- a `flowdent-deployer` ServiceAccount + namespaced Role/RoleBinding + token Secret per namespace —
  deployments, services, configmaps, jobs, PDBs, HTTPRoutes, pod reads, and Secrets only by name
  (`create` cannot be name-restricted in Kubernetes; the pull Secret alone is writable).

**Honest limits.**

- `spec.managed.roles` is a list the merge patch **replaces**. Nothing else declares one today;
  `cluster/flowdent-platform.test.ts` fails if `postgres-shared/cluster.yaml` ever gains `managed`.
- The Job is create-only and not a hook: if it stops half-way (one Secret exists, the Job is Failed),
  delete the Secrets it names and the Job and ArgoCD recreates it. Rotation is not automated.
- The connection string uses `SSL Mode=Require;Trust Server Certificate=true`: TLS is on, the CA is not
  mounted, so the server certificate is **not verified**. `VerifyFull` needs `postgres-shared-ca`'s
  `ca.crt` copied into each namespace and `Root Certificate=` set. An interim, not a finding.
- Nothing here has been applied to a live cluster by this change. What the tests prove and do not is
  in `cluster/flowdent-platform.test.ts`'s header.

## Human steps (in order)

Everything below needs cluster-admin or a Cloudflare / DNS login. None of it is done by the PR.

1. **Land the Zeta change, then opt in** (once, from a machine with `kubectl` on the cluster):

   ```bash
   kubectl apply -f full-ai-cluster/k8s/flowdent/Application.yaml
   kubectl -n argocd get application flowdent-platform          # Synced / Healthy
   kubectl -n postgres-shared get job flowdent-db-provision     # Complete 1/1
   kubectl -n postgres-shared get database.postgresql.cnpg.io   # both: applied = true
   kubectl -n postgres-shared get cluster postgres-shared -o jsonpath='{.status.managedRolesStatus.byStatus}'
   kubectl -n flowdent-staging get secret flowdent-db flowdent-deployer-token
   ```

   That the role can really log in and own its database is proven end to end by the pipeline's
   `deploy-staging-smoke` job (step 6): its `db-probe` initContainer connects with `flowdent-db` as
   `flowdent_staging`, creates and drops a table, and fails the pod otherwise. Until then the first
   five lines above are all that can be checked.

2. **Public listeners on the LIVE node.** The `platform-public-tls` Application on a running node was
   rendered at install time, so it does not have listeners 5 and 6 until it is re-rendered. Either
   rebuild the node (`nixos-rebuild switch --impure`, which re-renders it from the new template) or
   append the two patches to the live Application:

   ```bash
   D=flowdent.net   # the install's public domain
   kubectl -n argocd patch application platform-public-tls --type json -p "[
     {\"op\":\"add\",\"path\":\"/spec/source/kustomize/patches/-\",\"value\":{
       \"target\":{\"group\":\"gateway.networking.k8s.io\",\"kind\":\"Gateway\",\"name\":\"zeta-public-gateway\"},
       \"patch\":\"[{\\\"op\\\":\\\"add\\\",\\\"path\\\":\\\"/spec/listeners/5/hostname\\\",\\\"value\\\":\\\"api.$D\\\"},{\\\"op\\\":\\\"add\\\",\\\"path\\\":\\\"/spec/listeners/6/hostname\\\",\\\"value\\\":\\\"api-staging.$D\\\"}]\"}}]"
   ```

   A node rebuild later replaces this with the template's identical patch; nothing is lost.

3. **Certificates need a challenge path that works.** Port 80/443 are not reachable from the internet
   on this network, so HTTP-01 cannot pass: use the opt-in Cloudflare DNS-01 solver
   (`docs/ops/CLOUDFLARE-DNS01-CERTS.md`, PR #17857). On the node, with a Cloudflare API token that can
   edit the `flowdent.net` zone:

   ```bash
   kubectl -n cert-manager create secret generic cloudflare-api-token --from-literal=api-token='<token>'
   kubectl -n zeta-platform label gateway zeta-public-gateway zeta.io/acme-solver=dns01
   ```

   Then watch `kubectl get certificate -A` until `flowdent-api-tls` and `flowdent-api-staging-tls`
   are Ready. **Until the certificates exist, `:443` is not open on the Gateway at all** (measured from
   a CI pod: `registry.flowdent.net` and `gitlab.flowdent.net` resolve to `192.168.1.240` and refuse
   `:443`), which is why the pipeline's image push is skipped, below.

4. **Give GitLab CI the deployer tokens** (project `flowdent/fd-core` → Settings → CI/CD → Variables;
   masked **and** protected; one variable name, two environment scopes):

   ```bash
   kubectl -n flowdent-staging get secret flowdent-deployer-token -o jsonpath='{.data.token}' | base64 -d   # scope: staging*
   kubectl -n flowdent-prod    get secret flowdent-deployer-token -o jsonpath='{.data.token}' | base64 -d   # scope: production
   ```

   Variable `FLOWDENT_DEPLOYER_TOKEN`. Optional, for a private registry: `FLOWDENT_PULL_REGISTRY`,
   `FLOWDENT_PULL_USER`, `FLOWDENT_PULL_TOKEN` (a GitLab deploy token with `read_registry`).

5. **Copy the application's configuration from Azure** (needs `az login` and cluster access; prints key
   names only, never a value). Dry-run first:

   ```bash
   scripts/sync-secrets-from-azure.sh --context <zeta-kube-context> --dry-run     # in the fd-core repo
   scripts/sync-secrets-from-azure.sh --context <zeta-kube-context> --env both
   ```

6. **Prove staging with the stub, then deploy the app.** In the pipeline of `main`, run
   `deploy-staging-smoke` (manual): it serves a stub on `api-staging.flowdent.net` and fails the pod if
   the database Secret, role or database is wrong. Then `deploy-staging` (automatic) puts the real API
   there. Production is `deploy-prod` (manual).

7. **Cutover is a separate decision.** Until someone changes the `api.flowdent.net` DNS record from
   the Azure container app to the cluster's public address, production traffic does not move.

## Interim: the registry

The image is pushed to `registry.flowdent.net`. Its token realm is `https://gitlab.flowdent.net/jwt/auth`,
so BOTH names must answer on `:443` — which needs the public certificates (step 3). Until they do, the
pipeline's `probe-registry` job sees no HTTPS answer and the image is **built but not pushed**, with a
warning; `deploy-staging` then stops at `verify-image.sh` rather than deploying nothing. Set
`FLOWDENT_PUSH_IMAGE=true` to make an unreachable registry fail the build instead. A node must also be
able to PULL from the same name, so the same certificates gate the first real deploy.

## The node's disk (measured 2026-10-02, reported by the fleet coordinator)

The single node has ONE disk (root fs ~119 GiB). At 07:53Z several image-heavy pipelines ran at once
(kaniko builds, the .NET SDK image, test containers), the node crossed the kubelet's DiskPressure
threshold, tainted itself `NoSchedule`, and the kubelet evicted ~150 pods (mostly crash-looping
`hindsight` pods); CI job pods sat `Pending` on the untolerated taint, and some jobs ended in
`runner_system_failure` after the scheduling timeout. The thresholds in force, **as reported and not
re-measured by this change**: `evictionHard` `imagefs.available<15%` (~19 GiB free) and
`nodefs.available<10%`; image GC starts at 85% and targets 80%.

What this change does about it, and what it does not:

- **Pods declare ephemeral storage.** The app Deployment requests 64 Mi / limits 512 Mi (its `/tmp`
  `emptyDir` is capped at 256 Mi), and both app namespaces carry a quota on
  `requests.ephemeral-storage` / `limits.ephemeral-storage`, so a pod **cannot be created without a
  request**. Under node pressure the kubelet picks first the pods whose usage exceeds their request of
  the starved resource; a healthy pod within its request is not in that set.
- **Priority.** `flowdent-prod` (10000) and `flowdent-staging` (1000), above the default 0 that
  crash-looping workloads run at, **`preemptionPolicy: Never`**: they rank higher when pods are
  evicted but never evict a platform pod to get scheduled. `system-cluster-critical` (what
  `postgres-shared` uses) stays far above them.
- **Adds no baseline disk.** No PVC (quota `persistentvolumeclaims: 0`), no image, no always-on pod. The
  two PriorityClasses are cluster objects of a few hundred bytes.
- **The pipeline serialises its heavy jobs** (one `resource_group` for the test job and both kaniko
  builds), builds the image automatically only on `main`, tags and merge requests, and uses
  `postgres:16-alpine` for the test database service.
- **What it cannot do.** Pod-level settings do not stop *image* pulls from filling `imagefs`, and CI
  pods outside these namespaces are not governed by this quota. The structural fix is a larger or
  separate image disk, or a registry mirror/pull-through cache, which is a node decision for a human.

If DiskPressure recurs, the first thing to look at is how many `fd-core-heavy`-group jobs and other
pipelines ran concurrently, not this tenancy: nothing in it runs until a pipeline deploys.

## Removing it

`kubectl delete application flowdent-platform -n argocd` removes the objects it owns **except** what
prune-off protects: the namespaces, the `Database` CRs' data (`retain`), and the Secrets the Job made.
To drop the data, delete the `Database` CRs and the two roles from `spec.managed.roles` by hand — that
is a deliberate act, not a side effect of removal.

## Follow-ups, not done here

- **Image signing.** The GitHub workflow signed with cosign keyless (Fulcio trusting GitHub's OIDC
  issuer). Public Sigstore does not trust a self-managed GitLab's issuer, so a GitLab `id_token` plus
  cosign needs a private Sigstore or a key pair in a CI file variable. Not ported.
- **`.github/workflows` removal** is a separate, final commit in `fd-core` after the pipelines pass.
- The webapp's Azure Static Web Apps deploy (`build-and-deploy-webapp` in the old workflow) is not an
  API concern and is untouched.
- `VerifyFull` TLS to Postgres (above).
