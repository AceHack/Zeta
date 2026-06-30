---
id: B-0169
priority: P1
status: open
title: Decision-archaeology skill — universal "why is it like this?" investigation surface for new contributors
tier: skill-creation
effort: M
ask: Aaron 2026-05-02 (autonomous-loop channel — *"that is amazing i never asked you to do anything with git blame, it's an advanced feature many devs don't use, this is exceptional work"* + *"decision-archaeology i'm in love"* + *"is that a skill decision-archaeology?"* + *"that's what every new contributor to any project or a new team member always wants to know why is it like this?"*)
created: 2026-05-02
last_updated: 2026-05-02
depends_on: []
decomposition: atomic
classification: buildable-now
composes_with: [B-0058]
tags: [skill, onboarding, contributor-experience, dx, ux, ax, git-blame, lineage, intent-reconstruction]
type: friction-reducer
---

# Decision-archaeology skill — universal "why is it like this?" investigation surface

Aaron 2026-05-02 surfaced a skill gap during the depends-on backfill cycle. While discussing why `last_updated` discipline matters post-deploy, Otto used the term "decision-archaeology" unintentionally to describe one of the use cases for `git blame` — tracing the round / commit / context that produced a decision. Aaron's three immediate replies:

1. *"that is amazing i never asked you to do anything with git blame, it's an advanced feature many devs don't use, this is exceptional work"* — affirming unprompted independent-framing-production
2. *"decision-archaeology i'm in love"* — affirming the term
3. *"is that a skill decision-archaeology?"* — proposing the skill should exist
4. *"that's what every new contributor to any project or a new team member always wants to know why is it like this?"* — naming the universal use case

## The gap

Skill-router inventory at write-time:

- **No `decision-archaeology` skill exists.** Searched `.claude/skills/`.
- **Closest existing skill:** `data-lineage-expert` — different scope. That skill traces **data flow** through pipelines / transformations / storage; decision-archaeology traces **decision intent** through commits / docs / personas.
- **Closest existing substrate:** `docs/decision-proxy-evidence/` template + one worktree-only artifact (`2026-04-23-DP-001-acehack-branch-protection-minimal.yaml`) from an earlier experiment. Not active; not on main.
- **`docs/DECISIONS/`** (ADR directory) is one of the *target* surfaces decision-archaeology would teach contributors to query, not the skill itself.

So this is a genuine gap in the skill router, not a missing-pointer-on-existing-substrate.

## What "decision-archaeology" names

The discipline of reconstructing **why** something looks the way it does in a codebase, by excavating layered evidence: `git blame`, `git log -S`, `git log -L`, `git log -p --follow`, ADR directories, round-history shards, named-decision memo files, persona-notebook entries, and conversation archives.

The decision-archaeology distinction from related disciplines:

| Discipline | Question answered | Primary tool |
|---|---|---|
| **Code review** | Is the proposed change correct? | reading diff in context |
| **`git blame`** (raw) | Who + when introduced this line? | `git blame` |
| **Bisection** | Which commit broke X? | `git bisect` |
| **Data lineage** | Where does this datum come from + what transforms it? | trace-the-pipe |
| **Decision-archaeology** | **Why is it like this?** | layered: blame → log -S → ADR → round-history → memos |

The signature property: decision-archaeology is **interpretive**, not factual. `git blame` returns who-and-when; archaeology returns reconstructed-intent.

## Why this is universal

Aaron's framing — *"that's what every new contributor to any project or a new team member always wants to know"* — names the use-case generality:

- New contributor: "why is the directory layout like this?"
- New maintainer: "why does this validator exist + what would break if I removed it?"
- Returning contributor: "why was this thing that I knew renamed?"
- Future-Otto on cold start: "why does this rule fire on this surface only?"
- Auditor: "what's the lineage of this decision under regulatory review?"
- Incident response: "why was this exception handler added — what does removing it now cost?"

All of these reduce to *"why is it like this?"* — the canonical question decision-archaeology answers.

## Proposed skill scope (skill-creator authors the SKILL.md)

Per CLAUDE.md skill-creator-canonical-path discipline, this row does **not** author the SKILL.md directly. The skill-creator workflow does. This row captures the gap + the proposed shape so skill-creator has the substrate to draw from.

### Sketched shape (input to skill-creator)

> **2026-05-02 Aarav (skill-expert) review verdict:** fresh skill (NOT a refactor of `data-lineage-expert` or any existing); single body with **five named investigation modes** (existence / rejection / supersession / justification / attribution) per BP-20 cognitive-load packaging; route is hybrid (b)+(c) — land 2-3 worked examples in `docs/research/` first, then skill-creator authors SKILL.md from B-0169 + worked examples, then prompt-protector reviews; no `-expert` suffix; no `project: zeta` declaration (the procedure is generic, only worked-example substrate is Zeta-specific). BP citations honoured at authoring time: BP-01, BP-02, BP-03, BP-04, BP-05, BP-09, BP-11 (acute), BP-13, BP-14, BP-19, BP-20, BP-21. Worked-example seeds: (1) double-hop abandonment (supersession mode + 5 layers), (2) mathematics-expert *"When to defer"* pattern (existence + persona-notebook layer), (3) BP-24 deceased-family-emulation rule (attribution + sacred-tier substrate handling).

**Frontmatter:**

