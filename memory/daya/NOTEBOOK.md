# Daya — Agent Experience Engineer Notebook

Cross-session memory for the AX audit lane. 3000-word cap
(BP-07); prune every third audit (BP-07 cadence). ASCII only
(BP-09); invisible-Unicode linted (Nadia). Frontmatter on
`.claude/agents/agent-experience-engineer.md` wins on any
disagreement with this file (BP-08).

Historical audit detail (rounds 24, 26, 27, 34) migrated to
`memory/daya/JOURNAL.md` on round 44 prune. This
notebook keeps only the current round + carry-over + trend
summary. Cold-start budget lives here; pattern-recognition
material lives in JOURNAL (Tier 3, grep-only, append-only,
newest-first).

Created round 24 by Kenji — Daya's first audit ran cleanly but
the subagent hit a session-level rule that forbids writing `.md`
findings files. Future Daya runs write here directly under the
`skills:` contract.

---
## Round 44 — pointer-integrity audit on `docs/FACTORY-HYGIENE.md` — 2026-04-20

First exercise of row #25 (pointer-integrity audit) on the file
that defines it. Dogfood pass; meta-win candidate.

**Scope.** Every pointer in `docs/FACTORY-HYGIENE.md`:

- 20 in-repo file paths (source-of-truth column + body text)
- 14 memory-file paths (`~/.claude/projects/.../memory/`)
- 1 directory (`docs/DECISIONS/`)
- 3 `GOVERNANCE.md §N` section references (§2, §23, §31)
- 2 BP-NN rule references (BP-10, BP-11)

**Result.** 35/35 paths resolve; 3/3 §-sections exist at
claimed numbers; 2/2 BP-NN rules land at
`docs/AGENT-BEST-PRACTICES.md`. One stale annotation fixed
in-flight: row #22's source-of-truth field had `(draft)` tagged
on the memory filename, but the memory is fully landed (not a
draft). The row itself is still a proposal (already communicated
by "(proposed)" in Cadence + "TBD" in Owner), so the "(draft)"
annotation was redundant and misleading about the memory-file
state. Removed.

**Meta-finding.** Row #25 works as designed on its first
dogfood: real pointer issue (the stale "(draft)") surfaced and
was correctable in under 30 seconds of edit. Cost is negligible;
value is a catch. Row honestly earns its place.

**Self-finding on notebook size (resolved this round).** The
notebook exceeded the BP-07 3000-word cap by ~66% at 4984 words
(10 rounds overdue on the every-third-audit prune cadence
triggered by round 27's pruning log). Round 44 executed the
full-migration prune: rounds 24, 26, 27, and 34 detail copied
verbatim to `memory/daya/JOURNAL.md` (Tier 3,
grep-only) and removed from this notebook. Post-prune target:
under 3000 words. Future prunes follow the same migrate-then-
remove pattern; JOURNAL grows unbounded by design, NOTEBOOK
stays capped.

---

## Cold-start trend summary

Kept as a compressed time series so the next Daya wake sees the
trajectory without cold-loading the full entries (they live in
JOURNAL).

**Total cold-start (Tier 0 + Tier 1) per persona, by audit:**

| Persona | r24 baseline | r34 sample | Trend |
|---|---|---|---|
| Kira | ~14.4k | not sampled | baseline |
| Viktor | ~14.8k | not sampled | baseline |
| Rune | ~14.8k | not sampled | baseline |
| Aminata | ~14.7k | not sampled | baseline |
| Aarav | ~16.6k | not sampled | baseline |
| Soraya | ~17.6k | not sampled | baseline |
| Kenji | ~17.8k | ~17.9k (r26) | flat within noise |
| Daya | ~15.5k | not sampled | baseline |
| Dejan | -- | ~16.5k (r34) | new-persona |
| Bodhi | -- | ~19.3k (r34) | new-persona, heaviest |
| Iris | -- | ~18.0k (r34) | new-persona |

**Dominant Tier 0 line-items (all personas pay):**

- `docs/GLOSSARY.md` — ~4.5k tokens. Largest single item since
  round 24. Not persona-specific.
- `AGENTS.md` — ~3.1k tokens (19 rules as of round 26).
  Candidate for §0 TL;DR so cold-starters orient without
  reading all rules.

**Time-to-first-useful-output:** 7-9 turns minimum across
personas. Has not measurably improved or regressed across the
four audits. If the factory wants this down, it needs a Tier 0
cut (most likely a GLOSSARY split) — no Tier 1 edit pays back.

---

## Outstanding interventions (carry-over into round 45)

These were proposed across rounds 24, 26, 27, 34 and have not
been confirmed landed. Daya does not land them (scope); Kenji
integrates via the right owner (usually Yara via
`skill-creator`).

- `docs/PLUGIN-AUTHOR.md` (round 27 finding) — all three
  candidate plugin shapes (A/B/C) leak attention into
  CONTRIBUTING.md and ARCHITECTURE.md because no file
  acknowledges the external-plugin-author population. Gap is
  real regardless of which shape Ilyana picks. Minimum
  contents captured in JOURNAL round 27. **Owner:** Samir
  with Ilyana-input. **Effort:** M.
- `docs/GLOSSARY.md` split (round 24-onwards pattern) —
  biggest single Tier 0 cost; not persona-specific. Recent
  factory/system-under-test split decision (Aaron 2026-04-20
  feedback memory) already green-lights this. **Owner:** Samir.
  **Effort:** M.
- **Persona + skill content overlap (round 26 systemic
  finding).** Agent files and sibling skill bodies overlap
  ~20-35% on cadence/authority/coordination prose. Every cold-
  start pays it twice. Not urgent; proper measurement needs a
  whole-roster audit (round 29+ cadence). Proposed BP-NN
  wording recorded in JOURNAL round 26. **Owner:** Aarav
  scratchpad -> Kenji promotion decision.
- **Plugin shape decision (round 27).** AX verdict: Shape C
  (`PluginOp<'TIn, 'TOut>`) wins conditional on
  BayesianAggregate.fs migrating to inherit it so the canary
  and the reference are the same file. Fallback: Shape B on
  cold-start but it loses on stateful-operator case (the
  Bayesian use case). **Owner:** Ilyana + Kenji integration.
- **Bodhi NOTEBOOK same-value pointer catalogue (round 34
  finding).** `memory/bodhi/NOTEBOOK.md:75-86` lists
  drift arrows like `src/Core/` -> `src/Core/` (both sides
  identical after markdown-escape collapse); next cold-reader
  cannot recover what drifted. Canonical before/after
  preserved in `memory/bodhi/JOURNAL.md:83-89`.
  **Owner:** Bodhi next prune.
- **GLOSSARY "AX researcher (Daya)" drift (round 34 finding).**
  `docs/GLOSSARY.md:430, 514` use pre-sweep title; the title
  is now "engineer" everywhere else. Prose-voice; defer to
  Samir.

## Interventions that landed (or subsumed by later work)

Logged so the next Daya cold-start can skip them on the
pointer-drift catalogue.

- Round 24 P0 #1 (Kenji notebook canon-pointer `kenji.md:6`) —
  landed same round.
- Round 24 P0 #2 (orphan skill directories
  `.claude/skills/architect/`, `.claude/skills/harsh-critic/`) —
  landed; retired to `_retired/2026-04-18-*`.
