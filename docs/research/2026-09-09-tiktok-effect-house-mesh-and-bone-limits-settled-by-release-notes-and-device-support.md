# TikTok Effect House: the 60k/bone-limit conflict, settled by the release notes; and what device support is actually published

Date: 2026-09-09
Operational status: research-grade
Author: shadow-subagent (Claude Opus 5), Claude Code
Work item: 081M22GD7RJ087G0R002W6HA45
Scope: two blocking questions for the rigged-3D-character-driven-by-face effect —
(1) is 60,000 a per-mesh cap or a whole-effect total, and is the bone limit 50 or 100;
(2) what device / OS / region / account requirements are actually published.

## Register discipline

Every claim below is marked **VERIFIED** (a page I fetched and read in this session, with
the URL and the exact sentence), **INFERRED** (my reasoning over verified inputs), or
**UNVERIFIED** (not established). Nothing here is written from a result I did not read
myself. Pages that would not load are named as such and given zero weight.

All pages were fetched 2026-09-09 as server-rendered HTML (the Effect House docs are a
Docusaurus site; the article text is in the HTML, not client-rendered), so the quotes are
transcriptions of bytes I read, not summaries.

---

## Question 1 — the 60k ambiguity and the 50-vs-100 bone conflict

### The conflict is real, and both pages are live

**VERIFIED.** Two official pages state different things, and both are current as of
2026-09-09.

**Page A — Technical Optimization**
<https://effecthouse.tiktok.com/learn/guides/getting-started/technical-guidelines/technical-optimization>

> - Use triangle polygons and quad polygons for your models
> - A maximum of 200,000 triangles is supported for static meshes
> - A maximum of 120,000 triangles is supported for meshes with skinned animation
> - A maximum of 60,000 triangles is supported for meshes with blendshape animation
>
> For optimal performance, refer to the following recommendations:
>
> - < 100,000 triangles for static meshes
> - < 60,000 triangles for meshes with skinned animation
> - < 30,000 triangles for meshes with blendshape animation

and, under **Rigging**:

> - Each FBX file can have up to **50 joints**
> - You can add multiple FBX files to your effect, and each one can contain up to 50 joints. This limit applies separately to each FBX file.
> - A maximum of 4 joint influences is supported

**Page B — 3D Asset Preparation**
<https://effecthouse.tiktok.com/learn/guides/workspace/assets/asset-preparation/3d>

> **Mesh**
> - Use triangle polygons and quad polygons.
> - Total triangles in the entire effect should be less than 60k for optimal performance. For each model, it is recommended that you keep each FBX file under 20k triangles.
> - All UVs must be mapped.
>
> **Character Rigging**
> - Use a maximum of 100 bones per model.
> - Use a maximum of 4 joint influences.
> - Joint names must be unique.

**Neither page carries a last-updated or version marker.** VERIFIED by grepping both
documents for `last updated`, `lastUpdate`, `dateModified`, `datePublished`,
`article:modified` and `og:updated` — none present. So the docs themselves supply no
tiebreaker, which is why the previous read stalled here.

### The tiebreaker: the release notes, which are dated and versioned

**VERIFIED.** <https://effecthouse.tiktok.com/latest/release-notes-latest> is a single
dated changelog, newest first, 96 versions, running from **v5.14.0, August 26, 2026**
back through 2022. Two entries settle both halves of the question.

**On triangles — v4.2.0, May 23, 2024:**

> Import camera and light settings together with FBX models you import to Effect House
> Keyed animation for blendshapes can now be imported
> The following improvements have been made to the triangle count limit for models imported to Effect House:
> - Increased the triangle count limit for static meshes from 100K to 200K
> - Increased the triangle count limit for meshes with skinned animation from 100K to 120K
> - **The triangle count limit for meshes with blendshape animation has been set to 60K**

The scope is stated in the entry's own lead-in: *"the triangle count limit for **models
imported to Effect House**"*, itemised **per mesh type**. A whole-effect total cannot be
differentiated by mesh type — an effect containing one static mesh and one blendshape mesh
would have two contradictory totals. So:

> **ANSWER (VERIFIED, per-mesh):** 60,000 triangles is a **per-mesh hard cap for meshes
> carrying blendshape animation** — reading (a). Page A states it correctly. Page B's "60k
> in the entire effect" is a **separate, weaker recommendation** that happens to reuse the
> same number, not a restatement of the cap.

