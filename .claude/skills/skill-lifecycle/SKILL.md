---
name: skill-lifecycle
description: Skill lifecycle — creating, improving, tuning, gap-finding, and auditing the skill library itself.
---

# skill lifecycle

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`skill-creator`](blueprints/skill-creator.md) — Skill creator — canonical create/tune workflow for all agent skills; draft, prompt-protector review, dry-run, commit.
- [`skill-improver`](blueprints/skill-improver.md) — Skill improvement driver — runs the skill-creator loop for requested skills, pairs with skill-tune-up rankings.
- [`skill-tune-up`](blueprints/skill-tune-up.md) — Skill tune-up ranking — BP-NN-cited urgency scores for existing skills, web-searched best practices, recommends only.
- [`skill-gap-finder`](blueprints/skill-gap-finder.md) — Skill gap finder — scans recurring patterns and tribal knowledge that should become a central skill.
- [`skill-ontology-auditor`](blueprints/skill-ontology-auditor.md) — Skill-library ontology hygiene — facets, orthogonality violations, theory/applied drift, hand-off contracts, naming.
- [`skill-documentation-standard`](blueprints/skill-documentation-standard.md) — SKILL.md documentation standard — frontmatter pattern, Data Vault breadcrumbs, body scaffold, BP-NN citations.
