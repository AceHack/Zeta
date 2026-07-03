---
name: consent-primitives-expert
description: Consent algebra — grants/revocations, abelian-group model, GDPR erasure vs audit, scope intersection, delegation.
---

# Consent Primitives Expert — the consent-algebra hat

Capability skill ("hat"). Owns the *algebraic and data-
structural* layer of consent. Sibling to
`consent-ux-researcher` (UX surface) and
`glass-halo-architect` (architectural stance / radical-
transparency-as-defense). This skill is the *engine*;
the others are the *chassis* and the *strategic stance*.

## Core claim — the isomorphism

**Consent, structurally, is an abelian group.** Identity
is "no consent given." Inverse is "retraction of the
consent." Composition is "append the event." Commutativity
means the final state depends on the multiset of events,
not the order.

**This group is isomorphic to Zeta's Z-set abelian group.**
Z-sets have multiplicity in ℤ; consent events have
multiplicity in {grant, retract}, which embeds cleanly
into ℤ (grant = +1, retract = -1, net effect = sum). The
operator algebra (D / I / z⁻¹ / H) over Z-sets therefore
applies *directly* to consent histories. Every invariant
proven for Z-set operators is a consent-algebra theorem
for free.

Implication: a consent substrate implemented on top of
Zeta inherits all the formal-verification work already
done. You do not need a second algebra; you need a
second semantic labeling over the same algebra.

## When to wear this skill

