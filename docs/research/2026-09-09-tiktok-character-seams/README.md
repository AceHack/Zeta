# TikTok character iteration: neck joins, mobile budgets and failed body rigs

Date: 2026-09-09
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)
Scope: AceHack/Xenaa Blender evolution and separate Effect House face prototypes

## Outcome

The current review candidate is `blender-v13/Blender-Motion-Review-v13.blend`,
with a marked 337-frame sequence and a 14-second rendered MP4. Fourteen evaluated
character/pose cases pass the bounded attachment checks below. Isolated side
views show the forward-corrected neck seated within the torso; head and body
remain overlapping meshes. This is an upper-body motion prototype, not a
finished full-body TikTok avatar. The [final self-review](sources/final_review_v13.json.txt)
records both the improvements and visible failures.

Aaron rejected the attachment again after the first pass: the heads still looked
disconnected, an arm-rig attempt twisted the model, and some of Xenaa's hair
remained attached to her outfit. This supersedes the agent's earlier judgment
that neutral views showed sufficient improvement. The v3 joins and v1-v5 body
rigs are failed iterations, retained for comparison. A Blender-first correction
and motion review produced v13; the prior face budget results below retain only
their stated scope. No corrected full-body rig has passed an Effect House test.

Two separate face-avatar projects import into Effect House 5.14.0, follow its
preview person's head and connect the head's 11 morph channels to native Face
Avatar Drive. Both passed the app's built-in performance test. These are usable
import/tracking starting points, not finished facial performances or approved
TikTok effects. No effect was submitted and no actual-phone test was performed.

| Face project | App package display | App test FPS | App test memory | Result |
| --- | ---: | ---: | ---: | --- |
| AceHack-Face-v1 | 1.7 MB / 8 MB | 16.55 / minimum 13.5 | 50.31 MB / 200 MB | Passed |
| Xenaa-Face-v1 | 1.9 MB / 8 MB | 16.55 / minimum 13.5 | 50.53 MB / 200 MB | Passed |

The app displayed test times 04:51 and 04:59 on September 9. These are observed
Effect House results, not independently instrumented phone benchmarks. Package
sizes are rounded app readings. The exact GLB sizes below are different quantities.
The [UI receipt](sources/effect-house-ui-receipt.json.txt) records observations,
editor failures and limitations; it is not a fabricated screenshot receipt.

## What to open

The correction snapshot is indexed by [inventory-blender-v13.json](inventory-blender-v13.json);
[inventory.json](inventory.json) retains the first-pass snapshot. Both are in the
[release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-tiktok-character-seams-20260909).
The local workspace is
`/Users/acehack/Documents/Blender/TikTok-Character-Evolution-20260909`.

- `blender-v13/Blender-Motion-Review-v13.blend` and its MP4: current upper-body
  review candidate, with named pose markers and known visual limitations.
- `mobile-export-v13/`: new body/face candidates, structurally audited but not
  yet tested in Effect House. The 11 facial channels are transferred prototypes.
- `AceHack-Face-v1/effect.ehproj` and `Xenaa-Face-v1/effect.ehproj`: separate
  face effects, with built-in Mouth Open preview selected and native graph wiring.
- `face-assets-v1/`: independent compact face GLBs, including Xenaa's hair.
- `rebuild-v3/Joined-Characters.blend`: rejected high-detail attachment reference.
- `mobile-v1/Mobile-Characters.blend`: baked lightweight neutral reference.
- `mobile-rig-v1/` and `AceHack-TikTok-v2/`: retained body-tracking experiments
  with known visual failures. They are not production-ready alternatives.
- `mobile-rig-v2/` through `mobile-rig-v5/`: rejected T-pose repair experiments.
  A higher revision number does not mean a better or selected model.

The archive retains the supplied screenshots, sources, intermediate scenes,
renders, logs, project files and receipts. Effect House Library caches and Record
preview caches are excluded; task source assets and graph/scene files are retained.
Model weights are not bundled again. The
[previous composition record](../2026-09-09-character-evolution/README.md) and its
parent preserve source-art, model, code and license provenance. Vendor scripts
copied by Effect House remain vendor material; this record does not relicense them.

## Measured geometry and storage

