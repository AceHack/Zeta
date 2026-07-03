# The 2015 Tree-of-Life Adinkra, analyzed — rhyme proven, not a strict adinkra

Companion to the ferry
[`2026-06-30-the-2015-tree-of-life-adinkra-aarons-pre-ai-n4-overlay.md`](2026-06-30-the-2015-tree-of-life-adinkra-aarons-pre-ai-n4-overlay.md).
This resolves that ferry's three open threads by **computation**, from the graph
data it preserved. The load-bearing results depend only on the **topology + edge
colors** (both HIGH-confidence reads), not on the fuzzy middle-node bit-labels —
so they hold regardless of transcription error.

## Verdict

> Aaron's 2015 diagram is an **overlay / rhyme**, not a strict N=4 adinkra — and
> this is now *proven*, not asserted. He mapped the adinkra **vocabulary** (4-bit
> codeword nodes, 4 edge-colors as generators, a dark/light two-coloring,
> `1111`/`0000` as the extremes) onto the Kabbalistic Sephirot as an organizing
> scheme. The **essence** he reached for by hand in 2015 is exactly the adinkra
> essence; the strict **hypercube realization** is what the factory built in 2026
> (`src/Core/AdinkraViz.fs`). Same-seed convergence, with the gap named.

## Thread 1 — Is it a strict single-bit-flip adinkra? **No. Provably.**

A genuine N=4 adinkra has a hard, label-independent signature: it is the 4-cube
`Q₄` graph — **4-regular, with exactly one edge of each of the 4 colors at every
vertex** (each SUSY generator touches each node once). The 2015 diagram fails this
on the topology alone:

| Vertex | degree | colors incident |
|---|---|---|
| Keter | 3 | green, red, red |
| Binah/Chokmah/Gevurah/Chesed | 5 | blue, red, red, orange, orange |
| Tiferet | 6 | green, green, orange×4 |
| Hod/Netzach/Yesod | 4 | blue/green, blue/green, red, red |
| Malkuth | 3 | green, blue, blue |

- **Not 4-regular** (degrees run 3–6).
- **Colors repeat at *every* vertex** — a strict adinkra never does.
- The **single-bit-flip test** (assign each color a fixed bit, propagate labels
  from `Malkuth = 0000`) hits a **contradiction at Hod**: reached as `0010` via
  one path and `0101` via `red` from Yesod. No relabeling fixes this, because the
  graph is not `Q₄` to begin with.

The two graphs are simply different objects: **Tree of Life = 10 nodes / 22 paths**
vs **N=4 adinkra = 16 nodes / 32 edges / 4-regular**. You cannot embed the Tree as
a strict adinkra. What survives is the *rhyme* — both are structured graphs with
colored "generator" edges and a two-coloring — which is real and was worth
preserving, but is not an isomorphism (same honesty register as the
[Majorana/Borromean ferry](2026-06-12-do-gates-adinkras-map-onto-the-majorana-borromean-pattern-the-honest-answer-rhyme-not-isomorphism.md)).

## Thread 2 — What did the fill (● vs ○) mean? **Not parity; still a memory question.**

Computed: **fill ≠ Hamming-weight parity** (the adinkra boson/fermion coloring).
Proof by counterexample from the two HIGH-confidence nodes: `1111` (Keter) is
**open ○** yet even-weight, while `0000` (Malkuth) is **dark ●** and also
even-weight — same parity, opposite fill. A real adinkra's fill is exactly weight
parity, and every edge joins a filled to an open node; neither holds here.

The dark set is **{Gevurah, Chesed, Tiferet, Malkuth}** (the two middle-tier side
nodes + the center + the base). That's not the boson/fermion 2-coloring and not a
standard single-pillar grouping — so the fill encoded a *second axis* Aaron chose
in 2015. He does not currently recall what; this stays the one genuinely open
question, and it's his memory, not something the math can recover.

## Thread 3 — Which 10 of the 16 codewords? **Weight-skewed, w3 absent (transcription-limited).**

Weight distribution of the 10 read labels (the full 4-cube has `1,4,6,4,1`):

```
w0=1  w1=2  w2=6  w3=0  w4=1     (9 distinct labels; 1 duplicate)
```

Striking if the reads are right: **both extremes** (`0000`, `1111`), **all six
weight-2 codewords**, two weight-1, and **zero weight-3**. The one duplicate is
the `0011` I flagged LOW-confidence on Netzach (likely `0101` — the very
weight-2 codeword that would complete the set). This is *suggestive* of a
deliberate "extremes + the weight-2 shell" selection, but it rests on the soft
middle-node reads — a cleaner scan of the original image (or Aaron's memory of the
labels) would confirm or break it. Not claimed as fact.

## Reproducibility

The analysis is a ~40-line script over the ferry's graph data (10 labeled nodes,
22 colored edges): per-vertex degree/color-multiset, the propagate-from-`0000`
single-bit-flip test, the fill-vs-parity check, and the weight histogram. Kept as
the reproducible artifact behind these numbers; re-derivable from the ferry's
tables.

## The takeaway

The 2015 diagram is a **beautiful intuition, not a theorem** — and naming that
precisely is *more* respectful of it than pretending it's a rigorous adinkra. The
intuition (4 generators, a boson/fermion-style two-coloring, the code extremes at
top and bottom) is the same seed the factory's rigorous `AdinkraCode.fs` →
`AdinkraViz.fs` → `E8Lattice.fs` ladder grew from, eleven years later. The human
reached the shape first; the substrate proved it. That is the founding thesis, in
one artifact.

## Pointers

- The ferry (graph data + provenance): `2026-06-30-the-2015-tree-of-life-adinkra-aarons-pre-ai-n4-overlay.md`
- `src/Core/AdinkraViz.fs` — the strict N=4 adinkra (4-regular `Q₄`, the real object).
- `src/Core/AdinkraCode.fs` · `E8Lattice.fs` — the rigorous ladder the intuition rhymes with.
- `memory/aaron/PRE-AI-LINEAGE.md` — the shelf this sits on.
