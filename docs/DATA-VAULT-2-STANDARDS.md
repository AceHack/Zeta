# Data Vault 2.0 standards — the maintainer's six-book synthesis (2016)

**Register: `unmetered`.** This is imported practice, not measured fact. Nothing in
this repository currently depends on any rule below, and no test fails if one is
wrong. Per [`toy-is-free-metered-must-be-earned`](../.claude/rules/toy-is-free-metered-must-be-earned.md),
that makes the whole document `unmetered` — implemented-and-used somewhere else,
never falsified here. Say "the DV2.0 literature holds X", not "X is true".

## Provenance

Aaron Stainback wrote two documents in **August–September 2016** — a standards
workbook and a teaching deck — after reading the Data Vault 2.0 literature in a
single binge. He built the deck as an engineering advisor, to teach the method to
the engagement he was advising. That employment history is already on the record
here (`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`), so it is
named rather than coyly elided; what does **not** come over is any of that
engagement's labels, systems or data. Handed to this repository 2026-08-24:

> *"these are my data vault 2.0 standards i wrote up after reading like 10 books on
> the subject in a binge session, none of this is proprietary, it all points to
> public and published books on the data vault 2.0 subject. we should incorporate
> the knowledge in our repo where it makes sense, just don't pull over any of the
> Itron labels — this is a presentation i made to teach them about Data Vault as a
> engineering advisor."*

**Two registers, kept separate throughout:**

| Register | What it covers | Cited as |
|---|---|---|
| **Beacon — the books** | Every DV2.0 construct, rule and definition below | The six published works, `docs/PRIOR-ART-LIST.md` §Data Vault 2.0 |
| **Secondary — the synthesis** | The *selection*, the *taxonomy indices*, the field-level standards, and the extensions marked below | Aaron Stainback, 2016, this document |

The source documents carry `ref-N.N` markers that resolve into their own References
sheet, which is the six-book list. That cross-reference is what makes this a
**secondary source pointing at primary ones** rather than an unanchored coinage.
The books are the anchor; the synthesis is his.

## What was stripped, and what that leaves

The engagement's identity does not come over. Removed at seven sites, enumerated so
the removal is auditable rather than asserted:

| # | Source location | What was there | Disposition |
|---|---|---|---|
| 1 | Deck slide 1 title | The client's name in the document title | Dropped; not carried |
| 2 | Both files' document metadata | The client's name in `dc:title` | Not carried (binaries are not committed) |
| 3 | `RecordSource` field | A named internal source system, schema and table | Replaced with `<SOURCE>.<schema>.<table>` |
| 4 | Raw Vault / Hub notes | A named internal technical key | Generalised to "a source-system technical key" |
| 5 | Information Mart notes | Two of the engagement's domain-specific mart names | Replaced with two neutral personas |
| 6 | Loading System notes | A sentence naming the client's own transport product | Dropped entirely |
| 7 | Hub / Link / rate-of-change examples | Domain entities and a device hierarchy from the client estate | Replaced with domain-neutral entities |

**No confidentiality marking, classification banner, or internal data was found in
either file.** Both were scanned for `Confidential` / `Proprietary` / `Internal Use`
and for the client name across all sheet text, slide text and document properties.
The client name appeared exactly twice, both in titling, never in the body. Nothing
triggered a stop condition. What remains is method — the same method the six books
teach — carrying no schema, no data and no system name from the estate it was
taught to.

**Deliberately not imported:** the workbook's per-entity SQL Server 2016 storage
tuning (clustered columnstore vs. memory-optimised tables, filegroup and partition
choices, recovery models). It is platform advice with a high rot rate, this
substrate does not run SQL Server, and importing it would dress a decade-old tuning
guide as current standard. Where a storage note carries a *structural* reason —
change-rate splitting, partition keys following the grain — the reason is kept and
the product detail is dropped.

## Why this repository cares

`.claude/rules/dv2-data-split-discipline-activated.md` makes DV2.0 one of seven
always-active substrate-engineering disciplines, and the repo already leans on two
of its properties: **change-rate partitioning** (hub / link / satellite as a
repo-split and skill-design lens) and **conflict retention** (`docs/CONCEPT-REGISTRY.md`
— a single version of the facts, never a single version of the truth). This
document supplies the layer under those two sentences: the full construct taxonomy,
the area architecture, and the field set the constructs are built from.

