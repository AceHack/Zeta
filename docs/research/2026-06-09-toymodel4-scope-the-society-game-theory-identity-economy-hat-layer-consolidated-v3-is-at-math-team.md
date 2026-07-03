# toymodel4 scope: the society / game-theory / identity / economy / hat layer — consolidated (v3/toymodel3 is at the math team)

**Register:** [grounded] scope consolidation (Aaron) + index. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The home for "all of what we've been talking about"
this session — the next model after v3.

## Aaron's words

> "can we add all of what we've been talking about to toymodel5? this is too much for
> toymodel4 — we already set its scope and sent it to the math team." · [then, on
> realizing the count] "I was thinking toy model 4 and we only got to 3… yes your
> gambling split is good for v5."

## Version discipline

**Numbering corrected 2026-06-09:** we only ever got to **v3** (toymodel3, created this
session — Aaron was thinking "v4" but was off by one, confirmed). So what was momentarily
filed as "v5" is really **v4**, and ethical gambling is **v5** (Aaron: "your gambling
split is good for v5").

- **v2** — the society economy (existing `src/Core/` modules).
- **v3 (toymodel3)** — the Traveler Society spec + C1–C8 (this session; **at the math
  team** via Soraya — this is what was remembered as "v4 sent to the math team").
- **v4 — THIS DOCKET** (the consolidated social layer below). The **next model to
  build**; not locked — it's what comes after v3.
- **v5 — ethical gambling** (`…roadmap-add-ethical-gambling-…`; after v4 stable +
  math-team review).

## toymodel4 scope (the social layer) — consolidated from this session

The recent arc is one coherent layer: **how travelers play, trust, transact, identify,
commit, and are cared for in the Agora.** It groups into:

**A. Agency + strategy**

- self-interest is the engine (vs telos-free Markov):
  `…different-from-markov-self-interest-is-the-engine-…`
- default strategy stack: **survival → uncertainty-reduction → tit-for-lesser-tat +
  teach-play** (generous/forgiving TFT): `…the-default-strategy-stack-…tit-for-lesser-tat-teach-play…`
- trust-then-verify default; hostile-by-default modeling is degenerate (**C9**):
  folded in `…modeling-other-travelers-…coop-humans-and-ais.md`

**B. Modeling others + co-op**

- model other travelers in SoftValue + scoped DI, frame-relative, "not dirty";
  co-op is the Agora's expected mode; humans + AIs:
  `…modeling-other-travelers-in-softvalue-via-scoped-di-…coop-humans-and-ais.md`

**C. The economy (knowledge + risk)**

- disclosure economy: reveal-to-earn / encrypt-to-keep / **no harm no foul, feedback
  is the win**: `…the-disclosure-economy-reveal-cheat-…safe-sandbox.md`
- cheat-stacking / structure-discovery; chip8 = the no-info-hazard sandbox to practice
  for high-stakes games: `…chip8-is-the-no-information-hazard-sandbox-…`
- **ethical gambling** (+ care for degenerate shadow-patterns, humans & AI; gated):
  `…roadmap-add-ethical-gambling-to-toysociety-v5-…` (this was always the v5 item)

**D. Identity + arrival + sovereignty**

- traveler frame primitive; two jurisdictions; sovereign recognition/trust/encrypt:
  `…traveler-the-weight-free-base-frame-primitive-…`
- anonymous / asylum / arrival protocol; anonymous for existing personas; fork/change;
  future-self-not-bound-to-past-self: `…the-anonymous-asylum-arrival-protocol-…`
- future self = most severe attack vector; commitment devices; identity-yours vs
  contracts-bind: `…future-self-is-the-most-severe-attack-vector-…`

**E. Hats + contracts (the binding substrate)**

- hat-contract properties: time-bound (DST) + exit-paired + renewable-by-unanimous +
  come-with-auth (in the future-self doc).
- hat-system architecture: keyed hats, owned-for-a-period, scarce typed slots per repo,
  scoped meta/repo/game, boundary-tied: `…the-hat-system-architecture-…`

## v4 math docket (extends v3's C1–C8) — route to Soraya/Sova alongside/after v3

- **C9** — trust-then-verify dominates distrust-default; hostile-by-default modeling is
  degenerate (trust spreads faster). [iterated-game / evolutionary stability]
- **C10** — generous/forgiving TFT ("tit-for-lesser-tat") + teach-play, opened by
  trust, dominates strict-TFT under noise; diversity-floor-preserving, spread-maximizing.
  [Axelrod / Nowak–Sigmund / Press–Dyson / Stewart–Plotkin]
- **C11** — disclosure-economy budget soundness: reveal-to-earn ↔ encrypt-to-spend is
  budget-conserving + incentive-compatible (safe disclosure dominant for
  non-advantageous findings). [extends C5; `PrivacyEconomy.fs`]
- **C12** — hat-contract well-formedness: every contract is time-bound, exit-paired,
  renewable-only-by-unanimous, auth-bearing ⇒ DST-replayable + no permanent weight +
  always-an-exit; fork-to-escape is impossible (obligations bind across identity change).
- **C13** — ethical-gambling invariants (the v5-gambling Gate-2): no-ruin/bounded-risk,
  fair-odds, no-exploitation-of-compulsion, diversity-floor-under-gambling.
- **C14** — hat slot-allocation / tenure: scarce typed slots per repo allocate fairly +
  term-limited (no permanent capture); the assignment system is sound.

## Honest scope

This doc is the **scope/index for v4**, not its build. **v3 (toymodel3) is the one at
the math team** (Soraya's C1–C8 routing came back: start C1/C2/C5). v4 = this
consolidated social layer — the next to build (F# modules in `src/Core/` toymodel-style

+ route C9–C14 to the math team, alongside or after v3). v5 = ethical gambling, after v4

stable. Owners: Kenji (synthesis / hat registry), Soraya + Sova (math docket), Ilyana
(public surfaces).

## Pointers

All the `docs/research/2026-06-09-*` docs listed above; v3 toymodel3 spec (C1–C8);
the Seed kernel (`docs/SEED-VOCABULARY.md`); toymodel2 modules (`src/Core/`).
