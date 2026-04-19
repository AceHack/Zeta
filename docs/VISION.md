# Zeta — Long-Term Vision

> **Status:** round 33 v8 after Aaron's seventh pass of edits.
> Aaron is the source of truth; this document changes freely.
> The `product-visionary` role (to be spawned, see
> `docs/BACKLOG.md`) will steward it once it exists.
>
> **Lore:** Aaron almost named the project "Database." The
> codename landed on Zeta (locked as of round 33), but the
> ambition stayed: all DB technologies in one big playground,
> built retraction-native from the ground up.

## The foundational principle

Aaron, round 33: *"what i'm really doing is just taking the
lambda architecture and the Kafka turning-the-database-inside-
out ideas to their absolute logical conclusion when the events
become the source of truth and everything else is derived."*

This is the load-bearing philosophy behind Product 1. Everything
downstream (retractions, incremental plans, the DB-vs-event-store
dual, bitemporal queries, time-travel, materialised projections,
columnar substrate) follows from one stance: **the log of
events is the primary state; everything else is a view derived
from it, re-derivable on demand.**

Zeta is what Kleppmann + Kreps + Marz were pointing at, built
from day one on a retraction-native algebra that makes the
"derived everything" part mathematically honest. Conventional
databases treat the log as an implementation detail under a
table surface; conventional event stores hide the table
abstraction and make consumers reconstruct views manually.
Zeta refuses the trade: both surfaces live on top of the same
primary log, through the same algebra.

