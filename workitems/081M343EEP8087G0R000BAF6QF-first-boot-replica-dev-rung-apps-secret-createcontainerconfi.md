---
id: 081M343EEP8087G0R000BAF6QF
type: bug
state: backlog
priority: P1
slug: first-boot-replica-dev-rung-apps-secret-createcontainerconfi
title: "first-boot replica: dev rung apps SECRET/CreateContainerConfigError — bootstrap secrets never minted (hindsight, loki, mimir, opensearch)"
created: 2026-09-22T08:24:17.864Z
depends_on: ["081M340NKP9087G0R000F8YHXQ"]
composes_with: []
---

# first-boot replica: dev rung apps SECRET/CreateContainerConfigError — bootstrap secrets never minted (hindsight, loki, mimir, opensearch)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M343EEP8087G0R000BAF6QF-*.md` glob. -->

## Evidence

Run 35700790207 (`first-boot-replica.yml --serve-tree dev`, WP1b, PR #17495), stage 6
verdict table, `SECRET(CreateContainerConfigError)` rows:

```
hindsight  | hindsight-api-...:SECRET(CreateContainerConfigError); hindsight-control-plane-...:SECRET(CreateContainerConfigError)
loki       | loki-backend-0:SECRET; loki-read-...:SECRET; loki-write-0:SECRET
mimir      | 18 pods, all SECRET(CreateContainerConfigError)
opensearch | opensearch-cluster-master-0:SECRET(CreateContainerConfigError)
```

## Root cause (measured, not guessed)

`argocd-health-test.ts`'s kind/k3d dev-cluster bring-up (`dev-cluster/use-cases.ts`,
`bringUpKindCiCluster`/`bringUpK3dDevCluster`) mints a roster of dev/CI-only Secrets
BEFORE applying the root catalog — `DEV_BOOTSTRAP_SECRETS` / `DEV_SHARED_SECRETS` in
`dev-cluster/lib.ts` (grafana-admin-credentials, opensearch-admin-credentials,
ziti-admin-credentials, forgejo-initial-admin, the shared `zeta-blob-store` /
`hindsight-llm-api-key` / `redis-auth` groups — all visible in this run's own log as
"Rotating dev/CI credential ..." / "Dev/CI shared credential ... already present").

`first-boot-replica.ts`'s `--serve-tree` override (WP1b, this same PR) reuses
`buildLaneTreeForProfile` to serve the dev resource rung and exclude the same
directories the included lane excludes, but it does **not** call the equivalent of
`applyDevBootstrapSecretsPresent` / the Secret-minting steps `use-cases.ts` runs. Every
Application whose chart reads one of those Secrets via `existingSecret` /
`secretKeyRef` therefore gets `CreateContainerConfigError` — the Secret key the
container spec references does not exist in this cluster.

`redis` (Pending, unconverged) and `orleans` (`CrashLoopBackOff`) are very likely
downstream of the same gap — both consume the shared `redis-auth` Secret per the
included lane's own credential rotation log line ("shared credential redis-auth
already present in redis, orleans").

## Fix shape (not done here — scoping this PR to stage 6's classification/serve-tree,
not a second bring-up secrets pipeline)

Either (a) `first-boot-replica.ts` mints the same `DEV_BOOTSTRAP_SECRETS` /
`DEV_SHARED_SECRETS` roster in-cluster right after the lane-tree-serve apply (same
place the lane-tree manifests are applied, before stage 2), reusing
`dev-cluster/lib.ts`'s existing manifest builders rather than re-deriving them; or (b)
document that these four+ Applications are EXPECTED to FAIL under `--serve-tree dev`
until that pipeline is wired, and downgrade them to a named, non-blocking divergence
the same way `longhorn`/`ollama`/`vllm`/etc. already are in `ports.ts`'s
`DEFAULT_ROOT_DEV_CATALOG.excludeGlob` — whichever the maintainer decides is more
valuable: a real Healthy proof (a) or a documented, narrower stage-6 scope (b).