`.claude/skills/data-modeling-and-ontology/blueprints/data-vault-expert.md` is the
existing Zeta-side authority on the triad and is **not superseded** by this file. It
covers hub/link/satellite mechanics, hash keys, raw-vs-business rules, PIT/bridge and
ghost records. This document extends it with the parts it does not carry: the
specialisation taxonomy, the business-key scope ladder, the area/schema architecture,
and the maintainer's own extensions.

## 1. The prime directives (deck slide 4; anchor 7.1)

The properties a Data Vault is supposed to have. Reproduced because the list is the
compact statement of *why* the constructs are shaped as they are:

- **Integrated** — extend source-system scope toward enterprise scope so other
  systems can integrate against it.
- **Time variant** — the history of each source system is stored and analysable.
- **Non-volatile** — because most source systems do not keep history, the vault
  becomes the source of facts for historical data.
- **Subject oriented** — organised by subject matter, not by operational function.
- **Atomic level** — the lowest available grain is captured.
- **Enterprise scope** — data is integrated to become enterprise-wide.
- **Auditable** — every row traces back to the source system or the business rule
  that created it. This is what makes the data trustworthy rather than merely present.
- **Scalable** — to any size, including big data.
- **Agile** — shifting requirements are expected; absorbed through virtualisation.
- **Real time** — nightly batches alone are not acceptable.
- **Metadata, automation, metrics and BI are run on the warehouse itself.**
- **Master-data integrated** — corrections can flow back to source systems.

**Single source of facts, not single source of truth.** The literature's phrase, and
the load-bearing one for this repository: the vault is explicitly built so that
disagreement between systems stays *visible* rather than being reconciled away.
`docs/CONCEPT-REGISTRY.md` already treats this as the defining property.

## 2. Colour category analysis — the lens that separates the three methods

Anchor: 7.2 §5, "Colors of Data Vault". Split every model's columns into three
colours — **keys**, **relationships**, **context** — and the differences between
3NF, dimensional and Data Vault stop being stylistic:

| Method | Keys / relationships / context |
|---|---|
| **3NF** | All three mixed in one table |
| **Dimensional** | All three mixed, plus duplication on change |
| **Data Vault** | Decomposed — hubs hold keys, links hold relationships, satellites hold context |

Four consequences the deck draws from this, in its own order:

1. **Space.** Dimensional modelling copies an entire entity when any one attribute
   changes ("space explosion"). Data Vault splits context by rate of change, so only
   the changing attribute's satellite grows.
2. **Load order.** Dimensional loading needs complex ordered dependencies.
   Decomposition plus deterministic hash keys removes them — every hub, link and
   satellite can load in parallel, in any order.
3. **Re-engineering.** Because the backbone is business keys, which are the most
   stable thing an enterprise has, schema change is normally **additive and
   backwards compatible** — evolution rather than revolution.
4. **Communication.** The logical, physical, business and technical models are
   near-identical, so one diagram serves stakeholders and engineers alike.

> Aaron's own framing, deck slide 5: *"Data Vault 2.0 can be viewed as Graph Theory
> applied to Relational Databases."* Recorded as his gloss, not as a claim from the
> books.

## 3. The business-key scope ladder

The single most portable rule in the workbook, stated there three times (Raw Vault,
Business Vault, Hub). Business keys are preferred in this order, **worst to best**:

| Rank | Kind | Why it ranks there |
|---|---|---|
| 4 (worst) | Application-specific **surrogate** key | Carries no business meaning; exists only inside one application. Mainly useful as a same-as-link target. |
| 3 | Application-specific **business** key | Real meaning, but scoped to one application; usually needs combining to become unique. |
| 2 | **Organisation-wide** unique business key | Substantial value; the more hubs use these, the more stable the system is over time. |
| 1 (best) | **Globally** unique business key | Maximum value. The deck calls these "the holy grail" and says extreme care should be spent identifying them. |

The workbook gives each rung its own hub type (§4 below) so the rank is visible in
the model rather than living in a reviewer's head. **This ladder is the reason hub
stability is a property and not an aspiration** — a hub keyed at rank 1 survives
source-system replacement; a hub keyed at rank 4 does not.

Also permitted at hub level: **smart keys** (UPC, VIN — a composite with internal
structure, which "lifts" lower keys) and **composite keys** (used only when no
single organisation-wide key exists).

## 4. Standard fields

The workbook's sheet 0 — the field vocabulary every construct is assembled from.
This is the most *synthesis-heavy* part of the source: the books supply the fields,
the consolidation into one governed list with mandatory/optional/by-construct
status is his.

