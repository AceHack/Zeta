# Character v17: full review and independent hair study

Date: 2026-09-18
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

## Direction and baseline

The user requested several high-quality Blender master iterations before making
another reduced delivery asset. Hair is a priority, alongside the outstanding
surface, skeleton and deformation touchups. TikTok remains the eventual delivery
target. This is a quality study, not a new mobile submission or a game-ready
master. PR #17431 is merged at `7e2f7a43160a1813e452eb25f64e5da25dabd917`.
The [v16 record](../2026-09-16-tiktok-character-v16/README.md) remains the accepted
comparison baseline; this study does not silently replace it.

## Full review of existing areas

This is a self-review of the existing character pipeline. New measurements come
from reopening v16; previous pose and runtime findings are explicitly inherited.
No new live face, finger, camera or phone test was performed.

| Area | Finding | Next acceptance check |
| --- | --- | --- |
| Likeness | Front projection retains recognizable reference detail; other views are much weaker. | Matched neutral front, both profiles and rear against the reference art; explicitly mark unseen anatomy as authored. |
| Surface topology | AceHack has 390645 triangles, Xenaa 424625 across audited meshes. Dense triangulation does not supply animation loops. | Retopologize mouth, eyelids, shoulders, elbows, hips and knees while retaining surface detail. |
| Mesh boundaries | Body boundaries: AceHack 1084 edges, Xenaa 2004; head boundaries: 441 and 878. Open garment edges can be intentional. | Inspect each seam; distinguish garment hems from unintended holes. |
| Head and neck | The source head includes projected appearance and rough rear reconstruction. Mask-only scalp removal exposes cut planes. | Continuous neck coverage in all head turns; preserve the accepted face during scalp reconstruction. |
| Hair | Short head shell and long recovered hair are different reconstructed surfaces. Remaining garment fragments are not clean semantic hair. | Independent scalp, roots, locks and tips; no outfit attachment; front/side/back and head-turn views. |
| Rear garment | Broken surfaces and hair remnants remain beneath the previous lining. | Explicit continuous rear garment surface, inspected with hair hidden. Hiding defects under a groom is not repair. |
| Shoulders and elbows | V16 reduced extreme stretching but AceHack wide-arm compression increased from 239 to 253 edge observations. | Volume-preserving anatomical loops, corrective shapes and repeatable wider-arm/elbow views. |
| Skeleton | Each rig has 50 bones, only 17 weighted groups. Bone count is not functional coverage. | Check rest axes, parent hierarchy, left/right motion, joint centers and actual influenced vertices. |
| Controls | Existing timeline uses direct synthetic bone rotations. | Author usable IK/FK controls, pole targets and limits; verify elbows/knees do not flip. |
| Legs and clothing | Knee compression and hidden leg/coat boundaries remain. Both knees exist in the v16 test timeline. | Isolated left/right knee, hip rotation, crouch and combined motion with coat clearance. |
| Face | No shape keys on the audited v16 meshes. Earlier v14 prototypes do not transfer. | Real eye/mouth topology, jaw/eyelid motion and independently inspected expressions before channel coverage claims. |
| Fingers | Existing bone names do not imply individually weighted fingers. | Separated finger topology, each digit curl/spread and contact test before tracking claims. |
| Materials | Reference appearance is projection-dependent, with baked lighting and distorted rear detail. | Separate base color, roughness, normal and metal response; inspect under neutral and changed lighting. |
| Animation | Head attachment can be measured independently of visual quality. | Combined poses, hair/body clearance and secondary motion; current rigid hair has no collision solver. |
| Mobile | V14 is the last measured Effect House candidate. | After master acceptance, separate reduction, face targets, import, actual tracking, device appearance and performance measurements. |
| Storage | Generated media belongs in one-version release ZIPs. | Keep recipes, hashes and compact receipts in Git; preserve a useful rollback and unique inputs locally. |

[Machine-readable inventory](audit.json) records counts, materials, attributes,
weighted groups and bone hierarchy. Boundary counts include intentional cuts and
are not a count of visual defects. The audit covers the listed character meshes,
not platform pedestals or every scene object.

## Hair experiment and rejected approach

A deterministic groom uses explicit guide paths, 25300 native hair curves and
56 points per curve. It adds a rear curtain, asymmetric side flow, tapered tips
and a separately authored dark scalp shell (hidden in the selected comparison). Both new objects are parented to
Head with a rest-space binding. Their rigid attachment is checked at all ten
existing diagnostic frames. This is not secondary hair motion, scalp-surface
attachment, collision handling or an optimized hair-card export.

