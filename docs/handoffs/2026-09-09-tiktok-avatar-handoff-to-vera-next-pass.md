# TikTok avatar — handoff to Vera for the next pass

**From:** shadow*, 2026-09-09. **For:** Vera. **Aaron is handing this over.**

Aaron's end state, verbatim: *"in the final form i'd like to make my own filter that looks
like me animated but follows my motions"*, and *"the hope is the TikTok video can have a
real time 3d character follow the creators movements and facial expressions."*

He has **installed Effect House**. He has also decided one thing that simplifies the
budget considerably: **"we don't need two characters at once."**

---

## 1. The short answer to "is face rigging possible"

**Yes, and it is the thing Effect House is built for.** Aaron is right that it is in their
samples. Face tracking driving blendshapes on a 3D head is the core supported case, it runs
entirely on-device, and none of the network limits below touch it.

The blocker was never capability. It is the **8 MB package budget** and, at one remove,
whose face it is.

## 2. What is settled, with the receipts

| finding | status |
|---|---|
| **ARKit-52 blendshapes, by exact name** | **VERIFIED.** Effect House documents exactly 52 channels using ARKit's own names. This is the single most favourable fact here: a head authored against ARKit — which is what every face-capture tool emits — binds with no name remapping. Snap has 51, PascalCase, marked optional. TikTok is the better target. |
| **8 MB whole-package limit** | **VERIFIED** on two separate pages. |
| **60,000 triangles is a PER-MESH cap** for blendshape meshes | **SETTLED** via the dated release-note changelog, v4.2.0 (23 May 2024): *"The triangle count limit for meshes with blendshape animation has been set to 60K"*, itemised per mesh type. A whole-effect total cannot be differentiated by mesh type. |
| **100 bones, not 50** | **SETTLED**, v3.7.0 (22 Jan 2024): *"The maximum supported bone count of imported models has increased from 50 to 100"*. |
| **No runtime network** | **INFERRED, strongly.** No network module in a complete API enumeration; `CloudDataManager` is the one path and carries a **1 KB hard cap**. There is no sentence anywhere affirmatively prohibiting it. Consequence: everything bakes into the bundle. **No live-progress plugin.** |
| **Unsupported devices refuse VISIBLY** | **VERIFIED.** Toast: *"This effect doesn't work with this device."* Decided **per effect**, and *"full body avatar"* is named as an example of the demanding class. No published minimum iOS/Android version — the floor is four named devices plus a **WebGL** requirement. |
| Account/region gate | **VERIFIED**: none beyond an ordinary TikTok account. Region variation is moderation-driven, not capability-driven. |

**Trap worth carrying forward:** *neither official page is uniformly authoritative.* The
Technical Optimization page is right on triangles and **stale by two and a half years** on
bones — and it is the page the in-tool performance test links to when it fails, which is
exactly why it reads as the authority. Check the release notes before believing either.

## 3. The budget, and why the triangle cap is a red herring

A 60,000-triangle mesh (~30k verts) with 52 ARKit targets carries roughly
`30,000 × 52 × 12 B ≈ **18.7 MB**` of morph deltas alone — **over twice the entire package
budget**, before geometry or one texture. (INFERRED; the arithmetic is stated so it can be
checked.)

So **the 60k cap is unreachable for a face-driven character.** Backing out from 8 MB gives
roughly **4,000–5,000 vertices** for the blendshape-bearing mesh.

**The lever that matters — and it only works because the cap is per-mesh:** *split the head
from the body.* Only the head needs blendshapes. The body rides the separate skinned-mesh
budget carrying **no morph payload at all**. Settling the per-mesh question is what makes
this legal.

**One character comfortably fits.** Aaron's "we don't need two characters at once" removes
the binding case: two 4.3 MB meshes would be 8.6 MB with zero textures, which does not fit.
One leaves 3.7–6.5 MB for textures, audio and everything else.

**Second constraint, easily missed:** a **4-second maximum load time**, stated per-device
and independent of file size.

## 4. What exists to start from

