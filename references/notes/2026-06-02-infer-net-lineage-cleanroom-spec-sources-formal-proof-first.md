# Infer.NET lineage — cleanroom-spec source papers (formal-proof-first)

> **Why this note exists (Aaron 2026-06-02):** *"we always want formal proof; we
> start this repo as formal proof first."* And the sharp caveat: *"our 4-oracle
> [cross-AI] consensus actually means nothing without the math — it might all be
> built on shaky ground and good feeling."* **Cross-AI agreement is NOT
> validation. The math is.** Four cross-AI oracles (Amara/Prism/Alexa/Lior)
> converging with Otto on a claim is a *prompt to go prove it*, not a proof. This
> note is the spec-source
> list so the 081KT2T2J0008QG0R000S7GHQ8 engine is built on proofs, not consensus.

## Canonical ⟺ homeostat proven-from-seed (Aaron 2026-06-02)

> **Status — DESCRIPTIVE, not yet authoritative.** This section records the
> *intended* tightening of the `canonical` gate. It is a `references/notes/`
> spec-note; it does **not** by itself change policy. The authoritative,
> auto-loaded surface remains
> `.claude/rules/labeling-confidence-on-substrate-over-connect-not-soup-observed-hypothesized-validated-retracted-canonical.md`,
> which still permits canonical promotion via substrate-work + cross-validation +
> operator ratification + multi-AI concurrence. Until the rule (or registry gate)
> is updated to require the proof-lineage/homeostat-from-seed edge, that looser
> criterion is what's enforced. Promoting this gate into the authoritative rule is
> an **offered, not-yet-minted rule-candidate** (pending operator "make it a rule")
> — see 081KT2T2J0008QG0R000YZ3NMY + the formal-proof-first memory. Do not treat this note as the
> enforcement surface. (Codex P2, #6610.)

> *"nothing is canonical until it's part of the proof lineage, so its **homeostat**
> is proven from seed."*

This is the **intended definition of canonical** and the teeth on formal-proof-first.
Canonical is **not** earned by consensus, CI-green, multi-AI ratification, or
argument — it is earned by **derivation through the proof lineage from the seed**.

The key word is **homeostat** (Ashby's cybernetics: a self-regulating system that
returns to a stable equilibrium). A claim is canonical **iff its homeostat — the
stable equilibrium / fixed point the system settles to — is provably derivable from
the seed axioms.** This is exact for what we built: `runToFixpoint`'s convergence
(the belief settling to a stable marginal) and the jelly→spine transition *are*
homeostats — so "canonical" requires *proving* that those equilibria exist, are
unique-where-claimed, and follow from the seed (e.g. BP-is-exact-on-trees;
EP-moment-match fixed point; the message-group identity). Until that proof-lineage
edge to the seed exists, a claim is at most *validated* (tested) or *hypothesized* —
never *canonical*.

This raises the bar on the `labeling-confidence` canonical tier
(observed → hypothesized → validated → **canonical**): the jump to canonical now
*requires* a proof-lineage edge back to the seed (the homeostat proven), not just
"validated + ratified + oracles concur." It is the registry/BCL gate (081KT2T2J0008QG0R0008TFHJT) with
teeth: a primitive's laws are canonical only when **proven** — Soraya's portfolio
is exactly that asserted-in-prose → proven-from-seed gap. Canonicity propagates
*outward from proofs anchored in the seed*, never inward from agreement.

These are **cleanroom-spec sources**: read the math/proofs, implement clean.
Infer.NET's own source stays **concept-not-code** — it is the *referee/adapter*
later (081KT2T2J0008QG0R000S7GHQ8), never copied. Per `location-pointer-index` URLs are preserved
verbatim where the source provides one; the Tier-1 classics (KFL 2001, Minka
2001, R&W) are cited by author/venue/year (no stable canonical URL given).

## Tier 1 — foundations (already cited in the shipped code)

- **Kschischang, Frey & Loeliger 2001**, "Factor graphs and the sum-product
  algorithm", *IEEE Trans. Inf. Theory* 47(2). The BP / factor-graph core —
  cited in `src/Bayesian/FactorGraph.fs`.
- **Minka 2001**, *Expectation Propagation for approximate Bayesian inference*,
  UAI / MIT PhD thesis. The EP foundation — cited in `src/Bayesian/Ep.fs`.
- **Rasmussen & Williams**, *Gaussian Processes for Machine Learning* §3.6
  (eq. 3.58) — the probit EP site — cited in `src/Bayesian/Ep.fs`.

## Tier 2 — the unifying theory (anchor the rewrite here)

- **Minka 2005, "Divergence measures and message passing"**, MSR-TR-2005-173 —
  **the keystone.** BP, EP, VMP, mean-field, and power-EP are *one* framework:
  **α-divergence message passing** (inclusive vs exclusive KL is the only
  difference). For a *unified* engine this means our `FactorGraph` + message
  algebra hosts all four schedules by varying the divergence — not four engines.
  <https://tminka.github.io/papers/message-passing/>
- **Winn & Bishop 2005**, "Variational Message Passing", *JMLR* 6 — VMP.
- **Aji & McEliece 2000**, "The Generalized Distributive Law", *IEEE Trans. Inf.
  Theory* 46(2) — sum-product over **arbitrary semirings**; ties directly to the
  Z-set / semiring substrate (the algebra generalization). (Caveat per the
  registry work: messages are a commutative *group* under product/divide, not a
  clean semiring — the GDL is the generalization, not a literal fit.)

## Tier 3 — the functional + formal lineage (the "F# + formal proofs", and it validates the seed CE)

- **Ścibior, Kammar, Vákár, Staton, Yang, Cai, Ostermann, Moss, Heunen,
  Ghahramani 2018, "Denotational Validation of Higher-Order Bayesian
  Inference"**, *POPL* (PACMPL 2(POPL):60). **Formal denotational semantics of
  inference** (quasi-Borel spaces) — the proofs to borrow for cleanroom
  correctness. <https://arxiv.org/abs/1711.03219>
- **Ścibior, Kammar & Ghahramani 2018, "Functional Programming for Modular
  Bayesian Inference"**, *ICFP* (PACMPL 2(ICFP)) — inference as **composable
  monad transformers** — *literally the seed-CE shape* (the `seed { }` monad is
  the spec'd structure). <https://dl.acm.org/doi/10.1145/3236778>
- **Ścibior, Ghahramani & Gordon 2015**, "Practical Probabilistic Programming
  with Monads", *Haskell Symposium* — the monadic-inference foundation under both.
- **Heunen, Kammar, Staton & Yang 2017**, "A convenient category for
  higher-order probability theory", *LICS* — quasi-Borel spaces; the
  measure-theoretic foundation the POPL'18 validation rests on.

## Tier 4 — incremental (already in our substrate)

- **Budiu, McSherry, Ryzhyk, Tannen 2023**, "DBSP: Automatic Incremental View
  Maintenance for Rich Query Languages", *VLDB* — the incremental substrate
  (the slice-4b factor-graph-deltas / IndexedZSet path).

## The two anchors for the rewrite

1. **Minka 2005 (α-divergence unification)** → the *unified message-passing math*:
   one engine, four schedules by divergence choice.
2. **Ścibior et al. 2018 (modular monadic inference + denotational validation)** →
   the *typed monadic structure* (our `seed` CE) **with formal validation**.

One gives the math the BP/EP/VMP code must conform to; the other gives the
type-level structure + the proof discipline. Together: formal proof first, then
the four oracles' consensus is *checking* the proof, not *substituting* for it.

## Composes with

- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — the compiler is the
  asymmetric critic; this note adds the *paper-level* proofs above the type level.
- `.claude/rules/razor-discipline.md` + `.claude/rules/premise-flagged-unverified-stays-unverified-downstream.md`
  — consensus is a flagged-unverified premise until the math closes it.
- `.claude/rules/honor-those-that-came-before.md` + `.claude/rules/location-pointer-index-aaron-cognitive-architecture-source-attribution-load-bearing.md`
  — full citations + URLs preserved.
- 081KT2T2J0008QG0R000S7GHQ8 (the engine these spec), 081KT2T2J0008QG0R0038CRFJM/081KT2T2J0008QG0R0008TFHJT (the registry algebra claims the
  Tier-2/3 math must back), the `formal-verification-expert` (Soraya) portfolio
  + `alignment-auditor` measurability work.
