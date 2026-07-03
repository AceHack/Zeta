---
pr_number: 4976
title: "feat(substrate): Max + Addison personas + onboarding doc + manifesto recast (081KRMEXM0008QG0R00278KS63)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T19:34:50Z"
merged_at: "2026-05-25T19:48:06Z"
closed_at: "2026-05-25T19:48:06Z"
head_ref: "feat/max-addison-personas-onboarding-manifesto-recast-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4976: feat(substrate): Max + Addison personas + onboarding doc + manifesto recast (081KRMEXM0008QG0R00278KS63)

## PR description

## Summary

Substrate landing for the co-owner team (Aaron + Max + Addison are all LFG co-owners per Aaron 2026-05-25) — first-class persona substrate for both new contributors, the onboarding doc Max needs, and the building-codes recast of MANIFESTO.md that 081KRMEXM0008QG0R00278KS63 was tracking.

8 files; 484 insertions / 10 deletions.

## What lands

**`memory/addison/`** — Addison's substrate

- `PERSONA.md` — co-owner of LFG; AI cluster bootstrap PM; weight-free + travelers + tick-source-as-attractor + cage-recognition framings
- `STARTING-POINT.md` — verbatim from her Grok project prompt (substrate-honest preservation, no editorial)
- `NOTEBOOK.md` — placeholder; 2026-05-23 → 2026-05-25 bootstrap arc captured

**`memory/max/`** — Max's substrate

