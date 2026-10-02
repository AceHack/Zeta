# GitLab upgrade: 17.7.0 to 19.x, one required stop at a time

> **Carved sentence.** GitLab is upgraded along its required stops, one chart bump per PR, and a hop is
> finished only when its background migrations are finished -- never when its pods are Ready. The
> database moves off the bundled PostgreSQL/Redis **before** the hop that removes them. Migrations are not
> reversible, so the rollback for a failed hop *after* migrations ran is the backup, not a revert.

Work item `081M3YTRTDE087G0R001GHTZC9` (the earlier plan-only item is `081M1PZA3TF087G0R002VKM8RJ`).
Chart pin: `full-ai-cluster/k8s/applications/gitlab/Application.yaml` (`targetRevision`). ArgoCD tracks
`main`, so a hop ships by PR -> merge -> ArgoCD sync. The PR-time guard
`src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.ts` (job `charts` in `helm-validate.yml`) runs the
chart's **own** upgrade check against the previous pin and fails a PR that skips a stop or downgrades.

## The required path (Beacon: the official sources, not this file)

Stops are `X.2 / X.5 / X.8 / X.11` since 17.5 (`config/upgrade_path.yml` in `gitlab-org/gitlab`,
<https://docs.gitlab.com/update/upgrade_paths/>). Patch levels are the newest **at the time of the hop**
and were chosen for a reason where one is listed.

| hop | GitLab | chart | why this patch | what the hop needs |
|----|--------|-------|----------------|--------------------|
| 0  | 17.7.0 (start) | 8.7.0 | -- | backup first (below) |
| 1  | 17.8.7  | 8.8.7  | 17.8.0-17.8.6 can empty `ci_runner_taggings` (issue 524402); fixed 17.8.7 | none beyond the hop checks |
| 2  | 17.11.7 | 8.11.8 | 17.11 < 17.11.3 has a long-running migration (issue 537325) | none |
| M  | (stays 17.11.7) | 8.11.8 | -- | **bundled PostgreSQL 14 / Redis 6 -> external PG 17 + Valkey** (next section) |
| 3  | 18.2.8  | 9.2.8  | newest 18.2; 18.2.6+ fixes push errors during the 18.1->18.2 upgrade | PostgreSQL >= 16.5 (18.0 dropped 14/15) |
| 4  | 18.5.7  | 9.5.7  | newest 18.5 | `amcheck` extension (chart 9.4 note) |
| 5  | 18.8.11 | 9.8.12 | newest 18.8; 18.8.0 silently skipped single-row batched migrations | none |
| 6  | 18.11.12 | 9.11.13 | newest 18.11 | none |
| 7  | 19.2.7  | 10.2.7 | newest 19.2; 19.2.0-19.2.5 need a SHA param on MR API | PostgreSQL 17 (19.0 dropped 16); bundled PG/Redis/MinIO **removed**; NGINX Ingress off by default |
| 8  | 19.4.1  | 10.4.1 | newest release; 19.5 is a stop, 19.4 is not | none |

## Why PostgreSQL and Redis move before 18.x, and why to PostgreSQL 17

| fact | source |
|------|--------|
| 18.x needs PostgreSQL 16.5-17; 19.x needs 17-18; 17.x tops out at 16 but 17 is *tested from 17.10* | <https://docs.gitlab.com/install/requirements/> |
| Chart 9.0 (GitLab 18.0) dropped PG 14/15 support | chart `doc/releases/9_0.md` |
| Chart 10.0 (GitLab 19.0) removed the bundled PostgreSQL, Redis and MinIO "with no replacement" | chart `doc/releases/10_0.md`, `doc/installation/migration/bundled_chart_migration.md` |
| Redis 6 support removed in 19.0 (Redis 7.0+ or Valkey 7.2) | GitLab 19 upgrade notes |

The bundled instance was PostgreSQL **14.8** (an archived `bitnamilegacy` image) and Redis **6.2.16**, so
both had to leave. One move to **PostgreSQL 17** at 17.11 satisfies 18.x and 19.x at once; the alternative
(PG 16 now, PG 17 before 19) is two database moves for one problem. 17.11 is the first stop at which GitLab's
own CI tests PostgreSQL 17 (17.10+). The database was 109 MB, so the move is a dump/restore, not a project.

Target topology (all in namespace `gitlab`; nothing shared is touched):

- a dedicated CloudNativePG `Cluster` (the operator already runs cluster-wide) rather than a database in the
  shared `postgres-shared`, so a GitLab migration can never contend with `flowdent_prod`/`flowdent_staging`;
- a dedicated Valkey rather than the shared `redis` one: Sidekiq queues and sessions live there, and an
  eviction policy chosen for another tenant would silently drop jobs.

## Backup -- taken BEFORE hop 1, verified, and kept off the repo

Preservation root (rule `preservation-has-one-namespace-per-kind`): `~/.zeta/backups/2026-10-02-gitlab-upgrade/`.

| artifact | what | verified by |
|----------|------|-------------|
| `secrets/gitlab-namespace-secrets.yaml` | every Secret in `gitlab` (the Rails secrets `gitlab-rails-secret` etc.; **without them a restore is impossible**) | parsed; rails secret holds all 8 keys |
| `gitlabhq_production-pg14.dump` | `pg_dump -Fc` of the database | restored into a scratch DB; project/user/pipeline/migration counts equal the live ones |
| `pre-upgrade-17.7.0_gitlab_backup.tar` | `backup-utility` (DB + all 9 repository bundles) | listed; 9 bundles + `db/database.sql.gz` |
| `seaweedfs-gitlab-artifacts-and-registry.tar` | the artifact and registry buckets (object storage is not covered by the tar above here) | listed |
| `baseline-*.txt`, `application-gitlab-live-before.yaml`, `gitlab-namespace-objects-before.yaml` | project heads, registry tags, live Application and objects | -- |

**Gap found while taking it:** the toolbox's default `backup-utility` S3 config points at the chart's
bundled MinIO host and cannot reach SeaweedFS; the object-storage components therefore skipped
("Bucket not found") and `--skip registry` was needed because the toolbox's registry bucket name is
`registry`, not `gitlab-registry`. Hence the separate bucket copy. A recurring backup needs
`gitlab.toolbox.backups.objectStorage.config` pointed at SeaweedFS -- not done here.

## Per-hop procedure (a hop is not done until every line holds)

1. No pipeline running (`GET /api/v4/projects/6/pipelines?status=running`), node not under DiskPressure,
   `imagefs` free >= 20 GiB (`kubectl get --raw /api/v1/nodes/<node>/proxy/stats/summary`).
2. PR changes `targetRevision` (+ values the hop needs). The guard must print `PASSED`.
3. After merge: `kubectl -n argocd annotate application zeta-root platform argocd.argoproj.io/refresh=hard --overwrite`.
4. Wait for `job/gitlab-migrations-zeta` Complete, then **all batched background migrations finished**:
   `gitlab-rake gitlab:background_migrations:status` shows no `active`/`paused`/`failed` rows
   (post-deployment migrations run in the same Job; batched ones keep running after it).
5. Health: `/-/readiness`, `/api/v4/version`, project count + default-branch SHAs equal the baseline,
   `git clone` of `fd-core`, a throwaway pipeline picked up by the runner, `docker pull` of
   `registry.flowdent.net/flowdent/fd-core:080237f3`.
6. Only then open the next hop's PR.

## Rollback

- **Before migrations ran** (the pods never came up on the new version): revert the PR; ArgoCD re-syncs the
  previous chart. The previous images are still on the node.
- **After migrations ran** (any hop's `gitlab-migrations-zeta` completed): migrations are not reversible.
  Restore the backup of the *previous* version: scale `webservice`/`sidekiq` to 0, restore the database
  from `gitlabhq_production-pg14.dump` (or the hop's own dump), pin the previous chart, sync. The
  Rails secrets must be the saved ones.
- Never `DROP DATABASE`, delete a PVC or the `gitlab` namespace without a verified backup of the version
  being restored.

## What is deliberately NOT here

KAS and the Kubernetes agent (`global.kas.enabled: false`) and Auto DevOps are a separate step. What it
needs: `global.kas.enabled: true`, a route for `kas` (Gateway `gitlab-lan` serves only `/` and `/v2/`;
KAS needs gRPC/websocket on its own host or path -- 19.5's default advertises `grpcs://`, which needs
HTTP/2 end to end), a cluster-agent token, and the agent installed in the target cluster.

## Measured log

Everything below was measured on the owner's node (`node-5b2dfa`, one k3s node, 119 GiB root disk) on 2026-10-02.

### Hop 1 -- 17.7.0 -> 17.8.7 (chart 8.7.0 -> 8.8.7), merged as PR 17868

- ArgoCD synced ~1 minute after the refresh; shared-secrets Jobs, then `gitlab-migrations-zeta` (**74 s**), every
  component Ready in ~2 minutes. Total user-visible GitLab downtime: about 3 minutes.
- `/api/v4/version` = `17.8.7`; 9 projects and all 9 default-branch SHAs equal the pre-upgrade baseline.
- Batched background migrations (rake `gitlab:background_migrations:status`): 7 `active` right after the Job,
  **all `finished` about 10 minutes later**; the next hop was not started before that.
- The runner kept its tags (`kubernetes`, `zeta-cluster`) and its token: the reason 17.8.7 was chosen over 17.8.0.
- Registry: manifest and the largest blob of `flowdent/fd-core:080237f3` fetched through `registry.flowdent.net`
  with a bearer token and the digest verified (this is what `docker pull` does; `docker login` was deliberately not
  run, so no credential was written to the workstation's docker config). A throwaway pipeline (project
  `zz-upgrade-probe`, kept for the later hops) succeeded on the Kubernetes-executor runner in 10 s.
- Node disk: free space fell 26 -> 19 GiB while both image sets were present (eviction starts below ~17.7 GiB),
  then recovered to 33 GiB once the kubelet collected the unused 17.7.0 images. Check free space before each hop.
- Chart 8.8.7 no longer renders the duplicate gitaly `TZ` env that 8.7.0 did (a test pinned that defect; fixed).
- Gaps found in the repo's own ledgers by the first CI run: the `reason-truth` citations of the chart pin and the
  `inert-valuesobject-keys` schema snapshot both follow the pin and are re-done each hop. The chart-render
  determinism check has a latent 1-in-36 flake (its wildcard keeps a shared first character of a random suffix:
  `...test-runner-i*`); a re-run clears it.
