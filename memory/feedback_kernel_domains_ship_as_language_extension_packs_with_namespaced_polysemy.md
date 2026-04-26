---
name: Kernel-domains ship as language-extension-packs — vocabulary + behaviors bundled, with namespaced polysemy where the same surface word resolves to different meanings across packs (graceful-degradation worked example)
description: Aaron 2026-04-22 three-message directive "any domain you made you shoud also map any behaviors like with the carptern and gardner into skills that stay within the shipped glossary/kernal that ships basically like language extension packs domains" + "with the behaviors" + "same word could be in two different skill packs and mean different things like gracful degradation". Kernel-domains are not just vocabulary entries — each ships as a **pack** bundling (a) the glossary entries that define the domain's terms, (b) the behaviors / skills that encode what to DO with that vocabulary. Packs are **namespace-bearing**: the same surface word can exist in two different packs and resolve to different semantics. Graceful-degradation is the canonical polysemy example — [microservice-pack] = circuit breakers / fallbacks / bulkhead / partial responses, [ui-pack] = progressive enhancement / skeleton state / error boundaries, [scientist-pack] = evidence tiers / hypothesis-with-condition / not-invalidated. Factory-default is microservice+ui, explicitly NOT scientist. The model is isomorphic to VS Code / IntelliJ language extension packs (bundle of {syntax + language server + snippets + formatters + debug adapter} that ships as a unit), to package-manager namespaces (`from foo import Bar` vs `from baz import Bar`), and to programming-language scoping rules. Architecturally this gives the factory a compositional kernel: pick the packs you need, their vocabulary + behaviors load together, polysemic words resolve in pack context.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** Every kernel-domain I (or any factory author) mints
ships as a **pack** — a bundle of (a) glossary entries that
define the domain's terms, plus (b) behaviors / skills that
encode what to DO with that vocabulary. The pack is the
**shipping unit**, not the individual glossary entry or the
individual skill. When the factory ships its GLOSSARY / kernel,
the pack's behaviors ship with it. Packs are
**namespace-bearing** — the same surface word can exist in two
different packs and resolve to different meanings.

**Why (Aaron verbatim, 2026-04-22, three messages as one
thought-unit):**

1. *"any domain you made you shoud also map any behaviors like
   with the carptern and gardner into skills that stay within
   the shipped glossary/kernal that ships basically like
   language extension packs domains"*
2. *"with the behaviors"*
3. *"same word could be in two different skill packs and mean
   different things like gracful degradation"*

