# Character v16: smooth weights without discarding source detail

Date: 2026-09-16
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

## Re-entry and scope

The last character landing at re-entry was [v15](../2026-09-09-tiktok-character-v15/README.md),
PR #17161. Its release remains immutable and its local inputs are present.
The earlier source-restoration work is retained. This iteration addresses
shoulder/neck weight transitions and an exposed supplemental jacket lining.
It is another Blender reference study, not a new TikTok runtime package.

The broader predictive-state, composable Bayesian DAG, resource-scheduling and
Clifford/generator research remains linked through the
[handoff index](../../handoffs/README.md). This experiment contributes a measured
geometry/deformation recipe and failure observations. It is not a new Clifford
algorithm, a learning benchmark, or evidence of physical universality.

## Changes and tests

The weight-only stage uses positive inverse-edge-length neighbor averaging,
restricted to bounded shoulder and neck regions. Vertices outside those regions
stay fixed; selected scalp-hair vertices also stay fixed at full Head influence.
Each channel takes 400 relaxed iterations with a 0.015 fidelity term toward its
original value. Weights are normalized afterward. This is a finite smoothing
experiment, not a claim of convergence to an optimal anatomical solution.
Skinning remains linear. No body decimation, global rebake or replacement arms
are introduced.

[Comparison](comparison.json) evaluates v15 and the weight revision through the
same ten synthetic poses. Counts below concern mesh edges whose neutral length
exceeds 1 mm. Repeated occurrences in different poses are separate observations,
not distinct anatomical defects or independent statistical samples.

| Observation | v15 | v16 weight stage |
| --- | ---: | ---: |
| Over-3x stretches in the original individual arm/head poses | 93 | 0 |
| Over-3x stretches in the 75-degree bilateral arm pose | 222 | 5 |
| Over-3x stretches in the combined arm/head/knee pose | 20 | 0 |
| AceHack compressed-below-one-third edges, 75-degree arms | 239 | 253 |
| Xenaa compressed-below-one-third edges, 75-degree arms | 22 | 21 |

The compression regression is retained as a finding. The selected knee poses
still have compressed edges (including 34 on Xenaa's left leg) despite having
no over-3x stretches. Zero extreme stretching alone never meant acceptable
anatomy. The wider arm, elbow and combined poses extend the previous suite;
these are engineering checks, not a preregistered held-out learning evaluation.

The first wide two-character render cropped one hand and overlapped the other
character's arm. Matched single-character 75-degree close-ups replace it as the
shoulder-review evidence. The neutral rendering retains the detailed source
appearance; the shoulder improvement is modest visually, not a dramatic art
upgrade. The bent-arm source anatomy remains unnatural.

## Rectangular lining investigation

A visibility ablation removed only `Xenaa | Jacket back lining`. The rectangular
dark underarm patches disappeared, identifying this supplemental mesh as their
source in the inspected view. The selected correction keeps the lining but
shortens and tapers its four rings. [Lining receipt](lining-fit.json) records
all old and new vertices. This changes the supplemental mesh deliberately;
it does not alter the original reconstructed body faces.

The rear head-turn close-up still exposes rough reconstruction, fragmented
surfaces and poor hair/body separation. A matched v15 back view is retained.
The lining is a heuristic cover, not a sealed torso, semantic hair segmentation
or cloth simulation. The front-view correction does not close the rear-quality
finding.

## Saved-scene verification

[Validation](validation.json) reopens both saved scenes independently of the
weight script. Original source vertex coordinates, loop indices, UVs, projection
attributes and face material indices are unchanged. Packed image hashes match.
The explicitly changed supplemental lining is reported separately. Neutral
source-mesh evaluated positions differ by at most 1.35e-7 m. Selected Xenaa scalp
vertices retain full Head weight; recovered hair follows Head within 4.22e-8 m
in head and combined poses. There are at most four influences above 1e-7, with
weight-sum error below 1.23e-7.

These checks establish bounded numerical properties, not visual acceptance.
The 50-bone skeleton still has only 17 weighted bones. No new facial morphs,
individual finger weights, camera tracking, Effect House import or phone runtime
measurement is claimed. V14 remains the last measured Effect House candidate.

## Review and next investment

Self-review findings, in priority order:

1. Rebuild Xenaa's rear garment and hair boundaries using explicit separate
   surfaces, then verify front, side, back and head turns. A region mask over
   fused reconstruction is insufficient; preserve the accepted front detail.
2. Repair shoulder volume and elbow anatomy, including compression at wider arm
   raises. Additional weight smoothing cannot supply missing anatomical surfaces.
3. Repair hidden leg/coat boundaries and knee compression. Render both legs and
   combined motion; do not certify them solely from stretch counts.
4. Author mouth/eyelid topology and facial channels, then finger topology and
   individual weights, before making a separately reduced mobile derivative.
5. Re-test that derivative in Effect House and on a phone, with actual combined
   tracking and measured appearance/performance. Earlier v14 figures do not
   transfer to this reference asset.

## Restore and regenerate

The [v16 release](https://github.com/Lucent-Financial-Group/Zeta/releases/tag/research-tiktok-character-quality-v16-20260916)
contains one selected v16 Blender scene, full-resolution evidence inside its
ZIP, recipes and receipts. Earlier releases provide rollback. No raw image,
model or video is committed here; follow the
[storage policy](../../CHARACTER-ASSET-STORAGE.md).

Restore the v15 release scene to the sibling directory
`TikTok-Character-Quality-v15/review/Blender-Quality-Review-v15.blend`.
Restore [sources](sources/) under `TikTok-Character-Quality-v16/`, removing each
`.txt` suffix. With Blender 5.2.1 LTS, run in background mode using
`--python-exit-code 1`, six threads and this order:

1. `refine_weights_v16.py` measures the baseline and weight stage, then saves
   the new pose timeline.
2. `panel_probe_v16.py` records the lining visibility ablation before fitting.
3. `shoulder_closeups_v16.py` records matched shoulder views before lining fit.
4. `fit_lining_v16.py` updates the supplemental lining and records front/back
   evidence. Its output is the selected scene.
5. `back_baseline_v16.py` records the matched v15 rear view.
6. `validate_v16.py` checks the final scene and renders its side views.
7. `render_final_v16.py` refreshes the final front, knee, elbow and combined views.
8. `package_v16.py` creates the explicit archive and checks every manifest entry.

The saved timeline uses frames 1 neutral, 25/49 individual arms, 73/97 knees,
121/145 head turns, 169 wider arms, 193 elbows and 217 combined motion. All poses
are synthetic. The end is a combined pose, not a seamless animation loop.
Exact output bytes are indexed in [the manifest](artifact-manifest.json);
byte-identical Blender regeneration is not established.

Repository check outcomes and re-entry environment limitations are recorded in
[repository checks](repository-checks.md). This was a self-review, not an
independent reviewer endorsement or an all-green factory-health claim.
