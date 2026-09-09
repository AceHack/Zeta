# TikTok character v14: garment separation and explicit motion tests

Date: 2026-09-09
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

## User correction and scope

Aaron accepted the direction of the neck correction, but reported hair remaining
on Xenaa's outfit, grey shapes beneath moving arms, reduced render quality,
missing leg motion and a need to test facial expressions. He also requested
roughly two asset versions for rollback. This record supersedes the earlier
requirement to duplicate every experimental asset revision in each new release.

The v14 delivery bundled one current candidate plus one previous candidate.
This is superseded by the [character asset storage policy](../../CHARACTER-ASSET-STORAGE.md):
each future release contains only its own version, with rollback supplied by
previous releases.
Existing immutable releases retain historical provenance; new deliveries do not
repeat every older binary. Source code, measurements, failure explanations and
source-art provenance remain indexed. V14 is a review candidate, not user approval.

## Changes and causes

- The v13 mesh cutter filled every boundary, including unrelated large openings.
  V14 removes that automatic operation and uses bounded garment reconstruction.
  Narrowing the arm cut was tested and rejected: it retained phantom sleeves.
  The selected repair uses bounded, inset lining on individual garment loops
  with at least 12 edges. Inset distance scales with the loop diameter.
  The motion checks passed the rejected sleeve experiment too; visual review
  was essential. Some angular reconstructed coat edges remain in close-up.
- Arm shaders previously mixed textures using the deformed world-space normal.
  Neutral texture baking removes that motion-dependent colour change. Review
  textures come from the higher-detail source at 2048 square; mobile textures
  are separately prepared at 1024 square. Skinning itself does not require
  reducing render quality.
- Xenaa's recovered body-hair clumps and the remaining upper reconstructed stump
  are removed. A fitted jacket back replaces them. The separate scalp/curtain
  and swept lock remain Head-bound; the side/back collar seats around the neck.
- The actual trouser/boot surfaces have separate thigh, shin and foot weights.
  Joint depth is fitted to the leg surfaces. The coat remains an independent,
  pelvis-bound garment; this is not simulated cloth or a collision-free dance rig.
- Each hand adds 15 finger joints, giving 50 bones per character. Mobile export
  combines the five digit meshes per hand to reduce object/draw overhead.
- The inherited mouth landmarks were incorrect. The corrected front seam sits
  at z=1.692 m for AceHack and z=1.612 m for Xenaa. It has independently moving
  lower-lip vertices, a recessed cavity, separate rounded teeth and a tongue.
  Eleven prototype expression channels are authored and start explicitly at zero.
  Blender's shape-key creation defaults exposed an additional bug: omitted
  neutral initialization left newly created channels active.
- A packed-image copy initially exported the original 2048 pixels despite the
  intended resize. The binary GLB audit caught it. Fresh generated image buffers
  now produce verified 1024 images; the filename is not used as evidence of size.

## Tests and their limits

[Blender deformation tests](motion-validation-v14.json) cover 24 character/pose
cases: independent arms, elbows, head yaw/nod, legs/knees, ankles, index-only
movement and finger curl. They evaluate mesh vertices, not only bone names.
Opposite limbs and the independent garment remain fixed in their relevant tests;
hair follows the Head transform within 1e-5 m. All weights are normalized with
at most four influences. Initial expression values are zero, all 22 character/
channel cases move vertices, and the central mouth seam opens by over 14 mm.

These are synthetic controls, not camera-driven tracking. Numerical attachment
checks do not prove a welded neck, accurate anatomy, a collision-free rig,
photorealistic likeness or anatomical facial performance. Shared glasses/eyelid
geometry, hair transitions, shoulder surfaces and inferred rear anatomy remain
limitations. Future improvements should be judged in close-ups and moving views.

The [binary export audit](mobile-validation-v14.json) checks accessors, indices,
nonzero morphs, neutral default weights, skin influences and embedded image bytes.
It is a structural subset audit, not full Khronos certification. Body exports
bake a true T-pose into the rest skeleton and geometry; review scenes retain a
relaxed standing pose. The face assets have a separate anchor convention. Eight GLB re-import pose
cases also pass: neutral, left arm, head turn and left leg for both characters.
Anatomical left is positive X; lowering that arm from T-pose lowers its hand
without moving the opposite hand. [Round-trip receipt](roundtrip-validation-v14.json).

| Asset | Bytes | Triangles | Rig |
| --- | ---: | ---: | --- |
| AceHack body | 3,476,988 | 52,626 | 50 joints |
| Xenaa body | 3,388,664 | 58,399 | 50 joints |
| AceHack face | 1,076,136 | 18,166 | 11 morph channels |
| Xenaa face | 1,120,376 | 25,871 | 11 morph channels |

Xenaa originally exceeded the importer's recommended 30,000 triangles. Removing
Solidify thickness on static mobile hair reduced it below that recommendation;
the expression mesh did not change. These are candidate GLB sizes, not measured
combined body/face/hand effect-package sizes.

## Finger tracking: verified capability, separate integration work

