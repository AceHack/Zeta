---
name: Amara's 7th courier ferry — "Aurora-Aligned KSK Design Research Across Zeta and lucent-ksk" (~4000 words, math spec, 7-class threat model, proposed ADR, test checklist, branding shortlist); scheduled for Otto-88 dedicated absorb per CC-002 discipline; 2026-04-23
description: Aaron Otto-87 mid-tick paste of Amara's 7th ferry — substantive Aurora-KSK design doc with Zeta-native event algebra, BLAKE3 receipt hashing, Veridicality/network-health oracle scoring, 12-row test checklist, 7-step implementation order, 5-name branding shortlist (Beacon/Lattice/Harbor/Mantle/Northstar), Anthropic/OpenAI-supply-chain-risk framing scoped carefully. Not inline-absorbed Otto-87 (CC-002; Otto-87 was mid-Aurora-README); scheduled Otto-88 per PR #196/#211/#219/#221/#235/#245 prior precedent
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-23 Otto-87 mid-tick paste:
*"another amara update"* followed by the full 7th-ferry text.

Full ferry content preserved in the conversation transcript
(`/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/1937bff2-017c-40b3-adc3-f4e226801a3d.jsonl`
— exact paste available there). The Otto-88 absorb PR will
include the verbatim content in
`docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`
per prior-ferry-absorb template.

## Ferry scope

Title: **Aurora-Aligned KSK Design Research Across Zeta and lucent-ksk**.

Amara indexed 11 files pulled from 3 repos (LFG/Zeta,
AceHack/Zeta, LFG/lucent-ksk) and delivered a design-grade
Aurora-aligned KSK specification. This is the ferry the 5th
ferry's Artifact-D (Aurora README, just landed PR #257) was
anticipating — the 7th ferry turns the vision-layer README
into a math-spec-backed implementation blueprint.

## Five key findings (Amara's executive summary)

1. **Zeta is already a real algebraic substrate** — DBSP
   implementation with `z⁻¹` / `D` / `I` / incrementalisation
   identity + spine / Arrow / CRDT / recursion surfaces.
2. **Factory/governance layer is unusually explicit** —
   `AGENTS.md` + `ALIGNMENT.md` treat alignment as measurable
   property over commits+memory+rounds, not rhetoric.
3. **Aurora-facing material is not vapor** — drift-taxonomy
   precursor + Amara absorbs + decision-proxy ADR show
   formalised external-review loop.
4. **KSK is coherent enough to design against now** — YAML
   architecture + development guide define k1/k2/k3
   capability surfaces + signed budget tokens + N-of-M
   approvals + one-tap revocation + signed receipts + health
   probes + disputes + verdicts + optional Bitcoin anchoring.
5. **Supply-chain-risk framing carefully scoped** — Amara
   did NOT find official U.S. government designation of
   Anthropic/OpenAI as formal supply-chain-risk entities.
   Defensible narrower framing: they are external
   AI/software suppliers governed under standard supply-
   chain-risk practices; same pattern applies to any
   high-consequence vendor. **Honest scoping; not weaponised.**

## Core design proposal

### Three-identity synthesis

- **Zeta** = algebraic substrate (DBSP / Z-sets / replay /
  compaction).
- **KSK** = authorization, provenance, revocation membrane
  around action (budgets / approvals / receipts /
  disputes / red-lines).
- **Aurora** = larger program composing both into legible
  human-governable control plane.

### Threat-model (7 classes)

1. Unauthorized actuation.
2. Policy laundering (fake proxy reviews).
3. Prompt-injection / hostile-context drift.
4. Supplier volatility (vendor-side changes).
5. Epistemic drift (contradictions / provenance decay).
6. Tampered or incomplete provenance.
7. Irreversible harm.

### Oracle rule formalisation

```
Authorize(a, t) =
  ¬RedLine(a)
  ∧ BudgetActive(a, t)
  ∧ ScopeAllowed(a)
  ∧ QuorumSatisfied(a, t)
  ∧ OraclePass(a, t)
```

class(a) ∈ {k1, k2, k3}; k1 no human approval; k2 valid
budget; k3 valid budget + N-of-M quorum.

### Veridicality score (proposed)

V(c) = σ(β₀ + β₁(1-P) + β₂(1-F) + β₃(1-K) + β₄D_t + β₅G + β₆H)

where P = provenance completeness; F = falsifiability;
K = coherence; D_t = temporal drift; G = compression gap;
H = harm pressure.

### Network-health metric (proposed)