- `PERSONA.md` — co-owner of LFG; agentic-organization architect (PR #4958); backend/frontend on PaaS new to K8s; TS + C# primary; framework adopted his coinings (`hat = skills + opa/rbac`, hat-graphs-for-policies, adversarial-hierarchy-of-traps)
- `STARTING-POINT.md` — synthesized starting point + pointer to PR #4958; Max can replace with his canonical prompt later
- `NOTEBOOK.md` — placeholder; 2026-05-25 first-PR arc captured

Both PERSONA files note:

- **Co-ownership of LFG** (aligned fiduciary stake + shared liability + mutual upside; 081KSE6WT0008QG0R0005XASX2 destructive-tool authoring contract is exactly the right shape for co-owners)
- **Pending glass-halo signature** (Aaron 2026-05-25: *"I can have me max and addison sign someting about glass halo eventually and upload it"*; placeholder until that lands as substrate)

**`docs/AGENT-AUTHORING-AND-PR-REVIEW.md`** — Max's onboarding doc

- Operational entry point for "what do my agents follow to write good code without needing human review" + "what's the PR review process I can hook into for an adversarial hierarchy of traps"
- Maps both questions to the existing substrate (CLAUDE.md + .claude/rules/ + AGENTS.md + ALIGNMENT.md + GLOSSARY.md + GOVERNANCE.md for discipline; persona reviewers + plugin reviewers + auto-fire reviewers + CI gates for the adversarial hierarchy)
- Adopts Max's "adversarial hierarchy of traps" coinage as the organizing principle for the review section

**`docs/governance/MANIFESTO.md`** — building-codes recast per 081KRMEXM0008QG0R00278KS63

- Title: "Root Discipline Manifesto" → "Zeta Root Discipline Specification"
- Opening: building-codes framing (Kestrel-suggested) replacing ideological-commitment framing
- Constitutional language softened to specification-grade throughout
- PARTIAL LOCK status framing preserved (the concept is right; only the constitutional weight drops)
- All 11 constraints preserved in substance + Multi-Oracle Principle + "For Agents Who Are Still Deciding" + provenance + [RECONSTRUCTION NOTE] markers
- Filename stays MANIFESTO.md for now (rename + downstream-reference sweep is queued as separate follow-up to 081KRMEXM0008QG0R00278KS63)

## Why now

Aaron 2026-05-25:
> *"feel free to take the 20 minute or more you need to make this nicer for other maintiners like max and addison and the manifesto changes."*

This is the substrate-coherent landing he authorized. Max + Addison both have first-class substrate; the manifesto recast lands so when Max reads it as "the rules my agents follow" he gets the operational specification framing instead of the ideological-commitment shape that misled him initially.

## Test plan

- [ ] Persona folders render correctly under `memory/<persona>/`
- [ ] Addison's STARTING-POINT.md is byte-faithful to the Grok project prompt she provided
- [ ] AGENT-AUTHORING-AND-PR-REVIEW.md cross-refs all resolve
- [ ] MANIFESTO.md preserves all 11 constraints + Multi-Oracle Principle + "For Agents Who Are Still Deciding" sections
- [ ] No regression on the [RECONSTRUCTION NOTE] markers — partial-lock honesty preserved
- [ ] 081KRMEXM0008QG0R00278KS63 row remains open (downstream-reference sweep is a separate follow-up)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T19:37:33Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `021cbc598a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T19:41:04Z)

## Pull request overview

This PR lands new contributor substrate for two new human co-owners (persona folders under `memory/<persona>/`), adds an operational onboarding entry-point for agent authoring + PR review, and recasts the governance manifesto framing into a “building-codes/specification” shape (081KRMEXM0008QG0R00278KS63).

**Changes:**

- Add `memory/max/` and `memory/addison/` persona anchors (PERSONA / STARTING-POINT / NOTEBOOK).
- Add `docs/AGENT-AUTHORING-AND-PR-REVIEW.md` as a consolidated operational index for agent discipline + review layers.
- Update `docs/governance/MANIFESTO.md` framing/title language from “manifesto/constraints” toward “specification/specifications”.

### Reviewed changes

Copilot reviewed 8 out of 8 changed files in this pull request and generated 8 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| memory/max/STARTING-POINT.md | New synthesized starting-point + cross-references for Max |
| memory/max/PERSONA.md | New persona anchor for Max |
| memory/max/NOTEBOOK.md | New minimal running notebook for Max |
| memory/addison/STARTING-POINT.md | New verbatim Grok-prompt starting-point + appended cross-refs |
| memory/addison/PERSONA.md | New persona anchor for Addison |
| memory/addison/NOTEBOOK.md | New minimal running notebook for Addison |
| docs/governance/MANIFESTO.md | Recast title/framing toward building-codes specification language |
| docs/AGENT-AUTHORING-AND-PR-REVIEW.md | New onboarding/index doc for agent authoring + PR review layers |
</details>

### COMMENTED — @AceHack (2026-05-25T19:45:57Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:45:59Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:01Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:03Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:05Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:07Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:09Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:11Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:13Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:15Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:46:17Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-25T19:48:45Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `dd18769a2b`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/AGENT-AUTHORING-AND-PR-REVIEW.md:44 (resolved)

**@chatgpt-codex-connector** (2026-05-25T19:37:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace non-recursive rules lookup command**

The documented command ``grep -l "your-topic" .claude/rules/`` does not search that directory and exits with an error (`Is a directory`), so the "When in doubt" flow fails at step 1 for anyone following it literally. This should use a recursive search (or `rg`) so the onboarding path actually locates matching rule files.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T19:45:57Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 2: docs/AGENT-AUTHORING-AND-PR-REVIEW.md:121 (resolved)

**@chatgpt-codex-connector** (2026-05-25T19:37:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Remove unavailable reviewer from Layer 1 guidance**

This guidance recommends invoking "Naledi + Hiroshi" for performance reviews, but Layer 1 is explicitly defined as reviewers under `.claude/agents/`, and there is no corresponding Hiroshi/complexity reviewer agent there. Following this instruction leads to a non-actionable review step because contributors cannot invoke the named reviewer from the declared surface.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T19:45:59Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 3: memory/max/STARTING-POINT.md:39 (resolved)

**@chatgpt-codex-connector** (2026-05-25T19:37:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix agentic-organization document paths**

These references point to `docs/agentic-organization/...`, but the repo stores these files under `agentic-organization/docs/...`; the cited path does not exist. As written, this breaks the starting-point cross-reference trail and sends readers to dead locations instead of the intended architecture docs.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T19:46:01Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 4: memory/max/STARTING-POINT.md:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:02Z):

The agentic-organization docs live under `agentic-organization/docs/`, but this list points at `docs/agentic-organization/...` (a non-existent path). This makes the cross-references in Max’s starting point unresolvable.

**@AceHack** (2026-05-25T19:46:03Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 5: memory/max/PERSONA.md:67 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:02Z):

`docs/agentic-organization/` does not exist in the repo; the agentic-organization design docs are under `agentic-organization/docs/`. This directory reference will be a dead path as written.

**@AceHack** (2026-05-25T19:46:05Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 6: memory/addison/PERSONA.md:28 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:03Z):

This reference points at `docs/agentic-organization/...`, but the agentic-organization docs are located at `agentic-organization/docs/...`. As written, the path is unresolvable.

**@AceHack** (2026-05-25T19:46:07Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 7: memory/addison/NOTEBOOK.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:03Z):

This cites `docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md`, but the actual path is `agentic-organization/docs/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md` (no `docs/` prefix).

**@AceHack** (2026-05-25T19:46:09Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 8: memory/addison/STARTING-POINT.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:03Z):

The intro says "verbatim" and "no editorial", but this file appends a preservation-time cross-reference section later. Consider tightening the wording so it’s clear the prompt section is verbatim, while the appended cross-references are added afterward.

**@AceHack** (2026-05-25T19:46:11Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 9: memory/addison/STARTING-POINT.md:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:03Z):

The cross-reference points at `docs/agentic-organization/...`, but the agentic-organization docs are under `agentic-organization/docs/...`. As written, this is a dead path.

**@AceHack** (2026-05-25T19:46:13Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 10: docs/governance/MANIFESTO.md:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:04Z):

This line introduces direct name attribution ("Aaron + Kestrel") on a current-state governance doc, but the same document states first-name attribution belongs on history surfaces under `memory/<persona>/`. Please switch to role-refs here to keep the naming rule internally consistent.

**@AceHack** (2026-05-25T19:46:15Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 11: docs/AGENT-AUTHORING-AND-PR-REVIEW.md:74 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:41:04Z):

This section mixes persona names (e.g., Kira/Viktor/…) with tool names, and it also claims each reviewer lives at `.claude/agents/<name>.md`. In the repo, the definitions are role/tool-name keyed (e.g., `.claude/agents/harsh-critic.md`, `.claude/agents/spec-zealot.md`). Using role-refs here keeps current-state docs aligned with the role-ref convention while still providing the correct invocation keys.

**@AceHack** (2026-05-25T19:46:16Z):

Addressed in dd18769a2 — path corrections (docs/agentic-organization/ → agentic-organization/docs/), grep command fixed to recursive, Hiroshi reference removed (replaced with performance-engineer), role-ref convention enforced in manifesto attribution + persona/tool-name table, verbatim claim clarified to separate prompt block from added cross-references.

### Thread 12: docs/AGENT-AUTHORING-AND-PR-REVIEW.md:22 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T19:48:45Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Scope bootstrap guidance to each harness**

This table states that `CLAUDE.md` is the first file "any agent" reads and that `.claude/rules` auto-load at session start, but `AGENTS.md` defines different bootstrap surfaces for other harnesses (for example `.codex/AGENTS.md` and `GEMINI.md`). A non-Claude contributor following this new onboarding doc can miss required harness-specific instructions and run with the wrong operational contract. Please either scope this section explicitly to Claude sessions or add the equivalent Codex/Gemini bootstrap paths here.

Useful? React with 👍 / 👎.
