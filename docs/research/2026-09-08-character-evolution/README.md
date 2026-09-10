# Character evolution: generators, references and measured fidelity

Date: 2026-09-08
Operational status: research-grade
Author: Vera, OpenAI Codex
Scope: AceHack and Xenaa character assets, preservation and generator research

## What this record preserves

Aaron asked for detailed Blender assets matching three supplied character images
and two videos. He rejected the initial procedural models as "terribly cheesy"
and the anatomy-based revision as "still are kinda bad compared to pictures".
These are direct negative evaluations, not numerical scores or acceptance.
He then requested that the evolution be saved because geometry and images stored
as code/generators, refined through tessellation, are part of Zeta's long-term
Clifford research direction. No successful likeness claim follows from file
validity, a working skeleton or a rotor identity.

The [inventory](inventory.json) identifies every surviving regular file in both
previous art folders and the five original references: 3,499 files. Earlier
versions that were overwritten before this capture cannot be reconstructed from
that inventory. The archive retains failed attempts and all surviving versions;
it does not invent a complete chronological history from filenames.

## Evolution and current verdicts

| Stage | Method and retained evidence | Verdict / uncertainty |
| --- | --- | --- |
| A: procedural atelier | Primitive anatomy, scripted clothing, rigid component rig, Cl3 turntable samples, multiple generator revisions and renders | User rejected likeness. This is a useful reproducible generator baseline, not a high-quality finished character. |
| B: anatomy revision | MakeHuman/MPFB base, procedural costume and hair, rigged GLBs, portrait and import/export validation | User still rejected likeness. The generic face, hair silhouette and costume construction remain inadequate. |
| C: derived references | Built-in image generation conditioned on the user's originals, isolated full-body views | 2D conditioning inputs only. An opaque checkerboard in the first Xenaa input was detected and a white-background correction requested. These are not 3D renders or evidence of mesh quality. |
| D: local reconstruction | TripoSR on Apple MPS with CPU marching cubes; white-background baseline and masked reruns | First baseline failed: background became a slab. U2Net foreground masking and square framing produced new meshes; visual review remains in progress. No user acceptance. |

The historical source snapshots under `historical-sources/` preserve original
bytes as `.txt` research records. Remove that final suffix to obtain the original
source filename; runnable copies with their original paths are also in the
archives. They include historical hardcoded paths and failed scripts. They are
provenance, not newly promoted production tools.

## Storage and recovery

Large Blender scenes, videos and exports are stored as assets of the dedicated
[character evolution research release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-evolution-20260908).
The inventory, source snapshots, this index and restore instructions belong in
canonical git history. Release binaries are host-durable and checksum-bound to
that history; they are not Git blobs and do not have Git's object-retention
properties. Keep both local archives and remote release assets. No expiring
GitHub Actions artifact is the preservation surface.

Use `gh release download research-character-evolution-20260908` with repository
`Lucent-Financial-Group/Zeta` into a new empty directory. Validate each archive's
SHA256 against `inventory.json`, then validate every decompressed file against
its path, byte length and SHA256 in that same manifest before using it. The
[restore tool](restore_archives.py) performs those checks and refuses an existing
output directory. It rejects absolute paths, traversal and symlinks.

Excluded from the snapshot: nested `.git` metadata, `__pycache__` and `.DS_Store`.
No art scene, source, render, failed build log or surviving review export was
excluded. Model weights for new reconstruction runs are external dependencies,
identified separately by upstream commit and file hash; they are not silently
added to the art archive or relicensed as Zeta code.

## Existing Zeta substrate: exact scope

- [`BoundaryLight.fs`](../../../src/Core/BoundaryLight.fs) stores curves, seeded
  scatter, symmetry and Gaussian distance-field glow, then samples a grid. Its
  progressive path leaves unsampled cells `Unknown`; it also generates 2D curves
  by complex multiplication. This is elementary generator-based imagery already
  represented in code. Its distance calculation uses floating point despite an
  older comment calling it integer/exact; this record does not adopt that claim.
- [`MediaLines.fs`](../../../src/Core/MediaLines.fs) is the declarative media
  substrate used by the shape cartridges.
- [`ShapeAcceptance.fs`](../../../src/Core/ShapeAcceptance.fs) invokes selected
  known-answer geometry laws and distinguishes bytes, geometry, meaning and
  honest labels. It does not score face identity or aesthetic quality.
- [`Cl3.fs`](../../../src/Core/Cl3.fs) provides the geometric algebra used by the
  earlier turntable receipt. The retained receipt reports 145 rotation samples
  with maximum F# error about 2.22e-16 and 290 Blender conversions with maximum
  error about 2.24e-7 under a 1e-6 tolerance. These are historical run receipts,
  not fresh reruns here, and establish a rigid rotation bridge only.

The connection is substantive: preserve a generator, parameters, composition
and sampling choices rather than only a final mesh or pixel array. Refining
sampling resolution cannot recover identity or garment structure absent from
the generator. Richer models must be earned by reference comparisons and measured
cost, not by interpreting a finer tessellation as learning.

