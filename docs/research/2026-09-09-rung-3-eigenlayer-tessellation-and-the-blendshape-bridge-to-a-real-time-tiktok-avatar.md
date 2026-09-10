# Rung 3 — eigenlayer tessellation, and the blendshape bridge to a real-time TikTok avatar

Date: 2026-09-09
Work item: 081M22EKT5A087G0R00137CVQQ
Author: shadow (Claude Opus 5), autonomous
Register: §1 **metered** (seven falsifiers, each mutation-checked) · §2 **verified/inferred, marked per claim** · §3 **specification, unimplemented** · §4 **named gaps**

## The goal and the constraint

Aaron, 2026-09-08, wants a TikTok effect in which a real-time 3D character follows his
body movement and facial expression — _"my own filter that looks like me animated but
follows my motions."_

And the constraint that governs every part of it:

> _"our rendering surface should only come from our clifford if we cant generate it from
> clifford that's not our research"_

The progression he set: _"we can go fome lines to drawings over time then 3d renderoring
based on multi lary tellesaling over time."_ Rung 1 (lines) and rung 2 (drawings) are
landed or in flight. This document lands **rung 3** and then does the thing that matters
more than any of the three: it says **exactly where the substrate stops** and what would
have to be true for the rest.

---

## §1 — Rung 3: 3D by multi-layer tessellation (METERED)

`src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts`.

### The construction, in one sentence

Rung 1 projects the 240 E8 roots onto the **Coxeter plane** — built by the bipartite
construction from the **Perron** (largest) eigenvector of the Dynkin adjacency matrix.
That recipe was never specific to the Perron vector: the adjacency has four positive
eigenvalues, each yields a plane by the identical recipe, and those four planes are the
four invariant 2-planes of the Coxeter element acting on R^8.

So rung 3 introduces **no new construction and no new asset**. It runs rung 1's own recipe
on the eigenvectors rung 1 discarded. Two coordinates from layer 0 and one from layer 1
give a 3D embedding of the same 240 roots.

### Why this is a _tessellation_ and not four unrelated pictures

The four planes are mutually orthogonal and together span R^8. Every root's squared length
therefore distributes across the four layers and sums back exactly — a partition with
nothing lost and nothing double-counted. That is the precise sense in which the layers
tessellate, and it is measured, not asserted.

### What was measured

| quantity                                                  | measured                                                   | what a wrong construction gives |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------- |
| Coxeter element order                                     | **exactly 30** (= h)                                       | anything else                   |
| layer rotation exponents                                  | **1, 7, 11, 13** — the E8 exponents below h/2              | not an integer at all           |
| per-root angle spread, all 240 roots × 4 layers           | ≤ **5.554e-14 rad**                                        | order 1 radian                  |
| out-of-plane residual (plane invariance)                  | ≤ **1.271e-15**                                            | order 1                         |
| Pythagorean residual \|Σ r_p² − 8\|, worst over 240 roots | **2.487e-14**                                              | order 1                         |
| orthonormality, max \|Gram − I\| over the 8 axes          | **3.123e-15**                                              | order 1                         |
| ring radii per layer                                      | **8 rings × 30 roots**, identical radii in all four layers | rings do not form               |
| roots keeping their ring index from layer 0 to layer 1    | **0 of 240**                                               | a large fixed set               |
| ring 4-tuple classes                                      | **8 classes of 30**, coinciding with the Coxeter orbits    | not a partition                 |
| Coxeter orbits                                            | **8 orbits of exactly 30**                                 | mixed sizes                     |
| wireframe                                                 | **240 edges, uniform degree 2, 8 components of 30**        | —                               |
| 3D vertices                                               | **240 distinct**, min pairwise distance **0.198127703**    | collisions                      |
| covariance of the 3D point cloud                          | **exactly the identity** (all eigenvalues 1.000000000)     | (2, 1, 0) if coplanar           |

