# Factory-demo — database scaffold

**What this is:** The boring database part of the factory-demo.
Standard Postgres schema + deterministic seed data. Frontend
and backend choices deliberately deferred until the stack
decision lands.

**What this is NOT:** A pitch for Zeta as the data store. The
demo sells the **software factory**, not the database layer.
Backend is Postgres because Postgres is boring and battle-tested
and does not threaten any adopting company's existing data-tier
commitments. See
`memory/feedback_servicetitan_demo_sells_software_factory_not_zeta_database_2026_04_23.md`
for the load-bearing directive.

## Why this scaffold lives separately from the CRM kernel sample

Two sibling samples, two different audiences:

- `samples/CrmSample/` (internal-facing) —
  algebraic substrate demo. Console F# showing
  retraction-native Z-set semantics on CRM-shaped data. For
  factory agents and Zeta library users.
- `samples/FactoryDemo.Db/` (factory-demo-facing) —
  factory-adoption demo. Standard SQL, standard stack, pitches
  the factory. For engineering leadership evaluating
  factory adoption.

The two samples do not mix. The internal one uses Z-set
algebra; the factory-demo one uses Postgres CRUD.

## Current scope (v0, DB-only)

This directory currently ships only the DB side of the demo:

- `schema.sql` — Postgres DDL for customers, opportunities,
  activities (email/call/SMS events).
- `seed-data.sql` — deterministic seed: 20 customers, 30
  opportunities across 5 stages (Lead / Qualified /
  Proposal / Won / Lost), 2 intentional email duplicate
  groups, some recent activity history.
- `README.md` — this file.

Frontend + backend land in later PRs once the stack is chosen
(scope doc lands in PR #144).

## How to use — one command

```bash
cd samples/FactoryDemo.Db
docker-compose up -d                   # start Postgres; schema + seed applied automatically
bash smoke-test.sh                     # verify seed loaded correctly (optional)

# Poke around:
docker-compose exec db psql -U postgres -c \
    "SELECT stage, COUNT(*), SUM(amount_cents) / 100 AS total_usd
     FROM opportunities GROUP BY stage ORDER BY stage;"

# When done:
docker-compose down -v                 # stop + wipe volume
```

The `docker-compose up -d` command:

1. Pulls `postgres:16-alpine` if not cached
2. Mounts `schema.sql` + `seed-data.sql` into
   `docker-entrypoint-initdb.d/` where Postgres auto-applies
   them at first startup
3. Exposes port 5432 on localhost
4. Persists data in a named volume (`factory-demo-db-data`)
   so restarts keep the data; `down -v` wipes it

**Expected seed** (verified by `smoke-test.sh`):
Lead: 10 opps / $54K, Qualified: 6 / $42.2K, Proposal: 6 / $57.2K,
Won: 6 / $26.7K, Lost: 2 / $4.9K. 20 customers total, 2 intentional
email collisions for the duplicate-review scenario, 33 activity rows.

### Manual alternative (no docker-compose)

If you'd rather run Postgres directly:

```bash
docker run --rm -d --name factory-demo-db \
    -e POSTGRES_PASSWORD=demo -p 5432:5432 postgres:16
psql -h localhost -U postgres -d postgres -f schema.sql
psql -h localhost -U postgres -d postgres -f seed-data.sql
```

Same end state, more steps. Prefer `docker-compose` unless you
have a reason not to.

## Schema shape (at a glance)

- **`customers`** — `id` (bigserial PK), `name`, `email`,
  `phone`, `address`, `created_at`, `updated_at`. Email
  unique? No — intentional duplicates are part of the demo.
- **`opportunities`** — `id` (bigserial PK), `customer_id`
  (FK to `customers`), `stage` (enum-ish check constraint:
  Lead / Qualified / Proposal / Won / Lost), `amount_cents`
  (bigint, avoid float money), `created_at`, `updated_at`.
- **`activities`** — `id` (bigserial PK), `customer_id` (FK),
  `opportunity_id` (nullable FK), `kind` (Call / Email / SMS /
  Note), `notes` (text), `occurred_at` (timestamptz). A
  timeline of interactions per customer.

No views, no stored procedures in v0. One narrow trigger —
`touch_updated_at` on `customers` + `opportunities` — keeps
the `updated_at` column accurate on UPDATE without app-layer
bookkeeping; see `schema.sql`. No app-behavior triggers
(nothing fires per-row except `updated_at` bookkeeping). The
demo frontend will either query directly or use a thin API
layer (TBD).

## Design notes

- **Money as `bigint` cents, not `numeric` dollars.** Avoids
  float-money bugs + makes SUM() trivially correct.
- **`timestamptz` everywhere.** Portable across timezones;
  most real CRM deployments span multiple regions.
- **`updated_at` via trigger.** Postgres idiom for
  last-modified tracking without app-layer bookkeeping. One
  trigger per table.
- **No soft-deletes in v0.** CRUD-delete for simplicity. The
  demo's "retraction" semantics belong to the internal
  algebraic sample (`samples/CrmSample/`), not here.
- **Seed data shape deterministic.** Re-running `seed-data.sql`
  replays the same row count, same keys, same amounts, same
  email collisions. Activity timestamps use `NOW() - INTERVAL
  'N days'` and therefore drift with wall-clock time on each
  load — that's intentional (demo data should look recent),
  not a determinism bug. The shape-deterministic + timestamp-
  recent combination is what \"demo repeatability\" means here.

## Open questions

1. **Postgres version.** Pinning 16 in the example above;
   should we support older (14+)?
2. **Schema naming convention.** `snake_case` per Postgres
   norm. Any adopting-company conventions to match?
3. **Seed data size.** 20 customers / 30 opps is small. 200 /
   300 shows pipeline curves better. How big for the demo?
4. **Multi-tenant shape.** No `tenant_id` column in v0. Most
   real CRMs are multi-tenant — do we need this in the demo
   or keep it single-tenant for simplicity?
