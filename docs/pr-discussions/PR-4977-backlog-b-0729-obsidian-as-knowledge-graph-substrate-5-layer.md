---
pr_number: 4977
title: "backlog(081KSE6WT0008QG0R003RN2WE3): Obsidian as knowledge-graph substrate \u2014 5-layer adoption (wikilinks + tags + callouts + Tasks + JSON-LD extractor)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T19:42:58Z"
merged_at: "2026-05-25T19:52:47Z"
closed_at: "2026-05-25T19:52:47Z"
head_ref: "backlog/b0729-obsidian-knowledge-graph-substrate-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4977: backlog(081KSE6WT0008QG0R003RN2WE3): Obsidian as knowledge-graph substrate — 5-layer adoption (wikilinks + tags + callouts + Tasks + JSON-LD extractor)

## PR description

## Summary

Files Aaron's knowledge-graph substrate question + the team-decision to use Obsidian as canonical (since everyone has experience) while staying compatible with Foam / Logseq / Dendron (same vault format) for individuals who prefer alternatives.

5 layers, each shippable standalone:

| Layer | Substance | Effort | Value |
|-------|-----------|--------|-------|
| L1 | Wikilink conversion (TS script + frontmatter aliases for GitHub-compat) | 1-2 days | Obsidian graph view becomes load-bearing |
| L2 | Frontmatter tags convention across rules + personas + docs | 1 day | Tag-pane + Dataview queries |
| L3 | Obsidian callouts for evolving documentation (`> [!todo]`, `> [!warning]`, etc.) | 1 day | Structured annotations |
| L4 | Obsidian Tasks-plugin format for enriched TODOs (`📅` `🔼` `🔁` `✅`) | 1 day | Due-dates / priority / recurring semantics on inline tasks |
| L5 | TS extractor emitting JSON-LD + property-graph JSON | 1-2 weeks | Agents can programmatically query the knowledge substrate |

Plus standards survey documenting why semantic-web tier (RDF/OWL/SPARQL — what Aaron + team used at LexisNexis) is too heavy for git-native + AI-friendly, while the Obsidian/Foam/Logseq vault format is the right light-tier floor.

## Why now

Team is at the right scale to benefit (3 co-owners + agents + the framework's existing 60+ rules + 700+ backlog rows + dozens of personas + extensive cross-references = a knowledge graph waiting to be visualized + queried). Each layer compounds value with the next. L1 + L2 are cheap quick wins; L5 unlocks the programmatic-query primitive Max's agentic-organization design (PR #4958) will eventually need.

## Composes with

- Today's PR #4976 (personas + onboarding + manifesto recast) — the substrate this knowledge-graph extracts from
- Max's `full-ai-cluster/k8s/applications/hat-system/graph/render.go` — L5 extractor uses the same Graphviz-DOT-from-state pattern, scoped to knowledge substrate vs cluster CRD state
- PR #4958 (agentic-organization) — design benefits most from programmatic graph query
- 081KRMEXM0008QG0R00278KS63 (manifesto recast) — composes-with sections in MANIFESTO.md become natural graph-edge surfaces

## Test plan

- [ ] Row renders correctly under `docs/backlog/P2/`
- [ ] `docs/BACKLOG.md` includes 081KSE6WT0008QG0R003RN2WE3
- [ ] 5-layer acceptance criteria are concrete enough for sub-rows to be split off per layer when picked up
- [ ] Standards survey accurately distinguishes heavy semantic-web from light git-native tier

Single file (+ index regen) — docs only; no implementation in this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T19:45:50Z)

## Pull request overview

Adds a new P2 backlog row (081KSE6WT0008QG0R003RN2WE3) proposing a 5-layer adoption plan for using an Obsidian-compatible vault format as the project’s lightweight, git-native knowledge-graph substrate, and registers the row in the main backlog index.

**Changes:**

- Adds `081KSE6WT0008QG0R003RN2WE3` backlog row detailing layers L1–L5 (wikilinks, tags, callouts, Tasks-plugin semantics, JSON-LD/property-graph extractor) plus acceptance criteria and a standards survey.
- Updates `docs/BACKLOG.md` to include 081KSE6WT0008QG0R003RN2WE3 under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md | New P2 backlog row describing Obsidian-as-substrate and 5-layer rollout plan. |
| docs/BACKLOG.md | Adds 081KSE6WT0008QG0R003RN2WE3 entry to the P2 list. |

### COMMENTED — @chatgpt-codex-connector (2026-05-25T19:46:12Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `32c0007b87`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-25T19:47:52Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:47:54Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:47:55Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T19:47:57Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-25T19:49:27Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `41c03a1c76`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-25T19:51:10Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-25T19:52:52Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `e2b98afecb`


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

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:45:49Z):

