# toymodel5 scope: the society / game-theory / identity / economy / hat layer — consolidated (v4 is locked, do NOT add)

**Register:** [grounded] scope consolidation (Aaron) + index. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The home for "all of what we've been talking about"
this session — explicitly **NOT v4**.

## Aaron's words

> "can we add all of what we've been talking about to toymodel5? this is too much for
> toymodel4 — we already set its scope and sent it to the math team."

## Version discipline

- **v2** — the society economy (existing `src/Core/` modules).
- **v3 (toymodel3)** — the Traveler Society spec + C1–C8 (this session; at the math
  team via Soraya, `…toymodel3-the-traveler-society-…-handoff.md`).
- **v4 — LOCKED.** Its scope is **set and already sent to the math team.** **Do not
  add to v4.** (Whatever its current contents are, they are frozen for the math pass.)
- **v5 — THIS DOCKET.** Everything below. Includes the ethical-gambling item.

## toymodel5 scope (the social layer) — consolidated from this session

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

## v5 math docket (extends v3's C1–C8) — route to Soraya/Sova when v4 clears

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

This doc is the **scope/index for v5**, not its build. v4 stays frozen at the math
team. When v4 clears, v5 = this consolidated social layer (build the F# modules in
`src/Core/` toymodel-style + route C9–C14 to the math team). Owners: Kenji (synthesis /
hat registry), Soraya + Sova (math docket), Ilyana (public surfaces).

## Pointers

All the `docs/research/2026-06-09-*` docs listed above; v3 toymodel3 spec (C1–C8);
the Seed kernel (`docs/SEED-VOCABULARY.md`); toymodel2 modules (`src/Core/`).