Layer-0 ring radii, for the record:
`0.476471 0.770946 0.947721 1.145849 1.408588 1.533445 1.854023 2.279144`.

Two of these deserve a note because they are stronger than they look:

**The exponents.** The four measured rotation exponents are 1, 7, 11, 13. Their complements
mod 30 — 29, 23, 19, 17 — complete the E8 exponent set, and that set reproduces two
independent invariants nothing here was told: the eight exponents **sum to 120**, the number
of positive roots, and the degrees m+1 **multiply to 696729600 = |W(E8)|**. The eigenvalues
are obtained by a Jacobi solver written out in the module rather than substituted from the
closed form 2cos(πm/h) — substituting it would have made this falsifier circular.

**The covariance.** It came back as _exactly_ the identity, which is sharper than the
non-degeneracy the test was written to check. It is not luck: for any unit direction e,
Σ over roots of (r·e)² = 240·8/8 = 240, so dividing by 240 gives 1 along every axis and 0
between them. E8's root system is isotropic — a spherical 2-design. The test asserts
equality with I as a result.

### Mutation check — seven mutations, and the two vacuous tests they exposed

Falsifiers are worthless unless a wrong construction kills them, so each was mutated and
the _right_ test had to die.

| #   | mutation                                                    | outcome                                                                     |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| M1  | Bourbaki-order Coxeter element instead of the bipartite one | 3 fail — exponent spread jumps to **6.178 rad**                             |
| M2  | one node's colour flipped in the 2-colouring                | 8 fail                                                                      |
| M3  | Perron eigenvector reused for all four layers               | 5 fail — including the ring-derangement test, which exists for exactly this |
| M4  | Gram-Schmidt dropped                                        | 9 fail                                                                      |
| M5  | z taken from layer 0 (making the cloud coplanar)            | **initially 0 fail — VACUOUS**                                              |
| M6  | wireframe joins every _second_ orbit member                 | **initially 0 fail — VACUOUS**                                              |
| M7  | z scaled by 1.5 (3D but anisotropic)                        | 1 fail                                                                      |

M5 and M6 are the point of doing this at all.

- **M5** made z a copy of x, so all 240 points lay in the plane z − x = 0. Every per-axis
  spread was still large and every point still distinct, so the "genuinely 3D" test passed
  while testing nothing. Replaced by the covariance spectrum, which is what actually
  distinguishes a solid from a tilted sheet.
- **M6** joined every second orbit member. That still yields 240 edges of uniform degree 2
  — while splitting each 30-cycle into two 15-cycles, a different figure. Counting edges
  and degrees was a consequence of the property, not the property. Replaced by asserting
  the defining relation directly (every edge joins a root to its own Coxeter image) plus a
  connected-component count.

After the fixes: 21 tests, all seven mutations kill the intended falsifier, baseline green.

### Honest limit — what rung 3 does NOT deliver

A 3D **vertex set with a derived wireframe**. **Not a closed surface.** No face set is
derived, so this is not yet a mesh you can shade. Deriving faces needs a principled 2-cell
choice over the edge graph; that is the next rung. A rung that quietly hand-picked
triangles would have left the substrate, which is the whole line Aaron drew.

Output format is Wavefront **OBJ** — text, so it stays diffable in the proof lineage
(`no-binary-in-proof-lineage`), and it opens directly in Blender, which is the handoff
surface the character work already uses. It is **not committed**: the generator is the
artifact, and a checked-in copy would be a second source of truth that can drift from it.

```bash
bun -e 'import {renderObj} from "./src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts"; \
  await Bun.write("e8-layer.obj", renderObj());'
```

**Measured: 11,854 bytes**, 240 `v` lines and 240 `l` lines. Against §2.4's 8 MB bundle
ceiling that is **0.14%** — so for this rung, size is not a constraint and will not become
one until a face set and textures arrive. Worth stating because "bake it all into 8 MB"
sounds tight and, at rung 3, is not.

---

## §2 — TikTok Effect House: what the pipeline actually permits

