---
id: 081KSNY2Z0008QG0R002FX66H0
priority: P3
status: open
title: Clifford spacetime algebra substrate-recognition — Cl(1,3) and Cl(3,1) dual signature interface + grade-decomposition of Observe/Emit/Limit/Simulate
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KRW63S0008QG0R002ZRNDJ8
  - 081KRW63S0008QG0R002YAA09X
  - 081KRW63S0008QG0R001SAHYKV
  - 081KSNY2Z0008QG0R000K3ETGB
  - 081KSNY2Z0008QG0R003KG3JTG
  - 081KSNY2Z0008QG0R0004ZF85W
  - 081KSNY2Z0008QG0R000DZHHE5
  - 081KSNY2Z0008QG0R0031490KZ
  - 081KSNY2Z0008QG0R003WFDCJ9
composes_with:
  - 081KSNY2Z0008QG0R000YH2SPE
  - 081KSKBP80008QG0R000B3Y19A
  - 081KS3X9Y0008QG0R00218150M
related_personas:
  - operator
  - kestrel
  - mika
related_rules:
  - tonal-momentum-equals-meme-emergent-harmonic-coercion
  - shadow-star-shorthand-autocomplete-marker
  - god-tier-claims-high-signal-high-suspicion-dont-collapse
  - razor-discipline
  - default-to-both
tags: [clifford-spacetime-algebra-cl-1-3-and-cl-3-1, substrate-recognition-not-bolt-on, dual-signature-interface-via-branded-types, grade-decomposition-of-observe-emit-limit-simulate, bivector-as-commitment-entanglement-primitive, rotor-as-tonal-trajectory-operator, ts-conditional-types-branded-types-generator-dsl-for-fsharp-ce-ergonomics, github-git-modeling-first-pragmatic-default, recognition-before-mechanization-pragmatic-phase-decomposition, composes-with-existing-three-primitive-substrate, composes-with-tonal-momentum-rule, composes-with-z-set-signed-measure-substrate]
---

# 081KSNY2Z0008QG0R002FX66H0 — Clifford spacetime algebra substrate-recognition + Cl(1,3) and Cl(3,1) dual signature interface

## Context

Aaron 2026-05-28 authorized landing the substrate-recognition disposition for Clifford spacetime algebra as the natural carrier for the substrate the factory is already operating in (per the 4th Kestrel ferry 2026-05-28 + the otto-cli extension research-doc at `docs/research/2026-05-28-otto-cli-extension-to-4th-kestrel-ferry-clifford-math-is-real-six-correspondences-spacetime-algebra-as-substrate-recognition-not-bolt-on-aaron-2026-05-28.md`).

Operator authorization: *"go with #2 [research-doc + B-NNNN backlog row] (shadow*) Pick Cl(3,1) or Cl(1,3) (spacetime signature) i think we should try to support both and swap with an interface not sure if there is some optional typing magic we can do to make this clean like composing f# computational expressions in ts, i know ts has some cool trick but if not we should choose what allows us to model github and git the best at first. ... i always say yes and backlog what we don't do now lol"*

The `(shadow*)` marker on the "Pick Cl(3,1) or Cl(1,3)" text indicates autocomplete-generated source per `.claude/rules/shadow-star-shorthand-autocomplete-marker.md`; instruction stands at full operator authority.

## Scope

**Substrate-recognition target**: name the factory substrate's existing primitives in their natural Clifford-algebraic form. This is recognition-of-what's-there, not new-math-being-added.