| Export | Exact GLB bytes | Triangles | Morph targets on head | Skeleton |
| --- | ---: | ---: | ---: | --- |
| AceHack face | 646720 | 7700 | 11 | None needed for face morphs |
| Xenaa face and hair | 903420 | 14140 | 11; hair has zero | None needed for face morphs |
| AceHack body experiment v1 | 1690044 | 22208 | 9; body has zero | 20 joints |
| Xenaa body experiment v1 | 2043760 | 28651 | 9; body/hair have zero | 20 joints |

The body meshes were decimated to about 14,000 triangles and the heads to about
7,700. UV seams can increase exported vertex counts; use the accessor counts in
[mobile validation](sources/mobile-validation.json.txt), not only Blender's mesh
vertex count. The exported AceHack/Xenaa heads have 7367/6539 vertices after
UV splits and still fit with this 11-channel subset; this does not imply a
full 52-channel payload has the same cost. Color-only Cycles bakes use a dedicated
1024-square UV atlas and
JPEG quality 90. The selected embedded images are each below 1,000,000 bytes.
This trades texture detail for budget and does not recover physically measured
roughness or unseen-surface appearance.

The structural audit reads dense and sparse GLB accessors, checks finite values,
index ranges, matching nonzero morph targets, embedded image dimensions/bytes,
and normalized maximum-four skin influences where present. It passed for all
four exports above. It is a stated subset audit, not full Khronos certification
or evidence that a geometrically valid rig deforms well.

## What the failed experiments taught us

The original large skeleton-rigged GLBs inspected in this workspace contained
163 joints and zero morph targets. They were 56,710,204 bytes and 138,965,848 bytes.
Those are different artifacts from the smaller raw reconstruction meshes cited
in the incoming handoff; their sizes must not be substituted for one another.

The first mobile rig placed 20 anatomical joints and used bounded distance-based
weights. Head and body share a neck weighting field. A modest 20-degree head-turn
render retained the attachment, but that is not a broad motion validation. Effect
House matched all 20 body joints and reported a 2.5 MB AceHack body-effect package.
Its Dancing preview exposed severe arm/garment distortion.

Four T-pose revisions were retained. One narrowed arm weights but left bones
behind the visible arms; the next corrected their depth. Fused arm/coat surfaces
still stretched into sheets. Deleting elongated triangles removed the sheets but
left torn clothing and holes, so that revision was rejected. This is evidence
for investing in anatomical placement and separate garment topology before more
skinning or tessellation. It is not a repaired full-body animation system.

Earlier neck revisions are also retained: one cut AceHack's chin too high and was
rejected. The selected high-detail v3 restores that cut while extending the neck.
The lower neck uses shared boundary vertices within the head mesh and an overlap
inside the separate body; the fitted collar is additional geometry.

## Facial scope and remaining defects

The 11 authored channels are jawOpen, jawLeft, jawRight, mouthSmileLeft/Right,
mouthPucker, browInnerUp, browDownLeft/Right and eyeBlinkLeft/Right. They are
localized prototype deltas, not a captured or fitted ARKit-52 performance rig.
Face-only meshes have no skeleton; their head motion comes from Face Binding.
The native graph runs Update into Face Avatar Drive with the imported head's
MorpherComponent selected. The default head occluder was disabled because it cut
into the reconstructed face.

The mouth has no interior or separated lip loops, so a jaw delta does not produce
a convincing open mouth. Blink compression can distort AceHack's glasses because
they share head geometry. Face-effect neck ends are blunt; they need a separate
crop/fade treatment from the full-body attachment. No per-channel runtime
coefficient capture or quantitative expression benchmark was performed. Valid
wiring and successful performance tests do not establish facial accuracy.

Xenaa's project retains the inherited asset folder name `AceHack-face-body` after
replacement. Its actual mesh, materials, texture, morph reference and preview
identity are Xenaa. This is naming debt, not a two-character package.

## Incoming research, corrected against primary sources

