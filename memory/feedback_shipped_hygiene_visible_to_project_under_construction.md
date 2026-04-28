---
name: Shipped-hygiene enumeration — the factory ships hygiene checks that run on the PROJECT under construction; list them separately from factory-internal hygiene so adopters see what they inherit
description: 2026-04-20 — Aaron: "the factory will ship with hygene checks that will run for the project under construction too, can we list somewhere what hygene checks ship for the system under construction with the factory too". Two scopes of hygiene. (a) Factory-internal — runs to keep the factory itself healthy (skill-tune-up, Aarav notebook prune, BP-NN promotion, ontology-home, MEMORY.md cap, etc.). (b) Shipped-with-factory — runs on the project the factory is helping build (build-gate, test-gate, ASCII-clean, secret-scan, public-API review, verification-drift, upstream-sync, etc.). Adopters need to see (b) to know what they're signing up for.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

Every hygiene item in `docs/FACTORY-HYGIENE.md` declares
its **scope** in a dedicated column:

- **`project`** — ships with the factory and runs on the
  project under construction (the adopter's codebase).
  When a new project adopts the factory, these items come
  along.
- **`factory`** — runs on the factory's own substrate
  (`.claude/skills/`, `memory/`, `docs/ROUND-HISTORY.md`,
  persona notebooks) to keep the factory healthy. Does
  not ship to the adopter.
- **`both`** — runs in both places with appropriate scope
  (e.g. ASCII-clean lint applies to factory artifacts AND
  to project source files; ontology-home applies to
  factory docs AND to project docs).

The hygiene list maintains a dedicated **"Ships to
project-under-construction" summary section** immediately
after the main table, listing only the `project` and
`both` items. This is the adopter-facing read: "here is
what adopting the Zeta factory gives your project, in
hygiene terms."

# Why:

Aaron's verbatim (2026-04-20):

> *"the factory will ship with hygene checks that will
> run for the project under construction too, can we
> list somewhere what hygene checks ship for the system
> under construction with the factory too"*

Two separate concerns that were previously mushed in
`docs/FACTORY-HYGIENE.md`:

- **Factory-internal hygiene** — e.g. skill-tune-up is
  something the factory runs on ITS OWN `.claude/skills/`
  directory; it does not fire against the adopter's
  project. The adopter never sees Aarav.
- **Shipped-with-factory hygiene** — e.g. the
  `TreatWarningsAsErrors` build-gate lives in
  `Directory.Build.props` and enforces itself on any
  project that inherits those props. Adopting the factory
  means adopting this gate.

The distinction matters for three reasons, each of which
is already a memory:

1. **Factory-reuse-as-constraint**
   (`project_factory_reuse_beyond_zeta_constraint.md`)
   — we want to split generic factory substrate from
   Zeta-specific content. Shipped-hygiene IS the generic
   substrate for the hygiene surface. Adopters pick up
   shipped-hygiene; factory-internal hygiene stays with
   the factory's maintainers.
2. **Scope-audit discipline**
   (`feedback_scope_audit_skill_gap_human_backlog_resolution.md`)
   — every rule should name its scope. Hygiene items
   are rules; a scope column is the minimal scope-tag.
3. **Adopter UX**
   (`project_factory_conversational_bootstrap_two_persona_ux.md`)
   — a prospective factory adopter needs to know what
   they're getting. "The factory runs X hygiene on your
   project" is a concrete, answerable question. A
   factory-only hygiene list answers the WRONG
   question from the adopter's perspective.

Specific examples that were previously ambiguous in
`docs/FACTORY-HYGIENE.md`:

- **Build-gate** (#1, `0 Warning(s)`) — `project` scope.
  Ships via `Directory.Build.props` to any project that
  inherits.
- **ASCII-clean** (#3) — `both`. Factory lints its own
  notebooks; project lints its own source files. Same
  rule, two places.
- **Skill-tune-up** (#5) — `factory` only. The adopter's
  project doesn't have a `.claude/skills/` by default;
  if it does, that's the adopter's factory-layer copy.
- **Public-API review** (#17) — `project` scope. This is
  about the project's shipped library API, not the
  factory's.
- **Verification-drift** (#16) — `project` scope. Lean /
  TLA+ / Z3 / FsCheck specs belong to the project
  (in Zeta's case, the DBSP operator algebra).
- **Upstream-sync** (#15) — `project` scope. `docs/UPSTREAM-LIST.md`
  tracks the project's upstream dependencies, not the
  factory's.

Without the scope column, an adopter reading
FACTORY-HYGIENE.md cannot answer "what do I inherit?"
without per-row reverse-engineering.

# How to apply:

- **Add a `Scope` column** to the main hygiene table in
  `docs/FACTORY-HYGIENE.md` between "Owner" and
  "Checks / enforces". Populate with one of:
  `project`, `factory`, `both`.
- **Add a dedicated section** after the main table
  titled "Ships to project-under-construction" that
  lists the `project` and `both` items only, with a
  one-line gloss of how each ships (e.g. "via
  `Directory.Build.props` inheritance", "via pre-commit
  hook template", "via copied workflow file").
- **New hygiene rows declare scope.** The "Rule for
  adding rows" section of FACTORY-HYGIENE.md grows a
  new clause: the row must declare a scope value or
  the edit is rejected.
- **Scope-drift sweep.** The symmetry-audit
  (row #22) includes a check that every row has a
  scope tag, because an untagged row is a
  scope-clarification gap per
  `feedback_scope_audit_skill_gap_human_backlog_resolution.md`.
- **Adopter-facing doc eventually.** When the factory
  is ready to be adopted by a second project, the
  "Ships to project-under-construction" section
  becomes the seed for an adopter-onboarding doc. Not
  this round; the section stays in FACTORY-HYGIENE.md
  for now to avoid doc proliferation.

# Relation to other artifacts

- **`AGENTS.md` build-and-test gate** — the shipped
  hygiene items (build-gate, test-gate) duplicate text
  already in AGENTS.md. That's fine: AGENTS.md is
  the agent-onboarding gate-statement; FACTORY-HYGIENE
  is the cadence-index. Both reference the same
  underlying mechanism.
- **`docs/UPSTREAM-LIST.md`** — upstream-sync row #15
  is `project` scope because it tracks this project's
  upstreams. The factory pattern is shipped (every
  adopter has its own upstream list); the content is
  project-specific.
- **`project_factory_reuse_beyond_zeta_constraint.md`**
  — the shipped/factory split here IS the hygiene-
  layer manifestation of the factory-reuse constraint.
  The scope column gives each hygiene item a
  portability answer.
- **`.github/copilot-instructions.md` audit** (#14)
  — `both` scope: factory maintains its own
  copilot-instructions, adopters do the same for
  theirs.

# What this rule does NOT do

- It does NOT make the factory-internal items
  invisible or demote them. They keep their row in
  the main table. The summary section is a
  *projection* of the main table, not a replacement.
- It does NOT require per-row documentation of HOW
  each item ships beyond a one-line gloss. Deep
  onboarding detail belongs in adopter documentation
  when that doc exists; this is the pointer.
- It does NOT block rows that honestly don't have a
  clean scope yet. A row can be tagged
  `unknown-pending-classification` with a note; that
  itself flags for review in the next symmetry-audit
  pass.
- It does NOT licence hygiene items to split into
  "shipped" and "internal" twins without reason. If
  scope is `both`, the single row covers both;
  splitting is additive cost with no clear win.

# Connection to the missing-hygiene-class gap-finder

These two asks are siblings:

- `feedback_missing_hygiene_class_gap_finder.md` —
  what hygiene CLASSES does the factory not yet run?
  (a question about completeness)
- This memory — of the hygiene we DO run, which ships
  to adopters and which stays internal? (a question
  about scope)

Both landed same round. The gap-finder can propose
shipped-hygiene gaps (e.g. "no secret scanner ships to
adopters though the factory has one") as a specific
class of finding.

# Open question

Whether the adopter-facing "Ships to project-under-
construction" section should eventually live in a
separate file `docs/ADOPTER-HYGIENE.md` or stay inline
in FACTORY-HYGIENE.md. Current choice: stay inline
until there's a second adopter, to avoid premature
doc proliferation. Revisit when adopter #2 appears.
