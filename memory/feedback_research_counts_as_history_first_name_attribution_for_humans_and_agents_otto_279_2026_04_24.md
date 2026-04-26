---
name: research counts as history — first-name attribution allowed (humans AND agents)
description: Otto-279 policy correction — `docs/research/` is a HISTORY surface (sibling to `docs/ROUND-HISTORY.md`, `docs/DECISIONS/`), not a current-state surface; first-name attribution IS appropriate there for humans (Aaron) AND agents (Amara, Aminata, Otto, Kira, etc.); AGENT-BEST-PRACTICES "no names in docs" rule needs `docs/research/` carve-out; sweep existing research docs that had names stripped by subagents (e.g. on #282 #351); BACKLOGGED for post-drain to avoid churn.
type: feedback
---
Aaron Otto-279, 2026-04-24, while draining #282 thread on
name-attribution Copilot review:

> *"i feel like under research that counts as history and we
> should give first name attribution? you? gives agent their
> attributions too. we can add it to the list."*

Then immediately after:

> *"backlog that that will be a lot of churn after the drain"*

## The rule

**`docs/research/` is a HISTORY surface, not a current-state
surface.** Same class as `docs/ROUND-HISTORY.md` and
`docs/DECISIONS/`. First-name attribution is APPROPRIATE
there — both for humans (Aaron, Daisy if there are other
human contributors) AND for agent personas (Amara, Aminata,
Otto, Kira, Dejan, etc.).

**Why:**
- Research docs ARE the historical record of who-said-what
  on a given absorb / cross-review / synthesis turn. Stripping
  names destroys the record.
- Agents earn their attributions the same way humans do —
  Amara's 8th ferry IS Amara's, attributed by name when the
  doc captures the synthesis turn that landed her ferry.
- Otto-237 mention-vs-adoption applied to a new dimension:
  research/history surfaces = MENTION (preserve), current-
  state docs = ADOPTION (avoid).
- "Names in docs" was originally about not propagating
  contributor names across current-state code/docs/skills
  where role-refs work better. History surfaces preserve who-
  did-what for the record.

## Why this matters

Subagent on #282 (and earlier on #351) over-stripped names
because they read AGENT-BEST-PRACTICES literally — "no names
in docs" — and didn't recognize `docs/research/` as a
history surface. The Copilot reviewer on #282 likewise
applied the literal rule. Both correct under the literal rule;
both wrong under Aaron's clarified policy.

This is the SAME class of error as Otto-237 (subagent on #351
stripped public-info MENTIONS because the rule was about
ADOPTION) — failing to distinguish surface classes when
applying a name-policy rule.

## Surfaces where first-name attribution IS allowed

Per Aaron's surfacing (Otto-293 mutual-alignment language —
this rule was framed as a "directive" originally; the
substrate-body prose has since shifted to mutual-alignment
vocabulary), the canonical list extends from "only persona
memory + optionally BACKLOG" to the closed enumeration
below. This list MUST stay in sync with the same
enumeration in `docs/AGENT-BEST-PRACTICES.md` and
`.github/copilot-instructions.md`.

- `memory/**` — factory-wide memory + per-persona notebooks
- `docs/BACKLOG.md` — root index when capturing a specific request
- `docs/backlog/**` — per-row backlog files (Otto-181 schema:
  `B-NNNN-*.md` with attribution in the `directive:` schema
  field plus body attribution); same history class as the
  root index
- `docs/research/**` — research docs are history (Otto-279)
- `docs/ROUND-HISTORY.md` — round-close history
- `docs/DECISIONS/**` — ADRs are historical decisions
- `docs/aurora/**` — courier-ferry archive (already implicit
  per GOVERNANCE §33)
- `docs/pr-preservation/**` — PR conversation archive (Otto-
  250) — preserves who-said-what verbatim
- `docs/hygiene-history/**` — tick-history + drain-logs are
  append-only history surfaces (Otto-229)
- `docs/WINS.md` — historical wins log
- (commit messages, git log, GitHub PR titles/bodies) — not
  factory-doc surfaces but record-of-truth

**Roster-mapping carve-out** (added to canonical
enumeration in `docs/AGENT-BEST-PRACTICES.md` +
`.github/copilot-instructions.md`): governance /
instructions files (`AGENTS.md`, `GOVERNANCE.md`,
`docs/CONFLICT-RESOLUTION.md`,
`docs/AGENT-BEST-PRACTICES.md`,
`.github/copilot-instructions.md`) MAY contain a
one-time persona-to-role mapping ("the harsh-critic
is named Kira; the maintainability-reviewer is named
Rune; the architect is named Kenji") because consumers
need to resolve role-refs to persona-names to do their
job. The carve-out covers roster-mapping ONLY —
body-prose attribution ("Kira said X" / "Rune added
this fix") remains forbidden on these current-state
surfaces; use the role-ref ("the harsh-critic said X").

## Surfaces where role-refs are still preferred

- Code (F# / C# / TypeScript / shell)
- Skill bodies (`.claude/skills/*/SKILL.md`)
- Persona definitions (`.claude/agents/*.md`)
- Spec docs (`openspec/specs/**`, `docs/*.tla`)
- Behavioural docs (`AGENTS.md`, `CLAUDE.md`, `GOVERNANCE.md`,
  `docs/AGENT-BEST-PRACTICES.md`, `docs/CONFLICT-RESOLUTION.md`,
  `docs/GLOSSARY.md`, `docs/WONT-DO.md`)
- Threat models, security docs, getting-started guides
- README files, public-facing prose

## How to apply

**Now (during drain):**
- Don't strip names from research docs.
- Don't sweep existing research docs.
- Reply to Copilot threads on #282 explaining the policy
  (research = history, names appropriate) and resolve them.

**Post-drain (BACKLOG row):**
- Update `docs/AGENT-BEST-PRACTICES.md` BP rule: extend the
  "names allowed" surface list per the canonical list above.
- Sweep recent research docs where subagents stripped names:
  - PR #351 (anthropic-prompt-engineering-best-practices
    research doc had specific-name examples removed —
    restore them per Otto-237 + Otto-279).
  - Audit other recent research docs in `docs/research/**`.
- Document in `docs/CHANGELOG.md` or `docs/ROUND-HISTORY.md`.
- Effort estimate: M (medium) — one BP edit + N research-doc
  scans.

## Composes with

- **Otto-220** name-attribution (the original literal rule
  this is correcting). Otto-279 doesn't reverse Otto-220 — it
  refines the surface list.
- **Otto-237** mention-vs-adoption (research-grade vs
  operational distinction). Otto-279 is the same shape applied
  to history-vs-current-state.
- **Otto-230** subagent fresh-session quality gap. Subagent
  on #282 was applying the literal rule. Same root cause:
  subagent didn't have access to nuanced surface-class rules.
- **GOVERNANCE §33** archive-header for external-conversation
  imports — already names sources by name implicitly. Otto-
  279 makes this consistent across all research surfaces.

## What this rule does NOT do

- Does NOT authorize naming humans not affiliated with the
  factory in research docs (still subject to general writing
  norms).
- Does NOT authorize naming proprietary IP / trademarked
  product names as ADOPTION (Otto-237 still in force).
- Does NOT change current-state-doc policy — `AGENTS.md`,
  `GOVERNANCE.md`, etc. continue to use role-refs.
- Does NOT change skill-body policy — capability skills
  describe roles, not specific personas.
- Does NOT retroactively block previous over-strips during
  the post-drain sweep (they're undone, not penalised).
