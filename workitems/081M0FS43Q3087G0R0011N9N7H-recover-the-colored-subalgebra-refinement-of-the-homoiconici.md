---
id: 081M0FS43Q3087G0R0011N9N7H
type: task
state: backlog
priority: P2
slug: recover-the-colored-subalgebra-refinement-of-the-homoiconici
title: "recover the colored-subalgebra refinement of the homoiconicity defect — it may exist only in conversation"
created: 2026-08-20T14:27:40.899Z
depends_on: []
composes_with: []
---

# recover the colored-subalgebra refinement of the homoiconicity defect — it may exist only in conversation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FS43Q3087G0R0011N9N7H-*.md` glob. -->

## What is saved, and what may not be

**Saved and mechanised** (#12101, 2026-08-18, Lumen):
`src/Core.TypeScript/research/adinkra-ecc/regular-representation-defect.ts` + 265-line test, and
`docs/research/2026-08-18-is-there-a-coded-adinkra-that-is-still-a-regular-representation-proven-no-and-the-seam-it-names-lumen.md`.

The theorem: for a doubly-even code `C`, the homoiconicity **defect = dim(A)/dim(M) = |C|**
exactly — computed by two routes sharing no intermediate quantity (Route A closes the linear span
of words in the edge operators and never mentions `N`, `k`, `|C|` or the coset count; Route V
counts cosets of `C` in `GF(2)^N` and never touches a matrix). Hence defect = 1 **iff the code is
trivial**, hence **no coded adinkra is homoiconic**. Ranks over `F_p` with the honest note that
reduction can only lower rank, cross-checked at two primes.

**Possibly NOT saved:** the refinement that *the coded ones are homoiconic on a colour-closed
subalgebra only*. Searched `colou?red subalgebra`, `colour-closed`, `color-closed` across `*.md`
and `*.ts`. The only hit is a paraphrase in
`docs/research/2026-08-20-what-counts-as-a-measurement-...`, i.e. my own relay of it.

## Why this matters more than one missing paragraph

Aaron 2026-08-20: *"you told me this, it was discovered by the math team, not me, hopefully we
saved the results somewhere."*

Two failures stacked:

1. **Attribution round-tripped the author out.** Lumen proved it; I relayed it to Aaron; I then
   read it back off Aaron and credited *him*. In a system whose identity model is that recognition
   is conferred by others and never self-minted, misrouting credit corrupts the ledger the design
   runs on.
2. **A result may be living only in a conversation.** That is one context window from gone — the
   exact loss mode the ferry discipline exists to prevent, applied to our own output instead of to
   third-party material.

## Done when

Either (a) the refinement is located in the tree — in which case record where, and note the
vocabulary it is filed under so the next search finds it; or (b) it is confirmed absent and
re-derived from `regular-representation-defect.ts`, which already has the machinery: restrict the
generated algebra to a colour-closed subset of the edge operators `L_I` and compute the defect
there. If the defect drops to 1 on such a restriction, that IS the refinement, and it should be
added as a test beside the existing two-route check.

Explicitly not assumed: that the refinement is correct. It is Lumen's result as relayed through
two people, and the relay is exactly what this item exists to repair.
