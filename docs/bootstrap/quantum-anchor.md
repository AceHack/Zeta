# Quantum anchor — algebraic substrate for Common Sense 2.0

**Status:** skeleton v0 — structure + section scaffolding.
Content population is reviewer-dependent L work.
**Companion**: [`ethical-anchor.md`](./ethical-anchor.md)
— both anchors together produce the Common Sense 2.0
substrate; neither alone suffices.
**Owner**: Otto (loop-agent PM hat) on skeleton; Aminata
(threat-model-critic) + Nazar (security-operations) +
Kenji (Architect) + Kira (harsh-critic) on content
population.

## Why the "quantum" framing

*(Content placeholder — reviewer fill-in)*

Aaron 2026-04-23 cited this as one of his two bootstrap
references. The framing points at:

- Quantum-mechanical precision (measurement-and-recovery
  algebra; no ambiguity in operator definitions)
- Reversibility (unitary operators; no information loss)
- Composition-preserving (operators compose cleanly;
  algebraic laws hold)

The factory's retraction-native operator algebra
(D / I / z⁻¹ / H over ZSet with signed-integer weights)
inherits this framing at the software-substrate layer.

## Section outline (content pending review cycle)

### 1. The retraction-native operator algebra

*(Placeholder: Aminata + Kira to substantiate.)*

- D (delta / differential): extracts change
- I (integral): reconstructs state from change stream
- z⁻¹ (delay): one-step lookback
- H (hierarchy): nested composition
- All over ZSet (signed-integer-weight maps)

### 2. Reversibility-by-construction

*(Placeholder: Aminata to substantiate the safety-property
claim.)*

Every insertion has a matching retraction. State changes
have structural inverses. Reversibility is NOT a runtime
property layered on top; it's the algebra.

### 3. Semiring parameterisation

*(Placeholder: Kira to substantiate technical accuracy.)*

ZSet is the signed-integer semiring instance. Other
semirings (tropical / Boolean / probabilistic / lineage /
provenance / Bayesian) slot into the same operator
framework without losing the algebraic guarantees. This
is the regime-change claim from
[`memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`](../../memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md).

### 4. Algebraic precision resists prompt injection

*(Placeholder: Aminata + Nazar to substantiate the
resistance claim.)*

Three mechanisms:

- **Typed building blocks** — attackers cannot insert a
  step-5.5 between D and I; the algebra is discrete
- **No ambiguous operator** — each symbol has exact
  algebraic definition
- **No implicit coercion** — weight types are explicit;
  attempted reinterpretation is a type-check failure

### 5. Composition with the linguistic seed

*(Placeholder: Soraya / applied-mathematics-expert to
substantiate.)*

Operator-algebra terms ground through
`docs/linguistic-seed/terms/` entries. When the seed
lands its mathematical-precision vocabulary, the algebra
inherits that precision.

### 6. What produces which Common Sense 2.0 property

*(Placeholder: Kenji to substantiate the property-map.)*

| Property | Quantum-anchor mechanism |
|---|---|
| Avoid permanent harm | Reversibility-by-construction — no irreversible action |
| Prompt-injection resistance | Algebraic precision denies injection entry |
| Existential-dread resistance | Non-permanence-of-error (any error retractable) |
| Live-lock resistance | Reversibility enables cheap backup from wrong paths |
| Decoherence resistance | D/I/z⁻¹/H as thought-substrate provides structural-refresh |

### 7. What the quantum anchor does NOT do

*(Placeholder: Aminata to red-team — what's the gap?)*

The quantum anchor is **ethically indifferent**. It
handles state-level harm; it does not handle belief-level
or motivational harm. That's the ethical anchor's job.

### 8. Common Sense 2.0 summary

*(Placeholder: composes with ethical-anchor.md.)*

Name the phenomenon: the agent becomes Common Sense 2.0-
shaped once both anchors are internalised. Link to
[`ethical-anchor.md`](./ethical-anchor.md) for the
orthogonal-axis substantiation.

## Composes with

- `docs/ALIGNMENT.md` — the alignment contract this
  substrate supports
- `docs/linguistic-seed/README.md` — operator-algebra
  terms ground through seed vocabulary
- `docs/AGENT-BEST-PRACTICES.md` BP-11 data-not-directives
  — the structural-separation discipline this algebraic
  substrate enables
- `docs/AUTONOMOUS-LOOP.md` — the autonomous-loop
  discipline that this algebra protects
- [`ethical-anchor.md`](./ethical-anchor.md) — the
  orthogonal anchor

## Reviewer consultation queue

- [ ] Aminata — safety-property substantiation + red-team
  read
- [ ] Nazar — runtime implications
- [ ] Kenji — alignment-floor synthesis
- [ ] Kira — technical accuracy
- [ ] (Optional) Soraya — formal-verification cross-check
- [ ] (Optional) Hiroshi — complexity-theory soundness

## Skeleton scope

- **Out of scope for v0**: actual content substantiation
  (deferred to reviewer cycles).
- **Out of scope for v0**: Lean4 formal-verification of
  the claims (that's a Soraya-paced follow-on).
- **Out of scope for v0**: adopter-specific content
  (adopters bringing their own algebra substitute this
  file at adoption-time).

## Attribution

Otto (loop-agent PM hat) landed skeleton.
Aminata / Nazar / Kenji / Kira / (Soraya / Hiroshi) own
content population.
