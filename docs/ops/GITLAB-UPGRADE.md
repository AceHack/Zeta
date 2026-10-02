# GitLab upgrade: 17.7.0 to 19.4.1, one required stop at a time

> **Carved sentence.** GitLab is upgraded along its required stops, and a hop is finished only when its batched
> background migrations are finished -- never when its pods are Ready. The database leaves the bundled
> PostgreSQL/Redis **before** the hop that removes them. Migrations are not reversible, so the rollback for a failed hop
> *after* migrations ran is the backup, not a revert.

Work item `081M3YTRTDE087G0R001GHTZC9` (the earlier plan-only item is `081M1PZA3TF087G0R002VKM8RJ`). Chart pin and values:
`full-ai-cluster/k8s/applications/gitlab/Application.yaml`. **Done 2026-10-02: GitLab 19.4.1 (chart 10.4.1) on PostgreSQL 17.11
(CloudNativePG) and Valkey 7.2.14; every one of the 337 batched background migrations finished.**

## The required path (Beacon: the official sources, not this file)

Stops are `X.2 / X.5 / X.8 / X.11` since 17.5 (`config/upgrade_path.yml` in `gitlab-org/gitlab`,
<https://docs.gitlab.com/update/upgrade_paths/>). The chart's own `runcheck` refuses a skipped stop and the PR-time guard
`src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.ts` runs it against the previous pin.

| hop | GitLab | chart | why this patch | how it shipped |
|----|--------|-------|----------------|----------------|
| 1  | 17.8.7  | 8.8.7  | 17.8.0-17.8.6 can empty `ci_runner_taggings` (issue 524402); this instance's runner has tags | PR 17868 |
| 2  | 17.11.7 | 8.11.8 | 17.11.0-17.11.2 have a CPU-heavy migration (issue 537325) | PR 17871 |
| M  | 17.11.7 | 8.11.8 | bundled PostgreSQL 14 / Redis 6 -> **PostgreSQL 17 + Valkey 7.2** | PR 17875 (objects) + live cut-over |
| 3  | 18.2.8  | 9.2.8  | newest 18.2 (18.2.6+ fixes push errors while upgrading); needs PostgreSQL >= 16.5 | live |
| 4  | 18.5.7  | 9.5.7  | newest 18.5; `amcheck` extension (created at initdb) | live |
| 5  | 18.8.11 | 9.8.12 | newest 18.8 (18.8.0 skipped single-row batched migrations) | live |
| 6  | 18.11.12 | 9.11.13 | newest 18.11 | live |
| 7  | 19.2.7  | 10.2.7 | newest 19.2; PostgreSQL 17 required; bundled PG/Redis/MinIO removed from the chart | live |
| 8  | 19.4.1  | 10.4.1 | newest release (19.5 is the next stop, 19.4 is not one) | live |

"live" = the chart pin and values were changed on the cluster's `gitlab` Application itself (see *GitOps during the
fast path*), then ONE PR made git equal live.

## Why PostgreSQL and Redis moved before 18.x, and why to PostgreSQL 17

| fact | source |
|------|--------|
| 18.x needs PostgreSQL 16.5-17; 19.x needs 17-18; 17.x tops out at 16 but 17 is *tested from 17.10* | <https://docs.gitlab.com/install/requirements/> |
| Chart 9.0 (GitLab 18.0) dropped PostgreSQL 14/15 | chart `doc/releases/9_0.md` |
| Chart 10.0 (GitLab 19.0) removed the bundled PostgreSQL, Redis and MinIO "with no replacement" | chart `doc/releases/10_0.md`, `doc/installation/migration/bundled_chart_migration.md` |
| Redis 6 support removed in 19.0 (Redis 7.0+ or Valkey 7.2) | GitLab 19 upgrade notes |

