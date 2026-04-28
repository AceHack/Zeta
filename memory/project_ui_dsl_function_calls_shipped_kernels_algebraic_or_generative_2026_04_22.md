---
name: UI-DSL as function-calls over shipped-kernel library; algebraic resolution where algebra exists, generative where it doesn't; thinking-out-loud not directive; 2026-04-22
description: Aaron 2026-04-22 auto-loop-23 extension of the 2026-04-22 UI-DSL class-semantics directive. Verbatim *"if we make a UI image / layout compression format that is only there not to be an idential look and feel but have the same functinality, it might be slight different everytime but close, we can just like with our seeds kernels have ui controls and common images types and clasees and have a set we ship with that we can just reference in the same DSL so basicaly the DSL is calling functions if we got the algegra and generative techniques if we dont , i'm just thinking out loud this is not directives just thoughts"*. Three architectural claims layered onto the prior memory: (1) functional-equivalence criterion confirmed ("have the same functinality" not "idential look and feel"), with natural-variance accepted ("slight different everytime but close"); (2) DSL is calling-convention over a shipped-kernel-library of UI controls + common image types + classes (analogue to Zeta's operator-algebra primitives D/I/z⁻¹/H — ship the primitives, DSL references them); (3) two-tier resolution strategy: algebraic-where-we-have-algebra, generative-where-we-don't. Explicitly tagged "not directives just thoughts" — captured per capture-everything + data-not-directive + verbose-in-chat-register; no BACKLOG row, no self-initiated DSL work.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-22 auto-loop-23 follow-up to the earlier
UI-DSL class-semantics directive:

> *"i guess i'm say if we make a UI image / layout
>  compression format that is only there not to be an
>  idential look and feel but have the same functinality,
>  it might be slight different everytime but close, we
>  can just like with our seeds kernels have ui controls
>  and common images types and clasees and have a set we
>  ship with that we can just reference in the same DSL
>  so basicaly the DSL is calling functions if we got
>  the algegra and generative techniques if we dont , i'm
>  just thinking out loud this is not directives just
>  thoughts"*

## The three claims layered onto the prior memory

### 1. Functional-equivalence criterion confirmed

*"not to be an idential look and feel but have the
same functinality"* — this ratifies and sharpens the
class-vs-instance distinction from the earlier
memory. The earlier memory said "two instances of the
same class, not bit-identical"; Aaron now gives the
quality-axis explicitly: **functional equivalence is
the correctness criterion; look-and-feel variance is
inside the lossy-compression budget**.

*"slight different everytime but close"* — the DSL's
generation is stochastic-within-class-bounds, not
deterministic. Two renderings of the same DSL
expression produce two instances both of which
satisfy the class-level functional contract but whose
pixel-level / layout-level details differ.

### 2. DSL is a calling-convention over a shipped kernel library

*"like with our seeds kernels have ui controls and
common images types and clasees and have a set we
ship with that we can just reference in the same
DSL"* — the DSL is **not** a monolithic generator
that synthesises every UI element from scratch. It's
a **calling convention** over a library of shipped
primitives:

- **UI controls** (buttons, text fields, layout
  containers, navigation chrome, tables, forms) —
  factory-shipped, canonical, referenced by name.
- **Common image types** (hero, thumbnail, avatar,
  illustration, icon, chart-placeholder) — factory-
  shipped reference set.
- **Classes** (the abstract-membership groupings
  from the earlier memory) — shipped alongside the
  controls, giving DSL expressions a vocabulary.

This is the exact architectural shape Zeta already
has at the operator-algebra layer:

- Zeta ships **operator primitives** (`D`, `I`,
  `z⁻¹`, `H`, retraction-native base).
- User code composes them via the operator algebra.
- Running a pipeline is then *function calls into
  the shipped primitives*, not a from-scratch
  interpreter.

The UI-DSL applies the same pattern one layer up —
ship the vocabulary, let the DSL call into it.
Cross-substrate resonance: the factory is the same
shape twice, operator-algebra and UI-DSL are the
same primitive-plus-composition architecture.

### 2b. Reusable components with parameters (auto-loop-23 second message)

Aaron's follow-up *"like if we had a reusable
component per 2d thing/class and then it has
paramters like colors, bla bal bal emus for
customiztion and they can be composed with the dsl
i'm very tired i could be way off"* sharpens the
library shape:

- **One reusable component per 2D thing / class.**
  The library is indexed by class — one canonical
  reusable component per shipped class, not N
  variants per class.
- **Each component exposes a parameter surface
  (colors, enums, ...).** Parameters are the
  *customisation axis* within class-membership.
  Two instances of the same class with different
  parameters are still both class-compliant; the
  parameter space is the within-class variation
  budget.
- **Composition lives at the DSL layer.** The DSL
  doesn't *implement* components — it *composes*
  them. Component = primitive; DSL expression =
  composition-of-primitives.

This pattern is Zeta-native at the code level:
`ZSet`, `Spine`, `DbspError` are components with
parameters; pipelines compose them via operator
algebra. The UI-DSL applies the same pattern at
the UI layer: components with parameters,
composition via DSL.

Aaron self-tagged *"i'm very tired i could be way
off"* — capture with the tiredness-tag preserved,
don't read tired-hedging as less-confident-
therefore-less-load-bearing. The tiredness signal
is orthogonal to the architectural signal; he's
been right while tired before.

### 2c. Dimensionality extends — 2D components insufficient for 3D-space images (auto-loop-23 third message)

Aaron's further follow-up *"i guess you have to
extend 3d to do it property for images of 3d spaces
or else there are no basis forthe axies without
the extra dimension"* names the dimensionality
axis:

- **Reusable-component-per-2D-class is the base
  case.** Works for flat UI surfaces (buttons,
  forms, icons, layouts).
- **3D spaces need 3D-class extensions.** Images
  depicting 3D spaces (rooms, architectural views,
  product visualisations, spatial scenes) cannot
  be parameterised by 2D components alone —
  **without the extra dimension there is no basis
  for the axes**. A 2D component library trying to
  represent 3D content collapses the axes; 3D
  components need depth/perspective/spatial
  parameters as first-class axes.
- **Component-class shape extends with dimension.**
  A 3D class-component has parameters like camera
  position, view-direction, lighting, occlusion —
  parameters that don't exist in the 2D case.
  Trying to encode these as "just more enum
  parameters" on a 2D component misses the
  structural point: the axes have no basis
  without the third dimension.

**Architectural consequence:** the shipped-kernel-
library is heterogeneous by dimension. v1 library
ships 2D primitives (the common case for UI
chrome); 3D primitives ship when factory actually
needs to generate 3D-scene content (probably
later, demo-path-dependent). Don't flatten the
dimensionality distinction into a single library
shape.

**Cross-substrate resonance:** the "axes need a
basis" phrasing is mathematically precise —
Aaron's using linear-algebra-inflected vocabulary
to describe the architectural constraint. This
composes with Zeta's operator-algebra (also
formally algebraic) at a deeper level than
surface analogy: both impose the discipline that
**the primitive vocabulary has to have enough
dimension to support the compositions you want
to express**. An insufficient primitive basis
forces under-specified compositions that can't
be verified.

