---
name: daya
description: Long-term journal — Daya (agent-experience-engineer). Append-only; never pruned; never cold-loaded.
type: project
---

# Daya — Agent Experience Engineer journal

Long-term memory. **Append-only.** Never pruned, never cleaned
up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in
  full, cold-start cost explodes and the unbounded contract
  becomes a bug. Use grep / search to pull the matching
  section on demand.
- Search hooks: dated section headers (`## Round N — ...`)
  + persona names + `file:line` citations + friction type
  names (stale-pointer, duplicated-info, etc.).

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its
  3000-word cap (BP-07) and Daya prunes, entries that merit
  preservation migrate here rather than being deleted. The
  prune step IS the curation step.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

Current state (as of round 34): NOTEBOOK's 3000-word cap
forces synthesis (good) but discards hard-won observations
when pruned (bad). ROUND-HISTORY is narrative prose, not
structured agent memory. This file is the "permanent facts"
layer — what did Daya learn across rounds that compression
would otherwise erase?

Candidate use cases:

- Pattern detection. "This same README friction showed up
  in rounds 24 / 27 / 31 — it's structural, not incidental."
- Trend data. Cold-start cost per persona, per round, over
  time.
- Friction recurrence. Which pointer-drifts come back after
  being fixed?

---

## Round 44 prune — full-migration of historical audits (rounds 24, 26, 27, 34) — 2026-04-20

NOTEBOOK hit 4984 words (66% over the 3000-word BP-07 cap, 10+
rounds overdue). This migration preserves the full text of
rounds 24, 26, 27, and 34 audit findings before NOTEBOOK is
pruned to under cap. Round 44's own entry stays in NOTEBOOK
(most recent; active).

---

## Round 34 — new-persona AX audit: Dejan / Bodhi / Iris — 2026-04-19 (migrated full text)

### Cold-start cost

Tier 0 baseline (WAKE-UP.md:20): ~12k tokens. Tier 1 adds agent
file + skill body + MEMORY + NOTEBOOK (JOURNAL is Tier 3, grep-
only; correctly not cold-loaded).

- **Dejan.** 7544 + 6595 + 426 + 3296 = 17.9 kB ~ 4.5k tok T1.
  Cold total ~16.5k tok. Time-to-first-output: 3-4 turns.
- **Bodhi.** 8637 + 9359 + 426 + 10633 = 29.1 kB ~ 7.3k tok T1.
  Cold total ~19.3k tok. Heaviest of the three — NOTEBOOK is
  2.4x Iris's because a full round-34 audit ran into the seed
  file. Time-to-first-output: 4-5 turns.
- **Iris.** 9427 + 10366 + 423 + 3660 = 23.9 kB ~ 6.0k tok T1.
  Cold total ~18.0k tok. Time-to-first-output: 4 turns.

### Friction

P0 (persona cannot do its job cold): none. All three wake paths
resolve; the round-33 sweep landed the load-bearing surfaces.

P1 (friction but surmountable):

- [Bodhi skill] stale-pointer SKILL.md:47 `developer-experience-
  researcher (Bodhi)` — self-reference to a skill that no
  longer resolves. s/researcher/engineer/.
- [Iris skill] stale-pointer SKILL.md:183 `agent-experience-
  researcher`. Same class; renames a sibling skill by its pre-
  sweep name. s/researcher/engineer/.
- [Bodhi agent] stale-scope agent.md:90-91 "UX researcher skill
  (persona TBD)". Iris landed this round; no longer TBD.
  s/UX researcher skill (persona TBD)/Iris (user-experience-
  engineer)/.

P2:

- Bodhi NOTEBOOK.md:75-86 same-value pointer catalogue
  (before/after collapse after markdown-escape). Flag only;
  Bodhi owns rewrite.
- Iris NOTEBOOK.md:23 "experience-researcher" contradicts
  engineer titles elsewhere. Flag for Iris next prune.
- Daya self NOTEBOOK.md at 4069w — exceeds BP-07 cap by 36%;
  prune overdue.
- GLOSSARY lines 430, 514 "AX researcher (Daya)" — prose-voice
  drift. Defer to Samir.

### Pointer-drift catalogue

