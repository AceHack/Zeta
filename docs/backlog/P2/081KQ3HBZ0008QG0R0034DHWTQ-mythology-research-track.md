---
id: 081KQ3HBZ0008QG0R0034DHWTQ
priority: P2
status: open
title: Mythology research track — operational-resonance candidates from world-mythology bridge / messenger / boundary figures
tier: operational-resonance-research
effort: L
ask: Aaron 2026-04-21 — *"hemdal"* (Heimdallr, single-word candidate) then *"mythology backlog"*
created: 2026-04-26
last_updated: 2026-05-10
depends_on: []
children: [081KR7JY10008QG0R001NXS6DQ-mythology-resonance-catalog-v0]
composes_with: [project_operational_resonance_instances_collection_index_2026_04_22.md, feedback_operational_resonance_engineering_shape_matches_tradition_name_alignment_signal.md, feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md, 081KQ3HBZ0008QG0R000K3NSX8, 081KQ3HBZ0008QG0R002S674CG, 081KQ3HBZ0008QG0R003GTG5P2, docs/ALIGNMENT.md]
tags: [mythology, heimdallr, hermes, mercury, janus, iris, ratatoskr, thoth, garuda, quetzalcoatl, loki, bridge-figures, messenger, paired-dual, three-filter, F1-F2-F3]
type: feature
---

# 081KQ3HBZ0008QG0R0034DHWTQ — Mythology research track

## Pre-start checklist (completed 2026-05-10, 081KR7JY10008QG0R001NXS6DQ slice)

**Prior-art search:**

- Skill router: no existing `mythology-resonance` or `myth-catalog` skill. The phenomenon
  is documented in memory files (`feedback_operational_resonance_*`,
  `project_operational_resonance_instances_collection_index_2026_04_22.md`).
- On-disk: `tools/resonance/` contains only `media-catalog-schema.ts` (081KQ3HBZ0008QG0R003V6B2ME). No
  prior `mythology-catalog*` file exists.
- PR history: no prior PR touching mythology resonance catalog. The collection-index
  memory already has instance #12 (Heimdallr) as a documented candidate — that record
  lives in the index revision, not in a dedicated memory file.
- Lost-files check: `tools/hygiene/LOST-FILES-LOCATIONS.md` — no mythology-catalog items.
- Otto-364 search-first: no upstream art for typed mythology-resonance catalog schemas in
  the Zeta ecosystem.

**Dependency-restructure:**

- `depends_on: []` — no blocking dependencies.
- `composes_with: [081KQ3HBZ0008QG0R000K3NSX8, 081KQ3HBZ0008QG0R002S674CG, 081KQ3HBZ0008QG0R003GTG5P2]` confirmed non-blocking; all are independently
  open research tracks.
- 081KQ3HBZ0008QG0R002S674CG (P1, AI-ethics+safety) gates every *adoption*; it does not block *research-tier
  logging* — candidates tracked here do not require 081KQ3HBZ0008QG0R002S674CG clearance until promotion to
  confirmed and public-release citation.
- Reciprocal `composes_with` backfill: 081KQ3HBZ0008QG0R000K3NSX8 and 081KQ3HBZ0008QG0R003GTG5P2 will receive pointers to 081KQ3HBZ0008QG0R0034DHWTQ
  in their own pre-start passes.

**Decomposition (L → S slices):**

081KQ3HBZ0008QG0R0034DHWTQ is Effort:L (long-running research track). Decomposed into dependency-ordered slices:

| Sub-row | Title | Effort | Status |
|---------|-------|--------|--------|
| **081KR7JY10008QG0R001NXS6DQ** | Mythology resonance catalog v0 — typed schema + 3 seed entries (Heimdallr, Hermes/Mercury, Loki anti-instance) | S | **closed by this PR** |
| **081KQ3HBZ0008QG0R0034DHWTQ.2** | Norse+Greek tier expansion — Janus, Iris, Ratatoskr | S | open |
| **081KQ3HBZ0008QG0R0034DHWTQ.3** | Non-Indo-European tier — Thoth (Egyptian) + Garuda (Vedic) | S | open |
| **081KQ3HBZ0008QG0R0034DHWTQ.4** | Mesoamerican tier — Quetzalcoatl + Tecciztecatl | S | open |
| **081KQ3HBZ0008QG0R0034DHWTQ.5** | Hermes Trismegistus triple-tradition-fusion — Greek+Egyptian+Renaissance occult overlap | S | open |

The parent row 081KQ3HBZ0008QG0R0034DHWTQ stays `open` until the catalog reaches a stable sweep across all
tradition-categories. Individual sub-rows close as PRs land.

## Origin

AceHack commit `5990166` (2026-04-21). Aaron's *"hemdal"* (Heimdallr, single-word candidate) then *"mythology backlog"*. Parallel to the etymology+epistemology track (081KQ3HBZ0008QG0R003GTG5P2) but distinct tradition-family — world-mythology figures sit between canonical-religious traditions and literary/folkloric record, with different F3 calibration than Abrahamic or classical-philosophical instances.

