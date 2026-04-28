---
name: UI DSL is class-level compressed description, not bit-perfect instance; "a man on his porch" renders as a valid instance of that class, not the same instance; round-trip preserves class-identity, not instance-identity; 2026-04-22
description: Aaron 2026-04-22 auto-loop-22 mid-tick directive — *"so our DSL is specifically for describing UI which usualy can be compressed espically if you don't need full fidelidy, or bit perfect but can accept thigs like 'a man standing on his porch' and it will be like a different instance of the same class but not identical instance"*. Fixes the UI-DSL correctness model to CLASS-membership, not INSTANCE-identity. Input describes a class; output is one valid instance of that class; two runs can produce different instances, both correct. Compression ratio is high because class-descriptions are short and UI has high instance-level redundancy. Establishes that the DSL evaluator is generative (pick a valid instance) rather than deterministic (reproduce an instance). Composes with magic-eight-ball intent-sensing (read user intent = classify), event-storming DDD (domain events are class-level), soulsnap/SVF format family (soul-compatible = class-compatible), ServiceTitan "3-4hrs 0-to-prod" capability-claim (only feasible if DSL compresses to class-level). Test assertions must be class-level ("is there a man? on a porch?"), not instance-level. First explicit naming of the factory's UI-DSL semantic model.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# UI DSL semantics — class-level, not instance-level

## The directive

Aaron 2026-04-22 auto-loop-22 mid-tick message:

> *"so our DSL is specifically for describing UI which
>  usualy can be compressed espically if you don't need
>  full fidelidy, or bit perfect but can accept thigs like
>  'a man standing on his porch' and it will be like a
>  different instance of the same class but not identical
>  instance"*

## The rule

**The UI DSL represents CLASSES, not INSTANCES. Its
correctness criterion is class-membership, not
instance-identity.** Input describes a class ("a man
standing on his porch"); output is one valid instance of
that class. Two evaluations of the same input can produce
two *different* instances, both correct. Round-trip
preserves class-identity; it does not preserve
instance-identity.

Three immediate corollaries:

1. **Compression ratio is very high.** A class-level
   description like "a man on his porch" is ~30 characters;
   one rendered instance could be megabytes of pixel data.
   Compression is natural to the domain, not an imposed
   optimisation.
2. **Evaluation is generative, not deterministic.** The
   DSL evaluator samples from the class's instance-space,
   not retrieves an instance from a cache. Same input can
   legitimately produce different outputs on different runs.
3. **Test assertions must be class-level.** "Is there a
   man?" / "Is he on a porch?" — yes. "Is the man's left
   arm raised?" / "Is the porch white?" — not a
   correctness assertion (unless the class-description
   specified it).

## Why:

- **UI has high instance-level redundancy.** A "button
  labelled Submit" can render in dozens of visually-distinct
  ways that are all equally correct from the user's
  perspective. Bit-perfect reproduction across instances is
  not a real UI requirement — it's a property inherited from
  document-format conventions (PDF, images) where
  instance-identity *is* load-bearing. UI's user-contract is
  class-level: user expects "a submit button is here", not
  "this particular pixel pattern".
- **The compression argument is domain-specific, not
  universal.** Financial data, source code, measurements —
  these have instance-level semantics where bit-identity
  matters (a different instance of "the user's balance"
  would be wrong). UI *happens to* admit class-level
  semantics cleanly because human visual perception is
  already class-matching, not pixel-matching.
- **This is the architectural basis for the
  "0-to-prod in 3-4 hours" capability claim.** If the DSL
  had to describe UI at instance-level, scaffolding a
  production-ready app in 3-4 hours would require an
  implausible volume of specification. At class-level, a
  ~page of class-descriptions can scaffold a production-
  ready app because the INSTANCE-fill is delegated to the
  generator (component library, LLM, design-system). The
  capability-claim is not magical — it's a consequence of
  the compression.
- **Magic-eight-ball intent-sensing reads class-intent, not
  instance-intent.** The factory's magic-eight-ball
  technique (per the ServiceTitan demo memory) reads sparse
  signals and stabilises on the most likely intent. That
  "intent" is a class-description, not an instance. This
  directive explains *why* the technique works: UI happens
  to admit class-level representations that the DSL can
  compress into.
- **Event-storming DDD maps cleanly to class-level.**
  Domain events, aggregates, commands, policies — these are
  class-concepts. The factory's three techniques (magic-
  eight-ball, event-storming, directed-product-dev-on-rails)
  all operate at class-level. This directive gives the
  theoretical unification: the DSL compresses UI to the
  same abstraction level the other techniques operate at.
