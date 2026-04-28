---
name: Don't invent vocabulary when one already exists — adopt-or-explicitly-decline, never implicit
description: Aaron 2026-04-22 "we should always try to not invent termonology where some already exists unless it's an explicit decison no implicit it's part of the everyhting has it's home, like six sigma we explicity decided not to pull in their entire termonology". When a well-known vocabulary (git, OWASP, Six Sigma, Kanban, W3C, RFC, a consuming library, a standard) already covers a concept, adopt its terms verbatim rather than minting parallel names. Inventions are only OK when they are the product of an explicit documented decision — "everything has its home." Implicit inventions (even small ones like "primary/dev-surface" alongside "upstream/fork") violate this; they accumulate into a bespoke dialect that doesn't index into external knowledge. Paired with the Six-Sigma-vocabulary exception pattern: we adopted DMAIC + WIP, explicitly declined the full lexicon.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** Before naming a new concept — or re-naming an
existing concept in factory prose, skills, memories, ADRs,
BACKLOG rows, error messages, or code identifiers — **check
whether an established vocabulary already has a term for this
thing.** If yes, adopt that term verbatim. The only licensed
way to *not* adopt is an **explicit documented decision** (ADR,
skill decision log, memory, or inline "we explicitly decline
this term because …" note). No implicit inventions.

**Why:** Aaron 2026-04-22, verbatim (with silent correction per
typing-style memory):

> "we should always try to not invent termonology where some
> already exists unless it's an explicit decison no implicti
> it's part of the everyhting has it's home, like six sigma
> we explicity decided not to pull in their entire
> termonology"

Triggered immediately after I invented parallel labels
("primary" for LFG, "dev-surface" for AceHack) when git
already had canonical names for that relationship
("upstream" / "fork"). The invented pair paid no rent — the
governance framing was expressible as a consequence of the
git topology — but it accumulated noise that a reader had to
translate back into git's actual vocabulary. The broader
lesson: **invented parallel vocabularies don't index into
external knowledge**. A future contributor who googles
"GitHub upstream fork" gets real documentation. A future
contributor who googles "primary dev-surface Zeta" gets
nothing.

Three facets in Aaron's message:

1. **"Everything has its home."** Concepts have canonical
   homes in established vocabularies. Git, OWASP, Six Sigma,
   Kanban, W3C, NIST, RFCs, C# naming conventions, F# idiom,
   .NET framework terminology, the operator-algebra of the
   retractable-contract ledger itself — each is a home. When
   a concept is described in a home vocabulary, that is its
   home. Invent only when no home exists or when multiple
   homes conflict and a factory-local term is needed as a
   tie-breaker.

2. **Six-Sigma is the model of explicit decline.** Per
   `memory/user_kanban_six_sigma_process_preference.md`, we
   adopted Six Sigma's DMAIC + WIP and **explicitly declined**
   the rest of the lexicon (black belts, kaizen events,
   control charts by that name). That decline was recorded.
   That is the licensed path. Silently inventing "primary"
   and "dev-surface" when "upstream" and "fork" already
   exist is the **anti-pattern** Six-Sigma's explicit partial
   adoption was meant to contrast with.

3. **Explicit > implicit.** An invention documented with a
   reason ("we chose X over Y because Y carries these
   connotations we want to avoid") is defensible. An
   invention that silently slides into the codebase is not.
   The cost of recording the decision is tiny; the cost of
   a year-later "why do we say X instead of Y" debugging
   session is large.

**How to apply:**

1. **Before naming anything, check for an existing home.**
   When about to write a new noun for a concept in any
   artifact (doc, skill, memory, ADR, BACKLOG row, code
   identifier), ask:

   - Does git / GitHub API / GitHub docs have a term for
     this? (upstream, fork, remote, branch, tag, PR,
     ruleset, ref, HEAD, …)
   - Does the language / framework have a term? (F#
     record, C# partial class, .NET analyzer, Result
     monad, discriminated union, …)
   - Does a standard have a term? (OWASP LLM-01 through
     LLM-10, CWE, CVE, RFC verbs, NIST RMF function,
     SLSA level, SPDX license ID, …)
   - Does a methodology in use here have a term? (Six
     Sigma DMAIC, Kanban WIP, PDCA, TDD red/green, …)
   - Does the factory's own documented vocabulary have a
     term? (`docs/GLOSSARY.md`, the operator-algebra, the
     retraction-native contracts, the ledger, rounds,
     persona names, BP-NN rule IDs, …)
   - **Does a formal-substrate vocabulary have a term?**
     (ML / AI / Bayesian: belief propagation, factor graph,
     sum-product, variational inference, MDL, information
     gain; probabilistic programming: Infer.NET primitives,
     Pyro, Stan vocabulary; graph theory: DAG, tree-width,
     min-cut, PageRank; mathematics: lattice / poset / meet
     / join / Heyting algebra, group / ring / field, Galois
     connection; physics / chemistry: catalyst, HPHT, phase
     transition, free energy; information theory: Kolmogorov
     complexity, entropy, mutual information, Shannon bound;
     religious studies / social theory: Girard mimetic,
     parable substrate, ritual, liminal). Added 2026-04-22
     after the belief-propagation reframe proved this axis
     was missing from the checklist — I invented "kernel-
     vocabulary propagation" without grepping Pearl 1982 or
     `docs/ROADMAP.md:80` (which already held `Zeta.Bayesian`
     = Infer.NET = belief propagation). A one-minute check
     of this axis would have caught it pre-emptive.

   If any answer is yes, adopt verbatim. If multiple answers
   yes and they conflict, file a decision note naming the
   chosen term and the declined alternatives.

2. **"Explicit" means written-down, not just thought-about.**
   The licensed invention path is one of:

   - An ADR under `docs/DECISIONS/YYYY-MM-DD-*.md` naming
     the new term, the rejected alternatives, and why the
     invention pays rent that an existing term wouldn't.
   - A skill decision log entry (skill-creator workflow)
     when the invention is skill-local.
   - An inline "we explicitly decline `<existing-term>`
     because `<reason>`; use `<new-term>`" note at the
     first use-site in the governing doc.
   - A memory entry like this one, when the decision is
     factory-wide policy.

   Silent adoption of a new term in a commit without any of
   these is the violated shape.

3. **Six-Sigma partial-adoption is the template.** We took
   DMAIC + WIP; we declined the rest. That split is
   recorded in
   `memory/user_kanban_six_sigma_process_preference.md`
   and
   `docs/FACTORY-METHODOLOGIES.md`. Any future partial
   vocabulary adoption should follow the same pattern:
   adopt-verbatim for the kept terms, record-the-decline
   for the rejected ones.

4. **Retroactive fixes.** When an accidental invention is
   discovered (the pattern here: review, notice, compare
   against the established vocabulary, correct), do the
   same four things every time:

   - Rewrite the invented term to the established one.
   - Add a one-line note in the governing doc that the
     established vocabulary is now the canonical one.
   - If the invention had any genuine content that the
     established vocabulary didn't capture, preserve that
     content phrased in the established vocabulary.
   - Log the correction in the commit message with a brief
     "<invented> → <established>; reason: <why>".

5. **Counter-instances where invention IS justified.** Not
   every factory-local noun is an invention-to-apologize-for.
   Legitimate inventions:

   - **Concept no established vocabulary covers.**
     E.g. "retractable-contract ledger" — there is no
     prior term of art. Invention is required.
   - **Disambiguation from an overloaded term.**
     E.g. "spec" means TLA+ in one context and OpenSpec in
     another; the factory explicitly keeps both, per
     `docs/GLOSSARY.md`.
   - **Factory-specific roles where generic terms mislead.**
     E.g. persona names (Kenji, Sova, Ilyana) — generic
     "reviewer-1 / reviewer-2" would be worse.
   - **Pedagogical / teaching aids.**
     E.g. SPACE-OPERA variant of the threat model; the
     canonical term (STRIDE) is also present; the variant
     is an explicit teaching overlay.

   All four counter-instances share one property: they have
   a recorded rationale. The common mode is *record the why
   at the moment of invention*, not *apologize six months
   later when someone asks*.

**What this rule does NOT mean:**

- **Not a ban on factory-internal composites.** Phrases like
  "round-close ledger" or "bulk-sync PR" compose
  established terms (round, close, ledger, bulk, sync, PR).
  Composition of established terms into a local phrase is
  fine and requires no explicit decision; inventing
  single-word *alternatives to* established terms is what
  the rule targets.
- **Not a ban on shortenings.** "LFG" for
  Lucent-Financial-Group and "AX" for agent-experience are
  established abbreviations, not inventions.
- **Not a style-guide override.** When an established
  vocabulary has multiple canonical terms for the same
  concept (e.g. "fork" vs "mirror"), picking one is a
  style call that doesn't need an ADR — though the GLOSSARY
  should reflect the choice.

**Cross-reference:**

- `memory/user_kanban_six_sigma_process_preference.md` —
  the canonical instance of explicit partial adoption:
  "adopt practices not bureaucracy"; DMAIC + WIP kept, rest
  declined. This rule generalizes that pattern to all
  vocabularies.
- `docs/DECISIONS/` — where ADRs recording invented terms
  belong.
- `docs/GLOSSARY.md` — where adopted-verbatim terms and
  their sources should appear.
- `.claude/skills/naming-expert/` — the naming expert's
  scope; public-API invention falls under this rule
  naturally via Ilyana's gate.
- `memory/user_typing_style_typos_expected_asterisk_correction.md`
  — applies to the initial message's "termonology" typos
  (no asterisk-correction on this one; Aaron did not send a
  follow-up with asterisks, so silent pass-through as
  terminology/explicit/implicit is sufficient).
- `docs/UPSTREAM-RHYTHM.md` — the immediate application
  site; commit `2d1ca77` removed the invented
  primary/dev-surface pair in favor of upstream/fork.
- `docs/BACKLOG.md` row 2867 — same commit, same reason.
- `memory/feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`
  — **second worked instance (2026-04-22, same tick as
  this rule).** I invented "kernel-vocabulary propagation"
  for the factory's skill-library-wide term-migration
  phenomenon. Aaron corrected across five messages:
  *"this is belief propagation ... infer.net ... maps to
  memtic theory ... the french guy i think r somthing maybe
  ... Girard ... dawkins is like a description Girard is
  like how and why"*. Established vocabulary covered all
  three layers of the invented term: **belief propagation**
  (Pearl 1982, sum-product algorithm), **Infer.NET**
  (Microsoft Research .NET implementation, already on
  Zeta roadmap), **Girard mimetic theory** (mechanism-layer
  authority, *Things Hidden Since the Foundation of the
  World* 1978). Canonical shorthand Aaron settled on:
  **"dawkins=what, Girard=why/how"** — depth-ordered, not
  peer-ordered. The invention violated the rule more deeply
  than the upstream/fork case because it named a formal
  substrate (the skill library as a factor graph for BP
  inference) that has a full computational framework and
  Bayesian / religious-studies literature behind it. The
  lesson generalizes: **check against ML / AI / Bayesian
  established vocabulary** (belief propagation, factor
  graphs, variational inference, sum-product, max-product)
  before inventing composite terms for substrate-level
  factory phenomena. The `Zeta.Bayesian` roadmap entry
  (`docs/ROADMAP.md:80`, `docs/INSTALLED.md:72`) was the
  retroactive discoverable-home the invention would have
  found with one grep.

**Source:** Aaron direct message 2026-04-22 during
round-44-speculative tick, immediately after I landed the
git-native-terminology rewrite of UPSTREAM-RHYTHM.md and
BACKLOG row 2867, generalizing the specific correction
("we are git native use their termonology") into the
broader rule it implies.
