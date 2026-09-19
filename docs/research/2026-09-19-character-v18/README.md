# Character v18: head, hair and anatomical upper-body reconstruction

Date: 2026-09-19
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

## Direction

The user identified mixed baked/modelled hair and a persistent head/body
mismatch, authorized substantial reconstruction, and supplied additional
personal photo references. Those new photographs remain local references;
they are not embedded in this repository or the delivery archive. The supplied
character art guides the costumes. This is an active Blender master study,
not an accepted game-quality asset or an Effect House submission.

The [v16 comparison baseline](../2026-09-16-tiktok-character-v16/README.md)
and [v17 negative findings](../2026-09-18-tiktok-character-v17/README.md)
remain available. More strands or successful binding alone do not establish
better likeness or visual quality.

## Reconstruction

- Xenaa receives a continuous head/neck surface with source facial depth and
  UV transfer. The old fused bob and recovered outfit-hair objects are removed
  from the selected scene. The new scalp-distributed groom is one independent
  set of 22000 native curves, rigidly attached to Head.
- Xenaa's damaged upper torso, shoulders, arms and hands are replaced with
  locally available anatomical geometry. Rest-space transforms fit that mesh
  to the existing skeleton. Costume appearance is transferred separately from
  geometry. The detailed lower coat remains from the source.
- Anatomical finger groups map to the existing named finger bones. Rest joint
  locations and rolls come from the transformed source skeleton. Bilateral
  isolated curl poses are added after the original diagnostic timeline. A test
  caught tiny cross-hand weights in the anatomical input: the opposite hand
  moved 0.169 mm during a left curl. Side filtering and renormalization replace
  those invalid influences; the test tolerance remains unchanged.
- AceHack keeps his better existing face and short hair. The lower neck is
  cut and extended with connected rings, then weighted across torso, neck and
  head. The attempted replacement groom reduced his likeness and was rejected.
- Hidden rejected models are removed from the selected scene. The archive
  contains one selected version; previous releases remain rollback sources.

## Rejected approaches and scope limits

The v15 scalp marker includes cheek and neck vertices. It is not a semantic
hair segmentation and must not be reused as a deletion mask. The first new
head loft also produced a visible forehead ledge; adjusted smooth profiles
replace it. Dense, uniform hair and a later sparse fan-shaped guide layout
both failed visual review. Broad garment deletion cut into a shoulder.
Nearest-surface seam snapping connected unrelated triangles and was rejected
in favor of bounded cross-section fitting and continuous replacement arms.

The study does not yet provide facial blendshapes, secondary hair dynamics,
hair/body collision handling, clean tattoo unwrapping, complete garment
retopology, or mobile performance evidence. The source clothing and face still
contain projected appearance. Material transitions and likeness remain visual
acceptance work, even when structural checks pass.

## Rebuild

Use Blender 5.2.1 LTS. Copy the recipes from `sources/`, removing only the
`.txt` suffix, into one local output folder under the Blender workspace. Run
`python3 build_v18.py`; `BLENDER_BINARY` can override the macOS Blender path.
The runner executes reconstruction, tailoring, anatomical replacement, final
selection/groom, pose validation, matched baseline renders and the two skinning
comparison stages. Each stage has its own log and stops the runner on failure.
The exit-code probe in [recipe-checks.json](recipe-checks.json) verifies that a
failing first stage exits with its code and prevents later stages from running.
Authoring scripts can also run with
`blender -b --python-exit-code 1 --python SCRIPT.py`; pass
`-- --render-diagnostics` to request optional images from those stages.
The exact source inputs and hashes are in [inputs.json](inputs.json). They are
external preserved inputs, not bundled previous-version assets. The recipes
are not self-contained without them.