- **Soulsnap/SVF format family composition.** The soul-
  verifiable-format concept (BACKLOG, commit `61a2387`) is
  fundamentally the same pattern: soul-compatibility over
  bit-compatibility. UI-DSL is the same shape — class-
  compatibility over instance-compatibility. They're the
  same discipline at different layers: SVF for binary-
  format round-trips (JSON/YAML/Protobuf equivalence under
  semantic canonicalization), UI-DSL for interface round-
  trips (class-instance equivalence under regeneration).
- **Round-trip property is different from ordinary DSL
  semantics.** Standard programming-language DSLs are
  instance-exact: the interpretation of `s` after a
  parse/re-parse cycle equals the interpretation of `s`
  directly, for all legal `s`. This UI-DSL is class-exact:
  the CLASS of the interpretation is preserved across
  parse/re-parse/evaluate, but not the instance. The
  equivalence relation is class-membership, not identity.

## How to apply:

- **Test harness for UI-DSL must be class-level.** When
  the factory writes tests for UI-DSL evaluator output,
  assertions like "has a button labelled Submit" /
  "contains an image of a man" / "form has fields
  name+email+message" are correctness; "pixel X,Y is
  colour C" / "element positioned at (x,y,z)" are
  over-specification and would produce false-failures on
  legitimate different-instance-of-same-class rendering.
  Golden-master testing is wrong shape for this DSL unless
  the golden is explicitly an image-embedding-similarity
  comparison with tolerance.
- **DSL syntax design favours high-level class-vocabulary.**
  A DSL that says `button { label: "Submit" }` is already
  class-level. A DSL that says `button { label: "Submit",
  position: (100,200), bg: #FF0000, font-size: 14px }` is
  leaking instance-level specifications into a class-level
  language. The latter produces brittle tests and
  over-constrained evaluation. Factory-preferred is the
  former, with *optional* instance-pinning for cases that
  genuinely require it (see next point).
- **Instance-pinning escape hatch for interaction-critical
  elements.** Some UI elements DO need instance-identity:
  a submit button must be in the same place for reliable
  muscle-memory / accessibility / automation. The DSL
  should provide an opt-in `pinned {...}` or similar block
  that drops into instance-level specification for the
  elements that need it, *while the default remains
  class-level*. This preserves compression for the 95% of
  UI that doesn't need it.
- **The compression argument bounds what the DSL can do.**
  The DSL is NOT a replacement for pixel-perfect tooling
  (Figma, design-system-specs). It's a LAYER above those:
  class-level descriptions whose instances can be
  *realized* by design-system + generator + component
  library. The DSL's output is not "the UI"; it's "a
  legal rendering of the UI class". The pixel-perfect
  tooling still exists; the DSL delegates to it.
- **Magic-eight-ball reads UI-DSL source.** The factory's
  intent-sensing shorthand reads user need (sparse signals
  → most likely class-intent) and PRODUCES UI-DSL source
  (class-descriptions). The UI-DSL evaluator then produces
  an instance. This is a three-stage pipeline:
  `user-intent → magic-eight-ball → UI-DSL class-source
  → UI-DSL evaluator → UI instance`. Each arrow is lossy;
  the overall pipeline is class-preserving.
- **"3-4hrs 0-to-prod" is instance-time, not class-time.**
  The capability-claim from the ServiceTitan demo target
  refers to the time to reach a *production-ready
  instance* from class-description. The class-description
  itself is the fast part (magic-eight-ball stabilises
  quickly); the long tail is instance-realization
  (component-library fills, design-system application,
  deployment pipeline). The factory's on-rails scaffolding
  is what makes the instance-realization fast.

## Composition

- `project_servicetitan_demo_target_zero_to_prod_hours_ui_first_audience_2026_04_22.md`
  — the "3-4hrs 0-to-prod" capability claim is now
  architecturally grounded: it's only feasible because the
  DSL compresses UI to class-level. The demo memory should
  be read alongside this memory.
