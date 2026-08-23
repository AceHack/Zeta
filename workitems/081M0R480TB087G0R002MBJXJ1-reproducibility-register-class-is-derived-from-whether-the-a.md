---
id: 081M0R480TB087G0R002MBJXJ1
type: task
state: backlog
priority: P2
slug: reproducibility-register-class-is-derived-from-whether-the-a
title: "Reproducibility register — class is derived from whether the artifact crosses the membrane, unlabelled is unknown not green"
created: 2026-08-23T20:15:58.795Z
depends_on: []
composes_with: []
---

# Reproducibility register — class is derived from whether the artifact crosses the membrane, unlabelled is unknown not green

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R480TB087G0R002MBJXJ1-*.md` glob. -->

## Ask

A reproducibility class (`exact` / `platform-exact` / `tolerance`+bound / `unreproducible`)
recorded on artifacts, where:

- the class is **derived from whether the artifact crosses the membrane**, not chosen by its
  producer — *reproducibility is where the meter and the communications live; decorrelation is
  where the individual lives* (Aaron 2026-08-23). `unreproducible` on a shared artifact is a
  **defect**, not a label.
- **unlabelled means unknown**, never `exact`-by-default, and unknown must never aggregate into
  a green verdict.
- a `tolerance` bound states its **budget** (the ULP count accumulates with tick count).
- the class is **earned by demonstration** (re-derived on a second machine), never asserted.

Same membrane as `local-time-never-enters-the-shared-fold` and §13 noninterference — third
instance. No enforcement in this pass.

Design: `docs/design/2026-08-23-verified-prior-provenance-prove-your-work-let-others-reproduce-exactly.md` §2, §3