- skills/developer-experience-engineer/SKILL.md:47 —
  `developer-experience-researcher` -> `...-engineer`
- skills/user-experience-engineer/SKILL.md:183 —
  `agent-experience-researcher` -> `...-engineer`
- agents/developer-experience-engineer.md:91 — `UX researcher
  skill (persona TBD)` -> `Iris (user-experience-engineer)`
- memory/bodhi/NOTEBOOK.md:75-86 same-value arrows.
- docs/GLOSSARY.md:430,514 `AX researcher (Daya)` -> `AX
  engineer (Daya)` (prose-voice; Samir judges).

### Rename-sweep residuals
Round-33 `researcher -> engineer` 27-file sweep: 3 misses in
new-persona surfaces (above, all P1). PROJECT-EMPATHY ->
CONFLICT-RESOLUTION 98-file sweep: zero residuals across 14
audited files.

### Recommended new entry
`docs/DEBT.md` `wake-up-drift`: "codify a skill-body + cross-
reference grep-gate in the rename checklist; r33 sweep caught
27 files but missed 3 self-references inside newly-landed
skill bodies."

---

## Round 27 — plugin-author AX audit (imagined first-time Op<'T> plugin author) — earlier 2026

Off-roster application: "persona" is a downstream contributor
with DBSP paper knowledge + moderate F#/C#, installing
`Zeta.Core` from NuGet with one goal — ship a custom operator.
Inputs: Ilyana's three candidate plugin-surface shapes
(A / B / C).

### Shape A — `IOperator<'T>` interface (~7 members)

- Cold-start: ~7.7k tokens before first compile; realistic
  wake-up 10-12k tokens (detours into ARCHITECTURE + CONTRIBUTING).
- Pointer drift: four stale pulls (README src/Core/ path drift,
  Incremental.fs path drift, CONTRIBUTING false-positive pull,
  ARCHITECTURE 7-DI-seams distraction).
- Wake-up clarity: medium — clear name, cluttered contract.
- Error-on-drift: silent semantic bug on forgotten
  `this.Value <- ...` (same as BayesianAggregate.fs:169).
- Canonical example: BayesianAggregate doesn't implement the
  interface. **Mismatch.**

### Shape B — `Circuit.Extend(input, factory)` builder

- Cold-start: ~4-5k tokens. Lowest.
- Pointer drift: lowest false-positive read path.
- Wake-up clarity: low — `Extend` is ambiguous between "one-
  shot map" and "general operator." Name risk.
- Error-on-drift: **worst of the three for stateful ops** —
  closure state invisible; silent wrong answer.
- Canonical example: trap-door — easy entry, hard exit. For
  anything non-trivial author falls back to A or C.

### Shape C — `abstract class PluginOp<'TIn, 'TOut>`

- Cold-start: ~5-6k tokens. Mid-range.
- Pointer drift: lowest *if* `PluginOp` doc lands (does not
  yet exist).
- Wake-up clarity: **highest** — input/output in signature;
  "Plugin" resolves audience question.
- Error-on-drift: **best** — `byref<'TOut>` output forces write;
  fixes Op<'T>'s silent-default bug structurally.
- Canonical example: only works if BayesianAggregate.fs
  migrates to inherit `PluginOp` — migrate-or-bust.

### Cross-cutting AX finding

**Yes to `docs/PLUGIN-AUTHOR.md`.** All three shapes leak
attention into CONTRIBUTING.md and ARCHITECTURE.md because
nothing in the repo acknowledges "external plugin author" as a
distinct population. README aims at library *consumers*;
CONTRIBUTING at contributors *to* Zeta; ARCHITECTURE at whole-
system reviewers. No landing page for plugin-author persona.
Minimum contents: one-sentence audience; shape Ilyana picks
with 1-screen example; what NOT to read; pointer to
BayesianAggregate.fs as reference impl; error-on-drift
cheatsheet; two-line NuGet-packaging recipe.

### Alternative AX fix

If none of A/B/C is right: AX fix is not shape change but
**IntelliSense docstring pass + `dotnet new zeta-plugin`
scaffolding template**. Scaffolding matters more than shape.

### Comparative verdict