### Mandatory, everywhere

| Field | Meaning |
|---|---|
| `LoadDate` | When the row entered the vault. Batch: the batch load time. Real time: the exact timestamp. Bulk history: back-dated to what the date *would have been* had the system been running normally then. |
| `RecordSource` | Where the row came from — `<SOURCE>.<schema>.<table>`, or a marker such as `Default Data`, `Generated Data`, `Deduplication`, `Cleansed`, or a business-rule identifier pointing at the rule that transformed it. |

Two notes on `LoadDate` worth keeping, both his:

- **It is a geological epoch, not a timestamp.** *"It's the layer when this data was
  created in the system, it flows through everything starting from the source."*
- **It replaces batch identifiers entirely.** No import id, no batch id — the load
  timestamp *is* the batch key, and operations tables can hang success/failure status
  off it directly.

### Optional, common

| Field | Meaning |
|---|---|
| `LoadEndDate` | End of the row's validity window. Flagged in the source as *not yet demonstrated useful* — see §8. |
| `LastSeenDate` | Tracks **soft deletes**: a business rule declares that a source silent for some period is deleted. Also a staleness signal. Not for satellites. |

### Optional, satellite-borne (source-supplied, therefore context)

`ExtractionDate`, `CreationDate`, `ModifiedDate`, `BeginDate`, `EndDate`.

The governing principle is uniform and worth stating on its own: **a date the
warehouse did not generate is descriptive data, not system data.** Source dates may
be in any time zone, may be unreliable, and are outside the warehouse's control — so
they live in satellites and are treated as context. `BeginDate`/`EndDate` require the
source to support CDC or audit tracking, and are driven by the parent link's driving
key.

### Keys

| Field | Meaning |
|---|---|
| `HashKey` | Hash of the business key. The primary key. This is what lets data move between storage systems and load in parallel. |
| `BusinessKey` | The natural key, owned by the hub, at the highest scope available (§3). |
| `DependentChildKey` | A degenerate field — line number, sequence — meaningless alone, meaningful inside a larger business-key context. |
| `ParentHashKey` | A satellite's parent hub or link hash. With `LoadDate`, uniquely identifies a satellite row. |
| `HashDiff` | Hash over the descriptive columns only. Makes change detection a single comparison instead of a column-by-column diff. |
| `DrivingKey` | In a multi-hub link, the key whose change means a *new relationship* (new link row) rather than a *changed relationship* (new satellite row). |

**The `DrivingKey` distinction is the subtlest rule in the document** and is worth
reading twice: a driving-key change creates a new link row; a non-driving-key change
is historised in the satellite exactly like a context change. That single choice
determines the grain of every relationship in the model.

### Two fields that are his, not the books'

| Field | Meaning |
|---|---|
| `Strength` | A correlation rating on a link, written by mining/ML. |
| `Confidence` | A confidence rating on the same. |

Anchored to 7.3's "Strength and Confidence Ratings in Links", so the *idea* is in the
literature; the promotion to a standard field on four named link types is his. He
flags his own open problem in place, and it is a good one:

> *"it could be important to represent probability distributions here too instead of
> simple floats. This would likely require a specialized clr or binary data type."*

A float collapses a distribution to a point estimate. Naming that as unfinished in
2016 rather than shipping the float silently is the same discipline this repository
now calls refusing to round up.

## 5. The construct taxonomy

The workbook's core contribution: every specialisation the six books describe,
indexed, with its anchor. Entries marked **[ext]** are declared in the source itself
as *"not part of the standard data vault model"* — see §7.

### 5.1 Hubs — business keys, no context, no history

| Index | Type | Purpose |
|---|---|---|
| 3.1 | **Hub** | The core. Business keys plus their hash. No context. No history. |
| 3.1.1 | **SmartHub** | Keyed on a smart key (UPC, VIN). Components should be broken out into columns where possible. |
| 3.1.2 | **Chub** | Composite hub — used only when no single organisation-wide key exists. |
| 3.1.3 | **Ashub** | Application-specific *surrogate* hub. Rank 4. "Should be avoided if possible." |
| 3.1.4 | **Abhub** | Application-specific *business* hub. Rank 3. |
| 3.1.5 | **Ohub** | Organisation-wide unique business hub. Rank 2. |
| 3.1.6 | **Ghub** | Globally unique business hub. Rank 1. |

