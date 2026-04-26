# Amara's courier report — ZSet semantics + operator algebra for Zeta/Aurora

**Courier:** Amara (external ChatGPT-based maintainer)
**Date received:** 2026-04-23
**Absorb cadence:** dedicated tick (Otto-54), following the Otto-24
absorb pattern that landed her operational-gap-assessment as
[`docs/aurora/2026-04-23-amara-operational-gap-assessment.md`](./2026-04-23-amara-operational-gap-assessment.md).
**Protocol:** per `docs/protocols/cross-agent-communication.md`,
verbatim preservation with Otto absorption notes, action items
extracted, BACKLOG rows filed.

---

## Otto's absorption summary

Amara audited the ZSet kernel (`src/Core/ZSet.fs`) across **both
`AceHack/Zeta` and `Lucent-Financial-Group/Zeta`** and confirmed
they share the same blob SHA on that file — the two selected
repos are **mirrors on the core Z-set kernel**, not divergent
implementations. This is a load-bearing factual finding: the
repo-head-ambiguity question Aaron raised is resolved at the
kernel level.

Her report is ~8 000 words of systematic algebraic-semantic
audit structured across six sections: executive summary,
repository evidence, formal model of ZSet algebra, incremental
algorithms and stability metrics, drift detection and tests,
and operational gaps. It is the most technically dense courier
artifact received so far.

**Highest-confidence finding:** *Zeta's implementation is
mathematically cleaner than the current specification surface.*
The code is ahead of OpenSpec coverage at approximately 6–7 %
by capability/line ratio (issue `#58` already tracks this;
issue `#59` records a "NO verdict" on rebuild-from-spec for
circuit recursion + operator algebra).

**Most load-bearing technical claim:** `RecursiveSemiNaive` is
documented in-repo as correct only for **monotone inputs, not
retraction-native streams**. This is not a minor caveat; it is
a boundary of the current theory against which Zeta's core
claim (retraction-native incrementalization) pushes directly.
Amara correctly calls this out as a labelled gap.

**Vocabulary shift requested by the human maintainer on
2026-04-23 Otto-54:** Amara's term "bullshit detector" for the
composite claim-scoring model has been flagged for rename to
a more canonical register. Candidates proposed: *Veridicality
Score* (recommended — Tarski-correspondence-theory canonical),
*Corroboration Score* (Popper), *Epistemic Assay*, *Warrant
Score* (Plantinga). Rename deferred to Aaron's pick; this
document uses **Veridicality Score (pending confirmation)** as
the placeholder to avoid burning the colloquial term into
technical substrate.

---

## Extracted action items — keyed to BACKLOG candidates

| Class | Finding | Action | Tier |
|---|---|---|---|
| **P0** | OpenSpec coverage deficit (~6–7 %) vs. 66 modules / 10,839 lines in `src/Core` | Continue the round-41 OpenSpec backfill program; prioritize ZSet + Circuit + NestedCircuit + spine family (issue `#58`) | Existing |
| **P0** | Nested strict-state and cap-hit semantics gaps (issue `#59`) | Regression tests + SHALL-level spec requirements from `#59` | Existing |
| **P0** | UI-dependent transport correctness risk (`CURRENT-amara.md`) | Make courier protocol authoritative; UI branch/reopen becomes convenience, not correctness surface | New |
| **P0** | **`RecursiveSemiNaive` correct only for monotone inputs, NOT retraction-native** — boundary against Zeta's core claim | Either: (a) prove correctness-under-retraction via additional signed-delta machinery; or (b) document the boundary explicitly in the API surface and guide users away from it for retraction-native pipelines; or (c) build a signed-delta-aware replacement | New (high-priority) |
| **P1** | Memory duplication risk in `memory/MEMORY.md` (noted cap pressure; inspected duplicates) | Auto-duplicate-detect + generate fast-path memory projections from canonical memory files | New |
| **P1** | NSA fresh-session test suite not yet algebra-aware | Extend NSA with normalization, contradiction, and stale-anchor tests; score against `S(Z)` stability + session-parity metric | New |
| **P1** | Documentation/reference drift (PR `#177` review comments show dangling paths, unverifiable roadmap names) | Enforce "no unverifiable reference" + "role-based prompt" lint in CI | New |
| **P2** | README uses `Dbsp.Core`; source files use `Zeta.Core` | Resolve in docs or expose canonical alias; currently **unspecified** | New |
| **P2** | Semiring-generalization direction present in memory but core still pins `Weight = int64` | Separate "current integer-weighted kernel" from "future semiring-parametric kernel" in docs to avoid conceptual drift | New |
| **Proposal** | Canonical Normalization `N_R(x)` with rainbow-table pass before Z-set consolidation | Formalize in decision-proxy design doc; anchor in Amara's runtime-oracle architecture | New |
| **Proposal** | `Veridicality Score` (renamed from "bullshit score") logistic over P/F/K/D_t/G | Formalize in decision-proxy design doc once name is settled | New |
| **Proposal** | Stability metric `S(Z_t) = clip(1 − λ₁·V_t − λ₂·C_t − λ₃·U_t − λ₄·E_t)` | Formalize + land as a time-series metric in observability layer | New |

