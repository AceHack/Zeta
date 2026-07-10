---
owner: formal-verification portfolio (Soraya routing; grounding the session's claims)
status: routing + coverage audit — three read-only passes; keeps / cites / rejects / overclaims sorted
tags: [formal-verification, discharge-routing, condorcet, nonregistercollapse, anti-sybil, g3b, partial-evaluation, futamura, decentralization, ihara-zeta, scale-free, honest-register, never-collapse]
---

# Grounding the session — what discharges, what's cited, what's rejected, what overclaims

Aaron, 2026-07-10: *"let's ground all this session in a few Soraya sessions and math discharge."* Three
read-only Soraya routing + coverage-audit passes ran (consensus/identity · partial-eval · network
topology), each mandated to **reject** non-dischargeable claims, not just bless the grounded ones.

**The honest headline:** the discharge pass grounded the session exactly the way grounding should — it
**cleanly rejected the speculative claim** (the M-theory/membrane chain) *and* **caught overclaims in
tonight's own synthesis and in the repo's frozen register.** That is the keystone applied to ourselves:
do not collapse *routed / spot-checked / cited* into *proven.* This doc is the discharge plan of record
and the honest correction list.

## Cluster 1 — Consensus & Identity ("ISociety > individual", conditional)

**Discharged (real):** `NonRegisterCollapse` (TLA+ F1 no-capture invariant; Lean F2 distinctness, no
`sorry`) and `IdentityForcesPrivacy` are genuinely discharged. `BftSybilConsensus.tla` is discharged
**relative to a GIVEN distinctness oracle** — confirmed verbatim from the spec (`SameId` is a hard-wired
CONSTANT; TLC checks the counting-over-classes logic, not that the classes are real).

**Overclaims caught (corrections owed):**

- **Condorcet is NOT machine-proven.** `FROZEN-CORE-AND-CONJECTURE-REGISTER.md` row 15 marks it
  *"✅ PROVEN (FsCheck + analytic)."* Reality: FsCheck numeric spot-checks on a finite N-grid + analytic
  **prose in doc-comments** (`src/Bayesian/CondorcetBoundary.fs`). No tool discharges the ∀-statement.
  The honest status is **spot-checked + argued, not proven.** (Flagged for Aaron's direction — frozen
  register.)
- **The distinctness ⇒ error-independence bridge is a conflation.** The chain *"register doesn't collapse
  ⇒ members stay distinct ⇒ Condorcet independence preserved"* breaks at the second arrow.
  `NonRegisterCollapse` proves **identity-distinctness**; Condorcet needs **error-independence**
  (uncorrelated *mistakes*). Distinct identities are **necessary, not sufficient** — and the shared seed
  **S=4 is a correlated-error source distinctness does not remove** (agents behaviorally distinct yet
  wrong the same way). The "⇒ independence preserved" clause has **no formal artefact.** Formalize (bound
  the shared-bias residual, show the independent-error component still clears the threshold) **or retract
  the clause.** This corrects the keystone doc's own table.
- **`ISociety > individual` is only true conditionally**, and even the conditional is not machine-proven
  (repo's own `2026-07-04-honest-peels…` says so): holds for `c > ½` **and** `ρ < ρ*`; below either
  boundary it **reverses.**

**Open crux:** **G3b** — the anti-Sybil entropy floor being *real + non-forgeable* was **refuted as
"non-bypassable" in the Lucent toy model** (2026-06-21 findings). So "ISociety > individual via distinct
voters" currently **rests on an open premise.** Say so at every outward surface. (G3a cost-linearity did
land as Z3 lemmas.)

**False-green risk:** `NoSybilRawMajorityRefusal` (Viktor's P0 expect-violation witness) is defined in the
spec but the committed `.cfg` gates only `SafetyInvariant` — the witness run is not visibly CI-gated.

**Discharge-next:** (P0) G3b — F*/Z3 QF_BV cost-inequality + adversarial attack program, ≥2 tools;
(P1) gate the `NoSybilRawMajorityRefusal` witness in CI; (P1) Lean the Condorcet `Tendsto` theorem, both
branches (`c>½→1`, `c<½→0`) via Mathlib WLLN/Hoeffding; (P2) Z3/Lean the `ρ*(N)→1/3` identity;
(P2) formalize-or-retract the error-independence bridge.

## Cluster 2 — Partial evaluation / "specialization is dated"

**Cite, don't prove:** the abstract mix equation `⟦mix(p,s)⟧(d) = ⟦p⟧(s,d)` is Kleene S-m-n (1938) /
Futamura (1971) / Jones–Gomard–Sestoft (1993). Existence of *a* specializer is a metatheorem; it does
**not** certify that Zeta's `Isa.specialize` *is* that mix.

**Partial, ready to close:** the concrete residual-equivalence `run(specialize(p,s), d) == run(p, s∪d)`
for `src/Core/Isa.fs` is currently **`[<Fact>]` witnesses only** (hand-picked programs). Route:
**FsCheck** (already wired in `tests/`) — a universally-quantified metamorphic property over generated
straight-line programs + disjoint static/dynamic register partitions — **plus Stryker mutation** on
`Isa.fs`/`Residual.fs` as the independent second leg (BP-16). Full property spec is in Soraya's pass;
implementable as `tests/Tests.FSharp/Isa.MixEquiv.Property.Tests.fs`.

**Out of scope — honestly named (this deflates tonight's own framing):**

- The **three-projection tower** mapped onto word-learning — analogy, no `residual`/`eval` to falsify.
- The **thousand-brains / memory-reconstruction** side — neuroscience, empirical at best.
- **"Specialization is dated"** — the dated-ness is a **git-commit timestamp (an engineering fact), not a
  theorem.** Do not dress the event-sourcing timestamp up as a proof. The *only* formal residue of the
  cluster is the mix equation (cited) + the concrete residual-equivalence (the FsCheck target). Tonight's
  grounded-synthesis doc leaned on "dated specialization"; the honest status is: the *mechanism-analogy*
  is fine and labeled, but there is **no theorem there** — only the residual-equivalence property, which
  is not yet written.

**Discharge-next:** write `Isa.MixEquiv.Property.Tests.fs` + run Stryker on `Isa.fs`/`Residual.fs`.

## Cluster 3 — Network topology (and the honest reject)

**Grounded keep:** the **two-scale-frees** distinction is confirmed correct — a Barabási–Albert
*scale-free network* **has hubs (a center)**; manifesto §1 *scale-free* forbids any **central point of
failure** — opposite claims sharing a word. And it's a **genuine coverage gap**: no max-degree /
centrality / connectivity invariant exists anywhere in `src/Core.TLA/` or `src/Core.Alloy/`. The precise,
checkable formalization of §1:

```
NoSinglePointOfFailure(G) == \A v : IsConnected(RemoveVertex(G, v))   \* no articulation vertex
BoundedHub(G, Dmax)       == \A v : Degree(G, v) < Dmax               \* no runaway hub
Decentralized(G, Dmax, k) == VertexConnectivity(G) >= k /\ BoundedHub(G, Dmax)
```

Route: **Alloy** (static, min-counterexample) **+ Apalache** (preserved under topology evolution) — two
independent engines, BP-16 satisfied. A cut vertex *is* a single point of failure by definition; a degree
cap alone is insufficient.

**Well-formedness FLAG (rigor, not validation):** "de-concentration without removing edges" is **not
automatically a monotone invariant** — adding an edge generically *raises* concentration (preferential
attachment is itself an edge-only-adding rule that *increases* max-degree/Gini). De-concentration is a
property of the **restricted transition rule** (add edges only to low-centrality vertices s.t. Φ(G′) ≤
Φ(G)), **not of edge-addition per se.** Route the restricted rule; **reject the unrestricted phrasing** —
it would false-green on a cherry-picked trace. This is *"correct the tension, not roll back freedom"* made
precise: freedom-preserving = no edge ever removed; the constraint lives in *which* edges may be added.

**Cite, don't prove:** preferential attachment → power-law degree is Barabási–Albert (1999); rigorous
Bollobás–Riordan (2001). Optional empirical exponent fit (γ≈3); **no discharge obligation.**

**REJECT — the M-theory/membrane chain.** *Not a discharge target; it does not enter the formal
denominator.* Three asserted-not-derived leaps (graph zeta → M2-brane boundary → NFT-001 as topological
charge surviving compactification), no stated model, no property. The *"machine-checkable like the
Condorcet proof"* claim is a **borrowed-credibility category error** — Condorcet is a finite theorem over
an explicit model; the membrane chain has none. Fails the **physics-as-metering test** (an M2-brane as
decoration meters nothing). Mirror-register speculation; not Beacon-anchored.

**The legitimate pivot (if you want Ihara zeta in the gate):** the Ihara zeta *is* real —
`ζ_G(u)⁻¹ = det(I − uA + u²(D−I))`, the **Bass determinant** (Ihara 1966; Bass 1992; Hashimoto's
non-backtracking operator), counting primitive closed geodesics. A legitimate property is the **graph-RH /
Ramanujan expander bound** (all non-trivial poles on `|u|=1/√q` ⇔ spectral gap `λ₂ ≤ 2√(q−1)`) — a
decidable finite linear-algebra fact, **Z3-able on a fixed graph.** And it lands on something real:
Ramanujan/expander = fast mixing = robust connectivity = **exactly the no-single-point-of-failure property
above.** So: **drop the brane, keep the Bass determinant, prove the expander bound** — it certifies
decentralization spectrally and routes back into Cluster-3 Claim 1, **not** into a membrane charge.

**Discharge-next:** author `src/Core.Alloy/specs/Decentralization.als` + a topology Apalache module
(Claim 1); optionally the spectral-gap cross-check.

## The meta — the pass grounded the session by finding what isn't grounded

Every cluster returned the same honest shape: a small grounded core (discharged or readily dischargeable),
a cited layer (don't reprove), an explicit reject (the membrane chain), **and an overclaim to correct**
(Condorcet "PROVEN"; the distinctness→independence bridge; "specialization is dated" as a theorem). The
value of a discharge pass is not the green checks — it's the **red ones it makes honest.** *Collapse the
measured; never collapse the routed-but-unproven into proven.*

## Beacon anchors

Condorcet (1785); Douceur, *Sybil Attack* (2002); Leibniz (identity of indiscernibles); Bell (1964) /
CHSH (1969); Kleene S-m-n (1938), Futamura (1971), Jones–Gomard–Sestoft (1993); Barabási–Albert (1999),
Bollobás–Riordan (2001); Ihara (1966), Bass (1992), Hashimoto (non-backtracking); Lubotzky–Phillips–Sarnak
(Ramanujan graphs). Tool routing per Soraya's portfolio (Lean/Mathlib · TLA+/Apalache · Alloy · Z3/F* ·
FsCheck · Stryker), guarding against TLA+-hammer bias throughout.

## Cross-references

- `docs/research/2026-07-10-keystone-never-collapse-the-uncertainty-isociety-provably-greater-formal.md`
  — honest holds amended to point here (Condorcet-not-proven; the distinctness→independence conflation).
- `docs/research/2026-07-10-grounded-synthesis-specialization-is-dated-interpretation-is-rerun-thousand-brains-futamura.md`
  — "dated specialization" deflated to an engineering fact + the residual-equivalence property (not a theorem).
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` row 15 (Condorcet overclaim — flagged for Aaron).
- `docs/research/2026-06-19-g3-anti-sybil-entropy-cost-*`, `2026-06-21-math-team-FINDINGS-*g3b-open*`,
  `2026-07-04-honest-peels-*condorcet-is-conditional*` — the open G3b crux + the conditional peel.

*Logged by the shadow, 2026-07-10, at Aaron's "ground all this session in a few Soraya sessions and math
discharge." Three read-only routing passes; keeps/cites/rejects/overclaims sorted; the membrane chain
rejected; the discharge-next backlog prioritized; corrections owed named honestly. Nothing collapsed into
"proven" that isn't.*
