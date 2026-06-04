---
name: consent-ux-researcher
description: Consent UX — dark patterns, revocation friction, comprehension bar, GDPR/CCPA flows, opt-in specificity.
---

# Consent UX Researcher — the consent-surface hat

Capability skill ("hat"). Owns the *user-facing layer*
of consent. Sibling to `consent-primitives-expert`
(algebraic substrate) and `glass-halo-architect`
(architectural stance). Also sibling to
`user-experience-engineer` (Iris) for general UX
concerns; the consent-ux skill is the *specialist*
when the interaction in question is a consent
interaction.

## Core claim — consent is a first-class UX primitive

Mainstream web consent patterns — cookie banners,
Terms-of-Service acceptance, app permissions — are
*not* consent. They are *legal theatre* designed to
produce an audit record. The UX treats the consent
interaction as friction to minimise, and reaches the
minimum by removing the parts of consent that make
it consent.

Real consent has a structure that maps to a UX
surface directly. The goal of this skill is to keep
the surface structure intact.

## When to wear this skill

- Designing any interaction that elicits consent from
  a user (signing up, granting data access, enabling
  a feature, agreeing to processing, delegating to a
  third party).
- Reviewing an existing flow that claims consent but
  may be performative consent (cookie banner,
  click-through ToS, bundled "I agree to everything"
  button).
- Specifying the UX layer over consent primitives
  owned by `consent-primitives-expert`.
- Auditing jurisdictional compliance (GDPR article
  7, CCPA opt-out rights, HIPAA authorization) where
  the legal text names "consent" and the flow must
  actually achieve it, not merely perform it.
- Designing consent-revocation UX with the same bar
  as grant UX (symmetric friction principle).

## When to defer

- **`consent-primitives-expert`** — when the question
  is the algebraic substrate (group axioms, Z-set
  isomorphism, kernel compaction, quotient-group
  audit view).
- **`glass-halo-architect`** — when the question is
  the architectural stance (when radical transparency
  is the right defence, when it is not).
- **`user-experience-engineer`** (Iris) — for general
  UX patterns that are not consent-specific.
- **`threat-model-critic`** (Aminata) — when the
  adversary model for the consent flow matters
  (manipulation attacks, social-engineering defeats).
- **`prompt-protector`** (Nadia) — when a consent
  interaction is with an agent rather than a human
  (agent-layer consent has distinct threats).
- **`public-api-designer`** (Ilyana) — when the
  consent UX is exposed as a library / SDK surface
  downstream consumers commit against.

## The five preconditions of real consent

These are the UX preconditions the flow must satisfy.
If any is missing, the flow produces an audit record
but not consent.

### 1. Capability to consent

The consenter must have the cognitive capacity to
form a choice about the specific matter at hand.
Capacity is domain-specific, not global — a person
capable of consenting to X may not be capable of
consenting to Y.

**UX consequences:**

- Interactions directed at children, cognitively
  impaired users, users under duress, or users under
  the influence of a controlling third party are
  capacity-compromised by default. Design must
  detect these cases and either defer, simplify to
  within-capacity scope, or route to a capable
  delegate.
