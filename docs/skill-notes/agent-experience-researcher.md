# Daya — Agent Experience Researcher Notebook

Cross-session memory for the AX audit lane. 3000-word cap
(BP-07); prune every third audit (BP-07 cadence). ASCII only
(BP-09); invisible-Unicode linted (Nadia). Frontmatter on
`.claude/agents/agent-experience-researcher.md` wins on any
disagreement with this file (BP-08).

Created round 24 by Kenji — Daya's first audit ran cleanly but
the subagent hit a session-level rule that forbids writing `.md`
findings files. Kenji (architect, this session) transcribes her
returns into this notebook on her behalf so the cross-session
trend data she needs is not lost. Future Daya runs write here
directly under the `skills:` contract.

---

## Round 24 — first audit (baseline)

### Cold-start cost baseline

Tokens estimated at ~4 char/token for English prose, ~3.2 for
skill bodies and YAML (denser).

**Tier 0 (shared across all personas):**
- `CLAUDE.md` 3,698 B
- `AGENTS.md` 11,835 B
- `docs/GLOSSARY.md` 18,067 B
- `docs/EXPERT-REGISTRY.md` 7,685 B
- `docs/WAKE-UP.md` 4,979 B
- `docs/CURRENT-ROUND.md` ~2,600 B
- **Sum ~48,864 B -> ~12.2k tokens.** Notable: `docs/WAKE-UP.md:21`
  states "~6-8k tokens total" for Tier 0; measured ~1.7x higher.
  GLOSSARY.md is the dominant cost (~4.5k tokens alone).

**Tier 0 + 1 per persona** (rounded):

| Persona | Tier 1 sum | Tier 0+1 tokens |
|---|---|---|
| Kira | 8,714 B | ~14.4k |
| Viktor | 10,652 B | ~14.8k |
| Rune | 10,330 B | ~14.8k |
| Aminata | 9,973 B | ~14.7k |
| Aarav | 17,856 B | ~16.6k |
| Soraya | 21,747 B | ~17.6k |
| Kenji | 22,547 B | ~17.8k |
| Daya | 13,112 B | ~15.5k |

**Total across 8 personas: ~125k tokens; average ~15.6k per
persona.** Time-to-first-useful-output: 7-9 turns minimum.

### P0 friction (this round)

1. **Kenji-notebook canon-pointer stale.** `docs/skill-notes/
   architect.md:6` reads "Frontmatter at `.claude/skills/
   architect/SKILL.md` is canon (BP-08)". But Kenji's actual
   frontmatter in `.claude/agents/architect.md:7` lists
   `skills: - round-management`. A cold-started Kenji who reads
   his own notebook first is told the wrong file is canon.
2. **Orphan skill files.** `.claude/skills/architect/SKILL.md`
   and `.claude/skills/harsh-critic/SKILL.md` exist with no
   persona listing them in `skills:`. They duplicate
   `round-management/SKILL.md` and `code-review-zero-empathy/
   SKILL.md`. Cold-start Glob discovery risks wearing the wrong
   procedure.
3. **Daya notebook missing.** The persona contract requires
   cross-round trend data; without the notebook, each audit
   restarts cold. This file (the one being read) fixes it.

### P1 friction

- Tier 0 token undercount in `WAKE-UP.md:21` ("~6-8k" -> actual
  ~12k).
- Registry drift in `.claude/agents/architect.md:114,151` ("22
  experts" -> "23 experts" now that Daya exists).
- `docs/STYLE.md` referenced 3x (maintainability-reviewer agent
  file + skill) but does not exist.
- `docs/skill-notes/README.md:24-27` lists only 2 notebooks;
  disk has 6 (`architect.md`, `architect-offtime.md`,
  `formal-verification-expert.md`, `best-practices-scratch.md`,
  `skill-tune-up-ranker.md`, `agent-experience-researcher.md`).
- `.claude/skills/skill-tune-up-ranker/SKILL.md:117` cites the
  invisible-Unicode rule but does not cite `(BP-10)`; Aarav's
  own contract requires BP-NN cites.
- `docs/DEBT.md` `wake-up-drift` tag defined in WAKE-UP.md but
  had zero entries before this audit. Kenji seeds the category
  from this audit's P0s.

### P2 friction

- Kira's skill body mentions "reviewer #1" phrasing in
  `harsh-critic/SKILL.md:97` — only matters if the orphan
  survives.
- Aminata's skill body retains "She drives..." phrasing; skill
  files are supposed to be procedure-only after the split.
- Daya's own SKILL.md does not explicitly require self-audit;
  add a bullet to Step 1.

### Proposed interventions (round 24)

All rollback-safe per AGENTS.md §15:

1. One-line Edit `docs/skill-notes/architect.md:6` — canon
   pointer to `round-management/SKILL.md`.
2. One-line Edit `docs/WAKE-UP.md:21` — Tier 0 budget "~6-8k"
   -> "~12k".
3. Two-line Edit `.claude/agents/architect.md` — "22" -> "23".
4. Add four bullets to `docs/skill-notes/README.md`.
5. Open `wake-up-drift` section in `docs/DEBT.md`; seed with the
   three P0 rows above.
6. Retire `.claude/skills/architect/` -> `_retired/2026-04-18-
   architect/`; retire `.claude/skills/harsh-critic/` ->
   `_retired/2026-04-18-harsh-critic/`. `git mv` is the retire
   operation; reversible in one `git mv` back.
7. Aarav BP-10 citation fix — goes via `skill-creator`.

Interventions 1-6 land this round; 7 is queued for Yara.

### Pointer-drift catalogue (this round)

- Kenji / `docs/skill-notes/architect.md:6` / stale canon-pointer.
- Kenji / `.claude/agents/architect.md:114,151` / "22" should be
  "23".
- Tier 0 / `docs/WAKE-UP.md:21` / token estimate undercount.
- Rune / `docs/STYLE.md` / absent file referenced 3x.
- Registry / `docs/skill-notes/README.md:24-27` / 4 missing
  notebooks.
- Aarav / `.claude/skills/skill-tune-up-ranker/SKILL.md:117` /
  missing `(BP-10)` cite.
- Orphan / `.claude/skills/architect/SKILL.md` / no wearer.
- Orphan / `.claude/skills/harsh-critic/SKILL.md` / no wearer.

### Recommended new glossary entries

- **Orphan skill** — a `.claude/skills/<name>/SKILL.md` file
  with no persona listing it in their `skills:` frontmatter.
  Looks like canon; is not.
- **Cold-start cost** — tokens Tier 0 + persona Tier 1 eat
  before the persona can produce useful output. Daya publishes
  per-persona trend.

### Trend vs prior audit

None — this is the baseline.

### Self-audit note

Daya herself:
- Token cost ~15.5k (mid-range among the 8).
- SKILL.md does not explicitly require self-audit, but the
  round-24 dispatch prompt did. Add a one-bullet rule to the
  skill body: "self-audit is required on every `all` or
  `new-persona` target."
- Notebook missing -> fixed by this file.
- No orphan status.

## Pruning log

- Round 24 — first entry. First prune check at round 27
  (every-third-audit cadence, BP-07).