The incoming [PR 17115 handoff](https://github.com/Lucent-Financial-Group/Zeta/pull/17115)
was read at head `51cec6b9298c134ee5113099579e466f2c822ea4`. It is source context,
not automatic policy or a receipt that those assets were inspected.

- The raw dense estimate `30000 vertices * 52 targets * 3 floats * 4 bytes`
  is 18,720,000 bytes. It is a useful assumption, not a universal 4-5k-vertex
  ceiling: fewer targets, sparse data and compression change the result.
- Official [Face Avatar Drive](https://effecthouse.tiktok.com/learn/guides/editor-panels/visual-scripting/nodes/head-and-face/face-avatar-drive)
  supports a subset of the named channels. The installed native script matches
  names case-insensitively. We use canonical `browInnerUp`; spelling must agree with the runtime's channel list.
- [Technical optimization](https://effecthouse.tiktok.com/learn/guides/getting-started/technical-guidelines/technical-optimization)
  documents the 8 MB package budget and separate mesh limits. Newer
  [3D preparation](https://effecthouse.tiktok.com/learn/guides/workspace/assets/asset-preparation/3d)
  documents 100 bones and four influences; the optimization page's older 50-bone
  advice differs. Our 20-joint experiment fits either. Its recommendation of
  fewer than 20k triangles is not the same as the hard per-mesh limits.
- [Body Avatar Drive](https://effecthouse.tiktok.com/learn/guides/workspace/objects/ar-tracking/body-avatar-drive)
  describes parenting and matching the skeleton. The actual editor match and
  failed motion preview are stronger evidence than naming compliance alone.

## Connection to composable generators and next investment

This is a manually executed generator DAG: retained body field, local head field,
neck construction, hair geometry, tessellation, baking, skinning, morph authoring,
export and runtime tests. Nodes can contain neural generators, deterministic
geometry or inference/decision code. It does not require collapsing the higher
composition into a plain layered neural network. It also does not establish a
new Clifford-algebra implementation, a learning-policy benchmark or state-of-the-art
video generation.

Keep packaged bytes, runtime memory, frame time, triangle/vertex counts, morph
capacity and perceptual error as distinct resource measurements. The measured
budget success does not compensate for failed deformation. Following the user's
correction, the next investments are shoulder/arm transition topology and
hair/collar intersections; a consistent T-pose with leg/garment separation;
Effect House and phone tests of the corrected candidates; and fitted lip/eyelid
topology with a mouth interior. Keep the original art and every rejected revision
as comparison evidence. Do not use the held-out learning streams for art tuning;
none were opened in this iteration.

## Preservation and verification receipt

The first-pass ZIP is 215381762 bytes with SHA256
`4feb0e610be06ef24e75f3a0ac73486ec2f8991330f76052f8751686c182628a`.
All 279 entries were restored to a fresh directory and individually checked for
length and SHA256; see [archive verification](archive-verification.json).
The initial archive attempt used a system Python without `hashlib.file_digest`;
it was not promoted. The successful archive used the existing Python 3.11 lab
environment. The failure and retry source are retained.

Both saved Effect House projects were audited after the UI tests: the native
face component reference resolves, the Update edge is present, Face Binding is
present, and the imported GLB bytes match the selected character export exactly.
The first-pass high-detail Blender scene was reopened and checked for finite character
vertices, seven character mesh parts and packed file images. That first-pass scene was then opened
in the actual Blender app, with overlays hidden for review. The previous unsaved
Blender scene was first saved to a separate local copy at
`/Users/acehack/Documents/Blender/Preserved-UI-State-20260909.blend`.

Review findings: the budget and import claims are supported by app tests and
receipts; production facial/body quality claims would be unsupported. The rejected
T-pose meshes must remain explicitly marked rejected. The graph and neck overlap
checks are structural checks with the limitations stated above. This was an
agent self-review, not an independent review or maintainer acceptance.

## Blender-first correction after renewed user rejection

The [user correction](sources/user-review-attachment-correction.json.txt) makes
the earlier neutral-view assessment obsolete. Isolated front/side/back renders
showed a posterior head offset, old collar/head remnants in the torso, a missing
rear scalp section, and hair tied to torso weights. The first arm rig also put
its forearm and hand bones behind the reconstructed arm surfaces.

Revisions v6-v12 are preserved experiments. Flat shoulder cuts, an over-high
Xenaa chin cut, simple arm-shell separation, atlas seam transfer and sparse
hair-root coverage each produced new defects. V13 preserves the raised collar,
corrects head Y by -0.075/-0.085 m, rebuilds separate limb surfaces, and uses a
continuous scalp-to-length hair surface plus a rooted shoulder lock. The lower
neck remains torso-bound, the face is rigidly Head-bound above the cut, and all
retained/new hair pieces are Head-bound. No full-body success is claimed.

The [evaluated-vertex audit](sources/motion-validation-v13.json.txt) tests two
characters in seven poses: independent left/right 60-degree arm lifts, 60-degree
elbow bends, head yaw +30/-30 degrees, a 20-degree head nod and a 15-degree neck
bend. Across those 14 cases, neck-base displacement, opposite-arm displacement
and coat-tail displacement are zero. Maximum rigid-face error is
`2.426e-7 m`; maximum hair-follow error is `1.249e-7 m`, below the declared
`1e-5 m` numerical tolerance. These checks measure deformation consistency; they
do not prove a welded seam, collision avoidance or visual fidelity. Actual
rendered frames and the marked Blender file accompany the audit.

The original arm-label suspicion was not confirmed in Blender: anatomical Left
is positive X for a character facing -Y. Misplaced arm depth and shared
arm/garment geometry were confirmed. The new arm motions avoid the former long
coat-tail sheets, but shoulder seams and reconstructed surface noise remain.
Hair has a coarse front-cap transition and collar intersections. Legs and coat
tails remain pelvis-bound; the file is not a dance-ready full-body rig.

| New candidate | Exact bytes | Triangles | Head morph channels |
| --- | ---: | ---: | ---: |
| AceHack body | 2056168 | 28393 | 11 |
| Xenaa body | 2480060 | 42700 | 11 |
| AceHack face | 756176 | 8951 | 11 |
| Xenaa face/hair | 1237300 | 23941 | 11 |

The [new export audit](sources/mobile-validation-v13.json.txt) passes finite
accessors, index ranges, nonzero morphs, image dimensions/bytes and normalized
maximum-four weights with 20 joints where present. Heads use 1024-square bakes
and rebuilt limbs 512-square bakes. These are GLB sizes, not Effect House package
sizes. The old 11 analytic facial channels were transferred to corresponding
face vertices, with the new lower neck fixed; no mouth cavity, lip separation
or fitted facial-performance validation was added.

The Mac locked before live Blender playback/opening or another Effect House
session could proceed. CUA explicitly reported that automatic unlock failed.
The new review file therefore remains ready to open, not verified as open in the
GUI. The earlier app tests do not transfer automatically to these new exports.

The complete correction snapshot is 611001153 bytes with SHA256
`93210ec888cc73fcd8e310bcd86fa5c8c0a37b4aa93ffb6913154e2ad22f6ded`.
All 623 files were restored to a fresh directory and checked for length and
SHA256; see [correction verification](archive-verification-blender-v13.json).
The first-pass archive remains separate and unchanged. The official vendor FBX
and its download ZIP are excluded; source URL and digest are retained.

Two review-script errors are explicitly retained: v10/v11 profile cameras used
parent-local X, producing some blank front/back renders; v12/v13 use world X.
The first FBX extraction selected a macOS resource fork before the correct named
FBX was extracted. Neither failed output is counted as validation evidence.

The [official rig inspection](sources/official-rig-inspection.json.txt) records
the downloaded Effect House template's source URL, FBX digest, joint positions
and matrices. It confirms anatomical Left on positive X in its imported T-pose.
It does not establish that the current model is compatible with every retargeter.
The vendor FBX is not redistributed in the project source record.

[Full preflight](preflight-full.txt) passed all 17 locally available checks,
including release build and full tests; the Go lint tool was unavailable.
Geometry, motion and likeness still require separate visual validation.

During this PR's CI run, concurrent main introduced SC2129 in the lint-heal
report workflow. A separate fix groups adjacent summary writes under one append
redirect, preserving report text and escaping; local actionlint passed. The PR
body attribution block was also corrected after its first check rejected the
missing trailers. These are verification corrections, not avatar test results.

The [GLB reimport check](sources/roundtrip-validation-v13.json.txt) imports both
new body candidates into Blender again, retaining 20 joints and the anatomical
side labels. A 60-degree left-arm lift raises the left hand by 0.34124 m for
AceHack and 0.32688 m for Xenaa while the right hand remains fixed. Neutral,
left-arm and head-turn renders were inspected after import. This verifies the
format boundary in Blender, not Effect House retargeting. The six-file
[supplement](roundtrip-inventory-v13.json) preserves those post-snapshot checks.

Both main ZIP assets were downloaded back from the draft GitHub release and
matched their local sizes and SHA256 values; see the
[remote download receipt](remote-download-verification.json).
