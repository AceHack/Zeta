# The four-colour connection is jurisdictional agreement — and the bound is topological, not four

**Register:** Aaron's framing (Mirror), compressed to its Beacon anchors and then
**corrected on one point**. The correction strengthens the claim rather than weakening
it. Nothing here is metered; the checkable consequence in §5 is the falsifier and it has
not been run.

## 1. The claim

Aaron 2026-08-24, asked how RGB(A)/CMYK, the four-colour theorem, and the adinkra
"four-colour subalgebras" connect:

> *"there is first jurstictanal awareness meta frame gererator+joins to the base travelr
> frame, this lets one travler draw many jusdictal lines that diagress based on the
> selected jursidiction drawing the lines. Then the four color theorm is a way to create
> jurstictioal agreement over time based on multiple observer/traveral observations of
> the different drawings."*

Two layers:

1. A **jurisdictional-awareness meta-frame**, `generator + join`-ed onto the base
   traveler frame, letting *one* traveler draw *many* jurisdictional line-sets that
   differ by which jurisdiction is doing the drawing.
2. The **four-colour theorem** as the mechanism by which those differing drawings reach
   **agreement over time**, across multiple observers.

## 2. This is the theorem's native domain, not a metaphor

Worth stating plainly because an earlier reading in this session (mine) was going to
reject it. **The four-colour theorem is about jurisdictional maps** — Francis Guthrie
posed it in 1852 about colouring the counties on a map of England. Appel & Haken proved
it in 1976. Aaron is using it *closer to its origin* than the adinkra reading was.

**And the adinkra "four" is a different four.** In
`src/Core.TypeScript/research/adinkra-ecc/regular-representation-defect.ts` the
four-colour subalgebra is `Cl(0, N−k)` with `k = selfOrthogonalBound(N) = floor(N/2)`
from Gleason/Mallows–Sloane — so at N=8, `N−k = 4`. That four is **derived from a coding
bound**, and it has nothing to do with chromatic number. Adinkra colouring is **edge**
colouring of an N-cube quotient; the four-colour theorem bounds **planar vertex**
colouring. Two different fours, and this document does not merge them. (RGBA's four is a
display convention — Lumen measured that "RGBA's 4 does no work in the derivation";
CMYK's is a printing convention.)

This is the `mod-eight-correspondence.ts` discipline applied to fours: **which fours are
the same four.** Answer so far: the jurisdictional four and the subalgebra four are not.

## 3. The mechanism Aaron is pointing at is real

The valuable content is not the number. It is that the theorem supplies a
**drawing-independent bound**:

> However the boundaries are drawn, a fixed finite palette suffices to distinguish
> adjacent regions.

So observers who **disagree about where the lines fall** can still agree on **how many
labels are needed** to keep neighbours distinct. That is agreement *without* agreement on
boundaries — which is precisely the shape
[`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md)
demands: divergence that stays reconcilable, with both branches held and neither collapsed
to one value.

The `join` half is already built and is not metaphorical. `src/Core/TravelerFrame.fs`
Layer-0: a traveler has no global frame, constructs a local causal frame as a vector
clock, and the **inter-frame transformation is the causal-join — pointwise `max`, the
least upper bound — proven to form a bounded join-semilattice with identity ⊥.** That is
the "generator+joins to the base traveler frame" clause, in code, with a theorem.

## 4. The correction: the bound is topological, and four is the planar special case

The claim as stated — *"basically four colour theorem on a more abstract n dimensional
scale"* — is where it breaks, and the break is well-characterised:

| substrate | colours needed |
|---|---|
| plane / sphere | **4** (Appel–Haken 1976) |
| torus | **7** (Heawood 1890) |
| genus *g* surface | ⌊(7 + √(1 + 48g)) / 2⌋ (Heawood bound; Ringel–Youngs 1968 proved it tight) |
| **3 dimensions and above** | **no finite bound exists** |

Two further preconditions, both of which real jurisdictions violate routinely:

- **Contiguity.** A jurisdiction with an **exclave** — two disconnected pieces that must
  carry the same colour — is not covered. Four-colourability is a statement about
  contiguous regions; enclaves and exclaves break it, and political maps are full of them.
- **Planarity.** Overlapping or nested jurisdictions are not a planar map at all.
  Overlapping jurisdiction is the *normal* case in law (municipal ⊂ state ⊂ federal,
  plus non-nesting special districts), so this is not an edge case.

**Why the correction strengthens the design.** The invariant Aaron actually needs is not
"4". It is:

> **A finite bound fixed by the topology of the substrate and independent of the drawing.**

Four is what that bound evaluates to when the substrate is planar. Stated this way the
colour count stops being a constant and becomes a **measurement of the substrate's
topology** — which is the honest-meter posture the rest of the system already takes:
the number reports which regime you are in, and a jurisdiction structure that needs 7 has
told you it is toroidal.

## 5. The checkable consequence (not yet run)

This is the falsifier, and it is cheap:

> Take the jurisdictional line-sets the system actually produces. **Is the adjacency graph
> planar?** If yes, 4 is earned and Aaron's mechanism holds as stated. If no, compute the
> chromatic number and the genus — and the *gap* between 4 and what is needed is a direct
> measurement of how far the jurisdiction structure departs from a map.

Register: `toy` until that runs. `heawood` currently appears in **1** file and `planar`
in 7, so the planarity precondition is essentially unguarded in the repo today — nothing
would catch a non-planar jurisdiction structure silently assuming 4.

## 6. What this does NOT claim

- It does not connect the jurisdictional four to the adinkra subalgebra four. §2 says why not.
- It does not claim RGBA or CMYK carry structure. Both are conventions; the burden is on
  anyone asserting otherwise to exhibit the map, per
  [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md).
- It does not claim the jurisdictional adjacency graph *is* planar. That is §5's open question.

## Anchors

- Francis Guthrie (1852), the original county-colouring question; Appel & Haken (1976), the proof
- P. J. Heawood, *Map-Colour Theorem* (1890) — the genus bound; Ringel & Youngs (1968) — tightness
- Lamport (1978) — vector/causal clocks, the base traveler frame's anchor
- Doran, Faux, Gates, Hübsch, Iga & Landweber (arXiv:0806.0051) — adinkra chromotopologies, the *other* four
- Gleason / Mallows–Sloane — `k ≤ floor(N/2)`, the bound the subalgebra four is derived from