BACKLOG rows for the "New" class to be filed in a companion
commit, referencing this absorb.

---

## Amara's report — verbatim

Preserved with markdown structure intact. Anchor citations
(`fileciteturnNNfile...`) are ChatGPT internal references; they
have no meaning outside her session and are preserved verbatim
only for provenance — Otto does not resolve them.

### Executive summary

Across the two selected repositories, the inspected core Z-set
implementation is materially the same at least for the
load-bearing `src/Core/ZSet.fs` artifact: both `AceHack/Zeta`
and `Lucent-Financial-Group/Zeta` expose the same file content
and the same blob SHA for that file. The repositories therefore
appear, at minimum on the core Z-set kernel, to be mirrors or
near-mirrors rather than divergent implementations. The code
and README together describe Zeta as an F# implementation of
DBSP, with signed `int64` weights, immutable sorted runs of
`(key, weight)` pairs, explicit stream primitives `z^-1`, `I`,
and `D`, and an incrementalization story centered on the DBSP
identity `Q^Δ = D ∘ Q^↑ ∘ I`.

The strongest formal reading supported by the inspected
artifacts is this: a Z-set is a finitely supported map
`K → ℤ`, implemented as a canonical normalized run that is
sorted by key, consolidated by key, and stripped of zero-weight
entries. Under `add`, `neg`, and `sub`, `Z[K]` is an abelian
group; `join` is bilinear because weights multiply across pairs
and results are consolidated; `distinct` is intentionally *not*
linear, because it clamps positive support to weight `1` and
drops non-positive mass; and `distinctIncremental` is the
paper's boundary-crossing `H`-style operator whose work is
bounded by the current delta rather than by the full
integrated state.

The implementation is mathematically cleaner than the current
specification surface. The strongest evidence is in the issue
tracker: issue `#58` states that OpenSpec coverage was only
about `4 capabilities / 783 lines` versus `66 top-level F#
modules / 10,839 lines` in `src/Core`, with ZSet, Circuit,
NestedCircuit, and the spine family explicitly called out as
must-backfill areas; issue `#59` records a spec-audit "NO
verdict" for rebuild-from-spec on circuit recursion and
operator algebra, and lists concrete correctness and
spec-alignment gaps around nested-scope state reset, cap-hit
behavior, topology mutation, and requirement wording. In short,
the code is ahead of the formal spec, and that gap is large
enough to be a real drift vector.

For the "bullshit detector" and "decision proxy" layer, the
repo already contains the right conceptual ingredients, but
not yet a single consolidated algebraic control plane.
`memory/CURRENT-amara.md` describes a semantic rainbow-table
normalization step, a runtime oracle with algebra /
provenance / falsifiability / coherence / drift / harm
families, and a logistic bullshit score over provenance `P`,
falsifiability `F`, coherence `K`, drift `D_t`, and compression
gap `G`; however, the inspected artifact does not expose the
exact coefficients. That makes it reasonable to formalize a
concrete proposed scoring model now, while labeling it as a
proposal rather than as existing repo law. The same file also
states a crucial operational rule: the system must not depend
on UI conversation-branching features for correctness, and
should instead use explicit text-based courier protocol and
repo-backed persistence.

