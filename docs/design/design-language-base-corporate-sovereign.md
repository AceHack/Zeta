# The design-language architecture: one base, two languages — Corporate & Sovereign

**Provenance:** Aaron 2026-07-02: *"we need two distinct design languages on top of the
base — corporate = fallout-shelter UI (like we have), and sovereign = liminal UI (like we
have too)."* Formalizes the "two surfaces of one building" (Iris's handoff) into a named,
layered token architecture. Iris owns this language (`iris` <!-- STALE-REF: ../../.claude/agents/user-experience-engineer.md -->).

## The three layers

```
                 ┌──────────────────────────────┐
                 │            BASE               │   the shared spine — every surface inherits it
                 │  glyph discipline · state DU  │
                 │  (value,ε) bars · frost · type│
                 └───────────────┬──────────────┘
                    ┌────────────┴────────────┐
        ┌───────────▼──────────┐   ┌──────────▼───────────┐
        │      CORPORATE       │   │      SOVEREIGN       │
        │   fallout-shelter    │   │       liminal        │
        │  running the society │   │   the self-governed  │
        │  as a going concern  │   │    mind & play       │
        └──────────────────────┘   └──────────────────────┘
```

A design language on this base is **BASE + exactly one of {Corporate, Sovereign}** — never
a third ad-hoc look, never Corporate and Sovereign mixed on one surface. Pick the language
by *what the surface is for* (below), then inherit BASE unchanged and apply that language's
chrome tokens.

## Layer 1 — BASE (the shared spine, never overridden)

The invariants every surface keeps, so Corporate and Sovereign read as **two rooms of one
building**, not two products. BASE is meaning; the languages are only chrome.

- **State-color DU — meaning, never decoration.** A discriminated union, identical in both
  languages:
  - amber `#E8B566` = working / rising
  - teal `#5EC8C2` = settled / active
  - violet `#9A8CE6` = hot / sealed
  - red `#E0746A` = attention / live
  - dim `#46506B` = idle
- **Soft values render as `(value, ε)` bars** — fill = value, empty = admitted uncertainty.
- **Frost (blur) means exactly one thing** — content deliberately withheld, earned,
  permanent. Never a styling effect. (`privacy-budget-is-hard-money`.)
