# Can GitLab, Temporal and Hindsight use `postgres-shared`?

Investigated 2026-10-01 against `main` and CloudNativePG 1.30. Nothing here is implemented; this
is the finding, with what each consumer would need, so the decision can be made on facts.

## What exists to build on

- **`Database` CR** (`postgresql.cnpg.io/v1`): a database, its owner, `databaseReclaimPolicy`, and
  `extensions: [{name, ensure}]`, all declarative. `temporal/postgres/database.yaml` already uses it
  (the `temporal_visibility` database with `btree_gin`). The **operator** runs `CREATE EXTENSION`
  as superuser, so an application never needs superuser and `enableSuperuserAccess` stays `false`.
  That matters: of GitLab's required extensions, `amcheck` is not a "trusted" extension and a
  database owner cannot create it.
- **Declarative roles** (`declarative_role_management.md`, v1.30): a role with a `passwordSecret`,
  reconciled by the operator.
- **One hard constraint, stated in that same document:** the role resource, the `Cluster` it names
  and the `passwordSecret` it consumes **must all live in the same namespace**. `Database` CRs are
  namespaced the same way. So every consumer's credential is born in `postgres-shared`, and a pod in
  `gitlab`, `temporal` or `hindsight` cannot mount it. This is the real obstacle for all three, more
  than anything about Postgres itself.

## The cross-namespace credential: the one thing to decide first

A consumer in another namespace needs a copy of its own Secret. Candidates, none of them built here:

1. `external-secrets` (already in the tree) with a Kubernetes-provider `SecretStore` reading from
   `postgres-shared` and writing into the consumer namespace. Keeps one source; adds a dependency edge
   and a failure mode (a consumer that cannot start until the sync lands).
2. Mint the password in the **consumer's** namespace (the `internal-secret-seeding.yaml` pattern) and
   have the role in `postgres-shared` read a copy of it. Two copies that can diverge, which
   `temporal/postgres/cluster.yaml` already names as the reason it does not do this.
3. A `Database` + role per consumer **inside the consumer's namespace** against a Cluster in that
   namespace: that is simply "one Cluster per application", which is what exists today.

## Per consumer

> **GitLab, 2026-10-02:** no longer on the bundled subchart. It moved (with the 17.7 -> 19.4 upgrade, `docs/ops/GITLAB-UPGRADE.md`) to a
> DEDICATED CloudNativePG Cluster `gitlab-rails-db` (PostgreSQL 17.11) and a dedicated Valkey 7.2 declared in the gitlab release's own
> `extraObjects` -- option 3 below ("one Cluster per application"), not a tenancy on `postgres-shared`, so a GitLab migration cannot contend
> with the flowdent databases. It is NOT WAL-archived yet; the GitLab backup is its backup. The GitLab row below is the older analysis.

| consumer | today | on `postgres-shared` | blocker or cost |
| --- | --- | --- | --- |
| **GitLab** | bundled `bitnamilegacy/postgresql:14.8.0` subchart (no backup, no HA) | `global.psql.{host,port,database,username,password.secret}` with `postgresql.install: false`; a `Database` CR for `gitlabhq_production` with `pg_trgm`, `btree_gist`, `plpgsql`, `amcheck`; the 17.x major GitLab 19 needs is the image already in use | the credential copy above; `max_connections: "100"` is below GitLab's guidance, so it would be raised; GitLab gains point-in-time recovery it does not have at all today. Largest single win of the three |
| **Temporal** | its own `temporal-postgres` Cluster + `Database` CR + own backup prefix | two `Database` CRs and a role in `postgres-shared` | **technically easy, and not recommended while the shared Cluster is one failure domain.** Temporal's durable-execution history exists nowhere else; sharing a Cluster couples its blast radius to every other tenant. Revisit once the shared Cluster spans three nodes. The saving is one 512Mi instance and one 20Gi PVC |
| **Hindsight** | the chart's own StatefulSet on `pgvector/pgvector:pg17-trixie` | external mode needs `postgresql.enabled: false` plus `postgresql.external.*` and `postgres-password` in the **release-wide** `existingSecret` (the same Secret that holds its LLM key) | needs the `vector` extension, and `postgres-shared` runs the `minimal` image, which has no pgvector. CNPG's image-volume extensions need **PostgreSQL 18** (`extension_control_path`), and GitLab pins PostgreSQL 17, so they are not an answer on this Cluster. The `standard` image (`17.x-standard-trixie`) carries pgvector, but changing the shared image breaks the "one PostgreSQL image for every CNPG consumer" rule and enlarges every tenant's image. Better: a small dedicated Cluster for hindsight on `standard`, with backup, not `postgres-shared` |

## Recommendation

1. **GitLab first**, once the cross-namespace credential mechanism is chosen: it replaces an
   unbacked-up 14.8 database with a backed-up 17.x one and removes a bitnami-legacy image.
2. **Temporal stays on its own Cluster** until `postgres-shared` has three nodes' worth of replicas.
3. **Hindsight gets its own pgvector Cluster**, not a tenancy on the shared one.

The shared Cluster is deliberately optional to exit (`Application.yaml` header): nothing depends on
it today. Moving GitLab onto it would be the first dependency, so that change should state that
the hub objection has been weighed, not assume it.
