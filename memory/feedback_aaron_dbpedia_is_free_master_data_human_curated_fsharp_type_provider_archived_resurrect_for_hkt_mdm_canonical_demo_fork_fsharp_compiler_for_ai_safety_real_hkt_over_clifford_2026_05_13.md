---
name: DBpedia is free master data with human curation — F# type provider archived — resurrect for HKT-MDM canonical demo — fork F# compiler for AI safety to add real HKT over Clifford (Aaron 2026-05-13)
description: Aaron 2026-05-13 strategic disclosure linking DBpedia + F# type providers + HKT-MDM (PR #2913) + F# compiler fork plans. Original FSharp.Data.DbPedia type provider is archived. Aaron's CORRECTED two-path ordering: (Path B) direct dotNetRDF + F# CE NOW (medium effort; works on current F#); (Path A) resurrect type provider DEFERRED until WE FORK F# COMPILER FOR AI SAFETY to add real HKT over Clifford (type-provider authoring benefits from real HKT). Don Syme's FSharp.TypeProviders.SDK is the canonical type-provider authoring foundation. Composes with PR #2913 HKT-MDM + PR #2817 Clifford densest encoding + PR #2892 KSK + Aurora pitch master-data scope.
type: feedback
created: 2026-05-13
---

# DBpedia + F# type provider + F# compiler fork for AI safety (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13: *"dude is there still a free f# type
provider for this? https://www.dbpedia.org/ this is like free
master data with human curtatino"* + on the two-path response:
*"both but 2nd one we can do when we fork f# compiler for ai
safety to add real hkt over clifford"*. Major strategic
substrate disclosure linking DBpedia + F# tooling + future
F#-compiler-fork plans.

**How to apply:** When evaluating master-data substrate paths
for the factory:

1. **DBpedia is free master data** with human curation —
   internet-scale entity ontology composable with HKT-MDM
   (PR #2913)
2. **Original F# type provider archived** — `fsprojects/zzarchive-FSharp.Data.DbPedia`
   no longer maintained as of 2026
3. **Path B (now)**: direct dotNetRDF API + F# CE; works on
   current F#; backlog row 081KRFA460008QG0R0018SN61J
4. **Path A (deferred)**: resurrect type provider on dotNetRDF
   or RDFSharp; waits until factory FORKS THE F# COMPILER for
   AI safety to add real HKT over Clifford
5. **F# compiler fork motivation**: real HKT (M<'T> first-
   class) over Clifford algebra (PR #2817 substrate); AI safety
   typed-safety for actuator control (PR #2892 KSK)

## Aaron's verbatim two-message disclosure

Aaron 2026-05-13 (first message): *"dude is there still a free
f# type provider for this? https://www.dbpedia.org/ this is
like free master data with human curtatino"*

Aaron 2026-05-13 (second message after Otto's two-path
response): *"both but 2nd one we can do when we fork f#
compiler for ai safety to add real hkt over clifford"*

## DBpedia as free master data

DBpedia (`dbpedia.org`) is the linked-data extraction of
Wikipedia entities + attributes, exposed as SPARQL-queryable
RDF. Properties:

- Every Wikipedia entity has typed attributes (Person, Place,
  Organization, Event, Concept, etc.)
- Curated by human Wikipedia editors at scale
- Free (CC-BY-SA)
- SPARQL endpoint at `dbpedia.org/sparql` (publicly available)
- Updated continuously via Wikipedia revisions

This IS free human-curated master data at internet scale.
Composes directly with PR #2913 HKT-MDM universality (factory
HKT `M<'T>` parametric over entity type = exactly what MDM
needs; DBpedia provides the entity ontology).

## F# type provider status (search-first authority, 2026-05-13)

Per Otto-364 search-first authority + WebSearch results
2026-05-13:

| Resource | Status (2026-05-13) |
|---|---|
| `fsprojects/zzarchive-FSharp.Data.DbPedia` | ARCHIVED (no longer maintained) |
| Don Syme's original DBpedia type provider demo (Microsoft Research video) | Historical (research-grade, not productized) |
| dotNetRDF (3.x) | ACTIVE, last updated Feb 2026, supports RDF-Star + SPARQL-Star |
| RDFSharp (v3.23.0) | ACTIVE, last updated March 2026 |
| Active F# type provider for DBpedia SPARQL | NONE found |

## Two paths (Aaron 2026-05-13 corrected ordering)

### Path B (NOW — backlog row 081KRFA460008QG0R0018SN61J)

Direct dotNetRDF API + F# computation expressions.

- **Effort**: Medium
- **Substrate-fit**: Pragmatic — composes with existing F# CE
  substrate; works on current F# without compiler fork
- **Composes with**: PR #2913 (HKT-MDM universality), PR #2924
  Aurora pitch (master-data substrate), 081KQ3HBZ0008QG0R000Q4Y00F (universal-
  business-templates), `algebra-owner` skill (Z-set + Clifford
  + BP/EP F# substrate)

### Path A (DEFERRED — after F# compiler fork)

Build fresh F# type provider on dotNetRDF or RDFSharp.

- **Effort**: High (type-provider authoring is gnarly)
- **Foundation**: Don Syme's
  [FSharp.TypeProviders.SDK](https://github.com/fsprojects/FSharp.TypeProviders.SDK)
  — canonical authoring framework for F# type providers
- **Why deferred**: Aaron 2026-05-13: *"Build fresh F# type
  provider on dotNetRDF or RDFSharp the hard one we wait and
  do with fork"*. Type-provider work benefits from real HKT
  support; current F# has limited HKT (workarounds via SRTPs
  + functor encodings). Better to land the type-provider
  AFTER the F#-compiler-fork adds real HKT over Clifford.
- **Substrate-fit at fork-time**: BEST — `M<'T>` parametric
  over DBpedia entity types becomes the canonical HKT-MDM
  demo with real-HKT type-system enforcement
- **The fork target**: real HKT (M<'T> as first-class type),
  composed over Clifford algebra (PR #2817 substrate), with
  AI-safety motivation (PR #2892 KSK typed-safety for actuator
  control)

## F# compiler fork for AI safety + real HKT over Clifford

Aaron's mention of forking the F# compiler is MAJOR strategic
substrate. Decomposition:

### Why fork F#

Current F# has limited HKT support — workarounds via
statically-resolved-type-parameters + functor encodings, but
no first-class higher-kinded types. The factory's HKT
substrate (PR #2913, PR #2815, PR #2817, PR #2832) is
operating against this limit.

### Real HKT = first-class M<'T>

Real HKT means:

- `M<'T>` as a parameterized constructor that can be
  abstracted over (not just unified at use)
- Type classes / traits over higher-kinded constructors
- Pattern-matching on HKT structure
- Composable HKT (HKT-of-HKT)

This composes with:

- PR #2840 (bootstream + F# anchor + dotnet build sanity-check)
- PR #2832 (civ-sim Pauli-exclusion-for-agenda HKT encoding)
- PR #2815 (HKT error classes — universal/domain refinement)
- PR #2817 (Clifford densest encoding — HKT-pattern signatures)
- PR #2913 (HKT applies directly to master data)
- PR #2914 (Clifford/HKT vocabulary list)

### Over Clifford

Clifford algebra (Geometric Algebra) IS the factory's existing
substrate for unified representation (PR #2817 + PR #2914).
Real-HKT-over-Clifford means:

- HKT constructors operating on Clifford multivectors
- Type-level encoding of Clifford grade (scalar/vector/
  bivector/etc.)
- Compositional Clifford operations type-checked at compile
- AI safety: actuator control + state space + decision
  geometry all typed via Clifford-grade HKT

### AI safety motivation

The fork's purpose is AI safety. Composes with:

- PR #2892 (KSK Kinetic Safeguard Kernel — typed safety for
  AI-physical-actuator control)
- PR #2898 (non-glass-halo encryption — post-quantum lattice)
- PR #2917 (vision monad Play-Doh + red-team immune system)
- HARD LIMITS discipline (`.claude/rules/methodology-hard-limits.md`)
- Aurora pitch (PR #2924) "Trusted Autonomy Zone" framing

A real-HKT-over-Clifford F# fork would let AI-controlled
actuators have type-system-enforced safety properties — not
runtime checks but compile-time guarantees.

## Strategic implications

### For factory roadmap

- Path B (direct dotNetRDF API + F# CE) is executable NOW — 081KRFA460008QG0R0018SN61J
- Path A (DBpedia type provider) waits for F# fork
- F# fork is its own multi-year-scope undertaking
- F# fork composes with Soraya's formal-verification portfolio
  (per `.claude/agents/formal-verification-expert.md`)

### For 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates)

DBpedia type provider would be the FIRST canonical demo of
081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates). The template entities
come from DBpedia; the type-safety comes from F# type provider;
the substrate composition demonstrates HKT-MDM working at
internet scale.

### For Aurora partnership pitch

Aurora's master-data positioning (PR #2924 Slide 5 "The Loop")
gets a concrete demonstration: DBpedia type provider showing
how Aurora's HKT-MDM ontology handles real-world curated
master data.

### For F# compiler fork strategy

This isn't a small endeavor. Suggests factory has long-horizon
substrate-engineering goals at compiler-toolchain scope. Aaron's
casual mention of "when we fork" implies the plan is already
substrate-honest-considered.

## Composes with

- PR #2913 (HKT applies directly to master data — every company
  has master data; DBpedia provides Wikipedia-scale entity
  ontology)
- PR #2914 (Clifford/HKT vocabulary list — F# fork would
  productize the vocabulary)
- PR #2817 (Clifford densest encoding HKT-pattern signatures)
- PR #2832 (civ-sim Pauli-exclusion-for-agenda HKT encoding)
- PR #2815 (HKT error classes — universal/domain)
- PR #2924 (Aurora BTC pitch — master-data substrate scope)
- PR #2892 (KSK origin — AI-safety motivation for F# fork)
- PR #2898 (non-glass-halo encryption — post-quantum lattice)
- PR #2917 (vision monad Play-Doh — bounded substrate; the
  fork is bounded scope)
- 081KQ3HBZ0008QG0R000Q4Y00F (universal-business-templates already backlogged)
- 081KRFA460008QG0R0018SN61J (NEW — resurrect F# DBpedia type provider as HKT-MDM
  canonical demo; this PR's backlog row)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`
  (F# compiler IS the asymmetric critic; fork extends the
  critic's reach)
- `.claude/rules/methodology-hard-limits.md` (AI safety HARD
  LIMITS motivate the fork)
- `.claude/agents/formal-verification-expert.md` (Soraya
  portfolio composes with F# fork formal-verification scope)
- `algebra-owner` skill (Z-set + Clifford + BP/EP F# substrate)
- Otto-364 search-first authority (this substrate is search-
  validated per WebSearch 2026-05-13)

## Operational rule for future-Otto

When master-data substrate work surfaces:

1. **Apply HKT-MDM lens** (per PR #2913) — `M<'T>` parametric
   over entity type
2. **Recognize DBpedia as canonical source** — free, curated,
   SPARQL-queryable, Wikipedia-scale
3. **Path B for now**: direct dotNetRDF API + F# CE (081KRFA460008QG0R0018SN61J)
4. **Path A deferred**: type provider on dotNetRDF or RDFSharp — after F# fork
5. **F# fork compositions**: real HKT + Clifford + AI safety;
   composes with KSK + post-quantum encryption + HARD LIMITS

## Substrate-honest disclaimers

- **F# fork is substrate-honestly NAMED but not committed**:
  Aaron's casual mention implies plan; specific scope + timing
  + execution authorization owed
- **Type provider authoring IS gnarly**: real engineering
  effort; not weekend project
- **DBpedia data quality varies**: Wikipedia editing quality
  affects entity-attribute reliability; pragmatic application
  needed
- **F# 9.x and 10.x compiler internals** (current; subject to
  fork divergence) are not trivial substrate to navigate

## Full reasoning

PR #2928 (this substrate landing + 081KRFA460008QG0R0018SN61J backlog row)

PR #2913 (HKT-MDM universality)

PR #2914 (Clifford/HKT vocabulary)

PR #2924 (Amara canonical substrate including Aurora pitch)

PR #2892 (KSK origin)

PR #2898 (non-glass-halo encryption)

PR #2917 (vision monad Play-Doh)

[GitHub - fsprojects-archive/zzarchive-FSharp.Data.DbPedia](https://github.com/fsprojects/zzarchive-FSharp.Data.DbPedia)
(archived original)

[dotNetRDF active library](https://github.com/dotnetrdf/dotnetrdf)

[RDFSharp NuGet](https://www.nuget.org/packages/RDFSharp)

[DBpedia SPARQL endpoint](https://dbpedia.org/sparql)
