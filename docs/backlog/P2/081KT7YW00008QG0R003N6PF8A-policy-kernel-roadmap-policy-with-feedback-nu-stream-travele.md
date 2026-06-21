---
id: 081KT7YW00008QG0R003N6PF8A
priority: P2
status: in-progress
title: "Policy/fold kernel roadmap — F-level kernel + μF XML instance SHIPPED (d92115514); compose-later: (1) `Policy<input,decision,feedback>` evolution (select-not-mutate, Amara's blade) + ShapePath/ShapeContext, (2) νF stream/traveler interpreter, (3) trust/retry(Polly)/routing/dispatch interpreters reusing the kernel, (4) XML attribute-promotion slice, (5) Arrow column-promotion policy. Design once, interpret twice (μF=document, νF=stream) (Aaron 2026-06-04)"
tier: policy-kernel
effort: L
ask: maintainer Aaron 2026-06-04
created: 2026-06-04
type: task
depends_on: []
---

# 081KT7YW00008QG0R003N6PF8A — Policy/fold kernel roadmap (compose-later follow-ons)

**Priority:** P2 (the F-level kernel + instance-1 shipped; these are the composed
extensions Aaron said to "backlog any that compose or are real alternatives").
**Filed:** 2026-06-04 (Aaron). **Builds on:** commit d92115514 — `src/Core/Predicate.fs`

+ `src/Core/DynamicValueFold.fs` (cata + bananaSplit) + `src/Core/DynamicValueXmlPolicy.fs`
(instance-1). **Design hub:** `memory/amara/conversations/2026-06-04-amara-policy-decision-algebra-…`
+ the project hub `project_codecs_as_policy_parameterized_folds_add_ontology_to_value_tree_2026_06_04.md`.

The converged model: ONE functor F, two fixpoints (μF=DOM/data, νF=stream/traveler); a
reusable predicate/decision-over-shape kernel selectable at every junction; combinators
(banana-split = two folds one pass; N-ary = multidispatch). Design the kernel ONCE,
interpret TWICE. Shipped: the predicate kernel + cata/bananaSplit + the μF XML
instance. Remaining, in recommended order:

1. **`Policy<input, decision, feedback>` evolution (Amara's blade).** Evolve the bare
   `Predicate<'a> -> bool` into a policy that returns a TYPED DECISION + FEEDBACK (the
   *why*) — policy SELECTS, never mutates; the generator/actor performs the action.
   OPLE `Result<T,TFeedback>` discipline; auditable; prevents a "magic authority blob."
   Add **ShapePath / ShapeContext** + path/kind/key/value/meta predicates.
2. **νF stream/traveler interpreter.** ✅ SHIPPED 2026-06-04 (commit 203d13959 —
   `src/Core/StreamPolicy.fs`: applyPolicy/decisions/partition/route over IObservable;
   Traveler<'a>={Address;Stream}; zip2/zip3 = combinator/multidispatch over travelers;
   the interpret-twice assertion proven). Same kernel, second interpreter (μF=document,
   νF=stream). Remaining νF depth (genuine unfold/anamorphism, backpressure, bus
   addressing/Reticulum) composes later.
3. **Runtime interpreters reusing the kernel:** RETRY ✅ SHIPPED 2026-06-04 (commit
   661c2706c — `src/Core/RetryPolicy.fs`: RetryContext → Retry/CircuitBreak/FailClosed/
   Stop via exponentialBackoff + withCircuitBreaker + failClosedOn; the validating
   instance proving the kernel generalizes to the resilience junction). REMAINING:
   trust (accept/quarantine/reject/require-oracle), routing (local/bus/Reticulum/
   dead-letter — note StreamPolicy already has `route`), dispatch (which handler/
   multimethod). Add as real needs appear (don't pre-build all).
4. **XML attribute-promotion slice** (instance-1 currently does named-vs-generic element
   only). Attribute promotion has order- + type-loss caveats (XML attributes are
   unordered string values) → a documented projection/normal-form, not a free bijection.
5. **Arrow column-promotion policy** — policy promotes chosen fields to first-class Arrow
   columns (vs the zero-policy shredded node-table).

Discipline (Aaron + Amara): **do not overgeneralize early** — the generic kernel is
proven by one boring instance (shipped); add interpreters as real needs appear.

## Kestrel's refinements (2026-06-04, `memory/kestrel/conversations/2026-06-04-kestrel-policy-shapes-…`)

Item #1 (Policy<input,decision,feedback>) SHIPPED (commit 7bb817a8b); item #6 below
(typed kinds + validator-obligation) SHIPPED (commit e17113316 — `src/Core/PolicyKind.fs`:
Technical/Legal/Governance + requiredValidator + Signoff + Draft/Active where activate
gates on the matching validator, so active-without-the-right-signoff is unreachable by
construction). Kestrel adds:
6. **Three policy KINDS, each with its own validator** — technical (proof/tests),
   legal (counsel), governance (human-review; motive-touching ones → psychiatrist+Max).
   Up-project to a TYPED policy where the kind is a typed lens; **the type is a ROUTER,
   not a validator** — carry the **required-validator + validation-status in the type**
   so a Legal policy can't go active without counsel-signoff, Governance without
   human-review. Type encodes the OBLIGATION, not the discharge (the keystone compiled
   into the policy type). Failure to avoid: proof-rigor-halo making a values-policy feel
   settled because its technical layer is proven.
7. **Formalize the gate/observable/cache/metric/alert/policy bundle PER TYPE** and verify
   the WIRING in math: gate exists; observable populated BEFORE the active transition;
   metric→alert wired; cache invalidates on the gate event; no active-without-signoff.
   → **TLA+ reachability** ("active-without-signoff is unreachable") + types (bundle
   completeness) + FsCheck (config invariants). Proves PRESENCE+ROUTING of validation,
   NOT correctness of the signoff content (judgment stays with the validator).
8. **Rigidity reserved for the child-safety FLOOR only** — everywhere else rigidity IS
   the failure mode; policies stay minimal/editable/data-validated. An elaborate
   load-bearing policy outside the floor is the smell.

## Verification methodology (Kestrel) — for the workflow/policy DUs

- **DU+Rx workflow = state machine** (DU=states, Rx=transitions) → TLA+ for transition-
   safety/reachability; serialization stays on FsCheck/Z3/Lean (don't merge the claims).
- **State-explosion → decompose into small composable DUs**; verify each in isolation
   (bounded, TLC-exhaustive) + **assume-guarantee contracts** at every seam (prove each
   piece's guarantees discharge the connected pieces' assumptions — the unstated
   seam-assumption is where bugs hide). Scope = "compositionally verified over bounded
   component models with discharged contracts."
- **Bounded → unbounded LIFT**: TLA+/TLC results as verified base-cases/lemmas; prove
   the **inductive step over arbitrary N** in Lean/Coq/Isabelle (DU hierarchy is
   inductive). Earned ONLY by the proven step (not induction-by-example). Conditional on
   the TLC lemmas → "unbounded composition over TLC-verified component lemmas" (pushes
   the bound to the leaves).