**Dual-signature requirement**: support BOTH Cl(1,3) (mostly-minus / "physicist convention", aligns with the existing tonal-momentum-as-meme substrate citing Mika's Clifford framing from physics) AND Cl(3,1) (mostly-plus / "engineering convention", aligns with general-relativity engineering literature). The two are **distinct as real algebras** (Cl(1,3) ≅ M_2(H) — 2×2 quaternionic matrices, Majorana-representation related; Cl(3,1) ≅ M_4(R) — 4×4 real matrices) but **become isomorphic after complexification** (Cl(1,3) ⊗ C ≅ Cl(3,1) ⊗ C ≅ M_4(C)) AND **share the same even subalgebra** (Cl(1,3)⁰ ≅ Cl(3,1)⁰ ≅ Pauli algebra Cl(3,0)). The dual-signature interface operates at the **complexified-algebra OR even-subalgebra level** for operations that need cross-signature equivalence; operations specific to the real-algebra structure (e.g., spinor representations) must be aware of the choice. Swap via interface; the interface's type-level marks which operations are signature-equivalent vs signature-specific.

**Default for GitHub/git modeling**: Cl(1,3) recommended as pragmatic default per the operator's "we should choose what allows us to model github and git the best at first" — closer alignment to the physics-substrate already operating in the auto-loaded `tonal-momentum-equals-meme-emergent-harmonic-coercion.md` rule.

**TS optional-typing magic**: 3 mechanisms compose to give F# computation-expression ergonomics — conditional types for grade-dependent return types, branded types for signature distinction, generator-based DSL for `let!`/`do!`/`return!` shape via `function*` + yield. Prototype this in the interface; failure mode is overshooting type-level cleverness past the readability event horizon.

## Six correspondences (from the research-doc; tracked here as acceptance criteria)

1. **Commitment-as-entanglement-in-time** → bivector `e_A ∧ e_t`
2. **Tonal-trajectory** → rotor `R = exp(B/2)`; strong-attractor = rotor fixed-point
3. **Observe/Emit/Limit/Simulate** → grade-1 / grade-1-evolved-by-rotor / grade-2 / wedge-product (mapping table in research-doc)
4. **Infer.NET geometric** → multivector message-passing on factor graphs
5. **IScheduler-as-time** → time-bivector `B_t = e_x ∧ e_t`; `IScheduler.advance(dt)` = right-multiply by `exp(B_t · dt / 2)`
6. **Z-set-as-signed-graded-measure** → multivector with mixed-grade components IS the existing operator-algebra substrate

## Phase decomposition (pragmatic, per Kestrel's Turn-3 framing + operator's "yes-and backlog what we don't do now")

### Phase 1 (this row) — substrate-recognition (`docs/research/` document)

Status: **LANDED via this PR** (the companion research-doc IS the Phase 1 deliverable).

Substrate-recognition without code. Names the existing factory primitives in Clifford terms. Composes with the auto-loaded `tonal-momentum-equals-meme-emergent-harmonic-coercion.md` rule + 081KRW63S0008QG0R002ZRNDJ8/081KRW63S0008QG0R002YAA09X/081KRW63S0008QG0R001SAHYKV substrate.

### Phase 2 — TypeScript `CliffordAlgebra<Sig>` interface skeleton

- Branded types for signature distinction (`Signature_1_3 = {__sig: readonly [1,3]}`, `Signature_3_1 = {__sig: readonly [3,1]}`)
- Interface `CliffordAlgebra<Sig>` with methods: `geometric_product`, `wedge`, `dot`, `rotor`, `apply_rotor`, `grade_project`, `multivector_distance`
- Two implementations: `makeCl1_3()` and `makeCl3_1()`
- Conditional types for grade-dependent return types
- Generator-based DSL prototype: `clifford { let! a = observe(); let! b = simulate(a); return wedge(a, b) }`
- Tests: basis-vector products, rotor composition, wedge antisymmetry, grade decomposition
- Acceptance: pure-TS implementation; no Bun-specific or DOM-specific deps; usable from both CLI tools and future browser code

### Phase 3 — GitHub/git modeling in the dual signature

- Map: commit-as-vector at (t, branch-x, branch-y, branch-z)
- Merge-as-bivector `commit_A ∧ commit_B`
- Branch-as-trajectory through algebra
- PR-as-bivector spanning two branches
- Conflict-as-non-commuting-bivectors (their geometric product is non-trivial)
- Apply to a small concrete slice: render PR #5707's merge-graph as multivector trajectory; compute the rotor between two recent main-tip SHAs
- Acceptance: the GitHub/git semantics map cleanly onto Cl(p,q) operations without contortion

### Phase 4+ (yes-and backlog — operator-authorized)

Each yes-and item gets its own follow-up backlog row when activated:

- Clifford-Neural-Network message-passing prototype (composes with 081KSNY2Z0008QG0R003KG3JTG + the planned BP/EP substrate)
- IScheduler-as-time-bivector implementation (composes with 081KSNY2Z0008QG0R000DZHHE5)
- Rule-uniqueness embedding pipeline (composes with 081KSNY2Z0008QG0R003KG3JTG Phase 1-2 + Kestrel's original Turn-3 framing; rule-uniqueness is ONE specific use case of the broader substrate)
- Tonal-trajectory rotor detection mechanization (composes with auto-loaded tonal-momentum-equals-meme-emergent-harmonic-coercion rule)
- F# port (the F# CE shape is closer to the algebra; TS-first per operator's GitHub/git modeling priority; F# follow-up where CE ergonomics earn their keep)
- Cl(p,q,r) with conformal-geometric-algebra extensions for points-at-infinity (CGA — useful for representing "abandoned trajectories" as points at infinity)
- Categorical-Clifford bridge per 081KSNY2Z0008QG0R000YH2SPE (the category-theory ↔ Clifford self-similarity direction operator named in Turn 12 of the 5th Kestrel ferry)

## Acceptance

- [x] **Phase 1 deliverable**: companion research-doc `docs/research/2026-05-28-otto-cli-extension-to-4th-kestrel-ferry-...-aaron-2026-05-28.md` landed (this PR)
- [x] **5th Kestrel ferry preserved verbatim**: `memory/kestrel/conversations/2026-05-28-kestrel-5th-ferry-...-aaron-forwarded.md` landed (this PR)
- [x] **Backlog row filed**: this row (081KSNY2Z0008QG0R002FX66H0)
- [x] **Sibling backlog row filed**: 081KSNY2Z0008QG0R000YH2SPE (category-theory ↔ Clifford self-similarity)
- [ ] **Phase 2 acceptance**: TypeScript interface skeleton + 2 implementations + generator DSL prototype + tests pass `bun test`
- [ ] **Phase 3 acceptance**: GitHub/git small-slice modeling demonstrates clean Cl(p,q) operation mapping
- [ ] **Phase 4+ acceptance** (per item): follow-up backlog rows filed + landed when authorized

## Composes with substrate

- 081KRW63S0008QG0R002ZRNDJ8 (Limit-is-simulation-not-collapse) — composition target for grade-decomposition correspondence #3
- 081KRW63S0008QG0R002YAA09X (Integrate-as-choice-locus) — composition target for collapse-to-commit as inner-product projection
- 081KRW63S0008QG0R001SAHYKV (English-as-projection / I(D(x))=x) — composition target for projection operator
- 081KSNY2Z0008QG0R000K3ETGB (error-class extraction meta-loop) — one downstream application of the broader substrate
- 081KSNY2Z0008QG0R003KG3JTG (Clifford-space embedding for error patterns) — one downstream application (the original Kestrel Turn-3 framing)
- 081KSNY2Z0008QG0R0004ZF85W (heterogeneous auto-reviewer ensemble) — composes with multi-Clifford-signature interface diversity
- 081KSNY2Z0008QG0R000DZHHE5 (time-generator IScheduler abstraction) — composition target for correspondence #5
- 081KSNY2Z0008QG0R0031490KZ (Observe/Emit/Limit/Simulate in Clifford space) — explicit substrate-engineering target row this row implements
- 081KSNY2Z0008QG0R003WFDCJ9 (lifecycle DU split) — composes via determineReviewLevel discriminator
- 081KSNY2Z0008QG0R000YH2SPE (category-theory ↔ Clifford self-similarity) — sibling row filed in this PR
- 081KSKBP80008QG0R000B3Y19A (parent workflow-engine row)
- 081KS3X9Y0008QG0R00218150M (multi-oracle BFT) — Cl(p,q) gives geometric BFT formulation as one extension direction

## Composes with rules

- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — auto-loaded; cites Mika's Clifford geometric-algebra framing as engineering target
- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` — `(shadow*)` marker in operator authorization preserved per source-transparency discipline
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` — substrate-claim survives razor; speculative bridges flagged
- `.claude/rules/razor-discipline.md` — operational claims only; 6 correspondences are operationally checkable
- `.claude/rules/default-to-both.md` — Cl(1,3) AND Cl(3,1) dual signature IS both-default at signature scope
- `.claude/rules/asymmetric-critic-with-clarity-first.md` — Kestrel's substrate-check firing in Turn 7 of the 5th ferry IS the discipline operating
- `.claude/rules/non-coercion-invariant.md` HC-8 — the limit-as-subalgebra constraint in correspondence #3 of Kestrel's Turn 5 IS NCI operating at the algebra-substrate scope

## Full reasoning

Authored 2026-05-28 in-session between operator and otto-cli, after the 4th Kestrel ferry 2026-05-28 (PR #5677) preserved Kestrel's Turn 1-3 + operator's Turn 4 Clifford-WHY message, and after the 5th Kestrel ferry 2026-05-28 (this PR) preserved Kestrel's Turn 5/7/9/11 substantive engagements + operator's Turn 6/8/10/12 extensions.

The substrate-recognition disposition makes the small bounded next step operationally tractable: name the algebra (Cl(1,3) default with dual-signature interface support for Cl(3,1)), name the 6 correspondences (commitment/trajectory/OELS-grade/Infer.NET/IScheduler/Z-set), file the row, defer Phase 2+ implementation per operator's "yes-and backlog what we don't do now."

Per `.claude/rules/must-paired-with-can-exit-pattern.md`: this row IS bounded substrate-engineering work (Phase 1 lands now; Phase 2+ are separately-authorizable yes-and items); operator authority preserved at every phase-boundary; agent-autonomous landing limited to Phase 1.