Inputs to study while sharpening this (for the product-
visionary's first research round): Kleppmann's "Designing Data-
Intensive Applications"; Jay Kreps' "The Log" + "Turning the
database inside out with Apache Samza" (2015); Nathan Marz on
the lambda architecture; Datomic's append-dated model; Kafka
Streams / ksqlDB; Materialize + Feldera on DBSP.

## The project has two products

This is load-bearing and worth stating first. Zeta is:

1. **A full database** (the product the code produces), and
2. **A cross-platform, AI-automated software factory** (the
   project that produces the code).

Both are first-class. A decision that optimises (1) at the
cost of (2) — or vice versa — is a design-doc event.

## The developer-experience north star

Aaron round 33: *"at the end of this any ASP.NET application
should just be able to DI setup a db and boom they have a
distributed database if they install on Kafka and we can
test all this locally with Kind. Can you imagine how many
things that could light up for any dotnet project. Your
application just IS a database and your code IS stored
procedures, plus LINQ and regular SQL."*

This is the one-sentence pitch that the whole stack serves.
Concretely:

- **DI one-liner spin-up.** Something like
  `services.AddZeta(opts => opts.UseKafkaLog(...))` →
  ASP.NET app now has a distributed retraction-native
  database. No separate server to run, no separate schema
  migration pipeline, no separate client library. Zeta is
  a NuGet package the app embeds.
- **Kafka as the distribution substrate (option).** Aaron's
  preferred multi-node shape: Kafka holds the log of
  events; Zeta nodes read/write to it; the `events-as-
  source-of-truth` principle maps cleanly to "the Kafka
  log IS the source of truth." Kafka is one option among
  several — NATS JetStream, raw Arrow Flight, gRPC,
  bespoke — the design round picks. Pluggable log back-
  end per §Foundational Principle.
- **Kind for local testing.** A Kubernetes-in-Docker
  local cluster validates multi-node Zeta + Kafka
  (or chosen log back-end) end-to-end without cloud
  dependencies. Test parity: same topology locally and
  in production.
- **Code IS stored procedures.** C# + F# methods decorated
  as durable-Rx-style subscriptions (see Reaqtor-niche
  entry) run inside Zeta, checkpointed, restart-safe.
  Application logic and database logic live in the
  same codebase, the same types, the same DI container.
- **LINQ + SQL + F# DSL all on the same surface.** Consumers
  pick their front-end per-query; Zeta routes everything
  through the shared IR + operator algebra.
- **First-class event system.** Not a library-on-top;
  subscriptions/projections/retraction-aware streams
  are native. `services.AddZetaEvents(...)` wires them
  into DI alongside the database.
- **First-class caching system.** The retraction-native
  algebra means cache invalidation is free — when the
  underlying data retracts, dependent cache entries
  retract with it. No TTL guessing, no cache-stampede
  mitigation, no read-through/write-through/write-
  behind taxonomy. `services.AddZetaCache(...)` gives
  you a retraction-aware cache on the same store.
- **Cross-API GraphQL with automatic spill-over.** A
  GraphQL layer over Zeta — cross-service queries
  traverse the graph, and because events + cache are
  retraction-native, updates propagate across API
  boundaries automatically. No manual cache-
  invalidation-on-mutation plumbing; no subscription-
  pushing-over-WebSocket glue per-field. The graph is
  live by virtue of running on Zeta.
- **Pluggable log back-end.** Kafka, NATS, NATS
  JetStream, and Zeta's own native log all speak to
  the multi-node substrate. Aaron round 33: "all with
  pluggable wire protocol, hello kafka, nats, nats
  streaming … and our own of course." Single-node
  consumers pick in-memory; multi-node picks whatever
  log infrastructure they already have; greenfield
  multi-node can pick Zeta-native and get features the
  emulated back-ends can't express.

What lights up for .NET consumers:

- **Mainstream stack** — replace DbContext + Redis/Kafka +
  cache + read-model projections with one Zeta.
- **Event-sourcing crowd** — finally an event store that
  speaks SQL when you want it to.
- **Real-time analytics** — incremental plans over
  continuously-updated tables without rewriting in Flink.
- **Audit + compliance** — append-dated history + time-
  travel queries for free, not bolted on.
- **Distributed-systems research** — a reference
  implementation of events-as-truth at scale.
- **GraphQL federated APIs** — retraction propagates
  across service boundaries automatically.
- **Caching-heavy workloads** — cache invalidation
  becomes a solved problem, not a folklore one.

## Product 1 — Zeta the database

### North star

Zeta is a research-grade, retraction-native database. Every
DB technology worth studying lives here as a playground: the
goal is to explore the full database surface built honestly
on DBSP foundations, not to carve out a narrow niche.

- **Mathematically honest.** Every operator obeys laws
  Milewski would recognise. When a law cannot hold, the API
  tells you so, loudly and at compile time.
- **Retraction-native by construction.** DBSP's differentiator
  is exactly-symmetric insert/retract. Designs that break
  retraction are wrong, not merely uncool.
- **Publishable.** Every major feature is a research
  contribution (paper target) or an explicitly named
  engineering fundamental. No clever-but-unjustified
  abstractions.
- **First-class F#, polyglot over time.** F# is the primary
  language; C# callers get `Zeta.Core.CSharp`. Lean for
  proofs, Java for the Alloy driver, TypeScript (or
  researched alternative) for post-install automation. F#
  stays load-bearing.
- **Production-grade security.** Nation-state + supply-chain
  threat model. SLSA ladder L1 → L3 pre-v1.0. OpenSpec is
  first-class for every committed artefact, including CI.
- **Research-worthy performance.** Every hardware intrinsic
  we can reach (SIMD, tensor ops, SIMD-JSON-shape parsing,
  cache-line discipline). Benchmarks that answer specific
  questions, not vanity numbers.
- **Multi-node by design.** Single-node is the first
  shippable subset, not the ceiling. Distribution
  (control-plane + data-plane, consensus, sharding,
  cross-node retractions) is explicitly in scope.

### What the DB eventually covers

Aaron's "all the DB technologies in one big playground" is
the long-term scope. Non-exhaustive menu:

- **Incremental query engine** (DBSP core; already shipping).
- **Storage substrate** (DiskBackingStore, Spine family,
  durability modes, Witness-Durable Commit).
- **Sketches + approximate query** (retraction-aware HLL,
  CountMin, KLL, Bloom family; HyperBitBit; retraction-
  native quantile sketches).
- **Streaming / CDC ingestion** (NATS JetStream, Kafka-
  shaped, Arrow Flight, typed event sources).
- **Query frontends** (SQL eventually; also the native F#
  DSL + plugin operator surface; possibly a query IR that
  multiple frontends target).
- **Planner / optimiser** (cost model, SIMD kernel
  dispatch, join ordering, predicate pushdown, adaptive
  re-planning under retractions).
- **Multi-node control plane** (shape TBD — NATS vs gRPC
  vs Arrow Flight vs bespoke; sharding, replication,
  consensus, info-theoretic sharder).
- **CRDT / replication layer** (OrSet already shipping;
  more as multi-node matures).
- **Bitemporal / time-travel** (append-dated history,
  retraction-aware point-in-time queries).
- **Formal verification surface** (18+ TLA+ specs, Alloy
  structural invariants, Lean proofs where the math is
  foundational).

### v1.0 subset

What makes `Zeta.Core 1.0.0` on NuGet:

- Operator algebra with LawRunner-verified tags (linear,
  bilinear, sink-terminal, retraction-complete).
- Recursion — retraction-safe `Recursive` combinator;
  `RecursiveSemiNaive` where monotonicity holds; honest
  LFP termination.
- Storage layer — four durability modes (in-memory,
  OS-buffered, stable-storage, witness-durable) with
  honest recovery-property advertisement.
- Sketches — retraction-aware HLL, CountMin, KLL, Blocked
  plus Counting Bloom.
- Query planner — cost model with SIMD / tensor kernel
  dispatch.
- Plugin surface — `PluginOp<'TIn, 'TOut>` or equivalent.
- FsCheck LawRunner — `checkBilinear`,
  `checkSinkTerminal`, `checkRetractionCompleteness`
  already landed.
- **SQL frontend (v1), PostgreSQL dialect first.** Aaron
  round 33: "whatever is easier to ship first and work
  with EF, people love postgres compatibility." PostgreSQL
  wins on both: Npgsql (Apache-2.0) is the widely-used
  EF Core provider; pgAdmin/DBeaver/psql all speak the
  wire protocol; Materialize/Feldera/CockroachDB have
  proven it's viable to look-like-postgres while running
  a different engine underneath. Other dialects (T-SQL,
  MySQL, SQLite, DuckDB) follow — all via the shared
  query IR per `../SQLSharp/openspec/specs/query-
  frontends/`.
- **Tight LINQ integration (v1).** `IQueryable<T>` roots
  on mapped tables; LINQ lowers to the same IR the SQL
  parser targets. Primary surface for F# + C# consumers.
- **Entity Framework Core provider (v1), ALL features.**
  Aaron: "100% all features." Full LINQ provider +
  save-changes + migrations + tracking + change
  detection. No "works for SELECT but fails on
  INSERT-INTO-UPDATE" partial-provider shape —
  consumers should never hit a "this feature not
  implemented" wall. Other ORMs (Dapper, NHibernate,
  LLBLGen) follow the EF Core pattern.
