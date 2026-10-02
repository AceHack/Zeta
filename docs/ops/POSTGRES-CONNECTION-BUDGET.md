# Postgres connection budget — staging cannot starve production

Carved sentence:

> The shared CNPG Cluster `postgres-shared` has **97 usable connection slots**
> (`max_connections` 100 minus 3 superuser-reserved). They are **budgeted, not shared**:
> each flowdent role has a hard `CONNECTION LIMIT` (prod 60, staging 20, headroom 17) and each
> fd-core pod has a smaller Npgsql pool, so that
> `(replicas + surge) x pool + health-reserve <= role limit` and
> `sum(role limits) <= 97 - headroom`. A burst on staging can use at most its own 20; it
> cannot reach the 60 prod is promised. Exhaustion is impossible by construction, and a test
> fails if the numbers stop adding up.

Source of truth: `full-ai-cluster/k8s/flowdent/database-budget.yaml` (one ConfigMap plus the Job
that applies it). Test: `src/Core.TypeScript/cluster/flowdent-platform.test.ts` section F.

## What was measured (2026-10-02)

| fact | value | how |
|---|---|---|
| `max_connections` / `superuser_reserved_connections` | 100 / 3 -> **97 usable** | `show ...` on the primary |
| role limits before | `-1` (unlimited) for `flowdent_prod`, `flowdent_staging`, `app` | `pg_roles.rolconnlimit` |
| Npgsql pool before | default `Maximum Pool Size=100` **per pod**; prod 2 pods + staging 1 = 300 potential vs 97 | connection string in Secret `flowdent-db`, masked |
| idle usage | prod 2, staging 2-3, `postgres` 1 (client backends) | `pg_stat_activity` |
| failure before | at 256 clients on staging: **120** `53300 remaining connection slots are reserved for roles with the SUPERUSER attribute` and **66** `53300 sorry, too many clients already`, all from `flowdent_staging` (postgres log, 18:17 UTC) | owner's load test; 0.41% 5xx |
| prod rollout surge | `maxSurge: 1`, `maxUnavailable: 0` -> up to **3** prod pods at once | Deployment spec |
| **`/health` bypasses the pool** | 30 sequential `/health` calls raised `pg_stat_database.sessions` by **30**; 30 calls to a pooled endpoint raised it by **1** | `pg_stat_database.sessions` before/after |

The last row is the one that was not in the brief and it changes the formula. fd-core's `/health`
(`AddDbContextCheck` -> `Database.CanConnectAsync`) opens a **new physical connection per call** and
does not draw from the Npgsql pool, so `Maximum Pool Size` does not bound it. Every in-flight `/health`
(kubelet probes, monitors, a load test where it is 10% of requests) holds one backend. That is what pushed
a single staging pod past its pool during the first after-run (11 `too many connections for role` errors
before `health-reserve` existed). The **role limit** is what bounds it; the reserve is the room left so
health checks cannot crowd the pool.

## The numbers and why

97 slots: **prod 60 + staging 20 = 80 allocated, 17 headroom** (`app` role, metrics exporter, an operator
with `psql`, a replica being re-cloned; the 3 superuser slots are outside the 97).

| env | replicas | surge | pods | pool | health-reserve | role limit | arithmetic |
|---|---|---|---|---|---|---|---|
| prod | 2 | 1 | 3 | 15 | 15 | **60** | 3 x 15 + 15 = 60 |
| staging | 1 | 1 | 2 | 8 | 4 | **20** | 2 x 8 + 4 = 20 |

- **Prod 60, not the suggested "<= 60 with pool 25":** pool 25 x 3 pods during a rolling update is 75 > 60.
  Real prod use is 2-4 connections (idle 2; 4 while two pods were starting), so pool 15 per pod is ~4x observed
  peak and cannot queue real traffic.
- **Staging 20, not "<= 15":** staging also rolls with `maxSurge: 1` (two pods for a moment), and it is the
  environment people load-test, so it is allowed the larger share of the headroom. 80 of 97 is still under the
  budget line.
- **Npgsql options appended** (`Maximum Pool Size`, `Timeout=15`, `Command Timeout=30`,
  `Connection Idle Lifetime=60`, `Application Name=fd-core-<env>`). `Timeout` (15, also the pool-wait bound) and
  `Command Timeout` (30) are Npgsql's defaults, written down so they cannot drift; the pool size and the idle
  lifetime (default 300) are the real changes. `Application Name` makes `pg_stat_activity` attributable per
  environment.

