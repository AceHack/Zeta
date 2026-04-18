# Skill Notebooks

Per-agent notebooks for skills that need cross-session memory.

One file per skill, named `<skill-slug>.md`. Only the owning
skill writes to its own file. Every change is visible in git.

## Invariants

- **ASCII only.** No invisible-Unicode steganography (zero-width
  space, bidi overrides, etc.); the Prompt Protector lints for
  these periodically.
- **Pruning is the skill's responsibility.** If the file grows
  past a stated limit (typically 3000 words), the skill prunes
  before appending new entries.
- **Growing notebook drift risk accepted.** The longer a notebook,
  the more it acts as an effective system prompt for the skill.
  This is a conscious trust grant — see individual skill's
  SKILL.md for the discussion.
- **Human can wipe any notebook** at any time. The skill's
  frontmatter SKILL.md is the authoritative source; the
  notebook is supplementary memory, not canon.

## Current notebooks

- `architect.md` — the Architect's running notes
- `skill-tune-up-ranker.md` — his ranking notebook