- **Pluggable wire-protocol layer (v1-or-early-post-v1).**
  Aaron round 33: "can we make the wire protocol pluggable
  and we could just support MySQL too to make sure we can
  support [multiple] and have our own variant so we can
  start getting support for UIs with our protocol which
  will be much better." A protocol-plugin abstraction sits
  between the query IR and the network: each plugin is a
  small adapter that translates one wire format
  (frontend/backend message shape, auth, error mapping,
  connection state) into Zeta's internal query surface.
  Three initial plugins:
  - **PostgreSQL plugin** — pgAdmin, DBeaver, psql,
    Npgsql-via-EF all connect unmodified.
  - **MySQL plugin** — MySQL Workbench, Connector/NET,
    Pomelo-via-EF, Azure Data Studio all connect.
    Second plugin proves the abstraction isn't
    PostgreSQL-shaped by accident.
  - **Zeta-native plugin** — our own protocol designed
    around retraction-native deltas, bitemporal queries,
    stored-procedure-as-durable-Rx semantics. UIs that
    support it get first-class Zeta features (time-
    travel slider, delta streaming, Rx stored-proc
    inspection) that PostgreSQL/MySQL protocols can't
    express. Specification work feeds the eventual
    Zeta admin UI.

  The protocol layer is a server mode on top of the
  embedded library, not a replacement; Zeta keeps the
  in-process F# surface AND exposes one-or-more wire-
  protocol endpoints simultaneously. Significant scope —
  may slip from v1 to early post-v1 depending on design
  round outcome.
- **F# DSL reimagining SQL for the modern era (v1).** The
  existing computational-expression sketch (`DSL.fs`,
  `circuit { ... }`) is the seed. Long-term ambition: a
  natively F# relational DSL that treats retractions,
  bitemporality, and incremental plans as first-class —
  not bolted on. Inspired by LINQ but shaped for DBSP.
  Aaron round 33 on DSL design: "sounds like we need
  design and research, this task sounds HUGE." Named
  as a multi-round design effort in `docs/BACKLOG.md`.
