---
id: B-0989
zetaid: 081KT2T2J0008QG0R002ZG89QA
priority: P1
status: open
title: "Geospatial core algebra — hardened, 4×4-bonded geometry/CRS/projection primitives; store-once-canonical (no 50 redundant copies); HARDEN FIRST, prerequisite for B-0988 world-borders (Aaron 2026-06-02, high priority)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [B-0982]
composes_with: [B-0982, B-0986, B-0988, B-0985, B-0703, B-0638, B-0704, B-0883]
tags: [geospatial, geospatial-algebra, geometry, crs, projection, ogc-simple-features, geojson, wkt, wkb, epsg, proj, de-9im, 4x4-bond, golden-vectors, store-once-canonical, no-redundancy, generic-math, dbsp, z-set, hexagonal, high-priority, aaron]
type: research
---

# Geospatial core algebra — hardened, 4×4-bonded; store-once-canonical (prereq for world-borders)

## Why

Aaron 2026-06-02 (verbatim): *"we need geospacation albegras agreement on our noral 4x4s first before safefme like border — i can get all of those and we can efficently store insteoad of 50 copies of redudant data — but we need the geospatial core hardened frirst on hight priority on primitives."*

**Sequencing correction:** before the SAFE-FME-style world-border ingest (B-0988), the **geospatial core algebra** must be **hardened** — i.e., it must **agree across our normal 4×4** (the language×serializer bond, B-0982). The WHY is the storage win: a canonical, 4×4-bonded geospatial algebra lets us store the borders **once** (canonical geodetic) and *derive* every projection + perspective on query — **instead of 50 copies of redundant data** (one per projection/perspective/format). Aaron can source all the border data; the gate is the hardened core. So **B-0988 (world-borders) is BLOCKED BY this row** — high priority, harden first.

## What it is — the geospatial core algebra

1. **Geometry primitives** — Point / LineString / Polygon / MultiPolygon (boundaries) as OUR canonical algebra (the OGC Simple Features shape, owned as our types). GeoJSON / WKT / WKB / SAFE FME are **adapters into our port**, never our interface (`bcl-interface-boundary` — own-your-interface, deps adapt in).
2. **CRS / datum / projection as first-class** — store a single **canonical geodetic** representation; EPSG/PROJ as the projection adapter; **project-on-query**. This is the no-redundancy mechanism: the canonical is stored once, every projection is a derivation.
3. **Topology + set algebra** — DE-9IM predicates (intersects / contains / within / overlaps / touches / disjoint) + region set-ops (**union / intersection / difference = Z-set / retraction-native rhyme**, DBSP) + metric ops (distance / area / buffer). Coordinates are numerical/algebra-shaped → into **generic-math** (`INumber<TSelf>`) per the numerical-algebra rule.
4. **4×4 bond (the "hardened" criterion)** — golden-vectors for Point / Polygon / CRS / a projected round-trip across all 16 language×serializer combos; **byte-lock**; **seed-first** (golden-vectors.json is the canonical seed, code grows from it, per the seed-first methodology). **"Agreement on the normal 4×4" IS the hardened bar.**

## Store-once-canonical — no 50 redundant copies (the WHY)

Aaron's storage argument: don't store 50 redundant copies (one per projection/perspective/format). Instead:

- **Store the canonical seed once** — geodetic geometry + the sovereign claim (multi-oracle, per B-0988).
- **Derive views on query** — projection (project-on-query, any EPSG/PROJ), perspective (per-frame, B-0988), format (serialize per the 4×4). Each of the "50 copies" becomes a *derivation* of the one canonical, not a stored duplicate.
- The **algebra is what makes this sound**: operations are defined canonically; views are pure derivations; the 4×4 bond guarantees a derived view is byte-identical regardless of which language/serializer produced it. This is `interfaces-are-the-asset` / `code-follows-from-types` (Meijer) at geospatial scope — define the geospatial algebra, the derivations follow.

## Sequencing — harden core, THEN ingest borders

```
B-0989 (this row — geospatial core algebra, 4×4-bonded, hardened)
   └── blocks ──> B-0988 (world borders: ingest + multi-oracle + O(1) lookup)
```

Do NOT start the B-0988 border ingest until the core passes the 4×4 bond (golden-vectors green across all 16). B-0988's depends_on updated to include B-0989 (this PR).

## Acceptance (harden the core)

1. **Canonical geospatial types** — Point/LineString/Polygon/MultiPolygon + CRS/datum/projection, as our own DUs/types (OGC-shaped; GeoJSON/WKT/WKB/EPSG/PROJ/FME as adapters behind our port).
2. **Coordinates into generic-math** — `INumber<TSelf>` for the coordinate scalar; per the numerical-algebra rule.
3. **Set/topology algebra** — DE-9IM predicates + region union/intersection/difference as Z-set/retraction-native ops + metric ops.
4. **Golden-vectors + 4×4 bond** — seed-first golden-vectors.json for Point/Polygon/CRS/projected-round-trip; byte-lock across all 16 language×serializer combos; **this passing = "hardened."**
5. **Project-on-query + store-once** — canonical geodetic store; derive any projection/perspective on read; verify a derived view is byte-identical across the 4×4.
6. **THEN unblock B-0988** — border ingest builds on the hardened core.

## Composes with substrate

- **B-0982** — DynamicValue 4×4 (the bond substrate this geospatial algebra must agree across)
- **B-0988** — world borders (BLOCKED BY this row; ingest builds on the hardened core)
- **B-0986** — orientation-tile / Rainbow-Table addressing (rides the geospatial core; E911 street-segment + world-borders both on it)
- **B-0985** — hexagonal core (H3 hexagonal grid for B-0988 O(1) lookup rhymes)
- **B-0703 / B-0638** — multi-oracle (store all disagreeing claims) / Eve Protocol (convert between disagreeing reps)
- **B-0883** — better-git-crypt (private geospatial state where needed)
- rules: `numerical-algebra-shaped-into-the-generic-math-interface-per-language-idiom`, `bcl-interface-boundary-own-your-interfaces-hexagonal`, `monad-propagation-pattern-cross-language-substrate-shape`, `dv2-data-split-discipline-activated` (DST + idempotency + the 4×4), `interfaces-are-the-asset` / `code-follows-from-types` (Meijer; seed-first)

## Substrate-honest framing

`[labeling-confidence: hypothesized]` build/research row — operator-directed + operator-prioritized ("harden the geospatial core FIRST, high priority, before borders"). The deliverable (a 4×4-bonded, hardened geospatial algebra enabling store-once-canonical) is operator-explicit; the type design + golden-vectors + DE-9IM/set-op implementation are the design work. Concept-not-code: OGC Simple Features / GeoJSON / WKT / EPSG / PROJ / H3 / S2 are public standards / open substrate the algebra is clean-room-able from; SAFE FME is integrated/adapter, never reproduced. Nouns interchangeable; no claim sacred.