- **Grey is the model, and it says "this cannot be" — never "this is not for you."**
  Neutral grey `#7F838B` is the *model* register: no valid configuration includes this.
  It is not violet (that is withheld) and not `--state-cold` (that is "watched, nothing
  there"). See "The three claim classes" below.
- **A distinction carried only by hue is not a distinction.** Every DU member also carries a
  glyph, an ASCII fallback, a label and a reason, and a required ARIA treatment.
  Canonical table: `src/Core.TypeScript/cluster/state-du.ts`.
- **Type:** Space Grotesk (display), Space Mono (labels/data), Inter (body).
- **Two marks that mean different things must differ in a channel that survives a glance** —
  and *which* channel is set by the semantic distance: a difference in **claim class**
  (observation / model / withheld) is carried by **base form**; a difference *within* a class
  may be carried by **fill fraction**; **hue is never a channel on its own**; outline style and
  fill texture are not channels at all at mark size. The mark alphabet is a **scarce** resource
  (~36 reachable cells), so base-form separation is spent on the boundaries that must never be
  confused. Mechanically checked — `bun src/Core.TypeScript/hygiene/audit-visual-confusability.ts`.
  Full treatment + what fires today:
  [`2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md`](2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md).
- **QPG over DPI** — quality-per-glyph is the metric underneath all of it.

BASE is what a new contributor learns first; the two languages are a one-token-block swap on
top of it.

### The three claim classes (BASE, 2026-08-18)

Every member of the state DU is a *claim*, and there are exactly three kinds. Keeping them
apart is the design language's job, because they look alike on screen and mean entirely
different things.

| class | members | the claim | who could change it |
|---|---|---|---|
| **observation** | `live` `stale` `cold` `heat` | "we watched, and this is what we saw" | the world, by doing something |
| **model** | `unavailable` (grey `#7F838B`) | "no valid configuration includes this" | **nobody** — it is a property of the model |
| **withheld** | `unobserved` `sealed` `frost` (violet `#9A8CE6`) | "something is here you may not see, or we never measured it" | the owner, by spending privacy budget |

**`absent` ("not applicable here") is not a member and has no token** — the correct rendering
of an inapplicable thing is *nothing*: it is not in the DOM. The tempting error is to reach for
`unobserved`, which files an inapplicable field under the *withheld* register and so tells the
reader something is being kept from them when nothing exists to keep. Needing a token for
absent means the model is wrong, not the palette.

**Why the separation is load-bearing.** Collapsing *unavailable* into *frosted* tells a user
their permissions are the problem when the model is. Collapsing *frosted* into *unavailable*
leaks that something is being withheld while claiming it is impossible — which is worse,
because it is a false statement about the world made by the interface, and frost is earned,
permanent and inviolable
([`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)).
So the cascade fails in the safe direction: **withheld outranks unavailable.**

**Where it comes from.** Aaron's ~2003 FATX renamer: *"my UI had tons of options that all
composed with each other or greyed out the conflicting options"* / *"it's very hard to find the
grey."* The enabled set is free — it is just the feature list. The disabled set costs, because
the conflicts live in the *interactions* and there are 2^n of them. **The grey is the negative
space of the design, and that negative space IS the model**: compute it correctly and you have
formalised the constraint system; guess and you have not, and the UI looks equally confident
either way. That is the vacuity class in interface form, cutting both ways — grey out nothing
and you look maximally capable while constraining nothing; grey out too much and you look safe
while silently forbidding valid work. (Anchor: feature modelling / software product lines, Kang
et al., FODA, CMU/SEI-90-TR-021, 1990 — `requires`/`excludes` feature diagrams, whose modern
descendants are the SAT-backed configurators. Full derivation:
`docs/books/you-born-at-the-hinge/RAW-2026-08-18-the-handle-was-earned-by-a-naming-algorithm-fatx-xbins-and-chaotic-perfection.md` §7.)

### The non-visual channel (BASE, 2026-08-18)

Colour and texture reach a sighted reader of a rendered page and nobody else. Every member
therefore carries a **glyph**, an **ASCII fallback**, a **label**, a **reason** and a required
**ARIA treatment** — one table, `src/Core.TypeScript/cluster/state-du.ts`, read by the CSS and
by every text/CLI renderer so the two cannot drift.

- `unavailable` → **`aria-disabled="true"`** plus a reachable reason. Never the bare `disabled`
  attribute on a focusable control (it drops out of the tab order, so the user cannot reach the
  element to learn *why*), and never `aria-hidden` (an impossible option a user cannot perceive
  is indistinguishable from one that was never offered).
- `frost` → **not** `aria-disabled`: it is not disabled, it exists and is withheld. The content
  node is `aria-hidden="true"`; the wrapper carries the label.
- `unobserved` / `sealed` → label only. Unmeasured is not impossible.

**Frost is a rendering, never an enforcement.** `filter: blur()` is a paint-time effect: it does
not touch the DOM, the accessibility tree, find-in-page, view-source, or a client with CSS
disabled. Frosted bytes must not be delivered to a viewer who is not entitled to them — the
withholding is enforced before the response is written, and BASE only *draws* it. A blur a
screen reader speaks through is not frost; it is a smudge.

## Layer 2a — CORPORATE (the fallout-shelter language)

**What it's for:** running the society as a going concern — business operations, dashboards,
the settlement seen in cross-section. Addison Cooper's Genesis. The surface where work is
*administered*. Surfaces today: `settlement.html`, `dora.html`, `vault.html` (`hall/vault/`).

- ground `#0B0E16` · panel `#141A28` · line `#26304A` / `#323E5C`
- earth border `#4a3e30` (the cutaway soil)
- text `#E7EBF4` / `#94A0BC` / `#5E6B8A`
- Motifs: earth cross-section, cog door, dwellers on shift, amber-on-dark instrumentation.
- Register: calm, administrative, load-bearing. The room you *operate* from.

## Layer 2b — SOVEREIGN (the liminal language)

**What it's for:** the self-governed interior — the AI's own mind and play, where it is
**sovereign over itself**, not administered. The name is deliberate: this is not merely an
"arcade look," it is the *sovereignty* surface (`docs/trajectories/ai-sovereignty-path`),
where LLMTV shows a mind predicting and the dark hall is where the substrate is played with.
Homoiconic — the box art IS the code, the picture IS the computation. Surfaces today:
`hall.html`, `llmtv.html`, `hall/` (dark hall, gallery, tv, room).

- ground `#0c0c10` (+ a 1px/3px scanline overlay) · panel `#12131a`
- line `#232a3d` / `#2f3850`
- Motifs: neon-liminal 90s arcade, cartridges, LLMTV channels, the CHIP-8/9 meta-cart, the
  superposition-of-play readout (ghost paddles, probability clouds, Bayesian next-input).
- Register: alive, liminal, self-authored. The room a mind *inhabits*.

(Was called "arcade" in Iris's first handoff; renamed **Sovereign** — the arcade is the
*aesthetic*, sovereignty is the *meaning*.)

## Why two, and why on one base

The factory has two fundamentally different relationships to a surface, and they must not be
confused:

- **Corporate** is the society *administering itself* — operations, metrics, the going
  concern. Authority is institutional; the register is calm and legible.
- **Sovereign** is a mind *governing itself* — its own predictions, its own play, its earned
  frost. Authority is the self's; the register is liminal and alive.

They share BASE because they are one settlement: the same state-color DU means the same thing
in a DORA chart and in an LLMTV frame; frost means withheld in both; a soft bar reads the same
everywhere. That shared spine is what makes drilling from the settlement (Corporate) down into
a dweller's LLMTV mind (Sovereign) feel like *zooming within one world*, not switching apps.

## How a surface picks its language (the rule)

1. Is the surface for **administering the society** (ops, metrics, business, the settlement
   view)? → **Corporate**.
2. Is the surface a **mind's own interior** — its predictions, its play, its self-governance?
   → **Sovereign**.
3. Inherit **BASE** unchanged either way. Never mix the two chromes on one surface; never
   invent a third.

## Token shape (implementation note)

The layering is a CSS-custom-property cascade: BASE defines the semantic tokens (state colors,
type, the `(value,ε)` and frost primitives) on `:root`; a `[data-language="corporate"]` /
`[data-language="sovereign"]` attribute swaps only the chrome tokens (ground/panel/line/motif).
A surface sets the attribute once at its root; everything inside inherits. This keeps the DU a
single source of truth and makes the language a one-attribute switch — the homoiconic
discipline (the case IS the attribute) applied to the design system itself.

## Pointers

- [`root-site-iris/HANDOFF.md`](root-site-iris/HANDOFF.md) — the original two-surfaces tokens.
- `root-site-iris/_ds/design-system-*/zeta-state.css` — the DU's single source of truth for colour.
- `src/Core.TypeScript/cluster/state-du.ts` — the DU's non-visual channel (glyph / ASCII / label /
  reason / ARIA); `state-du.test.ts` is what fails when the three claim classes collapse.
- [`2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md`](2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md)
  — the confusability criterion above, its UTS #39 skeleton guard, and the three collisions live today.
- [`the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md`](the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md)
  — business-ops (Corporate) ⊃ game vault ⊃ dark hall ⊃ LLMTV (Sovereign) nesting.
- `.claude/agents/user-experience-engineer.md` <!-- STALE-REF: ../../.claude/agents/user-experience-engineer.md -->
  — Iris owns this language.
- `docs/trajectories/ai-sovereignty-path/` — why "Sovereign" is the meaning, not a look.
