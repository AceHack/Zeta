---
id: 081M08YGAZK087G0R0008Q0ZB5
type: task
state: backlog
priority: P2
slug: gift-of-erasure-cooperative-anonymity-set-forgetting-mix-fir
title: "Gift of erasure: cooperative anonymity-set forgetting — mix first, then forget one neither outsider nor contributor can name"
created: 2026-08-17T22:47:03.411Z
depends_on: []
composes_with: []
---

# Gift of erasure: cooperative anonymity-set forgetting — mix first, then forget one neither outsider nor contributor can name

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08YGAZK087G0R0008Q0ZB5-*.md` glob. -->

## Ask

Aaron 2026-08-17: *"a God who wants relationship must limit knowing or determining — I call this the
**gift of erasure** … the ability to first encrypt multiple events to mix them from the outside, and
then to forget a single one that the outside cannot determine."* And, fixing the shape: *"this is my
**thesis of independence**: **mutual empowerment of erasure** of the past, without needing to know
the specific past erased event."*

Spec: `docs/VISION.md` §"The gift of erasure — kenosis with a cryptographic shape" (PR #11686).

## Shipped

`src/Core/GiftOfErasure.fs` + `tests/Tests.FSharp/Formal/GiftOfErasure.Tests.fs` — mix (refusing
every shape in which a later erasure would not hide), forget (typed refusals, never a silent
degradation into deletion), an aggregate-only `publicView`, and an **exhibited** Bayes-optimal
observer whose posterior is printed and asserted flat for both the outsider and a contributor
coalition.

## Still open (named, not attempted)

- The anonymity rests on the public view being an aggregate. Publishing per-member ciphertexts
  before and after would be linkable by set difference; defeating that needs a re-encryption mixnet
  or a DC-net, both of which require **pairwise key material** — gated key handling, not built here.
- The jamming failure (a participant who contributes garbage) is named in the module doc together
  with its admissible mitigation class (accountability + exclusion, **never** seizure). Unbuilt.