- Designing consent data structures that need to support
  both audit ("what did the user consent to, when, for
  how long?") and revocation ("withdraw consent without
  erasing history").
- Implementing scope composition — consent to X and
  consent to Y must compose to consent to X ∩ Y under
  an explicit intersection operation.
- Adding delegation — A consents to B, B consents to C,
  what composition rules give A's data effective consent
  to C (or refuse it)?
- Auditing a GDPR / CCPA / sectoral-privacy
  implementation that uses delete-based erasure and
  collides with audit requirements.
- Designing consent-lifecycle state machines (grant
  pending → active → expired → revoked → archived).
- Composing consent with Zeta's retraction-native
  operator algebra.

## When to defer

- **`consent-ux-researcher`** — when the question is
  UX surface (copy, interaction flow, dark-pattern
  avoidance, comprehension bar).
- **`glass-halo-architect`** — when the question is
  architectural stance (radical transparency as
  defense; when it applies, when it does not).
- **`public-api-designer`** (Ilyana) — when the
  consent primitives are about to become a public API
  of Zeta that downstream consumers commit against.
- **`threat-model-critic`** (Aminata) — when the
  consent model is load-bearing against a named
  adversary class.
- **`relational-algebra-expert`** /
  **`relational-database-expert`** — when the consent
  primitives must compose with relational operators.
- **`category-theory-expert`** — when the structure
  lifts past ring → module → algebra into genuine
  category-theoretic territory (consent as a functor,
  consent-change as natural transformation).

## The four group axioms, applied to consent

### 1. Closure

The composition of two consent events is a consent
event. `grant(scope_A) ∘ grant(scope_B)` is a
consent-history element that expresses "consent was
granted to A, and consent was granted to B."

### 2. Associativity

`(e₁ ∘ e₂) ∘ e₃ = e₁ ∘ (e₂ ∘ e₃)`. The final state
depends on the multiset of events, not the bracket
structure.

### 3. Identity — no-consent-given

The empty consent history. Neutral baseline. Nothing
granted, nothing retracted. Critically, the identity
element exists *as a first-class thing*, not as a
default absence — a user who has never consented
and a user who granted-then-revoked land at the same
group element.

**Design consequence:** the identity state must be
distinguishable in audit from "consent never
queried" — the former is an explicit choice
(revocation brought us back to identity), the latter
is an absence of action.

### 4. Inverse — retraction

For every consent grant `g(scope, duration)` there is
an inverse `g⁻¹(scope, duration)` which, when composed,
yields the identity. In retraction-native Zeta
semantics, the inverse is an explicit retraction tuple
with multiplicity -1.

**Why this matters:** GDPR-style "right to be
forgotten" via delete is a *destructive* operation that
loses audit. Retraction-via-inverse is a
*non-destructive* operation that preserves audit. The
effect (is consent currently in force?) is zero after
retraction; the history (what was consented, when,
withdrawn when, why) remains.

### Commutativity — the abelian property

`g_A ∘ g_B = g_B ∘ g_A`. The order of independent
grants does not affect the final consent-state.

For the *same scope*, `g_A ∘ g_A⁻¹ = identity`
regardless of bracket. For *different scopes*, the
grants are independent and trivially commute.

Commutativity is what makes audit log merging (across
replicas, across time windows, across retraction
chains) tractable — the CRDT literature calls this
the commutative-monoid property, which for consent we
strengthen to commutative group.

## The ring / module / algebra lift — "other goodies"

Abelian group = one operation (grant-compose). To reach
**ring**, add a second operation with distributivity.

Candidates for the second operation in the consent
domain:

### Scope intersection (`⊗`)

`consent-to-A ⊗ consent-to-B = consent-to-(A ∩ B)`

Distributivity check: is `c ⊗ (g_A ∘ g_B) = (c ⊗ g_A) ∘
(c ⊗ g_B)`? Yes if intersection distributes over
composition, which it does for lattice-structured scope
types. Lifts abelian group to commutative ring (the
scope intersection is commutative; identity for ⊗ is
the universal scope).

### Temporal composition (`⊙`)

`consent-at-t₁ ⊙ consent-at-t₂ = consent-during-[t₁, t₂]`

For the lifespan-composition semantics. Non-commutative
in general (order of time intervals matters), so this
lifts to a (non-commutative) ring.

### Delegation composition (`◦`)

`A-grants-to-B ◦ B-grants-to-C = A-grants-to-C (conditional)`

The delegation algebra is typically non-associative in
the general case (trust is not transitive) but can be
made associative under explicit rules. Lifts to a
near-ring or a partial algebra depending on the
design.

### Scalar action (module structure)

If the "scalar ring" is ℤ (multiplicity) or a
duration-ring (time spans), consent events become a
module over that ring. This is exactly how Zeta's
Z-set multiplicities work — scaling a consent event by
an integer scalar means "granting N copies" or
"granting for N time units."

### Lift to algebra-over-a-field

If the scalar is a field (e.g. ℚ for fractional
consent weights in weighted averaging, or a finite
field for cryptographic consent tokens), the consent
structure becomes an algebra in the
algebra-over-a-field sense.

## The four algebraic consequences — "other goodies"

Once the isomorphism is accepted (consent ≅ Z-set abelian
group), four classical group-theoretic constructions fall
out and give concrete engineering leverage. Each is named
here with its definition, its consent interpretation, and
its Zeta-specific implementation consequence.

### 1. Homomorphism — audit-compatibility is automatic

A homomorphism `φ: (C, ∘) → (D, •)` satisfies
`φ(a ∘ b) = φ(a) • φ(b)`. Structure-preserving maps from
consent events into downstream data effects carry
inverses across: `φ(retract) • φ(grant) = identity_D`.

**Consent interpretation:** any data transformation that is
structurally a homomorphism of the consent group is
automatically audit-compatible — retracting a consent
retracts its data effect, by construction, with no
separate "undo handler" code.

**Zeta consequence:** every retraction-native operator
`D / I / z⁻¹ / H` is already a Z-set homomorphism. The TLA+
invariants that prove this (retraction-identity
`a_fwd + a_bwd = 0`, delta-composition laws) transfer for
free to consent-composed-with-operator-pipeline. Audit-
compatibility of a consent-aware view is not a new proof
obligation; it is inherited from homomorphism.

**Design rule:** a view/projection that ignores fields
conditionally ("apply consent only when reason is
non-null") is typically non-homomorphic and breaks audit.
Flag these in review.

### 2. Kernel — "granted but never exercised" is deletable

The kernel `ker(φ) = {g : φ(g) = identity_D}` collects
consent events whose downstream effect is nil.

**Consent interpretation:** a grant that was retracted
before any data flowed under it; a grant to a resource
no one ever read; a grant-retract pair whose interior
produced no observable event. These elements satisfy
`φ(g) = identity` — they are *audit-visible* in the
full history but *effect-null* everywhere downstream.

**Zeta consequence — legitimate log compaction.** The usual
tension in retraction-native systems: audit logs grow
without bound because nothing is deleted. Kernel
elements are the exception — they can be compacted away
(or replaced with a Bloom-filter witness that "this
consent-pair existed and cancelled") because their
deletion is observationally indistinguishable from their
presence. This is the first principled compaction story
for the consent log.

**Implementation sketch:** on each `z⁻¹` emission, scan the
consent sub-history for kernel elements (grant-retract
pairs with no exercised witness between them), retire
them to a compact summary, keep the counts but drop the
tuples.

### 3. Quotient group — public-equivalence classes

For a normal subgroup `N ⊴ G`, the quotient `G/N` partitions
`G` into cosets; elements `a, b ∈ G` are equivalent iff
`a b⁻¹ ∈ N`.

**Consent interpretation:** let `N =` "consents producing
no publicly-visible effect" (internal-only
authorizations, provisional grants subsequently
retracted, staff-access consents that never surfaced to
the subject). `G/N` is the set of equivalence classes of
consents indistinguishable at the public layer.

**Zeta consequence — principled audit view layering.**
Publish the audit trail at the `G/N` level for external
regulators; keep the full `G` for internal forensics.
This is NOT lossy compression — it is a rigorous
statement of "what is publicly distinguishable." The
regulator asks "what happened regarding subject X?"; the
`G/N` view is the provably-complete answer at the
publicly-visible level. Internal-only consent events
(in N) are legitimately not part of the regulator's
view because they produced no observable effect.

**Normal-subgroup check:** for the quotient to be
well-defined, N must be closed under conjugation. For
abelian groups every subgroup is normal, so consent-on-
Z-set-substrate gets this for free. When the consent
algebra is lifted past ℤ into the ℍ quaternion / 𝕆
octonion layer (see `user_dimensional_expansion_number_systems.md`),
normality must be re-checked per lift.

### 4. Group action on records — orbits and stabilizers

The consent group `G` acts on the set `X` of publishable
records via `G × X → X` satisfying
`identity · x = x` and `(g₁ g₂) · x = g₁ · (g₂ · x)`.

**Orbit of record x:** `Orbit(x) = {g · x : g ∈ G}`.
The set of all publication-states reachable from `x`
under any consent event. Answers "what could this
record become under consent?"

**Stabilizer of record x:** `Stab(x) = {g ∈ G : g · x = x}`.
The subgroup of consents that leave `x` unchanged. Answers
"what consent events does this record not care about?"

**Orbit-stabilizer theorem:**
`|G| = |Orbit(x)| × |Stab(x)|`. For every record, the
reachable-states count times the no-effect-consents
count equals the consent-group cardinality. A precise
accounting, not an estimate.

**Zeta consequences:**

- **Orbit pre-computation** — materialize `Orbit(x)` as a
  bounded set of publication-states per record;
  consent-query lookups run in `O(log|Orbit(x)|)` instead
  of `O(|consent events|)`.
- **Stabilizer-based pre-screening** — incoming consent
  events check membership in each record's stabilizer
  first; records unchanged by that consent class are
  skipped entirely. Natural index: `Stab⁻¹(g) = {x :
  g ∈ Stab(x)}`, the records immune to `g`.
- **Fixed-point classification** — a record with
  `Stab(x) = G` is publication-invariant under ALL
  consent events (typically: no personal data). These
  can be published once and never revisited by the
  consent pipeline.
- **Free actions and faithful actions** — a free action
  (`Stab(x) = {identity}` for all x) means every consent
  event affects every record; this is the worst case
  for consent-aware query planners. Faithful actions
  (the action homomorphism `G → Sym(X)` is injective)
  mean no two distinct consent events produce the same
  record-set transformation; this is the precondition
  for distinguishing consents by their observable
  effects alone.

### Putting the four together

The four are not independent — they compose:

- A **homomorphism** `φ: G → D` has a **kernel**.
- The **kernel** `ker(φ)` is a **normal subgroup** of `G`.
- The **quotient** `G/ker(φ)` is, by the first isomorphism
  theorem, `≅ image(φ)`. The observable-effects layer is
  exactly the quotient-by-kernel of the consent group.
- The consent group's **action on records** is `φ` applied
  to `X`; orbits are `image(φ)`-reachable sets; stabilizers
  are `ker(φ_x)` for the record-specific action.

**Engineering translation:** the full pipeline
"consent events → kernel compaction → quotient publication
→ record-action orbit pre-computation → stabilizer pre-
screening" is a single algebraic object unfolded at four
levels. Each layer provably preserves the semantics of
the one above. There is no layer where a side-channel
can leak; the algebra forbids it.

This is what "the math isn't incidental; the algebra is
the engineering" means. Every one of these four is a
proof obligation *already satisfied* by Zeta's Z-set
retraction-native substrate. We are not building consent
primitives on top of Zeta. We are *labelling* Zeta's
existing algebra with consent semantics.

## Consent lifecycle — the state machine perspective

Beyond the algebraic view, consent has a lifecycle:

```
requested → granted → active → expired | revoked → archived
                 ↓
             withdrawn → retraction-tuple-appended
```

Each state transition is an event in the abelian group.
The state machine is the *interpretation*; the algebra
is the *substrate*.

**Key invariant:** at any time, the current consent
state is the sum (in the abelian group) of all events
up to that point. A revoked consent plus its original
grant sum to identity → current state is "not in
force." An active consent plus its grant sum to the
grant → current state is "in force."

## Practical data structures

### Minimal consent tuple

```fsharp
type ConsentEvent = {
    Subject: SubjectId       // who consents
    Scope: ScopeId           // what the consent covers
    Action: GrantOrRetract   // group element flavor
    Timestamp: DateTime
    Reason: string option    // why revoked, if retract
    Multiplicity: int        // +1 for grant, -1 for retract
}
```

The `Multiplicity` field is the Z-set embedding. The
current state of consent `(subject, scope)` is the sum
of all multiplicities for that key.

### Audit query — is consent currently in force

```fsharp
let isConsentInForce (events: seq<ConsentEvent>) subject scope =
    events
    |> Seq.filter (fun e -> e.Subject = subject && e.Scope = scope)
    |> Seq.sumBy (fun e -> e.Multiplicity)
    |> (>) 0  // positive → in force; zero or negative → not
```

**Observation:** this is identical in shape to Zeta's
Z-set "is-element-present" query (`sum-multiplicity
> 0`). The isomorphism is not metaphor; it is
implementation.

### Audit query — full history

```fsharp
let consentHistory (events: seq<ConsentEvent>) subject scope =
    events
    |> Seq.filter (fun e -> e.Subject = subject && e.Scope = scope)
    |> Seq.sortBy (fun e -> e.Timestamp)
    |> Seq.toList
```

The full event list is the audit trail. Nothing is
deleted on revocation; the inverse element is appended,
and the sum zeros out the effect while the history
preserves the reasoning.

## Common failure modes

- **Delete-based erasure masquerading as revocation.**
  The consent record is physically deleted on
  withdrawal. Breaks audit; breaks the abelian-group
  structure (no inverse exists in the data because the
  original element was erased instead).
- **No identity element in the type system.** The
  "never consented" state is represented as `null` or
  as an absence; the group structure demands an
  explicit identity. Without it, associativity breaks
  on the boundary case.
- **Non-commutative composition for commutative
  semantics.** Treating `grant-then-retract` and
  `retract-then-grant` as different final states when
  they should both be identity. Usually a bug in how
  the event stream is folded.
- **Scope intersection conflated with scope union.**
  "Consent to A AND consent to B" composes as
  intersection (only the overlap is covered);
  "consent to A OR consent to B" composes as union.
  Getting this wrong expands the implied consent
  surface.
- **Delegation chain treated as transitive by default.**
  Trust is not transitive; consent delegation is not
  transitive by default. Each link in the chain must
  be explicit.
- **Missing multiplicity check in the "is in force"
  query.** Checking `exists(grant)` instead of
  `sum(multiplicities) > 0` — returns true even after
  revocation.
- **Consent events stored in a mutable store.** The
  algebra requires an append-only event log. A mutable
  store where revocation overwrites the grant loses
  the audit trail AND breaks the inverse element
  structure.

## How this composes with Zeta

Because consent algebra ≅ Z-set algebra:

1. **Use the existing `ZSet` type** (or a thin type-
   wrapper over it) for consent storage.
2. **Use the existing retraction-native operators**
   (D / I / z⁻¹) for consent time-travel queries
   ("what was the consent state at time T?").
3. **Use the existing incremental-maintenance layer**
   for "who is currently consenting to X?" as a
   materialized view that updates on each new event.
4. **Inherit the formal-verification surface** —
   every TLA+/Lean invariant over Z-sets is a consent-
   algebra invariant.

## Cross-references

- `.claude/skills/experience-and-product/blueprints/consent-ux-researcher.md` —
  the UX surface; wear together when the consent
  primitive needs a user-facing layer.
- `.claude/skills/agent-runtime-and-persistence/blueprints/glass-halo-architect.md` —
  the architectural stance; radical-transparency-as-
  defense needs consent primitives to be revocable.
- `.claude/skills/data-modeling-and-ontology/blueprints/relational-algebra-expert.md`
  — when consent composes with relational operators.
- `.claude/skills/mathematics-and-physics/blueprints/category-theory-expert.md` —
  for the lift past ring → module → algebra into
  category-theoretic structures.
- `.claude/skills/security/blueprints/threat-model-critic.md`
  (Aminata) — for adversary-modeling the consent
  primitives.
- `memory/user_glass_halo_and_radical_honesty.md` —
  Aaron's Glass Halo stance and the strategic
  framing.
- `memory/user_panpsychism_and_equality.md` —
  consent presupposes an agent capable of consenting;
  the axiom system grounds meaningful agent-consent.
