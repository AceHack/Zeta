---
name: SVG preferred for image assets — vector is source-of-truth; raster format decided at UI-time per end-user browsing context
description: Aaron 2026-04-22 after social-preview PNG landing — "svg is my preference becasue it's vector based thats really my preference, also you can decide when we get to the UI what is the best for end users tjat browse our website and the images types we should use". SVG is source-of-truth because (a) vector scales without quality loss, (b) text diff cleanly in review, (c) tiny file size (our 1280x640 social-preview.svg = 4K vs 44K PNG), (d) single authoring surface survives font/resolution changes. Raster (PNG/JPG/WebP/AVIF) chosen at UI-time based on end-user-browser-context (retina, mobile, dark-mode, platform-constraints like GitHub's PNG/JPG/GIF-only social-preview uploader). Don't pre-optimize for formats that may not be what we want when the UI ships.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** For any image asset the factory authors, default to
**SVG as the source-of-truth**. Rasterize to PNG/JPG/WebP/AVIF
only when a specific surface forces a non-vector format (e.g.
GitHub social-preview, favicons below certain sizes). Defer
the raster-format decision to UI-time when we know the actual
end-user browsing context.

**Why:** Aaron 2026-04-22, verbatim:

> "svg is my preference becasue it's vector based thats really
> my preference, also you can decide when we get to the UI what
> is the best for end users tjat browse our website and the
> images types we should use"

and prior in the same sequence (the constraint that triggered
the SVG switch):

> "tight with them, no larger and higher quallity than they
> need to be svg prefered"

Context: Agent first shipped a PIL/Python-generated PNG for the
Zeta social-preview (1280x640, 28KB). When Aaron saw the file,
he reaffirmed that SVG is his preference — explicitly naming
the reason as vector-based scaling. Two orthogonal benefits he
called out:

1. **Vector-source-of-truth.** SVG is text; diffs cleanly;
   lossless-to-resize; one authoring surface regardless of
   future resolution targets (retina, 4K, print).
2. **Raster-choice deferred to UI-time.** The *consumption*
   context determines the raster format (WebP for web,
   PNG for GitHub UI, AVIF for high-res, JPG for legacy).
   Pre-committing to a raster format at author-time is
   premature optimization against unknown UI constraints.

**How to apply:**

1. **Default: SVG.** Every new image asset (logos, diagrams,
   icons, OG cards, illustrations) is authored as SVG first.
   Committed to `docs/assets/` (or appropriate location) as
   the `.svg` file. Keep the SVG small — no embedded base64
   raster blobs unless genuinely necessary.

2. **Rasterize only when forced.** The surface eating the
   image decides the raster format. Known forcing surfaces:

   - **GitHub social-preview upload**: PNG/JPG/GIF, 1MB max,
     1280x640 recommended. UI-only surface (no REST).
     Rasterize with `rsvg-convert -w 1280 -h 640 X.svg -o X.png`.
   - **Favicons**: .ico or .png below 32x32; SVG favicon
     partially supported (depends on browser-matrix at UI-time).
   - **Email (newsletters, release notes)**: PNG for broad
     client support.
   - **Open Graph meta-tags** (`og:image`): PNG/JPG.

3. **Keep the raster alongside the SVG.** When forced, commit
   both the `.svg` source and the `.png` (or chosen raster)
   derived artifact. Document the rasterization command in the
   SVG's header comment so regeneration is trivial:

   ```xml
   <!--
     PNG at social-preview.png is generated via
     `rsvg-convert -w 1280 -h 640 social-preview.svg -o social-preview.png`
     because GitHub's social-preview upload accepts PNG/JPG/GIF only.
   -->
   ```

4. **Size discipline still applies.** Aaron's prior sentence
   ("no larger and higher quallity than they need to be") is
   not superseded by the SVG preference — it compounds. SVG
   keeps source small; raster output must still be optimized
   for the destination (no 4K PNGs where GitHub will down-scale
   to 1280x640 anyway).

5. **UI-time decisions.** When we reach the website / docs-
   portal / newsletter ship, revisit each raster artifact and
   pick the **optimal** format for that consumption context
   (WebP with PNG fallback is typical 2026-era default; AVIF
   for high-res heroes). Don't pre-ship raster variants we
   don't have end-user-context for.

6. **Rasterizer toolchain.** `rsvg-convert` (librsvg) is the
   portable SVG->PNG converter. Available via `brew install
   librsvg` on macOS, `apt-get install librsvg2-bin` on
   Debian/Ubuntu, `choco install rsvg-convert` on Windows. No
   PIL/Python dependency needed once SVG is the source.

**What this rule does NOT mean:**

- SVG is not forbidden from containing binary fallbacks (e.g.
  a small raster embedded as base64 inside the SVG for a
  photographic element). But the *authoring* must stay in SVG.
- Not all existing raster assets need migration. Apply the
  rule on new-authoring and on-touch; don't kick off a
  conversion sweep.
- Photography and screenshots are inherently raster — the rule
  is for *authored graphics* (logos, OG cards, diagrams,
  icons), not captures.

**Cross-reference:**

- `memory/feedback_declarative_all_dependencies_manifest_boundary.md`
  — same shape: authoring surface differs from consumption
  surface; keep both coherent.
- `memory/feedback_crystallize_everything_lossless_compression_except_memory.md`
  — SVG text-source embodies lossless-compression of intent;
  PNG raster is the "deliver" step.
- `memory/feedback_surface_map_consultation_before_guessing_urls.md`
  — complementary: social-preview upload is a UI-only surface;
  must be mapped as such, not guessed-at as an API call.

**Artifacts this rule creates:**

- `docs/assets/social-preview.svg` — Zeta social-preview
  source-of-truth (first instance).
- `docs/research/github-surface-map-complete-2026-04-22.md`
  UI-only surfaces table — adds repository social-preview
  upload entry noting the SVG->PNG rasterization path.
- (Future) `docs/assets/README.md` — asset authoring
  conventions: SVG-first, document rasterization command in
  header comment, keep both source and raster committed when
  forced.

**Source:** Aaron direct message 2026-04-22 during round-44
speculative drain, immediately after PNG-only social-preview
landed.