The bundled instance was PostgreSQL **14.8** (an archived `bitnamilegacy` image) and Redis **6.2.16**. One move to
PostgreSQL 17 at the 17.11 stop satisfies 18.x and 19.x at once; the database was 109 MB, so the move is a dump/restore.
Both are DEDICATED and live in the release's own object list (`gitlab-runner.extraObjects`, wave -2): CNPG `Cluster
gitlab-rails-db` (one instance, `ghcr.io/cloudnative-pg/postgresql:17.11-minimal-trixie`, `C.UTF-8`, `pg_trgm`/`btree_gist`/
`amcheck` created at initdb) and StatefulSet `gitlab-valkey` (7.2.14, `volatile-lru`, AOF), so a GitLab migration cannot
contend with `flowdent_prod`/`flowdent_staging` and Sidekiq cannot meet another tenant's eviction policy. **Not backed up by WAL
archiving** (that needs a per-namespace S3 credential this release does not have): GitLab's own backup is the backup.

## Backups -- kept off the repo

Preservation root (rule `preservation-has-one-namespace-per-kind`): `~/.zeta/backups/2026-10-02-gitlab-upgrade/` (7.5 GB).
Each backup holds `gitlab-namespace-secrets.yaml` (every Secret; the Rails secrets are what a restore cannot do without),
`gitlabhq_production.dump` (`pg_dump -Fc`), `<tag>_gitlab_backup.tar` (`backup-utility`: DB + every repository bundle), and, for
the full ones, `seaweedfs-artifacts-and-registry.tar` (the artifact and registry buckets, which `backup-utility` does not reach
here). Taken: `pre-upgrade-17.7.0` (original names), `pre-hop3-17.11.7` (full), `pre-hop5/6/8` (DB + secrets),
`pre-hop7-18.11.12` (full), `post-upgrade-19.4.1` (full). The first dump was restored into a scratch database and the 17.11 dump
into the new PostgreSQL 17 (counts equal) before being relied on.

**Gaps found, not fixed here:** (1) the toolbox's default `backup-utility` S3 config pointed at the removed MinIO host, so object
components skipped; chart 10 forces a backup secret, and Job `gitlab-backup-s3cmd` now derives one from `zeta-blob-store`.
(2) SeaweedFS answered every PUT into a NEW bucket with 500 (see *Findings*), so uploading the tar to `gitlab-backups` failed at
the time; the tar stays in the toolbox and was streamed out by hand.

## GitOps during the fast path (and what it was NOT)

ArgoCD tracks `main`, one PR per hop took ~50 minutes of CI each, so from **20:42:53Z** the pin and values of the live `gitlab`
Application were changed directly. `zeta-root` (selfHeal on) would revert a spec patch, so its `ignoreDifferences` for
Application `gitlab` was extended with `/spec/source/targetRevision` and `/spec/source/helm/valuesObject`. Nothing else was
paused: auto-sync and selfHeal stayed ON for every Application including `gitlab`; the child synced each patch like any other
change. Proven before relying on it: a probe key written to the live Application survived two minutes of root reconciliation.
Risk accepted and stated: if `zeta-root` is re-applied from its k3s manifest (node reboot with a changed file) the pointers vanish
and root reverts `gitlab` to git -- the reason git was made to equal live as soon as the last hop was verified. At **23:08Z** the
same mechanism was used once for `seaweedfs` (`.../valuesObject/volume`). Both extra pointer sets are removed after the PR that
makes git equal live merges.

## Per-hop procedure that was followed

1. No pipeline running; node not under DiskPressure; imagefs free recorded (`/api/v1/nodes/<node>/proxy/stats/summary`).
2. A fresh database dump (a full backup before the two riskiest, 17.11 -> 18 and 18.11 -> 19).
3. Patch the live Application (`targetRevision`, plus the values the hop needs); wait for `Synced Healthy` and the migrations Job.
4. `gitlab-rake gitlab:background_migrations:status` shows no `active`/`paused`/`failed` row (`finished` or `finalized` only).
   **The next hop was not started before that**, every time.
5. `/-/readiness?all=1`, `/api/v4/version`, 9 projects in `flowdent` with every default-branch SHA equal to the baseline **or a
   descendant of it** (`fd-core` received pushes during the work), `git clone` of `fd-core`, manifest + largest blob of
   `flowdent/fd-core:080237f3` through `registry.flowdent.net` with the digest verified, a blob+manifest PUSH and read-back
   (from 19.x on this exercises the new `s3_v2` registry driver), and a throwaway pipeline on the Kubernetes-executor runner.
   `docker login` was deliberately not run (no credential written to the workstation).

## Measured log (2026-10-02, UTC, node `node-5b2dfa`: one k3s node, 119 GiB root disk)

| step | start -> Healthy | batched migrations finished | notes |
|------|------------------|-----------------------------|-------|
| 1  17.7.0 -> 17.8.7  | 18:2x, ~3 min | ~10 min | migrations Job 74 s; runner tags intact |
| 2  17.8.7 -> 17.11.7 | 19:3x, ~3 min | ~25 min | bundled Redis went 6.2.16 -> 7.2.4 in place |
| M  cut-over to PG17 + Valkey | quiesce 20:45:30, patch 20:46:28, back 20:48:25 | none pending | **~3 min of downtime**; counts equal (projects, users, pipelines, builds, MRs, notes, schema_migrations, max version) |
| 3  -> 18.2.8  | ~20:50 -> 21:01:45 | 21:13:24 | DiskPressure ~20:56, 23 toolbox pods evicted (cleaned up) |
| 4  -> 18.5.7  | 21:14:05 -> 21:17:31 | 21:38:21 | |
| 5  -> 18.8.11 | 21:38:56 -> 21:42:24 | 22:08:27 | |
| 6  -> 18.11.12 | 22:09:12 -> 22:16:47 | 22:29:06 | DiskPressure ~22:10-22:15, nothing evicted; no CheckViolation |
| 7  -> 19.2.7  | 22:33:39 -> 22:37:27 | 22:53:08 | chart 10 values; registry push OK on `s3_v2` |
| 8  -> 19.4.1  | 22:53:47 -> 23:01:21 | 23:10:12 | all 337 migrations finished |

Final state verified at 19.4.1: readiness, version, login page, 9 projects with SHAs equal-or-descendant, clone, registry pull and
push, runner pipeline, `pg_dump` 18.6 in the toolbox against PostgreSQL 17 (backups work), `gitlab-backup-s3cmd` Job ran.

## Findings (each one was measured, none assumed)

1. **SeaweedFS ran out of volume slots, and GitLab 19.x found out on the home page.** `-volume.max=0` (auto) sized the one volume
   server at 40 slots at start; the 6 collections already present had pre-grown 7 volumes each (6 x 7 = 40 used). A NEW bucket
   (`gitlab-uploads`, `gitlab-backups`, ...) therefore got `Not enough data nodes found` and every PUT/GET 500'd. 19.x creates the
   `GitLabDuo` bot user on `GET /` for a signed-in user and uploads its avatar: **`GET /` returned HTTP 500 for the logged-in owner
   while the anonymous sign-in page and `/-/readiness` stayed green.** Fixed at 23:08Z by an explicit `-volume.max=100`
   (SeaweedFS chart: `volume.dataDirs[0].maxVolumes`; the pod restarted once, ~80 s); the bot was re-created with its avatar
   (user 17; ids 9-16 were rolled-back attempts). Add an authenticated page load to any future post-hop check.
2. **Image pulls push the node under DiskPressure** when imagefs free falls below ~17.7 GiB; the kubelet evicts new pods until its
   image GC catches up. Two of the eight hops did it (above). Check free space first; the kubelet's own GC restored 30+ GiB each
   time. A node this size should prune unused images before a hop.
3. The chart-render determinism check has a 1-in-36 flake (`...test-runner-i*`); a lane check (`live kind included`) failed once with
   a packed-tree size that does not reproduce locally and passed on re-run.
4. Chart 9.3+ renamed `certmanager.install` to `installCertmanager`; chart 10 needs `global.gatewayApi.{enabled,installEnvoy,
   configureCertmanager}: false` (this cluster exposes GitLab through its own Cilium Gateway) and a backup object-storage secret.
5. Test pins that followed the chart: the `reason-truth` citations and the `inert-valuesobject-keys` schema snapshot move with the
   pin; the guard test's fixtures are now frozen at 8.7.0; the chart's docs link in its upgrade-check message changed twice.

## Rollback

- **Before migrations ran** (pods never came up on the new version): patch the Application back (or revert the PR) -- images are
  still on the node until GC.
- **After migrations ran** (any hop): migrations are not reversible. Scale `webservice`/`sidekiq`/`toolbox` to 0, restore the
  previous version's `gitlabhq_production.dump` into the CNPG database (drop and recreate it, create `pg_trgm btree_gist amcheck`
  as superuser, `pg_restore --no-owner --role=gitlab`; ~20 s), pin the previous chart, sync, scale up. The saved Rails secrets must be
  the ones in use. Anything written after that dump is lost.
- **Datastore cut-over only:** the bundled PostgreSQL/Redis PVCs (`data-gitlab-postgresql-0`, `redis-data-gitlab-redis-master-0`)
  are KEPT, with the pre-cut-over data, as the rollback copy; their StatefulSets were stopped, not their volumes deleted.

## What is deliberately NOT here

KAS and the Kubernetes agent (`global.kas.enabled: false`) and Auto DevOps are a separate step. What they need: `global.kas.enabled:
true`; a route for `kas` (Gateway `gitlab-lan` serves only `/` and `/v2/`; 19.5+ advertises `grpcs://`, which needs HTTP/2 end to
end, or set `global.appConfig.gitlab_kas.externalUrl`); a cluster-agent token; the agent installed in the target cluster; and a
registry/cluster domain Auto DevOps can use.
