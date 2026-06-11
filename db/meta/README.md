# meta/ — meta-rules (rules about rules), at root

`meta/` holds the **meta-rules** — rules whose *subject is the rule-system itself*. A plain rule
governs the substrate; a **meta-rule** governs **how rules work** (what may become a rule, how a
privilege is earned *under* `rules/`, how the rule-system refers to itself). Self-referential by nature
(shape **A**: `s = f(s)` — a rule about rules).

## The first meta-rule (Aaron 2026-06-10)

> Aaron: "'a class must be earned under `rules/`' is a rule — create a meta folder, this is a
> **meta rule**."

**"Interfaces are free; a class must be earned under `rules/`"** is a meta-rule: its subject is the
**`rules/` system itself** — it says a privilege (a concrete class) is granted **by earning it under
`rules/`**. That makes it a rule *about how rules confer privilege*, not a rule about the substrate —
hence `meta/`, not just `rules/`. (The carved rule lives at
`.claude/rules/interfaces-free-classes-earned-under-rules.md`; `meta/` is where we recognize it as
**meta** and collect its kin.)

## What counts as a meta-rule

- Governs the **rule-system**, not the domain (earning, gating, promotion of a privilege under `rules/`).
- **Self-referential** — refers to rules / earning / `rules/` itself (shape A).
- Sets the **terms by which other rules grant or withhold** (free-by-default vs earned-privilege).

Examples to collect here: interfaces-free/classes-earned (the first); the no-directives "only directive
is there are no directives" (a rule about rules — already self-referential); "thoughts free, actions
razored" (governs what may become a carved rule); the rules-are-small-carved-sentences discipline
(a rule about rule *form*).

## Honest scope

[Beacon] meta-rules / reflective rules (Hofstadter's strange loops; Gödel self-reference; constitutional
"rules for changing the rules" — amendment clauses). **Peel:** `meta/` is the *recognition + index* of
meta-rules; the carved rules themselves stay in `.claude/rules/` (the startup-loaded surface). `meta/`
names which of them are meta and why.

## Pointers

- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — the first meta-rule.
- `.claude/rules/no-directives.md` · `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
  — kin (rules about rules / rule-form).
- [`rules` (the gate)](../bounds/) ⟂ `meta/` (rules about that gate) · shape A (self-reference).
