# AceHack and Xenaa — reference revision

Created locally in Blender after Aaron rejected the first procedural characters as too cheesy. The rejected version remains in the separate `AceHack-Xenaa` folder.

Open **AceHack_Xenaa_Reference_Revision.blend** for the posed, lit character scene. The textures are packed. Blender is the authoritative material and pose version. The characters are separate named collections marked as assets; the anatomical deformation rigs retain face, hand and body bones. Unhide a deformation rig in the Outliner to pose it.

- `renders/AceHack-Xenaa-reference-revision.png`: actual 2400 x 2000 Cycles render.
- `renders/AceHack-reference-revision.png` and `renders/Xenaa-reference-revision.png`: individual 1600 x 2200 renders.
- `exports/AceHack-rigged.glb` and `exports/Xenaa-rigged.glb`: centered, rigged interchange models in rest pose. Studio objects and hidden superseded details are excluded. Procedural cloth relief and specialized Blender shading do not transfer exactly through glTF; use the Blender scene for the demonstrated look.
- `scripts/`: reproducible modeling stages. Rebuild order: create_realistic_bases.py, build_reference_costumes.py, polish_reference_study.py, finalize_reference_assets.py, export_reference_assets.py. The scripts use this machine's absolute source paths. The source tree and downloaded system assets remain locally under `sources/`; they are not duplicated in the delivery archive.
- `sources/anatomy-record.json`: authored body and face morph settings and measured skeleton landmarks.
- `sources/provenance.json`: exact source revision, downloaded asset hash, reference hashes and authorship.

## What changed

Replaced the improvised primitive anatomy with fitted MakeHuman human meshes and skin textures. Rebuilt clothing around those meshes; added facial morphs, rectangular glasses, salt-and-pepper beard fibers, waistcoat and coat layers, brass mechanisms, a presenting gesture and floating gyroscope for AceHack. Added a sleeveless cuirass, purple coat facings, fitted straps and boots, botanical arm ink, longer groomed hair and crescent blades for Xenaa. Both characters use weighted deformation, including articulated fingers.

## Honest scope

These are editable reference-guided character studies with approximate likenesses. They are not scans, exact reproductions, finished cinematic characters or game-optimized production assets. Face likeness, hair grooming, cloth folds, topology around fitted panels, and deformation under extreme poses can still be improved. The high-detail fibers make these assets relatively heavy. Full cloth simulation, facial performance animation, LODs and an animation stress suite are not included.

The pictures are Blender renders of the delivered scene, not AI-generated substitutes for its geometry. This revision does not establish a learned Clifford-space video generator or a learning benchmark. Zeta research and canonical repository state were not changed by this local art revision.

## Sources and rights

Human base geometry, morph targets, skins, eyes, eyebrows, eyelashes, fitted hair caps, suit and shoe foundations come from the MakeHuman community core/system assets released under CC0. Source scripts in MPFB2 have their own GPLv3 license; that source tree is retained separately. Official sources:

- https://static.makehumancommunity.org/about/license.html
- https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- https://github.com/makehumancommunity/mpfb2/tree/437dd513888a92399d1d3200d2e80859fae55abc

Reference images and videos were supplied by Aaron. Their inclusion as references does not assert additional rights over that artwork. Costume construction, accessory geometry, additional fiber grooms, scene setup and scripts in this revision were authored by Vera, OpenAI Codex.
