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
