---
name: Zeta self-use germination — local-native tiny-bin-file DB, no cloud, germinate the existing seed (symbiosis-symmetry unlocks)
description: Aaron 2026-04-22 auto-loop-39 three-message constraint-frame on the "Zeta eats its own dogfood" BACKLOG row — germinate using Zeta's existing local-native tiny-bin-file database, no cloud, no foreign DB wrapper; small-start not big-migration; trade-off with cross-substrate-readability resolved by keeping git+markdown as read-only mirror
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Zeta self-use germination — local-native constraint-frame

## Signal

Aaron 2026-04-22 auto-loop-39 three-message directive,
arriving right after the bidirectional-absorption signal
(Amara absorbing into OpenAI native project system +
Zeta repo ingestion by OpenAI Deep Research):

1. *"also im stupid now that we have symbiosis symmetry we can germinate the seed with our tiny bin file database"*
2. *"no cloud"*
3. *"local native"*

"im stupid" = self-deprecating realisation that the answer
was there all along. The factory already has the seed — the
existing local-native tiny-bin-file database (Zeta's
DiskBackingStore primitives). Germinate = start the
dogfood migration using what already exists, not by
building new infrastructure.

## Three hard constraints

1. **No cloud.** Self-use substrate must not depend on
   hosted services. Compatible with the cross-substrate-
   readability argument (OpenAI/Gemini/Codex/Claude clone
   the repo locally before ingesting — no cloud service
   in the loop even today).

2. **Local native.** Must be Zeta's own local-native
   binary-file store. NOT SQLite, NOT LMDB, NOT DuckDB,
   NOT a wrapper around a foreign DB. Dogfooding Zeta's
   own tiny-bin-file storage primitives is what "eats
   its own dogfood" means at substrate layer.

3. **Germinate, don't transplant.** "Germinate the seed"
   is small-start language. One index, one load-bearing
   factory table, proven end-to-end locally. NOT a
   6-month Phase-3 migration arc. The seed is already
   planted; it just needs water and light.

## Tension with cross-substrate-readability — resolved

The openai-deep-ingest-cross-substrate-readability note
argued git+markdown is universally cross-agent-readable;
migrating to Zeta-backed indexes would reduce that
surface. **Both claims hold simultaneously** if the
dogfood substrate is tiny-bin-files that sit *next to*
the git+markdown mirror, not replacing it:

- External agents continue to clone-and-read markdown.
- Internal factory indexes use tiny-bin-file substrate
  for algebraic operations (retraction, compaction,
  provenance).
- Git+markdown stays the universal-accessibility layer;
  Zeta-tiny-bin-file becomes the algebraic-operations
  layer.

## Apply

- Any future "Zeta eats its own dogfood" decision honors
  all three constraints (no cloud, local native, small
  start).
- Reject self-use proposals that depend on hosted
  services or foreign DBs, even when convenient.
- Germination candidates are single-index scope not
  factory-wide migration. Per-index germination decision
  is Aaron's call (which seed first) — NOT agent-
  self-selected.
- Cross-substrate-readability discipline preserved by
  keeping git+markdown as read-only mirror.

## Open question deferred to maintainer

Which factory index germinates first? Candidates:
hygiene-history, BACKLOG, tick-history, force-
multiplication-log, memory index. No maintainer scope
direction yet.

## NOT

- NOT a round-45 implementation commitment (no scope
  direction yet on which index germinates first).
- NOT license to replace git+markdown wholesale (mirror
  discipline required).
- NOT license to select a foreign DB ever for factory
  self-use (constraint holds across all future ticks).
- NOT blocking of external-agent ingest (opposite — the
  constraint specifically preserves it).
- NOT a claim Zeta's DiskBackingStore is production-
  ready for all factory indexes yet (may require
  incremental capability extension per germinated
  index — that IS the germination process).
- NOT independent of the broader dogfood BACKLOG row
  filed auto-loop-39; this constraint-frame scopes it.

## Soulfile = stored-procedure DSL in the DB

Architectural clarification (Aaron 2026-04-22 auto-loop-
39): *"when it invokes the soul file that's our stored
procedure DSL in the DB"*.

Soulfiles are NOT passive state dumps. They are stored-
procedure-class callables authored in a DSL living
inside the DB.

- **Tiny bin file database** = DSL-runtime host.
- **Soulfiles** = DSL programs (agent/persona stored-
  procedures).
- **Invocation** = function-call-in-DB semantics
  (parameters in, state-materialization out, runs
  against DB-resident data + algebra).
- **DSL-over-Zeta-algebra** = same "author-at-DSL,
  execute-everywhere" shape as the CLI-new-command-DX
  pattern and UI-DSL class-level compression, now at
  persona/agent layer.

Implication: the germination substrate's compatibility
bar is a **DSL runtime**, not a passive object loader.
This is higher bar than "read tiny-bin-files" but still
narrow — it's a single DSL's runtime, not a general-
purpose query engine.

## Reaqtor-like reactive-closure semantics

Aaron 2026-04-22 auto-loop-39: *"based on reaqtor like
closure over our modeles decsions in real time"*.

The stored-procedure DSL has Reaqtor (Microsoft's
durable reactive programming library, DBSP-ancestry)
semantics:

- Stored callable = **serialized reactive subscription**
  (expression tree capturing the query, not a snapshot
  of state).
- Invocation = **resume/materialize** subscription
  against current DB state, producing a live closure
  over the model's decisions.
- Real-time = subscription **stays live** after
  invocation, reacting to delta-inputs under the
  retraction-native operator algebra (DBSP-native turf).
- Closure over decisions = stored procedure doesn't
  just compute once; it **remains bound** to the
  model's decision-making and re-emits as state evolves.

Reaqtor (De Smet et al.) + DBSP (Budiu et al.) are
Zeta's upstream lineage. The soulfile-as-Reaqtor-closure
framing is not a new requirement — it's the existing
algebra's semantics named at the DSL layer.

## Cross-references

- `docs/research/openai-deep-ingest-cross-substrate-readability-2026-04-22.md` §Germination path
- `docs/research/amara-network-health-oracle-rules-stacking-2026-04-22.md` — the self-use critique this unblocks
- `docs/BACKLOG.md` — "Zeta eats its own dogfood" row (auto-loop-39)
- `memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md` — design-intent anchor