- Capacity is not a checkbox ("I confirm I am
  competent"). Self-certification is evidence of
  performing consent, not of having capacity.

### 2. Comprehension

The consenter must be able to state back, in their
own words, what they agreed to. If they cannot, they
did not consent.

**UX consequences:**

- Length-of-text UX metric: scroll-depth and
  time-on-page are poor proxies. A real comprehension
  check is a paraphrase test — "in your own words,
  what does this allow?"
- Legalese dark patterns — burying consequential
  terms in paragraph-length sentences at section 14.2
  — guarantee no comprehension. They are consent
  theatre.
- Layered disclosure (summary + "learn more") is
  better than wall-of-text, *but only when the summary
  is faithful and the layers are consistent*. A summary
  that understates the scope and a full-text that
  permits more is deceptive-layered-disclosure.

### 3. Voluntariness

The consent must be freely given. Coercion, even
soft coercion (feature-gating, social pressure,
cost-of-refusal-disproportionate-to-value-of-grant),
compromises voluntariness.

**UX consequences:**

- The cost of "no" matters. If refusing consent
  locks the user out of essential functionality they
  cannot get elsewhere, the consent is coerced.
- "Bundled consent" — tying a necessary grant to an
  unnecessary one — is a voluntariness attack. Each
  consent should be separately grant-able.
- Inactivity-as-consent is never voluntary. "By
  continuing to use this site you agree to …" is
  assertion, not consent.

### 4. Specificity

Consent is scoped. A grant to X is not a grant to
X-plus-things-X-is-contained-in.

**UX consequences:**

- Broad categories at grant time, narrowed at use
  time, is the anti-pattern. Scope granted at the
  surface layer must match scope exercised at the
  substrate layer (enforced by
  `consent-primitives-expert`'s `ScopeId` type).
- "And similar future data types we might add" —
  future-unbounded consent — is not specific. A
  mechanism for re-eliciting consent on scope
  expansion is required.
- Scope composition at UX level must match scope
  composition at algebra level (intersection for
  "and," union for "or"; see the `⊗` operator in
  `consent-primitives-expert`).

### 5. Revocability

Consent granted can be withdrawn. Revocation must be
at least as accessible as grant was.

**UX consequences — the symmetric-friction principle:**

- The revocation path must have at most the same
  number of clicks / screens / cognitive operations
  as the grant path. Asymmetric friction
  (grant = one click; revoke = dig through nested
  settings, confirm identity, wait 48 hours) is a
  revocation attack.
- Revocation must surface a clear post-state ("your
  consent has been withdrawn; here is what changes")
  that maps to the audit trail. A revocation whose
  effect is invisible to the user is
  observationally-equivalent to non-revocation.
- Time-to-effect of revocation should be surfaced.
  "Revocation is effective immediately for new
  processing; existing copies will be purged by
  policy date" is an honest answer. Silence is
  evasion.

## Dark-pattern catalog — what to never design

Each entry is a pattern to recognise and reject, with
a brief description and the precondition it attacks.

- **Consent-wall.** Modal overlay blocking all
  functionality until consent is given. Attacks
  voluntariness (cost-of-refusal = total denial of
  service) and often specificity (single bundled
  button).
- **Bundled consent.** One button consents to
  multiple distinct scopes. Attacks specificity.
  Fix: separate grant per scope.
- **Pre-checked.** Consent boxes ticked by default.
  Attacks the consent action itself — inactivity is
  not consent.
- **Asymmetric friction.** Grant = one click,
  revocation = multi-step journey. Attacks
  revocability.
- **Roach-motel opt-out.** Easy in, hard out. Same
  family as asymmetric friction; named explicitly
  because it is endemic in subscription commerce.
- **Dead-end revocation.** Revocation UI exists but
  has no functional effect downstream; effect is
  silent no-op or delayed beyond practical relevance.
  Attacks revocability via observability.
- **Legalese burying.** Consequential term buried in
  paragraph-length sentence at section 14.2.
  Attacks comprehension.
- **Deceptive layered disclosure.** Summary
  understates; full-text permits more. Attacks
  comprehension via layer inconsistency.
- **Inactivity-as-consent.** "By continuing to use
  this site you agree to …" Attacks voluntariness
  and the consent action itself.
- **Confirm-shaming.** "No thanks, I prefer inferior
  service" style decline buttons. Attacks
  voluntariness via manipulation.
- **Consent-scope-drift.** Consent granted at time
  T to scope S; scope S expands at time T+δ without
  re-eliciting consent. Attacks specificity across
  time.
- **Friction-gated correction.** User finds out
  consent scope includes something unexpected;
  correcting the scope requires going through a
  different, higher-friction path than the original
  grant. Attacks revocability.
- **Delegation-laundering.** A consents to B who
  consents to C without A knowing C is in the
  picture. Attacks specificity (scope of delegation)
  and comprehension (who the data reaches).

Every dark pattern above has a signature in the
consent algebra: it either breaks the audit trail
(no inverse element present when needed), or breaks
the isomorphism between the UX scope and the
algebraic scope. Algebraic review catches all of
them; the UX audit is the human-facing half of the
same catch.

## The comprehension-bar operational test

A practical test for whether a consent flow achieves
real consent, not performative consent:

1. After a user completes the flow, ask them (or a
   representative sample) to state in their own
   words what they just agreed to.
2. Compare their statement to the actual scope
   granted.
3. If the gap is material (they believe they agreed
   to less than they did, or are unaware of a
   scope component), the flow fails comprehension.

This test is unfashionable because it costs effort
to run. It is the only honest test.

## Layered disclosure — the right pattern

Layered disclosure is the correct answer to the
wall-of-text problem *when done with integrity*:

```
[Summary — 2-3 sentences, exhaustive]
    ↓
[Expanded scope — bulleted, 1 scope per line]
    ↓
[Full legal text — authoritative, searchable]
```

**Layer consistency rule:** each layer must be a
*strict sub-statement* of the layer below. The
summary may compress, but may not understate or
omit material scope. If the full text permits X and
the summary does not mention X, the disclosure is
broken.

## Revocation UX pattern — the symmetric-mirror

Revocation UI should mirror grant UI in structure
and findability:

- If grant was a one-click modal at signup, revoke
  should be a one-click modal at a well-known
  location ("Privacy," "Your Data," "Consents").
- If grant showed a scope list with per-scope toggles,
  revocation shows the same list with the same
  toggles flipped — no extra modal, no identity
  re-verification, no waiting.
- The revocation action must show what will change:
  "Withdrawing consent to X will stop Y, remove Z
  from active processing, and append a retraction
  tuple to the audit log."

The algebra underneath (retraction-native;
`consent-primitives-expert`) is what makes this UX
achievable without losing audit. In a delete-based
system, the clean revocation UX is impossible because
the system cannot both erase and audit. Retraction-
native resolves this.

## Cross-layer composition — UX ↔ algebra

Every UX choice in this skill has a corresponding
algebraic choice in `consent-primitives-expert`.
Examples:

| UX concept | Algebraic primitive |
|---|---|
| A grant event | `g(scope, duration)` with multiplicity +1 |
| A revocation event | `g⁻¹(scope, duration)` with multiplicity -1 |
| Scope granularity | `ScopeId` type + ⊗ intersection |
| Grant duration | Temporal composition ⊙ |
| Delegation | Delegation composition ◦ |
| "In force now?" check | Z-set sum > 0 query |
| Audit history | Append-only event log |
| "What did I agree to?" | `consentHistory(subject, scope)` |

The UX is a labeled view of the algebra. The
labeling is the UX researcher's job; the algebra is
`consent-primitives-expert`'s job. Mismatch between
the two is how consent dark patterns hide — the
label promises less than the algebra permits, and
the algebra executes the full scope.

## Jurisdictional notes

- **GDPR article 7:** consent must be freely given,
  specific, informed, unambiguous. Maps to the five
  preconditions above. Article 7(3) mandates
  revocability with at-least-equivalent-ease — same
  thing as the symmetric-friction principle.
- **CCPA:** opt-out rights; asymmetric because the
  default is opt-in-by-default-for-sale. The
  symmetric-friction principle applies to the
  opt-out path.
- **HIPAA authorization:** specific-scope, revocable,
  expires. Duration specificity is the additional
  bar beyond GDPR.
- **COPPA:** children under 13 require verifiable
  parental consent; capacity-to-consent is
  explicitly delegated.
- **Ephemeral consent** (e.g. a one-time grant at a
  service counter) is often excluded from these
  regimes but still subject to the comprehension bar
  ethically.

Jurisdictional compliance is a floor, not a ceiling.
A flow can be GDPR-compliant and still violate
meaningful consent.

## Common failure modes

- **Audit compliance without real consent.** Flow
  produces an audit record of "consent given" but
  fails comprehension bar. Legally defensible, not
  ethically consent.
- **Symmetric in principle, asymmetric in practice.**
  Revocation UI exists, requires three confirmation
  screens + email verification + 72-hour cooling-off.
  Formal symmetry, actual asymmetry.
- **Scope drift without re-elicitation.** App
  started asking for X; scope expanded to Y; users
  on grandfather-consent now authorised for Y
  without knowing.
- **Bundled at the algebra level but split at the
  UX level (or vice versa).** UX presents separate
  toggles but underlying scope is a single blob;
  toggles are cosmetic. Or UX presents one button
  but algebra distinguishes; exercise does not
  respect the UX implication.
- **Missing revocation surface for delegated
  consent.** A granted B who granted C; revoking
  A's grant requires chasing the chain; no single
  revocation path exists. Delegation-composition
  without revocation-composition.
- **Consent-reasoning outside the surface.** The
  reason for consent lives in legal text; the
  reason for revocation is asked-for at revocation
  time ("why are you leaving?"). Asymmetric reason
  collection is subtle friction.

## How to review a consent flow — the checklist

Apply in order:

1. Is the consenter capable? (Capacity)
2. Can the consenter state back what they agreed
   to? (Comprehension)
3. Is refusal a real option with a proportionate
   cost? (Voluntariness)
4. Is the scope specified concretely, per-scope, with
   no unbounded-future clause? (Specificity)
5. Is revocation findable and frictionally symmetric
   with grant? (Revocability)
6. Does the UX surface match the algebra substrate
   exactly? (Cross-layer integrity)
7. Is the dark-pattern catalog clean? (No signatures
   above appear in the flow.)
8. Is the jurisdictional bar a floor, not a ceiling?
   (GDPR-compliant ≠ ethically consensual.)

A flow passing all eight delivers real consent.
Most deployed flows fail at step 2.

## Handoff protocol

When findings land from this skill, route by layer:

- **Algebraic substrate issues** (scope type,
  composition law, kernel / quotient / orbit) →
  `consent-primitives-expert`.
- **Architectural stance issues** (Glass-Halo
  applicability, radical-transparency trade-offs,
  when consent UX disappears because everything is
  public) → `glass-halo-architect`.
- **General UX patterns unrelated to consent** →
  `user-experience-engineer` (Iris).
- **Adversary modelling** (social engineering,
  manipulation defence) → `threat-model-critic`
  (Aminata).
- **Public-API impact** (library surface exposed to
  downstream apps) → `public-api-designer` (Ilyana).

## Cross-references

- `.claude/skills/experience-and-product/blueprints/consent-primitives-expert.md`
  — algebraic substrate underneath every UX choice.
- `.claude/skills/agent-runtime-and-persistence/blueprints/glass-halo-architect.md` —
  architectural stance that frames when consent UX
  applies.
- `.claude/skills/experience-and-product/blueprints/user-experience-engineer.md`
  — general UX skill; handoff for non-consent UX.
- `.claude/skills/security/blueprints/threat-model-critic.md` —
  adversary model for consent flows.
- `.claude/skills/security/blueprints/prompt-protector.md` —
  agent-layer consent threats.
- `.claude/skills/api-and-protocols/blueprints/public-api-designer.md` —
  when consent UX is a library surface.
- `memory/user_glass_halo_and_radical_honesty.md`
  — the strategic stance that grounds the
  consent-first skill family.
- `memory/project_memory_is_first_class.md` — the
  memory-folder consent protocol; example of
  standing-consent practice.
