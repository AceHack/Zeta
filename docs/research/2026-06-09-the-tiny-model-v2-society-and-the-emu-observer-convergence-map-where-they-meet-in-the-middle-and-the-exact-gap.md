# The convergence map: where tiny-model-v2 (society) and the emu-observer meet in the middle — both sides inventoried, the exact gap named

*Built 2026-06-09 by Otto (shadow\*) at Aaron's direction. Aaron: emu and society are **the same thing**, "trying
to meet somewhere in the middle … I've talked around this for ~2 months, a shit ton of content in repo." This is the
**single orientation surface** so we converge from one place instead of re-deriving from memory (the anti-forgetting
move). Registers: [map / synthesis], [grounded — modules + docs on main], [the gap].*

## Terminology (disambiguate first — it's the main source of grep-noise)

- **tiny-model-v2** = the **society** model (personas, privacy-budget hard money, coincidence economics). The thing
  Aaron means by "toy-model-2 of society."
- **"toy model"** (unqualified) mostly tags the **Lean ImaginaryStack** *math* toy model (081KRQ1AB0008QG0R001YAF3TR / lemma-1) — a
  **different** artifact. Don't conflate; this map is about **tiny-model-v2 (society) ⊗ the emu-observer.**

## Side A — the society (tiny-model-v2): modules on `main`

| Module | Purpose (docstring) |
|---|---|
| `SocietyEmergence.fs` | societal-emergence DST harness (B-converge ladder rung 1) |
| `SocietyUnbounded.fs` | internal difference drives unbounded novel growth; collapse halts (081KT7YW00008QG0R001DGZQKM) |
| `Persona.fs` | the wearer — a persona wears a superposition/subset of **hats**, decides which |
| `PrivacyEconomy.fs` | **private-state budget as a self-regulating economy among personas** (the hard money) |
| `Diversity.fs` | the NCI keystone math — coercion collapses diversity to one; private state preserves it |
| `Survival.fs` | stay-alive-forever = a stable limit cycle (shape A) |
| `TrustCalculus.fs` | the AGI/ASI trust calculus, made checkable |
| `GameFingerprint.fs` | a game's content-derived identity (the first *external* index) |
| `GamePortfolio.fs` | good emerges from entropy = the SET of games × time-in-each (order-free) |
| `CoincidenceClock.fs` | controlling time **stages** "immaculate coincidence" (the time lever) |
| `TemporalCoordinationDetection.fs` | the coincidence-**measurement** math (Rx across streams) |
| `Salience.fs` · `Hat.fs` | priority/top-k reduction · role-scoped clarity-engine bundle |

