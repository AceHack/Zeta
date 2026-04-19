# Zeta — Long-Term Vision

> **Status:** round 33 v3 after Aaron's second pass of edits.
> Aaron is the source of truth; this document changes freely.
> The `product-visionary` role (to be spawned, see
> `docs/BACKLOG.md`) will steward it once it exists.
>
> **Lore:** Aaron almost named the project "Database." The
> codename landed on Zeta (locked as of round 33), but the
> ambition stayed: all DB technologies in one big playground,
> built retraction-native from the ground up.

## The project has two products

This is load-bearing and worth stating first. Zeta is:

1. **A full database** (the product the code produces), and
2. **A cross-platform, AI-automated software factory** (the
   project that produces the code).

Both are first-class. A decision that optimises (1) at the
cost of (2) — or vice versa — is a design-doc event.

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
- **SQL frontend (v1).** Multiple dialect targets (T-SQL,
  PostgreSQL, MySQL, SQLite, DuckDB) via a shared query
  IR that compiles to the DBSP operator algebra.
  `../SQLSharp/openspec/specs/query-frontends/` is the
  pattern to study; that project has started the
  LINQ-first frontend + planning convergence we want.
- **Tight LINQ integration (v1).** `IQueryable<T>` roots
  on mapped tables; LINQ lowers to the same IR the SQL
  parser targets. This is the primary surface for F# +
  C# consumers.
- **Entity Framework provider (v1).** Zeta ships an EF
  Core provider so EF consumers get DBSP incremental
  query plans for free; downstream ORMs follow after EF.
- **F# DSL reimagining SQL for the modern era (v1).** The
  existing computational-expression sketch (`DSL.fs`,
  `circuit { ... }`) is the seed. Long-term ambition: a
  natively F# relational DSL that treats retractions,
  bitemporality, and incremental plans as first-class —
  not bolted on. Inspired by LINQ but shaped for DBSP.
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
- **"C# stored procedures" via Reaqtor-style durable Rx
  queries.** Microsoft's Reaqtor (MIT, dormant-but-stable)
  ships `IReactiveQbservable<T>` + a query engine that
  persists operator state across restarts — "durable
  Rx." Reaqtor is push/event-at-a-time with no native
  retraction; Zeta would take the serializable-expression-
  tree + durable-subscription shape and swap in DBSP
  Z-set deltas so retractions are free. This is the
  research-worthy niche: "Rx + durability + retraction-
  native" is a Reaqtor-shaped hole nobody has filled.
  See `docs/BACKLOG.md` for the design-doc task.

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

Things Aaron resolved this round (round 33 v3):

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
- **Reaqtor-shaped niche** ("C# stored procedures" as
  durable Rx queries) is post-v1 research; genuinely
  open territory because no upstream has Rx, durability,
  and retraction-native semantics in one box.

Remaining gaps the product-visionary walks on first
audit:

- Which SQL dialect lands first in v1? T-SQL, PostgreSQL,
  SQLite (all three? incremental?)?
- What's the license shape — Apache-2 / MIT / LGPL / dual-
  licensed AGPL+commercial? Licensing is a commercial-
  trajectory lever worth deciding before the commercial
  trigger fires.
- Entity Framework provider surface — full LINQ provider
  or incremental rollout (query first, then save-changes,
  then migrations)?
- F# DSL name — does it need a name distinct from the
  computational-expression builder syntax, or is
  `circuit { ... }` the permanent brand?
