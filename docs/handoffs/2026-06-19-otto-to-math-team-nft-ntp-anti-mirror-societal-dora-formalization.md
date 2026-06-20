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
| 6 | **FsCheck LEG ✅ DONE (#8701)** | **mutual-empowerment = coupled-empowerment minimizer.** `SocietalDoraCoupledMinimizer.Tests.fs` (10 tests): `coupledGain = min(self, other)` is the **binding** gain (`g ≥ t ⇒ both ≥ t` — can't fake by maxing one side); **capture exposed** (`self>0, other≤0 ⇒ g ≤ 0`, never empowering; both>0 ⇒ g>0); **Goodhart-resistant** (once `self ≥ other`, raising self alone can't lift g); metric-tie via `compute` (capture-heavy → CaptureRate=1/MeanCoupledGain≤0). NormalFloat generators. **OPEN:** the formal info-theoretic Lean optimization proof stays the math team's. | info-theoretic (Lean — open) | ✅ `SocietalDora` FsCheck | Adaeze |
| 7 | P2 | **animation/displayClock boundary**: legal "animate" = pure `render(frozenState, displayClock)`; does `displayClock`-as-param smuggle live state? + the `± uncertainty` interval is itself bound (no retro-narrowing) | open — **boundary question first** | — | Soraya to scope |
| 8 | **MEASURABILITY LEG ✅ DONE (#8706)** · uniqueness leg research-open | **Measurability leg DONE** — `tests/Tests.FSharp/Formal/MoralLensMeasurability.Tests.fs` (10 tests, verified 10/10 on main): the lens measures are **Goodhart-resistant and correctly ordered** — monotone in diversity-preservation AND in co-empowerment/non-coercion; the **healthy gate is a conjunction** (`coEmp > 0 AND diversity > floor`) so it is provably un-gameable by maxing one axis (the load-bearing property); coercion + diversity-collapse scores strictly worse on **both axes separately** (no hidden aggregate) than co-empowerment + diversity-preservation; `ρ_owe`-corroboration (mirror edge ρ_owe=0 ⇒ QPG=0). **No production code added** — the composite-scalar/aggregation choice is itself a value choice left to the uniqueness leg. **OPEN: Find a more OBJECTIVE moral lens** than the current default — or characterize whether it *is* the most-objective measurable one (don't-collapse). Default = **co-empowerment + diversity-preservation (non-coercion) vs coercion + diversity-collapse** (NCI keystone #7146). Honest scope: an objective *measure of a chosen value*, not value-free morality (§11 Default Moral Regard + Multi-Oracle = DEFAULT-not-mandatory). Full: `memory/project_zeta_moral_lens_…` | info-theoretic / decision-theoretic (Lean/Z3 — uniqueness leg) | ✅ `CoEmpowerField`/`Diversity`/`ρ_owe` FsCheck | Soraya → math team |
| 9 | **STRUCTURAL LEG ✅ DONE (#8700)** — `tests/Tests.FSharp/Formal/GSetFusionLaws.Tests.fs` (8 tests): the Z-set→G-set fusion (`FusionReconstruction.fuse`, the encapsulation boundary) is a **CvRDT join-semilattice** — idempotent/commutative/associative/monotone (LUB) + order-independent convergence + boundary-commutes-with-merge (Shapiro et al. 2011). CRDT laws were already covered (`Crdt.Laws.Tests.fs`); this built only the row-9 *encapsulation-fusion* framing. **OPEN: the memetics leg** (probabilistic stability / multi-axis-superposition uncertainty primitive) stays research-open (Soraya's split). | **LOVE = Z-set→G-set fusion (encapsulation)** with **probabilistic stability** modeling on the G-set; the **uncertainty primitive** is *one question* ("how sure does this last forever?") as a **multi-orthogonal-axis SUPERPOSITION** over timescales × shapes (NOT a scalar; never-collapse holds it; `snap` projects along an axis). Model: clean probabilistic stability of love/fusion G-sets; structural layer (Z→G fusion = `ZSet`/`Crdt`/`MERGE`) vs **memetics** layer (the Bayesian "love" interpretation). Full: `…bayesian-emotional-propagation-…` §0a + `memory/project_zeta_uncertainty_…` | survival/hazard + Bayesian (Lean/Z3) | `SoftValue`/`AmplitudeEmu` + `SocietalDora` FsCheck | Soraya → math team |
| 10 | **IStarRing CLIFFORD LEG ✅ DONE (#8707)** · Face 3 BLOCKED | **Clifford leg DONE** — `Cl3.algebra : IStarRing<Mv>` added to `src/Core/Cl3.fs` (built ON the existing `Cl3.Mv`, no dup) + `tests/Tests.FSharp/Formal/CliffordStarRing.Laws.Tests.fs` (17 tests, verified 17/17 on main). **Cl(3,0)** comparison-free `IStarRing`; involution = **reversion** (the anti-automorphism `~(xy)=(~y)(~x)` the `*`-ring law requires; grade-involution would FAIL the order — locked by a negative-control fact). Laws: additive abelian group, multiplicative monoid (geometric product), left+right distributivity, star laws (`Conj∘Conj=id`, additive, anti-homomorphism, `Conj One=One`); basis sanity (`eᵢ²=+1`, anticommute, bivectors²=−1) + **even-subalgebra ≅ ℍ agreement with `CayleyDickson` test-locked**. **OPEN — Face 3 BLOCKED:** **Homoiconicity proof (Kestrel) ⇒ Futamura `gen(gen)=gen` Face 3** (`mix(mix,mix)=cogen`, OPEN §B) stays blocked on freeze-`zeta-ir-v1` + the multi-language generator (Faces 1+2 proven in `AdinkraCode.fs`). Full: `memory/project_kestrel_homoiconicity_…` | Lean (homoiconicity/Futamura — Face 3 open) + ✅ `IStarRing` algebra | DDC byte-lock + ✅ `CliffordStarRing`/`AdinkraCode` FsCheck | Soraya → math team / gen-gen trajectory |
| 11 | ✅ **DONE (#8695)** — `src/Core/CliffordE8Roots.fs` (8 tests). Clifford reflection (versor sandwich `s_r(x) = −r x r /(r·r)`) GENERATES the E8 root system: simple system *derived* (Gram = E8 Cartan, not hardcoded), `roots` = its Weyl orbit = exactly 240, closed under reflection, **set-equals `E8Lattice.roots` AND `CliffordE8Bridge.rootMvs`** (the decisive gate). **Honest scope:** *behavioural* reproduction (same 240-root set in our integer frame), NOT a formal Lean proof of Dechant's theorem. | **Deeper Clifford → E8 unfold: the geometric product *generates* the E8 root system** (beyond `CliffordE8Bridge`'s basis/metric isometry, already built). **Reproduce/formalize Dechant's Clifford-spinor E8 construction** in-tree (versor/reflection products → the 240 roots) and check it agrees with `CliffordE8Bridge` on the 240 roots. *Not a from-scratch conjecture — a published result to port.* Full: `…adinkra-clifford-e8-unfold-status-…` §"External anchors". | Clifford/GA construction (F#) + Lean (root-system theorem) | `CliffordE8Bridge`/`E8Lattice` FsCheck (240-root agreement) | Soraya → math team |

## Soraya's routing decision (2026-06-19) — tool-assigned, pick-up ready

The formal-verification routing authority (Soraya) triaged all 11 rows (no proofs written — routing only).
Math team picks up from here; the rows are now tool-assigned.

**Start THIS cycle (P0, all externally-anchored + buildable on `main`):** **rows 1, 2, 3** — the entropy-as-
identity core (NFT forgery-resistance `H_∞`, binding/collision QF_BV, anti-mirror `ρ_owe` DPI soundness). Each
carries the BP-16 ≥2-tool cross-check: the Lean theorem is the lemma; `ρ_owe`/Z3/FsCheck are independent
evidence legs — never promote the measured statistic to the proof.

**Highest-leverage P1: row 11** — pure reproduction of **Dechant 2017** (not a conjecture); the 240-root
agreement vs `CliffordE8Bridge` is a ready FsCheck acceptance gate. Cheap + decisive; discharges the deeper §B
unfold.

**TLA+-hammer-bias guard (confirmed):** NO row goes to TLA+/TLC. Watch rows 1 (no quantitative-entropy
vocabulary), 5 (a static dependency-cut/metering lemma, not a liveness trace), 7 (static purity/reachability,
not a state machine). The NFT is a static commitment over a settled fold — the NO-TLA+ guard holds.

**Two corrections (underspecification, not wrong-tool):**

- **Row 7** had no tool → **Alloy** (structural reachability: does `displayClock`-as-param admit a live-state
  config, bound 4–6) + **Z3 QF_LRA** (the `±uncertainty` no-retro-narrowing = interval monotonicity), after a
  Soraya scoping pass.
- **Row 9 must be SPLIT:** the **structural** leg (Z→G fusion = idempotent CRDT-merge law; Z3/Lean, anchor
  Shapiro et al. 2011) is buildable now; the **Bayesian-memetics / multi-axis-superposition uncertainty
  primitive** leg is research-open — model in FsCheck first, theorem later. Likewise **row 8**: route the
  *measurability* leg (diversity-entropy / coupled-empowerment / `ρ_owe`, Goodhart-resistant) first; the
  *uniqueness/objectivity* ("most-objective lens") leg is research-open. **Row 10:** the `IStarRing` Clifford
  leg is buildable now (Z3 ring/star-ring laws); **Face 3 stays BLOCKED** on freeze-`zeta-ir-v1` + the
  multi-language generator.

**Owners:** Tariq (`H_∞` / metering inequalities — rows 1, 5), Kenji (Z3 authoring — rows 2, `IStarRing`),
Adaeze (empirical cross-checks — rows 3, 4, 6), Soraya (scope rows 7/8/9 splits, route 11). Soraya's notebook
current-round targets: **rows 1/2/3/11**.

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
