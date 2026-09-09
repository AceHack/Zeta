---
id: 081M23H3BWT087G0R000FES3JA
type: task
state: backlog
priority: P2
slug: decide-the-scene-design-substrate-incremental-change-propaga
title: "Decide the scene-design substrate -- incremental change propagation over Rx push, and whether DBSP is the render-loop carrier"
created: 2026-09-09T16:47:58.362Z
depends_on: []
composes_with: []
---

# Decide the scene-design substrate -- incremental change propagation over Rx push, and whether DBSP is the render-loop carrier

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23H3BWT087G0R000FES3JA-*.md` glob. -->

## Why this row exists

Aaron 2026-09-09: _"i don't know if a graphics engine could work completely in rx, that would
be amazing interface for scene design."_

The answer splits, and the split is in his own phrasing. Detail:
`docs/research/2026-09-09-geospatial-reasoning-over-clifford-...-warp-consensus-inventory.md` §4.

- **Not as Rx for the inner loop.** Elliott's own 2009 push-pull paper diagnoses both halves:
  pure pull recomputes when nothing changed and its latency is bounded by the sampling period;
  pure push is wrong for continuous time. Space/time leaks generated a research line of their
  own (RT-FRP 2001; Krishnaswami ICFP 2013; Simply RaTT 2019).
- **Yes as `O(delta)` change propagation, and there is a shipped F# precedent.** Woerister,
  Steinlechner, Maierhofer & Tobler, _Lazy Incremental Computation for Efficient Scene Graph
  Rendering_ (HPG 2013), and Haaser, Steinlechner, Maierhofer & Tobler, _An Incremental
  Rendering VM_ (HPG 2015) -- both shipping in the Aardvark platform, which is mostly F# and
  uses an ELM-style architecture with an adaptive "Mod system".
- **Zeta already owns the strongest algebraic form of that property: DBSP.** The anchor under
  both is Acar, Blelloch & Harper, _Adaptive Functional Programming_ (POPL 2002 / TOPLAS 2006).

## The decision to make

- [ ] Scene authoring / UI edge: Rx or an ELM-style loop -- events there are genuinely discrete.
- [ ] Under the scene graph: **incremental change propagation**, and specifically whether DBSP
      is the carrier or a lighter dependency-graph is.
- [ ] Record why: an Rx pipeline over an ambient clock imports a time channel exactly where
      determinism is needed (`.claude/rules/local-time-never-enters-the-shared-fold.md`), while
      a DBSP circuit is deterministic and replayable (Sec.7 DST).

This row is the **decision**, not the implementation. It closes when the choice and its reason
are recorded.

## Register

`unmetered`. Nothing benchmarked; the claim is that the design question is already answered in
the literature, not that Zeta's version would be fast.