S(Z_t) = clip[0,1](1 - λ₁V_t - λ₂C_t - λ₃U_t - λ₄E_t)

where V_t = normalized change volume; C_t = contradiction
density; U_t = unresolved provenance fraction; E_t =
oscillation/error pressure.

### Zeta-native event algebra

Budget state Z-set, approval state keyed Z-set, receipt
stream Z-set (negative weight = retraction/invalidation).
Formal budget-active / quorum-satisfied conditions
expressed as materialised views over the event streams.

### BLAKE3 receipt hashing

h_r = BLAKE3(h_inputs ∥ h_actions ∥ h_outputs ∥ budget_id
∥ policy_version ∥ approval_set ∥ node_id)

With agent + node signatures on h_r for replay + dispute
object form.

### Proposed ADR

**Context.** Aurora needs local authorization membrane
around external model vendors; Zeta has the algebra; KSK
has the policy concepts.

**Decision.** Implement KSK as Zeta module with budgets /
approvals / revocations / receipts / disputes / probes
as first-class event streams; authorization + health as
materialised views; vendor models outside authority plane.

**Consequences.** Revocability + replay + testability +
policy transparency; discipline required (no silent
imperative shortcuts; no "model just did this"; no
destructive compaction).

### Minimal Zeta module interface (10 typed surfaces)

`ICapabilityClassifier` / `IBudgetStore` /
`IRevocationIndex` / `IApprovalStore` / `IReceiptStore` /
`IOracleScorer` / `IPolicyEngine` / `IHealthProjector` /
`IDisputeLedger` / `IAnchorService`.

### Canonical views

`ActiveBudgets`, `RevokedBudgets`, `ApprovalQuorums`,
`AuthorizationState`, `ReceiptLedger`, `DisputeState`,
`NetworkHealth`.

### Implementation test checklist (12 required tests)

Capability classification determinism / budget validity /
quorum / red lines / receipt integrity / replay
determinism / compaction equivalence / oracle scoring
determinism / drift handling / decision-proxy integrity /
vendor isolation / recursive boundary.

### Implementation order (7 steps)

1. Typed events and schemas.
2. Pure authorization projector.
3. Receipt hashing/signing + replay harness.
4. Revocation propagation tests + k3 quorum tests.
5. Oracle scoring as pluggable projector.
6. Decision-proxy consultation logs as receipt-linked
   evidence.
7. Optional anchoring only after local replay + dispute
   story strong.

## Branding proposal (NEW — update to Aurora README shortlist)

Amara expanded the branding shortlist. 5th-ferry list was
Lucent KSK / Lucent Covenant / Halo Ledger / Meridian Gate /
Consent Spine. 7th ferry updates with:

- **Beacon** — meshes with visibility-lane vocabulary;
  suggests guidance, observability, operator visibility.
- **Lattice** — layered policy, quorum, constraint
  composition; not defensive-sounding.
- **Harbor** — safety, staging, revocation-friendly; not
  militarised.
- **Mantle** — protective-layer-above-execution; fits
  "membrane around action" messaging.
- **Northstar** — governance/guidance; trademark-noisier
  than others.

Preferred naming pattern per ferry:

- **Aurora** = vision + system architecture (internal).
- **Beacon KSK** or **Lattice KSK** = shippable control-
  plane offering (public).
- **Zeta** = algebraic/event-processing substrate
  (published library).

Clearly separates internal mythology from public-launch
language. Aurora-doesn't-carry-all-categories rationale
unchanged from 5th ferry.

## Why schedule dedicated Otto-88 absorb (not inline Otto-87)

- **CC-002 discipline** (Otto-75 resolution; held for 4+
  consecutive ferries since) — do not open new frames
  instead of closing on existing ones. Otto-87 already
  landed the Aurora README (closes 5th-ferry Artifact D);
  inline-absorbing a ~4000-word 7th ferry on top would
  regress to pre-CC-002 pattern.