The first removal experiment deleted vertices using `reviewScalpHair`. Rendered
front and rear views exposed hard cuts and missing head coverage. Adding a scalp
shell alone did not fix the transition. That removal is rejected. The selected
comparison candidate retains the original head and recovered-hair surfaces while
adding the groom. Consequently it does not establish removal of all fused hair
or repair of underlying garment fragments. The rejected front/back images are
retained as evidence; there is no need to keep every intermediate Blender file.

This is deliberately a reversible study. The v16 source is never overwritten.
The recipe and validation will let the next pass distinguish extra strand detail
from an actual improvement in anatomical reconstruction.

## Next master passes

1. Finish the scalp/face boundary and rear garment with hair hidden, then refine
   the groom into deliberate clumps and flyaways. Preserve front likeness.
2. Rebuild deformation topology and test joint placement before adding corrective
   shapes, controls and secondary hair/cloth motion. Repeat bilateral and combined
   poses; do not accept a front-only beauty render.
3. Author facial and finger deformation, refine PBR materials and evaluate under
   multiple lights. Only then produce a separately reduced TikTok derivative.

Blender's native hair workflow supports guide-based interpolation and surface
attachment; these are relevant follow-on tools, not features claimed by this
rigid-parent prototype. See the official
[interpolation documentation](https://docs.blender.org/manual/en/5.1/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)
and [curves release notes](https://developer.blender.org/docs/release_notes/3.3/nodes_physics/).

This geometry recipe is useful provenance for the broader generator research.
It introduces no new Clifford algebra result, learning benchmark or neural model.

## Visual verdict and reproducibility

The strand curtain improves rear strand detail but is not accepted as a finished
master. Side gaps, the old bob underneath, overly uniform locks and the crown
transition remain visible. The first priority is topology and groom integration,
not a higher strand count. Retaining the reconstructed hair avoids the rejected
mask cut but leaves its original artifacts. No overall likeness or quality win
is claimed.

The selected study is `review/Blender-Hair-Study-v17.blend`. Restore v16 to the
sibling `TikTok-Character-Quality-v16` folder. Copy the source recipes from
[sources](sources/) into a sibling `TikTok-Character-Quality-v17` folder and remove
the `.txt` suffixes. With Blender 5.2.1 LTS, run `audit_v17.py`, `groom_v17.py`,
`baseline_v17.py`, then `validate_v17.py`, using `--background --python-exit-code 1`.
The selected recipe reproduces the retained-source candidate; rejected removal
images are historical evidence, not output of that final recipe. The pseudo-random
seed is fixed; byte-identical Blender saves/renders are not established.

## Archive and validation

The [v17 experimental release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-hair-study-v17-20260918)
is the designated archive location. [Manifest](artifact-manifest.json) lists
exact bytes and hashes; the ZIP contains only this selected study, its recipes,
receipts and comparison images. The earlier model itself is not bundled.

[Validation](validation.json) reopens the saved candidate and verifies all
original scene mesh coordinates, loop indices, material indices and UVs against
v16. New groom coordinates are finite. Both new objects follow the Head transform
at ten diagnostic frames; the auxiliary scalp shell is hidden in the selected
study. These checks neither certify absence of collisions nor visual acceptance.
[Repository checks](repository-checks.md) distinguish local gate failures from
Blender-specific results.

## Follow-on skinning ablation

While release checks ran, the [same ten-pose evaluator](sources/compare_skinning.py.txt)
compared v16 linear skinning with Blender's preserve-volume option enabled on the
audited armature modifiers. Neither geometry nor weights were changed. These
are diagnostic observations over the existing pose suite, not a held-out test.

| Pose | Linear extreme stretches | Preserve-volume extreme stretches | Linear compressed edges | Preserve-volume compressed edges |
| --- | ---: | ---: | ---: | ---: |
| Left arm | 0 | 0 | 6 | 2 |
| Both arms 75 degrees | 5 | 17 | 274 | 240 |
| Elbows | 0 | 1 | 0 | 0 |
| Left knee | 0 | 0 | 45 | 35 |
| Right knee | 0 | 0 | 30 | 42 |
| Combined | 0 | 0 | 36 | 44 |

These sums combine both characters and all audited meshes. As in v16, extreme
stretch means greater than 3x, compression below one-third, and rest edges of
1 mm or less are excluded. Repeated observations are not unique defects.
[Full measurements](skinning-comparison.json) retain mesh-level results.

The blanket preserve-volume switch is not adopted: compression improves in some
poses but worsens in others, and new extreme stretches appear. No visual
improvement is claimed from these numerical results, and no altered skinning
model is saved or included in the ZIP. This follow-on text-only experiment lives
in Git alongside the archive manifest. Run its recipe in a sibling
`Character-Skinning-Review-20260918` directory with the exact v16 input restored.
