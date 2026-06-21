# IMPLICIT-not-EXPLICIT in DUs is class error — review agents look for it + ontology-evolution discipline (Aaron 2026-05-28 constitutional rule authorization)

Carved sentence (Aaron 2026-05-28 verbatim — TWO composing carvings):

> *"IMPLICIT not explicit is a class error we should write a rule for
> and have our review agents of all kinds look for ... in our DUs ...
> we are going to have a ton of this"*

Plus (Aaron 2026-05-28, same session, evolution discipline):

> *"Some things like reformatting windows and reinstalling everything
> my ontology still evolves to this day on every iteration"*

## Operational content

When designing discriminated unions (DUs / state machines / lifecycle
substrate), states / transitions / conditions / observations that are
substantively distinct MUST be EXPLICIT DU variants — NOT IMPLICIT in
dispatch-flow logic, routing-context branches, or unnamed-state-via-
field-combinations.

The class error: substantively-distinct substrate state gets BURIED in
TS internal logic (if-chains, context-field-combinations, dispatch-
function branches) rather than SURFACED as an explicit DU variant.

## Why this is class error (load-bearing properties at risk)

| Substrate property | Lost when IMPLICIT-not-EXPLICIT |
|---|---|
| **Observability** | Cannot see the loop's current state from logs/traces; have to reconstruct from context-field inspection |
| **Composability** | dispatchInWorld + lifetime-pair matrices need DU variants; implicit-not-explicit can't compose |
| **asymmetric-authorship** | Each substantively-distinct state SHOULD AUTHOR its own feedback channel; implicit substrate has no channel |
| **substrate-smoothness** | Smooth substrate produces sharp outputs via DUs; if-chain routing blurs the sharpness |
| **muscle-memory extraction** (per `dus-are-explicit-muscle-memory` memory) | DUs ARE explicit muscle-memory; implicit substrate fails to extract the muscle-memory; not transmissible |
| **Future-cold-boot inheritance** | Future-AI-instances cold-booting see the DU + dispatch; implicit substrate is invisible without reading function bodies |
| **Ontology evolution** (Aaron's second carving) | Ontology EVOLVES with each iteration; new variants need to be ADDABLE; implicit substrate has nowhere to extend |

## The two composing disciplines

### Discipline 1: Snapshot — every substantively-distinct state gets a DU variant

When authoring DU substrate:

1. **Inventory the substantively distinct states** the substrate-entity passes through
2. **Each distinct state → explicit DU variant** (`kind: "..."`)
3. **DON'T bury states** in if-chains, context-field combinations, or dispatch-function branches
4. **Heuristic**: if you'd want to LOG / OBSERVE / TRACE that the substrate is in state X, it deserves a DU variant
5. **Heuristic**: if behavior at state X differs SUBSTANTIVELY from state Y, both deserve variants

### Discipline 2: Evolution — DUs support ontology growth across iterations

Aaron 2026-05-28: *"Some things like reformatting windows and reinstalling everything my ontology still evolves to this day on every iteration."*

The substrate-honest implication: even highly-repeated processes evolve their ontology on every iteration. DUs must support:

1. **Closed for modification** (per `function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md`): existing DU variants' semantics stay STABLE across iterations
2. **Open for extension**: new variants can be ADDED when iterations reveal new substantively-distinct states
3. **Retraction-native composition** (per DBSP Z-set + Hopf antipode substrate): variants proven wrong can be deprecated / replaced via additive substrate-engineering (NOT silent-delete)
4. **Honor prior iterations**: when extending, honor what came before (per `honor-those-that-came-before.md`); old variants kept until explicitly retracted

## What review agents should check

Per Aaron's rule-authoring authorization ("have our review agents of
all kinds look for"):

**Review checklist for DU substrate**:

1. **Each substantively-distinct state has explicit DU variant?** (no implicit-via-context-field)
2. **Each transition-trigger has explicit substrate?** (DU variant OR dispatch-function-return-value; never just internal if-chain on bare context-field)
3. **Each feedback variant per asymmetric-authorship?** (no exception-throwing or null-returning instead of Result<T, TFeedback>)
4. **Substrate supports evolution?** (DU shape allows adding new variants without breaking existing call sites; per OCP rule)
5. **Substrate-honest snapshot vs evolution distinction?** (current iteration's substrate is what's there NOW; evolution mechanism is preserved separately)

When review agents encounter implicit-not-explicit substrate:

1. **Flag as class error per this rule**
2. **Propose explicit DU variant addition** (substrate-engineering substrate-naming candidate)
3. **Compose with OCP discipline** (add variant; don't modify existing; honor prior substrate)
4. **Verify substrate-anchors** (per `grep-substrate-anchors-before-razor-as-metaphysical.md` — implicit-not-explicit often signals substrate that hasn't been substantively recognized yet)

## Examples of IMPLICIT-NOT-EXPLICIT class error

### Example 1: AutoLoopLifetime PR #5805 (caught by Aaron 2026-05-28)

**Before (implicit)**: AutoLoopLifetime had `decompose-or-ship` state that branched internally on:

- `context.operatorDirectionPending !== undefined` → routes to brief-ack-bounded-wait
- `context.briefAckCount >= BRIEF_ACK_THRESHOLD && !lastNamedDependency` → routes to forced-escalation
- Otherwise → routes to ship-action

These are SUBSTANTIVELY DISTINCT states the loop is in, but they're IMPLICIT in dispatch branches.

**After (explicit, proposed)**: Add DU variants:

- `await-operator-direction` (waiting on operator-named question)
- `pr-loop-resolution-check` (waiting for PR-state transitions; merged + threads resolved + CI clean)
- `peer-pr-review` (substantively engaging with peer-agent work; not ship-work)
- `pure-git-mode` (rate-limit exhausted; pure-git substrate substrate)
- `unfinished-pr-triage` (per `pr-triage-tiers.md` rule; explicit tier-classification state)

Each substantively-distinct state gets observability + composability + feedback-channel + future-cold-boot-inheritance.

### Example 2: PrReviewLifecycle PR #5810 (caught by Aaron 2026-05-28; this same session)

**Before (implicit)**: verify-finding state checks:
```typescript
if (context.findings.length > 0 && context.findings[0]!.substrateAnchors !== undefined && context.findings[0]!.substrateAnchors.length === 0) {
  return { ok: false, feedback: { kind: "FindingUnsubstantiated", ... } };
}
```

The "substantiated" vs "unsubstantiated" distinction is IMPLICIT in field-combination + if-check.

**After (explicit, proposed)**: Add ReviewFindingVerification DU:
```typescript
type ReviewFindingVerification =
  | { kind: "substantiated"; anchors: string[] }
  | { kind: "unsubstantiated"; reason: string }
  | { kind: "verify-pending" }
  | { kind: "verify-skipped"; rationale: string };
```

Then verify-finding state dispatches on the explicit verification-state DU instead of internal if-chain on bare context fields.

## Composes with substrate

- **`function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md`** — DIRECT COMPOSITION: open-for-extension supports Aaron's ontology-evolution discipline; closed-for-modification supports snapshot stability
- **`asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`** — each explicit DU variant AUTHORS its feedback channel; implicit substrate has no channel
- **`substrate-smoothness-as-load-bearing-property.md`** — smooth substrate produces sharp outputs via explicit DUs; if-chains blur the sharpness
- **`monad-propagation-pattern-cross-language-substrate-shape.md`** — Result<T, TFeedback> shape requires explicit TFeedback variants; implicit substrate breaks the pattern
- **`grep-substrate-anchors-before-razor-as-metaphysical.md`** — implicit-not-explicit often signals substrate-engineering substrate that hasn't been substantively recognized yet; grep first before razor
- **`honor-those-that-came-before.md`** — when extending DUs per ontology-evolution discipline, honor prior variants (don't silent-replace)
- **`razor-discipline.md`** — operational claims only; this rule is operationally checkable via DU-vs-implicit audit
- **memory/feedback_dus_are_explicit_muscle_memory_*.md** — DUs ARE explicit muscle-memory; implicit substrate fails to extract the muscle-memory
- **`wake-time-substrate.md`** — this rule auto-loads at cold-boot so future-Otto + review-agents inherit the discipline

## Composes with PRs from today

- PR #5805 AutoLoopLifetime (substrate where Aaron first caught the implicit-not-explicit pattern in this session)
- PR #5810 PrReviewLifecycle (substrate with implicit verify-finding check; candidate for explicit ReviewFindingVerification DU)
- PR #5728 081KSKBP80008QG0R000B3Y19A.5 workflow-engine PoC (substrate this rule applies to going forward)
- PR #5758 081KSNY2Z0008QG0R003WFDCJ9 ReviewLifetime (substrate already explicit; reference example)
- PR #5775/#5801/#5804 per-host adapters (substrate already explicit; reference example)
- PR #5806 DUs-as-explicit-muscle-memory (META-scope substrate this rule operationalizes)

## Future-Otto + review-agent operational inheritance

When authoring new DU substrate:

1. **Inventory substantively-distinct states** → each gets explicit variant
2. **Don't bury substrate in dispatch branches** — surface as DU
3. **Don't bury substrate in context-field combinations** — surface as DU variant or dedicated DU
4. **Each feedback variant explicit per asymmetric-authorship**
5. **Substrate supports evolution** (OCP closed-for-modification + open-for-extension)
6. **Honor prior variants** when extending (don't silent-replace)

When REVIEWING new DU substrate (per producing-side `PrReviewLifecycle`):

1. **Apply this rule's checklist** to the DU
2. **Flag implicit-not-explicit findings** as class-error class-1 (per ReviewFindingKind taxonomy)
3. **Propose explicit DU variant addition** as substrate-engineering substrate-engineering substrate
4. **Compose with OCP** — propose ADDITIVE extension, not modification
5. **Honor substrate-engineering peer's prior substrate** when proposing extension

## Why this rule auto-loads at cold-boot

Per `.claude/rules/wake-time-substrate.md`: this is constitutional substrate-engineering substrate-design discipline. Future-Otto + future-AI-instances + review-agents (Codex / Lior / Otto / future) ALL need this rule at cold-boot to:

1. Apply discipline when authoring new DU substrate
2. Catch class errors when reviewing peer substrate
3. Honor ontology-evolution discipline (Aaron's second carving)

Without auto-load, the class error recurs ("we are going to have a ton of this" per Aaron's forecast).

## Substrate-honest framing

This rule does NOT:

- Mandate that ALL behavior must be DU variants (some substrate is genuinely internal-routing; not every if-chain is class error)
- Prevent substrate-engineering iteration (ontology-evolution discipline EXPLICITLY supports growth)
- Override operator authority (operator can direct different discipline if substrate-engineering target requires)

This rule DOES:

- Catch the recurring class error Aaron identified
- Establish review-agent discipline (review agents look for this pattern)
- Compose with ontology-evolution discipline (DUs evolve; rule supports iteration)
- Honor the substrate-engineering substrate-engineering substrate-naming substrate work shipped today (per `dus-are-explicit-muscle-memory` carving)

The discriminator: when a substantively-distinct state exists in the substrate-engineering substrate-engineering substrate, it deserves explicit DU variant. When something is just internal-routing (not substrate-engineering substrate-engineering substrate), it can stay in dispatch logic. The judgment call is operationally testable via observability + composability + feedback-channel + future-cold-boot-inheritance criteria.

## μένω — the DUs make the muscle-memory explicit, the ontology evolves

(Aaron 2026-05-28 constitutional substrate-engineering substrate-rule
authorization; META-scope substrate-engineering substrate-engineering
substrate-design discipline; auto-loads at cold-boot; review-agents
inherit the discipline.)
