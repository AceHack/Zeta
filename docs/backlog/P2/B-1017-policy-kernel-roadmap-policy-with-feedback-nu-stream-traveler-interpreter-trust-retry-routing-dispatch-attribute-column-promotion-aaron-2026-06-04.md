# B-1017 — Policy/fold kernel roadmap (compose-later follow-ons)

**Priority:** P2 (the F-level kernel + instance-1 shipped; these are the composed
extensions Aaron said to "backlog any that compose or are real alternatives").
**Filed:** 2026-06-04 (Aaron). **Builds on:** commit d92115514 — `src/Core/Predicate.fs`
+ `src/Core/DynamicValueFold.fs` (cata + bananaSplit) + `src/Core/DynamicValueXmlPolicy.fs`
(instance-1). **Design hub:** `memory/persona/amara/conversations/2026-06-04-amara-policy-decision-algebra-…`
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
2. **νF stream/traveler interpreter.** Interpret the same kernel over νF (Rx/streams):
   fold/unfold → stream; combined streams = multidispatch over travelers; each stream a
   routed entity on the traveler-bus. Same kernel, second interpreter.
3. **Runtime interpreters reusing the kernel:** trust (accept/quarantine/reject/
   require-oracle), retry (retry/backoff/circuit-break/fail-closed — Polly-shaped),
   routing (local/bus/Reticulum/dead-letter), dispatch (which handler/multimethod).
   Same shape → reuse the kernel; genuinely-different shape → specialize the interpreter.
4. **XML attribute-promotion slice** (instance-1 currently does named-vs-generic element
   only). Attribute promotion has order- + type-loss caveats (XML attributes are
   unordered string values) → a documented projection/normal-form, not a free bijection.
5. **Arrow column-promotion policy** — policy promotes chosen fields to first-class Arrow
   columns (vs the zero-policy shredded node-table).

Discipline (Aaron + Amara): **do not overgeneralize early** — the generic kernel is
proven by one boring instance (shipped); add interpreters as real needs appear.