## The new talk and the distinction it sharpens

Aaron supplied a Two Minute Papers transcript describing code-written ray
tracing and a honey-coiling simulation. The
[IP-questionable record](../../ip-questionable/2026-09-08-two-minute-papers-astra-code-generated-graphics-transcript.md)
retains the exact attachment, timestamps and all 16 supplied source destinations.
A scene can have geometry represented by code without using external mesh files;
"no geometry files" does not mean no mathematical geometry or representation.
Nothing inspected establishes that the demonstrated renderer uses Clifford
algebra or Zeta's composition model.

The named paper is Larionov, Batty and Bridson (2017),
[*Variational Stokes*](https://doi.org/10.1145/3072959.3073628). Its coupled
pressure/viscosity formulation is a numerical-method reference. A recreation
would require the equations, boundary treatment, residuals, conservation checks
and refinement behavior to match the claimed method. Visual rope coiling alone
is insufficient. No honey solver has been implemented or validated in this work.

## Proposed learning contract

Represent an evolving asset as a versioned DAG of typed generators and edits.
Each node records parent hashes, source references, code/model revision,
parameters, seed where effective, declared units/coordinate system, elapsed time,
memory budget, renderer settings and output hashes. Record rejected versions
and explicit feedback with the same care as accepted versions. NN modules can
occupy nodes; the composable DAG remains the higher-level architecture. This
manual sequence is a candidate dataset for that system, not evidence that an
online learner is already updating itself.

Keep three records separate: an asset's geometric/material state; a belief over
unresolved details (especially hidden backs and occluded anatomy); and the
resource budget for the next observation or refinement. Entropy of a belief is
not mesh complexity, and geometric rotations do not supply a learning update
rule. A future experiment should name the update rule and test calibration.

Evaluate candidates using fixed cameras and neutral lighting, then a held-out
turntable. Record likeness judgments for face, hair, silhouette, costume and
materials separately from finite geometry, export validity and animation tests.
Reference poses are not registered 3D ground truth: do not invent Chamfer errors
from a single image or report a CLIP score as identity acceptance. Back views
remain inferred until the user supplies or approves them.

A useful next comparison is a fixed-time/budget curve for procedural generation,
anatomy templates and permissive image-conditioned reconstruction. Spend on
anatomy/identity refinement if those fail, texture/UV work if shape passes but
appearance fails, and rigging only after neutral-pose fidelity is adequate.
This small reference study does not establish state-of-the-art superiority.
For broader claims, preregister datasets, resource accounting, held-out tasks,
ablations and uncertainty before measuring. Keep research holdouts from the
separate predictive-learning work unopened during this art task.

## Retraction and licenses

Preserve references as user-supplied material, not automatically CC0. MPFB code
is GPLv3; its supplied core character assets are recorded as CC0 in the retained
provenance. TripoSR's code and pretrained model are MIT according to its
[official repository](https://github.com/VAST-AI-Research/TripoSR); keep its notice
with any distributed implementation. Do not imply that an upstream model's
license determines ownership of the user's character references. The Hunyuan
candidate was not used for model outputs; its build remains local provenance.
Undo project changes with a revert. Remove or replace a release asset explicitly,
then update the manifest; never silently replace bytes under an existing hash.

## Validation and review receipt

The historical archives were streamed through SHA256 and every decompressed
member was checked against the manifest. A separate extraction restored all
3,499 files to a new directory. Remote release API digests and byte lengths
matched all three archive hashes and the manifest hash. The restore tool also
rejected a corrupt archive and a traversal fixture before creating output.
The new IP-questionable transcript segment was recovered byte-for-byte against
the supplied attachment.

Review findings: keep generator-law validity separate from likeness; avoid
claiming overwritten history was recovered; distinguish release storage from
Git blobs; preserve negative feedback; and do not reuse restricted model outputs
as unconstrained training examples. The preliminary unmasked reconstruction
revealed an actual preprocessing failure, which is retained as evidence rather
than hidden by a better-looking reference image. Runtime and visual receipts
for the next candidate are recorded separately from the historical inventory.

## Reconstruction and projection checkpoint

The [second immutable release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-reconstruction-20260908)
adds 112 files covering derived references, reconstructed meshes, Blender scenes,
actual renders, scripts, patches and failed trials. Its
[separate inventory](reconstruction-inventory.json) was verified against the
remote release digest, and all 112 members were restored and checked. Pass that
inventory as the optional third argument to `restore_archives.py` to restore
this release. GitHub's immutable-release setting prevents appending assets to
the older release, so later stages use new releases rather than replacing bytes.

The explicit U2Net/TripoSR runs yielded 38,138 vertices / 76,168 faces for AceHack
and 37,517 / 74,916 for Xenaa at extraction resolution 256. Recorded inference
plus extraction/export times were approximately 4.60 and 4.00 seconds after
loading and preprocessing; these are single warm runs, not end-to-end latency
or benchmark distributions. The mesh is unrigged and uses predicted vertex
colors. World-frame conversion and actual four-camera Blender renders exposed
orientation mistakes before final review.

The second front-projection study restores recognizable reference detail but
stretches at 30 degrees, leaves gray boundary artifacts, and does not recover
unseen facial structure or separate garment layers. Emission-based material
presentation reduces relighting distortion; it is not physically based material
recovery. It remains a projection study, not a finished 360-degree character.
The next investment is stronger shape/multiview reconstruction, before rigging
or more ornamental detail.

One intermediate run used the newer rembg package's default BRIA mask model.
That intermediate is retained as quarantined provenance and is not eligible
for unrestricted training. The subsequent runs explicitly select U2Net; never
assume a library's default model or output terms stay unchanged. Hunyuan model
inference was never run. The TripoSG investigation uses a separate environment
and will receive its own source and output record.

The first full preflight passed its test stage but its build stage hit a
transient F# compiler exit 134 in CrmSample. Both subsequent release builds
passed with zero warnings/errors, including the standard restore-enabled
command. An additional test invocation omitted Bun from PATH and failed two
TLC process fixtures for that explicit environment reason; it does not retract
the earlier full-preflight test pass. All 70 TLC runner fixtures then passed with the
configured PATH. The retained logs distinguish these invocations.

## Stronger shape study: TripoSG

The [third immutable release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-character-triposg-20260908)
contains the TripoSG source patches, pinned model metadata, derived square inputs,
meshes, Blender scenes and actual renders; its
[inventory](triposg-inventory.json) uses the same restore/verification format.
The upstream source is `fc5c40990181e2a756c4e0b1c2f4d6b5202faf8c`; model revision
is `2c1c516d22d58db486a058d98d31bb6177344e06`. The public weights were downloaded
at that exact revision and checked against their published hashes. They are
external dependencies, not included in the archive. The separate Python
3.11 environment and dependency versions are retained in the source snapshot.

The first raw portrait pass revealed a preprocessing issue: the model's feature
extractor center-crops after resizing the shorter image edge. The corrected
pass uses an explicit U2Net alpha mask, 80-percent foreground square framing,
50 denoising steps and a dense 256-cubed SDF sampling grid. The local MPS port
uses the non-flash decoder and CPU scikit-image marching cubes, avoiding the
CUDA-only `diso` dependency. It is an experimental port, not a certified
numerical parity result against CUDA.

| Character | Vertices | Faces | Inference + extraction/export seconds |
| --- | ---: | ---: | ---: |
| Xenaa | 117661 | 233302 | 70.94 |
| AceHack | 118118 | 236144 | 70.19 |

These single-run times exclude model loading and preprocessing. Frame, sampling
resolution and step count changed together relative to the initial pass, so the
comparison cannot isolate a tessellation benefit. Visual review found a more
coherent body/coat scaffold but poor hair topology, incomplete facial depth and
unacceptable texture stretching away from the front view. The projection shader
is a study aid; it does not yield recovered PBR materials or an accepted rig.
No method here has passed the user's requested likeness standard.

The useful generator connection is now concrete at another scale: fixed model
weights and a latent shape field can be sampled to obtain a mesh. That is a
learned SDF generator alongside Zeta's elementary curve/glow generators; it is
not evidence that TripoSG uses Clifford algebra or that increasing tessellation
alone learns missing geometry. The next controlled experiment should persist
one latent field and sample that identical field at multiple resolutions, with
fixed references/cameras and explicit compute accounting. A separate multiview
fit must address face, hair and occluded surfaces. Keep NN modules composable
inside the higher-level DAG rather than defining the whole system as one NN.

## Re-entry and reproducibility

Start with the three inventories and their immutable release tags. Original art
folders remain untouched; the new local lab is
`/Users/acehack/Documents/Blender/Character-Learning-Lab`. The three exact visible
image-generation calls are saved in [imagegen-call-records.json](imagegen-call-records.json).
The first Xenaa input's checkerboard was opaque RGB, not transparency; that
failed input and its white-background replacement both remain available.
Generated references are conditioned on the user's artwork and must never be
presented as actual Blender renders.

Current review surfaces are `reconstruction-projected-v2/` for the TripoSR
projection study and `reconstruction-sg-framed/` plus `reconstruction-sg-projected/`
for the stronger shape study. Open the `.blend` files for the authoritative
shader setup; do not assume the raw GLBs contain the projection materials.
The earlier anatomy revision remains the rigged reference artifact. None of
these new reconstruction studies is rigged or accepted for final delivery.

Next work: persist and resample an identical latent field for a controlled
resolution/cost comparison; obtain or generate clearly labeled multiview
conditioning; fit facial geometry and hair against those views; bake a
consistent material atlas; then revisit rigging. Retain each failure and each
resource receipt. Continue the separate learning handoff independently: no
predictive-learning holdouts were opened in this art work.
