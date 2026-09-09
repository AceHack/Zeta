# TikTok character v15: restore the detailed source surfaces

Date: 2026-09-09
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

## Why this iteration exists

Aaron rejected the post-rigging appearance and identified better earlier models.
The v14 motion and importer tests passed, but replacing reconstructed arms with
radial tubes, reducing surfaces and rebuilding hair lost visible detail. Those
tests were insufficient acceptance criteria. V15 returns to the v5 pre-rig body
and head surfaces while retaining the tested skeleton layout as an input.

This is a high-detail Blender quality study, not a replacement TikTok package.
The [v14 runtime record](../2026-09-09-tiktok-character-v14/README.md) remains the
last measured Effect House candidate. Its measurements do not transfer to v15.
The study has no facial morph channels or weighted individual fingers yet;
50 bones in the imported skeleton must not be presented as 50 working controls.

## Source-preserving changes

- Apply the original source smoothing without decimating or globally rebaking.
  Preserve every original body face across the body, leg and hair partitions.
  The source UV layers remain attached to their original faces.
- Store the original projection normals/positions as mesh attributes so arm
  motion does not change which projection/material branch colours a surface.
  Lighting normals still deform. This Blender material graph requires baking
  or an equivalent implementation before mobile export.
- Recover actual sleeves and gloves. Seed arm regions at the hands and follow
  connected source surfaces below the shoulder. A bounded diffusion of weights
  joins these anchors to the torso. Skinning uses linear blending, not Blender's
  preserve-volume mode, to avoid hiding a future glTF difference.
- Separate original front trouser/boot faces from the coat where the source
  reconstruction fused them. Do not fill all boundary loops with large polygons.
  Cut boundaries and inferred rear anatomy remain limitations; this is not a
  watertight garment or a cloth simulation.
- Translate and taper the existing head/neck surface into the collar. Preserve
  source face detail. Extract a bounded shoulder-hair region, exclude skin-like
  reference pixels, and bind it to Head. Reuse the existing dark hair material
  on rear surfaces containing bright background contamination.

The source segmentation is heuristic. Exact Head-bound motion is a numerical
attachment test, not proof that every selected face is hair or that no hair
remains in the body. Side/back close-ups and the next visual review remain
necessary before claiming that defect closed.

## Experiments that changed the implementation

The initial spatial arm mask moved coat-tail vertices with the hand, producing
long spikes. Connectivity removed that leakage. A subsequent pose pass found
814-2006 body edges longer than 1 mm stretched beyond 3x their neutral length in
individual knee cases. The source leg/coat surfaces were fused, so an unrestricted
component flood reached the garment; an explicit assertion rejected that attempt.
Separating source trouser/boot faces removed those extreme knee-edge cases in the
next measured pass. Shoulder weighting still requires visual judgement; reducing
an edge-stretch count alone produced an unattractive thin shoulder transition.

A side-view pass also exposed a restored upper-back hair mass. The region was
expanded around the neck and moved onto the Head-bound source-hair object; a
bounded dark jacket back covers the opening independently. The first back panel
sat too far behind the torso and was rejected; its depth was corrected before
the selected side/head-turn evidence. Bright background contamination and the
block-like scalp silhouette still need work. The expanded mask also captured
shoulder surfaces in one trial; the selected mask excludes skin-like pixels and
points within 9 cm of an upper-arm bone. These are explicit heuristic safeguards,
not semantic segmentation ground truth. Passing the attachment calculation
does not make this a finished hair groom.

These are observed failures of this pipeline, not evidence against skeletal
animation generally. Failed trial binaries are not repeatedly archived; the
causes, source recipe and selected output are retained.

## Review and next investment

The saved Blender timeline marks neutral, left/right arm raises, left/right knee
bends, and head turns. [Pose diagnostics](pose-diagnostics.json) report actual
mesh deformation and extreme edge stretch; they do not relabel remaining
failures as passing. [Surface receipt](surface-retention.json) records source
face counts and neutral displacement. [Delivery validation](delivery-validation.json)
checks packed textures, normalized skin weights and the extracted hair transform.
Xenaa scalp-hair vertices selected by material/position are separately marked and
required to have full Head weight. The earlier height-only neck blend incorrectly
included low hair tips; only the remaining neck region now receives that blend.

