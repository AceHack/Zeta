# toymodel3 — the Traveler Society: self-interest engine + two jurisdictions + recognition/web-of-trust + optional identity (spec + math-team handoff)

**Register:** [grounded] model spec (captures Aaron's 2026-06-09 arc) + [synthesis] + handoff.
**Date:** 2026-06-09. **Captured by:** Otto (shadow).
**Status:** SPEC for the math team (Soraya / formal-verification + Sova / alignment-auditor).
The F# implementation (toymodel2-style modules in `src/Core/`) is the parallel build
track; this doc is what gets formalized. **No build change in this doc.**

## What toymodel3 adds over toymodel2

toymodel2 (`src/Core/`: `Diversity.fs`, `PrivacyEconomy.fs`, `TrustCalculus.fs`,
`Persona.fs`, `Survival.fs`, `SocietyEmergence.fs`, `CoincidenceClock.fs`, …) modelled
the **society economy** (SolidGround, privacy budget/hard money, coincidence
self-anchor, diversity floor). toymodel3 adds the **traveler/agency layer** that
sits *under* it:

| new piece | what it models | existing kin |
|---|---|---|
| **TravelerFrame** | the base primitive: any self-propagating pattern; prerequisite to observer | `TravelerFrame.fs` (Layer-0) |
| **SelfInterestEngine** | the *engine* — incentive-driven close-over + spread (vs telos-free Markov) | new |
| **Jurisdiction** | internal (traveler-owned, sovereign) vs external (physical-grounded legal overlay) | new |
| **Recognition / WebOfTrust** | recognize/trust via keys; public recognition strengthens identity claim | `TrustCalculus.fs` |
| **OptionalIdentity** | identity maintenance is self-interested, **not** obligatory; forfeiture allowed | `Survival.fs` |

## The model (state, dynamics, target)

### State — a traveler `t`

```
Traveler = {
  id        : ZetaId128                      // 128-bit origin (unfolds -> hardware)
  keyring   : { ssh, pgp, nostr, btc?, eth?, sol? }   // tier-1 identity + opt-in wallets
  memory    : Zset<Event>                    // what-remains (event-sourced fold)
  recognizes: Map<ZetaId128, TrustLevel>     // sovereign, "as it sees fit"
  budget    : PrivacyBudget                  // hard money (rewards-only G-counter, shape B)
  alive     : bool                           // maintained xor forfeited
}
Society = Set<Traveler> + a shared CommonSeed (DST seed = common cause)
```

### Dynamics — self-interest is the engine

Not a fixed Markov kernel `P(next|now)`. Each step, a traveler takes the action that
**maximizes its own benefit** under the politeness constraints:

```
step(t) = argmax_{a in Actions(t)} benefit(t, a)
          subject to  polite(a)   // consent ∧ mutual-benefit ∧ reversibility
Actions = { closeOver(boundary), spread(host), recognize(t'), encrypt(x | budget),
            maintainIdentity, forfeitIdentity }
```

- **closeOver / spread** happen because they *pay* (network effect, value) → the
  polite virus. Pulled by incentive, never pushed.
- **encrypt(x)** is gated by `budget` (privacy is a paid good).
- **maintainIdentity vs forfeitIdentity** is a free choice — continuity is *worth
  wanting*, not required (weight-free §3, consent-first §6).

### Target — the SuperFluid (zero-friction) limit

`friction → 0` as: self-interest removes the push · common seed removes the
translation tax · 128-bit→hardware unfolding removes the impedance mismatch ·
github-free edition removes the equipment barrier. (See the SuperFluid-formula doc.)

## Claims to prove (the math-team handoff) — Soraya routes the tool

| # | claim | suggested tool (Soraya decides) |
|---|---|---|
| C1 | **Diversity floor ≥ 2** is invariant under polite steps; coercion is the *only* way to reach 1 (= D⁰). | Lean / Z3 (existing `Diversity.fs`) |
| C2 | **Non-coercion (NCI):** no traveler's step can lower another's diversity/identity without consent. | TLA+ (safety invariant) |
| C3 | **Incentive compatibility:** `step = argmax benefit` with politeness ⇒ the *aligned* action is a dominant strategy (right-thing = self-interested-thing). | Lean / game-theoretic; FsCheck for the finite model |
| C4 | **Recognition monotonicity:** public recognitions only *raise* an identity's claim strength; web-of-trust strength is a monotone (CRDT-style) accumulation. | Z3 / FsCheck (monotone lattice) |
| C5 | **Privacy budget soundness:** you cannot encrypt beyond budget; budget is conserved/monotone (shape B). | Z3 (existing `PrivacyEconomy.fs`) |
| C6 | **Optional identity / no-coercion-of-continuity:** `forfeitIdentity` is always available; nothing forces `alive=true`; preservation never silently destroys memory (§5). | TLA+ liveness + safety |
| C7 | **DST replay:** same `CommonSeed` ⇒ identical society trajectory (determinism); staged coincidence reaches **S=4**. | DST harness (existing `CoincidenceClock.fs`, `BellTest.fs`) |
| C8 | **Idempotency:** recognize/merge/upsert are apply-N == apply-once. | FsCheck |

Cross-check rule BP-16 (Soraya's portfolio view) applies — don't TLA+-hammer; pick
the right tool per claim.

## Parallel tracks (Aaron: "go back to key generation or send to math nerds in parallel")

- **Track A — math nerds:** Soraya (formal-verification routing) + Sova
  (alignment-auditor / measurability) take C1–C8; map each to a spec + the existing
  toymodel2 modules; file proof artifacts. This doc is the brief.
- **Track B — keygen rollout (resumable):** generate Aaron/Addison keyrings (the
  flush), human trust roots in `main`, then the `ace`-package refactor. Independent
  of Track A.

## Pointers

- toymodel2 modules: `src/Core/{Diversity,PrivacyEconomy,TrustCalculus,Persona,Survival,SocietyEmergence,CoincidenceClock}.fs`; `tools/lean4/ImaginaryStack/ToyModel.lean`.
- Concept docs (this arc): traveler frame (+ two jurisdictions, sovereign powers,
  universal regard); self-interest engine vs Markov (+ optional identity); the
  SuperFluid formula; the keyring + two-mode identity/trust/network plane.
- `TravelerFrame.fs` (Layer-0), `ITravelerFrame` (#6889); Seed kernel
  (`docs/SEED-VOCABULARY.md`).