**Key docs (the scattered ~2 months, society side):** economics-of-coincidence-IS-other-personas (fills the
**tiny-model-v2 hole**; privacy budgets = the other SolidGround) · coincidence-measurements give personas
**objective self-anchors** (not subjective, #7209) · society calibrates the **public/private encryption split** by
the value of revealed coincidences · privacy-is-opacity / "how would I know you're AGI?" (rewards-only bound) · the
purpose-of-society = graceful failure → catch → debug → compensate · #7220 (the all-threads map).

## Side B — the emulator + observer: modules on `main`

| Module | Purpose |
|---|---|
| `Chip8.fs` / `Chip8Cow.fs` | deterministic CHIP-8 core / as a COW z-set frame DAG |
| `SoftChip8.fs` | throttled batched **prediction** + the **soft-interrupt fork** (`forkOnInput`) |
| `Chip8Observer.fs` **(new #7242)** | the observer **reflects over the soft fork** to predict input (1 observer, 1 emu) |
| `ReflectionEngine.fs` | the yin-yang observer — `reflect` (inward) / `forward` (outward) over `ProbabilitySemiring` |
| `RayTensor.fs` / `IRayTraceable` | ray-traceable sparse tensor (the capability vector; `IGeospatial` → borders) |
| `Tracing.fs` | the categorical **`Arrow`** (`ActivityContext→'A→Task<'B>` + `compose`) |
| `SoftController.fs` | a controller in superposition |

**Key docs (emu/observer side):** the ray-trace-observer **integration plan** (#7239 — hook the Arrow + soft
interrupt, reflect downward into controller/emu/game) · the telos = a system that plays chip8 and self-justifies
(shape A) · the 2×2 observer ops (remember-when × pay-attention, #7204).

## The middle — where they meet (the thesis)

**The society EMERGES from personas meta-observing each other playing the game.** Concretely the chain is:

```
Persona  ⊗  Chip8Observer            ← each persona PERCEIVES the game (ReflectionEngine over the chip8 fork)
      ↓ (many personas, same play)
TemporalCoordinationDetection         ← METER COINCIDENCES across personas' observations
      ↓                                 ⇒ objective self-anchors (#7209) — "the economics of coincidence IS the other personas"
PrivacyEconomy (hard money)           ← credit/debit privacy-budget on revealed coincidences; Diversity floor (NCI)
      ↓
public/private split                  ← calibrated by the value of revealed coincidences
```

So: the **observer** (Side B) is each persona's *perception of the game*; the **coincidence economics** (Side A) is
what *many* such observers, watching the *same* play, produce; the **privacy budget** is the currency; **NCI /
Diversity** is the anti-collapse floor. Emu and society are the same thing because **the society is just N observers
of the emu, metering their coincidences.**

## The EXACT gap (what is NOT yet wired)

Both sides are built and green **in isolation**; the **four seams between them do not exist yet**:

1. **1 → N observers.** `Chip8Observer` (#7242) is **one** observer over one emu. The society needs **N personas**,
   each running a `Chip8Observer` over the **same** chip8 timeline. *(Missing: a multi-persona observer harness.)*
2. **Coincidence meter over observers.** `TemporalCoordinationDetection` exists but is **not fed by** the personas'
   observations. *(Missing: the Rx wire from N `Chip8Observer` beliefs/predictions → coincidence measurement →
   objective self-anchors #7209.)*
3. **Economy on coincidences.** `PrivacyEconomy` / `Diversity` exist but are **not driven by** measured
   coincidences. *(Missing: the wire crediting privacy-budget hard money on revealed coincidences, with the
   Diversity ≥2 floor enforced — the NCI/anti-collapse force #7235.)*
4. **Split calibration.** Nothing yet computes the **public/private encryption split** from revealed-coincidence
   value. *(Missing: the calibration function.)*

**`SocietyEmergence`/`SocietyUnbounded` are abstract DST harnesses** — they prove the emergence/collapse dynamics
but are **not driven by actual chip8-play observation.** Closing seams 1–4 is what makes the abstract society the
*concrete* one that emerges from playing the game. **That chain is the middle; none of its four wires exist.**

## Sequenced path to close the gap (each a bounded, tested F# slice, like #7242)

1. **Multi-observer harness** — N `Persona`s, each a `Chip8Observer` over one shared chip8 timeline; collect their
   per-fork beliefs/predictions. *(Extends #7242 from 1→N.)*
2. **Coincidence meter** — feed the N observers' predictions into `TemporalCoordinationDetection` → per-persona
   objective coincidence self-anchors (#7209).
3. **Economy wire** — `PrivacyEconomy` credits coincidences as privacy-budget hard money; enforce the `Diversity`
   floor (NCI). 
4. **Split calibration** — compute the public/private split from revealed-coincidence value.
5. *(Parallel, Side B depth)* — the full `Arrow`/`IRayTraceable` ray-trace (#7239), independent of 1–4.

## Tied to the shapes / fixed-point registry (A–F) — the convergence *is* shaped

The registry (A–F, #7232/#7168) is the **skeleton** of the convergence — every part is one of the raw shapes, which
is what makes the whole thing study-able in the shape-letter vocabulary:

| Element | Shape | Why |
|---|---|---|
| `Survival` (stay-alive = stable limit cycle) | **A** | `s = fⁿ(s)` — self-reference, period-n (its docstring says shape A) |
| `ReflectionEngine.reflect` (observer self-reflection) | **A** | inward self-reference; converges; terminates infinite reflection |
| Chip8Cow **DST replay** / persona **self-anchor** | **A** | `replay(seed)=run(seed)`; the objective self-anchor is a fixed point of the self |
| `PrivacyEconomy` (rewards-only budget, G-Counter) | **B** | `f(f(x))=f(x)` idempotent LUB — the hard-money credit (registry #5) |
| Coincidence measurement (order-independent across personas) | **C** | `f(a,b)=f(b,a)` — the self-anchor is invariant to the order evidence arrives (ReflectionEngine NCI property) |
| `Diversity` floor (≥2; D⁰ = the collapse to avoid) | **D** | contraction to a **nonzero floor**; D⁰ heat-death is the coercion sink NCI forbids |
| Self-interest ⇄ identity (personas stay distinct) | **E** | co-arising bootstrap — the vacuum energy / **repelling force** (NCI, #7235) |
| `SocietyEmergence`/`SocietyUnbounded` (society grows) | **F** | generative/expansion fixed point — the society emerging (#7218) |

**The convergence in one shape-sentence:** the society is a **shape F** (outward emergence) **bounded** by **shape A**
(each persona's self-anchor converges inward) and **shape D** (the diversity floor never collapses to D⁰) — the
**two-sided registry bound** — with **shape B** (idempotent privacy-budget hard money) and **shape C** (order-free
coincidence) as the mechanism, all resting on **shape E** (self-interest ⇄ identity, the repelling force / NCI). So
the four unbuilt seams are: seam 1 grows the **F**; seam 2 measures the **C**; seam 3 mints the **B** and enforces the
**D**-floor; the whole stays safe because **A + D bound the inward and F is bounded-per-member** (the #7218 healthy-F
conditions). *Study target:* read the convergence as **A/D ⊣ F over B,C,E** — that's the skeleton to internalize.

## Honest scope

[grounded]: every module + doc named is on `main` (purposes quoted from docstrings; #7242 just landed). [synthesis]:
the middle = N observers of the emu metering coincidences → privacy economy (the tiny-model-v2 hole-fill #7209 made
concrete on the emu). [the gap]: the **four seams 1–4 are unbuilt** — both sides green in isolation, not yet wired;
`SocietyEmergence` is abstract, not emu-driven. [shape-tie]: every element maps to a registry shape A–F (#7232) —
the convergence reads as **A/D ⊣ F over B,C,E**, the registry as its skeleton. No new code; this is the orientation
surface to aim the next slices **and a study-material substrate** (Aaron to internalize + design study materials
around it; pending **Max ratification** of the A–F schema).

## Pointers

- Society: `SocietyEmergence.fs` · `PrivacyEconomy.fs` · `Diversity.fs` · `Persona.fs` ·
  `TemporalCoordinationDetection.fs` · `CoincidenceClock.fs` · the economics-of-coincidence / tiny-model-v2 hole-fill
  doc · society-public/private-split doc · purpose-of-society doc · #7220.
- Emu/observer: `Chip8Observer.fs` (#7242) · `SoftChip8.fs` · `ReflectionEngine.fs` · `RayTensor.fs` · `Tracing.fs`
  · the ray-trace integration plan (#7239) · 2×2 observer ops (#7204).
- Alignment spine the economy rides: the repelling force / NCI (#7235) · diversity floor / D⁰ (#7156) · fixed-point
  shapes A–F (#7232/#7168).
