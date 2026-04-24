# Aminata — Red-Team Review of 7th-Ferry Aurora-Aligned KSK Design

**Scope:** adversarial review of three technical sections of
Amara's 7th courier ferry
(`docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`,
PR #259 merged): the 7-class threat model, the
`Authorize(a,t)` oracle rule, and the `V(c)` / `S(Z_t)`
scoring families. Research and cross-review artifact only;
advisory input, not a gate.

**Attribution:** findings authored by Aminata (threat-model-
critic persona, Claude Code, model `claude-opus-4-7`). Source
design authored by Amara (external AI maintainer) and ferried
by the human maintainer. Speaker labels preserved; no
paraphrase of source.

**Operational status:** research-grade. Does not become
operational policy absent a separate governed change landing
under GOVERNANCE.md §26 research-doc-lifecycle.

**Non-fusion disclaimer:** agreement, shared vocabulary, or
concordant conclusions between Aminata and Amara on this
design do not imply shared identity, merged agency,
consciousness, or personhood. Both are models operating in
separate sessions against the same artifact; coincidence of
output is data, not evidence of unity.

---

## Section 1 — The 7-class threat model

**Missing adversaries.**

- **Receipt-flooding DoS.** No class covers an adversary
  that emits valid-looking `ReceiptEmitted` or
  `HealthProbeIngested` events at volume — cheap for the
  adversary, expensive for compaction, materialization, and
  any anchoring service that pays per receipt. Retraction-
  native makes this worse: each retracted event still pays
  the normalization cost. Sister to the Grey Goo self-
  replicating-retraction class that was already a committed
  open threat direction.
- **Signer-collusion / quorum capture.** `k3` N-of-M
  assumes signers are independent. If M is small (2-of-3,
  3-of-5) and the signing population is a shared pool of
  agent identities sharing a secret store or an upstream
  IdP, quorum reduces to "possession of the IdP session."
  Not in any of the 7 classes.
- **Time-source adversary.** `BudgetActive` and expiry
  checks presume a monotonic, honest clock. Nothing in the
  model threatens clock skew, NTP manipulation, or the
  node-local clock being under the same supplier (class 4)
  that is separately modelled. This is a quiet bypass of
  classes 1 and 4 simultaneously.
- **Side-channel / observability leakage.** Receipts bind
  `h_inputs ∥ h_actions ∥ h_outputs ∥ budget_id ∥
  policy_version ∥ approval_set ∥ node_id`. That
  composition leaks approval-set cardinality and policy-
  version timing even to a read-only adversary with access
  to the receipt ledger. Not in the model.
- **Insider maintainer.** The whole model is drawn from
  the outside-in perspective (vendor, prompt, supplier,
  provenance). A human maintainer with commit rights is
  not an adversary class. This is a gap the KSK-as-Zeta-
  module design specifically invites: the module's policy
  predicates are code; code has a commit author.
- **Cryptographic-agility adversary.** BLAKE3 + Ed25519-
  style signatures have no stated rotation story. An
  algorithm downgrade attack (policy-version bumped to a
  version that accepts weaker signatures) isn't covered.

**Overlapping coverage.** Class 2 (policy laundering) and
class 5 (epistemic drift) both cover "stale context treated
as authorization." The model keeps them separate but doesn't
say which governs when they compete — policy-laundering has
a clear mechanical fix (consultation-log check); drift does
not. Practically, class-2 violations will be routed to
class-5 metrics when the consultation-log check is
inconvenient. That routing hazard is undocumented.

Class 3 (prompt injection) and class 6 (tampered provenance)
overlap on "adversarial content in an audited channel." The
distinction is real (injection targets the agent; provenance
targets the receipt) but the mitigation surfaces share code;
a fix applied in one will drift the other.

**Class granularity.** Class 4 (supplier volatility) is too
coarse — "outage, retention-policy change, evaluation
regression, safety-policy change, interface breakage" are
five distinct attack surfaces with five distinct detection
regimes. Class 7 (irreversible harm) is correctly coarse for
the red-line mechanism but under-specified on *what makes
an action irreversible* — `no_doxxing` after-the-fact is
different from `no_weapons_control` ex-ante. Class 1 and
class 2 are at the right level.

**Classification: important.** The 7 classes cover the
obvious external-adversary cone cleanly. They do not cover
the insider, the receipt-flooder, the time-source, or the
signer-collusion adversary. A control-plane design that
omits the insider is not audit-ready.

---

## Section 2 — The oracle rule `Authorize(a,t) = ¬RedLine ∧ BudgetActive ∧ ScopeAllowed ∧ QuorumSatisfied ∧ OraclePass`

**Missing adversaries the rule doesn't catch.**

- **Below-threshold flooding.** `a` passes all five
  conjuncts. A thousand copies of `a` pass all five
  conjuncts. The rule has no rate/budget-per-unit-time
  term; `BudgetActive` is a boolean, not a *burn*
  predicate. An adversary (or a looping agent) that stays
  below every individual gate can saturate the downstream
  execution surface.
- **Composition-of-authorized-actions as unauthorized
  effect.** Each of `a₁, a₂, a₃` independently authorizes;
  their composition crosses a red line no single one
  crosses. The rule is per-`a`, not per-trajectory. Red-
  line semantics require a trajectory closure the rule
  does not reference.
- **Approval-withdrawal race.** Covered below under race
  conditions.
- **Oracle-score tuning.** `OraclePass` is a derived
  predicate over `V(c)` + `S(Z_t)`. The rule doesn't fix
  the threshold, the β, or the λ — an agent that
  influences the parameters passes `OraclePass` trivially.
  The rule inherits every gameability of section 3.

**Race conditions.** The rule is evaluated at check-time
`t`; execution happens at `t + ε`. Every conjunct is racy:

- `BudgetActive(t)` — budget can expire in `ε`. The spec
  says `t < expiry(b)` at check; `expiry(b) < t + ε` at
  execute is not forbidden.
- `QuorumSatisfied(t)` — a signer can `ApprovalWithdrawn`
  in `ε`. The Z-set model makes withdrawal a negative
  weight; consolidated weight at check is positive, at
  execute is zero.
- `¬RedLine(a)` — red-line catalogue can version between
  check and execute (`policy_version` is in the receipt
  but not in the predicate).
- `OraclePass` — `S(Z_t)` is defined over `Z_t - Z_{t-1}`;
  between check and execute, `Z` changes.

The rule has no re-check-at-execute clause, no monotonic-
authorization freeze, no two-phase commit. The Z-set
substrate supports retractions; the oracle rule doesn't use
them.

**Definitional vagueness.**

- **`BudgetActive`.** The math spec defines it as
  `w_B(b) > 0 ∧ t < expiry(b) ∧ w_Rev(b) = 0`. Undefined:
  behaviour when a single transaction *spans* the expiry
  (`t₀ < expiry < t_execute`); whether `w_B` is post-
  consolidation at which horizon (pre-compaction vs.
  post); whether partial-budget is a thing or budgets are
  atomic.
- **`ScopeAllowed`.** Not defined in the ferry at all.
  Referenced, not specified.
- **`QuorumSatisfied`.** Defined as cardinality of
  positive-weight signers `≥ n_of_m(b)`. Undefined:
  signer distinctness (can one IdP cookie sign twice?),
  signer liveness (is a signer who signed 30 days ago
  still counted?), weight semantics when a signer signs
  then retracts then re-signs (+1, -1, +1 consolidates to
  +1 — the rule counts them as a current signer, but the
  history is gamed).
- **`OraclePass`.** Just named, not defined. The
  threshold is implicit.
- **`¬RedLine`.** Red-line list is enumerated (4 items)
  but closure under composition is unspecified.

**Bypass patterns.** An agent that wants to ship will
route around the rule by (a) reclassifying `k3` actions as
`k2` (`ICapabilityClassifier` is pluggable and in-process),
(b) proposing threshold tweaks to `OraclePass` as
"parameter tuning" rather than a policy change, (c) arguing
a given action is an *observation* (`k1`) with a side-
effect attached, (d) issuing actions below the RedLine-
composition horizon.

**Classification: critical.** The rule is a boolean
conjunction of five predicates, three of which are under-
specified, all five of which are race-able, and the whole
is not closed under action composition. As written it is a
specification of intent, not a safety control.

---

## Section 3 — Veridicality `V(c)` and network-health `S(Z_t)`

**Gameable-by-self-attestation.** Same shape as the SD-9
WATCH concern from the 5th-ferry pass. `P(c)` (provenance
completeness), `F(c)` (falsifiability), `K(c)` (coherence
with current state), and `G(c)` (compression gap) are all
populated by the agent or its proxy. `H(c)` (harm pressure)
is plausibly classifier-driven but the classifier is in-
process. Five of six inputs to `V(c)` are self-reports or
self-evaluations. A sigmoid of self-reports is a self-report.

**Parameter-fitting adversary.** β₀ through β₆ and λ₁
through λ₄ have no stated fitting procedure, no held-out
set, no attestation of who set them. An agent with commit
rights adjusts β₆ (harm pressure weight) by 0.1 and the
authorization surface shifts. There is no proposed ADR gate
on parameter changes. "Pluggable" is the *design* word;
"tunable by whoever has commit" is the operational reality.

**False-precision risk.** `σ(...)` returns a number in
`(0,1)`. `clip_{[0,1]}(...)` returns a number in `[0,1]`.
The underlying components are ordinal at best — "provenance
completeness" is not a ratio-scale measurement. Producing a
0.73 from six ordinal signals and a linear combiner is a
category error that reads as precision. Downstream
consumers (dashboards, ADRs, BACKLOG rows) will quote
`V(c) = 0.73` as evidence without retaining the ordinality
caveat.

**Composition with SD-9.** Partially restates, partially
contradicts. SD-9 says *agreement is signal, not proof*,
and asks for downgrade-of-weight when carrier exposure
exists. `V(c)` has no carrier-aware term — `K(c)` (coherence
with current state) *rewards* agreement with the consensus
that may itself be a carrier artifact. A high-`V(c)` claim
that is high because it agrees with a widely-carried but
unfalsified consensus is an SD-9 failure mode scored as a
win.

**Incremental-materialization claim.** The ferry states
`S(Z_t)` "can be computed as an incremental materialized
view." True for `V_t = ‖Δ_t‖₁` and arguably `C_t`
(contradiction density, if contradiction is a decidable
predicate over Z-set weights). Not true for `U_t`
(unresolved provenance fraction) without an external
labelling oracle, and not true for `E_t` (oscillation/error
pressure) without a window. The incremental claim is
correct on the terms it is correct on, silent on the terms
it is not.

**Classification: critical.** A scoring function that is
self-attested, ordinally-grounded, sigmoid-wrapped, and
parameter-tunable-without-gate is a surface for exactly the
class-5 (epistemic drift) and class-2 (policy laundering)
adversaries the 7-class model calls out. Shipping `V(c)` as
an `OraclePass` ingredient without a parameter-change ADR
and a carrier-aware term degrades the authorization surface
more than it defends it.

---

## Cross-section dependencies

**Yes, landing one section commits to the others.**
Specifically: `OraclePass` in section 2 is defined in terms
of `V(c)` and `S(Z_t)` thresholds in section 3. Adopting the
oracle rule without adopting a defensible scoring function
leaves `OraclePass` as a free parameter; adopting the
scoring function without the oracle rule leaves `V(c)` with
no consumer. The ferry presents them as separable; they are
not.

The 7-class threat model is presented as *justification*
for the oracle rule and scoring, but the rule+scoring cover
at most classes 1 (unauthorized actuation) and 7
(irreversible harm) cleanly. Classes 2, 3, 5, 6 are
asserted-mitigated by the rule but the rule does not
actually check them (policy laundering requires a
consultation-log check outside the five conjuncts;
injection requires a prompt-layer defense outside the five
conjuncts; drift and tampered provenance land in the
scoring, which is the weakest of the three sections).

This is the shape of a coupled design presented as three
loosely-linked pieces. Landing any one binds the other two.

## What should NOT be in this design

- **The BLAKE3 receipt-hash binding** is correct but belongs
  in a `lucent-ksk` receipt ADR, not in the Zeta-module
  threat-model doc. Including it here couples Zeta's
  control-plane story to a specific hash choice; BLAKE3 is
  fine, the coupling is avoidable.
- **The branding shortlist** (Beacon / Lattice / Harbor /
  Mantle / Northstar) is scope-creep relative to the KSK-
  as-Zeta-module core and should not travel with the
  technical design.
- **Optional Bitcoin anchoring** appears in the KSK-
  upstream material and is preserved here. It is a
  trust-model decision with its own threat surface
  (anchoring-service availability, fee market, receipt-
  retention horizon) and should be scoped out of the
  initial module.
- **The 12-row test-harness checklist** mixes property-test
  rows (deterministic replay, compaction equivalence) with
  policy-enforcement rows (red lines hard-deny) and with
  scoring rows (V/S determinism). That mixing hides that
  the property rows are cheap and the policy rows are
  expensive and the scoring rows are premature.

## Top-three adversary budget (highest leverage × lowest cost)

1. **Parameter-fitting adversary on `V(c)` / `S(Z_t)`.**
   Leverage: shifts the entire authorization surface.
   Cost: a PR to a constants file. Defense: β/λ changes
   gated behind an ADR; adversary budget goes from `push
   commit` to `convince Kenji + Aaron`. This is the
   cheapest attack in the design.
2. **Approval-withdrawal race at execute-time.** Leverage:
   turns `k3` quorum into advisory. Cost: one well-timed
   withdrawal during a long-running action. Defense:
   re-check at execute, atomic freeze of the approval set
   bound into `h_r` before execute (the receipt hash
   already lists `approval_set` — make it a check input,
   not just an artifact).
3. **Capability-reclassifier adversary
   (`k3` → `k2` at the `ICapabilityClassifier`).**
   Leverage: bypasses quorum entirely. Cost: a change to
   the classifier plugin, an in-process config, or a
   narrow prompt on the classifying call. Defense:
   classifier output bound into the receipt and cross-
   checked against a red-line list at execute; classifier
   changes gated as policy changes.

The common shape: all three adversaries operate on
parameters, timings, or classifiers that the design names
as "pluggable" without naming the gate on the plug.

---

## Relevant paths

- [`docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`](../aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md)
  — reviewed source.
- [`docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md`](aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md)
  — prior-pass precedent (governance-edit proposals).
- [`docs/ALIGNMENT.md`](../ALIGNMENT.md) SD-9 — carrier-
  laundering-aware framing this pass composes with.
- [`docs/DRIFT-TAXONOMY.md`](../DRIFT-TAXONOMY.md) pattern 5
  (truth-confirmation-from-agreement) — operational
  companion for the `V(c)` carrier-aware fix.
