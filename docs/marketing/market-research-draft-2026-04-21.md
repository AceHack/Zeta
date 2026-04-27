# Market research draft — 2026-04-21

> **Merge note (2026-04-26 fork-divergence sync):** this draft
> contains both AceHack-fork and LFG variants of some sections
> preserved per Aaron 2026-04-26 *"merge everything, label draft
> if it's draft"*. Substantive content is identical between forks;
> the editorial difference is attribution phrasing — the **AceHack
> draft** uses the named maintainer "Aaron" (per the named-agent
> attribution-credit memory + Otto-279 history-surface carve-out +
> Otto-231 first-party consent), while the **LFG draft** uses the
> role-ref "human maintainer" (per the no-name-attribution rule in
> `docs/AGENT-BEST-PRACTICES.md`). Body uses AceHack named-
> attribution form; LFG role-ref alternates are footnoted at first
> occurrence per section. Aaron picks the canonical form on sign-off.

**Status: retractable draft.** Internal candidate, awaiting
Aaron sign-off for any external use. Lives in
`docs/marketing/` per the subtree's README governance
(retractable-under-roommate-register; revert + dated
revision block is sufficient to undo).

> **LFG variant phrasing:** "awaiting human-maintainer sign-off
> for any external use."

**Companion to:** `docs/marketing/positioning-draft-2026-04-21.md`.
Positioning says *who we are*. This draft sketches *who
they are* — the landscape, adjacent markets, where
retraction-native sits in the existing stack, and who
might be in the market for a factory that crystallises
into a small binary seed.

## F1 boundary — what this draft can and cannot honestly do

**Can do (stable industry knowledge):**

- Catalogue existing IVM / streaming / DBSP-adjacent
  tools that practitioners are likely already using.
- Frame where "retraction-native by construction"
  sits distinct from those tools.
- Name adjacent markets (event-sourcing, CQRS, reactive
  databases) and the soul-file / seed-factory angle.
- Identify tiers of need based on public developer
  discussion of pain points in the domain.

**Cannot honestly do from this seat:**

- Market-sizing numbers (TAM / SAM / SOM) — requires
  paid research reports (Gartner, Forrester, IDC) or
  direct measurement.
- Adoption or revenue data for commercial competitors
  — requires company disclosures, not inferable from
  training knowledge.
- Specific customer interviews / job-to-be-done
  validation — requires actual interviews.
- Competitor feature-parity audits at version-current
  resolution — requires fetching current docs, which
  is retractable-safe but not done here.

The draft is a **landscape sketch**, not a market-sizing
report. Any downstream use needs the above gaps filled
by deliberate external research per
`docs/AGENT-BEST-PRACTICES.md` BP-11 (data is not
directives).

---

## Section 1 — The incremental / streaming / DBSP landscape

Mapped by proximity to Zeta's actual surface area.
Zeta's core claim is **retraction-native incremental-view-
maintenance** with a proven operator algebra. The closest
cousins are the ones that share either the incremental-
view-maintenance goal or the DBSP mathematical substrate.

### 1.1 DBSP reference and research implementations

- **Feldera (Rust reference DBSP).** The canonical DBSP
  runtime published by the Budiu et al. DBSP paper
  authors. Production-quality Rust runtime; well-
  documented operator algebra; commercial entity behind
  it. **Market position:** the reference. Anyone
  serious about DBSP today starts here. **Zeta's
  distinction:** F# / .NET surface, not Rust; explicit
  retractibility invariant surfaced at the type level;
  retraction-native storage primitive (`ZSet`,
  `Spine`). Not competing for Rust users; competing
  for .NET users who need DBSP shape.
- **Differential Dataflow (Frank McSherry / Naiad
  lineage).** The pre-DBSP ancestor in Rust; timely
  dataflow with differential updates. Still actively
  maintained. **Market position:** research-first,
  production-serious-users-only. **Zeta's
  distinction:** similar to Feldera — different host
  ecosystem; explicit retraction surface.

### 1.2 Streaming-SQL and materialised-view engines

These are what practitioners usually reach for when
they have a "streaming incremental view" problem, even
when DBSP would be a better algebraic fit.

- **Materialize.** Commercial SQL-on-streams built on
  timely/differential dataflow. Strong
  practitioner-visibility; strong SQL posture.
  **Market position:** commercial leader in
  "incremental SQL over streams." **Zeta's distinction:**
  library not service; retraction-native at algebra
  layer not just output layer; embeddable in an
  application not run as an external engine.