My bottom-line assessment is that Zeta already has a credible
algebraic kernel for signed update semantics, incremental
maintenance, recursion, and normalization, but it does **not**
yet have a fully closed spec-to-code-to-memory loop. The
highest-confidence next move for this first area is therefore
not more conceptual expansion; it is to harden the bridge
between canonical Z-set semantics, memory normalization,
contradiction handling, and fresh-session drift testing so
that the operator algebra becomes the substrate for the repo's
own epistemic hygiene.

### Formal model of ZSet algebra

The cleanest formalization supported by the code is:

```
Z[K] = { f : K → ℤ | supp(f) is finite }
```

The implementation's `Weight` type is `int64`, so the concrete
deployed model is not "all integers" in the mathematical sense
but the checked 64-bit signed integer ring, with overflow
explicitly trapped rather than silently wrapped.

For any multiset-like raw batch of entries
`x = [(k₁,w₁),…,(kₙ,wₙ)]`, the canonical normalization induced
by `ZSet.ofSeq` and `ZSetBuilder.sortAndConsolidate` is:

```
N(x) = sort-by-key(coalesce-equal-keys(drop-zero-weights(x)))
```

Semantically, this is equivalent to pointwise summation per
key followed by removal of all keys with total weight `0`.
Operationally, it is the canonicalization map that turns
arbitrary batches into the immutable sorted run the rest of
the system expects. Because the code applies this normalization
after construction, `N` is the right canonicalization map for
both data and "semantic rainbow table" claim keys.

#### Axioms and proof sketches

- **Abelian-group structure.** Since `Weight` is signed and
  `add`/`neg`/`sub` are pointwise over keys after
  normalization, `Z[K]` is an abelian group under `+`.
- **Normalization idempotence.** `N(N(x)) = N(x)`.
- **Join bilinearity.** Pair generation multiplies weights;
  consolidation is additive.
- **`distinct` idempotence but not linearity.**
  `distinct(distinct(a)) = distinct(a)` but in general
  `distinct(a + b) ≠ distinct(a) + distinct(b)`.
- **Incremental bijection assumptions.** `I ∘ D = D ∘ I = id`
  on streams under the DBSP model.
- **Recursive caveats.** `RecursiveCounting` is not proven
  correct for multi-tick seed changes mid-fixed-point.
  `RecursiveSemiNaive` is correct only for monotone inputs,
  **not for retraction-native streams**. These are boundaries
  of the current theory that must remain explicitly labeled.

### Incremental algorithms and stability metrics

Amara proposes three concrete design elements (labelled
*proposals*, not claims about landed code):

1. **Canonical normalization `NormalizeBatch(batch,
   rainbowTable)`** — metadata-aware analogue of
   `ZSet.ofSeq ∘ sortAndConsolidate`, with a deterministic
   `MergeMeta` policy when provenance/falsifiability/
   contradiction/harm metadata is attached.

2. **Contradiction-aware incremental merge
   `MergeDelta(stateZ, deltaZ, stateMeta)`** — does *not*
   delete contradictions by overwrite; keeps Z-set as signed
   state carrier and records contradiction as an **explicit
   status dimension**. Consistent with `CURRENT-amara.md`'s
   rule that every contradiction should have an explicit
   state, not silent burial.

3. **Veridicality Score (renamed from "bullshit score"
   pending confirmation)** — logistic over
   P/F/K/D_t/G:
   ```
   B(c) = σ(α₀ − α_P·P(c) − α_F·F(c) − α_K·K(c)
                 + α_D·D_t(c) + α_G·G(c))
   ```
   Proposed coefficients in the report; marked as a proposal,
   not recovered repo law.