The numeric coincidence is what made this look unresolvable: 60,000 appears on both pages
in different roles. They are not logically contradictory (a per-mesh cap and a whole-effect
recommendation can coexist), but they cannot both be what "60k" means when you are sizing a
mesh — and the pages' own *recommendations* do contradict each other. Page A recommends up
to 100,000 triangles for a single static mesh; Page B recommends under 60,000 for the whole
effect. Both cannot be followed.

**On bones — v3.7.0, January 22, 2024:**

> **Updates**
> - Font options have been added to the Text component
> - **The maximum supported bone count of imported models has increased from 50 to 100**

> **ANSWER (VERIFIED):** the current bone limit is **100 per model**. Page B is correct.
> Page A's "Each FBX file can have up to 50 joints" is **stale by two and a half years** —
> it describes the pre-v3.7.0 limit.

This inverts the ranking you would reach from the pages alone. Page A is the QA page the
tool itself links to, so it looks more authoritative — and it is right about triangles and
wrong about bones. **Neither page is uniformly authoritative.** That is the finding.

### Corroborating history — the 50-joint text predates the increase and was never updated

**VERIFIED** via the Internet Archive. An older, now-dead official URL,
`https://effecthouse.tiktok.com/learn/guides/best-practices/technical-optimization/`
(**404 today**, confirmed twice with a browser user-agent and redirects followed), captured
**2023-06-07**, read:

> - Total triangles in the entire effect should be less than 100,000 for optimal performance. For each model, the tool is limited to 50k triangles per FBX, but we recommend keeping each FBX mesh under 30k for best chances at high performance.
> - 50 maximum joints per FBX. You can have multiple FBX files in one effect and the joint limit is only local to each FBX.
> - 4 maximum joint influences.

So the "50 joints per FBX, local to each FBX" sentence dates to **before January 2024**,
survived the reorganisation into the current Technical Optimization page, and was never
revised when the limit doubled. Its triangle numbers *were* revised (50k per FBX → the
200k/120k/60k per-mesh-type table); its joint number was not.

Snapshots of both current pages confirm neither is the "newer" one:

| page | captures read | content |
| --- | --- | --- |
| Technical Optimization | 2025-08-11, 2026-06-15 | identical wording to today: 60,000 blendshape cap, "Each FBX file can have up to 50 joints" |
| 3D Asset Preparation | 2025-11-08, 2026-06-15 | identical wording to today: "less than 60k" whole-effect, "maximum of 100 bones per model" |

Both have been stable for over a year. Recency cannot break the tie; the changelog can.

**Internet Archive reliability note:** the CDX API returned an explicit
`Internet Archive: Temporarily Offline` page on roughly half of my calls this session and
empty responses on others. Every archive result quoted above is one I received and read in
full; queries that returned the offline page are reported as failures and carry no weight.

### A third official surface, and what it does *not* say

**VERIFIED.** The Effect Guidelines page
<https://effecthouse.tiktok.com/learn/guides/getting-started/best-practices/effect-guidelines>
carries a **Technical Requirements** table:

| Device | Loading Time | Package Size | Image Size | Image Dimension |
| --- | --- | --- | --- | --- |
| iOS | Max 4 sec | Max 8 MB | Max 1024 KB | Max 1024 x 1024 px |
| Android | Max 4 sec | Max 8 MB | Max 1024 KB | Max 1024 x 1024 px |

It restates the 8 MB package cap and adds a **4-second maximum loading time** — a
constraint separate from package size — and it is **silent on triangles and bones**. So it
neither supports nor undercuts either page.

### Why Page A still looks authoritative (and why that intuition misleads here)

**VERIFIED.** The in-tool performance test routes failures to Page A. From
<https://effecthouse.tiktok.com/learn/guides/publishing/test-effect-performance>:

> If your effect fails the performance test, click **View suggestions** to open the technical optimization guide, which contains guidelines for troubleshooting performance issues.

The three "technical optimization guide/guidelines" links on that page all point at
`/learn/guides/getting-started/technical-guidelines/technical-optimization` — Page A. The
same page also carries the QA specification the submission pipeline checks:

> Once you've submitted your effect, it goes through an internal performance test and QA review. We'll check the following specifications to ensure your effect meets the necessary criteria for publication:
> - Effect package size: No more than 8 MB
> - Image size: No more than 1025 KB
> - Image resolution: No more than 1024 x 1024 px

