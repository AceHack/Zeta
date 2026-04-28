# Trajectory — Skill Ecosystem

## Scope

Every skill under `.claude/skills/*/SKILL.md` (~250+ skills) and
every persona agent under `.claude/agents/*.md`. Open-ended because
new skills get authored when patterns emerge, existing skills go
stale when the underlying domain shifts, gaps appear when work
classes lack coverage. Bar: skills are current; gaps are flagged;
skill bloat doesn't accumulate.

## Cadence

- **Per-skill**: edits via `skill-creator` workflow only (no ad-hoc
  edits per GOVERNANCE.md §4); mechanical injection-lint fixes
  + renames are the only carve-outs.
- **Per-5-10-rounds**: `skill-tune-up` ranks top-N skills by
  tune-up urgency (drift / staleness / contradiction / bloat /
  user-pain / best-practice-drift / portability-drift).
- **Per-gap-finder-invocation**: `skill-gap-finder` scouts for
  patterns that should be skills but aren't.
- **Per-domain-shift**: when industry or repo state shifts,
  affected skills get a refresh pass.

## Current state (2026-04-28)

- ~250+ skills under `.claude/skills/`
- Persona agents at `.claude/agents/` (Otto, Soraya, Amara, Ani, Iris, Bodhi, Daya, Kenji, Samir, Rune, Naledi, Hiroshi, Imani, Aminata, Mateo, Nazar, Nadia, Kira, Viktor, Rashida, Aarav, Ilyana, Kai, Yara, Dejan, Rodney, etc.)
- `skill-tune-up` (Aarav) ranks tune-up urgency; cites BP-NN rule IDs
- `skill-gap-finder` scouts for absent skills
- `skill-creator` is the canonical authoring workflow
- `skill-improver` (Yara) acts on Aarav's BP-NN findings checkbox-style
- `prompt-protector` lints injection / invisible-Unicode (BP-10)
- Capability skills ("hats") encode HOW; persona agents encode WHO

## Target state

- Every active skill cites stable BP-NN rules where applicable.
- No skill is over the bloat threshold (~300 lines body, 3000
  words notebook).
- Drift between skills and current repo state is caught per
  `skill-tune-up` cadence.
- New skills land via `skill-creator` (no ad-hoc).
- Retired skills are recoverable via git history (per the
  honor-those-that-came-before rule — memory folders preserve;
  SKILL.md retires by deletion).

## What's left

In leverage order:

1. **`skill-tune-up` ranking refresh** — last cadenced run
   uncertain; needs activation.
2. **Skill BP-NN citation audit** — every skill should cite the
   stable rules it depends on; coverage is partial.
3. **Persona agent file freshness audit** — `.claude/agents/*.md`
   files may have stale provenance (e.g. "naming-expert review
   pending" notes that have since landed).
4. **Skill ↔ trajectory cross-reference** — every trajectory
   names skills in its Pointers; the reverse (skill → trajectory)
   isn't yet a documented invariant.
5. **`skill-gap-finder` invocation cadence** — gap-finding work
   benefits from cadence; not yet on one.
6. **Retired-skill-list audit** — git history shows retirements
   but no curated retirement-log; might be worth a thin doc.

## Recent activity + forecast

- 2026-04-28: trajectory pattern landed (this PR family) —
  static-analysis / formal-analysis / openspec-specs / docs +
  this skill-ecosystem trajectory.
- 2026-04-27: agency-signature commit-attribution work
  (`commit-message-shape` skill + AgencySignature trailers).
- 2026-04-26: counterweight-audit skill defined (Otto-278);
  cadence activation pending.
- 2026-04-26: live-lock taxonomy split (Otto-352); affects
  `skill-tune-up` mental model.

**Forecast (next 1-3 months):**

- `skill-tune-up` cadence reactivation candidate.
- New trajectory-related skill: maybe `trajectory-curator` if
  the pattern accumulates ownership.
- Wallet-experiment + EAT may produce new skill candidates
  (economic-agency, blast-radius-budgeting).
- Aurora round-3 may surface consent-layer skills.

## Pointers

- Skill: `.claude/skills/skill-creator/SKILL.md`
- Skill: `.claude/skills/skill-tune-up/SKILL.md` (Aarav)
- Skill: `.claude/skills/skill-gap-finder/SKILL.md`
- Skill: `.claude/skills/skill-improver/SKILL.md` (Yara)
- Skill: `.claude/skills/skill-documentation-standard/SKILL.md`
- Skill: `.claude/skills/skill-ontology-auditor/SKILL.md`
- Skill: `.claude/skills/teaching-skill-pattern/SKILL.md`
- Skill: `.claude/skills/prompt-protector/SKILL.md` (Nadia)
- Doc: `docs/EXPERT-REGISTRY.md`
- Doc: `docs/CONFLICT-RESOLUTION.md`
- Rules: `docs/AGENT-BEST-PRACTICES.md` (BP-NN)
- BACKLOG: task #267 (evangelize /btw to other harnesses)
