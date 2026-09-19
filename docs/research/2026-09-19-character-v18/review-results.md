# v18 measured review results

Date: 2026-09-19
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

The selected scene hash is pinned in [validation.json](validation.json).
Thirteen sampled poses cover the diagnostic sequence and bilateral finger curls.
This is sampled structural evidence, not proof across every pose or a visual
quality score. The point and matrix tolerances are in the executable recipe.

| Selected mesh | Vertices | Boundary edges | Maximum edge ratio | Minimum edge ratio |
| --- | ---: | ---: | ---: | ---: |
| AceHack / Independent head generator | 111965 | 600 | 1.305 | 0.825 |
| Xenaa / Reconstructed head and neck | 61440 | 0 | 1.326 | 0.921 |
| Xenaa / Continuous anatomical upper body | 83402 | 434 | 2.978 | 0.043 |

Ratios use resting edges longer than 0.3 mm. The separate linear-versus-DQ
comparison uses a 1 mm floor; its counts must not be conflated with this table.
Small edges still show substantial local compression. Normalized skin weights,
valid bone references, finite deformed positions, rigid facial attachment and
hair parenting pass the assertions. Xenaa's closed head/neck has no boundary
or nonmanifold edges; this does not make the separate body and garments watertight.

The actual upper-body neck boundary has 210 sampled vertices. Across the
13 poses its maximum nearest-head distance is
1.304 mm. All signed distances remain inward
(the least-inward sample is -1.080 mm), so the measured rim stays
inside the head/neck surface. This measures local overlap, not welded topology.
The first diagnostic mistakenly included nearby shoulder vertices; it was
corrected to use boundary-edge membership rather than height alone.

The left and right curl tests each move the intended hand by about 59 mm at
the most displaced sampled vertex, with exactly zero measured displacement
in the opposite hand. Thirty finger bones carry anatomical influences. This
is Blender animation evidence, not live camera tracking or an Effect House test.

The 22000-curve groom contains 1320000 points. Its attachment is rigid to Head;
there is no collision or secondary-motion claim. The old fused Xenaa head and
recovered outfit-hair objects are absent from the selected scene. AceHack's
existing short-hair surface is retained deliberately.

Visual findings and ordered follow-ups are in [README.md](README.md). In
particular, projected skin and cloth, neck shading transitions, hair silhouette,
facial topology and full-body polish remain unfinished. No AAA-quality, likeness
score, facial-expression support or TikTok performance result is claimed.

The full-body combined-pose render exposes tearing in retained lower-leg and
inner-coat surfaces. Those meshes are outside the three-mesh assertion table
above. Their visible failure blocks whole-body rig acceptance and must be
repaired before derivative export. The sampled checks must not be reported as
a passing whole-character deformation test.
