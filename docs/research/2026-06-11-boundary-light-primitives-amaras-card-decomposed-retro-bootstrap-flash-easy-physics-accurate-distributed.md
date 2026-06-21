# The lighted-boundary primitives — Amara's card decomposed to generators; the retro Bootstrap; Flash-easy, physics-accurate, distributed

Aaron 2026-06-11: *"Can we make tessellation happen so we can be progressive — look at Amara's image
and see what reusable primitive would let her compress her image down to text, in minimal form,
homoiconic-ish and understandable by humans, expressive, based on generator functions and the physics
of 2D boundary space. Layout and such."* / *"Think Bootstrap UI stuff (and whatever the latest one
everyone uses) but for retro games. We can add physics animations later too — think Adobe Flash easy,
but quantum-physics-level accurate, and multi-node distributed."*

## The decomposition her card teaches (BUILT: `src/Core/BoundaryLight.fs`, 4/4 green)

Looking at the actual image, every element reduces to SIX primitives — each a human-readable `gen`
line in MediaLines:

| element of her card | primitive | irreducible (stored) | generated |
|---|---|---|---|
| silhouette, hair strands, the cross | **curve** (polyline) | a handful of integer points | every pixel along it |
| the bloom/glow everywhere | **glow** = exp(−d²/σ²) of the distance field | σ + which curve | ALL the light |
| the face's two sides | **mirror** (bilateral symmetry) | HALF the points + the axis | the other half |
| the starfield | **scatter** (seeded) | count + the DST common-cause seed | every star |
| the pixel-art look at any size | **grid** (tessellation) | nothing — a sampling resolution | progressive renders: 8×8 → 64×32 → … the SAME text at every level |
| halo arc / title / motto / glyph row | **stack/row layout** | section order + alignment | pixel positions |

**The unification that makes this more than image compression: the glow kernel IS our PSD/RBF kernel**
(Schoenberg — the same exp(−d²/σ²) as LinguisticSeed and ConformalGA), applied to the boundary's
distance field. Light and similarity are one mathematics here — and so **her image is literally her
motto**: store the boundary, generate the light. THE LIGHTED BOUNDARY, as physics.

Tessellation answers "progressive" exactly: the continuous generators sample at any grid; CHIP-9 is the
coarsest honest level; the slider rises (16×16 → SVG → GPU) without the stored text changing one byte.
Tested: the same curve renders deterministically at 8×8 and 16×16.

## The retro Bootstrap (the component layer on top)

Bootstrap/Tailwind's lesson, applied at the slider's low end: a **component framework of named,
composable, capability-honest UI primitives** — the 081KTSZN10008QG0R001BW91GT UX set (glyph atlas, heat bar, cursor menu,
compass doors, presence dots, narrator ticker, avatar slot) PLUS the layout primitives (stack/row/
align) as MediaLines sections. A card, a board screen, a character-select — each a few readable lines
composing the same parts, rendering at every capability from Mono1 up. Utility-first, like the modern
kits — but the utilities are generators, not CSS.

## Flash-easy, physics-accurate, distributed (the animation layer, named for later)

The Flash lesson (what made it beloved): a TIMELINE anyone could author — tweens, easing, onion-skin
simplicity. Ours: timeline sections in MediaLines (anim lines naming frames/tweens) — **but the tween
engine is Chip9Phys** (fix16 exact, clock-free) and the clock is **TimeGen** (the seeded common cause),
so the same animation is: easy to write (Flash), EXACT to replay ("quantum-physics-level accurate" =
deterministic to the bit, treaty-lockable), and **multi-node distributed for free** — lockstep over the
mesh is already how MeshPong runs; an animation is just a replayed trajectory, so every node renders
the identical frame at the identical tick. Anchors: Flash/Director (Macromedia), CSS/Tailwind
(utility-first), SDF rendering (Valve/Green 2007 — the glow's industry cousin), L-systems (Lindenmayer —
hair strands as generated curves, the named next slice).

## Pointers

- `src/Core/BoundaryLight.fs` + tests (curve/glow/mirror/scatter/grid — built) · MediaLines (`gen`
  lines; the storage law) · Chip9Phys + TimeGen (the animation engine's two halves, built) · 081KTSZN10008QG0R001BW91GT
  (the component set) · Amara's card capture (the worked example) · the quasi-crystal arc (this is its
  2D-image instance).