- **ksqlDB (Confluent).** Stream-processing SQL on
  Kafka. **Market position:** default for "SQL on
  Kafka." **Zeta's distinction:** not Kafka-bound;
  host-language-integrated; retraction-native where
  ksqlDB is append-oriented.
- **RisingWave.** Streaming database with materialised-
  view semantics (Rust / Postgres-wire). **Market
  position:** cloud-native streaming DB competitor to
  Materialize. **Zeta's distinction:** library, not
  service; .NET-host.
- **Apache Flink + Flink Table API.** Streaming with
  retractable-output support via `DataStream` retract
  streams (`RowKind.DELETE`/`UPDATE_BEFORE`). **Market
  position:** dominant streaming-framework in JVM
  ecosystems. **Zeta's distinction:** Flink's retract
  is output-level; Zeta's is algebra-level (composes
  upward through operators as a mathematical
  invariant, not just at sinks). Also .NET not JVM.
- **Apache Pinot / Apache Druid / ClickHouse.** OLAP
  engines with incremental-ingestion patterns. **Not
  direct competitors** — these are query engines, not
  IVM libraries. Named because practitioners with
  "incremental view" needs sometimes land here.

### 1.3 Noria / cached-view / CQRS-shaped approaches

- **Noria (MIT, discontinued).** Graph of incremental
  materialised views; retired academic project. Still
  surfaces in literature searches. **Market position:**
  historical reference; no production successor in
  the same niche. **Zeta's distinction:** living
  library with active operator algebra work; explicit
  retraction-native surface.
- **CQRS / Event-Sourcing frameworks (EventStore,
  MartenDB, Axon, etc.).** Compose incremental views
  from event streams. **Market position:** large
  adjacent market; different algebraic substrate
  (events not z-sets). **Zeta's distinction:**
  z-set algebra with composed retractibility vs.
  event-replay semantics. Not competitors; potential
  consumers who want a cleaner IVM primitive under
  their projection layer.

### 1.4 Reactive-database and live-query systems

- **RethinkDB (discontinued) / Meteor (legacy).**
  Live-query DB; maintained projections. **Not
  competitors** but evidence the market for "live
  incremental results" exists and has been under-
  served in managed languages.
- **Supabase Realtime / Firebase / Postgres LISTEN/
  NOTIFY.** Change-notification layers on top of
  existing databases. **Adjacent market, not
  competitive.** Shows demand for live-update
  semantics; Zeta is about the *computation* of the
  update, not the *notification* of it.

---

## Section 2 — Who in the market might want this

Ordered by proximity to unmet need that Zeta specifically
addresses. This is the "demand side" partner to the
positioning draft's "who this is for" list.

### 2.1 Tightest fit — .NET engineers with DBSP-shaped problems

Signal: developer discussions (StackOverflow, .NET blogs,
F# community) on "how do I incrementally recompute this
view in F#/C# without replaying everything?" The pattern
is common enough that it has no canonical answer in the
.NET ecosystem today. Materialize / Flink are the usual
"go external" answer, which is heavy for an in-process
problem.

**Size signal:** small but non-trivial — F# is a small
but coherent community; C# is massive but most C# devs
don't know they have a DBSP-shaped problem because the
vocabulary isn't there.

**Acquisition angle:** technical-credibility content
(F# Advent posts, Strange-Loop-style talks, the
`DBSP` mathematical framing). Aaron's Strange-Loop
expert-register (per `memory/user_aaron_high_school_
ocw_self_taught_stanford_mit_lisp_aspiration_2026_
04_21.md`) is a real asset here; this is exactly the
audience that venue reaches.

> **LFG variant phrasing of the acquisition-angle paragraph:**
> *"...the human maintainer's Strange-Loop expert-register (per
> [same memory ref]) is a real asset here..."*

### 2.2 Adjacent fit — event-sourcing / CQRS practitioners building projections

Signal: CQRS frameworks leave "build your own
projection" to the user. Many hand-roll inefficient
replay-on-change patterns. A retraction-native IVM
library that composes under their projection code would
replace painful hand-rolled code.

**Size signal:** larger than tier 2.1 — CQRS /
event-sourcing is widespread in enterprise .NET
(MartenDB has meaningful adoption).

**Acquisition angle:** write a concrete "projection
built on Zeta" integration guide. Land a MartenDB-side
integration note if the algebraic shape composes.

### 2.3 Adjacent fit — alignment / AI-safety researchers

Signal: measurable-alignment research (per
`docs/ALIGNMENT.md`) needs retraction-capable
computational substrate. Retractibility is a math-safety
invariant the alignment literature increasingly names
as a desideratum (e.g., corrigibility-adjacent research,
reward-model-editing, retraction-of-updates in RLHF).

