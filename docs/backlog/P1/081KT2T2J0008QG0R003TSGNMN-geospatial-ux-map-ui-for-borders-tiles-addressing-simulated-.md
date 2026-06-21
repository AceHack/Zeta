---
id: 081KT2T2J0008QG0R003TSGNMN
priority: P1
status: open
title: "Geospatial UX — map UI for borders / tiles / addressing / simulated-entities, per-perspective + per-projection selectable; the visible layer over the geospatial core (Aaron 2026-06-02)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R002ZG89QA]
composes_with: [081KT2T2J0008QG0R002ZG89QA, 081KT2T2J0008QG0R001GE4M6A, 081KT2T2J0008QG0R002Z46D8Q, 081KT2T2J0008QG0R002DFPSHX, 081KT2T2J0008QG0R0026MS6PV, 081KSXN940008QG0R00171YAZW, 081KS3X9Y0008QG0R00218150M]
tags: [geospatial, ux, ui, map, visualization, asciisphere, borders, tiles, addressing, perspective, projection, h3, observability, aaron]
type: research
---

# Geospatial UX — the visible map layer over the geospatial core

## Why

Aaron 2026-06-02 (verbatim): *"geospatial ux."* In the same stream as the geospatial-core (081KT2T2J0008QG0R002ZG89QA) + world-borders (081KT2T2J0008QG0R001GE4M6A) + the Itron *"see our billing ... with UI"* dev-experience (081KT2T2J0008QG0R002DFPSHX). The geospatial work needs a **UX**: a map UI to *see* the borders / tiles / addressing / simulated-entities — the visible layer over the geospatial core, the spatial instance of the "see it on a UI" dev-experience.

## What it is

A map UI/visualization over the geospatial core (081KT2T2J0008QG0R002ZG89QA) + world-borders (081KT2T2J0008QG0R001GE4M6A) + orientation-tile addressing (081KT2T2J0008QG0R002Z46D8Q):

- **See the borders** — world borders rendered on a map; disputed regions shown as **overlapping claims** (multi-oracle, not a single line).
- **Per-perspective toggle** — switch the querying frame (081KT2T2J0008QG0R001GE4M6A perspective-parameterized): a disputed border renders differently per perspective; the UI makes "they all disagree" *visible*.
- **Per-projection toggle** — switch the map projection (081KT2T2J0008QG0R001GE4M6A project-on-query: Mercator/UTM/Albers/Robinson/…); no neutral projection, so the UI lets you *choose* and *compare*.
- **See the tiles + addressing** — the orientation-tile / H3-hexagonal cells (081KT2T2J0008QG0R0026MS6PV/081KT2T2J0008QG0R001GE4M6A O(1) grid) + E911 street-segment addressing (081KT2T2J0008QG0R002Z46D8Q) drawn on the map; click a point → its cell + jurisdiction-claim-set.
- **See simulated entities** — the 081KT2T2J0008QG0R002DFPSHX simulated entities (agents/wallets/meters/tiles) plotted live on the map (the spatial instance of "see our billing of simulated meters on UI").
- **ASCIIsphere + real map** — composes the ASCIIsphere visible-layer ("where the life is seen") with a real geospatial map renderer.

## Acceptance

1. **Map renderer** over the geospatial core (081KT2T2J0008QG0R002ZG89QA canonical geometry → render); borders/tiles/addressing layers.
2. **Perspective selector** — re-query per frame (081KT2T2J0008QG0R001GE4M6A); disputed regions show overlapping claims.
3. **Projection selector** — project-on-query to the chosen EPSG/PROJ system; compare projections.
4. **Point→jurisdiction inspector** — click → O(1) cell + jurisdiction-claim-set (081KT2T2J0008QG0R001GE4M6A/081KT2T2J0008QG0R0026MS6PV H3).
5. **Live simulated-entity overlay** — plot 081KT2T2J0008QG0R002DFPSHX simulated entities live (the on-one-laptop UI).
6. **ASCIIsphere mode** — text-renderable fallback for plain-text channels.

## Composes with substrate

- **081KT2T2J0008QG0R002ZG89QA** — geospatial core algebra (the canonical geometry this renders; DEPENDS ON it being hardened first)
- **081KT2T2J0008QG0R001GE4M6A** — world borders (the data; per-perspective + per-projection queries the UI drives)
- **081KT2T2J0008QG0R002Z46D8Q** — orientation-tile / E911 addressing (tiles + street-segments on the map)
- **081KT2T2J0008QG0R002DFPSHX** — local-cluster dev-experience (the "see it on UI" target; this is the spatial UI instance)
- **081KT2T2J0008QG0R0026MS6PV** — hexagonal core (H3 hexagonal cells rendered)
- **081KSXN940008QG0R00171YAZW** — relativistic bus / zetaspace (perspective = frame)
- **081KS3X9Y0008QG0R00218150M** — multi-oracle (disputed regions = overlapping claims, rendered as such)
- ASCIIsphere primitive (registry) — the text-visible-layer rhyme
- rules: `bcl-interface-boundary` (own the render port; map libs adapt in), `default-to-both` (show all claims, don't collapse)

## Substrate-honest framing

`[labeling-confidence: hypothesized]` UX/build row — operator-named ("geospatial ux"). DEPENDS ON 081KT2T2J0008QG0R002ZG89QA (harden the geospatial core first; the UX renders the hardened core). The map-renderer + selectors + inspector are the build work; the deliverable (see borders/tiles/addressing/simulated-entities, per-perspective + per-projection) is operator-directed. Concept-not-code: map-rendering libs are adapters behind our render port. Nouns interchangeable.