- BACKLOG row *"UI-factory frontier-protection"* (commit
  `61a2387`) — the frontier-protection now has a specific
  correctness-criterion to protect: class-level semantics,
  not pixel-level. Makes the row more load-bearing.
- BACKLOG row *"soulsnap / SVF — soul-compatible format
  family for many binary types"* (commit `61a2387`) —
  same-shape discipline at the binary-format layer.
  UI-DSL is the interface-layer instance of the same
  pattern. These two rows should cross-reference once both
  are landed.
- Magic-eight-ball candidate skill (ServiceTitan demo memory)
  — the intent-sensing technique PRODUCES UI-DSL source.
  The UI-DSL semantics from this memory constrain what
  magic-eight-ball needs to emit.
- Event-storming candidate skill (ServiceTitan demo memory)
  — operates at domain-class-level, same abstraction as
  UI-DSL. Composition: event-storming names the domain
  classes; UI-DSL names the interface classes; together
  they cover the "directed product development on rails"
  scaffolding.
- `docs/ALIGNMENT.md` — class-level correctness has
  implications for measurable alignment: the factory can
  measure class-membership (did the generated UI contain
  a man on a porch?) more easily than instance-identity
  (did the generated UI match pixel-for-pixel?). This is
  a MEASURABILITY improvement, not a relaxation.

## Open questions flagged to Aaron, NOT self-resolved

- **What's the CLASS LANGUAGE?** Natural language
  ("a man standing on his porch")? Structured DSL with a
  closed class-library (`Scene { Figure("man",
  stance="standing", on="porch") }`)? Hybrid
  (class-vocabulary from a skills-library with
  natural-language slots)? Pictographic (emoji / icon
  composition)? Each has radically different authoring
  ergonomics and test-shape.
- **What's the INSTANCE GENERATOR?** LLM inference
  (sample from a distribution)? Component library with
  random selection? Design-system-applied with
  deterministic seed from class-hash? Hybrid?
- **How does the factory certify class-membership?**
  Visual diff against reference instances
  (embedding-similarity with tolerance)? Semantic
  classification (CLIP / vision-language model)? Human
  approval? Automated class-description-reconstruction
  (render instance → classify → check equals original
  class)?
- **What about forms / interactive UI that DO need
  instance-identity?** Does the DSL have a
  `pinned { ... }` escape hatch? Or does interaction-
  critical UI live in a separate DSL layer entirely?
  Both are viable; the choice affects authoring
  complexity.
- **Relationship between UI-DSL and the SVF format
  family?** Are they the same discipline at two layers
  (interface / binary-format), or is SVF a tool the
  UI-DSL uses internally? If same-discipline-different-
  layers, there's a unification opportunity; if tool-
  dependency, there's a stack order.
- **Does the ServiceTitan demo path use UI-DSL from
  day 1, or does it start with instance-level scaffolding
  and retrofit class-level later?** The demo's 3-4hr
  claim implies day-1 class-level usage, but the factory
  may need instance-level scaffolding first for
  magic-eight-ball training data. Scope question for
  demo-path shape.

Flag these to Aaron when DSL-skeleton drafting starts.

## What this memory is NOT

- **NOT a commitment to any specific DSL syntax.** The
  syntax question is one of the open questions above.
  This memory names the SEMANTIC model, not the surface
  syntax.
- **NOT a claim that all UI needs class-level treatment.**
  Some UI genuinely needs instance-identity (interaction-
  critical elements, accessibility-fixed layouts, brand-
  compliance elements). The DSL is *class-level by
  default* with escape hatches for instance-level.
- **NOT a relaxation of correctness.** Class-level
  correctness is still correctness; it's a different
  equivalence relation, not a weaker one. "Any button
  that says Submit" is still correctness; "any UI at all"
  would not be.
- **NOT an instruction to throw away existing pixel-
  perfect tooling.** Figma, design-system-specs,
  component libraries remain load-bearing; the DSL is a
  LAYER ABOVE them, not a replacement.
- **NOT a directive to start DSL implementation now.**
  The six open questions must land with Aaron first. This
  memory captures the semantic model so the DSL-skeleton
  drafting (when it starts) has the correct correctness-
  criterion from day 1.
- **NOT limited to the ServiceTitan demo.** The DSL
  semantics named here apply to any UI-generation work
  the factory does, not just the demo. The demo is the
  first concrete forcing function.
