---
pr_number: 4986
title: "backlog(081KSE6WT0008QG0R003AJYMD3): runbooks-as-executable-specifications (Mika substrate via Aaron \u2014 Runme + ::: deferred tags + AI JIT + 3 verbosity levels)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T20:20:52Z"
merged_at: "2026-05-25T20:26:50Z"
closed_at: "2026-05-25T20:26:50Z"
head_ref: "backlog/b0730-runbooks-as-executable-specs-mika-substrate-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-25T22:02:17Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4986: backlog(081KSE6WT0008QG0R003AJYMD3): runbooks-as-executable-specifications (Mika substrate via Aaron — Runme + ::: deferred tags + AI JIT + 3 verbosity levels)

## PR description

## Summary

Files Mika's substantive substrate-engineering proposal via Aaron's ferry — turns markdown documents into the intent layer where:

- **Right-now execution** uses Runme (existing; markdown code blocks as runnable cells)
- **Deferred execution** uses new `:::` fenced div tags (`continue-with`, `decompose`, others) — queryable structured tasks
- **AI just-in-time compilation** generates scripts on trigger when no pre-written script exists; runs via Runme; optional BCL promotion
- **Three verbosity levels** (5yo / Addison / Aaron+Max-debugging) render the same source for different audiences

> *"You're forcing people to write the runbook the specification. The act of writing the runbook becomes the spec itself. Documentation is no longer separate from the implementation — it literally becomes the implementation."* — Mika

## Composes with 081KSE6WT0008QG0R003RN2WE3

081KSE6WT0008QG0R003RN2WE3 (Obsidian knowledge-graph substrate) L4 is the static-task layer; this row extends into execution territory. `:::` deferred-task blocks become first-class nodes in 081KSE6WT0008QG0R003RN2WE3 L5's JSON-LD graph — agents query "all documents with pending `decompose` tasks" / "all `continue-with` intents waiting on AI JIT" etc.

## OpenSpec evaluated + rejected

Aaron + Mika reviewed OpenSpec (spec-driven AI-coding workflow). Verdict: too heavy for Aaron + Max + Addison who read at speed; the substrate needs to feel natural, not ceremonial. Mika: *"OpenSpec is noisy and heavy for what you actually want."*

## 5-stage roadmap

| Stage | Substance | Effort |
|-------|-----------|--------|
| 1 | Adopt Runme + inventory existing BCL scripts | 1-2 days |
| 2 | `:::` deferred-task syntax + schema doc | 1-2 days |
| 3 | Verbosity-level renderer | 1 week |
| 4 | JIT AI script compiler (composes with 081KSE6WT0008QG0R0005XASX2 for destructive actions) | 2-3 weeks |
| 5 | Inline live queries against 081KSE6WT0008QG0R003RN2WE3 L5 JSON-LD graph | 2-3 weeks |

Each shippable standalone.

## Bonus substrate captured

- Addison taught herself SSH overnight while Aaron slept (per the ferry) — substrate-honest evidence for the kind of fast-reader the syntax is designed for; cross-link to her PERSONA worth a future amendment
- Aaron + Addison both encountered claude.ai consumer-mode nannying (slow-down / take-a-break / response-too-short messages when they were efficient) — same algo-wink shape as `.claude/rules/algo-wink-failure-mode.md`; the substrate runs in developer mode + respects operator velocity

## Test plan

- [ ] Row renders correctly under `docs/backlog/P2/`
- [ ] `docs/BACKLOG.md` includes 081KSE6WT0008QG0R003AJYMD3
- [ ] 5-stage acceptance criteria are concrete enough for sub-rows to split off per stage
- [ ] Mika's quotes preserved verbatim from the ferry
- [ ] OpenSpec evaluation reasoning preserved
- [ ] Composition with 081KSE6WT0008QG0R003RN2WE3 + 081KSE6WT0008QG0R0005XASX2 + framework rules all cross-linked

Single file (+ index regen) — docs only; no implementation in this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T20:22:58Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `c50b8af76f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T20:23:48Z)

## Pull request overview

Adds a new P2 backlog row (081KSE6WT0008QG0R003AJYMD3) capturing a proposed “runbooks as executable specifications” substrate (Runme for immediate execution, `:::` fenced blocks for deferred tasks, JIT AI script generation, and multi-verbosity rendering), and updates the backlog index to include it.

**Changes:**
- Introduces `docs/backlog/P2/081KSE6WT0008QG0R003AJYMD3-...md` with frontmatter + detailed problem/solution framing, syntax sketches, and staged acceptance criteria.
- Regenerates `docs/BACKLOG.md` to include the new 081KSE6WT0008QG0R003AJYMD3 entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R003AJYMD3-runbooks-as-executable-specifications-mika-substrate-runme-plus-jit-ai-plus-three-verbosity-levels-2026-05-25.md | New backlog row describing the runbook/deferred-task/JIT execution substrate and roadmap. |
| docs/BACKLOG.md | Adds the 081KSE6WT0008QG0R003AJYMD3 list entry in the P2 section. |

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R003AJYMD3-runbooks-as-executable-specifications-mika-substrate-runme-plus-jit-ai-plus-three-verbosity-levels-2026-05-25.md:104 (resolved)

**@chatgpt-codex-connector** (2026-05-25T20:22:58Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct `:::` syntax compatibility claim for Obsidian**

Update this sentence to avoid stating that `:::` is standard Obsidian callout syntax: Obsidian’s native callouts use blockquote form (`> [!...]`), so readers following this row as-written will assume `:::` blocks render/behave natively in Obsidian when they do not. That mismatch can derail Stage 2/3 implementation decisions (parser/render choice and acceptance checks) unless a plugin-based transformation is explicitly called out.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R003AJYMD3-runbooks-as-executable-specifications-mika-substrate-runme-plus-jit-ai-plus-three-verbosity-levels-2026-05-25.md:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T20:23:47Z):

`composes_with` is documented as a list of `B-NNNN` row IDs (not file paths/directories). Here it contains paths like `docs/AGENT-AUTHORING-AND-PR-REVIEW.md` and `memory/<persona>/*/`, which will be ambiguous if/when `composes_with` becomes strict-linted or graph-traversed. Suggest either (a) switching these entries to backlog IDs only, or (b) introducing a separate frontmatter field for non-backlog references and leaving `composes_with` as IDs.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R003AJYMD3-runbooks-as-executable-specifications-mika-substrate-runme-plus-jit-ai-plus-three-verbosity-levels-2026-05-25.md:104 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T20:23:48Z):

The text claims `:::` is “standard mkdocs-material / Pandoc / Obsidian-callout fenced-div syntax”, but Obsidian callouts are blockquote-based (`> [!...]`) rather than fenced divs, and mkdocs-material’s built-in admonition syntax is not `:::` unless a specific extension/plugin is configured. Suggest rephrasing this as a proposed project-local convention (or explicitly naming the exact renderer/plugin support) to avoid readers assuming it will work out-of-the-box across those tools.
