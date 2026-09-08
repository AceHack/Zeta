# AceHack & Xenaa — Blender character atelier

Original stylized 3D character interpretations by Vera, OpenAI Codex, based on
Aaron's supplied images and video references. Made locally in Blender 5.2.1 LTS.
No third-party character model or remote 3D generation service was used.

## Open first

**AceHack_Xenaa_Atelier.blend** — the editable master scene. Open normally in
Blender. Frame 1 is the hero pose; frames 1–144 are a six-second turntable at
24 fps. The root motion comes from the actual Zeta.Core.Cl3 rotor implementation.

- `AceHack | Character`: head, silver beard/quiff, glasses, tailored coat,
  waistcoat, brass instruments/capacitors, greaves, hands and staff.
- `Xenaa | Character`: face, flowing individual hair locks, layered violet
  costume, cyan accents, botanical arm details and crescent daggers.
- Each character has a basic named-bone posing rig. It is a rigid-part
  articulation rig, not a production skin-deformation or facial-animation rig.
- Character FX are separated and attached to the appropriate character frame.
- Stage, cameras and lights have their own collections.
- `References | Supplied art • hidden` contains three packed reference images.
  Enable the collection in the Outliner when you want to compare the art.

## Deliverables

- `exports/AceHack.glb` and `exports/Xenaa.glb`: self-contained static character
  assets for glTF-compatible viewers. Authoring scale is 0.5m per Blender unit;
  GLB geometry is converted to approximately two metres in height. These files
  contain actual modeled geometry, not image planes.
- `renders/AceHack_Xenaa_Hero.png`: 2560 × 1920 Cycles pair render.
- `renders/AceHack_Portrait.png`, `renders/Xenaa_Portrait.png`: 1440 × 1920 cards.
- `renders/AceHack_Xenaa_Turntable.mp4`: six-second 1280 × 960 inspection video.
- `exports/manifest.json`: actual mesh counts, bounds, export sizes and hashes.
- `exports/reimport-validation.json`: fresh-process GLB reopening checks.
- `scripts/`: reproducible geometry, export and render scripts. Earlier builder
  versions and review renders are retained separately for provenance.
- `research/CLIFFORD_SCENE_DIRECTION.md`: the actual motion link, its limits,
  and a bounded next scene/DAG experiment.

## Editing and practical limits

Select an object in its character collection to edit geometry or materials.
Use Pose Mode on the character's Pose Rig for limb/root articulation. The
existing turntable keys the whole rig object; clear or replace that object
animation if you want a stationary root while creating a different action.

The master uses procedural textile and fine-surface shaders. GLBs use portable
PBR factors and preserve modeled detail; they do not reproduce every Blender
procedural shader. They are detailed static hero assets, not optimized game LODs.
Cloth/hair are authored forms, not simulations. There are no facial blendshapes,
production deformation topology, facial capture, or exact photogrammetric
likeness. Concealed/back details are designed interpretations of the references.
This is a stylized asset set, not the photoreal cinematic finish of the clips.

## Research connection

The retained F# driver runs Zeta's `Cl3.rotor` and `Cl3.rotate` to generate the
rotation basis; Blender consumes that basis to animate the character roots.
The 145 fixed samples agree with analytic rotation to 2.22e-16. The separate
Blender conversion result is retained in `research/blender-motion-validation.json`.
This is a concrete rigid-motion adapter. Learned identity, geometry, motion and
temporally consistent video generation remain separate research work.

The existing Zeta learning handoff and unrun M4/M5/frozen-query experiments were
not changed. This artwork package is local; it has not been published to main.