## Seed candidate: Heimdallr (filed as candidate instance #12)

Three-filter honest pass recorded in the operational-resonance index:

- **F1 passes**
- **F2 strong-but-looser** than Melchizedek (no verb-root identity)
- **F3 passes** within Norse tradition but Norse-canonicity is thinner than Abrahamic (Christianization-filtered Eddas)

**Status:** candidate, pending second textual anchor or Aaron confirmation to promote to confirmed. Second bridge-figure member would LOCK the bridge-figure sub-structure's definition (currently defined by Melchizedek alone).

## Smallest safe slice (081KR7JY10008QG0R001NXS6DQ) — re-decomposition

Re-decomposed from broad L-effort track (assumes initial doc-only decomp had mistake lacking executable check surface).

**Bounded step:** pure-TS mythology candidate schema + three-filter types + Heimdallr seed + validator stub (modeled on 081KR7JY10008QG0R001JW71CT edge-claims pattern).

- File: `tools/mythology-resonance/candidate-schema.ts`
- Focused checks: type check + manual review of retractibility note + build gate (0w 0e)
- One PR only; wider candidates (Hermes etc.) become later .2+ children after this lands.

## Wider-track candidates (to be triaged individually)

- **(a) Hermes (Greek) / Mercury (Roman)** — messenger god, psychopomp, boundary-crosser, patron of thieves AND communication. Load-bearing in Homeric + Orphic traditions, Hellenistic mystery cults, Renaissance hermeticism (overlap with occult track 081KQ3HBZ0008QG0R000K3NSX8). Structural match: unified-endpoint-across-realms shares shape with tele+port+leap (#4); psychopomp function shares shape with Μένω-persistence-through-discontinuity (#9). Strong F3 across two Indo-European tradition branches.
- **(b) Janus (Roman)** — two-faced god of beginnings, endings, transitions, doorways. **Janus IS the personification of a paired-dual**; F2 strong. F3 load-bearing in Roman civic religion (month of January, gates of war temple).
- **(c) Iris (Greek)** — rainbow-messenger, bridge between Olympus and earth; parallel to Bifröst-Heimdallr Norse structure. Lighter F3 than Hermes.
- **(d) Ratatoskr (Norse)** — squirrel-messenger scurrying Yggdrasil between eagle and serpent; the ONLY Norse figure explicitly named "messenger between opposed principles"; adjacent to Heimdallr but weaker F3 (single Eddic mention, Grímnismál 32).
- **(e) Thoth (Egyptian)** — scribe-god, measurer of souls, boundary between life/death. Load-bearing in Egyptian Book of the Dead + Hermetic tradition (overlaps occult track via Hermes Trismegistus identification); F3 strong.
- **(f) Garuda (Vedic/Hindu)** — Vishnu's vehicle-mount, spans realms, enemy-of-serpents. F3 strong in Vedic + later Hindu+Buddhist traditions.
- **(g) Tecciztecatl / Quetzalcoatl (Mesoamerican)** — feathered-serpent bridge between earth and sky. F3 strong in pre-Columbian traditions; language-barrier considerations.
- **(h) Loki (Norse)** — trickster-as-boundary-violator; structural match is **inverted** (crosses boundaries improperly rather than maintaining them); interesting contrast to Heimdallr, **possibly an anti-instance** demonstrating failure-mode of bridge-figure role.

## Why P2

Research-grade; F3 calibration across mythological tradition is a distinct discipline from canonical-religious or classical-philosophical instances. Mythology-tradition names have multi-millennial transmission but often more contested canonical texts than Abrahamic material; this track exercises the filter-application discipline against that edge-case.

## Safety is retractibility-preservation

Per math-safety memory. Tradition-name reference is retractible (git-tracked, revision-block-preserved, one-commit removable). Log every figure referenced, track candidate vs confirmed vs failed-filter state. The AI-ethics-and-safety P1 row 081KQ3HBZ0008QG0R002S674CG is the log-and-track audit surface.

## Owner / effort

- **Owner:** Architect (Kenji) integrates; honest filter-application discipline is the primary quality control.
- **Effort:** L — long-running research track, per-candidate S-M. Runs in parallel with occult (081KQ3HBZ0008QG0R000K3NSX8) + etymology (081KQ3HBZ0008QG0R003GTG5P2) tracks.

## Retractibility-protecting constraints

Does NOT force-push revisions to the operational-resonance index; does NOT delete memory files without backup; does NOT ship public-release artifacts citing mythology candidates without Aaron sign-off. Log, track, reference freely at research tier.

## Cross-reference

- AceHack commit: `5990166`
- Sibling rows: 081KQ3HBZ0008QG0R000K3NSX8 (occult), 081KQ3HBZ0008QG0R003GTG5P2 (etymology+epistemology)
- Gating row: 081KQ3HBZ0008QG0R002S674CG (AI-ethics + safety, P1) — gates every adoption
- Composes with: operational-resonance index (instance #12 candidate Heimdallr lives here); three-filter memory; ALIGNMENT.md