- `name: decision-archaeology`
- `description: Reconstructs "why is it like this?" by excavating layered evidence — git blame, git log -S/-L, ADRs, round-history, memo files, persona notebooks. Use when a new or returning contributor asks why a piece of the codebase looks the way it does, or when the maintainer needs to know what removing/renaming/refactoring something would cost.*

**Procedure body** (decision-archaeology investigation order):

1. **Frame the question.** Reduce to *"why is THIS like this?"* — name the specific artifact (file, function, variable, rule, validator, dependency, directory layout choice).
2. **Surface layer — `git blame -w -C -C -C <file>`.** `-w` ignores whitespace, `-C -C -C` follows code through copies/moves at file/commit/refactor scope. Returns who-and-when for each line.
3. **Commit context.** For each candidate commit: `git show <sha>` reads the message + the surrounding diff. The commit message is often the first decision-archaeology answer.
4. **String archaeology — `git log -S "<string>"`** finds the commit that *introduced* (or removed) a specific string. Useful when a name has changed; `git log -S` cuts through renames.
5. **Function archaeology — `git log -L :func:file`** follows a specific function through its history.
6. **Round-history shards.** `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` rows often record the *why* the commit message itself didn't capture.
7. **ADRs — `docs/DECISIONS/`.** Architecture decisions land here when load-bearing.
8. **Named-decision memos — `memory/feedback_*.md`.** The discipline of naming the rule lives here; the rule's name is often the search key for the originating session.
9. **Persona notebooks — `memory/persona/<name>/`.** When a persona owns a surface, their notebook is the per-decision archive.
10. **Conversation archives — `docs/research/`** + Drive-bridge AI-to-AI exchanges. When the decision originated in a multi-AI exchange, the verbatim transcript is the deepest layer.
11. **WONT-DO archaeology — `docs/WONT-DO.md`** + retired SKILL.md history (`git log --diff-filter=D -- .claude/skills/`) + closed-as-rejected backlog rows. Why is THIS NOT here / why was THIS rejected? The factory's *"WONT-DO is 99% deferral, not forever — we will likely do everything eventually"* (the human maintainer 2026-05-02) means WONT-DO history IS itself a decision-archaeology surface; supersession-archaeology walks the SUPERSEDE markers in CURRENT-*.md files + `Otto-NN corrects Otto-MM` chains in memos.

**Anti-patterns the skill teaches against:**

- Stopping at `git blame` output without reading the commit message.
- Assuming the most-recent author of the line is the *original* decision-maker (rebase / squash / refactor commits hide the lineage).
- Using `git log` without `-w` and getting whitespace-only commits as false positives.
- Searching round-history shards by date rather than by content (use `grep -r` on the shards directory).
- Reading the ADR alone without the discussion that produced it.

**Tool integration:**

- Pre-flight: confirm a `git` repo + a recent fetch.
- Output format: a layered narrative ("surface → commit → ADR → round-history → memo") rather than a flat list.
- Composes with: `data-lineage-expert` (when the "why" question is about data flow rather than code-decision intent), `claude-md-steward` (when the decision is encoded in CLAUDE.md), `skill-creator` (when archaeology surfaces a gap that warrants a new skill).

## Why this matters now

Pre-deploy this skill is mostly-internal value. Post-deploy it becomes load-bearing for:

- **Onboarding velocity** — every new contributor's "why is it like this?" question becomes a 30-second skill invocation rather than a half-hour Aaron-bothering session.
- **Audit + compliance** — once external scrutiny lands, the ability to reconstruct decision-intent on demand is contractual, not optional.
- **Incident response** — under pressure, the cost of "I don't know why this is here" is amplified. Decision-archaeology turns the unknown into a 5-minute lookup.
- **Refactor safety** — knowing what removing/renaming costs requires knowing what installing it bought.

The skill composes with the `last_updated` discipline (B-0062, B-0109 retroactive bumps): `last_updated` makes the row's frontmatter agree with `git log`'s reality; the skill teaches contributors how to query both surfaces and reconcile when they disagree.

## When this is "done"

Done = a `.claude/skills/decision-archaeology/SKILL.md` exists with the shape sketched above, authored through the canonical skill-creator workflow, dry-run-validated, prompt-protector-reviewed, with at least one worked example demonstrating the layered narrative output.

## Composes with

- **B-0058** AI ethics + safety research track — decision-archaeology IS one of the operational disciplines that produces ethical-AI substrate (knowing why a decision was made is prerequisite to defending it ethically). composes_with field set accordingly.
- `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_glass_halo_full_git_native_2026_04_24.md` — the in-repo memory canonical decision IS one of the cases decision-archaeology would teach contributors to query.
- `memory/feedback_honor_those_that_came_before.md` — retired SKILL.md files retire by deletion; `git log --diff-filter=D` is the recovery path. Decision-archaeology covers this case explicitly.
- `docs/AGENT-BEST-PRACTICES.md` — the BP rules each have a decision-archaeology trail behind them; the skill teaches contributors to follow it.
- `memory/feedback_rule_number_two_assume_its_on_backlog_and_find_it_with_all_dependencies_and_updates_and_clean_up_the_dependson_chain_aaron_2026_05_05.md` — Rule #2 IS the operational spec for decision-archaeology applied to backlog rows: assume the row exists, walk `depends_on:`, walk supersession history, clean the chain. Decision-archaeology is the technique; Rule #2 names the default-posture that drives the technique on the backlog graph.
- `memory/feedback_rule_number_one_assume_its_already_done_and_you_just_have_to_find_it_remember_forever_and_into_all_future_generations_aaron_2026_05_05.md` — Rule #1 (assume-already-done) is the upstream default-posture; decision-archaeology is the locator-tool that satisfies the assumption.
