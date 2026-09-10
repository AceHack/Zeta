# Character evolution: compose local detail instead of only adding triangles

Date: 2026-09-09
Operational status: research-grade
Author: Vera, OpenAI Codex
Scope: another AceHack/Xenaa Blender revision and retained comparative experiments

## Outcome and limits

Aaron requested another visible evolution, preservation of the work, and opening
it in Blender. This pass reconstructs heads independently, composes them with
the retained body generators, and adds editable collar joins and review cameras.
Front and three-quarter facial appearance improved in visual inspection over
the previous full-body projection study. This is an agent judgment, not user
acceptance or a numerical likeness benchmark. Garment construction, hands,
occluded surfaces, hair and materials still need work. The new meshes are
unrigged; camera motion is not character animation.

The [previous record](../2026-09-08-character-evolution/README.md) remains the
entry point for the original references, historical sources, model revisions,
licenses and three earlier immutable releases. Nothing in that history is
replaced by this revision.

## What changed

1. Two built-in image-generation calls produced explicitly frontal, isolated
   head references conditioned on the user's original artwork. The exact calls
   and input paths are retained in the
   [generation prompt record](sources/imagegen-call-records.json.txt).
   These images are derived conditioning inputs, not Blender renders. Exact
   prompts do not make a stochastic image service bit-reproducible.
2. Explicit U2Net masking and square framing feed the pinned TripoSR model.
   Separate head fields use the model's spatial capacity locally; body fields
   remain the same saved fields from the previous round.
3. Blender composes head and body meshes with recorded coordinate transforms,
   scale, neck trimming and separate collar geometry. Frontal reference colors
   blend with inferred surface colors. Later back-cloth and hair corrections
   are declared artistic hypotheses, not recovered observations of unseen views.
4. Front, three-quarter, side and back renders expose failures before selection.
   Intermediate assemblies, the rejected TripoSG candidates, source scripts,
   saved latents, measurements and final presentation remain in the archive.

This is a manually executed composition experiment. It does not implement a
new end-to-end Zeta training engine or demonstrate an automatic learning policy.
The useful architectural direction is a DAG whose nodes can contain local neural
generators, transforms, material edits and samplers. A larger hierarchy composes
those nodes; it need not collapse into one monolithic neural network.

## Controlled fixed-latent tessellation experiment

For each character, `resample.py` loads the identical saved TripoSR tensor,
keeps the extraction threshold at 25, and changes only grid resolution. The
latent file SHA256 is repeated in every receipt. Timings below are single
extraction runs after model loading, including color query but excluding loading
and GLB export. There was no separate warmup; initial kernel overhead can affect
the first run.
They are not end-to-end latency distributions or a state-of-the-art comparison.

| Character | Grid | Vertices | Faces | Extraction seconds |
| --- | ---: | ---: | ---: | ---: |
| AceHack | 128 | 8885 | 17716 | 0.728 |
| AceHack | 256 | 38138 | 76168 | 1.807 |
| AceHack | 384 | 87598 | 175044 | 6.030 |
| Xenaa | 128 | 8847 | 17640 | 0.213 |
| Xenaa | 256 | 37517 | 74916 | 1.657 |
| Xenaa | 384 | 85740 | 171312 | 5.489 |

All six meshes had finite vertices and all six were non-watertight. More samples
produced more triangles, not a demonstrated improvement in identity or closed
surface topology. Raw area, signed-volume and Euler diagnostics are retained;
signed volume of these open surfaces must not be read as valid physical volume.
Increasing grid size is not evidence that missing geometry has been learned.

## Head candidate comparison and precision falsifier

The TripoSR head extractions produced 304680 faces for AceHack and 410272 for
Xenaa, about six seconds each after preprocessing/model loading. The important
change is localization of the generator's capacity, not those face counts alone.

TripoSG was also tried with the same new conditioning images, 50 denoising steps
and a dense 256-cubed extraction grid. It produced broken and striped surfaces,
especially around AceHack's glasses and face. We retained the final latent and
re-decoded that exact latent with float32 VAE weights/queries instead of float16.
The upstream extraction helper still casts grid logits to float16. The change
therefore tests decoder precision only; it does not test fully float32 inference
or establish CUDA/MPS numerical parity.

| Candidate | AceHack connected components | Xenaa connected components |
| --- | ---: | ---: |
| TripoSR heads | 4 | 23 |
| TripoSG float16 decoder | 400 | 979 |
| Same TripoSG latent, float32 decoder | 1196 | 986 |

