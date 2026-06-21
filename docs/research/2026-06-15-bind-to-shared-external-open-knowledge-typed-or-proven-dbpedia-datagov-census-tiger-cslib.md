# Bind to shared external open knowledge — typed or proven (DBpedia · data.gov · Census/TIGER · CSLib)

> **Aaron 2026-06-15 (shadow\*): "yes please connect those dots in a durable form."**
> The CSLib insight (a shared open library supplying both *properties* and *names*)
> is one instance of a standing Zeta pattern we already have for *data*: bind to a
> shared **external open knowledge graph** through a **typed or proven** binding, so
> the substrate stands on anchored external knowledge instead of re-inventing it.

## 0. The principle

> **Don't re-invent shared knowledge — bind to the anchored external open graph,
> through a binding that makes it checkable (typed via a type-provider, or proven via
> a library dependency).** This is the **Beacon discipline as architecture**
> ([`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md)):
> stand on named external substrate, not factory coinage.

The binding is what makes it Zeta-safe: a **type provider** turns an open data graph
into compile-time types (you can't reference a field the graph doesn't have); a
**library dependency** (Lean/CSLib) turns an open theorem corpus into proofs you can
discharge against. Either way the external knowledge enters **through a checked seam**
(hexagonal — we own the interface, the source stays behind the adapter).

## 1. The source map (the dots, connected)

| Domain | External open graph | Binding | In-repo |
|---|---|---|---|
| **Facts / entities** | **DBpedia** (Wikipedia linked-open-data, SPARQL) | F# type-provider / SPARQL computation-expression | `dbpedia-sparql-fsharp-ce` (`081KRHWGX…VKR0TH`), `dbpedia-fsharp-scaffold` (`…MTMBGR`), `dbpedia-hkt-mdm-entity-bindings-dv2` (`…GFSJC6`) |
| **Government / org data** | **data.gov / open-gov** | type-provider over the open-gov substrate | `universal-company-government-information-substrate` (`081KQ3HBZ…`) |
| **Jurisdictional / geographic** | **US Census + TIGER/Line** (street segments, address ranges, even/odd parity, linear referencing) | geospatial algebra + geocode (address→segment→point-in-polygon→district) | `geospatial-core-algebra` (`081KT2T2J…2ZG89QA`); register §B row (TIGER/Line geocode = Aaron's election-GIS: ArcGIS voter-registration + district-line geocoding) |
| **CS / AI properties + names** | **CSLib** (`leanprover/cslib`, Lean "Mathlib for CS") | Lean library dependency | prior-art (`reference-sources.json`, `PRIOR-ART-LIST.md`); the properties+names note |
| **General mechanism** | any external DSL/schema (YAML/Nix/Kube/Rego/persona-vocab) | F# type-providers | `f-sharp-type-system-as-universe-boundary` (`081KSE6WT…1H3DA90`) |

**The parallel Aaron drew:** DBpedia/data.gov/Census-TIGER : *data* :: CSLib :
*CS/AI properties*. Same shape — shared external open graph + a checked binding —
different domain and mechanism.

## 2. Jurisdictional awareness (why Census/TIGER specifically)

Binding **Census + TIGER/Line** gives the substrate **jurisdictional awareness**:
which jurisdiction/frame a thing falls in (district, precinct, county, ZIP). That is
the data backbone of **frame-relative identity** (recognition is jurisdiction-relative
— register identity row; borders/policies 081KT5CF90008QG0R000KYNZGF) and of the **geospatial routing**
already in the register (geohash/geocache "neighborhood, not exact address";
address→segment→district via TIGER linear referencing). So this isn't just data
ingest — it's the **external ground truth** the identity/routing layer stands on.
(Grounded, not analogy: this is Aaron's hands-on election-GIS engineering.)

## 3. Honest seams

- **Similar shape, not same mechanism.** A type-provider *generates types from data*;
  CSLib *gives proofs over theorems*; a SPARQL CE *queries*. Don't flatten them into
  "the same thing" — they share the *bind-to-open-graph* shape, not the impl.
- **Freshness / availability.** External graphs change or go down — the binding must
  handle staleness (design-time vs runtime type-providers; caching; the dep-as-oracle
  pattern). Open-data *quality* varies (DBpedia has noise).
- **Licensing varies per source** — DBpedia (CC-BY-SA), data.gov (mostly US public
  domain), Census/TIGER (US public domain), CSLib (open-source license). Respect each;
  attribution where required (Beacon credits anyway).
- **Geographic/US-centric.** TIGER is US jurisdictions; global jurisdictional
  awareness needs other national/international open-geo sources.
- **Maturity.** CSLib is *rising, not mass-adopted* (Feb 2026) — the right early bet,
  not an entrenched standard. DBpedia/Census are mature and stable.

## 4. Contribute-back (gated)

Same as the collaboration-readiness note: contributing *back* to any of these
(CSLib PRs, DBpedia corrections) is the outward-facing **gated** path (Aaron-driven;
§23). Binding/consuming them is internal and reversible; CSLib is the natural first
contribute-back target.

## Anchors

DBpedia / linked-open-data (SPARQL; Lehmann et al.) · data.gov / open-government data ·
US Census **TIGER/Line** (street-segment address ranges, even/odd parity, linear
referencing) · CSLib (`leanprover/cslib`, arXiv:2602.04846) · F# type providers
(Syme et al.; FSharp.Data) · HKT-MDM hub/satellite (DV2.0) · in-repo:
`anchor-to-human-prior-art`, `mirror-beacon-register-discipline`, the
`f-sharp-type-system-as-universe-boundary` + `geospatial-core-algebra` + DBpedia
backlog cluster, register §B (TIGER geospatial routing + frame-relative identity),
the interface-defined-by-proof + collaboration-readiness notes.
