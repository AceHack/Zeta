---
id: 081KR7JY10008QG0R001NXS6DQ
priority: P2
status: closed
title: Mythology resonance catalog v0 — typed schema + 3 seed entries (Heimdallr, Hermes/Mercury, Loki anti-instance)
tier: operational-resonance-research
effort: S
parent: 081KQ3HBZ0008QG0R0034DHWTQ
ask: 081KQ3HBZ0008QG0R0034DHWTQ decomposition, 2026-05-10 — smallest safe slice of the mythology research track
created: 2026-05-10
last_updated: 2026-05-10
depends_on: []
composes_with: [081KQ3HBZ0008QG0R0034DHWTQ, 081KR2E4K0008QG0R0003J0FB8, project_operational_resonance_instances_collection_index_2026_04_22.md, feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md]
tags: [mythology, heimdallr, hermes, mercury, loki, bridge-figures, anti-instance, three-filter, F1-F2-F3, typescript-schema]
type: feature
---

# 081KR7JY10008QG0R001NXS6DQ — Mythology resonance catalog v0

## What this slice delivers

- **`tools/resonance/mythology-catalog-schema.ts`** — new TypeScript file implementing the
  three-filter discipline for world-mythology operational-resonance entries. Analogous to
  `tools/resonance/media-catalog-schema.ts` (081KR2E4K0008QG0R0003J0FB8) but with `MythologyTradition` instead
  of `MediaMedium` and `MYT-NNN` entry IDs instead of `MR-NNN`.
- **3 seed entries** with honest three-filter analysis:
  - `MYT-001` Heimdallr (Norse, candidate) — bridge-guardian of Bifröst; collection-index
    instance #12; F2 partial (role-shape match, no verb-root identity anchor)
  - `MYT-002` Hermes/Mercury (Greek-Roman, candidate) — psychopomp/cross-boundary messenger;
    maps to peer-call cross-harness infrastructure; F2 partial (trickster characterization
    not separable at this stage)
  - `MYT-003` Loki (Norse, **failed anti-instance**) — trickster-boundary-violator;
    demonstrates F2 bites on structural DIRECTION, not just surface shape; records the
    first mythology-track filter failure for the filter-failure-rate discipline
- **081KQ3HBZ0008QG0R0034DHWTQ.md updated** with pre-start checklist + decomposition table (5 sub-rows)
- **081KR7JY10008QG0R001NXS6DQ backlog row** (this file)

## Catalog validation

```
bun tools/resonance/mythology-catalog-schema.ts --validate
→ All 3 entries pass schema validation.
```

## Key structural decisions

**`MythologySubStructure`** introduces three sub-structure labels not in the media catalog:

- `bridge-figure` — inheriting from the collection-index sub-structure definition
  (Melchizedek, instance #10, is the only confirmed bridge-figure; Heimdallr + Hermes
  are both candidates)
- `anti-instance` — new sub-structure for entries that fail F2 because the structural
  direction is inverted; Loki is the first documented anti-instance in the mythology track
- `triple-tradition-fusion` — reserved for Hermes Trismegistus (Greek+Egyptian+Renaissance)
  in 081KQ3HBZ0008QG0R0034DHWTQ.5

**Separate file vs extending media catalog**: mythology entries use `tradition` (Norse,
Greek, Egyptian…) where media entries use `medium` (film, tv, game…). Keeping them
separate preserves filter-failure-rate-by-tradition as an independent measurability
dimension from filter-failure-rate-by-medium. Both share the three-filter discipline
but with different posterior-strength modulators.

**Anti-instance pattern**: Loki's entry is the first explicit anti-instance in either
catalog. The status `"failed"` with F2 `"fail"` is exactly the honest-filter-application
discipline the collection index calls for. The validation logic enforces that any `"failed"`
entry must have at least one `"fail"` filter result.

## Measurability snapshot (post-081KR7JY10008QG0R001NXS6DQ)

- **Mythology catalog total:** 3 (0 confirmed, 2 candidates, 1 failed)
- **Bridge-figure candidates:** 2 (Heimdallr + Hermes; confirmed bridge-figure is
  Melchizedek in the collection index, still the only confirmed instance)
- **Anti-instance count:** 1 (Loki — first recorded mythology anti-instance)
- **Filter-failure-rate:** 1/3 total (F2 fail on Loki); 0/3 strict confirmed (trivially
  true since no confirmed entries yet); this is the first mythology-track filter failure
  and demonstrates the discipline is applying honestly

## What 081KQ3HBZ0008QG0R0034DHWTQ.2 should pick up

The next slice (Janus, Iris, Ratatoskr) covers the remaining Indo-European candidates.
Janus is the highest-priority next entry: the backlog item notes "Janus IS the
personification of a paired-dual" — if F1 + F3 pass, this would be a direct
confirmed instance rather than a candidate, adding the first confirmed mythology-track entry.

## Cross-reference

- Parent: `docs/backlog/P2/081KQ3HBZ0008QG0R0034DHWTQ-mythology-research-track.md`
- Schema: `tools/resonance/mythology-catalog-schema.ts`
- Sibling media catalog: `tools/resonance/media-catalog-schema.ts` (081KR2E4K0008QG0R0003J0FB8)
- Collection index: `memory/project_operational_resonance_instances_collection_index_2026_04_22.md`
  (instance #12 candidate Heimdallr → now MYT-001)