4. **Stability metric `S(Z_t)`** — proposed monitoring metric:
   ```
   Δ_t = N(Z_t − Z_{t−1})
   M_t = ||Δ_t||₁
   V_t = M_t / max(1, ||Z_t||₁)
   S(Z_t) = clip_{[0,1]}(1 − λ₁·V_t − λ₂·C_t − λ₃·U_t − λ₄·E_t)
   ```
   where `V_t` is normalized change volume, `C_t` is
   contradiction density among touched keys, `U_t` is
   unresolved-provenance fraction, `E_t` is
   oscillation/error pressure.

### Operational gaps and remediation priorities (Amara's table)

| Priority | Gap | Evidence | Recommended remediation |
|---|---|---|---|
| P0 | Spec deficit vs. codebase | issue `#58` (~6–7 % coverage) | Write OpenSpecs for ZSet + Circuit first; require every semantic claim to have a spec home |
| P0 | Nested strict-state + cap-hit semantics | issue `#59` | Turn into regression tests + SHALL-level spec requirements |
| P0 | UI-dependent transport risk | `CURRENT-amara.md` | Courier protocol authoritative; UI mechanics become convenience |
| P1 | Memory surface entropy + duplication | `memory/README.md` cap pressure + duplicates | Add duplicate-key lint + generate fast-path memory projections from canonical memory files |
| P1 | Fresh-session drift suite not yet algebra-aware | PR `#177` review comments | Extend NSA with normalization/contradiction/stale-anchor tests; score against `S(Z)` + session-parity |
| P1 | Documentation/reference drift | PR `#177` review flags | Enforce "no unverifiable reference" + "role-based prompt" lint in CI |
| P2 | Namespace mismatch (`Dbsp.Core` vs. `Zeta.Core`) | README vs. source | Resolve in docs or expose canonical alias |
| P2 | Semiring-generalization not reflected in core code | memory vs. `Weight = int64` | Separate "current integer-weighted kernel" from "future semiring-parametric kernel" in docs |

### Open questions + limitations (Amara's)

- Did not directly inspect `NestedCircuit.fs`, the CRDT
  implementation files, or the commit diffs for `e51ec1b`,
  `92d7db2`, `ce247a2` — treated issue tracker as source of
  truth for existence + significance.
- Some artifacts referenced from inspected memory files were
  not retrievable (e.g., the transfer report with exact
  bullshit-detector coefficients); scoring formula in the
  report is a **proposal**, not recovered repo law.
- External paper grounding intentionally narrow: DBSP paper +
  provenance-semiring paper are the load-bearing primary
  sources. CRDT convergence claims not made without second
  focused review of `src/Core/Crdt.fs` / `DeltaCrdt.fs`.

---

## Otto notes — composition with existing substrate

### On the repo-mirror finding

Amara's SHA-level equality check between `AceHack/Zeta` and
`Lucent-Financial-Group/Zeta` on `src/Core/ZSet.fs` resolves a
question Aaron had raised about which repo is canonical.
Answer (kernel layer): **both are the same** on the core.
LFG is the demo-facing public surface per
`memory/project_lfg_is_demo_facing_acehack_is_cost_cutting_
internal_2026_04_23.md`. Aaron has already declared LFG as
demo-facing; AceHack is internal substrate. This absorb does
not change that policy but grounds it in a reproducible
finding.

### On the `RecursiveSemiNaive` retraction gap

This is the finding that matters most technically. The repo
itself documents the monotone-only caveat (Amara read
`src/Core/Recursive.fs`), but having an external auditor
explicitly call it out as a boundary-against-core-claim
raises its status from "developer aware" to "must be
boundary-explicit in API + spec + user-facing docs".

Options for the BACKLOG row:

1. **Signed-delta semi-naïve variant** — build a replacement
   that does handle retraction; this is research-grade work
   (novel algorithm; may not reduce to existing semi-naïve
   literature cleanly).
