---
id: 081M23M0MVD087G0R003NR0ET1
type: task
state: backlog
priority: P2
slug: reflective-4-21-in-the-only-register-the-geometry-supports-r
title: "Reflective 4_21 in the only register the geometry supports: root-quantised views, two-sided, 768 faces declared sideless"
created: 2026-09-09T17:33:00.000Z
depends_on: []
composes_with: []
---

# Reflective 4_21 in the only register the geometry supports

## BLOCKED — do not build. Aaron, 2026-09-09: hold reflections until the projection measurement comes back.

A sibling agent is measuring whether the interpenetration and the overdraw pathology are
**intrinsic to the object** or **artifacts of `embed3d` specifically** — whether a different
3D embedding changes the numbers. Reflections are downstream of that: a surface with no
consistent side cannot be reflective, and we do not yet know whether the surface has to be
that way.

What is written below is **analysis**, produced under
`081M23FPSHV087G0R001V4M5QV`, and it exists to inform that decision rather than to pre-empt
it. Nothing here is a licence to start building.

## The split that scopes the sibling measurement

This matters for what the sibling agent is measuring, because the two halves have different
answers already:

| property | where it is computed | projection-dependent? |
|---|---|---|
| **27 incident 2-faces per edge** | `E8Exact`, pure integer 8D — `3 * f2 / f1 = 3 * 60480 / 6720` | **NO. Intrinsic to 4_21.** No embedding can change it |
| the f-vector, the face normals, `\|n\|^2 = 48`, the five brightness levels | `E8Exact` / `E8Shading`, pure integer 8D | **NO** |
| **768 faces with no determinable front side** | `E8Embedding`, after projection | **YES** — a different embedding could move or remove this |
| **leaf/root surface-area ratio ~1,140** (the BVH pathology) | `E8Raytracer`, over projected triangles | **YES** |

So the sibling's question has a partial answer already, and it is a *negative* one on the
half that matters most for reflection: **the 27-faces-per-edge incidence is a theorem about
the polytope in 8 dimensions, computed with no float anywhere in its call graph.** A
different projection cannot give the shell an inside; at best it can change *how* the
sidelessness manifests in 3D. The 768 and the overdraw ratio genuinely are the embedding's,
and those are worth measuring.

## The measured obstacles (from `docs/research/2026-09-09-rung-7-*.md` §7.1)

Each pinned by a falsifier in `tests/Tests.FSharp/E8Render.Tests.fs`:

1. **768 of 60,480 projected faces (1.27%) have no determinable front side** — their plane
   contains the origin. Not a tolerance artefact: the smallest non-zero origin-to-plane
   distance over the other 59,712 is 0.002329, three orders of magnitude above the
   threshold. Rung 6 already closed the obvious repair (the projection of `a+b+c` is exactly
   3x the projected centroid, so "import the 8D orientation" is the same failing test).
2. **A view-dependent term does not become per-hit work if the view is a root.** Measured
   over seven root views, the specular numerator takes at most FIVE distinct values across
   all 60,480 faces — so a reflective 4_21 would be one five-entry table per view, 240 of
   them, about 14 MB, precomputable and still exact.
3. **Exactness ends at the camera.** The specular denominator is `48 * sqrt(8|V|^2)`,
   rational exactly when `8|V|^2` is a perfect square: true for a root, false for a free
   camera.

## If and when it unblocks

Exactly one register, said in the type: **root-quantised view directions, two-sided
reflection, and the sideless faces declared rather than shaded**. A free camera or a claimed
orientable mirror surface is not a feature we have not got to; it is a claim the geometry
does not support.

Falsifiers it would have to carry:

- the per-view specular table is <= 5 entries for every one of the 240 root views;
- a non-root view is REFUSED, not silently approximated;
- the sideless faces are enumerated and excluded by name, never quietly shaded.

## Not blocked, and already delivered

A mirror **in the scene reflecting our object** needs nothing new — secondary rays are
ordinary rays and the existing BVH and five-level lookup serve them unchanged. That half was
never the tension.