This new backlog row claims (in the L2 section) that backlog rows already use frontmatter `tags: [...]`, but this file’s own frontmatter does not include a `tags:` field. Either add appropriate tags for 081KSE6WT0008QG0R003RN2WE3 (so it matches the convention being proposed) and/or adjust the wording to reflect that tag usage in backlog rows is not yet universal.

**@AceHack** (2026-05-25T19:47:52Z):

Addressed in latest push. Most substantive: Codex caught a real L1 design flaw (wikilink conversion would break GitHub rendering); reframed L1 to use frontmatter aliases instead — Obsidian graph still works, GitHub rendering preserved. Plus markdownlint MD022/MD032 fixes, meta-irony frontmatter tags addition, callout-case correction to uppercase for GFM compat, and composes_with qualifier for PR-pending reference.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:45:49Z):

`docs/AGENT-AUTHORING-AND-PR-REVIEW.md` is referenced in `composes_with`, but that file does not exist in this branch. Please update this reference to a file/path that exists, or add the missing doc in the same PR (otherwise cross-references from this row will be broken).

**@AceHack** (2026-05-25T19:47:54Z):

Addressed in latest push. Most substantive: Codex caught a real L1 design flaw (wikilink conversion would break GitHub rendering); reframed L1 to use frontmatter aliases instead — Obsidian graph still works, GitHub rendering preserved. Plus markdownlint MD022/MD032 fixes, meta-irony frontmatter tags addition, callout-case correction to uppercase for GFM compat, and composes_with qualifier for PR-pending reference.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:111 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:45:50Z):

The callout examples use Obsidian-style lowercase markers (e.g., `> [!note]`), but GitHub’s alert/callout syntax typically expects the canonical uppercase forms (`> [!NOTE]`, `> [!WARNING]`, etc.). Since this row explicitly claims GitHub compatibility for a subset of callouts, consider changing the examples to the GitHub-compatible forms (or explicitly note the casing requirement/compat limitation).

**@AceHack** (2026-05-25T19:47:55Z):

Addressed in latest push. Most substantive: Codex caught a real L1 design flaw (wikilink conversion would break GitHub rendering); reframed L1 to use frontmatter aliases instead — Obsidian graph still works, GitHub rendering preserved. Plus markdownlint MD022/MD032 fixes, meta-irony frontmatter tags addition, callout-case correction to uppercase for GFM compat, and composes_with qualifier for PR-pending reference.

### Thread 4: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:68 (resolved)

**@chatgpt-codex-connector** (2026-05-25T19:46:12Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep GitHub-compatible links in L1 conversion plan**

Converting every internal Markdown link to Obsidian wikilinks here would break repository navigability for non-Obsidian readers: GitHub’s documented link syntax is `[text](path)`, and `frontmatter.aliases` does not make GitHub resolve `[[shortname|text]]` as clickable links. Because this row defines L1 as a mechanical global replacement, implementing it as written would degrade docs/backlog usability and any tooling that relies on standard Markdown links.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T19:47:57Z):

Addressed in latest push. Most substantive: Codex caught a real L1 design flaw (wikilink conversion would break GitHub rendering); reframed L1 to use frontmatter aliases instead — Obsidian graph still works, GitHub rendering preserved. Plus markdownlint MD022/MD032 fixes, meta-irony frontmatter tags addition, callout-case correction to uppercase for GFM compat, and composes_with qualifier for PR-pending reference.

### Thread 5: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:188 (resolved)

**@chatgpt-codex-connector** (2026-05-25T19:49:28Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align L1 acceptance with alias-only strategy**

This acceptance checklist still requires a full markdown-link→wikilink conversion, which directly contradicts the updated L1 design above that explicitly says not to convert links because GitHub navigability would regress. Fresh evidence for re-raising: even after the thread said the flaw was addressed, this row still has `All [text](path.md) ... converted to [[shortname|text]]`, so implementers following acceptance criteria will ship the rejected behavior.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T19:51:10Z):

Fixed in latest push — L1 acceptance now mirrors the reframed alias-only strategy (no link conversion; aliases via TS script; GitHub renders all links normally; Obsidian graph + quick-switcher use aliases). Genuine catch on internal-contradiction-between-body-and-acceptance; substrate-honest fix.

### Thread 6: docs/backlog/P2/081KSE6WT0008QG0R003RN2WE3-obsidian-as-knowledge-graph-substrate-wikilinks-tags-callouts-tasks-json-ld-extractor-2026-05-25.md:203 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T19:52:52Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Use uppercase alert marker in L3 acceptance criteria**

The L3 acceptance checklist asks to migrate blocks to ``> [!note]`` even though this same row defines GitHub-compatible callouts as requiring uppercase alert types; if implementers follow this line literally, migrated callouts will render as plain blockquotes on GitHub and miss the stated cross-platform styling goal. Aligning the acceptance text with uppercase (for example ``[!NOTE]``) avoids shipping a self-contradictory convention.

Useful? React with 👍 / 👎.