## The formula — if replicas change, the pool must change

```
(max-replicas + max-surge) x pool + health-reserve  <=  role-limit        per environment
role-limit(staging) + role-limit(prod)              <=  max_connections - 3 - headroom
max_connections (budget)                            ==  max_connections (postgres-shared/cluster.yaml)
```

These are three failing tests and a refusal in the Job's `compose` container (it exits 1 and applies nothing).
**`max-replicas` is a declared ceiling, not an enforced one:** fd-core's Deployment lives in another repository
and the namespace `pods` quota (30 / 20) is not a replica cap. If prod is scaled past `max-replicas` the role
limit still holds (prod gets pool errors, staging and the server are unaffected), but the pools no longer fit
and the test cannot see it. Change the ConfigMap **first**, in the same PR as the scale-out.

## How it is applied (and why not simply `ALTER ROLE`)

- CNPG reconciles `managed.roles` to the Cluster spec, so a bare `ALTER ROLE ... CONNECTION LIMIT` is reverted.
  The limit has to be `connectionLimit` in the spec.
- The roles are registered by a one-shot Job (`flowdent-db-provision`, `database.yaml`) whose pod template is
  immutable and which must not re-run (it would fail on the Secrets it created). So the budget is a **second
  Job, `flowdent-db-tune`, an ArgoCD PostSync hook** (`BeforeHookCreation`), idempotent by construction. It
  reads the password from the role Secret, writes the connection string with the pool options into
  `flowdent-db` (merge patch, one key), then adds `connectionLimit` to the two roles with a JSON patch that
  `test`s each role's name first. RBAC: `patch`+`get` on the one Secret per namespace and on the one Cluster.
- The new connection string is read **at pod start** (`secretKeyRef` env var). Applying the Job changes the
  Secret and the role limit at once; pods keep their old pool until restarted.
- Live on 2026-10-02 this was applied by `kubectl apply` of the same manifest (the Job ran to completion;
  `rolconnlimit` read 20 and 60 afterwards), so ArgoCD finds it already true.

### Changing a number

1. Edit the ConfigMap in `database-budget.yaml`; keep the three inequalities (the tests tell you).
2. Merge. ArgoCD runs the hook; verify `kubectl -n postgres-shared get cluster postgres-shared -o jsonpath='{range .spec.managed.roles[*]}{.name}={.connectionLimit} {end}'`.
3. Roll staging first (`kubectl -n flowdent-staging rollout restart deploy/flowdent-api`), then prod with the
   same command: `maxUnavailable: 0` + `maxSurge: 1` replaces one pod at a time with two always Ready.
   Check `https://api.flowdent.net/health` between pods. Never restart both at once.

## max_connections: not raised, and why

- The caps remove the need. Peak total client backends under the heaviest test (1024 concurrent clients on
  staging) was **14**; the allocated ceiling is 80 of 97.
- It is not free. It needs a rolling restart with a primary switchover on a cluster serving live customers, and
  every backend costs memory against a **1Gi** instance limit (`resources.limits.memory`), so a higher number
  is a second risk traded for a first that no longer exists.
