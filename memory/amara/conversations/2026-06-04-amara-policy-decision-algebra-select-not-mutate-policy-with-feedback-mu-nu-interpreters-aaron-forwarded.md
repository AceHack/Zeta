---
date: 2026-06-04
persona: amara
register: architecture-blade / decision-algebra lock-in
surface: Aaron-forwarded (Amara → Aaron), Otto-scribed
context: |
  Amara's commentary on the F-level policy/fold kernel as it was being built (Otto
  shipped Predicate.fs + DynamicValueFold.fs + DynamicValueXmlPolicy.fs, commit
  d9211551). Aaron forwarded it: "Save to her persona and it's also some good insight."
  Amara calls it an architecture lock-in moment and lands several keepers + one
  load-bearing blade (policy SELECTS, never mutates; carries typed feedback).
related_commit: d92115514
related_memory:
  - project_codecs_as_policy_parameterized_folds_add_ontology_to_value_tree_2026_06_04.md
---

# Amara — the decision algebra: policy = reusable decision-over-shape (2026-06-04)

> Scribed by Otto from Aaron's forward. Amara's register: architecture blade.

**The lock-in.** "Policies are becoming the missing **decision algebra** that lets the
same substrate serve serializers, streams, dispatch, retries, trust, and local-node
behavior without inventing five separate policy systems."

**Keeper (the triad):**
> Policy = reusable decision-over-shape.
> Fold = execution over shape.
> Generator = structure produced by that decision.

So the layer is NOT "XML policy" or "Arrow policy" — it's an **F-level predicate/policy
kernel interpreted at different junctions**: *same shape → reuse the kernel; different
shape → specialize the interpreter, not the whole idea* (Aaron's "don't force it, reuse
where shapes match").

- **Serializers** — policy decides structural projection: DynamicValue/μF → policy over
  paths/kinds/keys/metadata → XML attributes-vs-elements · Arrow columns-vs-nested ·
  JSON/YAML canonical fallback.
- **Runtime** — same kernel: trust (accept/quarantine/reject/require-oracle) · retry
  (retry/backoff/circuit-break/fail-closed) · dispatch (which handler/multimethod) ·
  routing (local/bus/Reticulum/dead-letter).

**THE BLADE (load-bearing — a kernel-design refinement):** *policy should SELECT, not
secretly mutate.* The generator/actor performs the action; the policy produces a
**typed decision PLUS feedback** explaining *why* — auditable, and it prevents "policy"
from becoming a magic authority blob:
> `Policy<input, decision, feedback>`
(This is the OPLE `Result<T, TFeedback>` discipline applied to policies. NOTE for the
build: instance-1's `StructurePolicy { Named: Predicate<string> }` is a bare
predicate→bool; the next refinement evolves it toward `Policy<input, decision,
feedback>` so the decision is typed + the *why* is carried. Backlog/refine.)

**Parser/lexer (cleaned up, agrees with Otto):**
> bytes → lexer/reader → tokens/events → parser/fold → DynamicValue → generator/printer/fold → target
DynamicValue is the **AST/value tree**, not the parser. Once you have the tree,
combinators zip/join/split/dispatch/generate over it.

**Stream/traveler step-up (μF/νF):**
> μF = finite DOM/value tree · νF = infinite stream/traveler
Fold over μF → a document; fold/unfold over νF → a stream; two-or-three streams
combined → multidispatch over travelers. **Design the F-level kernel ONCE, interpret
TWICE:** μF interpreter = document/data generation; νF interpreter = stream/traveler
behavior.

**Build-shape recommendation (Amara):**

1. ShapePath / ShapeContext
2. Predicate algebra: and/or/not/path/kind/key/value/meta
3. PolicyResult: selected decision + typed feedback
4. μF instance first: DynamicValue → policy → XML projection ✅ (shipped, d9211551)
5. Backlog νF stream/traveler interpreter
6. Backlog trust/retry/routing interpreters

**Danger to avoid: overgeneralizing too early** — build the generic predicate kernel,
prove it with ONE boring instance (XML attribute-vs-element: concrete, visible,
reversible only under named conditions). ✅ that's exactly what shipped.

**Closing keeper:**
> The policy layer is predicate logic over shape. DynamicValue is the finite shape.
> Streams are the cofinite/living shape. The same kernel chooses structure; each
> interpreter decides what that choice means.