- Round 24 P0 #3 (Daya NOTEBOOK missing) — landed; this file.
- Round 24 P1 (Tier 0 token undercount in `WAKE-UP.md:21`) —
  landed.
- Round 24 P1 (`architect.md:114,151` "22" -> "23") — landed.
- Round 26 P1 #1 (`architect.md:146` "22" -> "25") — landed
  as part of round-26 carry-over sweep.
- Round 26 P1 #2 (four-file dead-path sweep to retired
  `.claude/skills/architect/SKILL.md`) — landed via Yara.
- Round 34 P1 (Bodhi SKILL.md:47 `researcher` -> `engineer`) —
  landed.
- Round 34 P1 (Iris SKILL.md:183 `researcher` -> `engineer`) —
  landed.
- Round 34 P1 (Bodhi agent.md:90-91 "persona TBD" -> Iris) —
  landed.

## Pointer-drift recurrence watch

Track classes of drift that keep recurring so Daya can flag them
pre-emptively on the next mass-rename.

- **Renames miss self-references inside the renamed skill's own
  body.** Round-34 `researcher -> engineer` 27-file sweep
  caught 27 files but missed 3 self-references inside
  Bodhi/Iris skill bodies. Same shape could recur on any
  future role-class rename. Proposed checklist item:
  "rename sweep must include skill-body self-reference grep
  of the old-name tokens" — seeded to `docs/DEBT.md`
  `wake-up-drift` row in round 34.
- **Glossary prose-voice lags mechanical sweeps.** GLOSSARY
  entries that reference a renamed surface in prose (not code)
  are not caught by path-grep sweeps. Round 34 found 2
  examples (`AX researcher (Daya)` at lines 430, 514). Samir
  to absorb the class, not individual cases.
- **Stale-pointer in self-referential skill blocks.** Round 34
  turned up Bodhi/Iris skills with their own pre-sweep names
  in out-of-scope / cross-reference blocks. Stronger signal
  than cross-skill pointer drift because the file had to be
  edited for the sweep anyway.

---

## Pruning log

- Round 24 — first entry. First prune check at round 27
  (every-third-audit cadence, BP-07).
- Round 26 — second substantive entry. Next prune check:
  round 27.
- Round 27 — third entry. Prune due at round 27 close.
  **Deferred** (factory priorities).
- Round 34 — flagged self-overdue; 4069 words vs 3000 cap,
  ~36% over. Migration proposed, not executed.
- Round 44 — full migration executed. Rounds 24, 26, 27, 34
  detail copied verbatim to JOURNAL; NOTEBOOK trimmed to
  preamble + round 44 + trend summary + outstanding
  interventions + pruning log + recurrence watch.
  Post-prune target: under 3000 words. Next prune trigger:
  round 47 (every-third-audit from this baseline).