- Formal-method coverage — TLA+ / Alloy specs running
  green in CI.
- CI parity + security posture — see Product 2 below.

### Post-v1 exploration

- Witness-Durable Commit protocol (paper-worthy).
- Retraction-aware analytic sketches (HyperBitBit,
  retraction-native quantiles; publication target).
- Info-theoretic sharder (Alloy-verified).
- **Multi-node deployment** (control-plane shape open —
  NATS / gRPC / Arrow Flight / bespoke; sharding,
  replication, consensus, info-theoretic sharder;
  firmly IN scope).
- **Bitemporal + time-travel queries (first-class v2).**
  Append-dated history with retraction-aware point-in-
  time queries. Paper-worthy and native to DBSP's
  retraction model.
- **Additional ORM providers.** Dapper, NHibernate, LLBLGen,
  etc. — follow the EF Core provider as the pattern.
- **".NET stored procedures" (C# + F#) via Reaqtor-style
  durable queries.** Microsoft's Reaqtor (MIT, dormant-but-
  stable) ships `IReactiveQbservable<T>` + a query engine
  that persists operator state across restarts — "durable
  Rx." Reaqtor is push/event-at-a-time with no native
  retraction; Zeta would take the serializable-expression-
  tree + durable-subscription shape and swap in DBSP Z-set
  deltas so retractions are free. This is the research-
  worthy niche: "Rx + durability + retraction-native" is a
  Reaqtor-shaped hole nobody has filled. Both C# and F#
  surfaces ship together (not just one). See
  `docs/BACKLOG.md` for the design-doc task.

### Both modes: event-sourcing AND regular-database

Aaron round 33: "we also want a facade/abstraction so this
can be used like a normal non-eventing database as well, it
should be both, i can replace my database AND my event store
with Zeta." Followed up: "event streaming and regular db
kinda stuff, and likely column columnar stuff."

So Zeta's surface is TWO modes over the same retraction-
native core:

- **Event-sourcing mode** — the native DBSP surface.
  Deltas, retractions, incremental queries, durable
  streams, projections. Zeta IS the event store. This
  is what ships naturally from the algebra.
- **Regular-database mode** — a façade that hides the
  event-sourcing / retraction / delta machinery and
  presents a normal "tables + rows + SELECT/INSERT/
  UPDATE/DELETE" API. The DBSP engine is still running
  underneath; the façade just doesn't make you care.
  This is the mode most SQL consumers + ORM integrations
  land on by default.
- **Columnar storage** (likely in scope). Many DB
  workloads benefit from columnar layouts — analytics,
  OLAP-style queries, wide-row-scan-sparse-projection.
  Fits alongside the row-oriented Spine family.

The product-visionary runs both modes through the same
operator algebra + same query IR — different surfaces,
same correctness model.

## Product 2 — The software factory

### Why the factory is first-class

Aaron: "this whole factory is self-directed and fully
automated." Round 32: "the cross platform AI automated
software factory, eventually with UI too but that's way
down the road."

The factory is not a means to an end. It's the second
product. Every round improves both Zeta-the-database AND
Zeta-the-factory; a round that ships a feature while
degrading the factory is a net-negative round.

### Factory north star

- **AI-automated.** Agents (personas) do the work;
  humans set direction, review, and ratify. See
  `AGENTS.md` + `docs/PROJECT-EMPATHY.md` for the agent
  contract.
- **Cross-platform.** Dev-laptop (macOS + Linux today,
  Windows via PowerShell when it lands) + CI runner +
  devcontainer all bootstrap via the same source of truth.
  Post-install automation moves to a single cross-platform
  runtime (Bun/Deno/Python/.NET — research-pending).
- **Declarative dependencies.** Every installed tool lives
  in a committed manifest. `../scratch`'s tiered shape
  (`min` / `runner` / `quality` / `all`) is the ratchet
  target. Non-declarative installation is a smell.
- **Research-level reproducibility.** Pin everything pinnable
  (SHAs, versions, lock files). SLSA ladder. Reproducible
  builds are a long-term goal gated on upstream compiler
  work. Every run should be replayable.
- **Symmetry.** Configs, ignore lists, editor settings,
  lint scopes — the same ignore list should appear in every
  tool that needs one. Asymmetry is a bug (round-33
  vscode-was-gitignored surfacing is the canonical example).