- **Prior-ferry precedent** — 1st (PR #196) / 2nd / 3rd
  (PR #219) / 4th (PR #221) / 5th (PR #235) / 6th (PR #245)
  all got dedicated absorb ticks. 7th follows the pattern.
- **Ferry substance warrants dedicated budget** — math
  spec + ADR + test checklist + implementation order are
  all substantive enough to require careful absorption
  with Otto's notes + scope limits, not drive-by
  summarisation.

## What the Otto-88 absorb should land

1. Full verbatim-quote + notes absorb doc
   `docs/aurora/2026-04-23-amara-aurora-aligned-ksk-design-7th-ferry.md`
   (following the 5th + 6th ferry template — archive-
   header format self-applied; Otto's notes; scope limits;
   provenance paragraph at bottom).
2. BACKLOG row(s) candidates:
   - "KSK-as-Zeta-module implementation" (L effort;
     tracks the 7-step implementation order + 10-surface
     interface + 7-view materialisation).
   - "Veridicality + network-health oracle-scoring
     research" (M effort; tracks β / λ parameter fitting
     + test-harness).
   - "BLAKE3 receipt hashing + replay-deterministic
     harness" (M effort; tracks cryptographic content
     hashing + signature discipline).
   - "Aurora README branding shortlist update" (S effort;
     adds Beacon / Lattice / Harbor / Mantle / Northstar
     to the existing shortlist + preferred-pattern
     recommendation).
3. Aminata threat-model pass on the 7-class threat model
   + the proposed oracle rules (cheap follow-up after
   absorb; surfaces carrier-laundering-in-the-oracle-
   scoring-itself + cross-check against SD-9).
4. Memory update adding the 7-step implementation order
   as pointer.
5. Tick-history row citing Otto-88 absorb.

## Scope limits — what this scheduling memory does NOT authorize

- Does NOT authorise starting KSK-as-Zeta-module
  implementation pre-absorb. Implementation is a
  separately-filed BACKLOG row after Otto-88 absorb lands
  + after Aaron's input on prioritisation.
- Does NOT authorise applying the proposed ADR as an
  actual ADR without Aaron-sign-off (cross-repo
  architectural decision touching both Zeta and
  LFG/lucent-ksk).
- Does NOT authorise updating the Aurora README branding
  shortlist without Aaron's input — brand decisions
  remain M4 Aaron's call even though Amara is providing
  richer shortlist.
- Does NOT authorise the Anthropic/OpenAI-as-supply-
  chain-risk claim beyond Amara's carefully-scoped
  framing. Amara explicitly disclaimed the stronger
  version; Otto's absorb should preserve that scoping
  honesty.

## Composition with existing substrate

- **5th-ferry absorb** (PR #235) + **6th-ferry absorb**
  (PR #245) — 7th ferry extends the threads both opened:
  5th's Aurora/KSK integration is now backed by
  math spec; 6th's Muratori Row 3 (algebra ≠ ownership)
  is reinforced by 7th's "Zeta substrate / KSK
  authorization / Aurora program" three-identity
  framing.
- **Aurora README** (PR #257, just landed) — 7th ferry's
  proposal to treat KSK as a Zeta module fits the
  three-layer picture exactly; README's "how Aurora
  consumes KSK primitives" table aligns directly with
  ferry's 10-interface enumeration.
- **GOVERNANCE §33 archive-header discipline** (PR #247)
  — Otto-88 absorb will self-apply the format, seventh
  aurora/research doc in a row.
- **DRIFT-TAXONOMY pattern 5** (PR #238) + **SD-9**
  (PR #252) — the Veridicality score's provenance /
  falsifiability / coherence / drift / compression /
  harm components are operationalisation candidates for
  pattern 5 enforcement + SD-9 weight-downgrade
  mechanism.
- **Max attribution** — 7th ferry continues to cite
  `lucent-ksk` as existing substrate; Max's work remains
  the foundation under all KSK proposals. Preserve
  first-name-only attribution per Aaron's clearance.

## Sibling scheduling memories (discoverability)

- `project_amara_4th_ferry_memory_drift_alignment_claude_to_memories_drift_pending_dedicated_absorb_2026_04_23.md`
  — same shape, 4th ferry.
- `project_max_human_contributor_lfg_lucent_ksk_amara_5th_ferry_pending_absorb_otto_78_2026_04_23.md`
  — 5th ferry + Max introduction.
- `project_amara_6th_ferry_muratori_pattern_mapping_validation_pending_absorb_otto_82_2026_04_23.md`
  — 6th ferry scheduling.

## Bottom-line ferry message (quote)

> *"Zeta and KSK fit together naturally if you stop trying
> to make one swallow the other. Zeta should remain the
> algebraic substrate for change, replay, compaction, and
> observability. KSK should remain the policy/consent/
> receipt layer. Aurora should be the architecture that
> composes them into a human-governable control plane."*

Calibration: 7th ferry is the most architecturally-detailed
ferry to date. Prior ferries were pattern-level (4th), code-
adjacent-pedagogy (6th Muratori), or breadth (5th). 7th is
implementation-blueprint grade. The absorb should treat it
with proportionate care.
