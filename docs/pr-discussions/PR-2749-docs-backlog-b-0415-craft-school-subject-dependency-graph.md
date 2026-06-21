---
pr_number: 2749
title: "docs(backlog): 081KRA5AR0008QG0R002TKYRW3 craft school subject dependency graph"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:22:48Z"
merged_at: "2026-05-11T20:25:13Z"
closed_at: "2026-05-11T20:25:13Z"
head_ref: "feat/b-0415-craft-school-backlog-2026-05-11"
base_ref: "main"
archived_at: "2026-05-11T21:19:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2749: docs(backlog): 081KRA5AR0008QG0R002TKYRW3 craft school subject dependency graph

## PR description

## Summary

- Backlog item for craft school curriculum: human anchors → subjects → depends_on DAG
- Each named person ties to learnable subjects with prerequisite relationships
- P2 priority, no rush per Aaron

## Test plan

- [ ] Backlog item renders correctly
- [ ] No broken `depends_on` or `composes_with` references

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:26:09Z)

## Pull request overview

Adds a new P2 backlog row (081KRA5AR0008QG0R002TKYRW3) describing a “craft school” curriculum layer that maps human anchors to subjects and models prerequisites as a `depends_on` DAG.

**Changes:**
- Introduces backlog item 081KRA5AR0008QG0R002TKYRW3 with schema-compliant YAML frontmatter.
- Defines the proposed “human anchors → subjects → depends_on” dependency-graph concept plus acceptance criteria.
- Adds an example mapping and origin note for traceability.

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:26:24Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `25f0befdd5`


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

### Thread 1: docs/backlog/P2/081KRA5AR0008QG0R002TKYRW3-craft-school-subject-dependency-graph-human-anchors-2026-05-11.md:20 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:26:09Z):

P1: The link target `docs/HUMAN-ANCHOR-ARRAY.md` does not exist in the repo (search only finds this reference), so this will render as a broken link. Either update the reference to the existing Craft curriculum/subjects docs (e.g. under `docs/craft/`) or add the intended `docs/HUMAN-ANCHOR-ARRAY.md` file in the same PR so the cross-reference is valid.

### Thread 2: docs/backlog/P2/081KRA5AR0008QG0R002TKYRW3-craft-school-subject-dependency-graph-human-anchors-2026-05-11.md:2 (unresolved)

**@chatgpt-codex-connector** (2026-05-11T20:26:24Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Regenerate backlog index after adding new row**

Adding this per-row backlog file without updating `docs/BACKLOG.md` leaves the generated index out of sync, so `081KRA5AR0008QG0R002TKYRW3` is missing from the canonical backlog listing even though the row exists. Because this repo’s backlog flow treats `docs/BACKLOG.md` as generated output, this drift can break review/triage surfaces and will be caught by the backlog index integrity workflow once parity checks run on auto-generated mode.

Useful? React with 👍 / 👎.

### Thread 3: docs/backlog/P2/081KRA5AR0008QG0R002TKYRW3-craft-school-subject-dependency-graph-human-anchors-2026-05-11.md:17 (unresolved)

**@chatgpt-codex-connector** (2026-05-11T20:26:24Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Replace broken reference to missing anchor doc**

This task says to extend `docs/HUMAN-ANCHOR-ARRAY.md`, but that file path does not exist in the repository at this commit. The dead reference makes the backlog item harder to execute and verify because contributors cannot locate the baseline document it claims to extend; either point to the existing source file or state explicitly that creating this doc is part of the work.

Useful? React with 👍 / 👎.