**Nothing in this section was measured by running Effect House.** No copy was installed, no
effect was built, nothing was submitted. This is documentary research against the official
docs (current as of v5.14.0, 2026-08-26,
<https://effecthouse.tiktok.com/latest/release-notes-latest>), and that limit applies to
every row below regardless of how it is labelled.

### §2.1 The load-bearing question: can an effect fetch remote data?

**Answer: no — beyond a 1 KB key-value store. Every byte of geometry must be baked into the
effect bundle at publish time.** That settles the brief's key open question and rules out
any live "progress plugin" that would stream geometry or parameters at runtime.

**How strong is that finding? Strong, and not airtight — and the distinction matters.**
No official sentence says "effects cannot make network requests." The verdict is an
**inference from a complete API enumeration**, plus three affirmative statements:

| #   | evidence                                                                                                                                                                                                                                                                                                                                                                              | label        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | The full API category list — Script Base, Decorators, Math, Scene, Rendering, Lighting, 2D/UI, Animation, Physics 3D/2D, Events & Input, Audio, VFX, Post-Process, Face Tracking, Body Tracking, Algorithm, AI, Cloud Data, Social, Assets, Miscellaneous — contains **no Network / HTTP / Fetch / URL category**. An argument from a complete enumeration, not from a failed search. | **VERIFIED** |
| 2   | `Resources.getAllPaths()` returns "every original project path of the resources bundled with the current effect package", resolved relative to `Assets/resources`. **No URL overload.** Affirmatively scopes loading to the bundle.                                                                                                                                                   | **VERIFIED** |
| 3   | The one documented network path is `CloudDataManager` — per-user key-value storage, "fetched from network on mobile", schema fixed at construction, values `number \| string` only, and a hard cap: **"The total serialized data must not exceed 1 KB."**                                                                                                                             | **VERIFIED** |
| 4   | Official sample scripts use only the `APJS` global and synchronous callbacks — no `fetch`, `XMLHttpRequest`, `Promise`, `setTimeout`, `async`/`await`.                                                                                                                                                                                                                                | **VERIFIED** |

Reinforcing from a different direction: the Effect Guidelines prohibit "QR codes or links to
external websites" (**VERIFIED**). And `Leaderboard` is server-shaped but closed —
`getScore()`, `setScore()`, `postFinalScore()`, no URL and no payload; whether it round-trips
a server is **unverified**.

Sources: <https://effecthouse.tiktok.com/learn/guides/api-reference/assets/resources> ·
<https://effecthouse.tiktok.com/learn/guides/api-reference/cloud-data/clouddatamanager> ·
<https://effecthouse.tiktok.com/learn/guides/api-reference/social/leaderboard> ·
<https://effecthouse.tiktok.com/learn/guides/publishing/effect-guidelines>

> Two community feature requests asking for REST capability were found by title only; that
> host failed DNS resolution and **the pages were never read**. Recorded as **unverified**;
> they confirm nothing.

### §2.2 Blendshapes — the good news, and it is very good

**VERIFIED: Effect House documents exactly 52 blendshape channels, in Apple's ARKit spelling
and casing** — `eyeBlinkLeft`, `jawOpen`, `browInnerUp`, `mouthSmileLeft`, `cheekPuff`,
`tongueOut`, and 46 more. The list was read and counted at
<https://effecthouse.tiktok.com/learn/visual-scripting/head-and-face/face-avatar-result/>.

**"ARKit-compatible" is an INFERENCE, not TikTok's claim** — the docs never write the word
ARKit. The identification rests on 52 channels with names and casing identical to Apple's
`ARFaceAnchor.BlendShapeLocation`. Strong; still an inference.

**Can a script read the coefficients numerically? Yes — but not where you would look.**
`Face106Interface`, the script-facing _face_ result, does **not** carry the 52; it carries
106 landmarks plus pitch/roll/yaw. The coefficients are read through **`MorpherComponent`**
— `getBlendShapeWeight(name): number`, `setBlendShapeWeight(name, weight)`,
`hasBlendShapeWeight(name)` (**VERIFIED**,
<https://effecthouse.tiktok.com/learn/guides/api-reference/face-tracking/morphercomponent>)
— after Face Avatar Drive has written them onto the Deformation component.

> **That end-to-end composition is INFERRED. No single doc page states it.** It is the first
> thing to prototype, before any design depends on it.

The visual-graph route is independently **VERIFIED**: the Face Avatar Result node takes a
`Blendshape` string and outputs a `Weight` number, per frame.

Rig requirements (**VERIFIED**,
<https://effecthouse.tiktok.com/learn/guides/tutorials/template-tutorials/face-avatar-drive>):
base mesh in "neutral expression, closed mouth ... and open eyes"; **"Do not alter the mesh
topology"**; mesh origins at (0,0,0); nesting under a Head Tracker makes the avatar follow
the whole head, not only the features. Whether a model may ship a _subset_ of the 52 is
**unverified**; `hasBlendShapeWeight()` implies it works (**INFERRED**).

### §2.3 Tracking

| capability                   | measured value                                                                                                    | label                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| faces tracked simultaneously | **up to 5**, each needing its own Head Tracker                                                                    | VERIFIED                                                                   |
| face landmarks               | **106**, as `Float32Array` `[x0,y0,x1,y1,...]` normalised, plus per-point visibility, score, rect, eye distance   | VERIFIED                                                                   |
| head pose                    | pitch / roll / yaw as Euler angles **in radians**, plus 3D head position                                          | VERIFIED                                                                   |
| 2D body keypoints            | **18 joints**                                                                                                     | VERIFIED                                                                   |
| 3D body                      | Body Avatar Drive; rigged FBX matching `BodyRigTemplate.fbx`, Mixamo recommended, "Skeleton LOD ... less than 50" | VERIFIED                                                                   |
| **3D body joint count**      | —                                                                                                                 | **UNVERIFIED**: the joint names appear only inside an image, never in text |
| hands                        | dual hand tracking, "each with a full skeleton structure"; keypoints per hand **unverified**                      | VERIFIED / partial                                                         |
| segmentation                 | **seven** kinds: portrait, 3D portrait, head, hair, hand, clothing, subject                                       | VERIFIED                                                                   |
| face attributes              | age, "attractive", `boyProbability`, happy score, expression type + probabilities, gender                         | VERIFIED                                                                   |

Performance warnings are explicit and worth heeding: "Segmentation has a high performance
impact"; Body Avatar Drive "has a very high performance impact" (**VERIFIED**).

Note that **3D Head** "provides a 3D mesh mask on your head in real time" — explicitly _not_
a full head replacement (**VERIFIED**). The avatar route is Face Avatar Drive, not 3D Head.

### §2.4 Limits and formats — including two contradictions in the official docs

**Bundle size: 8 MB, for the whole package. VERIFIED on two separate pages.** Also: loading
time ≤ 4 s; images ≤ 1024 KB and ≤ 1024×1024 px, square and a power of two, PNG or JPG;
maximum **three lights** per scene. (Widely-repeated "5 MB" figures online are stale.)

**Triangles — two official pages disagree, and both were read:**

- _Technical Optimization_ gives **per-mesh** caps by animation type: 200,000 static /
  120,000 skinned / **60,000 blendshape**.
- _3D Asset Preparation_ gives a **whole-effect** budget: "Total triangles in the entire
  effect should be less than 60k", ≤ 20k per FBX.

"60k" appears in both and means different things. **No tiebreaker page exists.** For an
avatar, treat 60k as the ceiling under either reading and aim well below it.

**Bones — also contradictory:** 100 bones per model (asset page) vs 50 joints per FBX
(optimisation page) vs "Skeleton LOD less than 50" (Body Avatar Drive). Which governs today
is **unverified**.

**Formats: FBX, glTF, and OBJ are all supported** (**VERIFIED**); textures and materials
import with FBX and glTF. `.glb` specifically is **unverified**. Skinned/skeletal animation
is **VERIFIED supported** (≤ 4 joint influences, unique joint names); blend shapes import and
auto-attach a Deformation component.

> **Consequence for rung 3, and it is a real one.** OBJ is supported, so rung 3's exported
> vertices import directly. But rung 3 exports a **wireframe** — OBJ `l` line elements — and
> **whether Effect House renders line primitives at all is unverified.** The likely answer is
> no; renderers of this class generally draw triangles only. That raises the priority of the
> face-set gap named in §1, and it is cheap to settle by importing the file.

### §2.5 Scripting

**TypeScript**, as component scripts extending `APJS.BasicScriptComponent`, with `@component`
/ `@serializeProperty` decorators; everything hangs off a single global `APJS` namespace and
official samples use no `import` statements. Lifecycle: `onInit`, `onStart`,
`onUpdate(deltaTime)`, `onLateUpdate`, `onEnable`, `onDisable`, `onDestroy`, `onEvent`. One
documented prohibition, verbatim: **"Do not use `require` in TypeScript component scripts."**
`console.log` works. No filesystem, no device APIs, no timers appear in the reference. All
**VERIFIED** from
<https://effecthouse.tiktok.com/learn/guides/api-reference/scripting-capability-usage-guide>.

The AI features are **authoring-time**, not runtime: "AI Image" and "AI Image Alive" are
editor-side asset generators (**VERIFIED**). Whether `AIDrawTextureProvider` executes at
runtime is **unverified**.

### §2.6 Review, publishing, and the policy that actually binds

- Review is **"up to one business day"** (**VERIFIED** twice). The "1–3 business days" figure
  circulating online is **unverified** and contradicted by both official statements.
- Rejection surfaces as status **"Needs Revision"** with a reason; resubmission is capped at
  **10** (**VERIFIED**). **No appeal process appears on any official page.**
- **The Effect Guidelines contain no likeness or impersonation rule** — verified _absent_,
  which is not the same as permission. The binding constraints sit on two best-practices
  pages:
  - _Building Inclusive Effects_: **"Do not create effects that alter users' natural
    features."** The page carves out character transformations — animal, mythical being —
    which a realistic human face is not (**VERIFIED**).
  - _Using Generative AI to Create TikTok Effects_: include **"AI" in the effect's name**,
    with face-swapping named as a triggering case (**VERIFIED**; whether the wording is
    "must" or "highly recommends" is **unverified** — treat as hard).
- TikTok's labelling policy requires labelling AI-generated realistic images/audio/video and
  renames TikTok AI effects to include "AI" (**VERIFIED**, TikTok Newsroom).
- The Community Guidelines line on synthetic media of real private figures is **INFERRED,
  not read** — `www.tiktok.com` is JS-rendered and returned only page titles.

**The distinction that decides the whole policy question is about effect _mode_, not
identity:**

| effect shape                                                             | exposure                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| your avatar rendered **beside or around** the user, driven by their face | touches nothing — no third-party face is altered                                             |
| your likeness **face-swapped onto** whoever opens the effect             | hits **both** rules above, and the character carve-out does not cover a realistic human face |

Aaron's phrasing — _"my own filter that looks like me animated but follows my motions"_ — is
ambiguous between these. **The first is clean; the second is the constrained case.** This
needs settling before any modelling work, and it is a second question for him alongside the
Option A / Option B fork in §3.

### §2.7 One comparison point — Snap Lens Studio

Same 8 MB envelope. Snap allows 2048×2048 textures (twice Effect House) and a separate 10 MB
ML budget; mesh caps are 100,000 triangles, 60,000 skinned (**VERIFIED**,
<https://developers.snap.com/lens-studio/publishing/submitting/submission-guidelines>).

Snap has a **real `fetch()`** — but `InternetModule` is "Available only on Spectacles and
Camera Kit", _not_ in ordinary Snapchat Lenses, where the surface is
`RemoteServiceModule.performApiRequest()` against a **named endpoint string, not a URL**
(**VERIFIED**). Whether that requires pre-registration is **INFERRED** from the signature,
not read.

Snap's expression set is **51**, in PascalCase (`EyeBlinkLeft`) — **ARKit-adjacent, not
ARKit-identical** — and its docs call the names "optional". **On this specific axis TikTok is
the better target**: it gives the ARKit 52 by exact name, which Snap does not.

> The research agent that produced this section **retracted two of its own earlier claims** —
> a Camera Kit "allowlist" quote and Lens Cloud asset-size figures — as pages it had never
> actually fetched. Recorded because a retracted claim is worth more than a plausible one,
> and because it is why the labels above can be trusted at all.

### §2.8 Net verdict

**Buildable, with a real constraint list**, in priority order:

1. **No runtime network.** Everything bakes into ≤ 8 MB.
2. **≤ 60k triangles** for a blendshape mesh, under either reading of the conflicting docs.
3. **Ship an ARKit-named 52-channel head and it maps natively** — the single biggest gift the
   platform gives, and what makes §3's contract the right one to design against.
4. **Prototype the `MorpherComponent` read path first** — documented per-API, not documented
   end-to-end.
5. **Keep it an avatar of you, not a face-swap onto others.**

---

## §3 — THE BRIDGE: how Clifford-derived geometry becomes a character that follows motion

This is a **specification**. Nothing in it is implemented. Its value is that it separates
the part the substrate can supply from the part it cannot, instead of blurring them.

### §3.1 The contract

The realistic industry contract — and, per §2.2, **the one Effect House actually speaks,
channel-for-channel, in ARKit's own names** — is:

```
camera ─▶ face tracker ─▶ b ∈ [0,1]^52   (blendshape coefficients)
                       ─▶ H ∈ SO(3)      (head pose)
                       ─▶ (optionally) J (skeleton joint transforms)

mesh(b) = V_neutral + Σ_i b_i · D_i        (D_i = per-vertex delta arrays)
render  = project( H · skin(mesh(b), J) )
```

Three artifacts are therefore required, and they are _not_ equally available:

| artifact         | what it is                                     | can the Clifford substrate derive it?                     |
| ---------------- | ---------------------------------------------- | --------------------------------------------------------- |
| `V_neutral`      | the neutral mesh — vertices **and faces**      | **vertices yes** (rung 3). **Faces no** — named gap above |
| `D_i`, i = 1..52 | 52 per-vertex delta arrays, one per expression | **No. Not now, not in principle by the current route**    |
| control mapping  | how `b` drives the generator                   | a **choice**, discussed in §3.3                           |

### §3.2 The chasm, stated plainly

**There is no Clifford derivation of `jawOpen`.**

A blendshape delta encodes human facial anatomy — where the mandible hinges, how the
orbicularis oris purses. That information is empirical, about a particular species and a
particular person. No amount of eigenlayer structure produces it, because it is not in the
algebra. Anyone who claims otherwise is doing numerology with a mesh.

So the honest fork is:

**Option A — substrate-pure, and NOT a likeness.** The character is the E8 figure itself.
Tracking coefficients drive the figure's _own_ derived parameters (§3.3). Every rendered
coordinate remains generated from the Clifford substrate; the constraint holds at 100%;
"follows my motions" is fully satisfied. What is not satisfied is "looks like me."

**Option B — likeness, and OFF-substrate.** A human-face model is required. This is the
TripoSR/TripoSG path Vera measured on 2026-09-08
(`docs/research/2026-09-08-character-evolution/README.md`) — 118k vertices, ~70s per
reconstruction, **and rejected by Aaron on quality**: _"still are kinda bad compared to
pictures."_ It requires Aaron's own source material and it leaves the substrate. It must be
labelled as leaving it, every time, rather than described as an extension of rung 3.

**These are different products and the brief does not currently choose between them.**
That choice is Aaron's, it is upstream of all remaining engineering, and it is the highest-
value question in this whole thread.

### §3.3 Option A in detail — the Coxeter flow as a rig

This is the part worth building, because it is _already derived_.

The Coxeter element rotates layer p by exactly 2πm_p/30, with m = (1, 7, 11, 13) measured
above. That discrete rotation sits inside a canonical **one-parameter subgroup**: rotate
layer p by 2π·m_p·t/30 for real t. At integer t this is exactly the Coxeter element's
powers; between integers it is the unique continuous interpolation the algebra supplies.

So the substrate hands us a rig for free:

```
G : R^4 ─▶ R^{240×3}
G(t_0, t_1, t_2, t_3) = the 240 roots, each rotated by 2π·m_p·t_p/30 within layer p,
                        then embedded by (layer-0 x, layer-0 y, layer-1 first axis)
```

`G(0,0,0,0)` is exactly rung 3's figure. `G(1,1,1,1)` is the figure permuted by the
Coxeter element — the same 240 points, re-labelled. Every intermediate value is a rigid
rotation in R^8 followed by the same fixed projection, so **every vertex at every t is
still generated from the algebra.** There is no keyframe, no hand-placed pose, no
authored deformation. The animation is as derived as the geometry.

Four continuous parameters is a small rig, but it is a real one, and it is honest.

### §3.4 Where the human choice enters — declared, not hidden

The map `M : [0,1]^52 → R^4` from tracked blendshape coefficients to layer parameters is
**a choice**. Nothing in the algebra says `jawOpen` should drive layer 2 rather than layer 0.

I claim this choice does not violate Aaron's constraint, and I want the claim examined
rather than assumed:

> The constraint governs **where a rendered coordinate comes from**. `M` places no vertex.
> It selects a point in the generator's _own_ parameter space; the generator then produces
> every coordinate. A control mapping is a **channel**, not a geometry source.

Under the seven disciplines this reads cleanly: `M` is the §13 **declared, metered
channel** through which the camera's entropy enters. The face tracker is an ambient
entropy source; routing it through an explicit `M` is precisely what noninterference asks
for. And with `M` fixed and `b` recorded, the whole render is DST-replayable (§7).

**This is the one place a human decision enters the pipeline, and it should be recorded as
a decision rather than absorbed as an implementation detail.** If Aaron rules that `M` too
must be derived, then Option A needs a derivation of `M` before it can proceed, and that
should be known now rather than after it is built.

### §3.5 What must be specified before any code

1. **Aaron chooses A or B.** Everything else is downstream.
2. **Aaron settles avatar-vs-face-swap** (§2.6). It is a policy fork, not an aesthetic one,
   and it is cheap to answer now and expensive to discover late.
3. **A face set for `V_neutral`** (Option A still needs a shadeable surface — §1's named
   gap). I had hoped a 240-line wireframe might suffice for a first effect; §2.4 makes that
   doubtful, since **whether Effect House renders OBJ line primitives at all is unverified**
   and probably false. Settle it by importing the file before building a mesher.
4. **`M`, written down explicitly** as a table from the 52 named coefficients to the four
   layer parameters, with its status as a choice on the record.
5. **Prototype the `MorpherComponent` read path** (§2.2) before anything depends on it. The
   end-to-end composition Face Avatar Drive → Deformation → `getBlendShapeWeight` is
   inferred from per-API docs and stated nowhere.
6. **A latency budget.** Real-time means per-frame; `G` is 240 rotations in R^8 plus a
   projection, which is cheap by inspection, but the claim is currently **unmeasured** and
   must not be stated as fact until it is.
7. **Everything bakes.** §2.1 means `G` cannot be evaluated server-side per frame and cannot
   be fetched. Either `G` is reimplemented as an Effect House TypeScript component running
   in `onUpdate`, or its outputs are pre-baked as blendshape targets. **Which of those two is
   viable is unresolved**, and it is the one place where §2's constraints bite §3's design.

### §3.6 What Aaron must supply, and what will not be produced for him

If Option B is chosen, the likeness requires **his own source material** — scans,
multi-view photographs, or an existing model he owns. That is his to provide.

**Nothing resembling his likeness has been generated, approximated, or synthesised in this
work, and none will be.** The reconstruction studies that exist are Vera's, from Aaron's own
supplied artwork, recorded under their own consent and provenance trail.

---

## §4 — What is missing, without rounding up

| gap                                                                 | status                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| a derived **face set** (closed surface) over the rung-3 vertices    | **not started**; named, not hand-waved                                                     |
| the 52 blendshape deltas `D_i`                                      | **not derivable from the substrate.** Option B or nothing                                  |
| the control mapping `M`                                             | **a choice**, awaiting Aaron's ruling (§3.4)                                               |
| whether `G` runs per-frame in Effect House or must be pre-baked     | **unresolved** — the one place §2's no-network finding bites §3's design                   |
| per-frame latency of `G`                                            | **unmeasured.** Cheap by inspection; that is not a measurement                             |
| whether Effect House renders OBJ **line** primitives                | **unverified**, and probably not                                                           |
| the `MorpherComponent` read path end-to-end                         | **inferred from per-API docs**, stated nowhere; prototype before depending on it           |
| Effect House behaviour verified by _running_ it                     | **not done.** §2 is documentary research only — nothing was installed, built, or submitted |
| 3D body joint count; bone limit (50 vs 100); triangle cap semantics | **unverified / officially contradictory** (§2.3, §2.4)                                     |
| avatar vs face-swap                                                 | **Aaron's call**, and it decides the policy exposure (§2.6)                                |
| a likeness of Aaron                                                 | **out of scope by hard limit**                                                             |

## The single highest-value next step

**Import rung 3's OBJ into Effect House and read one blendshape coefficient from a
TypeScript component.** It is an afternoon, it needs no new mathematics, and it collapses
four of the unknowns above at once: whether line primitives render, whether the
`MorpherComponent` path works as inferred, what the real per-frame budget is, and whether
`G` can run live or must be baked. Every remaining design decision is downstream of that
one experiment, and none of them can be settled by more reading.

## Pointers

- `src/Core.TypeScript/research/clifford-e8-eigenlayer-tessellation.ts` (+ `.test.ts`) — rung 3
- `src/Core.TypeScript/research/clifford-e8-coxeter-projection.ts` — rungs 1 and 2
- `src/Core/CliffordE8Roots.fs` — the Clifford versor/sandwich reflection that generates the roots (Dechant, _The E8 geometry from a Clifford perspective_)
- `docs/research/2026-09-08-character-evolution/README.md` — Vera's handoff; the off-substrate reconstruction path and its rejection
- `docs/ip-questionable/2026-09-08-two-minute-papers-astra-code-generated-graphics-transcript.md` — the talk that prompted the thread
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline this doc labels against
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference, which §3.4 leans on

## Anchors (Beacon)

- **H. M. S. Coxeter** — the Coxeter element, the Coxeter plane, and the exponents; the entire layer construction is his.
- **Bertram Kostant**, _The principal three-dimensional subgroup and the Betti numbers of a complex simple Lie group_ (1959) — the exponents as eigenvalue data of the Coxeter element.
- **A. J. Coleman**, _The Betti numbers of the simple Lie groups_ (1958) — the bipartite/Perron route from the Dynkin diagram to the Coxeter plane that rungs 1 and 3 both use.
- **Pierre-Philippe Dechant**, _The E8 geometry from a Clifford perspective_ (2017) — the versor/sandwich generation of the roots, reproduced in `CliffordE8Roots.fs`.
- **Thorold Gosset** — the 4_21 polytope whose edges are rung 2.
- **Killing–Cartan** — simple Lie algebras are identified by structure, never by a root count; the discipline behind measuring invariants rather than matching numbers (`numerology-vs-number-theory`).