Two hub rules that carry weight:

- **No non-key data in a hub.** Adding anything beyond key and hash makes the hub
  non-auditable, because there is nowhere for the change to be historised.
- **Foreign keys stay disabled** between hubs even where a "virtual parent" exists.
  Enabling them would impose load ordering — the exact property the model exists to
  avoid. The stated exception is a key the warehouse team itself controls.

### 5.2 Links — relationships, no context, no history

| Index | Type | Purpose |
|---|---|---|
| 3.2 | **Link** | Two or more hub keys plus a hash over their combination. Always physically many-to-many. |
| 3.2.1 | **Tlink** | Non-historised / transaction link — immutable events, telemetry, logs. Timestamp becomes part of the identifying key. |
| 3.2.2 | **Hlink** | Hierarchical link. Two kinds: **sub-typing** (one instance has exactly one lower classification) and **role-playing** (one instance plays several roles). |
| 3.2.3 | **Salink** | Same-as link — two keys denote the same entity. The duplicate-resolution construct. |
| 3.2.4 | **Lvlink** | Low-value / non-descriptive link — exists only to join. Where `Strength` and `Confidence` earn their place. |
| 3.2.4.1 | **Calink** | Computed aggregate link — pre-computed totals and summaries. System-generated record source. |
| 3.2.4.2 | **Xlink** | Exploration link. **Explicitly fragile and explicitly deletable** if the exploration does not pay off. |
| 3.2.5 | **Dlink** | Dynamic link — generated by mining/ML to surface relationships nobody asked for. |
| 3.2.6 | **GeoLink** **[ext]** | Geospatial link — hubs to geographic areas. |

Three link rules:

- **Links are always many-to-many physically.** The real cardinality is expressed by
  whether one or many satellite rows may be active — never by constraining the link.
- **Link-to-link is legal in logical design and forbidden in physical design.** It
  must be normalised away, because a link pointing at a link reintroduces load ordering.
- **Business keys are denormalised into the link** deliberately, to cut joins when
  building facts against type-2 dimensions later. A rare, reasoned denormalisation.

Aaron's aside on the naming, kept because he is right:

> *"I really hate the name non-historized link table because the biggest difference
> between Link tables and Tlink tables is often the introduction of a date and time
> column."*

### 5.3 Satellites — context and history

Satellites outnumber every other construct in a well-formed vault.

| Index | Type | Purpose |
|---|---|---|
| 3.3 | **Satellite** | Context at the parent's grain plus a timestamp. Delta-only: a row loads only if something changed. |
| 3.3.01 | **Tsat** | Transactional satellite — immutable event context. Paired with Tlink. |
| 3.3.02 | **OverSat** | Overloaded satellite — a satellite that *should* have been split and was not. Forbidden in the raw vault, discouraged in the business vault, free in info marts. |
| 3.3.03 | **MultiSat** | Multi-active-row satellite. Models many-to-many but changes the grain away from the parent. "Use very sparingly" — prefer a new hub at the desired grain. |
| 3.3.04 | **Esat** | Effectivity satellite — when a relationship became effective, per the source. |
| 3.3.05 | **Rsat** | Record-tracking satellite — richer alternative to `LastSeenDate`; every appearance inserted, no delta tracking. |
| 3.3.06 | **StatusSat** | Status tracking — the general case of Esat. Insert/update/delete, but also full state machines. |
| 3.3.07 | **GenSat** | Computed satellite — where most soft business rules live. Record source points at the rule or user story. |
| 3.3.08 | **ClassSat** | Classification satellite — split by data type class: fixed width, variable width, variable length. |
| 3.3.09 | **SourceSat** | Source-system satellite. **Required** in the raw vault — this is what makes parallel, order-free loading possible. |
| 3.3.09.1 | **VersionSat** | Split by source-system version, for breaking schema changes. |
| 3.3.10 | **ChangeSat** | Rate-of-change satellite — fast/medium/slow attributes separated. |
| 3.3.11 | **GeoSat** **[ext]** | Geospatial satellite. |
| 3.3.12 | **LogicSat** **[ext]** | Split on logical groupings in the source. |
| 3.3.13 | **Fsats** **[ext]** | File satellite — backed by file-stream storage. |

**Why satellites split.** Classification, data type, **rate of change**, source
system, size, spatiality. Rate-of-change splitting is the one this repository's
carved rule already names, and the source's example makes the economics plain: an
attribute that never changes and an attribute that changes daily, stored in one
satellite, duplicate the never-changing one on every daily write.