The next investment order is:

1. Inspect and repair shoulders, hidden leg/coat boundaries and hair membership
   in close-up motion, using the restored source appearance as the quality floor.
2. Author mouth topology and restrained facial deformations on the accepted
   head; test eyelids, lips, teeth and combined channels before export. The v14
   expression prototype remains a reference, not automatically accepted anatomy.
3. Retopologize fused finger surfaces where needed, then fit influences to the
   detailed source hands; map hand, face and body
   tracking together only after independent Blender deformation tests pass.
4. Reduce a separate mobile derivative and bake its materials. Compare neutral
   and moving views against this source, then measure the actual Effect House
   package and phone runtime. Budget/import success is not appearance approval.

This is a composable geometry/material/deformation generator experiment. It
provides concrete failure observations for the broader Clifford/generator research;
it does not establish a new Clifford algorithm or state-of-the-art learning result.

The selected pose pass still reports 3-54 edges longer than 1 mm stretched
beyond 3x in individual arm cases. All selected knee cases report zero such edges. Xenaa head turns
report 9 and 12 such edges at the neck/scalp transition after freeing the hair
from the neck blend. These are explicit remaining shoulder/neck-quality findings, not a clean
deformation certificate. The extracted hair follows Head within 4.22e-8 m, and
weights sum to one within 2.99e-8; these numerical checks do not settle appearance.

## Delivery

The [v15 release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-tiktok-character-quality-v15-20260909)
contains one selected editable review scene, packed textures, eight pose images,
source recipes and receipts. All full-resolution PNGs are inside the ZIP.
[Manifest](artifact-manifest.json) and [archive verification](archive-verification.json)
identify the exact files and read-back verification. The bundle contains no
previous-version assets and no duplicated neutral-only Blender scene.

## Storage, cleanup and regeneration

Follow the [character asset storage policy](../../CHARACTER-ASSET-STORAGE.md).
The seven v14 PNGs are removed by ordinary Git deletion and remain recoverable
inside the immutable v14 release ZIP. Historical Git blobs are not rewritten.
No character PNG, Blender file, GLB, video or ZIP is added to Git by this iteration.
Each new release carries only its own selected version; preceding releases provide
rollback. [Cleanup summary](cleanup-summary.json) records the archive-verified
local duplicate removal. Its complete per-file ledger is inside this release ZIP.
Unique source art, environments and reconstruction checkpoints were retained.

The input scene is `delivery-v5/AceHack-Xenaa-Evolution-20260909.blend` in the
[pre-rig composition archive](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-composition-20260909).
The skeleton input is `current/Characters-v14.blend` from the
[v14 archive](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-tiktok-character-v14-20260909).
Restore the scene under `Character-Evolution-20260909/delivery-v5/` and copy
the archived v14 `current/Characters-v14.blend` to
`TikTok-Character-Evolution-20260909/blender-v14/Characters-v14.blend`. These two
input directories and the new v15 workspace are siblings. Then run:

1. `preserve_surfaces_v15.py` with Blender 5.2.1 LTS, background mode,
   `--python-exit-code 1` and six threads.
2. `review_poses_v15.py` with the same executable/options.
3. `validate_delivery_v15.py` with the same executable/options.
4. `profile_review_v15.py` for the neutral and head-turn side views.
5. `package_v15.py` with Python for the explicit single-version ZIP allowlist
   and read-back verification. This packaging helper uses the recorded local
   writer path for its text receipts; adjust that path in another clone.

Executed source snapshots are under [sources](sources/), with `.py.txt` suffixes;
restore `.py` names in the asset workspace. Exact selected output bytes are
hash-indexed. Byte-identical Blender regeneration has not been established.
The full local repository preflight passed all 17 available checks, including
release build and tests; Go lint was unavailable locally. This is a self-review,
not an independent reviewer endorsement.
