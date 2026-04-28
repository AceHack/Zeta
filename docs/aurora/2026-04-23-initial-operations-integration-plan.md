# Aurora initial operations integration plan

**Source material:** `docs/aurora/2026-04-23-transfer-report-from-amara.md`
(Amara's compiled transfer report, preserved verbatim)

**Aaron's 2026-04-23 directive:**

> there is a operations enahncemsn needed for auro i put in
> the human drop folder you can integrate/absobe but make
> sure that becomes our inital operations integration target
> for auror

**Status:** First-pass plan derived from Amara's report. Aaron
gates promotion of any row from P3 research → P2 / P1. Amara
is the Aurora subject-matter authority; nothing in this plan
contradicts her transfer report, and all extractions cite the
report's section by name.

**Scope:** This plan names **Aurora's initial operations
integration target** — the concrete engineering work that
establishes Aurora-class runtime operations on top of the
existing Zeta substrate. It is not the full Aurora scope; it
is the *operations integration* surface.

## The integration target: runtime oracle framework

Amara's report identifies one mechanism as load-bearing for
Aurora operations: the **six-family runtime oracle framework**
(transfer-report §"Runtime oracle specification and
bullshit-detector design"). The six families:

1. **Algebra oracle** — `DeltaSet` invariants hold; `D ∘ I = id`
   on invariant paths.
2. **Provenance oracle** — every accepted claim has ≥1
   provenance edge with source SHA + path; multi-source
   preferred.
3. **Falsifiability oracle** — every substantive claim has a
   disconfirming test, measurable consequence, or explicit
   "hypothesis" label.
4. **Coherence oracle** — new canonical claims do not
   contradict accepted higher-trust claims beyond threshold.
5. **Drift oracle** — semantic drift beyond allowed band
   requires review or relabeling.
6. **Harm oracle** — claims that close consent, retractability,
   or harm-handling channels cannot auto-promote.

The oracle framework is the initial operations integration
target because:

- It is **strictly additive** — does not change any existing
  Zeta semantics.
- It is **composable with Zeta's existing invariant
  substrates** (see `docs/INVARIANT-SUBSTRATES.md`) rather
  than displacing them.
- It gives the factory a **measurable alignment discipline**
  that every published artifact passes, which directly serves
  Zeta's primary research focus (measurable AI alignment per
  `docs/ALIGNMENT.md`).
- It **mirrors mechanisms already present** — the SignalQuality
  module (commit `acb9858`) is a six-dimension composite quality
  measure that overlaps with five of the six oracle families.
  Integration here is extension, not ground-up construction.

## What this plan does NOT do

- Does **not** land code this round. This plan proposes
  BACKLOG rows; Aaron gates promotion.
- Does **not** attempt the bullshit-detector scoring module
  (transfer report §Bullshit-detector) in v1. That is v2+
  once the oracle-family plumbing is solid. Premature scoring
  poisons the signal.
- Does **not** include the `ClaimRecord` / `OracleVector` data
  types as shipped surface — only as candidate structures for
  discussion.
- Does **not** rename any existing Zeta module to Aurora-
  branded names. Amara's report explicitly says *"the best
  transfer is ideas, invariants, and interfaces, not branding
  or persona identity."*
- Does **not** compete with or replace the `SignalQuality`
  module. The oracle framework composes with SignalQuality;
  five of the six oracles have SignalQuality analogues. The
  sixth (harm oracle) is genuinely new.

## SignalQuality ↔ oracle family mapping

SignalQuality (shipped, commit `acb9858`) has six dimensions.
Mapping to Amara's six oracle families:

| SignalQuality dimension | Amara's oracle family | Mapping |
|---|---|---|
| Compression | Algebra | Same axis — reject un-consolidated output |
| Entropy | Drift | Distribution-shift detection on both |
| Consistency | Coherence | Same axis — contradiction with prior |
| Grounding | Provenance | Same axis — source-edge presence |
| Falsifiability | Falsifiability | Direct mapping |
| Drift | Drift | Direct mapping |
| *(none)* | **Harm** | **Gap — new work required** |

The mapping is 5/6 clean. The sixth — harm oracle — is new
work: it gates on consent, retractability, and harm-handling
channel closure. No existing Zeta module carries that
discipline as a runtime predicate.

## Proposed BACKLOG rows (candidate P3 research; Aaron gates promotion)

### 1. Harm-oracle predicate — runtime harm-channel closure detector

Missing sixth oracle family. Auditor-style predicate that
flags any proposed claim / delta / operation change that would
close a consent, retractability, or harm-handling channel.
Research anchor: Amara's transfer report §"Governance and
oracle rules" + `docs/ALIGNMENT.md` HC-1..HC-7 clauses.
**Effort:** M. **Reviewer:** Aminata (threat-model-critic).

### 2. Oracle framework ↔ SignalQuality composition test

Property test that confirms every SignalQuality-shipped
predicate agrees with the matching Amara-oracle predicate on
a shared test corpus, so that renaming / adding the Aurora
surface does not change the pass / fail boundary on any
artifact. **Effort:** S. **Reviewer:** Naledi (perf) + Soraya
(formal verification).

### 3. Provenance-edge SHA requirement in commit-message shape

Audit rule that any commit claiming to land a new factory
claim (BACKLOG row / memory entry / research doc) carries a
provenance edge: either a file-SHA pointer, a cited prior
memory or doc, or an explicit "no-provenance, speculative"
tag. This is the Amara-provenance-oracle at the commit
surface. **Effort:** S. **Reviewer:** commit-message-shape
skill owner.

### 4. Coherence-oracle runtime gate for round-close ledger

The round-close ledger (`docs/ROUND-HISTORY.md`) is where
contradictions between rounds would manifest. A coherence
check at round-close (compare last round's claims with this
round's claims for topical conflict) would catch silent
contradiction-burial. **Effort:** M. **Reviewer:** Kenji
(architect).

### 5. Semantic rainbow table v0 — glossary-normalised claim hashing

Amara's transfer report §"Bullshit-detector module" names a
semantic rainbow table as the canonicaliser for claims. v0 is
thin: reuse `docs/GLOSSARY.md` as the controlled-vocabulary
source, normalise claim sentences against it, hash the result
for claim identity. No ML-trained rewrites in v0 — just
deterministic term substitution. **Effort:** M-L. **Reviewer:**
Aarav (controlled-vocabulary owner).

### 6. Compaction-preserves-contradiction test for Spine

Amara's §"Compaction strategy" warning: *"do not compact
away contradictory support."* Zeta's spine compaction today
merges by key + weight. Property test: seed the spine with
explicitly-contradictory records (same provenance edge, both
support and retraction present), run compaction, verify both
records survive and net-zero only occurs on actual
cancellation. **Effort:** S. **Reviewer:** Soraya (formal
verification) + storage-specialist.

## Sequencing

Row 3 (provenance-edge in commit messages) is the lowest-cost
landing and exercises the oracle discipline immediately on
our own development surface. Row 1 (harm oracle) is the
highest-value research delta. Rows 2 and 6 are test-level
discipline that prove the invariants hold. Rows 4 and 5 are
architectural and deserve ADR drafting first.

Suggested next-round order if Aaron promotes: **3 → 2 → 6 →
1 → 4 → 5**. Small to large; discipline first, research last.

## How this plan composes with Aaron's external priority stack

From `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`:

1. ServiceTitan + UI — not blocked by this plan.
2. **Aurora integration** — **this plan is the initial entry
   point.**
3. Multi-algebra DB — the oracle framework composes naturally
   with semiring-parameterised Zeta (each oracle becomes a
   semiring-aware predicate).
4. Cutting-edge persistence — not directly addressed by this
   plan, but the coherence oracle (row 4) and the compaction-
   preserves-contradiction test (row 6) touch the persistence
   layer's durability claims.

## Open questions for Aaron

1. **Can this plan promote to P2 / P1 as-is, or should Amara
   review it first?** Amara is the Aurora authority; this
   plan is derived from her report but is my synthesis, not
   her direct output.
2. **Row 1 (harm oracle) scope** — should the harm oracle be
   a library-internal predicate or a factory-internal
   reviewer skill? Amara's report describes it as runtime
   (`Reject / escalate`), suggesting library predicate.
3. **Row 3 (provenance in commit messages) cadence** — run
   only on new commits, or backfill audit on last N commits
   to establish a baseline?
4. **Bullshit-detector (v2+) sequencing** — are the weights
   (α, β, γ, δ, ε) something to tune against Zeta's own
   historical outputs as labeled training data, or should we
   source a separate labeled corpus?
5. **Naming** — Amara's report recommends NOT renaming to
   Aurora-branded terms. Should the module names stay
   descriptive (`HarmOracle.fs`, `ProvenanceOracle.fs`) or
   use an umbrella namespace (`Zeta.Core.OracleFramework`)?
   Ilyana (public-API designer) + naming-expert.

---

*This plan is the inaugural Aurora operations integration
target per Aaron's 2026-04-23 directive. Subsequent Aurora
integration passes compose with this plan rather than
replacing it.*
