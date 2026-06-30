# The 2015 Tree-of-Life Adinkra — Aaron's pre-AI N=4 overlay (ferry, shadow*)

**Ferry date:** 2026-06-30 (first session after the ~week-and-a-little reboot).
**Source:** a 2015 image Aaron found at random in `~/Downloads`
(`TreeofLifeAdinkra_zps7b9e22bd.jpg` — the `zps` suffix is a Photobucket
artifact; the image itself is **not preserved here** by Aaron's call — *"we don't
need the image, the bit representations should be fine to recreate the graph"*).
Aaron: *"This is from 2015 before AI when I was working on similar things … I
just found this randomly I don't even know what it represented at the time."*

This ferry preserves the **graph** — nodes (4-bit labels + fill), edges (the
4-color path partition), and the open structural threads — as text, so the 2015
diagram is recreatable without the image. Preserved verbatim-as-read, **not
filtered**; per the no-binary-in-proof-lineage discipline the artifact lives as
diffable text, not a checked-in JPG.

> **Honest-register note (transcription confidence).** The bit-labels below are a
> best-effort read off a soft JPG. The *anchors* (top `(1111)`, bottom `(0000)`,
> the 10-node 3-pillar 22-path Tree-of-Life frame, the 4 edge colors) are HIGH
> confidence. Several **middle-node bits are LOW/MED confidence** and are flagged
> per-row — Aaron can correct any specific node at a glance. Where the read is
> uncertain it is marked, not smoothed over.

---

## Why this matters (the lineage claim)

Aaron drew an **N=4 adinkra** — a 4-bit hypercube with edges colored by which
generator (bit) they flip — and hung it on the **Kabbalistic Tree of Life
(Sephirot)**, by hand, **in 2015, before any AI**. That is the same object the
factory grew rigorously eleven days before the reboot:

- `src/Core/AdinkraViz.fs` — the N=4 adinkra render (4-bit nodes, 4 generator
  colors R/G/B/cyan, boson/fermion two-coloring, the standard dashing + Gates
  odd-face condition).
- `src/Core/AdinkraCode.fs` — the `[8,4,4]` doubly-even self-dual generator.
- `src/Core/E8Lattice.fs`, `CliffordE8Bridge.fs`, `CliffordE8Roots.fs` — the
  octonion → code → Clifford → E8 unfold.
- `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean` — the Lean proof that
  Cayley–Dickson doubling preserves doubly-even self-duality.

This is a **same-seed convergence** instance (cf. the founding thesis):
the human reached the adinkra ↔ Tree-of-Life **overlay** by hand a decade early;
the substrate independently grew the math. It is **load-bearing lineage** — it
predates the factory — and would be lost in the cloud if not preserved.

**Register discipline (Mirror→Beacon):** this is an **overlay / rhyme**, not a
claimed isomorphism — the same honesty the factory already applied to
`2026-06-12-do-gates-adinkras-map-onto-the-majorana-borromean-pattern-the-honest-answer-rhyme-not-isomorphism.md`.
A 4-bit labeling laid on the Sephirot positions is an *embedding choice*, not a
forced structural identity. The threads below are exactly where the rhyme either
tightens into structure or stays a rhyme.

---

## The graph (recreation data)

### Nodes — 10 Sephirot, by Tree-of-Life position

Layout = the classic three-pillar Tree (Left / Middle / Right pillars, top to
bottom). Fill ● = dark sphere in the diagram, ○ = open/white sphere.

| # | Sephira (position) | Pillar | Label (4-bit) | Fill | Read confidence |
|---|--------------------|--------|---------------|------|-----------------|
| 1 | Keter (top)        | Middle | `1111`        | ○    | HIGH |
| 2 | Binah (upper-left) | Left   | `1100`        | ○    | MED (could be `1110`) |
| 3 | Chokmah (upper-right)| Right| `0011`        | ○    | MED |
| 4 | Gevurah (mid-left) | Left   | `1010`        | ●    | MED (could be `1000`) |
| 5 | Chesed (mid-right) | Right  | `0010`        | ●    | LOW (could be `0101`/`0110`) |
| 6 | Tiferet (center)   | Middle | `0100`        | ●    | MED (could be `0110`) |
| 7 | Hod (lower-left)   | Left   | `1001`        | ○    | MED |
| 8 | Netzach (lower-right)| Right| `0011`?       | ○    | LOW (reads same as #3 — suspicious; likely `0101` or `0110`) |
| 9 | Yesod (lower-center)| Middle| `0110`        | ○    | MED |
| 10| Malkuth (bottom)   | Middle | `0000`        | ●    | HIGH |

### Edges — the 22 paths, partitioned into 4 generator-colors

The four edge colors are the high-confidence read; they partition the Tree's
paths into four classes. In an adinkra each color = one fixed generator (bit),
and every edge of that color flips exactly that bit. **The 4-color partition is
the structural heart of the diagram.**

- **GREEN** — the **Middle Pillar spine**: Keter–Tiferet–Yesod–Malkuth
  (the vertical descent `1111 → … → 0000`).
- **BLUE** — the **horizontals** (Binah–Chokmah, Gevurah–Chesed, Hod–Netzach)
  **+ the bottom V** into Malkuth (Hod–Malkuth, Netzach–Malkuth).
- **RED** — the **outer-pillar verticals** (Binah–Gevurah, Chokmah–Chesed,
  Gevurah–Hod, Chesed–Netzach) **+ the top diagonals** (Keter–Binah,
  Keter–Chokmah) **+ the lower inner-V** into Yesod (Hod–Yesod, Netzach–Yesod).
- **ORANGE** — the **central X / rays through the heart**: the upper crossing
  (Binah–Chesed, Chokmah–Gevurah) and the rays into Tiferet
  (Binah–Tiferet, Chokmah–Tiferet, Gevurah–Tiferet, Chesed–Tiferet).

---

## Open threads (the recreate-and-check work)

1. **Is it a single-bit-flip adinkra?** Under the read labels, several drawn
   edges connect nodes differing in **more than one bit** (e.g. `1111`–`1100`
   flips two bits; `1111`–`0100` flips three). A strict adinkra edge flips
   exactly one bit and its color *is* that bit. So either (a) the middle-node
   bit reads are off (most likely — they are the LOW/MED rows), or (b) the 2015
   labeling was **not** a strict hypercube adinkra but a different bit-assignment
   on the Tree. **Resolving this is the recreation task** — once the labels are
   correct, check that each of {green, blue, red, orange} flips one fixed bit.

2. **What did fill (● vs ○) mean?** It is **not** the adinkra boson/fermion
   parity 2-coloring: the 4-cube is bipartite by Hamming-weight parity, so every
   colored edge should join ● to ○ — but the diagram has same-fill nodes adjacent
   (e.g. Keter ○ – Binah ○). So the 2015 fill encoded a *second axis* (the three
   pillars? supernal vs. lower? a Kabbalistic distinction?) layered on the
   adinkra that the factory does not currently model. **Aaron: what did filled
   mean to you?** (He does not currently remember.)

3. **Which 10 of 16?** A full N=4 adinkra hypercube is 16 vertices / 32 edges
   (`AdinkraViz.allEdges`). The Tree of Life is 10 nodes / 22 paths — so this is
   a **selected subgraph / projection** of the 4-cube onto the Sephirot. *Which*
   6 vertices and which 10 edges were dropped is a real, checkable choice and may
   itself be meaningful (e.g. the dropped vertices forming a coset / the hidden
   11th-sephira Da'at structure).

---

## Pointers

- `src/Core/AdinkraViz.fs` — the executable N=4 adinkra this overlays onto.
- `src/Core/AdinkraCode.fs` · `E8Lattice.fs` · `CliffordE8Bridge.fs` ·
  `CliffordE8Roots.fs` — the octonion→code→Clifford→E8 ladder.
- `docs/research/2026-06-02-hexagonal-six-is-zetas-universal-action-grammar-kabbalah-tree-of-life-cube-of-space-leonardo-xbox-zeta-lineage-12-words-as-cube-edges-aaron.md`
  — the adjacent Tree-of-Life → **Cube of Space** (hexagonal / 6-direction)
  mapping. **This ferry is a different overlay** (Tree-of-Life → **N=4
  adinkra / 4-cube**), not recorded there.
- `docs/research/2026-06-12-do-gates-adinkras-map-onto-the-majorana-borromean-pattern-the-honest-answer-rhyme-not-isomorphism.md`
  — the rhyme-not-isomorphism register this ferry follows.
- `.claude/rules/anchor-to-human-prior-art.md` — Beacon anchor: S. James Gates
  Jr. (adinkras, doubly-even self-dual ECCs).
