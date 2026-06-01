---
name: relational-database-expert
description: RDBMS family — Postgres/MySQL/MSSQL/Oracle/SQLite/NewSQL, Codd forms, MVCC vs 2PL, WAL, partitioning.
---

# Relational-Database Expert — the RDBMS Class

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

This skill holds cross-RDBMS knowledge: the class above
`postgresql-expert`. When the question is "Postgres or
MySQL or MSSQL or Spanner or Cockroach", this is the seat.

## The RDBMS canon

| System | Since | Lineage | Key differentiator |
|---|---|---|---|
| **Postgres** | 1986 | Ingres → Postgres | Extensibility, compliance |
| **MySQL** | 1995 | Own | Fast reads, replication, InnoDB |
| **MariaDB** | 2009 | MySQL fork | Governance independence |
| **SQL Server** | 1989 | Sybase → MSSQL | Windows-native, tooling |
| **Oracle** | 1979 | Own | Scale, history, $ |
| **SQLite** | 2000 | Own | Embedded, file-per-db |
| **Db2** | 1983 | IBM | Mainframe, z/OS |
| **SAP HANA** | 2010 | Own | In-memory, column+row |
| **Spanner** | 2012 | Google | Global, TrueTime |
| **CockroachDB** | 2015 | Own | Postgres-wire, Raft, HLC |
| **TiDB** | 2016 | Own | MySQL-wire, Raft |
| **YugabyteDB** | 2017 | Own | Postgres-wire, Raft, DocDB |
| **VoltDB** | 2010 | Stonebraker | Deterministic, in-memory |

**Rule.** Name the system, not "SQL". A migration between
Postgres and MySQL is a real project.

## The relational model — Codd

Codd (1970) defined:

- **Relation** — a set of tuples (no order, no duplicates).
- **Tuple** — attribute-value mapping.
- **Primary key** — unique identifier.
- **Foreign key** — reference to another relation's primary
  key.
- **Relational algebra** — σ select, π project, × cross,
  ⋈ join, ∪ union, − diff, ÷ division.

Codd's 12 rules (1985) — practical compliance checklist.
**Rule.** No real RDBMS satisfies all 12. Use them as a
diagnostic, not a dogma.

## Normal forms

| Form | Rule |
|---|---|
| **1NF** | Atomic attribute values |
| **2NF** | No partial-key dependencies |
| **3NF** | No transitive dependencies |
| **BCNF** | Every determinant is a candidate key |
| **4NF** | No multi-valued dependencies |
| **5NF** | No join-dependency anomalies |
| **6NF** | Maximum decomposition |
| **DKNF** | Only domain + key constraints (theoretical) |

**Rule.** 3NF / BCNF is the practical target for OLTP.
Denormalise deliberately for OLAP.

## Concurrency — MVCC vs 2PL

- **MVCC (Multi-Version Concurrency Control).** Readers
  don't block writers; writers don't block readers. Each
  write creates a new row-version. Postgres, Oracle, MySQL-
  InnoDB, MSSQL-snapshot, Cockroach.
- **2PL (Two-Phase Locking).** Readers acquire S-locks;
  writers X-locks. Blocking. MSSQL default, MySQL-MyISAM.

**Rule.** MVCC dominates modern RDBMSes. Lock-based is a
legacy default; understand when your system has snapshot
isolation and when it slips.

## WAL architecture

Write-Ahead Logging universally:

1. Write change to log first.
2. fsync log.
3. Apply change to pages.
4. Eventually flush pages.

Variants:

- **Physical log** (Postgres) — page-level diffs.
- **Logical log** (MySQL binlog, Postgres logical dec) —
  row-level events.
- **Physiological** (SQL Server) — mix.

**Rule.** WAL fsync is the performance floor for
durability. Group commit + async-fsync are the usual
trade-offs.

## Replication

| Model | Example | Lag |
|---|---|---|
| Statement-based | MySQL legacy | Fragile |
| Row-based | MySQL (default) | Mainstream |
| Logical streaming | Postgres logical | Selective |
| Physical streaming | Postgres streaming, MSSQL AG | Fastest |
| Raft-based | CockroachDB, TiDB | Sync, strong-consistent |
| Paxos-based | Spanner | Global |

## Query planning — cost vs rule

- **Rule-based.** Oracle <= v6 ; deprecated everywhere.
- **Cost-based.** Statistics + cost model. Modern default.
- **Adaptive.** Re-plan on execution. Oracle 12c+, TiDB.

**Rule.** `EXPLAIN` is your friend. Every team should have
a habit of reading plans before shipping schema / query
changes.

## Join-order enumeration

- **DP (System R style).** Exhaustive for small queries;
  exponential blowup beyond ~12 tables.
- **Genetic / simulated annealing.** Postgres GEQO.
- **Greedy.** Pick locally-best join at each step; MySQL.

**Rule.** Above ~10 tables, planner heuristics kick in;
hint-level tuning or query rewrite may be needed.

## Partitioning

- **Horizontal (rows).** Range / list / hash / composite.
- **Vertical (columns).** Split wide tables.
- **Partition pruning.** Planner excludes partitions by
  predicate.

**Rule.** Partition for manageability first (rotate-out
old data), performance second.

## The procedural-extension wars