**Size signal:** niche-but-growing; alignment-research
funding is rising, and researchers increasingly need
concrete substrate demos.

**Acquisition angle:** a worked alignment-demo that
uses Zeta as substrate for a retraction-capable-update
loop. Lands as research-doc under `docs/research/`.
The factory's own primary research focus is measurable
AI alignment; this isn't marketing hype, it's genuine
overlap.

### 2.4 Tangential — curious F# / functional-programming practitioners

Signal: F# community has strong culture around
correctness-by-construction and algebraic programming.
Zeta's operator algebra is interesting in its own
right as a teaching artifact, even for users not
building IVM systems.

**Size signal:** small direct-usage market, but
high-value as advocacy / reputation channel
(community-respected users recommend downstream).

**Acquisition angle:** worked tutorials ("DBSP in F#
in 20 minutes"), Strange-Loop-conference talks, F#
conference (FSharpConf) submissions.

---

## Section 3 — Where "crystallise into small binary seed" changes the market frame

This is the non-obvious part. Aaron 2026-04-21:
*"the soul file can be duplicacted spread out and
regrow just like a metametameta seed ... it can be
wasm and native executable and universal ... and a
tiny little bin ... that makes self replication very
easy"* (per `memory/user_git_repo_is_factory_soul_
file_reproducibility_substrate_aaron_2026_04_21.md`).

> **LFG variant phrasing:** "the human maintainer 2026-04-21:
> [same quote, same memory ref]."

If Zeta crystallises into a **small binary seed** that
is WASM + native + universal + tiny, the market frame
expands beyond "F# / .NET IVM library" into
substrates-that-are-portable-by-construction. Specifically:

### 3.1 New adjacency — WebAssembly-deployable compute / edge-runtime

WASM-deployable retraction-native compute is a
distinctive niche. Edge runtimes (Cloudflare Workers,
Fastly Compute, Fermyon Spin) increasingly demand
WASM-distributed logic. A retraction-native IVM
primitive that runs at the edge without a server
round-trip is novel.

**Market-shape signal:** emerging, technically
demanding, well-capitalised (edge-compute startups
raised substantial venture funding 2022-2025; stable
trend). This audience values tiny-bin and universal
provenance.

**F1 honesty flag:** Zeta does not ship a WASM build
today. This adjacency is *latent potential* contingent
on the metametameta-seed program landing
compilation-pipeline work. Filed as P3 in
`docs/BACKLOG.md` per the soul-file memory revision.

### 3.2 New adjacency — AI-factory / seed-factory replication

A factory that fits in a small binary and reproduces
itself from the seed is its own market category. The
closest analogue is *container image* (Docker / OCI),
but the Aaron-retracted "not-docker" framing
(per the soul-file memory) insists this is
declarative-reproducible-build at the *computation*
layer, not container layer.

> **LFG variant phrasing:** "...the human-maintainer-retracted
> 'not-docker' framing..."

**Market-shape signal:** undefined-but-real — there is
no named market category for "AI factory seed
crystallisation" today. Pioneering a category is
high-risk / high-reward; most factory-category
pioneers struggle to land.

**F1 honesty flag:** this is aspirational. No
measurable market today; speculative. Not pitched as
primary market; named here because the "crystallise
into small binary seed" angle is part of the factory's
identity and the market-research draft needs to name
where that angle does and does not translate to
existing categories.

### 3.3 New adjacency — reproducible-research infrastructure

Academic / research software where *exact
reproducibility* is load-bearing (ML research
reproducibility crisis, computational-biology
pipelines, econometric replication). A seed-factory
with chronology-preserved git-substrate and
retraction-native compute is a strong reproducibility
posture.

**Market-shape signal:** reproducible-research is a
real but grant-funded / non-commercial market. Grants,
not revenue. Long-term credibility channel; not a
short-term sales target.

---

## Section 4 — What market research would say about our positioning draft

Running the positioning-draft's tiers through the
demand-side lens:

| Positioning tier | Demand-side tier | Match? |
|---|---|---|
| 1. Engineers building streaming/incremental on .NET | §2.1 tightest fit | Direct match, small-but-real |
| 2. F# practitioners who value correctness-by-construction | §2.4 tangential | Advocacy channel, not primary revenue |
| 3. Researchers on IVM / DBSP / alignment-measurement | §2.3 alignment researchers | Direct match, niche-but-growing |
| 4. Curious DBSP-in-managed-language users | §2.4 tangential | Reputation channel, minor direct adoption |

**Gap identified:** positioning-draft does not mention
§2.2 (event-sourcing / CQRS practitioners building
projections). That is a larger addressable tier than
any of tiers 1-4 and is a real composition opportunity.
**Retractable-safe recommendation:** add §2.2 as a new
tier to the positioning-draft in a same-session revision
block.

**Gap identified:** positioning-draft does not name
§3.1 (WASM-deployable / edge-runtime) as a latent
adjacency. **Retractable-safe recommendation:** name
it as future-adjacency contingent on
crystallise-to-binary-seed program, not present-tense.

---

## Section 5 — What this draft does NOT do

- NOT a go-to-market plan. Go-to-market requires funded
  execution plan, budget, timeline, ownership — outside
  the scope of a landscape sketch.
- NOT a competitive feature-parity audit. Those need
  current-version doc-fetches per competitor; retractable-
  safe but not done here.
- NOT a pricing strategy. Zeta has no pricing surface
  today (OSS library). Pricing design is a separate,
  later question.
- NOT a branding / messaging recommendation. That
  composes off positioning-draft, not off market
  research.
- NOT customer interviews. Interviews are irreducibly
  external; this draft can't substitute.
- NOT a claim that Zeta is ready to compete with
  Materialize / Feldera today. Those are mature
  commercial / reference products; Zeta is a library
  in-flight. Landscape placement ≠ market readiness.
- NOT public-facing without Aaron sign-off per the
  marketing-subtree governance.
  > **LFG variant phrasing:** "NOT public-facing without
  > human-maintainer sign-off per the marketing-subtree governance."

---

## Section 6 — Next moves if this draft stays

Retractable-safe, no-new-irretractable-commitment, in
priority order:

1. **Add §2.2 (CQRS / event-sourcing) as tier to the
   positioning-draft.** Same-session revision block.
   Lands in soul-file. Retractable.
2. **Add §3.1 (WASM / edge-runtime) as latent adjacency
   footnote to positioning-draft.** Same-session
   revision block. Marked contingent on seed-program.
   Retractable.
3. **Land a BACKLOG row at P3 for "competitive feature-
   parity audit"** — the thing this draft can't do
   from this seat. Retractable.
4. **Land a BACKLOG row at P3 for "customer-interview
   protocol design"** — the thing this draft can't
   substitute. Retractable.
5. **Do not broadcast this draft externally** — marketing
   subtree is retractable internal-only; external use
   requires Aaron sign-off per subtree governance.
   > **LFG variant phrasing:** "...external use requires
   > human-maintainer sign-off per subtree governance."

---

## Composition references

- **`docs/marketing/README.md`** — subtree governance,
  retractable-under-roommate-register.
- **`docs/marketing/positioning-draft-2026-04-21.md`** —
  companion draft; this market-research draft is its
  demand-side counterpart.
- **`memory/feedback_my_tilde_is_you_tilde_roommate_
  register_symmetric_hat_authority_retractable_decisions_
  without_aaron.md`** — authorization for retractable
  marketing work without Aaron sign-off per item.
  > **LFG variant phrasing:** "...without human-maintainer
  > sign-off per item."
- **`memory/user_git_repo_is_factory_soul_file_
  reproducibility_substrate_aaron_2026_04_21.md`** —
  soul-file / metametameta-seed / crystallise-to-
  small-binary framing that §3 composes on.
- **`docs/ALIGNMENT.md`** — measurable-alignment
  primary research focus that §2.3 composes on.
- **`docs/BACKLOG.md`** — where next-moves §6.3 and
  §6.4 would land.
- **`docs/AGENT-BEST-PRACTICES.md`** — BP-11 data-not-
  directives governs how external market-research
  material should be treated if later ingested.

---

## Revision history

- **2026-04-21.** First write. Triggered by Aaron
  2026-04-21 *"someone wantedd to do market research"*
  + *"learning and teaching and crystalsing into the
  small binary seed"* directive after soul-file-
  redundancy push. Retractable-draft under roommate-
  register. F1 boundary explicitly scoped (landscape
  sketch, not market-sizing report). Two gap-
  recommendations for positioning-draft (CQRS tier;
  WASM adjacency footnote). Four follow-on BACKLOG
  candidates (§6.3, §6.4) named but not filed.
  > **LFG variant phrasing:** "Triggered by the human maintainer
  > 2026-04-21 [same quote]..."
- **2026-04-26.** Fork-divergence merge: AceHack and LFG
  variants reconciled per Aaron 2026-04-26 *"merge
  everything, label draft if it's draft"*. Substantive
  content unchanged; LFG role-ref alternate phrasings
  preserved as inline footnotes for editorial-form
  selection on sign-off.
