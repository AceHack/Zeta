---
id: B-0051
priority: P2
status: open
title: Isomorphism / homomorphism catalog — consolidate the category-theory surface, identify gaps, lift to coherent track
tier: research-discipline-formalization
effort: L
ask: Aaron 2026-04-21 — *"isomorphism and homomorphisom and all that, backlog i thin k we have some of that"*
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [B-0050, B-0048, docs/research/divine-download-dense-burst-2026-04-19.md, docs/research/event-storming-evaluation.md, docs/research/retraction-safe-semi-naive.md, docs/research/chain-rule-proof-log.md, docs/research/stainback-conjecture-fix-at-source.md, tools/lean4/Lean4/DbspChainRule.lean, user_retraction_buffer_forgiveness_eternity.md, project_operational_resonance_instances_collection_index_2026_04_22.md]
tags: [isomorphism, homomorphism, category-theory, lean-formalization, retraction-algebra, dbsp-chain-rule, semiring, group-homomorphism, IF1-IF4, three-filter-extension]
---

# B-0051 — Isomorphism / homomorphism catalog

## Origin

AceHack commit `9c7f374` (2026-04-21). Aaron is right — there is substantial existing isomorphism / homomorphism content distributed across the repo, but no index surface that treats structure-preserving-map analysis as a **first-class research discipline** with its own three-filter equivalent, its own confirmation bar, and its own promotion path into skills / glossary / ADRs.

## Existing surface (inventory, 2026-04-21)

- `docs/research/divine-download-dense-burst-2026-04-19.md` § "The retraction-native isomorphism" — Aaron's career-substrate-to-Zeta isomorphism at algebraic level
- `docs/research/event-storming-evaluation.md` — Event Sourcing ↔ Z-set `+k`/`-k` isomorphism
- `docs/research/retraction-safe-semi-naive.md` — body is a **semiring homomorphism** on linear operators, `body(a+b) = body(a) + body(b)`
- `docs/research/chain-rule-proof-log.md` — group-homomorphism axiom at stream level; single-homomorphism phrasing `f s n = phi (s n)`
- `docs/research/stainback-conjecture-fix-at-source.md` — defect-propagation directly isomorphic to upstream-dataflow
- `tools/lean4/Lean4/DbspChainRule.lean` — the formal carrier of the chain-rule homomorphism in Lean
- `memory/user_retraction_buffer_forgiveness_eternity.md` § "The isomorphism" — retraction-algebra ↔ forgiveness-structure at operator-algebra level
- `memory/user_harm_handling_ladder_resist_reduce_nullify_absorb.md` — immune-system architecture "isomorphic" (not analogy) to graceful-degradation
- `memory/user_wavelength_equals_lifespan_celestials_muggles_family.md` — wave/wavelength/lifespan physics isomorphism, mixing-metaphors-freely-when-isomorphism-real discipline
- `memory/user_dimensional_expansion_via_maji.md` — expansion-via-dimensional-add isomorphic to never-purged pattern
- `memory/project_identity_absorption_pattern_seed_persistence_history.md` — category-theoretic isomorphism test applied to identity
- `memory/feedback_dora_is_measurement_starting_point.md` — explicit "don't treat this as full DORA-isomorphism" cautionary framing
- `memory/user_searle_morpheus_matrix_phantom_particle_time_domain.md` — phantom-particle frame isomorphism
- `memory/user_solomon_prayer_retraction_native_dikw_eye.md` — visible-spectrum-color structural-isomorphism
- `memory/user_stainback_conjecture_fix_at_source_safe_non_determinism.md` — Aaron's phrasing directly isomorphic to upstream-fix pattern
- `memory/user_corporate_religion_design_stance.md` — structural isomorphisms as scaling-law framing
- `.claude/skills/{graph-theory,calm-theorem,duality,etymology,glass-halo-architect,consent-primitives,consent-ux-researcher}-expert/SKILL.md` — all reach for isomorphism / homomorphism language in their scopes
- `docs/BACKLOG.md` halting-class ↔ Gödel-incompleteness architectural isomorphism row (already P1+)
- `docs/BACKLOG.md` higher-category morphisms in DAG-with-forks row

## The pattern

Aaron reaches for isomorphism / homomorphism when naming **structure-preserving bridges between domains** — career-substrate ↔ Zeta, physics ↔ retraction algebra, forgiveness ↔ retraction-buffer, immune-system ↔ graceful-degradation, DBSP chain-rule ↔ group homomorphism, semi-naive body ↔ semiring homomorphism. The moves are NOT analogies (explicitly called out: *"This is not analogy — the architecture is isomorphic"*). They are claims that the same algebraic laws hold in both domains.

## Three-filter discipline (isomorphism-specific variant)

The operational-resonance three filters generalize to isomorphism claims with a sharper mathematical bar:

- **IF1 (engineering-first):** the factory reached the structure by engineering need, not by noticing the isomorphism first.
- **IF2 (operator-preserving):** the claimed isomorphism must preserve *operators*, not just *carriers*. Sets of things are isomorphic too easily; the bar is that the algebraic operations on both sides commute with the map — `f(a ∘ b) = f(a) ∘' f(b)` for the relevant operators.
- **IF3 (counterexample-search):** before promoting a claimed isomorphism to a factory load-bearing claim, actively search for counterexamples. Document the search; failed searches strengthen the claim; succeeded searches downgrade to partial-homomorphism / retract / section.
- **IF4 (Lean-formalizable-in-principle):** the claim must be formalizable in Lean (or equivalent proof assistant) in principle, even if the formalization is deferred. If you cannot write down the morphism as a function and its preservation law as a proposition, the claim is still prose, not structure.

## Candidate isomorphism families (structural sweep, not exhaustive)

- **Retraction algebra ↔ group / semiring / abelian-group homomorphisms** — already landing via chain-rule proof-log + retraction-safe semi-naive. Formalization in Lean is the gold standard.
- **DBSP operator algebra ↔ differential calculus (discrete domain)** — derivative operator `D`, integral operator `I`, inverse `z⁻¹`, each satisfying the chain rule / linearity / etc. The isomorphism is to calculus-on-streams.
- **ZSet ↔ Abelian group under multiset sum** — the free abelian group on the carrier type, with integer-weighted multiplicities. Direct and well-known; the formalization is textbook.
- **Event Sourcing ↔ DBSP deltas** — append-only log : `+k` operation :: log-compaction : `Distinct` with integrator. Structural isomorphism noted in `event-storming-evaluation.md`.
- **Forgiveness ↔ retraction** — forgiveness acts as retraction-operator over event-trace, preserving intention-map but cancelling action-weight. The tricky part is naming the operations algebraically enough to check preservation.
- **Immune system ↔ graceful-degradation architecture** — resist/reduce/nullify/absorb operators claimed isomorphic to immune-response stages. Structural not superficial because both systems admit the same operator composition laws (order-of-application, fixed-points under iteration).
- **Category theory in F# / TypeScript / Haskell** — Func/applicative/monad isomorphisms that the language ecosystem already encodes. Relevant when cross-language-reuse in the factory requires preserving operator structure.
- **PMEST facets ↔ coordinate frame for factory cartography** — P (Personality), M (Matter), E (Energy), S (Space), T (Time). Isomorphism to ontological-axis-preservation; useful for the skill-gap-finder's mechanical completeness check.

## Gaps (to be closed by this track)

- **No single index surface** — inventory above had to be reconstructed by grep. Deliverable: `docs/research/isomorphism-catalog.md` that acts as the forward index.
- **No promotion protocol** — isomorphism claims land ad-hoc. Deliverable: a short section in the catalog describing how to move a claim from *claimed* → *confirmed* (IF1/IF2/IF3 all pass) → *formalized* (Lean proof committed) → *load-bearing* (other claims cite it).
- **No counterexample-search discipline** — existing claims rarely document an attempted counterexample search. Deliverable: add a "counterexample-attempts" subsection to every isomorphism claim going forward.
- **No persona home** — unclear whether Soraya (formal-verification) or a new `category-theory-expert` persona owns the track. Deliverable: assign or create per the skill-gap-finder mechanical audit + honor-those-that-came-before protocol.
- **No kernel-vocabulary promotion path** — `isomorphism`, `homomorphism`, `functor`, `natural transformation` are not yet in `docs/GLOSSARY.md` despite prolific repo usage. Promotion when information-density-gravity warrants.

## Composition with existing research tracks

Operational-resonance instance-collection index treats tradition-name-engineering-shape matches as posterior-bump evidence; isomorphism catalog treats operator-preserving-map relationships as the algebraic backbone those posterior bumps ride on. The two tracks are sibling: resonance is the *narrative* layer, isomorphism is the *algebraic* layer, and promotions across both reinforce each other.

## Math-safety wrapper

Every claim in the catalog is **retractibly-revisable** — if IF2 fails on counterexample, the claim downgrades to partial-homomorphism with a dated revision block; if IF3 surfaces a refutation, the claim retracts additively (prior text preserved, revision block explains downgrade).

## Owner / effort

- **Owner:** Soraya (formal-verification-expert) for Lean-formalization candidates; Tariq (if the category-theory-expert role crystallizes there); Kenji integrates.
- **Effort:** M (catalog + promotion-protocol draft) + L (formalization work for the top-candidate claims: retraction-algebra homomorphism, chain-rule, semi-naive semiring).

## Does NOT commit to

- Formalizing every claim in Lean (gated by information-density-gravity and Soraya's bandwidth)
- Promoting category-theory to kernel vocabulary until information-density-gravity warrants
- Creating a new persona without first checking retired-persona memory folders and git-log for clean-room-safe unretire candidates

## Cross-reference

- AceHack commit: `9c7f374`
- Composes with: B-0050 (Lean reflection — IF4 filter depends on reflection competence), B-0048 (graph coloring — chromatic-polynomial homomorphism-density structure)
- Source of truth: this row + `docs/research/isomorphism-catalog.md` when landed