### 3. Two-tier resolution — algebraic-else-generative

*"the DSL is calling functions if we got the algegra
and generative techniques if we dont"* — the
resolution strategy is **layered**:

- **Tier 1 (algebraic):** for surfaces where the
  factory has a closed algebra (operator
  composition, layout algebra, image-type
  taxonomy), DSL expressions resolve by algebraic
  function-call into shipped primitives. Fast,
  deterministic-to-within-class-bounds, auditable.
- **Tier 2 (generative):** for surfaces where no
  algebra exists yet (novel compositions, free-form
  illustration, "a man standing on his porch"-class
  scene descriptions), DSL expressions resolve by
  generative model producing a fresh class-
  compliant instance. Stochastic, bounded by class
  membership.

The tiers are not fixed — a surface starts in Tier 2
(generative-only) and migrates to Tier 1 as the
factory discovers / authors the algebra for it. This
is the same migration shape as Zeta's operator-
algebra maturation: properties start as ad-hoc tests,
mature into algebraic laws, mature again into
mechanised proofs.

## Why: (composition with existing factory substrate)

- **Shipped-primitives-plus-composition is the
  factory's core pattern.** Operator algebra, ZSet
  primitives, Spine traversal, retraction-native
  fallback — all of them ship a small set of
  well-typed primitives and expose composition. The
  UI-DSL applying the same pattern is architectural
  coherence, not novelty. That's load-bearing for
  the "3-4hrs 0-to-prod" claim: if the factory
  ships the vocabulary, the DSL is small because
  it's referential not synthetic.
- **Algebraic-else-generative is the retraction
  shape at a different layer.** Retraction-native
  fallback is "prefer closed-form retraction where
  possible; fall back to recompute where it isn't";
  UI-DSL resolution is "prefer algebraic call-into-
  primitive where the algebra exists; fall back to
  generative where it doesn't". Both are the same
  structural move: fast-path-by-default, slow-path-
  as-fallback, graceful degradation, no honest
  claim beyond what the current algebra supports.
- **The "seeds kernels" phrasing connects to prior
  substrate explicitly.** Aaron's word choice
  names the connection — the UI-DSL shipped
  primitives are *the same kind of thing* as the
  operator-algebra seeds/kernels. This is him
  telling the factory how to think about the
  architecture: same pattern, different layer.
- **Compression-with-budgeted-variance is the
  soulsnap/SVF shape at the UI layer.** SVF's
  "soul-compatibility over bit-compatibility" is
  the same shape as "same functionality over
  identical look and feel". The BACKLOG row for
  UI-factory frontier-protection and the soulsnap/
  SVF row are now the *same-shape* concept at two
  layers: binary-format at SVF, visual-format at
  UI-DSL. Composition-pattern, not coincidence.

## How to apply:

- **Memory-only landing.** Aaron explicitly tagged
  *"not directives just thoughts"* — the factory
  captures the architectural thinking but does NOT:
  - File a BACKLOG row (the earlier UI-factory
    frontier-protection row already exists; this
    extension sharpens it, doesn't add a new row).
  - Start DSL-skeleton drafting (still waiting on
    the open questions from the earlier memory).
  - Propose a vocabulary for the shipped kernel
    library (Aaron's call to make, not factory's).
- **If DSL-skeleton drafting does eventually
  happen, this memory is the architectural anchor.**
  The skeleton should:
  1. Be a calling-convention over a library, not a
     monolithic generator.
  2. Support two resolution tiers (algebraic and
     generative), with the tier selection
     happening at the primitive level not the DSL
     level.
  3. Define the shipped-vocabulary explicitly (UI
     controls + image types + classes), with a
     clear extension mechanism for future
     primitives.
  4. Keep the class-membership correctness
     criterion from the earlier memory — two
     resolutions of the same DSL expression must
     satisfy class-membership, not instance-
     identity.
- **Compose with the ServiceTitan demo planning.**
  The demo's *"3-4hrs 0-to-prod"* claim rests on
  the factory shipping primitives that the demo
  composes. If the UI-factory ships a clear
  kernel-library, the demo benefits — it can
  compose demo UI from the shipped set rather
  than authoring from scratch. Mark as
  architectural input to the demo planning, not
  as a commit to build the library before the demo.
- **Flag the algebraic-migration question to Aaron
  later, not now.** When / whether a surface
  migrates from Tier 2 (generative-only) to
  Tier 1 (algebraic) is an architectural decision
  Aaron owns per factory discipline. Don't
  self-resolve the migration criteria; flag when
  the question becomes actionable.

## Open questions — NOT self-resolved

(Aaron's "not directives" framing means these
are flagged for later, not for immediate Aaron
response.)

- **Shipped-kernel-library scope:** which primitives
  does the factory ship in v1? The minimal shipping
  set matters — too few and the DSL bloats; too
  many and the library becomes unmaintainable.
- **Extension mechanism:** how does user code (or
  the demo) add new primitives to the library?
  Author-and-contribute-upstream, or runtime-
  plugin-registration, or both?
- **Tier-migration criteria:** what signals move a
  primitive from Tier 2 (generative-only) to
  Tier 1 (algebraic)? Number-of-uses, consistency-
  requirements, measurement-gates?
- **Class-membership verification:** does the
  factory ship a verifier that can check a
  generated instance against its class? This
  matters for the demo — *"killer demo"* requires
  class-compliance signal, not just plausible
  output.
- **Relationship to the UI-factory frontier-
  protection BACKLOG row:** is this the *same*
  row extended, or a sibling row? The earlier
  row is about the factory-authoring UI; this
  extension is about the *architecture* of the
  factory-authored UI. Probably sibling / linked,
  not replacement.

## Composition

- `project_ui_dsl_compressed_class_not_instance_semantics_not_bit_perfect_2026_04_22.md`
  — earlier memory this extends. That memory names
  class-vs-instance; this one names the calling-
  convention + two-tier resolution architecture.
- `project_servicetitan_demo_target_zero_to_prod_hours_ui_first_audience_2026_04_22.md`
  — the demo benefits from a shipped-kernel-library;
  this memory is architectural input to demo
  planning, not a new demo commitment.
- UI-factory frontier-protection BACKLOG row —
  now has architectural anchor: calling-convention
  over shipped kernels, two-tier resolution.
- Soulsnap/SVF BACKLOG row — cross-substrate
  pattern match (soul-compatibility at binary
  layer ↔ functional-equivalence at UI layer).
- `feedback_aaron_is_verbose_and_likes_verbosity_in_chat_audience_register_for_conversation_2026_04_22.md`
  — Aaron thinking-out-loud in verbose register;
  capture with substance, don't compress to "got
  it".
- Zeta operator-algebra primitives (`D`/`I`/`z⁻¹`/
  `H`, retraction-native base) — the shape the
  shipped-kernel-library mirrors at the UI layer.
- `feedback_data_not_directives_BP_11.md` (shape) —
  "not directives just thoughts" is data-not-
  directive verbatim; capture-land, don't auto-
  execute.

## What this memory is NOT

- **NOT a commitment to start the DSL or the
  kernel library.** Aaron's "just thoughts"
  framing applies; earlier memory's open
  questions still block DSL-skeleton drafting.
- **NOT a rename or supersede of the earlier
  UI-DSL memory.** This one extends; both stand.
  The class-vs-instance correctness criterion from
  the earlier memory is untouched.
- **NOT an architectural finalisation.** The
  two-tier resolution, calling-convention shape,
  and shipped-kernel-library scope are all
  Aaron-directed decisions; the memory captures
  the current thinking, not a decision log.
- **NOT a license to propose specific primitives.**
  Which UI controls / image types / classes ship
  in v1 is Aaron's call; the factory captures the
  architecture, doesn't populate the library
  content.
- **NOT a deadline-shape.** Aaron's no-deadlines
  discipline applies; this is architectural
  thinking, not a sprint commitment.