Effect House's official [3D Hand Tracker](https://effecthouse.tiktok.com/learn/guides/workspace/components/ar-capability/3d-hand-tracker)
supports individual finger joint bindings. Its [3D Hand Info node](https://effecthouse.tiktok.com/learn/guides/editor-panels/visual-scripting/nodes/hand/3d-hand-info)
provides arrays of joint positions and rotations. A body skeleton with finger
bones is not sufficient to enable this: the hand joints must be mapped and the
hand coordinate frame reconciled with Body Avatar Drive. That combined runtime
integration must be tested separately, along with performance when detection runs.

## Reproducible generator composition

The stages are higher-detail source selection, bounded mesh segmentation,
neutral texture baking, skeletal binding, mouth topology and expression deltas,
small geometry finishing, pose evaluation, mobile export and format-boundary tests.
The executed source snapshots are under [sources](sources/). The input
`rebuild-v3/Joined-Characters.blend` and source-art provenance are in the
[previous release record](../2026-09-09-tiktok-character-seams/README.md).

This is a concrete composable generator pipeline and a resource/quality experiment.
It is not evidence of a new Clifford implementation or state-of-the-art learning.
Budget compliance and deformation correctness are separate from visual quality.
The next investment should follow the visible defects and runtime measurements.

## Delivery and runtime review

The [selected delivery](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-tiktok-character-v14-20260909)
contains `current/` v14 and `previous/` v13, their GLBs and review videos,
the current editable Blender scenes, two face-effect projects, source stages and
receipts. Working frame caches, Effect House Library/Record caches and historical
intermediate binaries are excluded. Existing local working folders were not
purged; the two-version policy applies to the selected delivery.
[File manifest](artifact-manifest.json), [archive verification](archive-verification.json)
and [portable Blender check](portable-delivery.json) identify the exact files.

[Effect House 5.14.0 review](effect-house-v14-review.json), executed on this machine:

| Saved face project | Package display | FPS | Memory | Test result |
| --- | ---: | ---: | ---: | --- |
| AceHack v14 | 1.9 MB | 16.55 | 50.45 MB | Passed |
| Xenaa v14 | 2.0 MB | 16.55 | 50.35 MB | Passed |

Both use the supplied `Mouth Open (Person 1)` preview and native Face Avatar Drive.
Xenaa's open mouth and AceHack's changing expression were visually observed.
Replacing the GLB broke the Deformation reference in both projects; each was
reconnected to the new head and saved through the File menu. The graph receipts
record the new component GUIDs. These tests are not live-camera/phone measurements
or a validation of all 52 ARKit channels. Only the authored 11-channel subset is
present. Import success and a Passed performance result do not prove likeness.

The full local Zeta preflight passed all 17 executed checks including release
build and tests. Go lint was unavailable locally. The final quick gate passed
all 15 available checks. CI results belong to the landing PR.

## Re-entry and regeneration

Run from the asset workspace, with the previous release's
`rebuild-v3/Joined-Characters.blend` restored and the two source images under the
sibling `Character-Learning-Lab/references` directory. Copy the source snapshots
back to their `.py` names. Blender 5.2.1 LTS was used.

1. Run `rebuild_blender_v14.py` (it executes `finish_v14.py`).
2. Run `add_fingers_v14.py`, then `polish_v14.py`, then `close_slits_v14.py` once.
3. Run `validate_v14.py`, then `sequence_v14.py`.
4. Run `export_mobile_v14.py`, the Pillow-based `audit_mobile_v14.py`, and
   `roundtrip_v14.py` using Blender for the last stage.
5. Render with `render_sequence_v14.py`. Its `V14_START_FRAME` and
   `V14_END_FRAME` environment variables permit bounded chunks (end exclusive,
   step 2). The selected review has 177 images, source frames 1 through 353,
   encoded at 12 FPS into a 14.75-second H.264 video.

Use Blender's `--python-exit-code 1`: without it a Python failure can still
produce process exit zero. The lining source override `V14_CLOSE_SOURCE` was
used to revise the repair from a verified pre-lining backup; it is not needed
in a fresh sequential run. Do not run finishing stages repeatedly against an
already finished file: begin from the input stage. Do not use the abandoned
`make_v14_source.py` drafting helper; it overwrites final source refinements.

The source pipeline has fixed seeds where applicable, but byte-identical Blender
outputs have not been established. Exact selected output bytes are hash-indexed.

## Reviewer findings and next investment

This is a self-review, not an independent reviewer endorsement.

- Selected frame 17 removes the large grey filler/phantom sleeve failure, while
  frame 321 still exposes angular coat reconstruction. Bounded lining is not
  a watertightness certificate.
- Frame 81 demonstrates an actual leg and knee bend. The rigid coat does not
  track the shin, but cloth collision and extreme poses remain untested.
- Frame 269 demonstrates an open mouth with interior geometry. The synthetic
  teeth and facial motion still look artificial; facial topology, lip fit and
  eyelid/glasses separation deserve work before authoring all 52 channels.
- Hair follows head motion, but the inferred curtain and swept lock look like
  coarse ribbons. Replacing those with fitted textured hair cards is a higher
  visual priority than adding more strands to the present surface.
- Neck attachment uses overlapping meshes. The visible skin band, scalp seam,
  collar transitions and source shoulder noise require further fitting.
- Body-plus-face-plus-hand tracking remains an integration experiment. First
  verify one arm, leg and digit at a time after mapping the 50-joint T-pose rig;
  then measure the combined effect on the intended device. Do not infer that
  the face-only performance results apply to it.

Selected evidence frames are inside `TikTok-Characters/evidence/` in the
[release ZIP](https://github.com/Lucent-Financial-Group/Zeta/releases/download/research-tiktok-character-v14-20260909/tiktok-characters-v14-current-and-previous.zip):
`frame-0001.png` neutral, `frame-0017.png` arm, `frame-0081.png` leg,
`frame-0145.png` head, `frame-0221.png` AceHack mouth, `frame-0269.png` Xenaa
mouth, and `frame-0321.png` index finger. The raw PNGs were removed from the
current Git tree at Aaron's request. The historical commit remains unchanged.