- **`AceHack-rigged.glb` / `Xenaa-rigged.glb`** — your work: *"centered, rigged interchange
  models in rest pose"*, MakeHuman-fitted meshes, Blender authoritative, textures packed,
  provenance recorded. Archived in `triposg-shape-study.zip`, sha256-pinned, **1.5–4.3 MB
  each** (the `reconstruction-sg` pair is the smaller; `-framed` are the 4.2 MB ones).
- **The gap I expect but have NOT verified:** "rigged" there means a **skeleton**, which
  drives body motion. Face tracking needs **blendshapes/morph targets**, specifically the
  ARKit-52 set. A MakeHuman-derived head will not have those unless authored. **Please
  confirm before planning around it** — I did not open the files.

## 5. The fork that is Aaron's, not ours

There is **no Clifford derivation of `jawOpen`.** Blendshape deltas encode human facial
anatomy; that is not in the algebra. Aaron's standing constraint is *"our rendering surface
should only come from our clifford — if we cant generate it from clifford that's not our
research."* So:

- **Option A — substrate-pure.** The E8 figure driven by the derived Coxeter flow. 100%
  generated, satisfies the constraint completely, and is **not a likeness**. Rungs 1–3 are
  landed and the generated OBJ is **11,854 bytes — 0.14% of the budget.**
- **Option B — likeness.** Off-substrate by construction. The TripoSG path Aaron already
  rejected on quality.

**Everything else is downstream of that choice and it is his to make.** Do not resolve it
by building.

## 6. The one experiment worth doing first

**Import the rung-3 OBJ into Effect House and read one blendshape coefficient from a
TypeScript component.** An afternoon, no new mathematics, and it collapses four unknowns at
once:

1. whether Effect House renders OBJ **line** primitives (probably not — that would raise the
   priority of emitting faces rather than a wireframe);
2. whether the `MorpherComponent.getBlendShapeWeight(name)` read path works as inferred —
   **`Face106Interface` does not carry the coefficients**, and the wiring from Face Avatar
   Drive → Deformation → Morpher is inferred, documented nowhere end-to-end;
3. the real per-frame budget;
4. whether the generator can run live or must be pre-baked.

None of those can be settled by more reading, and every remaining design decision depends on
them.

**Note you may not need (2) at all.** For a straight "character follows my face" filter the
face driver binds to the mesh's morpher **in the editor graph** — script access only matters
if you want to *react* to expressions programmatically. The documented gap may sit on a path
we never take.

## 7. A policy question that is cheap now and expensive late

**Settle avatar-vs-face-swap before building.** An avatar driven by *your own* face is
policy-clean. Your likeness applied onto *other users'* faces hits both the "do not alter
users' natural features" rule and the AI-content naming rules. It costs one decision now.

## 8. Practical mechanics

- **Effect House is desktop-only** — macOS + Windows, with separate Apple-silicon and Intel
  Mac builds. Exact system requirements are documented to exist but are **not published**.
- **Testing is "Preview in TikTok"**: a QR code scanned from the TikTok app on the **same
  account**. Required for real AR camera and screen gestures — the in-editor panel simulates
  resolutions only, not device capability.
- **Recommended falsifier before committing to any mesh target:** export one deliberately
  oversized character and read the tool's **own package-size indicator**. Every estimate in
  §3 depends on the importer's real packing efficiency, which we have not measured.

## 9. Honest limits of this handoff

**Nothing here was measured by running Effect House.** No install, no build, no submission.
Section 2 is documentary; §3 is arithmetic. Also unverified: whether Effect House renders
OBJ line primitives; the 3D body joint count (the names appear only inside an image); and
whether the 100-bone figure is per-model, per-FBX or per-effect.

## Pointers

- `docs/research/2026-09-09-tiktok-effect-house-mesh-and-bone-limits-settled-by-release-notes-and-device-support.md` — the limits research, with URLs and exact quotes. **In flight as PR #17112, not yet on `main`** — if it is not there when you read this, that is why.
- `docs/research/2026-09-09-rung-3-eigenlayer-tessellation-and-the-blendshape-bridge-to-a-real-time-tiktok-avatar.md` — rung 3 + the bridge spec and the A/B fork
- `src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts` — rungs 1 and 2
- `src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts` — rung 3
- `docs/research/2026-09-08-character-evolution/README.md` — your own handoff, and the model provenance