The anatomical input was generated earlier using MakeHuman core assets. The
project distinguishes its [CC0 core assets and source-code licenses](https://static.makehumancommunity.org/about/license.html);
the [system asset pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)
and prior local provenance record identify that source. This pass installs
no new tools and does not redistribute MPFB source code.

## Research boundary and next acceptance work

The useful connection to generator-based geometry research is an auditable
sequence of recipes, selected outputs, measured deformation and rejected
changes. This Python/Blender experiment does not execute Zeta's Clifford
implementation or establish a learning or physics result. No frozen learning
holdouts were run.

Before master promotion, inspect matched front, side, back and moving views;
clean neck/skin and garment boundaries (including the visible shading band); refine asymmetrical hair flow and
silhouette; then complete facial topology and expression tests. Make a separate
mobile derivative only after visual acceptance. Preserve failures as findings,
not as accepted defaults.

## Review findings and next iteration

The visible jaw must follow Head rigidly. A rendered turn exposed the first
loft blending the lower face into Neck despite a passing attachment transform
check. The blend now starts below the jaw, with an explicit facial-vertex
assertion. The new torso neck rings are fitted by known row/azimuth correspondence to
the head loft with a small inward overlap and matching deformation weights.
A smooth lateral falloff avoids pulling shoulder vertices into the neck.
Rigid anchors are checked on the evaluated head surfaces, not just
on a hidden proxy or the hair parent. Head and body are still separate meshes
with overlapping neck coverage; these checks do not prove a welded body seam.

The v17 rejection of blanket volume-preserving skinning concerned different
geometry. On the new anatomical upper body, the matched elbow pose has 72
linear-skinning edges compressed below one third of rest length versus 30 with
dual quaternions (rest edges longer than 1 mm). Both modes have zero edges
stretched over three times rest length in the 13 sampled poses. Close-up
renders support selecting dual quaternions on this mesh only; compression is
reduced, not eliminated. The exact comparison is in
[upper-skinning-comparison.json](upper-skinning-comparison.json).

Per-face material assignment left stair-step sleeves. The selected shader
interpolates anatomical region and rest height before choosing skin versus
garment shading. A first ColorRamp attempt clamped heights above one meter and
failed visually; explicit Map Range nodes replace it. This improves a boundary
without pretending that projected cloth has acquired sewn thickness or clean
UVs. The source tattoo projection is still stretched and blurred.

Remaining priorities, in order:

1. Rebuild the garment as separate fitted panels with actual neckline, armhole
   and cuff edges; repair AceHack's rough shoulder ornaments. Keep the current
   facial likeness while adding proper ear, jaw and neck anatomy.
2. Refine Xenaa's broad wavy locks and side part from the references. The new
   groom removes the rigid bob and outfit-attached hair, but its flow is still
   too uniform. Add hair collision and secondary motion after the silhouette
   passes front, side and back review. AceHack's retained hair remains textured
   source geometry, not a finished strand groom.
3. Re-unwrap skin and tattoo placement, reconstruct eyelids and mouth interior,
   then author and test expressions. The current eyes and mouth remain source
   appearance; no ARKit-52 support is claimed.
4. Replace the retained lower-leg and inner-coat geometry: the combined-pose
   render exposes tearing there. This is an observed failure, not a passing
   whole-body rig. Review full-body joint extremes and refine elbow/finger
   compression, then
   make a separate Effect House derivative and measure its actual package and
   runtime costs. Do not shrink this experimental master prematurely.

The current numerical result is summarized in [review-results.md](review-results.md).
Repository gate limitations are separate in [repository-checks.md](repository-checks.md).

Hashes pin the selected evidence; binary-identical Blender rebuilds have not
been established. Run `python3 check_recipes.py` before packaging. The release
ZIP contains one selected scene and full-resolution review PNGs; source inputs
remain external, and no raw generated media belongs in Git.

## Delivery

The selected artifact is `character-master-study-v18.zip`, pinned by
[artifact-manifest.json](artifact-manifest.json). Its release tag is
`research-character-reconstruction-v18-20260919`. The archive carries one
editable scene, the review images, recipes and receipts. Prior releases retain
the older selected models; they are not duplicated in this archive.
