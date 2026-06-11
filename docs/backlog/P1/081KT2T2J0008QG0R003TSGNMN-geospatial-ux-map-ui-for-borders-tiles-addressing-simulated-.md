---
id: B-0991
zetaid: 081KT2T2J0008QG0R003TSGNMN
priority: P1
status: open
title: "Geospatial UX — map UI for borders / tiles / addressing / simulated-entities, per-perspective + per-projection selectable; the visible layer over the geospatial core (Aaron 2026-06-02)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [B-0989]
composes_with: [B-0989, B-0988, B-0986, B-0990, B-0985, B-0954, B-0703]
tags: [geospatial, ux, ui, map, visualization, asciisphere, borders, tiles, addressing, perspective, projection, h3, observability, aaron]
type: research
---

# Geospatial UX — the visible map layer over the geospatial core

## Why

Aaron 2026-06-02 (verbatim): *"geospatial ux."* In the same stream as the geospatial-core (B-0989) + world-borders (B-0988) + the Itron *"see our billing ... with UI"* dev-experience (B-0990). The geospatial work needs a **UX**: a map UI to *see* the borders / tiles / addressing / simulated-entities — the visible layer over the geospatial core, the spatial instance of the "see it on a UI" dev-experience.

## What it is

A map UI/visualization over the geospatial core (B-0989) + world-borders (B-0988) + orientation-tile addressing (B-0986):

- **See the borders** — world borders rendered on a map; disputed regions shown as **overlapping claims** (multi-oracle, not a single line).
- **Per-perspective toggle** — switch the querying frame (B-0988 perspective-parameterized): a disputed border renders differently per perspective; the UI makes "they all disagree" *visible*.
- **Per-projection toggle** — switch the map projection (B-0988 project-on-query: Mercator/UTM/Albers/Robinson/…); no neutral projection, so the UI lets you *choose* and *compare*.
- **See the tiles + addressing** — the orientation-tile / H3-hexagonal cells (B-0985/B-0988 O(1) grid) + E911 street-segment addressing (B-0986) drawn on the map; click a point → its cell + jurisdiction-claim-set.
- **See simulated entities** — the B-0990 simulated entities (agents/wallets/meters/tiles) plotted live on the map (the spatial instance of "see our billing of simulated meters on UI").
- **ASCIIsphere + real map** — composes the ASCIIsphere visible-layer ("where the life is seen") with a real geospatial map renderer.

## Acceptance

1. **Map renderer** over the geospatial core (B-0989 canonical geometry → render); borders/tiles/addressing layers.
2. **Perspective selector** — re-query per frame (B-0988); disputed regions show overlapping claims.
3. **Projection selector** — project-on-query to the chosen EPSG/PROJ system; compare projections.
4. **Point→jurisdiction inspector** — click → O(1) cell + jurisdiction-claim-set (B-0988/B-0985 H3).
5. **Live simulated-entity overlay** — plot B-0990 simulated entities live (the on-one-laptop UI).
6. **ASCIIsphere mode** — text-renderable fallback for plain-text channels.

## Composes with substrate

- **B-0989** — geospatial core algebra (the canonical geometry this renders; DEPENDS ON it being hardened first)
- **B-0988** — world borders (the data; per-perspective + per-projection queries the UI drives)
- **B-0986** — orientation-tile / E911 addressing (tiles + street-segments on the map)
- **B-0990** — local-cluster dev-experience (the "see it on UI" target; this is the spatial UI instance)
- **B-0985** — hexagonal core (H3 hexagonal cells rendered)
- **B-0954** — relativistic bus / zetaspace (perspective = frame)
- **B-0703** — multi-oracle (disputed regions = overlapping claims, rendered as such)
- ASCIIsphere primitive (registry) — the text-visible-layer rhyme
- rules: `bcl-interface-boundary` (own the render port; map libs adapt in), `default-to-both` (show all claims, don't collapse)

## Substrate-honest framing

`[labeling-confidence: hypothesized]` UX/build row — operator-named ("geospatial ux"). DEPENDS ON B-0989 (harden the geospatial core first; the UX renders the hardened core). The map-renderer + selectors + inspector are the build work; the deliverable (see borders/tiles/addressing/simulated-entities, per-perspective + per-projection) is operator-directed. Concept-not-code: map-rendering libs are adapters behind our render port. Nouns interchangeable.
