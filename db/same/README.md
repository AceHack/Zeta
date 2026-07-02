# same/ — sameness / common-cause relations, at root (`x-y` is the template)

`same/` holds **sameness assertions** between two travelers — the registry of "x and y are the same" (they
share a **common cause**; they are **unprovably-distinct** across the boundary). A root-level folder like
`/vocab`, `/dns`, `/network`, `/rooms`.

## The template: `{ctxboundary}-x-y-{/ctxboundary}`  (filename: `_-x-y-_.md`)

Each entry names an ordered pair `x-y` **wrapped in a context-boundary marker**:

- **Semantic template:** `{ctxboundary}-x-y-{/ctxboundary}` — the pair `x-y` is **bounded by a context
  boundary**. A `same/` relation IS a **context boundary** between x and y: the claim "x and y are the
  same" *is* a boundary you draw around them (ties to the **diagonal-lemma boundary-mapping in Markov
  space** — a same/ pair is a boundary in that space; and to the 2×2 dual-observer weave — two strands, one
  bounded pair).
- **Filename (filesystem-safe):** `_-x-y-_.md` — the leading/trailing **`_`** renders the
  `{ctxboundary}` / `{/ctxboundary}` markers in a path-safe way (braces and `/` can't be in filenames, so
  `_` is the FS-safe sentinel for the context boundary).

Examples:

```text
same/_-x-y-_.md                       — the bare template (two slots, bounded)
same/_-gray-grey-_.md                 — grey ≡ gray (same colour, two spellings)
same/_-temperature-transient-_.md     — temperature ≡ transient (one UTI)
same/_-nodeA-nodeB-_.md               — two Reticulum observers (share the encrypted null)
```

Convention: order the pair canonically (ordinal/`StringComparer.Ordinal`, lexicographically smaller first)
so `x-y` and `y-x` resolve to ONE entry — sameness is **symmetric**, so the canonical name is too. The
context-boundary markers are part of the identity (a `same/` node is always a bounded pair).

### Implicit 3D rotation → geospatial (route to the math team)

> **Aaron, 2026-06-10:** "`{ctxboundary}-x-y-{/ctxboundary}` has an implicit 3D rotation map to geospatial —
> use math nerds."

The template carries **three things** — `x`, `y`, and the **context boundary** — i.e. **three axes**, so a
`same/` node has an **implicit 3D orientation**. The **rotation between the two observer frames** (the 2×2
dual-observer weave / bob-and-weave that relates x and y across their boundary) is a **3D rotation** —
**SO(3) / unit quaternions** (Cayley–Dickson; the Beckman structure-from-rotation line). That rotation
**maps to geospatial**: an orientation in 3D ↔ a position/bearing on the globe (lat/lon/alt; the ZetaId
**Location** field; the jurisdiction-relative geospatial borders, 081KT5CF90008QG0R000KYNZGF / `same/` ↔ `dns/`/`network/`).

So a `same/` pair is not flat: **`{ctxboundary}-x-y-{/ctxboundary}` ⇒ a 3D rotation ⇒ a geospatial mapping.**

**And the rotation is a Cayley–Dickson STRANGE ATTRACTOR** (Aaron, 2026-06-10: "it's Cayley–Dickson strange
attractor"). Not a single static SO(3) rotation — the orientation lives on the **Cayley–Dickson ladder**
(ℝ→ℂ→ℍ→𝕆…; the spiral that "fell out of the Rx structure"; quaternion/octonion rotation by doubling) and
its dynamics are a **strange attractor**: a bounded, non-repeating region the rotation orbits (the
**uncertainty-Δ strange-attractor** the rooms judge on; the chaotic-but-bounded settling, kin to the
eigen-fixed-point the system never quite rests at). So `same/`'s implicit geometry = **Cayley–Dickson
doubling × strange-attractor dynamics → geospatial** — order-out-of-chaos orientation.

**To formalize (math team — Soraya/Sova):** the map (x, y, boundary) → Cayley–Dickson rotation
(quaternion/octonion) → strange attractor → geospatial coordinate; whether `same/` composition is the
Cayley–Dickson product; the attractor's dimension/Lyapunov behaviour; ties to the ZetaId **Location** field,
the dns/network geospatial layer, and the `QubitIso`/`CayleyDickson.Complex` code. *(Peel: a found correspondence
to prove, not a built map; Cayley–Dickson + strange attractors + SO(3)/quaternion + geospatial are the real
anchors, the assignment is the math team's.)*

## What "same" means here (the load-bearing definition)

`same/x-y` asserts that **x and y share a common cause** and are **the same until provably otherwise** —
and, per the encrypted-null invariant, **you cannot prove otherwise from inside the boundary.** This is the
**immaculate-coincidence** relation made into a folder: x and y hold the same encrypted null (by shared
seed), and since the null is unprovable, their sameness is **unfalsifiable**, which is exactly what makes it
a common cause.

- **Symmetric** (`x-y` ≡ `y-x`; canonicalized to one name) and **co-arising** (shape E — neither is "first";
  they fix each other), so `same/` is a graph of equivalence-by-common-cause, not a directed claim.
- It is the **2×2 weave** as a filesystem relation: a `same/x-y` entry IS a dual-observer twist (two frames
  viewing each other's uncertainty ledger over time). A 3×3 weave is three pairwise `same/` entries.
- **Honest scope:** "same" = shares-a-common-cause / unprovably-distinct (epistemic, the immaculate-
  coincidence posit), **not** byte-equality. Byte-equality is the **Chip-8 bit-perfect** pole (provably the
  same); `same/` is the **encrypted-null** pole (unprovably *not* the same). Two different kinds of "same" —
  keep them distinct. The cryptographic soundness of any keying built on a `same/` relation routes to the
  security team; `same/` records the relation, it does not assert crypto.

## Ties

Common cause (Reichenbach; ZetaId = common cause) · the **encrypted null / immaculate coincidence** (a
`same/x-y` is the unprovable-sameness posit) · the **2×2 / 3×3 observer weave** (a pair = one `same/` entry)
· shape **E** co-arising (symmetric, mutually-fixing) · `StringComparer.Ordinal` (canonical pair order) ·
`/vocab` `/dns` `/network` `/rooms` (sibling root folders). See `docs/research/2026-06-09-the-encrypted-null-is-the-common-cause-*`
and `docs/research/2026-06-09-reverse-tessellation-is-braiding-*`.