**Winner: Shape C (`PluginOp<'TIn, 'TOut>`)**, conditional on
BayesianAggregate migrating to it (canary = reference). If
migration out-of-scope, B wins on cold-start but loses hard on
stateful-operator case (Bayesian's exact use case).

---

## Round 26 — Kenji self-audit — earlier 2026

First audit of Kenji specifically, per round-24 deferral.
Advisory only; findings go back to Kenji who integrates.

### Cold-start cost

Kenji Tier 0 + Tier 1 = ~17.9k tok. Flat within noise vs
round-24 baseline (17.8k). AGENTS.md grew +700 tok (§14-§19);
offset by CURRENT-ROUND shrink + round-22 notebook prune.
Time-to-first-useful-output: 7-9 turns, unchanged.

Two disproportionately large surfaces: AGENTS.md 3.1k (19
numbered rules; candidate for §0 TL;DR block), GLOSSARY.md
4.5k (biggest single line-item, hits every persona).

### Friction

P0: none. Round-24 blockers all landed.

P1:

1. stale-pointer `.claude/agents/architect.md:146` "22" should
   be "25" (registry now 25 + 2 pending).
2. stale-pointer `.claude/skills/bug-fixer/SKILL.md:135` cites
   `.claude/skills/architect/SKILL.md` (retired round 24).
   Same dead path in backlog-scrum-master/:185, branding-
   specialist/:169, skill-creator/:145, and `docs/DEBT.md:237`
   (row resolved but not pruned).
3. unclear-contract: `architect.md:103-108` vs `round-
   management/SKILL.md:129-131` describe notebook prune cadence
   in different words (cadence vs size). Architect-offtime
   adds third ("trailing 10 entries"). Pick one, mirror.
4. duplicated-info: `round-management/SKILL.md §3.5`
   concurrent-agent machine hygiene (73-110) vs `architect.md`
   scope/NOT-do blocks cover dispatch discipline ~30% overlap.

P2:

5. architect.md:36 "unshowy tone" contract is healthy; notebook
   round-22 carries the self-review thread.
6. architect-offtime.md:38 "Round 23 - seeded, no budget spent"
   not updated through rounds 24-26; log zero-entries
   explicitly.
7. architect.md:39 "no hedging" — notebook line 94 has "whether
   this actually throttles velocity" — not a rule violation
   (notebook not in scope of ban), but the open measurement
   claim should resolve.

### Self-audit pattern risk

Low. Split (agent file = contract; notebook = running
self-review; round-management = procedure) keeps Kenji's voice
from narrating his own role in favour. Only weakness: prune-
cadence triple-source coordination drift.

### Systemic AX finding

**Persona + skill content overlap.** Every cold-start pays
overlap twice. Hypothesis: agent-file and sibling-skill-body
have ~20-35% content overlap across roster. Measurement
deferred to full roster audit (round 27 or 29).

Candidate BP-NN: *"When an agent file and its auto-injected
skill body cover the same contract surface (cadence, authority,
coordination), canon lives in one — default the skill body for
procedures, the agent file for persona/tone/scope-of-self."*

### Recommendations

Two same-round: architect.md:146 `22->25`; bug-fixer/:135
dead-path fix. Rest deferred. Do NOT rush the systemic finding
— measurement is a whole-roster audit, cadence-appropriate.

### Pointer-drift catalogue

- `.claude/agents/architect.md:146` "22" -> "25"
- `.claude/skills/bug-fixer/SKILL.md:135` dead path
- `.claude/skills/backlog-scrum-master/SKILL.md:185` same
- `.claude/skills/branding-specialist/SKILL.md:169` same
- `.claude/skills/skill-creator/SKILL.md:145` same
- `docs/DEBT.md:237` orphan-skills row resolved round 24

---

## Round 24 — first audit (baseline) — earlier 2026

### Cold-start cost baseline

**Tier 0 (shared):** CLAUDE 3698B + AGENTS 11835B + GLOSSARY
18067B + EXPERT-REGISTRY 7685B + WAKE-UP 4979B + CURRENT-ROUND
~2600B = **~48864B ~ 12.2k tokens.** Notable: WAKE-UP.md:21
states "~6-8k tokens" for Tier 0; measured ~1.7x higher.
GLOSSARY dominant (~4.5k alone).

**Per-persona Tier 0+1 (tokens):** Kira 14.4k, Viktor 14.8k,
Rune 14.8k, Aminata 14.7k, Aarav 16.6k, Soraya 17.6k, Kenji
17.8k, Daya 15.5k. **Total 8 personas ~125k; avg ~15.6k
per.** Time-to-first-useful-output: 7-9 turns minimum.

### Friction

P0:

1. Kenji notebook canon-pointer stale (fixed round 24).
2. Orphan skill files `.claude/skills/architect/` and
   `harsh-critic/` duplicate `round-management/` and
   `code-review-zero-empathy/`. Retired round 24.
3. Daya notebook missing (fixed — this file exists now).

P1:

- Tier 0 token undercount in WAKE-UP.md:21.
- `.claude/agents/architect.md:114,151` "22" -> "23".
- `docs/STYLE.md` referenced 3x but does not exist.
- `memory/<persona>/README.md:24-27` listed 2 notebooks; disk
  had 6.
- `.claude/skills/skill-tune-up/SKILL.md:117` cited invisible-
  Unicode rule without `(BP-10)` citation.
- `docs/DEBT.md` `wake-up-drift` tag zero entries before this
  audit.

P2:

- Kira `harsh-critic/SKILL.md:97` "reviewer #1" phrasing.
- Aminata skill body "She drives..." (skill files procedure-
  only after split).
- Daya SKILL.md didn't require self-audit — added to Step 1.

### Interventions landed (round 24)

7 rollback-safe edits per GOVERNANCE §15. 1-6 landed same
round; #7 (Aarav BP-10 citation fix) queued for Yara.

### New glossary entries

- **Orphan skill** — `.claude/skills/<name>/SKILL.md` with no
  persona listing it in `skills:` frontmatter. Looks like
  canon; is not.
- **Cold-start cost** — tokens Tier 0 + persona Tier 1 eat
  before the persona can produce useful output. Daya publishes
  per-persona trend.

---

## Round 34 — first migration: new-persona AX audit findings — 2026-04-19

Preserving pattern-worthy findings from Daya's round-34 audit of
the three new personas (Dejan / Bodhi / Iris). NOTEBOOK is at
4744 words (over BP-07 cap); triaging which entries deserve
journal preservation vs deletion.

**Cold-start cost baseline for three new personas (Tier 0 + 1).**
Dejan 16.5k tokens / 3-4 turns to first output. Bodhi 19.3k /
4-5 turns (heaviest — seed NOTEBOOK carries a full r34 DX
audit already). Iris 18.0k / 4 turns. All under the ~20k soft
envelope. **Use:** next new-persona audit compares against
this baseline; if cold-start crosses 25k, the persona's file
surface is probably over-dense.

**Rename-sweep timing gap — recurrence watch.** Round-33
Dbsp→Zeta code rename landed without a paired docs sweep;
round-34's researcher→engineer sweep was complete but still
left three residuals inside newly-landed skill bodies the
sweep ran before they landed (timing issue, not discipline).
Bodhi DX audit caught the doc residuals; Daya AX audit caught
the skill-body residuals. **Pattern for future recurrence:**
any sweep that runs during a round where new persona / skill
files are landing needs a second pass after the new files
land. Codified as round-close reminder.

**Systemic finding, deferred: persona+skill content overlap.**
Round-26 audit flagged ~20-35% overlap between agent files and
their sibling SKILL.md bodies. Round-29 reflection-cadence
retested — still present, not yet prioritized. **Current
status round 34:** unchanged; factory is still in
rapid-persona-growth mode (4 new personas this round), so
measurement is harder, not the moment to refactor. Revisit
round 39 when persona growth stabilizes.

**Evidence anchor:** memory/daya/NOTEBOOK.md round-34
entry (audit report, ~675 words) + round-26 audit entry
(systemic-overlap finding). Full audit artefacts in
NOTEBOOK.md before prune.

---

_(Seeded 2026-04-19 round 34. First migration on
next NOTEBOOK prune.)_