**One parent, always.** A satellite carries exactly one foreign key, to its hub or
link. This is what keeps the graph acyclic and loadable in any order.

**The re-split procedure is worth having written down**, because rate of change is
not stable over a system's life:

1. Build the new split **in parallel** with the existing satellites.
2. Write views that reconstruct the original from the split, and test them against
   it. The operation must be **completely reversible**.
3. Only then migrate downstream consumers, testing the same way.
4. Only after the business accepts the result, drop the originals.

And his ambition for it, flagged as unbuilt:

> *"This is one of those places we could really apply a force multiplier by using the
> meta data and metrics mart in combination to automatically discover velocity changes
> and re-organize structure automatically with no human intervention."*

That is a self-modelling database that re-partitions itself by measured change rate.
It was not built in 2016 and is not built here — recorded as an ambition, not a claim.

### 5.4 Query assistants

| Index | Type | Purpose |
|---|---|---|
| 4.1 | **Pit** | Point-in-time table around **one** hub or link: the current key and timestamp from each of its satellites, so a multi-satellite view is one join. Also used to buffer real-time data down to a fixed interval. |
| 4.2 | **Bridge** | The same idea across **many** hubs and links. |

Both are **derived and disposable** — they are performance structures, and a query
assistant that starts computing values has quietly become a computed satellite (Pit)
or an exploration link (Bridge). The source says so explicitly, which is a good
example of the taxonomy policing itself.

### 5.5 Reference and metadata

| Index | Type | Purpose |
|---|---|---|
| 2.1 | **Reference** | "Mini hubs" for things that are not business keys — country codes, type codes, calendars. No parent. |
| 2.1.1 | No-history reference | The plain case, 3NF-shaped. |
| 2.1.2 | History reference | A no-history reference plus a standard satellite. Nothing new is invented. |
| 2.1.3 | Code and descriptions | Codes, descriptions, a category. Satellite if history is wanted. |
| 2.2 | **Metadata** | Back-room (technical) and front-room (business) metadata. |
| 2.2.1 | **Taxonomy** | A list of related words. *"When there is a relationship between the words the taxonomy is called an ontology."* Historised, because they drift. |

A neat structural test from the source: **reference tables are never partitioned.**
If you find yourself wanting to partition one, it is not a reference table — it is a
hub.

### 5.6 Dimensional output

| Index | Type | Purpose |
|---|---|---|
| 5.1 | **Fact** | Projected from a link and its satellites. Additive / semi-additive / non-additive measures. |
| 5.2 | **Dimension** | Type 1 (current) from hub + satellite; type 2 (history) from the satellite or a Pit table. |

Dimensional models are an **output format**, built in the information mart and
treated as disposable. This is the Inmon/Kimball reconciliation the method is known
for: audit-first storage, Kimball-shaped delivery, and the delivery layer can be
thrown away and rebuilt from the vault at any time.

## 6. The area architecture

The workbook assigns every construct to a schema, and the schema list *is* the
architecture. Areas marked **[ext]** are declared in the source as outside the
standard model.

| Index | Area | Schema | Holds |
|---|---|---|---|
| 1.1 | **Stage** | `stage` | Near-identical copies of source tables. Hard (reversible) rules only. 1–10 days of history; the raw vault holds the rest. |
| 1.1.1 | Data lake staging | `lake` | The raw data pond — the lake-world synonym for staging, and equally short-lived. |
| 1.2 | **Raw vault** | `raw` | Hubs/links/satellites at source fidelity. **Staging must be reconstructable from it.** |
| 1.2.1 | Application pond | `app` | The lake's nearest equivalent to the raw/business vault. |
| 1.2.2 | **File vault** **[ext]** | `file` | A raw vault centred on files. |
| 1.3 | **Business vault** | `business` | Soft (one-way) rules applied. **Virtualise by default** — views, not tables. |
| 1.4 | **Metrics vault** | `metrics` | The warehouse's telemetry about itself, modelled as a vault. |
| 1.5 | **Information mart** | `info` | Whatever shape the UI wants. Many marts, one per persona or concern. |
| 1.5.1 | Report mart | `report` | Report-shaped and report-historised output. |
| 1.5.2 | Stream mart | `stream` | Real-time, often entirely in memory, short windows. |
| 1.5.3 | **Error mart** | `error` | Every rejected record from every stage. All columns wide enough to hold bad data; no constraints. |
| 1.5.4 | **Meta mart** | `meta` | The metadata that drives code generation. |
| 1.5.5 | Metrics mart | `metrics` | UI-ready view of the metrics vault. |
| 1.6.x | **Operations** **[ext]** | `system`, `mem`, `data`, `generate`, `test`, `operations`, `schedule`, `job`, `quality`, `rules`, `workflow`, `identity`, `real`, `load` | *"The mini OLTP that lives inside every data warehouse."* |
| 1.6.6 | **Archive** **[ext]** | `archive` | Staging for deletion, with a reload test. |

