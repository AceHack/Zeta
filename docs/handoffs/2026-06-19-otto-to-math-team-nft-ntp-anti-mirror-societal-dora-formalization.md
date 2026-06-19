# Handoff: Otto → math team — NFT / Zeta-NTP / anti-mirror / societal-DORA formalization

**From:** Otto (scoping/consolidation). **To:** Soraya (routing), Kenji (Lean/Z3 authoring), Tariq (`H_∞`
inequality), Adaeze (empirical cross-checks). **Date:** 2026-06-19. Aaron: *"let's hand off to math team."*

One thread converged on a **family of entropy-as-identity primitives**. This is the single entry point. The
one-line convergence: **NFT, anti-mirror (`ρ_owe`), G3b, and QPG are one *entropy-as-identity* object on four
channels** — single **body** (G3b), **pair** (NFT), the **measurement** of a pair's irreducible own-entropy
(`ρ_owe`), and its **per-link density** (QPG). *Identity is accumulated uniqueness through entropy; only the
channel changes.*

## Already BUILT (code on `main` — the verifiers exist before the proofs)

- **`src/Core/Decorrelation.fs`** — `ρ_owe = H(A|U,C)/H(A|C)` CMI own-entropy estimator (the anti-mirror /
  no-hidden-shared-cause measure). 11 tests. (#8608)
- **`src/Core/SocietalDora.fs`** — coupled-empowerment metrics + **QPG** (`edgeQpg`, quality-per-link). 13
  tests. (#8618, #8622) These two **are the mint-condition checkers** for the NFT.

## Scoping docs (the definitions + Soraya's tool-selection)

- `docs/research/2026-06-19-nft-as-non-fungible-relational-artifact-entropy-as-identity-mint-conditions-scoping.md`
  — NFT def, mint conditions, immutability (snap = git-commit, DST-checkable not DST-live), displayClock
  resolution, cardinality, open labeling.
- `docs/research/2026-06-19-anti-mirror-rigorous-measurable-decorrelation-cmi-own-entropy-scoping.md` — `ρ_owe`
  rigor + tool-selection.
- `docs/research/2026-06-19-bayesian-emotional-propagation-inference-infernet-extension-soft-primary-snappable-mutual-empowerment-scoping.md`
  — mutual-empowerment objective + the manipulation-pattern-is-a-coupled-minimizer claim.
- `docs/research/2026-06-19-g3-anti-sybil-entropy-cost-*` + `…aurora-b-bft-sybil-lift-…` — G3b (the single-body
  entropy floor the NFT lifts to a pair).
- `memory/project_zeta_ntp_phase_grounded_network_time_across_all_space_and_time_2026_06_19.md` — Zeta NTP
  (soft phase spacetime base; UTC/leap-seconds + borders = correlated observations).

## Open formal obligations (prioritized · property → tool → owner)

| # | Pri | Property | Primary tool | Cross-check | Owner |
|---|---|---|---|---|---|
| 1 | **P0** | NFT **forgery-resistance**: `H_∞(H_AB \| E) ≥ k` (the entropy floor = G3b/Bell lifted to a pair) | **Lean 4** | Z3 finite instance + `ρ_owe` empirical floor | Tariq + Adaeze |
| 2 | **P0** | NFT **binding / collision-resistance** (specificity): `H_AB ≠ H_AC ⇒ Commit≠Commit` | **Z3 (QF_BV)** | Lean domain-sep | Kenji |
| 3 | **P0** | **anti-mirror `ρ_owe`** soundness (CMI own-entropy as primary; data-processing inequality) | **Lean 4** | Z3 estimator lemmas + FsCheck on `Decorrelation.fs`; CHSH cross-check | Tariq + Adaeze |
| 4 | P1 | **Merkle cross-verify** soundness (inclusion + hiding; no third-party forge) | existing merkle golden vectors + **FsCheck** | Z3 path-verify | Adaeze |
| 5 | P1 | **NTP noninterference**: `H_AB` depends only on the captured-at-mint **soft** clock (`clock ± uncertainty`), never on a post-mint "now"; render-clock quarantined to display | **Lean/Z3** (metering lemma) | FsCheck | Tariq |
| 6 | P1 | **mutual-empowerment = coupled-empowerment minimizer** for the manipulation pattern | info-theoretic (Lean) | `SocietalDora` FsCheck | Adaeze |
| 7 | P2 | **animation/displayClock boundary**: legal "animate" = pure `render(frozenState, displayClock)`; does `displayClock`-as-param smuggle live state? + the `± uncertainty` interval is itself bound (no retro-narrowing) | open — **boundary question first** | — | Soraya to scope |

## Judgment calls the math team must preserve (don't lose in formalization)

- **NO TLA+ for the NFT** — it is a *static commitment over a settled fold*, not a state machine (hammer-bias
  guard). TLA+/TLC has no quantitative-entropy vocabulary for the `H_∞` floor either.
- **The labeling is OPEN — don't collapse it** (Aaron's invariant). "NFT" denotes one of: (a) the
  relational-uniqueness artifact, (b) the proof-of-mutual-empowerment, (c) both fused. Pick the labels, **but
  the mutual-empowerment mint-gate must survive any labeling** — a capture/mirror/Sybil/extractive
  relationship must never mint.
- **`ρ_owe` is evidence, not the lemma** — the measured statistic cross-checks the `H_∞` theorem; never promote
  it to the proof.
- **Scarcity = entropy, not rarity** (C3 rejected).

## Prereq note

Soraya's earlier routing flagged `Decorrelation.fs`, `SocietalDora.fs`, and the dated G3b/anti-mirror docs as
"not on disk" — that was the **stale shared checkout**; **all are merged to `main`**. Cite from `main`.

Anchors: Shannon/Rényi (`H_∞`); Merkle 1979; Pedersen/Blum (commitments); Bell 1964 (measurement-independence,
lifted to a pair); Goguen–Meseguer (noninterference); Mills/RFC 5905 (NTP baseline); Salge–Polani
(empowerment). Authorship: Otto (consolidation) · Soraya (routing).