- **Production-ready quality.** The factory itself ships
  at production-grade: `0 Warning(s) / 0 Error(s)` build
  gate, Semgrep-in-CI, shellcheck-in-CI, actionlint-in-CI,
  markdownlint-in-CI, all green on main. A red factory is
  a factory down.
- **Fully self-directed eventually.** The loop is
  upstream-signals + research + novel-ideas → vision-
  check → backlog → next-steps → round work → merge.
  Humans set direction; agents run the loop. UI comes
  "way down the road" — text-first today.

### v1.0 subset of the factory

- Three-way-parity install script (GOVERNANCE §24) —
  done.
- CI gate with build + lint jobs — done.
- Persona memory as directories (NOTEBOOK + MEMORY + OFFTIME) — done.
- OpenSpec as first-class for every committed artefact
  (GOVERNANCE §28) — done.
- Backlog scoping (GOVERNANCE §29) — done.
- `docs/VISION.md` — this document, lands round 33.
- All gap-finders (skill / openspec / static-analysis) —
  in progress across rounds 33-35.
- Declarative-manifest tiered shape — ratchet across
  5-8 rounds.
- Upstream sync script + `references/upstreams/` — pending.

### Post-v1 factory work

- `product-visionary` role spawn (BACKLOG P1).
- Factory UI (far future — agents + human today).
- Fully self-directed loop (all gap-finders running on
  cadence, feeding backlog autonomously, Aaron reviews
  at round-close).
- SLSA L3 reproducibility once upstream compiler work
  lands.
- Full polyglot repo-automation runtime (post-install
  cross-platform scripting — researched-pending).

## What Zeta is NOT

- **Not a clone of any upstream.** `references/upstreams/`
  are read-only inspiration; Zeta hand-crafts every artefact.
- **Not a compliance product.** Enterprise consumers certify
  at their deployment layer; Zeta provides the evidence
  trail, not the audit.
- **Not a narrow niche.** The ambition is full database;
  saying "Zeta only does X" is under-promising and would
  pull us off-course.
- **Not a product chasing users pre-v1.** Research first;
  users follow the research.

## License

**Apache-2.0.** Aaron round 33: "Apache sounds okay …
just pick one and lets go." Patent grant + contribution
clauses give slightly better downstream-dispute defence
than MIT at zero practical cost. Round 33 lands the LICENSE
flip (MIT → Apache-2.0) and the `<PackageLicenseExpression>`
update in `Directory.Build.props`.

If commercial emerges, the license can be revisited
(source-available? dual-licensed with AGPL for the OSS
core + commercial for hosted?); Apache-2.0 is the start
state and the easiest to move FROM because all contributors
have granted patent rights.

## Commercial posture

Pure research / open-source is the first-class experience.
Commercial ambitions are on the table.

**Trigger event.** Aaron: "[Commercial moves to decided]
when I'm able to use this in a real project at some point
for its database." That's the milestone — when Zeta is
load-bearing in a real Aaron-run project and could be
shipped under a commercial license or hosted offering
without degrading the OSS core.

- If Zeta stays pure-OSS through that milestone: research
  papers + reference implementation + NuGet distribution.
- If commercial emerges: enterprise-grade features (tenancy,
  compliance attestations, hosted offering, etc.) layer on
  top of the OSS core; the OSS core never degrades for the
  commercial story.

When commercial moves from "on the table" to "decided,"
the `product-visionary` + `branding-specialist` pair
updates this section and spawns the corresponding roles
(sales, enterprise-support, hosted-ops, etc.).

## How we decide what to build

The loop the `product-visionary` role runs:

1. **Ingest signals.** Upstream reference repos ship
   something interesting; a paper appears; someone has a
   novel idea; an existing Zeta subsystem shows a design
   smell; the factory itself has a friction point.
2. **Check against the vision.** Does this sharpen Zeta's
   north star across Product 1 + Product 2, or does it
   pull us toward what we explicitly are NOT?
3. **Propose to the backlog.** If yes → `docs/BACKLOG.md`
   entry with reasoning. If no → `docs/WONT-DO.md` entry
   with reasoning.
4. **Ask Aaron if unsure.** Long-term vision drift is the
   silent killer. Product-visionary asks many questions;
   direction-shifting items never get decided alone.