**INFERRED:** that pipeline role is why Page A reads as the authority, and it is a
reasonable prior — it is simply wrong on this one bullet. The lesson worth keeping: *the
page a tool links to is not thereby the freshest page in it.*

### What is still not settled

- **UNVERIFIED:** whether the 100-bone limit is per **model** (Page B's word), per **FBX
  file** (Page A's frame for the old 50), or per **effect**. The v3.7.0 note says
  *"imported models"*, which favours per-model, but does not say whether multiple imported
  models each get 100. Page A's "this limit applies separately to each FBX file" was
  written about the 50 and may or may not carry forward.
- **UNVERIFIED:** whether the editor enforces these caps at import (refusal) or only at the
  QA/performance gate. No page I read states an enforcement point.
- **UNVERIFIED:** whether the 60,000 cap counts triangles per *mesh* or per *submesh*. Both
  pages say "meshes"; the asset-prep page separately documents submeshes as subsets of a
  mesh, which suggests per-mesh, but this is not stated.
- **UNVERIFIED:** the blendshape *count* limit. No page I read caps the number of blend
  shapes; the asset-prep page only says the Preview panel displays *"the number of verts,
  tris, bones, submeshes, and blend shapes."*

### If you must pick working numbers

Stated plainly as **a choice under residual conflict, not a finding**: build to
**≤ 30,000 triangles and ≤ 50 bones per character**. The triangle figure is Page A's own
*recommendation* for blendshape meshes (verified quote above), not the cap; the bone figure
takes the stale-but-lower number because the per-model/per-FBX scope of the 100 is
unresolved and the downside of exceeding it is a rejected submission. Neither number is
what the docs say is *permitted* — 60,000 and 100 are — and if the geometry budget analysis
below is right, neither is the constraint that will actually bite.

---

## Question 2 — device support

### There is no published minimum iOS or Android OS version

**VERIFIED, as a negative result with a stated search.** I read the FAQ, the Effect
Guidelines, the Technical Optimization page, the Introduction, Download and Login, the
crash-course getting-started module, both Preview pages, Submit Your Effect, Test Effect
Performance, the Device Tracker / AR camera page, and the DeviceInfo API reference. **None
states a minimum iOS version, a minimum Android version, or a minimum TikTok app version
for a viewer to run an effect.** The DeviceInfo scripting API exposes `getOS(): OS`, so an
effect can branch on operating system at runtime, but the docs specify no floor.

What is published instead is a **floor by example plus a capability requirement**.

### The published floor is four named phone models, and the mechanism is WebGL

**VERIFIED.** The same note appears, near-verbatim, on the FAQ, the Effect Guidelines, and
the Technical Optimization page — three independent official surfaces:

> Even though an effect may pass QA, some effects may not work for lower-end devices (specifically Android devices). These effects will trigger the toast **"This effect doesn't work with this device"** since they incorporate more technically demanding features like full body avatar, openGL ES, etc. Many effects are unable to be used by some Android phones due to their devices not supporting the WebGL used in Effect House. Community Effects work on most newer iOS and Android devices and **do not currently work on devices equal to or lower than the following models: Samsung Galaxy J3, LG Leon H324, Huawei Honor 4X, and Cubot J3.**

(Effect Guidelines wording; the Technical Optimization page says "warning message" where
this says "toast", and the FAQ repeats the model list a second time under *"Why does my
effect not work for some users?"*.)

So, on the specific sub-questions asked:

- **Minimum OS version — VERIFIED absent.** Not published anywhere I could load.
- **Allowlist / denylist — VERIFIED as neither.** What exists is a four-model *worked
  example* of the exclusion boundary ("equal to or lower than"), not an enumerated list.
  **INFERRED:** an internal capability gate exists — the toast is a runtime decision per
  effect per device — but its inputs are not published.
- **Unsupported devices simply not seeing the effect — VERIFIED, and the documented
  behaviour is different from that.** The user *does* reach the effect and gets an explicit
  toast, **"This effect doesn't work with this device."** It is a visible refusal, not a
  silent hide. That distinction matters for a launch: your audience will see a failure
  message with your effect's name on it, not an absence.
- **The gate is per-effect, not per-app — VERIFIED by the wording:** *"These effects will
  trigger the toast … since they incorporate more technically demanding features."* A
  heavier effect fails on devices where a lighter one runs. **INFERRED:** a rigged 3D
  character with 52 blendshapes plus face tracking sits at the demanding end and will
  trigger this on more devices than a 2D sticker will — the docs name "full body avatar"
  explicitly as an example of the demanding class.

### Region and account type

**VERIFIED.** From the FAQ, *"Why can't users on certain devices or in certain countries use
my Community Effects?"*:

> Some effects may not be available for all devices or in all countries. For example, effects that use certain high-performance features may not be available on lower-end Android devices. Some effects may not be available in all countries due to regional differences; we are mindful of content that may be offensive or culturally inappropriate in certain regions.

So regional variation is **content-moderation-driven, not capability-driven**, and no list
of regions is published.

**Account type — VERIFIED: no gate beyond an ordinary TikTok account.** Logging into Effect
House requires only *"your TikTok account"*, authorised by scanning a QR code from the
TikTok app (Profile → Add friends → scanner). Submission requires only that account; the
submission flow says *"Creators without brand sponsorships are taken directly to the
submission form"*, and the FAQ says *"At this time, we're not accepting any types of
branded or sponsored effects"* for Community Effects. Review *"typically takes up to one
business day"*; an effect may be resubmitted **up to 10 times**, and a published effect may
be updated **up to 5 times within 6 months**.

**VERIFIED, and worth flagging as the one real account/region gate found:** it applies to
*mobile* effect creation, not desktop. From the Mobile Effect Creation FAQ: *"Mobile effect
creation using templates is available to all TikTok creators. Creating effects from scratch
is currently only available in select regions but should be available to all soon."*
Desktop Effect House carries no equivalent statement.

**Not loaded:** `https://support.tiktok.com/en/using-tiktok/creating-videos/creating-effects-on-mobile`
redirects to a client-rendered TikTok support SPA whose body text is not in the HTML. A web
search summary attributed TikTok app version floors (v32.1 Android / v32.0 iOS) to it for
the *mobile editor*. **I could not read that page, so this carries zero weight and is
recorded only so the next reader does not re-derive it as new.**

---

## Bonus — the desktop tool and the on-device preview flow

**Effect House desktop system requirements — partially VERIFIED, mostly not published.**
The FAQ states:

> Effect House is currently only supported on Mac OS and Windows. We have two different versions of Effect House depending on if your Mac is using an Apple or an Intel chip, so make sure you've downloaded the correct one.

That is the whole of it in the docs: **macOS and Windows only, with separate Apple-silicon
and Intel Mac builds.** The crash-course module confirms requirements *exist* — *"There are
minimum system requirements for downloading the software, so make sure your computer meets
those requirements"* — without stating them, and links to the download page.
**`https://effecthouse.tiktok.com/download` 302-redirects to the site root, which renders
the download buttons client-side; no OS version, RAM or GPU figure appears in the HTML.**
So the exact minimums are **UNVERIFIED** — published somewhere in the app or installer,
perhaps, but not in the documentation.

**Preview and test flow — VERIFIED, and there are two distinct flows.**

*In-editor (no phone):* the Preview panel runs the effect against preset videos and images
covering *"different faces, people, multiple postures, hand gestures, pets, and in different
environments"*, or your own uploads (**image ≤ 5 MB**; video H.264 AVC, HEVC/H.265, M4V,
MOV, MP4), or your webcam. It can **simulate the TikTok UI safe zone** and **simulate
different phone resolutions** — *"Select a device on the bottom left to simulate resolutions
that match various current devices and check their compatibility with your effects."* Note
what that simulates: **resolution, not device capability.** It cannot tell you whether a
device will show the "doesn't work with this device" toast.

*On-device (QR):* click **Preview in TikTok** in Effect House to generate a QR code; open
TikTok **logged into the same account**, and scan it from Friends → Add friends → QR
scanner, from Discover → QR scanner, or from the app's long-press **Scan** shortcut. The
docs are explicit about when this is required: *"you can preview most of your effects in
Effect House, but if you want to try your effects using an AR camera or screen gestures,
you can scan the QR code in Effect House and preview it on TikTok."* One documented
difference: *"Hints do not display when previewing your effect in TikTok."*

*Before submitting:* a **Test performance** button runs a ~30-second check. **VERIFIED
caveat, and it is the important one:** *"Even if your effect passes the performance test, it
may still be rejected after submission due to performance issues."* The test *"analyzes your
effect's frame rate"*, and a rejection is attributed to *"either the configuration of your
project or the inability of your effect to run on certain low-end devices."* Named causes
include *"Detailed models with a large number of polygons"* and *"High-resolution
textures"*. Maximum supported frame rate is **30 FPS** (Technical Optimization).

**INFERRED:** the desktop preview is a weak oracle for device compatibility. Passing it, and
passing the performance test, are both compatible with a post-submission rejection and with
the runtime toast on real phones. The only honest compatibility check available to us is
the QR preview on the actual target hardware — and it tests *our* phone, not the fleet.

---

## What this changes for us

Package limit **8 MB** (VERIFIED twice: the QA specification on the Technical Optimization
page and the per-device Technical Requirements table in the Effect Guidelines). Existing
character meshes **1.5–4.3 MB each** (caller-supplied figure, not verified by me).

**The binding constraint is the 8 MB package, and it is not close.**

**INFERRED, arithmetic over verified inputs.** A 60,000-triangle mesh is roughly 30,000
vertices. Blendshape animation stores a per-vertex delta per target. At 52 ARKit targets
and 12 bytes per position delta, that is `30,000 × 52 × 12 ≈ 18.7 MB` of morph data alone —
before base geometry, UVs, normals, skin weights, or a single texture, and **more than twice
the entire package budget**. Add normal deltas and it doubles again. The 60,000-triangle cap
is therefore **unreachable in an 8 MB package for a face-driven character**: you will run
out of bytes long before you run out of permitted triangles.

Working the constraint backwards, again **INFERRED**: to keep 52 full-mesh morph targets
under ~3 MB of delta data at 12 bytes/vertex, the blendshape-bearing mesh needs to be on the
order of **4,000–5,000 vertices**. Practical mitigations, none of which I verified as
supported by Effect House:

- **Split the head from the body.** Only the head needs blendshapes; the body can be a
  skinned mesh under the far larger 120,000-triangle cap with no morph payload. This is the
  single biggest lever and it is the reason the per-mesh reading of the 60k cap matters:
  under the whole-effect reading, a split would buy you nothing.
- **Sparse morph targets** — most ARKit shapes move a small subset of vertices. Whether the
  importer preserves sparsity is **UNVERIFIED**.
- **Quantised or Draco-compressed glTF.** Effect House accepts *"FBX, gITF, and OBJ"*
  (VERIFIED); whether it accepts Draco-compressed glTF is **UNVERIFIED** and should be
  tested before being planned around.
- **Fewer targets.** 52 is what TikTok exposes, not what a character must use.

**Texture budget is the other half, and it is tight but tractable.** VERIFIED: textures max
**1024 × 1024 px**, **under 1 MB per file**, square and power-of-two, resized if larger;
recommended 512 × 512. VERIFIED separately: the QA check refuses any image over **1025 KB**
or **1024 × 1024**. So a character with four 1024² maps could consume up to ~4 MB — half the
package — and 512² maps are the realistic default.

**Concretely, against the 1.5–4.3 MB meshes we have:**

- **One** character fits. A 4.3 MB mesh leaves ~3.7 MB for every texture, sound, icon and
  script in the effect; a 1.5 MB mesh leaves ~6.5 MB.
- **Two** 4.3 MB characters do not fit at all (8.6 MB > 8 MB) even with zero textures.
- Two characters are only viable if both are near the 1.5 MB end *and* the texture budget is
  held to roughly 1–2 MB total.

**Second binding constraint, easy to miss:** the **4-second maximum loading time** (VERIFIED,
Effect Guidelines table). It is stated per-device for iOS and Android and is independent of
package size — a 7.9 MB package that decompresses and uploads slowly can fail this while
passing the size check. **INFERRED:** on the low-end Android devices that also drive the
"doesn't work with this device" toast, load time is likely to bind before size does.

**Not binding, on current evidence:** the triangle cap and the bone limit. Both the 60,000
triangles and the 50-vs-100 bones sit far above what an 8 MB package can carry for a
blendshape character, which means **the conflict this document was opened to settle is real,
now settled, and probably not what limits us.** Worth knowing precisely — it removes the
mesh budget from the risk list — but the decision to make is a byte budget, not a triangle
budget.

**INFERRED, recommended next falsifier:** build one deliberately-oversized test character,
export it, and read the actual package size the tool reports (*"In the titlebar, click the
**Click to update** button. The effect size indicator refreshes with the package size."* —
VERIFIED). That measures the importer's real packing efficiency, which is the number every
estimate above depends on and none of them establishes. Do it before committing to a mesh
target.

---

## Sources

All fetched and read 2026-09-09.

| # | URL | Status |
| --- | --- | --- |
| 1 | <https://effecthouse.tiktok.com/learn/guides/getting-started/technical-guidelines/technical-optimization> | read in full |
| 2 | <https://effecthouse.tiktok.com/learn/guides/workspace/assets/asset-preparation/3d> | read in full |
| 3 | <https://effecthouse.tiktok.com/latest/release-notes-latest> | read in full (96 versions, v5.14.0 → 2022) |
| 4 | <https://effecthouse.tiktok.com/learn/guides/getting-started/best-practices/effect-guidelines> | read in full |
| 5 | <https://effecthouse.tiktok.com/learn/guides/support/faqs> | read in full |
| 6 | <https://effecthouse.tiktok.com/learn/guides/publishing/test-effect-performance> | read in full |
| 7 | <https://effecthouse.tiktok.com/learn/guides/publishing/submit-your-effect> | read in full |
| 8 | <https://effecthouse.tiktok.com/learn/guides/publishing/preview-in-effect-house> | read in full |
| 9 | <https://effecthouse.tiktok.com/learn/guides/publishing/preview-in-tiktok> | read in full |
| 10 | <https://effecthouse.tiktok.com/learn/guides/getting-started/introduction-to-effect-house/download-and-login> | read in full |
| 11 | <https://effecthouse.tiktok.com/learn/guides/support/faq-mobile-effect-creation> | read in full |
| 12 | <https://effecthouse.tiktok.com/learn/guides/crash-course/effect-house-101/getting-started-with-effect-house> | read in full |
| 13 | <https://effecthouse.tiktok.com/learn/guides/workspace/components/ar-capability/device-tracker> | read in full |
| 14 | <https://effecthouse.tiktok.com/learn/guides/api-reference/events-input/deviceinfo> | read in full |
| 15 | <https://effecthouse.tiktok.com/learn/sitemap.xml> | 957 doc URLs, used to enumerate candidates |
| 16 | `web.archive.org` capture 2023-06-07 of `/learn/guides/best-practices/technical-optimization/` | read; live URL is **404** |
| 17 | `web.archive.org` captures 2025-08-11, 2026-06-15 of source 1 | read |
| 18 | `web.archive.org` captures 2025-11-08, 2026-06-15 of source 2 | read |
| — | <https://effecthouse.tiktok.com/download> | **302 to site root**; download UI client-rendered, no requirements in HTML |
| — | <https://support.tiktok.com/en/using-tiktok/creating-videos/creating-effects-on-mobile> | **would not load** (SPA, body not in HTML); zero weight |
| — | `web.archive.org` CDX API | intermittently returned `Temporarily Offline`; failed queries carry zero weight |

No community forum was used as a source. The Effect House community forum surfaced in
search results and is **corroboration at best**; nothing in this document rests on it.

## Register summary

**VERIFIED:** the 60,000 per-mesh blendshape triangle cap and its per-mesh scope; the
100-bone current limit and the 50-bone staleness; both conflicting page texts; the absence
of last-updated markers; the 8 MB package cap and 4-second load cap; the "This effect
doesn't work with this device" toast and its four named models; WebGL as the named
mechanism; region variation as content-driven; no account gate beyond a TikTok account;
desktop tool is macOS/Windows with split Mac builds; the QR preview flow; the 30 FPS ceiling;
texture limits.

**INFERRED:** the morph-data byte arithmetic and the head/body split recommendation; that
the 8 MB package (and possibly load time) binds before triangles or bones; that Page A's
tool-linked status explains its misleading authority; that the desktop preview is a weak
compatibility oracle.

**UNVERIFIED:** exact desktop system requirements; per-model vs per-FBX scope of the 100
bones; enforcement point of the caps; per-mesh vs per-submesh triangle counting; any
blendshape-count limit; Draco support; any minimum viewer OS or app version.