Four rules worth extracting from that table:

- **Hard rules are reversible; soft rules are not.** Staging and the raw vault admit
  only transformations from which the source can be reconstructed. Aggregation,
  bucketisation, cleansing and exclusion are one-way and therefore belong to the
  business vault or later. This is the whole raw/business split in one sentence.
- **The error mart takes everything that failed anywhere**, including source-system
  communication failures — not just malformed rows. Columns are deliberately widened
  and constraints deliberately absent, so a failure can always be *recorded*. A
  rejection that cannot be stored is a rejection that cannot be audited.
- **Virtualise by default.** The business vault and the marts should be views.
  Indexed views next. Materialised tables are a last-resort performance measure. The
  reason is agility: a view is changed by editing it.
- **The meta mart is the force multiplier.** The source is emphatic — 50–80%
  generation of tables, views, transforms and rules is reachable with modest effort,
  and neglecting it risks the project *"collapsing under its own weight"*.

### The Operational Data Vault (definition 6.2)

The endpoint the source argues for: a vault wired to master data management, which
is in turn wired to each source system, closing a **correction feedback loop**. A
correction made on a report flows back through MDM into the source system and
returns through the vault. Source systems get better over time; misalignment between
any system and the agreed business view becomes detectable.

Aaron's own emphasis, and he rations it:

> *"One other huge aspect to the ODV is automation, automation, automation! I used my
> only exclamation mark here, I have a quota of only one per document."*

## 7. Where he extends or disagrees with the books

The most interesting content, and the reason this is a synthesis rather than a
summary. Left unsmoothed.

### 7.1 Declared extensions

The source labels each of these *"This is not part of the standard data vault
model"* — self-flagged, which is the honest form:

| Extension | What it adds | Read |
|---|---|---|
| **`TenantId` on nearly every table** | Multi-tenancy as a first-class column, with row-level security on it | The largest departure. It puts an authorisation axis into the *model* rather than around it. Excluded from reference data. |
| **File vault + `Fsats`** | A raw vault for files, satellites over file-stream storage | Treats a file as context with a hash-keyed parent — the vault discipline applied to blobs. |
| **`GeoLink` / `GeoSat`** | Spatial relationships and spatial context as first-class | Spatial is a *split axis* alongside classification and rate of change. |
| **`LogicSat`** | Splitting on logical groupings in the source | The catch-all split axis. |
| **Operations schemas** (14 of them) | Scheduler, job, quality, rules, workflow, identity, real-time, load, generate, test | Names the operational system the books mostly leave implicit. |
| **Archive area** | Pre-deletion staging with a mandatory reload test | Deletion is a *tested* transition, not a `DROP`. |
| **`Strength` / `Confidence` as standard fields** | Promotes a 7.3 idea to a governed field on four link types | See §4; his open problem about distributions is the interesting half. |
| **Metrics vault as a peer area** | The warehouse instrumented on itself | 7.1 §10.3 covers the metrics vault; making it a top-level area alongside raw and business is his weighting. |

### 7.2 Where he argues with the literature

- **`LoadEndDate` is doubted.** 7.1 §4.5.3.3 defines it; he writes *"The usefulness
  of this field is yet to be seen, more investigation should be taken to see if it is
  really ever useful."* He repeats the doubt for `EndDate`. This is a documented
  standard field marked *unproven by the person adopting it* — the register discipline
  this repository now calls `unmetered`, applied in 2016 without the vocabulary.
- **`LastSeenDate` versus record-tracking satellites is left open.** Both are in the
  books; he declines to pick: *"At this point it is undecided and untested if
  LastSeenDate or this approach is better. This may come down to a case by case basis
  but I hope not. I would like to choose one and stick with it."* An unresolved
  question kept as a question.