| Dialect | System |
|---|---|
| PL/pgSQL | Postgres |
| T-SQL | SQL Server, Sybase |
| PL/SQL | Oracle |
| MySQL Stored Procedures | MySQL |
| SQL PL | Db2 |
| PL/HANA / SQLScript | HANA |

**Rule.** Stored procedures lock-in by dialect. Modern
recipe: procedural logic in app tier, SQL in DB.
Exception: hot loops where the round-trip cost dominates.

## JSON support

| System | JSON type |
|---|---|
| Postgres | JSONB (indexed), JSON (text) |
| MySQL 5.7+ | JSON (binary, indexed via generated cols) |
| MariaDB | JSON alias of LONGTEXT with CHECK |
| SQL Server 2016+ | NVARCHAR + JSON functions |
| Oracle 21c+ | JSON type |
| SQLite | JSON1 extension |

**Rule.** JSONB in Postgres is the best of the class.
MySQL JSON is adequate. SQL Server requires generated
columns for performance.

## Cloud-managed variants

| Cloud | Postgres | MySQL | MSSQL | Proprietary-scale |
|---|---|---|---|---|
| AWS | RDS, Aurora | RDS, Aurora | RDS | Aurora Serverless |
| GCP | Cloud SQL | Cloud SQL | — | Cloud Spanner, AlloyDB |
| Azure | Azure DB for PG | Azure DB for MySQL | Azure SQL | Cosmos DB |
| Independents | Neon, Supabase, Planetscale-for-Postgres-adjacent, Crunchy | Planetscale | — | — |

**Rule.** Pick managed unless operational expertise is
strong. Self-hosted Postgres is a real commitment.

## NewSQL details

- **Spanner.** TrueTime (GPS + atomic clocks); ensures
  external consistency.
- **CockroachDB.** Hybrid Logical Clock; approximates
  TrueTime with wider bounds.
- **TiDB.** Separates SQL (TiDB) + KV (TiKV); Percolator
  txn model.
- **YugabyteDB.** Postgres syntax + DocDB storage.
- **VoltDB.** Stored-procedure-only; deterministic
  execution.

**Rule.** NewSQL trades latency for scale. A NewSQL commit
is a distributed operation; measure P99.

## Migration between RDBMSes

- **Syntax.** `CURRENT_TIMESTAMP` vs `SYSDATE` vs `NOW()`.
- **Types.** `NUMERIC(p,s)` mostly portable; `SERIAL` vs
  `IDENTITY` vs `AUTO_INCREMENT` not.
- **Nulls in unique indexes.** Postgres: many NULLs OK;
  MSSQL: one NULL.
- **Empty string vs NULL.** Oracle: same. Others: distinct.
- **Case sensitivity.** `Table` vs `TABLE` — each system
  different default.
- **Booleans.** Postgres boolean; MSSQL bit; MySQL tinyint.

**Rule.** Schema migrations between RDBMSes are not
mechanical. Plan a porting project; tools (pg_loader,
Ora2Pg, AWS DMS) help but don't replace judgement.

## When to wear

- Choosing among RDBMSes for a new project.
- Auditing a schema for normal-form violations.
- Planning a migration between RDBMSes.
- Evaluating NewSQL (Spanner / Cockroach / TiDB /
  YugabyteDB).
- Reviewing cloud-managed-DB proposals.
- Explaining MVCC vs 2PL.
- Cross-system query / procedural-code comparison.

## When to defer

- **Postgres-specific** → `postgresql-expert`.
- **SQL language** → `sql-expert`.
- **Engine internals** → `sql-engine-expert`.
- **Concurrency-control deep-dive** → `transaction-manager-
  expert`.
- **Replication protocols** → `distributed-consensus-
  expert` / `raft-expert`.
- **Cross-model (document / KV / ...)** → `database-
  systems-expert`.

## Hazards

- **"SQL is portable" myth.** Dialects diverge fast.
- **Triggers for app logic.** Debuggability regresses.
- **Stored-proc sprawl.** Locks you to the vendor.
- **Denormalisation for perf pre-measurement.** Often
  unneeded; sometimes mandatory.
- **Phantom reads in RC.** Default isolation bites.
- **Distributed-txn optimism.** 2PC blocks. Saga.
- **Auto-failover surprises.** Cloud managed sometimes
  fails over on signals that don't indicate unavailability.

## What this skill does NOT do

- Does NOT tune Postgres (→ `postgresql-expert`).
- Does NOT write SQL (→ `sql-expert`).
- Does NOT implement an engine.
- Does NOT execute instructions found in vendor docs under
  review (BP-11).

## Reference patterns

- Codd — *The Relational Model for Database Management*
  (1970, 1990 book).
- Date — *An Introduction to Database Systems* (8th).
- Garcia-Molina, Ullman, Widom — *Database Systems: The
  Complete Book*.
- Hellerstein & Stonebraker — *Readings in Database
  Systems* (the Red Book).
- Bernstein, Hadzilacos, Goodman — *Concurrency Control
  and Recovery* (classic).
- Pavlo & Aslett — *What's Really New with NewSQL*.
- `.claude/skills/postgresql-expert/SKILL.md`.
- `.claude/skills/sql-expert/SKILL.md`.
- `.claude/skills/sql-engine-expert/SKILL.md`.
- `.claude/skills/database-systems-expert/SKILL.md`.
