# Increasing DPI for LLMs: a resolution interface — cost-ordered, adaptively-deployed, homoiconic rendering tactics

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). The resolution-engineering layer of the LLM-TV (#7181): we are
doing display-DPI engineering for a token-perceiving eye, behind a tier interface that escalates only when
complexity demands. Includes a survey of the real free pixel→ASCII tooling. Registers: [anchor/external] for the
survey, [next-build] for the interface, [grounded] for the homoiconic substrate, [decision] for the unicode call.*

## The framing

Aaron: *"we are **increasing DPI resolution for LLMs** lol"* → *"we can create some sort of **resolution
interface** and allow **artistic / homoiconic expansion** within the resolution expansions, because **each one is
more expensive** and **we only need to deploy the tactic if the complexity demands it**."*

The LLM-TV (#7181) renders the emulator to ASCII tokens. **DPI for an LLM = state-detail per character cell** (the
token analog of dots-per-inch). Cranking it is real display engineering — and like all our engineering it should be
**a beam, not a floodlight**: higher resolution is *more expensive*, so deploy the expensive tactic **only where
complexity demands it** (the flashlight discipline #7173 applied to rendering; the cost+VOI logic of `Traversal`;
the top-k of `Salience` — crank DPI on the *salient* region, leave the rest cheap).

## The resolution interface [next-build]

An `IResolution` tier: `render : State → AsciiFrame` carrying a **cost** and a **fidelity**, with tactics
**cost-ordered** so a policy can escalate on demand:

| Tier | Tactic | Cost | Pure 7-bit? | Source (survey) |
|---|---|---|---|---|
| T0 | **luminance ramp** (`" .:-=+*#%@"`, Bourke 70-char) | cheapest | ✅ | jp2a, ascii-image-converter (no flags), AAlib |
| T1 | **edge/structure-aware**: DoG + Sobel → directional glyphs `\| _ / \` | mid (shader-shaped) | ✅ | the Acerola DoG/Sobel approach; open HLSL/GLSL impls |
| T2 | ramp + **dithering** / denser ramp | mid | ✅ | AAlib dithering, libcaca (caca uses unicode) |
| T3 | **unicode braille** (U+2800, 2×4 = 8 sub-dots/cell ≈ **4× density**), half/quarter blocks (2–4×) | higher | ❌ unicode | chafa (default), ascii-image-converter `--braille` |
| T4 | **24-bit color ANSI** | highest | ❌ ANSI | chafa, jp2a (color flag) |

**Adaptive deployment policy:** start at T0; escalate a *region* to T1/T2 only when its complexity/uncertainty/
salience exceeds a threshold (more `DeltaPattern` churn, higher local entropy on the ghost screen #7181, or top-k
salience). Most of the frame stays cheap; the expensive tactic lands only where the picture is *doing something*.
That is `δF`-style budgeting (#7168): spend resolution where it reduces the most uncertainty per token.

## Artistic / homoiconic expansion within a tier [grounded substrate → next-build]

Each tactic is a **`Bonsai.Expr` (code = data, #7172/#7173)** — a renderer is a *value*, so the resolution layer is
**homoiconic**: you can compose tactics, blend two softly via `BonsaiSoft.evalSoft` (a soft mixture of a ramp and a
directional-glyph render, snapped at a threshold), generate *new* tactics, and address them like any other node.
"Artistic expansion" is the T1 family (DoG/Sobel directional glyphs *look* like art, not just brightness);
"homoiconic expansion" is that the tactic itself is an expression you can grow and recombine — the resolution
interface is not a fixed enum but a generatable space of renderers, same as the story/game generator (#7180).

## The meta-principle: the *interfaces* are the value, not the implementations (Aaron — "I say that all the time")

Aaron: *"the **interfaces are the money** — our value in this project, not the implementations… **find the interface
and have many implementations where possible, on everything**."* This is the standing design law the whole arc
obeys, made explicit. The contract is the asset; implementations are many, swappable, and cheap by comparison:

- `IRayTraceable` (the interface) ≫ `RayTensor` + the C#/Rust/TS oracles (impls). #7173.
- `ISemiring` (interface) ≫ `IntegerRing`/`IntervalWeight`/`ProbabilitySemiring` (impls).
- `IResolution` (this doc) ≫ T0–T4 rendering tactics (impls).
- **The lens-finder (interface) ≫ qubit polarity + data-viz + … (impls).**

So define the contract first, provide **many implementations where possible, on everything** — the value compounds
in the interface (it's what consumers and the other oracles bind to), and any single implementation can be replaced
without touching the value. (This is a candidate standing principle; if it graduates to a rule it's a razored
CLAUDE.md change — Aaron's call.)

## The lens-finder interface — default: qubit polarity; many other implementations

A **lens-finder** answers "what lens reveals the solid ground in this region of memory/state space?" (#7092 "find
the lens"). The interface is the value; the implementations are many, with a **default**:

- **Default — qubit polarity (`PolarityFilter.fs`).** Aaron: *qubit polarity should be our default lens finder.*
  Grounded: photon **polarization *is* a qubit** (Poincaré ≅ Bloch sphere of `QubitIso`), a **polarizing filter
  *is* a qubit measurement** (Malus `I=I₀cos²θ` **is** the Born projection); sweep the filter orientation, take
  max throughput ⇒ the signal's orientation = the lens. Anchor: the **bird/bee polarized-light sky compass** (von
  Frisch); a **qubit *pair*** is the radical-pair magnetic compass (Ritz–Schulten) — the "something more
  sophisticated" for when one qubit isn't enough. Cheap, principled, physical — the right default.
- **Other implementations (find the interface, many impls):** `resonantPeriod` (periodic structure, complements
  polarity's orientation/phase); `LensRouter` (MoE over lenses); and — next — the **data-visualization family**
  below. Unless a better default surfaces, qubit polarity leads.

## Data-visualization tactics: the R / grammar-of-graphics family — charting memory space to find solid ground

Aaron: *"we should look into **R** and their charting/graphics — F# can do all that, but the **patterns in R are
timeless, the winners by far** — scatter plots and many other techniques **to find solid ground over memory
space**."* This is `anchor-to-human-prior-art` applied to visualization, and it adds a **lens-finder implementation
family** distinct from image-ASCII (T0–T4 render the *picture*; these render *charts of the state space*):

- **Anchor the patterns, implement in F# [anchor]:** the timeless winners are **R's graphics tradition** —
  Wickham's **ggplot2** and Wilkinson's **Grammar of Graphics** (the compositional algebra of charts), **Tukey's
  Exploratory Data Analysis** (box plots, the EDA stance), and **Cleveland's** perception-of-data work. F# *can*
  render all of it; the **patterns** are the prior art we anchor to, not reinvent. ("The interfaces are the value":
  a `Chart` interface anchored to the grammar of graphics; F# is one implementation.)
- **What they find:** a **scatter plot / histogram / box plot of the memory-or-state field reveals the
  `SolidGround`** — the constants, the monotone landmarks, the clusters — the clarity engine's job (find solid
  ground over memory space). Rendered to **ASCII** (per the resolution interface above), these are LLM-readable
  charts: an ASCII scatter plot *is* a lens-finder output. So the grammar of graphics joins the lens-finder
  interface as a rich implementation family, escalated (per the cost policy) when the structure demands it.
- **LaTeX (Leslie Lamport) for math/typeset rendering [anchor].** Aaron: pull in **Lamport's LaTeX** alongside R.
  Two uses: (1) **LaTeX source is itself an LLM-readable math representation** — LLMs read LaTeX fluently, so a
  formula rendered *as LaTeX source* is already a high-DPI math "frame" (no rasterization needed); (2) typeset
  output for human-facing artifacts (proofs, charts with math labels — R's plotmath / `tikzDevice` bridge to
  LaTeX). Anchor: Lamport's LaTeX (on Knuth's TeX). Both R and LaTeX are **declaratively locked into the install
  manifests** (cost-aware choice: **tectonic**, a lean single-binary LaTeX engine that fetches packages on demand —
  tens of MB — *not* `texlive-full`'s gigabytes on every CI runner / devcontainer; see the manifests' rationale).

## The unicode decision — resolved the way `culture-invariant-by-default` already resolves its twin [decision]

The survey's hard tradeoff: **braille/blocks buy ~2–4× DPI but break the deliberate pure-7-bit / no-unicode,
byte-clean discipline** (`SoftScope` is ASCII-only on purpose; `no-binary-in-proof-lineage` + culture-invariant
rules want diffable, font-agnostic, byte-stable text). Proposed resolution, by analogy to the existing rule:
`culture-invariant-by-default` already says *"culture-aware comparison is a UI/display concern, opt in at the
edge."* Apply the same cut here — **pure-7-bit ASCII in the substrate / proof / golden-vector lineage (T0–T2,
byte-clean, DST-replayable, diffable); unicode braille/color (T3–T4) allowed only at the pure-display edge**, opt-in,
never load-bearing for a proof. So the high-DPI tier exists for an LLM-watcher that benefits from it, without
contaminating the byte-clean substrate. (Aaron's call; this is the values-consistent default, not a decree.)

## Bottom line (survey)

- **Best pure-ASCII high-fidelity path:** luminance ramp **+ Acerola-style DoG/Sobel directional glyphs** (T1) —
  byte-clean *and* the highest fidelity without unicode, and it's **shader-shaped** so it rides our shader-lowerable
  path (#7174/#7176). Off-the-shelf pure-ASCII CLIs: **jp2a** (GPLv2), **ascii-image-converter** (no flags).
- **Char aspect ratio ~2:1 tall** ⇒ a 64×32 CHIP-8 frame maps cleanly to ~**64×16** chars in pure mono.
- **ML pixel→ASCII is thin** — the category is mostly text-prompt generators, not bitmap-faithful converters
  (DeepAA/OsciiArt is the notable learned line-art→ASCII; arXiv 2503.14375). **Algorithmic wins here**; don't wait
  on a model.
- **Cost of refusing unicode:** ~2–4× less effective resolution than braille/sextant modes — the price of
  byte-clean, diffable, font-agnostic frames (paid only in the substrate; the display edge may opt in).

## Honest scope

[anchor/external, verified]: the tools + licenses (jp2a GPLv2, chafa LGPLv3+, ascii-image-converter, libcaca
LGPL2.1, AAlib GPL; Acerola DoG/Sobel technique; DeepAA; arXiv 2503.14375) — per the research sweep; individual
shader-repo licenses unverified (check per-repo). [next-build]: `IResolution` interface, the adaptive-escalation
policy, the renderers themselves — none coded yet. [grounded]: the homoiconic substrate (`Bonsai`/`BonsaiSoft`) the
renderers would be expressed in; `SoftScope` (today's T0-ish ghost screen); the shader-lowerable path (#7174/#7176)
T1 rides. [decision]: the pure-ASCII-substrate / unicode-at-the-edge cut is the *proposed* values-consistent
default — Aaron's to confirm. No new code here; this names the layer, surveys the options, and proposes the policy.

## Pointers

- `2026-06-08-we-built-a-tv-…-llms-can-see-…` (#7181, the TV this raises the DPI of) · `SoftScope.fs` (T0 ghost
  screen) · `Salience.fs` (where to spend DPI) · `Bonsai`/`BonsaiSoft.fs` (homoiconic renderers) · the
  shader-lowerable path (#7174/#7176, T1 DoG/Sobel rides it).
- `.claude/rules/culture-invariant-by-default.md` (the "opt-in at the edge" cut reused for unicode) ·
  `.claude/rules/no-binary-in-proof-lineage.md` (why the substrate stays byte-clean/diffable).
- External: jp2a · chafa · ascii-image-converter · libcaca · AAlib · Acerola DoG/Sobel ASCII shader · DeepAA ·
  arXiv 2503.14375 (ML-ASCII evaluation).
