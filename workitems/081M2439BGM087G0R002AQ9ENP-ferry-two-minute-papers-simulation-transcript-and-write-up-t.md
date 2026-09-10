---
id: 081M2439BGM087G0R002AQ9ENP
type: task
state: backlog
priority: P2
slug: ferry-two-minute-papers-simulation-transcript-and-write-up-t
title: "Ferry Two Minute Papers simulation transcript and write up the learned-geometry Bayesian direction"
created: 2026-09-09T22:05:48.948Z
depends_on: []
composes_with: []
---

# Ferry Two Minute Papers simulation transcript and write up the learned-geometry Bayesian direction

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2439BGM087G0R002AQ9ENP-*.md` glob. -->

## What landed

Two documents, no code and no falsifier.

1. `docs/ip-questionable/2026-09-09-two-minute-papers-deformation-topology-ferrofluid-simulation-transcript.md`
   — the supplied transcript preserved verbatim (8584 bytes, SHA-256
   `ad941c985ae3ff95d7ef312b346de0cdcf249e84b94da461ab2490fc46fc7cd0`, byte-identical to the
   supplied text and re-extracted from the committed file to confirm it), the video title and
   channel authenticated via YouTube's oEmbed endpoint, the four covered 2024 ACM TOG papers
   identified from their own PDFs, and the two third-party repositories recorded for licence
   and capability only under the clean-room rule.

2. `docs/research/2026-09-09-learning-geometry-from-pictures-is-a-second-track-and-efficiency-is-its-entry-fee.md`
   — the direction Aaron named, with each connection tested rather than asserted, and the
   four-number entry fee for the sanctioned second track.

## The three findings worth carrying forward

- **The video overstates Progressive Dynamics.** The paper claims "close first-order
  consistency" and documents a divergence that recovers; the narration says the outcome
  "remains the same". The mechanism underneath is still the valuable part: the coarse level
  is *derived from* the fine one, which is derived-not-authored applied to LOD.
- **"Nonlinear inverse problem" does not by itself license the UT.** It licenses
  Levenberg–Marquardt, bundle adjustment, VI, MCMC and gradient descent equally. The UT is
  distinguished only in a recursive-Bayesian or EP formulation — a formulation nobody has
  chosen.
- **Aaron's direction is two projects, not one.** LOD-by-restriction keeps the derivation and
  needs no second track; reconstruction-from-photographs gives it up and is the track that
  owes the four numbers.

## Not done

No falsifier was added, so none was mutation-tested. The two unrun falsifiers this proposes —
the LOD-as-Z-set locality measurement and the four-number comparison — are stated in the
research document and are stated so they can return a negative.