## Operating principles (abbreviated from AGENTS.md + GOVERNANCE)

- Truth over politeness.
- Algebra over engineering.
- Velocity over stability (pre-v1).
- Retraction-native over add-only.
- Cutting-edge over legacy-compat.
- Category theory over ad-hoc abstraction.
- Publishable over merely-functional.
- F# idiomatic over C# transliterated.
- Agents, not bots.
- Docs read as current state, not history.
- OpenSpec is first-class.
- Every CI minute earns its slot.
- Non-declarative installation is a smell.
- Symmetry — across configs, tools, ignore lists, bootstrap paths.
- Deterministic scripts — retries and polling are last resort.

## What this document is NOT

- Not the roadmap (that's `docs/ROADMAP.md`).
- Not the backlog (that's `docs/BACKLOG.md`).
- Not the next-steps queue (that's the `next-steps` skill).
- Not a sales pitch.

## Revision cadence

The `product-visionary` role (when spawned) re-reads this
doc every 5-10 rounds, proposes edits, gets Aaron's
sign-off, commits. Ad-hoc edits land when a round's work
surfaces a vision-level question. Aaron can revise at any
time without ceremony.

## First-pass confidence + gaps (post v2 edits)

Things Aaron has now stated directly and Kenji is confident about:

- Zeta IS going to be a full database, not a library layer
  below one. "All DB technologies in one big playground."
- Multi-node deployment is in scope.
- The software factory is a first-class product, not a
  means to an end.
- Factory goals: cross-platform, AI-automated, declarative
  dependencies, research-level reproducibility, symmetry,
  production-ready quality, UI someday.
- Pure research/OSS is first-class; commercial is on the
  table but undecided.
- F# primary, polyglot over time.
- Nation-state + supply-chain security posture.
- OpenSpec first-class for every committed artefact.
- NuGet library shipping at v1.0 (the first slice of the
  full database).

Things Aaron resolved this round (round 33 v3 + v4):

- **Zeta name is locked.**
- **SQL frontend is v1**, not post-v1. With tight LINQ
  integration + multiple SQL dialect targets + Entity
  Framework provider first, then other ORMs.
- **F# DSL reimagining SQL is v1** — extension of the
  existing computational-expression sketch.
- **Commercial trigger**: when Aaron uses Zeta in a real
  project for its database.
- **Bitemporal / time-travel: first-class v2.** ("yes
  I want this haha" — framing distinction was noise.)
- **Query IR**: multiple frontends (SQL dialects + LINQ +
  native F# DSL) target one IR that compiles to the DBSP
  operator algebra. Inspiration pattern: SQLSharp's
  "SQL-text and integrated-query flows converge on one
  logical planning pipeline."
- **Reaqtor-shaped niche** (".NET stored procedures"
  — C# AND F# both — as durable Rx-style queries) is
  post-v1 research; genuinely open territory because no
  upstream has Rx, durability, and retraction-native
  semantics in one box.
- **Zeta ships BOTH modes**: event-sourcing (native DBSP)
  together with a regular-database façade (tables-and-SQL
  feel over the same retraction-native core). Replace
  your database AND your event store with one system.
- **Columnar storage likely in scope** alongside the
  row-oriented Spine family. Fits OLAP / analytics /
  wide-row-sparse-projection workloads.

Things Aaron resolved round 33 v5:

- **SQL dialect: PostgreSQL first.** Easier-to-ship +
  good EF integration + huge existing tool ecosystem.
- **License: Apache-2.0.** Landed this round.
- **EF provider: 100% all features.** No partial-provider
  shape; full LINQ + save-changes + migrations + tracking.
- **Admin UI**: Zeta will build its own eventually (long-
  term). In the meantime, speak the PostgreSQL wire
  protocol so existing admin tools connect.
- **F# DSL design**: acknowledged as huge multi-round
  research effort, queued in BACKLOG.

Remaining gaps the product-visionary walks on first
audit (after round 33):

- Wire protocol server: v1 or slip to early post-v1?
  Scope impact is significant.
- Own admin UI: F# + web (Fable? SAFE Stack? Blazor?)
  or native GUI (Avalonia?). Far-future but the choice
  signals the polyglot story.
- Naming within the wire-protocol layer — Zeta as "a
  PostgreSQL" (we emulate) vs "behind Postgres-shaped
  endpoint" (we translate on ingress/egress)?
