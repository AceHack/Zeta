# The design-language architecture: one base, two languages — Corporate & Sovereign

**Provenance:** Aaron 2026-07-02: *"we need two distinct design languages on top of the
base — corporate = fallout-shelter UI (like we have), and sovereign = liminal UI (like we
have too)."* Formalizes the "two surfaces of one building" (Iris's handoff) into a named,
layered token architecture. Iris owns this language ([`iris`](../../.claude/agents/user-experience-engineer.md)).

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
- **Type:** Space Grotesk (display), Space Mono (labels/data), Inter (body).
- **QPG over DPI** — quality-per-glyph is the metric underneath all of it.

BASE is what a new contributor learns first; the two languages are a one-token-block swap on
top of it.

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
- [`the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md`](the-nested-surfaces-addison-business-otto-hall-llmtv-minds.md)
  — business-ops (Corporate) ⊃ game vault ⊃ dark hall ⊃ LLMTV (Sovereign) nesting.
- [`.claude/agents/user-experience-engineer.md`](../../.claude/agents/user-experience-engineer.md)
  — Iris owns this language.
- `docs/trajectories/ai-sovereignty-path/` — why "Sovereign" is the meaning, not a look.