- **Multi-active satellites are demoted.** The books describe them as a modelling
  option; he treats them as close to a defect, because they break the
  satellite-at-parent-grain invariant, and prescribes a new hub instead.
- **Link-to-link is rejected in physical design**, permitted logically. Stronger than
  the books' general caution, and the reason given is load ordering.
- **Overloaded satellites are forbidden outright in the raw vault** — specifically on
  the source-system split, because a source-split violation *"can have very
  detrimental rippling effects across the entire system"*.
- **Dimensional modelling is demoted to an output format**, and multidimensional
  cubes are further demoted below tabular models on maintenance cost. That is a
  practitioner's ranking, not one the books make.

### 7.3 A recorded open question this may bear on

`docs/CONCEPT-REGISTRY.md` records Aaron using the phrase **"Data Vault 2.0+"** in
2026 and notes: *"The '+' in 'Data Vault 2.0+' is Aaron's and he did not say what it
extends. Recorded unexpanded rather than guessed at."*

This 2016 document contains an explicit, self-labelled enumeration of his own
extensions to the standard model — §7.1 above. **That is a candidate answer, and it
is offered as a candidate only.** The documents are separated by ten years, he was
not asked, and matching "extensions to DV2.0" against "the + in DV2.0+" is a
plausible correspondence rather than a demonstrated one. Per
[`numerology-vs-number-theory`](../.claude/rules/numerology-vs-number-theory.md), the
coincidence licenses the question, never the claim. The registry entry stays
unexpanded until he says otherwise; this paragraph is the pointer, not the answer.

## 8. What is genuinely unfinished, in his own words

Kept because a standards document that records its own gaps is more trustworthy than
one that does not, and because these are the falsifiable parts:

- `LoadEndDate` and `EndDate` — defined, adopted, never demonstrated useful.
- `LastSeenDate` vs. `Rsat` — two mechanisms for one job, no decision.
- `Strength` / `Confidence` as floats — collapses a distribution to a point estimate;
  the fix is named and not built.
- Automatic satellite re-splitting from measured velocity — the "force multiplier",
  described and unbuilt.
- The split between the `meta`, `metrics` and `operations` schemas — *"More time
  should be invested into the exact split."*
- Pit tables on temporal tables — blocked because history-side inserts are not
  permitted; the partition-swap workaround is judged not worth it.

## 9. Where this connects to Zeta

Stated as correspondences to check, not as claims that hold. Nothing here is metered.

| DV2.0 property | Zeta surface |
|---|---|
| No load ordering; hash keys make loads parallel and commutative | Manifesto §1 scale-free, §2 lock/wait-free |
| Delta-only satellite loads keyed by `HashDiff` | §12 idempotency — re-loading an unchanged row is a no-op by construction |
| Raw vault keeps every source's claim, reconciles nothing | `anti-babel-preserve-reconcilability` — reintegration is not reconvergence |
| Hard rules reversible, soft rules not | The `Wall` / evidence discipline in `src/Core/DerivationProtocol.fs` |
| `RecordSource` on every row | Provenance as a mandatory column, not an optional audit log |
| MPP as the stated mathematical model | Decomposition into independently-computable parts, no shared memory |
| Business-key scope ladder | Hub stability — `docs/research/2026-06-12-dv2-hub-stability-and-the-forced-shape-math-team-REPORT-4.md` |

The MPP framing (definition 6.3) is the one most worth a second look: the source
claims every DV2.0 construct was shaped to satisfy shared-nothing parallel
decomposition, which would make the method's oddities consequences of a constraint
rather than conventions. That is a strong claim, it is the source's, and this
repository has not checked it.

## Pointers

- `docs/PRIOR-ART-LIST.md` §"Data Vault 2.0" — the six books, with checked citations.
- `.claude/rules/dv2-data-split-discipline-activated.md` — the carved rule; §5 DV2.0
  and the raw-vault sentence.
- `.claude/skills/data-modeling-and-ontology/blueprints/data-vault-expert.md` — the
  triad mechanics, hash keys, PIT/bridge, ghost records.
- `docs/CONCEPT-REGISTRY.md` — conflict retention as DV2.0's distinctive property,
  and the unexpanded "2.0+".
- `docs/GLOSSARY.md` §"Data Vault 2.0" — the terms this repository actually uses.
- `docs/research/2026-06-12-dv2-hub-stability-and-the-forced-shape-math-team-REPORT-4.md`
  — hub stability as a theorem with a stated gap condition.