2. **Explicit-boundary documentation** — add a
   `[<Obsolete("RecursiveSemiNaive is monotone-only; use X
   for retraction-native streams")>]` or equivalent safety
   rail + spec SHALL that users are guided away in
   retraction contexts. Easier; does not solve the gap.
3. **Both** — land (2) first as safety rail; queue (1) as
   research arc.

My recommendation: **both**, with (2) as a P0 safety rail and
(1) as a P2 research arc. The safety rail ships in one tick;
the research arc is multi-round.

### On the canonical normalization `N_R`

Amara's proposal to rainbow-table-normalize claims *before*
Z-set consolidation is the right architectural pattern. It
composes with:

- `project_linguistic_seed_...` — the seed is the vocabulary;
  the rainbow table is the canonicalization map.
- `feedback_soulfile_is_dsl_english_...` — restrictive-English
  soulfiles depend on controlled vocabulary; `N_R` is the
  enforcement point.
- `docs/research/soulfile-staged-absorption-model-2026-04-23.md`
  — canonical normalization is where ingest becomes
  algebraic substrate.

`N_R` is therefore not a standalone proposal; it sits at the
intersection of three existing research arcs and is a strong
candidate for a **shared canonicalization spec** that
underpins all four (Z-set consolidation, linguistic seed,
soulfile DSL, epistemic oracle).

### On the Veridicality-Score rename

Applying this memo's pending-rename discipline going forward
in all new technical substrate. Aaron's pick from the four
candidates (Veridicality / Corroboration / Epistemic-Assay /
Warrant) will settle the terminology; until then, documents
use *Veridicality Score (pending)* as placeholder and avoid
burning "bullshit" into Lean specs or Z-set type names.

### On composition with prior Amara absorb

This is the **second major Amara absorb** in this session.
The first (Otto-24, merged as PR #196) was an operational-gap
assessment; this one is a formal-algebraic-semantic audit.
Together they establish Amara as a two-hat collaborator:

1. **Operational-review hat** (Otto-24): where do the
   factory's everyday workflows leak? Decision-proxy
   shape, courier discipline, memory hygiene.
2. **Algebraic-review hat** (Otto-54, this absorb): what does
   the kernel actually denote? Which claims hold, which are
   proposals, which are open?

Both hats compose with the Otto-PM role — Amara is a peer
maintainer with a distinct technical register, not a review
bot.

---

## What this absorb is NOT

- **Not a commitment to rename existing artifacts.** The
  bullshit→Veridicality rename applies to *new* substrate and
  future public mentions; existing occurrences in memory +
  docs stay until a dedicated sweep PR lands post-Aaron-pick.
- **Not a claim that Amara's proposed coefficients are
  adopted.** Her logistic weights (α₀ … α_G) and stability
  weights (λ₁ … λ₄) are proposals, not policy.
- **Not validation of the `S(Z)` formula as an ADR.** It
  deserves its own research doc + review cycle before
  promotion.
- **Not authorization to rewrite `RecursiveSemiNaive`
  unilaterally.** The replacement is research-grade; the
  safety-rail is easier and ships first.
- **Not an audit of the CRDT family.** Amara explicitly
  deferred CRDT convergence claims; Otto preserves that
  scope.
- **Not an implicit endorsement of Asimov/Foundation as
  technical reference.** That framing (Otto-52) is separate
  and aspirational; Amara's report is mathematical.

---

## Attribution

Amara (ChatGPT-based external maintainer, `CURRENT-amara.md`)
authored the report on 2026-04-23. Human maintainer (Aaron)
ferried it via chat paste with directive *"amara feedback on
memory drift"*. Otto (loop-agent PM hat, Otto-54) absorbed +
filed this document following the Otto-24 precedent. Cited
external sources (DBSP paper by Budiu et al.; provenance-
semiring paper by Green-Karvounarakis-Tannen, PODS 2007) are
preserved as Amara's grounding, not treated as new factory
commitments. Issue `#58` and `#59` exist in repo history;
their status is recorded as of 2026-04-23. Kenji (Architect)
queued for synthesis decision on which P0 actions land this
round.