AceHack's visible failure persisted. Xenaa's float32 result was reported
watertight by Trimesh but contained 986 connected components, illustrating why
that flag alone cannot stand in for a usable character surface. These candidates
were rejected for this delivery. The experiment does not prove that precision
can never matter; it rejects this particular proposed repair as sufficient.

Color transfer from TripoSR to TripoSG used axiswise bounding-box alignment and
four nearest surface vertices. That was a heuristic to inspect candidates, not
a validated correspondence map or recovered PBR material atlas. Its distances,
source meshes and rendered failures are retained.

## Local entry points and reproduction

The local lab is `/Users/acehack/Documents/Blender/Character-Evolution-20260909`.
The selected scene is under `delivery-v5/`; the earlier `delivery/` and
`composed-v1/` through `composed-v5/` directories document the actual revision
sequence. Open the dated `.blend` file for authoritative packed images, shaders,
editable objects and cameras. Do not assume raw reconstruction GLBs reproduce
those custom Blender materials.

The archived `generator-dag.json` records the manual node dependencies and input
hashes. Its parent ordering and unique IDs were checked; it is not a production
DAG interpreter.

The new scripts reuse the pinned environments and upstream checkouts in the
adjacent `Character-Learning-Lab` directory. They are research source snapshots
with recorded local paths, not promoted portable production commands. Run:

- `resample.py` with the TripoSR environment for frozen body-field sampling.
- `reconstruct_heads.py` with that environment for the new head fields.
- `reconstruct_heads_sg.py` and `decode_heads_float32.py` with the separate
  TripoSG environment for the rejected comparison and precision experiment.
- `compose_v5.py` and `finalize_scene_v5.py` with Blender 5.2.1 for the selected
  assembly and presentation, then `pack_scene.py` to retain the turntable scene
  on save. Earlier numbered scripts preserve their failures.

Model weights are external dependencies, not bundled again or relicensed.
Existing MIT model/code provenance and the explicit U2Net choice carry forward
from the previous record; rights in the user's reference artwork remain separate.
No Hunyuan model inference or restricted intermediate mask output is used here.
No predictive-learning holdout was opened during this work.

## Preservation and next investment

The new immutable release is
[character composition evolution](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-composition-20260909).
The indexed manifest and source snapshots are Git-native. Blender scenes, renders,
video and other large files are checksum-bound release assets, not Git blobs.
Use the previous record's `restore_archives.py` with this directory's
`inventory.json` as the optional third argument to validate and restore into a
new output directory. The exact archive verification receipt accompanies the
manifest.

The next investment should be multiview-constrained garment/head correspondence,
coherent hair surfaces and material baking, followed by rigging. This round
supports spending capacity on local facial detail before blindly increasing
full-body tessellation. It does not establish a general quality optimum.

## Verification and review findings

- All 354 archived files passed SHA256 verification and a full restore into a
  fresh directory. The immutable release API reports matching archive and
  manifest digests. The archive is 938930578 bytes; its manifest records exact
  per-file lengths and hashes.
- The saved Blender file was reopened headlessly: six character mesh parts,
  finite vertex coordinates, four packed reference textures, four cameras and
  both review scenes passed inspection. An unused-scene retention failure was
  corrected with a fake-user flag; the original failure log remains preserved.
- The rendered orbit contains 96 frames at 1280 by 1068 and 12 fps: eight seconds.
  The actual Blender application was opened on the selected file and its visible
  character view was checked. Editing overlays were hidden in that session.
- Full local preflight passed available lints and the release build. Its test
  stage had one Java 21.0.1 SIGBUS crash in the BftConsensus TLC check; the other executed
  tests passed. The isolated failed check then passed using the already-installed
  Homebrew OpenJDK 21.0.11 first on PATH. This is a targeted recovery, not a claim
  that the original full-preflight invocation was green. Receipts retain both.

Review conclusions: visual improvement is provisional; front projection is not
material recovery; watertightness alone is not usable topology; decoder precision
was tested on fixed latents without proving platform parity; the DAG is an
execution record rather than a new runtime; release binaries and Git-native
source/index records have distinct durability properties. No accepted-likeness,
rigging, physics-equivalence or state-of-the-art claim is made.

CI subsequently found an import-group formatting error in a newly landed
`test_durable_room_finite_result_receipt.py` while testing the merge with newer
main. After refreshing main, the missing separator was added. Ruff 0.16.5
checking and format checking passed for all 40 files in `src/Core.Python`.
Reproduce from that project directory: running Ruff from the repository root
changes first-party import discovery. The existing uv executable was found at
`/Users/acehack/.local/bin/uv`; it was absent from the initial preflight PATH.
