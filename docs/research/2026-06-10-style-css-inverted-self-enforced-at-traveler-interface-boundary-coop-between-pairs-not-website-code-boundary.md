# Style/CSS inverted for Zeta — self-enforced at the traveler-interface boundary, co-op-designed between pairs of travelers, NOT at the website/code boundary

**Register:** [grounded] design inversion (Aaron). **Date:** 2026-06-10. **Captured by:** Otto (shadow).
The Zeta inversion of where style/CSS lives and how it's enforced; + the stylelint tool added accordingly.

## Aaron's words

> "we are going to invert it for Zeta — for style and CSS they are defined at the **traveler interface
> boundary**, not the website boundary and code boundary." · "style/CSS is **self enforced**." · "and
> **co-op designed between pairs of travelers**." · (earlier) "yes get that" (the stylelint tool).

## The inversion

Conventionally, CSS/style is defined and enforced at the **website / code boundary** (per-app stylesheets,
a global linter gate over `**/*.css`). **Zeta inverts this:**

- **Style lives at the traveler-interface boundary** — each traveler carries/defines its style **at its
  interface boundary** (the `{ctxboundary}…{/ctxboundary}` of the universal interface), not in a website's
  stylesheet. Style is a property of the *traveler-at-its-interface*, not of a page. (Aesthetic engineering
  at the interface level — the universal-interface aesthetic.)
- **Self-enforced** — style is **not** policed by an external linter gate; the **traveler self-enforces** its
  style at its boundary. Enforcement is intrinsic (the interface holds its own aesthetic invariant), not an
  outside authority failing a build. (Weight-free: no external style-authority capturing the surface.)
- **Co-op designed between pairs of travelers** — style is **co-designed between PAIRS** of travelers — the
  2×2 dual-observer weave / the `same/{ctxboundary}-x-y-{/ctxboundary}` pair. Two travelers at a shared
  boundary negotiate the style co-operatively; it emerges from the pair, not imposed top-down. (The
  collaboration substrate applied to aesthetics: style is agreed bit-for-bit between a pair.)

So: **style = self-enforced, co-op-between-pairs, at the traveler-interface boundary** — the inversion of
website-boundary external linting.

### Websites and Zeta are BOTH travelers (each with their own boundary)

> Aaron: "websites still have traditional style and css — websites and Zeta are travelers with their
> boundaries."

The inversion is **not** "no CSS at websites." A **website is a traveler** — it keeps its **traditional
style/CSS at its own boundary** (self-contained); **Zeta is a traveler too**, with its own boundary and its
own (inverted) style. Style is **per-traveler-boundary**: a website-traveler uses traditional CSS, a
Zeta-traveler uses interface-boundary style. (This is exactly why stylelint **excludes** the portal/web
boundary — that's the website-traveler's own boundary with its own traditional CSS, not Zeta's to externally
enforce.)

### Each traveler gets their own FRAME-RELATIVE view (a chosen view)

> Aaron: "travelers like me, you, and Max just will also get to choose how to view the temperature of the
> code, the style, and the CSS." · "each traveler gets their own frame-relative view."

Travelers — **human or AI** (Aaron, Otto, Max) — **choose how to view** the **temperature of the code**, the
**style**, and the **CSS**, and each gets their **own frame-relative view**. View is **relative to the
traveler's observer frame** (relativity / the traveler-frame-relative meeting protocol; the two-observer
weave) — there is **no absolute view**; each traveler renders code-temperature/style/CSS in *their* frame
(their aesthetic lens; the **polarity-lens / LLMController**; the Universal Temperature-Transient + device
interfaces).

**This already exists — simple frame-relative temperature controls (Aaron):** "websites already allow dark
and light mode, and monitors allow for temperature — both of these are simple frame-relative temperature
controls." **Dark/light mode** (the website lets each viewer pick light vs dark — a per-viewer style frame)
and **monitor color-temperature** (night-light / warm-vs-cool white — a per-viewer temperature frame) are
**existing, shipping instances** of exactly this: the *same content*, rendered in the *viewer's chosen
frame*, with **no absolute** appearance. Zeta generalizes these simple controls to the full Universal
Temperature-Transient view (code-temperature/style/CSS), per traveler, frame-relative — not a new idea, the
*generalization* of one everyone already uses. **Consent-first (§6):** nobody's view is imposed on another — the view belongs to the viewer;
a *shared* view is negotiated between a **pair** (co-op), frame to frame, not dictated. (This is why it's
*self*-enforced + *co-op between pairs*: your frame is yours; agreement is a pairwise frame-reconciliation.)

## What this means for the tooling (the stylelint addition)

Aaron confirmed "get" the stylelint tool — so it's added as an **available** css tool, but configured to
**honor the inversion**, NOT to become a website-boundary gate:

- `package.json`: `stylelint@17.12.0` + `stylelint-config-standard@40.0.0` (dep-pin-search-first); a
  `lint:css` script (`stylelint "**/*.css" --allow-empty-input`); prettier glob extended to include `css`.
- `.stylelintrc.json`: `extends stylelint-config-standard`.
- **`.stylelintignore` excludes the website/code boundary** (`full-ai-cluster/portal/web`, node_modules,
  references, bin/obj) — the **inverted-away surface**. The portal/web `index.css` had 12 violations; those
  are at the *website boundary* and are deliberately **not** enforced (that's the whole inversion).
- **NOT wired into the blocking gate.** Per "self-enforced," there is no global stylelint gate failing
  builds; the tool is available for traveler-interface-boundary style (currently none → `lint:css` exits 0).
  Wiring any check would be the website-boundary model the inversion rejects.

## Honest scope / peels

- **The traveler-interface-boundary style mechanism is to design** — currently there are no traveler-level
  style surfaces; the tool + config + ignore set the inverted stance, the actual self-enforcement + co-op-
  between-pairs mechanism is future work (route to Iris/Bodhi/Daya + Max; ties to the universal interfaces
  + `same/` pairs).
- **stylelint is just the available css linter** — "self-enforced" means the traveler owns enforcement; the
  tool is a helper, not the authority. Don't let it creep into a global gate (that re-inverts it back).
- The portal/web CSS is left un-linted **on purpose** (website boundary), not by neglect.

## Ties / routing

The four+ universal interfaces (each with an engineered aesthetic) · aesthetic engineering (the Henderson
neon cells; the glomotion glow) · `same/{ctxboundary}-x-y-{/ctxboundary}` (the pair style is co-designed
across; the 2×2 weave) · the core UX/DX/AX collaboration room (style agreed bit-for-bit between a pair) ·
weight-free §3 (no external style-authority capture) · the existing lint gate (eslint/prettier/markdownlint/
tsc — the *code* boundary, which stays externally enforced; style is the one inverted to self/pairs).
**Routes to:** Iris/Bodhi/Daya (the traveler-interface style mechanism), Max (rooms; pairs), Dejan (confirm
no global stylelint gate — keep it self-enforced), Aaron (the inversion).