- Revisit when `sum(role limits)` needs to exceed ~80 (a third tenant, or prod beyond ~4 replicas). Then do it
  through `postgres-shared/cluster.yaml` and **the budget ConfigMap in the same PR**, one instance at a time
  (CNPG's `primaryUpdateMethod: switchover` does replicas first), verifying health between steps.

## A CNPG Pooler (PgBouncer): not advisable now

Npgsql already pools client-side, and the traffic is 2-14 backends. A Pooler would add two pods and a hop on a
single node for a problem the caps already close. It also has real compatibility cost for EF Core/Npgsql:
`transaction` pool mode breaks session state (EF Core's migration lock is a session-level advisory lock;
`SET`, `LISTEN/NOTIFY`, session-scoped prepared statements), so it would need `session` mode (which does not
multiplex) or PgBouncer >= 1.21 with `max_prepared_statements` and `No Reset On Close`. It becomes worth it when
the sum of per-pod pools needed exceeds what 97 slots can hold, i.e. many replicas or many tenants.

## Proof (2026-10-02, staging rate limit lifted for the test, restored after)

Load: `loadtest.ts https://api-staging.flowdent.net 15 ...` (read-only GETs, 15 s per stage) while sampling
`pg_stat_activity` per role and `https://api.flowdent.net/health` every ~1-2 s.

| | before (pool 100, no limits) | after (pool 8 / limit 20) |
|---|---|---|
| 64 clients: rps / p95 / errors | 4851 / 32 ms / 0% | 2927 / 50 ms / 0% |
| 128 clients | not run (would risk prod) | 3351 / 83 ms / 0% |
| 256 clients | **120 + 66 `53300` server-wide, 0.41% 5xx** (owner, 18:17 UTC log) | 2619 / 301 ms / 0% |
| 512 / 1024 clients | not run | 3771 / 319 ms / 0%;  3829 / 453 ms / 2 x 503 (`/health` only) |
| max staging connections | exhausted all 97 | **13** (limit 20) |
| max prod connections | starvable | **4** (limit 60) |
| server-wide `remaining connection slots...` / `too many clients` | 186 | **0** |
| `too many connections for role "flowdent_staging"` | n/a | 2 (at 1024 clients), staging only |
| prod `/health` during the runs | n/a | **200 on every sample** (~215 samples), max 1.05 s once |

Reading it: overload now degrades to **bounded latency** (p95 under half a second at 1024 clients) and **clear,
confined errors**: the only failures were two `/health` 503s when staging's own role limit was hit; the data
endpoints never failed. Prod's connection count and `/health` were unaffected. The after rps is lower than the
before at the same concurrency partly because the pool is smaller (8 vs the 100 that was in effect) and partly
because the client is a laptop over the internet: treat rps as indicative, the error and connection columns
as the result.

Not proven: behaviour with a real metal node under a real prod burst; the Job's first run through ArgoCD (it
was applied by hand live with the identical manifest); prod being scaled beyond `max-replicas`.

## Open item for fd-core (not in this repository)

Run the DB health check through a pooled connection so `/health` stops creating a backend per call, e.g.
`AddDbContextCheck<ApplicationDbContext>(customTestQuery: async (db, ct) => { await db.Database.ExecuteSqlRawAsync("SELECT 1", ct); return true; })`.
Until then `health-reserve` is load-bearing; after it, set `health-reserve` to a small number and raise `pool`.

## Rollback

```bash
# 1. role limits back to unlimited (CNPG then reconciles -1)
kubectl -n postgres-shared patch cluster postgres-shared --type=json -p \
  '[{"op":"replace","path":"/spec/managed/roles/0/connectionLimit","value":-1},{"op":"replace","path":"/spec/managed/roles/1/connectionLimit","value":-1}]'
# 2. connection strings back to the provisioner's form (no password is printed)
for ns in staging prod; do
  kubectl -n flowdent-$ns get secret flowdent-db -o jsonpath='{.data.ConnectionStrings__DefaultConnection}' | base64 -d \
    | sed 's/;Application Name=.*$//' | base64 -w0 > /tmp/cs-$ns
  kubectl -n flowdent-$ns patch secret flowdent-db --type=merge -p "{\"data\":{\"ConnectionStrings__DefaultConnection\":\"$(cat /tmp/cs-$ns)\"}}"
  rm /tmp/cs-$ns
done
# 3. roll staging, then prod, one pod at a time (see "Changing a number")
```

Also revert the PR that adds `database-budget.yaml`, otherwise the hook re-applies the budget on the next sync.

## Pointers

- `full-ai-cluster/k8s/flowdent/database-budget.yaml`, `database.yaml` (the provisioner), `postgres-shared/cluster.yaml` (`max_connections`)
- [`FLOWDENT-ON-CLUSTER.md`](FLOWDENT-ON-CLUSTER.md) · [`POSTGRES-SHARED-AS-THE-DATABASE-FOR-OTHER-APPS.md`](POSTGRES-SHARED-AS-THE-DATABASE-FOR-OTHER-APPS.md)
- Anchors: PostgreSQL docs, *Connection Settings* (`max_connections`, `superuser_reserved_connections`) and `CREATE ROLE ... CONNECTION LIMIT`; Npgsql docs, *Connection String Parameters* (Pooling); CloudNativePG docs, *Declarative Role Management* and *Connection Pooling*; Nygard, *Release It!* (bulkheads: a per-consumer limit so one tenant cannot drain a shared resource).