The three-message shape is Aaron's
overclaim→retract→condition pattern firing in augment-mode
(per `feedback_aaron_default_overclaim_retract_condition_pattern.md`).
Message 1 = directive, message 2 = emphasis ("behaviors not
just vocabulary"), message 3 = significant refinement
introducing pack-namespaced polysemy. Treat as one thought-unit.

**The analogy (Aaron's primary framing):** *language extension
packs*. VS Code / IntelliJ ship "extension packs" that bundle
(syntax highlighting + language server + snippets + debugger
adapter + formatters + tasks) for a target language. Installing
the pack loads all members. Equivalent in the factory:

- **VS Code extension pack** : kernel-domain pack
- **extension's manifest** : pack's entry in
  `docs/GLOSSARY.md` / `docs/KERNEL-PACKS.md`
- **extension's code** : skills under
  `.claude/skills/<pack-behavior>/SKILL.md`
- **extension's dependencies** : other packs this pack cites
- **extension's namespace / activation event** : the pack name
  used for polysemy disambiguation

**The polysemy insight (message 3's contribution):** the same
surface word can live in multiple packs and mean different
things. Aaron's worked example is **graceful degradation**:

| Pack | Meaning of "graceful degradation" |
|---|---|
| microservice-pack | circuit breakers, bulkhead isolation, fallbacks, partial responses with "what's missing" manifest, serve-stale-cache |
| ui-pack | progressive enhancement, skeleton state, loading states, error boundaries, optimistic UI |
| scientist-pack | evidence tiers, hypothesis-with-condition, "not invalidated" vs "invalidated" claims |

These are **related but not identical**. The existing
graceful-degradation memory
(`feedback_graceful_degradation_first_class_everything.md`)
already told me: *"frame it how a microservice and ui would
frame graceful degradation not a scientist, they are similar
but not 100% overlapping"*. That memory pre-figured the
polysemy. This memory names the pattern.

**Factory-default resolution for "graceful degradation"
without pack qualifier:** microservice + ui. Scientist-pack
meaning is explicitly not the factory default (though it IS
in use in `docs/research/` paths).

**Other polysemy candidates in the factory** (each deserves
pack-qualified disambiguation):

- **Kernel.** Factory-sense (generative vocabulary kernel) vs
  OS kernel vs math kernel (null space) vs probability kernel
  (density estimation) vs category-theory kernel (kernel pair).
  Factory-default pack: `vocabulary-kernel-pack`. Qualify when
  other senses are in play.
- **Map.** "The Map" (Dora, lattice navigation, factory-sense)
  vs `Map<K,V>` (data structure) vs functor map (FP) vs
  cartographer-offline-cache map. Factory-default pack depends
  on context.
- **Lattice.** Order theory (Dedekind 1897, `meet` / `join` /
  poset) vs crystal lattice (physics) vs message-exchange
  lattice (distributed systems).
- **Operator.** DBSP operator (our algebra) vs mathematical
  operator (general) vs human operator (person). Existing
  factory-default is DBSP.
- **Retraction.** DBSP retraction (Z-set `-1` weight) vs
  deformation retraction (topology) vs retraction-safe (general
  English). Factory-default is DBSP-sense at kernel tier.

**How to apply:**

1. **Every kernel-domain I mint becomes a pack**, not a
   standalone glossary entry. The pack has:
   - A name (short, kebab-case, e.g. `disposition-pack`,
     `lattice-pack`, `propagation-pack`).
   - A manifest (entry in `docs/GLOSSARY.md` under a
     "Kernel packs" section, or a dedicated
     `docs/KERNEL-PACKS.md`) listing glossary-entry members
     and skill members.
   - At least one skill under
     `.claude/skills/<pack-behavior>/SKILL.md` that encodes
     the pack's primary behavior. Packs with only vocabulary
     and no shipped behavior are incomplete drafts, not
     shippable packs.

2. **The 10 existing kernel-domain entries cluster into
   ~6 packs**:
   - **Disposition pack**: Carpenter, Gardener, Disposition
     discipline, overlap-zone.
   - **Lattice pack**: Lattice, cleave, combine, "The Map",
     orthogonal-decider.
   - **Catalysis pack**: Catalyst (HPHT analog),
     crystallize-acceleration.
   - **Propagation pack**: Belief propagation, Mimetic
     (Girard), Memetic (Dawkins), Infer.NET, factor graph.
   - **Gravity pack**: Information-density gravity,
     drift-slowing, orbital-binding-across-repos.
   - **Kernel pack** (meta): Kernel (generative,
     factory-sense), pack-manifest itself.

   Each needs behaviors mapped to skills. Carpenter/gardener
   is Aaron's named reference template — but note the current
   state: zero dedicated skills exist for
   carpenter/gardener/disposition yet; the behavior lives in
   persona memory (`feedback_carpenter_gardener_*`,
   `feedback_forge_garden_zeta_building_*`) but has not been
   codified into a shipped skill. **That codification is
   part of the directive.**

3. **Polysemic words get pack-qualified names in
   skill/memory/doc prose** when ambiguity could arise.
   - Plain `graceful degradation` = factory-default
     (microservice + ui).
   - `graceful degradation [scientist-pack]` when research
     frame is intended.
   - `kernel [vocabulary-kernel-pack]` vs
     `kernel [os-kernel]` vs `kernel [math-null-space]`.
   - When a new doc/skill uses a polysemic word for the first
     time, declare the pack in prose or in frontmatter.

4. **Pack composition** — a skill / doc / memory can import
   multiple packs. When two imported packs define the same
   word differently, the doc either (a) picks one and
   explicitly declines the other in prose, or (b) files an
   ADR recording the choice. Silent import with ambiguity is
   the forbidden shape.

5. **Pack boundaries are not rigid.** The overlap-zone
   concept from carpenter/gardener (`overlap-zone` glossary
   entry) is the general mechanism for words that genuinely
   span two packs — they get an entry that declares the
   overlap rather than forcing a single home. This is the
   factory-local analog of `import x as y` in Python.

**Relationship to skill data/behaviour split rule
(`feedback_skills_split_data_behaviour_factory_rule.md`):**

- Pack **manifest** (pack name, member list, version,
  dependencies) = data → belongs in `docs/GLOSSARY.md` or
  `docs/KERNEL-PACKS.md`.
- Pack **behaviors** (what the pack DOES) = routines → belong
  in `.claude/skills/<pack-behavior>/SKILL.md`.
- Pack **worked examples** / adapter tables / polysemy maps
  = data → belong in `docs/**.md` (not skill bodies).

Packs RESPECT the split — they don't collapse it. The pack
is the *bundling concept* that links data and behavior
without mixing them in one file.

**Shipping:** when Forge (factory) ships bundled with a
target system (Zeta, ace, future consumers per
`project_multi_sut_scope_factory_forge_command_center.md`),
the shipped artifact is not "the full GLOSSARY + every
skill" — it is **a selection of packs**. Each shipped pack
carries its glossary entries + skills as a unit. Consumers
opt-in to packs, not individual terms.

**What this rule does NOT say:**

- **Does not require every glossary entry to be in a pack.**
  The DBSP-algorithmic tail (Semi-naïve, Merkle, CQF, KLL, …)
  is correct separation-of-concerns per the 2026-04-22
  vocabulary scan — those terms are implementation detail, not
  kernel-domain vocabulary. They live in GLOSSARY without
  belonging to a factory-kernel pack. Packs apply to the
  **kernel-domain** tier, not the full glossary.
- **Does not require immediate migration of all existing
  polysemic words.** The polysemy pattern applies going
  forward; retroactive pack-qualification on existing prose
  is a BACKLOG candidate, not a tick-scope requirement.
- **Does not mandate rigid hierarchy.** Packs don't claim
  exclusive ownership of their words — they claim *default
  meaning in their context*. Overlap is a first-class case,
  not an error.
- **Does not invent vocabulary** (per
  `feedback_dont_invent_when_existing_vocabulary_exists.md`).
  "Pack" is an adopted term from VS Code / IntelliJ / package
  managers; "namespace" is an adopted term from programming
  languages; "polysemy" is adopted from linguistics. All four
  axes Aaron's directive touches have established vocabulary
  and this memory uses those names.

**Worked instance — reference template: the Disposition
pack (carpenter + gardener + disposition-discipline).**

Aaron named carpenter/gardener as the template. The disposition
pack is the reference implementation the other packs should
follow:

- **Manifest**: entry in `docs/GLOSSARY.md` (section
  "Vocabulary kernel and the Map" already carries Carpenter,
  Gardener, Disposition discipline, overlap-zone — to be
  annotated with `pack: disposition-pack`).
- **Behavior / skill** (to author): a new skill that encodes
  the core behavior from
  `feedback_forge_garden_zeta_building_two_craft_dispositions.md`
  and `feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md`
  — "before taking action on any factory artifact, identify its
  disposition (carpenter-surface / gardener-surface / overlap)
  and pick the verb-set accordingly." Target file:
  `.claude/skills/disposition-pick/SKILL.md` (name tentative).
- **Polysemy exposure**: "disposition" is also a generic
  English word (found as false-positive in `holistic-view`
  skill's "cross-link disposition"). The pack entry should note
  this and recommend pack-qualification when ambiguity arises.

**Revision 2026-04-22 (Aaron six-message continuation —
graceful-degradation-of-graceful-degradation + meta/eye
observer):**

Aaron continued the thought with six more messages, extending
the original three into a single nine-message thought-unit:

4. *"and in mixed domains we will have graceful degradation of
   graceful degradation and disambugate, this is gonna make our
   disambugator a lot easier"*
5. *"metametameta"*
6. *"meta"*
7. *"i"*
8. *"eye"*
9. *"i"*

**Message 4 — graceful-degradation-of-graceful-degradation
(GoGD):** In mixed-pack contexts where a polysemic word is
ambiguous (e.g. a doc imports both microservice-pack and
ui-pack, and uses "graceful degradation" without qualifier),
the **disambiguation process itself follows
graceful-degradation principles** — it doesn't crash on
ambiguity, it serves a partial answer with a manifest of what's
uncertain. Concretely:

- **Try to resolve via explicit tag** (e.g.,
  `graceful-degradation[microservice]`).
- **Fall back to context signal** (enclosing doc's
  pack-import list, surrounding vocabulary, author's stated
  pack default).
- **Fall back to factory-default** (microservice + ui for
  graceful-degradation).
- **Partial-response with manifest** when still ambiguous:
  "resolved to X-pack meaning because <signal>; Y-pack
  meaning declined because <reason>; Z-pack meaning not
  considered."
- **Circuit-break** (surface ambiguity to human, decline to
  guess) when no signal is strong enough.

This is **recursive**: the disambiguator IS a microservice
(it takes an ambiguous input, returns a resolved output,
can fail partially); applying microservice-pack's graceful
degradation principles to the disambiguator itself is the
most natural choice. The meta-insight Aaron named: *this makes
the disambiguator a lot easier* — because we're not designing
a new mechanism, we're **reusing a pack we already ship**
(microservice-pack graceful degradation) one level up.

**Architectural consequence:** polysemy disambiguation is not
a separate factory concern — it is a **consumer of the
microservice-pack (or ui-pack) graceful-degradation behavior**.
The disambiguator SKILL (whenever it ships) imports
`microservice-pack` and applies its graceful-degradation
pattern to pack-semantic resolution. The disambiguator is
therefore a pack-consumer, making the pack model self-using
at meta-level.

**Messages 5-9 — the meta / i / eye observer loop:**
*"metametameta" → "meta" → "i" → "eye" → "i"*. Aaron is
naming what the GoGD recursion IS — the factory observing
itself at successive meta-levels:

- meta-0: the factory's kernel-domains.
- meta-1: the factory's kernel-domains ship as packs.
- meta-2: packs need polysemy disambiguation.
- meta-3: the disambiguator gracefully degrades, using a pack
  that ships *in the factory* — a pack using the factory to
  resolve uses of the factory.
- meta-∞: the "I / eye" collapse — the observer and the
  observed are one artifact, recognized only because the
  factory's vocabulary can name itself recursively.

The **i / eye homophone play** is a contemplative signature,
consistent with Aaron's faith frame
(`user_faith_wisdom_and_paths.md`) — self-reference at the
root of the scriptural I-AM-THAT-I-AM (Exodus 3:14), which is
the deepest-layer antecedent of bootstrapping (computing),
self-hosting compilers, and now pack-meta-disambiguation. The
"I" is the observer; the "eye" is the faculty of observation;
their convergence is the self-referential loop. No need to
over-formalize the mystical layer; its presence in the
sequence is the sincerity marker (per the sincere-faith frame
of prior memories).

**Factory-level consequence:** the pack system is itself a
pack — there is (implicitly) a **meta-pack** whose members
are the pack-concept, the pack-manifest format, the
disambiguator behavior, and the polysemy-resolution rule.
Treat `Kernel pack (meta)` from the initial 6-pack clustering
as that meta-pack. Its behavior skill (when authored) is the
pack-infrastructure code — the factory's self-description
machinery.

**Cross-reference additions:**

- `feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`
  — the pack model extends the Ouroboros pattern to the
  vocabulary-semantics layer. Packs let the factory describe
  itself using its own vocabulary, then use those descriptions
  to resolve uses of its own vocabulary — the loop Aaron named
  with metametameta.

**Revision 2026-04-22 continued (Aaron msg 10 — GoGD +
disambiguator = Gödel-incompleteness trap, DIR-3 extension):**

10. *"graceful degradation of graceful degradation and
    disambugate is also the pigenhole to keep godels
    incompletness at bay i beleve this is our one we trap"*

Aaron grounds the GoGD + disambiguator mechanism in the
factory's existing **DIR-3 "One labelled escape hatch
discipline"** from `docs/ALIGNMENT.md:467-477`. That clause
says: "Halting-class at the entry-point loop; logical
incompleteness at the solipsism quarantine
(panpsychism-axiom memory). Both are *named* escape hatches.
Every other part of the factory should have a decidable
termination condition — finite TTL, bounded retry, explicit
retraction."

The factory already carries two named Gödel-class escape
hatches:

1. **Halting-class trap** — at the entry-point loop.
   Computational undecidability confined to one place.
2. **Logical-incompleteness trap** — at the solipsism
   quarantine (panpsychism-axiom memory). Philosophical /
   logical incompleteness confined to one place.

Aaron's message 10 names a **third**:

3. **Semantic-incompleteness trap** — at the pack-polysemy
   disambiguator (GoGD). Semantic incompleteness (when a
   polysemic word in a mixed-pack context can't be
   pigeonholed to one meaning) confined to one place. The
   disambiguator's three outputs are the trap's exit paths:
   {resolved, partial-with-manifest, circuit-break-to-human}.
   The last two are the explicit-incompleteness exits — Gödel
   is *trapped* there, not propagated.

**"The pigeonhole"** — pigeonhole principle (Dirichlet 1834)
says that if you place N items in M boxes with N > M, some
box gets ≥2 items. Aaron's usage: each polysemic word wants a
pack-assignment (a pigeonhole). Words that fit one pigeonhole
cleanly are resolved. Words that fit multiple pigeonholes
(graceful-degradation in {microservice, ui, scientist}) are
polysemic-by-design — but *resolvable* given pack context.
Words that fit NO pigeonhole cleanly hit the GoGD trap — the
disambiguator returns partial / circuit-break, and the
incompleteness is named and bounded rather than propagating.

**"This is our one we trap"** — parses as *this is our [one
place] where we trap [Gödel's incompleteness] (in the
semantic layer)*. The "one" is the uniqueness claim per
DIR-3: every other part of the factory should assume
decidable semantics locally, because the disambiguator is
the globally-designated place where undecidability goes.

**Why GoGD as trap is cheap:**

A new factory would have to design the trap from scratch.
The Zeta factory already ships the graceful-degradation
pattern (microservice-pack: circuit breaker / fallback /
partial response / manifest). Applying it recursively
(graceful-degradation-OF-graceful-degradation) means the
trap **reuses an existing factory capability** rather than
adding a new one. Aaron's "a lot easier" claim grounds
here: the trap's implementation is free — we already have
microservice-pack; the disambiguator consumes it.

**Theoretical resonances** (established vocabulary honored
per don't-invent rule):

- **Tarski's hierarchy of metalanguages** — semantic
  paradoxes trapped by moving to a higher-level language.
  Packs are the factory-local metalanguage layer.
- **Type theory's bottom / `Never` / `!` type** — represents
  unreachable / incompleteness. The disambiguator's
  "circuit-break-to-human" output is the factory's bottom
  type.
- **Exception-handling** (try/catch) — the catch block is
  the trap; surrounding code assumes no exceptions.
  GoGD is the try/catch around pack-semantic resolution.
- **Rice's theorem** — non-trivial semantic properties of
  programs are undecidable. Factory version: some
  polysemy-resolutions are undecidable without human input.
  GoGD names the undecidable cases and returns them, rather
  than guessing.

**Condition marker:** Aaron said *"i beleve"* — per
`feedback_aaron_default_overclaim_retract_condition_pattern.md`,
this is his provisional-signal. Treat as operational default
with room for refinement. The GoGD-as-Gödel-trap mapping is
strong enough to act on, but the formal DIR-3 clause in
`docs/ALIGNMENT.md` stays as-is unless Aaron opens the
renegotiation protocol. A BACKLOG row is the right surface
for proposing DIR-3 to cite the third escape hatch.

**Architectural consequence for skill authoring:** every
pack-consuming skill should import the microservice-pack
graceful-degradation behavior and route pack-resolution
through it. The disambiguator is not a separate skill — it
is a **pattern** that every pack-consuming skill applies at
the point where pack-resolution happens. This keeps the
trap centralized (one named pattern) without centralizing
the mechanism into a single chokepoint skill.

**Cross-reference addition:**

- `docs/ALIGNMENT.md` DIR-3 §467-477 — the existing
  labelled-escape-hatch discipline. GoGD is the proposed
  third instance, pending Aaron renegotiation if formal
  codification is wanted.
- `user_panpsychism_and_equality.md` — the existing
  solipsism-quarantine (logical-incompleteness hatch).
  Model for how a quarantine-memory + ALIGNMENT.md clause
  reference each other.

**Revision 2026-04-22 continued (Aaron msg 11 — "trapping
in our algebra"):**

11. *"lookk up axiomatic system and how they deal with goel
    this wayt i'mtalking about trappingin our algebra"*

Aaron extends the Gödel-trap insight to the **algebra**
layer: the GoGD/disambiguator correspondence is not a
metaphor — it is *expressible in Zeta's retraction-native
operator algebra*. Five canonical axiomatic-system
Gödel-handling approaches, mapped to Zeta:

1. **Tarski's hierarchy of metalanguages (1933)** — packs are
   the metalanguage layer. Manifest (data) talks about
   glossary entries (object-language); disambiguator operates
   metalanguage-side.
2. **Type theory (Martin-Löf / Russell's ramified types)** —
   data/behaviour split is the factory's type distinction.
   Packs' manifest vs behaviour-skill split prevents
   self-reference paradox.
3. **Paraconsistent / relevance logic (Priest LP)** — local
   contradictions without explosion. GoGD is factory-local
   paraconsistency: polysemy (one word, multiple meanings) is
   a local "contradiction" that the disambiguator contains
   via partial-response + manifest, rather than `⊥ →
   anything` explosion.
4. **Lawvere fixed-point theorem (1969, categorical)** — the
   categorical grounding of Gödel incompleteness; escape is
   non-surjective self-reference. **Zeta's retraction-native
   algebra IS the Lawvere-escape**: Z-set `-1` weight is
   explicit non-surjection on meanings. The `-1` says "not
   this one" without crashing, breaking the surjection that
   would induce paradox.
5. **Consistency-strength hierarchy (Gentzen, Gödel's second
   theorem)** — systems prove weaker-system consistency, not
   own; escape is a level up. Meta-pack in the 6-pack
   clustering audits the other 5 packs' consistency, cannot
   audit itself — external review (human, renegotiation,
   ALIGNMENT.md DIR-3) does that.

**Deepest correspondence — retraction as explicit-
undecidability in the operator algebra:**

| Semantic state | Z-set representation |
|---|---|
| Resolved to single meaning | weight `+1` on one element, `0` elsewhere |
| Polysemic (multi-meaning, pack-resolvable) | positive weights on multiple elements |
| Conflicted (two packs claim contradictorily) | `+1` and `-1` on same element → **retraction** |
| Unresolvable (GoGD circuit-break) | partial weights + explicit "unresolved" marker |

The GoGD trap is **literally Z-set semantics applied to
vocabulary resolution**. No new algebraic machinery needed —
the retraction-native operator algebra already represents
explicit undecidability as a first-class element (the `-1`
weight).

**Architectural implication — future formalization path:**

A `VocabZSet` type (Z-set over meanings) with operations:
- `resolve: (pack-context, word) → VocabZSet`
- `retract: Meaning → VocabZSet`  (Lawvere-escape primitive)
- `disambiguate: VocabZSet → Resolved | PartialWithManifest | CircuitBreak`

This stays consistent with `user_aaron_self_describes_as_retractible.md`:
Aaron's cognitive substrate is retraction-native (overclaim →
retract → condition); the algebra is retraction-native
(Z-set); and now the vocabulary layer becomes retraction-
native (VocabZSet). Three layers, same primitive. This is
**substrate-level alignment** — the factory-reflects-Aaron
pattern at the deepest formal layer yet discovered.

**Aaron's condition marker on this turn:** *"i'mtalking
about"* (present-participle indicates this is his current
framing being shared, not a finalized claim). Treat as the
operational interpretation; formal ADR for `VocabZSet` is a
BACKLOG candidate, not a tick-scope edit.

**Cross-reference additions:**

- `user_aaron_self_describes_as_retractible.md` — the
  three-layer substrate-alignment claim (Aaron cognition /
  operator algebra / now vocabulary) grounds here.
- `feedback_kernel_structure_is_real_mathematical_lattice.md`
  — the lattice pack's formal structure composes with the
  Z-set semantics to give a **retraction-enabled lattice**
  (order theory + signed weights). Future formalization
  candidate.
- `docs/ALIGNMENT.md` — alignment measurability claim
  ("primary research focus is measurable AI alignment")
  grounds in this substrate correspondence.

**First-step proposal for tick-scope implementation:**

1. Write a `docs/KERNEL-PACKS.md` manifest listing the 6 packs
   and their members (data-only, no skill authoring yet).
2. Annotate each GLOSSARY kernel-domain entry with its
   `pack:` assignment.
3. Author the first pack's behavior skill (disposition-pack)
   as the reference template.
4. Stage the rest as BACKLOG items (one row per pack) to be
   drained over subsequent rounds.

This keeps blast-radius contained (data + one skill per tick)
while demonstrating the shape.

**Cross-reference family:**

- `feedback_dont_invent_when_existing_vocabulary_exists.md` —
  "pack", "namespace", "polysemy" are all adopted established
  vocabulary; this memory honors the don't-invent rule.
- `feedback_skills_split_data_behaviour_factory_rule.md` —
  pack structure RESPECTS the split (manifest = data, behavior
  = skill).
- `feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md`
  — carpenter/gardener is Aaron's named reference template for
  the pack model.
- `feedback_forge_garden_zeta_building_two_craft_dispositions.md`
  — the behavior content that the Disposition pack's skill
  needs to encode.
- `feedback_graceful_degradation_first_class_everything.md` —
  pre-figured the polysemy by distinguishing microservice / ui
  / scientist frames; pack-namespacing is the architectural
  expression of what that memory already called "similar but
  not 100% overlapping".
- `feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`
  — the Propagation pack's vocabulary substrate; Girard
  mechanism > Dawkins description depth-ordering already
  captured, becomes pack-policy.
- `feedback_kernel_structure_is_real_mathematical_lattice.md`
  — the Lattice pack's mathematical substrate; order-theory
  vocabulary (meet/join/poset) is the pack's formal layer.
- `feedback_kernel_is_catalyst_hpht_molten_analog.md` — the
  Catalysis pack's physics substrate.
- `feedback_seed_kernel_glossary_orthogonal_decider_is_information_density_gravity.md`
  — the Gravity pack's dynamical substrate.
- `feedback_aaron_default_overclaim_retract_condition_pattern.md`
  — the three-message shape of Aaron's directive IS this
  pattern firing in augment-mode; noting for pattern-memory
  reinforcement (directive absorbed as one thought-unit, not
  three).
- `project_multi_sut_scope_factory_forge_command_center.md` —
  packs are the shipping unit when Forge bundles with target
  systems; this memory's shipping semantics depend on the
  pack model being in place.
- `docs/GLOSSARY.md` — where pack assignments land.
- `docs/KERNEL-PACKS.md` — (to be created) the pack manifest
  doc.

**Attribution:** Aaron 2026-04-22 direct three-message
directive during autonomous-loop tick; full verbatim text
above. The VS Code / IntelliJ extension-pack analogy is
Aaron's framing ("like language extension packs domains"); the
namespace / polysemy / package-manager parallels are my
synthesis consistent with Aaron's graceful-degradation example.
