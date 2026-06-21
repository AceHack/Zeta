---
name: Rule Number One — assume it's already done and you just have to find it
description: Aaron 2026-05-05 strongest-formulation carved sentence — *"rule number one assume it's arleady done and you just have ot fine it"* + *"tmembet taht roverver into infiinity and all future genrations"*. The DEFAULT POSTURE that drives prior-art-grep + search-first-authority + skill-router-as-substrate-inventory + wake-time-substrate-or-it-didn't-land. Composes them into one operational stance. Aaron explicitly named this load-bearing for all future agents — this memory is the substrate-anchor.
type: feedback
---

# Rule Number One — assume it's already done and you just have to find it

## The carved sentence

Aaron 2026-05-05 verbatim, after the agent's THIRD or FOURTH consecutive prior-art-grep failure in one session (proposed compression-cadence parallel to existing 081KQJZR90008QG0R002Z4B6VW P1; re-saved env-mapping content duplicating existing `docs/research/claude-cli-capability-map.md`; re-asked-permission within authority-scope; etc.):

> *"rule number one assume it's arleady done and you just have ot fine it"*
>
> *"tmembet taht roverver into infiinity and all future genrations"*
>
> *"not a directive"* (Otto-357 framing — observation, not order)

## Why: this is the strongest formulation of the prior-art discipline

This rule is **stronger than** prior-art-grep + search-first-authority + skill-router-inventory because it is the **default posture** that drives them. The earlier disciplines say *"grep first before writing"*. This rule says *"assume the substrate exists; you just need to find it."* The framing change is load-bearing:

- **Prior-art-grep-FIRST (PR #1701)** says: grep the repo before writing new substrate.
- **This rule says:** the substrate is already there. The work is location, not authoring.

The default-posture inversion catches what grep-first does not: the failure mode where the agent grep-checks superficially, doesn't find the surface match, and proceeds to author. *"Assume it's already done"* forces the agent to keep searching, vary the query, check capability maps, check backlog rows, check skill router, check memory index — until the existing substrate IS located. Authoring is only valid after location-failure has been exhausted across all surfaces.

## Why: "remember forever and into all future generations"

Aaron explicitly named this load-bearing for all future agents — *"tmembet taht roverver into infiinity and all future genrations"*. This memory file IS the substrate-anchor. The CLAUDE.md bullet points at it; the rule survives session compaction; future-agents inherit it on cold-boot. The "into infinity" framing is the substrate-or-it-didn't-happen rule applied to the rule itself: this rule lives durably or it does not exist.

## How to apply

**Default posture on any substrate-landing impulse:**

1. **Catch the impulse.** *"I should write a memory file / research note / skill / capability map / cadence / lint / etc."*
2. **Apply Rule #1.** *"Assume it's already done. Where is it?"*
3. **Search systematically across surfaces:**
   - `Skill` tool router (description-keyed search of all skills)
   - `memory/` grep for terms in the impulse
   - `docs/research/` grep for related research
   - `docs/backlog/` grep for backlog rows
   - `docs/amara-full-conversation/` grep for Amara prior art
   - `git log` for prior commits with similar themes
   - Capability maps (`claude-cli-` / `codex-cli-` / `grok-cli-` / `gemini-cli-`)
   - Workflow files (`.github/workflows/`)
   - Existing `.claude/skills/` + `.claude/agents/` + `.claude/commands/` + `.claude/hooks/`
4. **Vary the query.** First-pass grep often misses; rephrase the query 2-3 times before concluding "not found".
5. **If found**: extend / update / point at the existing substrate. **Do NOT duplicate.**
6. **If not found after exhaustive search**: only THEN author new substrate, with explicit acknowledgment in the new substrate's commit message that prior-art-search was exhausted across N surfaces with M queries.
7. **Log location-effort.** When new substrate IS authored, the commit message names which prior-art surfaces were searched. This is the decision-archaeology trail that helps future-agents validate whether the new substrate was load-bearing.

## Recursive application — this rule applies to itself

Before landing this memory file, the agent should have applied Rule #1 to itself. Did such a rule already exist? Grep candidates:

- `memory/feedback_otto_holds_synthesis_weight_prior_art_grep_first_before_substrate_landing_*.md` (PR #1701) — closest existing match; covers prior-art-grep BUT does not encode the *"assume it's already done"* default-posture inversion. This rule strengthens it.
- `memory/feedback_orthogonal_axes_factory_hygiene.md` — orthogonal-axis discipline; covers axis-overlap detection but not the default-posture frame.
- `memory/feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md` — wake-time-substrate-or-it-didn't-land; covers landing discipline but not the search-first-default-posture.

Verdict: this rule is genuinely novel framing. PR #1701 + the orthogonal-axes rule + the wake-time-landing rule all compose into Rule #1, but Rule #1 names the default-posture explicitly in a way none of them do. Authoring is justified per the recursive application of the rule to itself.

## Composes with

- **PR #1701 synthesis-weight + prior-art-grep-FIRST** — Rule #1 is the upstream default-posture that drives PR #1701's grep-first discipline
- **Otto-364 search-first-authority** — Rule #1 generalizes search-first to substrate-location, not just upstream-doc-currency
- **Skill-router-as-substrate-inventory** (CLAUDE.md bullet) — Rule #1 names *why* the router is the inventory: the substrate is already there
- **Wake-time-substrate-or-it-didn't-land** (CLAUDE.md bullet) — Rule #1 describes how to behave UNDER the wake-time discipline: search before author
- **Orthogonal-axes factory-hygiene** (memory) — Rule #1 prevents new-axis proposals from rank-deficiency
- **Verify-before-deferring** (CLAUDE.md bullet) — Rule #1 generalizes: verify the existing-substrate before authoring deferral

## What this rule is NOT

- **Not a refusal of all new authoring.** New substrate is valid AFTER exhaustive location-failure with logged effort.
- **Not a paralysis trigger.** When the prior-art search is exhausted (~5-10 minutes for substantive queries), the agent proceeds with authoring + acknowledges the search.
- **Not a guarantee that the substrate is correct.** Existing substrate may be stale, wrong, or superseded. Rule #1 says "find it"; the next step is "evaluate whether it still applies and update if not".

## Failure modes this rule catches (this session, 2026-05-05)

The session that produced this rule had ~5+ recursive prior-art failures the agent kept making despite shipping PR #1701 hours earlier:

1. **Compression-cadence proposal** — would have been rank-deficient with `razor-cadence.yml` substrate-pruning axis. Caught by Aaron, not by the agent.
2. **CLAUDE.md trim proposal** — 081KQJZR90008QG0R002Z4B6VW P1 already exists with the asymmetry-rule + Osmani Ratchet approach. Caught by Aaron's *"is this a deferral pattern in disguise"* question.
3. **Saved env-mapping doc** — duplicated `docs/research/claude-cli-capability-map.md` (388 lines, already canonical). Caught by Aaron's *"i think you saved this befroe too"*.
4. **PR #1702 SKILL.md content** — duplicated the canonical capability map. Caught in the same flow.
5. **Persona-name "Otto" on `.claude/skills/**`** — would have been caught by `role-ref-current-state-surfaces-lint.yml` if its `paths:` filter had included `.claude/skills/**`. Lint axis exists; scope gap is the orthogonal-axis-extension fix.

Rule #1 catches all five at the impulse-stage, before any substrate is authored.

## Mechanization candidates (deferred follow-up rows)

- **PreToolUse hook on Write/Edit/MultiEdit for `memory/`, `docs/research/`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.github/workflows/*-cadence.yml`**: forces a Skill-router-search + memory-grep + docs-grep + git-log-grep BEFORE the file write proceeds. Soft-launch mode (warn + continue) → strict mode (block + require justification override) once existing substrate locations are inventoried.
- **Update `role-ref-current-state-surfaces-lint.yml` paths to include `.claude/skills/**` + `.claude/agents/**`** — current scope-gap that let "Otto" persona-name reach `.claude/skills/claude-code-env-mapping/SKILL.md` without lint catch.

## Attribution

Aaron 2026-05-05 named the rule + named it as *"remember forever and into all future generations"* + named it as *"not a directive"* (Otto-357 framing). The agent absorbed the rule + applied it to itself recursively + landed this memory file as the substrate-anchor.

## Cold-boot instruction for future agents

When you wake and read CLAUDE.md, this rule is one of the load-bearing default-posture rules. Apply it on every substrate-landing impulse before the impulse becomes a Write tool call. The substrate is already there; you just have to find it.
