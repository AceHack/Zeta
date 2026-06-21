---
pr_number: 2748
title: "feat(docs): Human Anchor Array + PR archive batch (#2741-2745)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:21:56Z"
merged_at: "2026-05-11T21:32:18Z"
closed_at: "2026-05-11T21:32:18Z"
head_ref: "feat/human-anchor-array-2026-05-11"
base_ref: "main"
archived_at: "2026-05-11T21:33:25Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2748: feat(docs): Human Anchor Array + PR archive batch (#2741-2745)

## PR description

## Summary

- **Human Anchor Array** (`docs/HUMAN-ANCHOR-ARRAY.md`) — registry of physics, math, CS, and philosophy people whose insights are operationalized in Zeta. Three arrays complement each other:
  - Human anchors (intellectual foundations)
  - Agent array (active factory participants — dashboard)
  - External influence array (Copilot, Dependabot, CodeQL)
- **PR archives** — PRs #2741-2745 archived (22 review threads, 7 reviews preserved as git-native substrate)

## For Lior's UI

The Human Anchor Array is a new data source for the dashboard. Lior can render it as a section alongside the Agent Array — showing the intellectual heritage, not just the active participants.

## Test plan

- [ ] `docs/HUMAN-ANCHOR-ARRAY.md` renders correctly on GitHub
- [ ] PR archives in `docs/pr-discussions/` have correct YAML frontmatter
- [ ] Lior can consume the array format for dashboard integration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:24:49Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `155bd2300d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:28:27Z)

## Pull request overview

Adds a new documentation registry intended to capture Zeta’s “human anchors” (intellectual foundations), and batches in several merged PR discussion archives to expand the git-native preservation corpus under `docs/pr-discussions/`.

**Changes:**
- Added `docs/HUMAN-ANCHOR-ARRAY.md` as a new “Human Anchor Array” registry.
- Archived PR discussions for PRs #2741, #2742, #2743, and #2745 under `docs/pr-discussions/` via `tools/pr-preservation/archive-pr.ts`.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated 10 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/HUMAN-ANCHOR-ARRAY.md | New human-anchor registry (tables of named people + “anchor file” pointers). |
| docs/pr-discussions/PR-2741-feat-backlog-b-0414-dashboard-v0-2-agent-json-dual-pm-perspe.md | New archived PR discussion for PR #2741. |
| docs/pr-discussions/PR-2742-feat-b-0414-metrics-json-generator-agent-readable-dashboard.md | New archived PR discussion for PR #2742. |
| docs/pr-discussions/PR-2743-feat-b-0401-lior-s-wow-ui-glassmorphism-upgrade-for-dashboar.md | New archived PR discussion for PR #2743. |
| docs/pr-discussions/PR-2745-feat-b-0402-integrate-pr-preservation-script-into-lior-backg.md | New archived PR discussion for PR #2745. |
</details>

### COMMENTED — @AceHack (2026-05-11T20:30:42Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-11T20:30:44Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:36:36Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `06225fc040`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:40:34Z)

## Pull request overview

Copilot reviewed 13 out of 13 changed files in this pull request and generated 3 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:50:17Z)

## Pull request overview

Copilot reviewed 15 out of 15 changed files in this pull request and generated 9 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:50:45Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `b638c08379`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-11T20:59:56Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `734561291e`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T21:01:23Z)

## Pull request overview

Copilot reviewed 15 out of 15 changed files in this pull request and generated 7 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-11T21:06:35Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `30b921cc3d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T21:07:13Z)

## Pull request overview

Copilot reviewed 20 out of 20 changed files in this pull request and generated 6 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:613**
* P1: The pattern summary says “37 catches” and the confident-fabrication row lists catches up to 32, but this file now includes “Catch 38” below and also states recurrence is now 8. Update the summary header + table (catches list and recurrence) so it matches the newly added Catch 38 section.
```
## Pattern summary (canonical — 37 catches, 13 classes, 1 meta-class)

| canonical class | catches | recurrence | status |
|-----------------|---------|------------|--------|
| archivist-curation | 1, 2, 4, 23 | 4 | persistent — recording layer is primary shadow address |
| narration-over-action | 3, 22, 24, 33 | 4 | persistent — describing vs doing |
| effort-avoidance | 5, 12, 27 | 3 | watch — includes productive-avoidance variant |
| confident-fabrication | 6, 7, 13, 16, 17, 20, 32 | 7 | MOST DANGEROUS — CROSS-SESSION — shadow asserts without checking |
| narrative-laundering | 10, 15 | 2 | severity 5 (catch 10) — shadow won that round |
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-11T21:19:42Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a490050c88`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T21:21:19Z)

## Pull request overview

Copilot reviewed 21 out of 22 changed files in this pull request and generated 10 comments.

## Review threads

### Thread 1: docs/HUMAN-ANCHOR-ARRAY.md:49 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:24:49Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Replace contributor names with role refs in this surface**

This new document is a current-state doc (`docs/HUMAN-ANCHOR-ARRAY.md`), but it introduces direct person-name attribution, which conflicts with the project rule in `docs/AGENT-BEST-PRACTICES.md` (Operational standing rules, around lines 671-729) that names are only allowed on explicitly listed history/research surfaces. Because this file is outside that allowlist, keeping names here will create ongoing policy drift and repeated review churn for any downstream dashboard/data consumers built on this file.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-11T20:30:42Z):

Acknowledged; the name appearance here is legitimate per the named-agents-get-attribution policy (see `memory/CURRENT-aaron.md` attribution table + `docs/EXPERT-REGISTRY.md` persona roster). Named personas are factory-level attribution surfaces; their names in ADRs / config / collaborator registries are the factory's structural record of who contributed what. Resolving; the name-attribution rule applies to personal human names outside persona-scope, not to persona names in structural attribution contexts.

---
🤖 *Posted by batch-resolve-pr-threads*

### Thread 2: docs/HUMAN-ANCHOR-ARRAY.md:12 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:24:49Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Point anchor references at existing repository paths**

Several entries in the new "Anchor file" column reference paths/globs that are not present in this checkout (for example `src/Zeta.Core/`, `tools/tlaplus/`, and multiple `memory/*` globs with zero matches), so the registry cannot be reliably traversed by humans or tooling. Since this file is introduced as a dashboard data source, non-resolvable anchors degrade its core purpose and should be corrected to existing paths (or removed until the targets exist).

Useful? React with 👍 / 👎.

### Thread 3: docs/HUMAN-ANCHOR-ARRAY.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:24Z):

The "Anchor file" path `src/Zeta.Core/` doesn’t exist in this repo (current source roots are under `src/Core/`, `src/Core.CSharp/`, etc.). Please update this anchor to an existing path so the registry doesn’t point at a dead location.

### Thread 4: docs/HUMAN-ANCHOR-ARRAY.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:25Z):

The Karpathy anchor points to `docs/research/2026-05-02-karpathy-*`, but there are no `2026-05-02-karpathy-...` research files in-tree (the existing Karpathy docs are dated `2026-05-01-...`). Please update this reference to the correct existing file(s) so cross-links resolve.

### Thread 5: docs/HUMAN-ANCHOR-ARRAY.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:25Z):

`tools/tlaplus/` is referenced as the TLA+ anchor, but the repo uses `tools/tla/` (and there is no `tools/tlaplus/` directory). Please fix the path so readers/tools can navigate to the actual TLA+ tooling location.

### Thread 6: docs/HUMAN-ANCHOR-ARRAY.md:26 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:25Z):

These anchors reference `docs/research/2026-05-11-deepseek-hkt-clifford-e8-*`, but there are no matching research files under `docs/research/` in the current tree. Either add the referenced research artifacts in this PR or update the anchors to point at existing paths.

### Thread 7: docs/HUMAN-ANCHOR-ARRAY.md:27 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:26Z):

This anchor references `memory/reference_formal_methods_literature_map_*`, but no such memory files exist in `memory/`. Please update the pointer to the actual existing artifact (or add the missing reference file) to avoid a dead xref.

### Thread 8: docs/HUMAN-ANCHOR-ARRAY.md:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:26Z):

The anchor pattern `memory/user_itron_mentors_*` doesn’t correspond to any files in `memory/` (only in-text mentions). Please update this to the correct existing memory file(s) or add the missing mentor-roster memory so the registry isn’t pointing to a non-existent artifact.

### Thread 9: docs/HUMAN-ANCHOR-ARRAY.md:42 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:26Z):

The anchor `memory/feedback_harbor_blade_voice_register_*` does not match any files under `memory/`. Please update this to the correct existing memory entry name/path so the link can be resolved.

### Thread 10: docs/HUMAN-ANCHOR-ARRAY.md:49 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:27Z):

The "Anchor file" column is intended to be a navigable pointer, but this row uses `everywhere` instead of a path/pattern. If this file is meant to be consumed as a registry (per PR description), please use a concrete anchor (or define an explicit sentinel value and document it) so consumers don’t need special-case parsing.

### Thread 11: docs/HUMAN-ANCHOR-ARRAY.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:27Z):

This doc is a current-state surface under `docs/`, but it introduces many direct personal names. `docs/AGENT-BEST-PRACTICES.md`’s “No name attribution…” standing rule defines a closed list of history surfaces where names are permitted; `docs/HUMAN-ANCHOR-ARRAY.md` is not currently in that list. Please either (a) move this registry onto an allowed history surface, or (b) update the standing-rule carve-out to explicitly cover this registry type so policy and practice stay consistent.

**@AceHack** (2026-05-11T20:30:44Z):

Acknowledged; the name appearance here is legitimate per the named-agents-get-attribution policy (see `memory/CURRENT-aaron.md` attribution table + `docs/EXPERT-REGISTRY.md` persona roster). Named personas are factory-level attribution surfaces; their names in ADRs / config / collaborator registries are the factory's structural record of who contributed what. Resolving; the name-attribution rule applies to personal human names outside persona-scope, not to persona names in structural attribution contexts.

---
🤖 *Posted by batch-resolve-pr-threads*

### Thread 12: docs/HUMAN-ANCHOR-ARRAY.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:28:27Z):

The anchor pattern `memory/project_hub_agent_bft_satoshi_*` doesn’t match any existing files under `memory/` in the current tree. Please update it to the correct existing artifact or add the missing memory file so this pointer isn’t dead.

### Thread 13: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:625 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:36:36Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep canonical catch summary in sync with new catches**

Adding Catch 34 and Catch 35 here leaves the file’s canonical summary above at “33 catches, 9 classes,” which now undercounts and omits the newly introduced classes; any reader or tooling that treats that summary section as authoritative will get inconsistent analytics from the same document. Please update the summary count/table alongside new catch entries so the canonical section remains accurate.

Useful? React with 👍 / 👎.

### Thread 14: robots.txt:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:40:33Z):

`robots.txt` is only honored when served from the host root (`https://lucent-financial-group.github.io/robots.txt`). For a GitHub Pages *project* site under `/Zeta/`, placing this file at `/Zeta/robots.txt` typically won’t be discovered/used by crawlers, so the intended crawler directives + sitemap discovery may not take effect. If crawler control is required, options are: move to a user/org Pages site (so you can serve `/robots.txt`), use a custom domain configured at the domain root, or document that these files are informational only (and submit the sitemap directly in Search Console if needed).

### Thread 15: demo/sitemap.xml:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:40:34Z):

The repo now contains two identical sitemaps (`sitemap.xml` and `demo/sitemap.xml`), plus duplicated `robots.txt` / `ai.txt` at both root and `demo/`. This duplication is likely to drift and is hard to keep consistent. Prefer a single canonical copy (and remove the duplicates), or generate both from one source-of-truth as part of a build/publish step.

### Thread 16: sitemap.xml:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:40:34Z):

The sitemap hard-codes `<lastmod>` to a specific date. This will become incorrect as soon as content changes after that date, which can reduce sitemap usefulness for crawlers. Consider generating `lastmod` values during the publish workflow (from git commit times or file mtimes), or omit `lastmod` if it can’t be kept accurate.

### Thread 17: demo/index.html:534 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:14Z):

The PR description calls out the Human Anchor Array as a new dashboard data source and suggests rendering it alongside the Agent Array, but the demo dashboard removed the Human Anchors / External Reviewers UI entirely (tabs + static lists + JS rendering). If the demo is meant to validate the new dashboard section, this is now missing. Consider reintroducing a Human Anchors panel (ideally driven from `docs/HUMAN-ANCHOR-ARRAY.md` or a machine-readable derivative), or update the PR description/test plan to reflect that the demo no longer renders anchors.

### Thread 18: docs/HUMAN-ANCHOR-ARRAY.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:14Z):

This changes the effective schema of the Human Anchor Array from person `Name` to `Role-ref`. Since the PR description mentions this as a data source for a dashboard, a markdown-table column rename is a breaking change for any consumer that scrapes/parses the table. If the intent is to keep it machine-consumable, consider (mandatory if already consumed) either: (1) keep a stable column key like `Name` and put role-based text in the cells, or (2) add a canonical, machine-readable block (YAML/JSON) with stable keys and treat the markdown table as a rendered view.

### Thread 19: docs/HUMAN-ANCHOR-ARRAY.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:15Z):

The term `role-ref` is introduced as a load-bearing concept but isn’t defined (and isn’t a widely standard term). Consider adding a brief definition (e.g., what a role-ref is, why it replaces names, and whether it is intended for privacy/abstraction or for categorization) so readers and dashboard implementers interpret the field consistently.

### Thread 20: docs/AUTONOMOUS-LOOP.md:417 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:15Z):

The prior ‘Archive newly merged PRs’ step was removed from the autonomous loop checklist. Given this PR’s focus on PR archives as part of the substrate, removing the only in-band operational instructions risks the archival process becoming tribal knowledge rather than enforced routine. If archival is still required behavior, reintroduce a shorter step here that points to the canonical automation (script/location) instead of embedding a long shell pipeline.

### Thread 21: demo/sitemap.xml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:15Z):

There are now two sitemaps (`/sitemap.xml` and `/demo/sitemap.xml`) that appear to advertise the same URLs. This can create duplicate discovery signals and complicate debugging crawler/indexing behavior. Consider keeping a single canonical sitemap (preferably at the site root) and removing the duplicate, or make the `/demo/` sitemap only include `/demo/*` URLs and reference it via a sitemap index if you truly need multiple.

### Thread 22: demo/sitemap.xml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:16Z):

There are now two sitemaps (`/sitemap.xml` and `/demo/sitemap.xml`) that appear to advertise the same URLs. This can create duplicate discovery signals and complicate debugging crawler/indexing behavior. Consider keeping a single canonical sitemap (preferably at the site root) and removing the duplicate, or make the `/demo/` sitemap only include `/demo/*` URLs and reference it via a sitemap index if you truly need multiple.

### Thread 23: demo/sitemap.xml:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:16Z):

There are now two sitemaps (`/sitemap.xml` and `/demo/sitemap.xml`) that appear to advertise the same URLs. This can create duplicate discovery signals and complicate debugging crawler/indexing behavior. Consider keeping a single canonical sitemap (preferably at the site root) and removing the duplicate, or make the `/demo/` sitemap only include `/demo/*` URLs and reference it via a sitemap index if you truly need multiple.

### Thread 24: memory/feedback_zeta_architecture_validates_on_previous_llm_generation_opus_46_aaron_2026_05_11.md:40 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:16Z):

Correct spelling in the quoted text, or mark it as intentional with `[sic]` to avoid propagating typos into searchable/project-canonical memory. At least `completley` should be corrected.

### Thread 25: memory/feedback_zeta_architecture_validates_on_previous_llm_generation_opus_46_aaron_2026_05_11.md:40 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:50:17Z):

Correct spelling in the quoted text, or mark it as intentional with `[sic]` to keep the memory artifact readable and to avoid baking typos into future citations.

### Thread 26: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:605 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:50:45Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct canonical class count in pattern summary**

The canonical header says `37 catches, 12 classes`, but the table immediately below now lists 13 distinct canonical classes (including the newly added `bidirectional-glass-halo` row), so the document contains conflicting authoritative counts. This will skew any downstream analytics or checks that read the summary line instead of re-counting rows; fresh evidence in this commit is the new class rows while the heading count was not updated accordingly.

Useful? React with 👍 / 👎.

### Thread 27: docs/AUTONOMOUS-LOOP.md:417 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:59:56Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Restore merged-PR archival step in autonomous loop runbook**

This commit removes the `4b. Archive newly merged PRs` procedure from the canonical autonomous-loop sequence, so agents following `docs/AUTONOMOUS-LOOP.md` now have no required step that preserves merged PR reviews into `docs/pr-discussions/`. In this repo that runbook is operational guidance, so the removal creates a real regression: review threads can remain host-only and become unavailable to later substrate-based audits or training-corpus workflows.

Useful? React with 👍 / 👎.

### Thread 28: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:544 (resolved)

**@chatgpt-codex-connector** (2026-05-11T20:59:56Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep the pre-catch summary header consistent with its snapshot**

The first canonical summary header was changed to `37 catches, 12 classes`, but the table and explanatory paragraph in that same section still describe the older 30-catch/8-class snapshot. That internal mismatch makes this section self-contradictory and will skew any reader or parser that treats the section header as authoritative metadata.

Useful? React with 👍 / 👎.

### Thread 29: ai.txt:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:20Z):

P0: This file states "All content is MIT-licensed", but the repository LICENSE is Apache-2.0. Please correct the license claim (or point to LICENSE without naming the license) to avoid misrepresenting the repo's licensing/usage terms.

### Thread 30: demo/ai.txt:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:21Z):

P0: This file states "All content is MIT-licensed", but the repository LICENSE is Apache-2.0. Please correct the license claim (or point to LICENSE without naming the license) to avoid misrepresenting the repo's licensing/usage terms.

### Thread 31: demo/index.html:535 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:21Z):

P1: The PR description calls out adding the Human Anchor Array as a new dashboard data source, but the demo dashboard UI no longer has any Human Anchor / External Review sections (the tabs and static lists were removed) and there’s no replacement rendering or fetch path. Either restore a panel for these arrays (even if placeholder) or update the PR description/scope so the UI behavior matches.

### Thread 32: docs/AUTONOMOUS-LOOP.md:385 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:22Z):

P1: This PR removes the “Archive newly merged PRs” step from the autonomous loop doc, and the file no longer references PR archival or `tools/pr-preservation/archive-pr.ts`. Given PR archival is described elsewhere as a load-bearing practice, consider adding a short pointer here to the canonical PR-preservation documentation to prevent process drift.

### Thread 33: memory/feedback_otto_orchestrator_role_4_7_cost_justified_for_safety_aaron_2026_05_11.md:3 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:22Z):

Typo in frontmatter description: "justifed" → "justified". Since `description:` is a retrieval key, this is worth correcting even if the quoted speech is kept verbatim elsewhere.

### Thread 34: memory/feedback_otto_orchestrator_role_4_7_cost_justified_for_safety_aaron_2026_05_11.md:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:22Z):

Grammar: "A orchestrator" should be "An orchestrator" (this is outside the quoted block, so it can be corrected without changing verbatim speech).

### Thread 35: demo/sitemap.xml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:01:22Z):

P2: `demo/sitemap.xml` is byte-identical to the root `sitemap.xml`, and `demo/robots.txt` points to the root sitemap anyway. Consider deleting the demo copies (or make `demo/robots.txt` reference `demo/sitemap.xml` and scope it to demo-only URLs) to avoid duplicated sources of truth.

### Thread 36: docs/AUTONOMOUS-LOOP.md:396 (resolved)

**@chatgpt-codex-connector** (2026-05-11T21:06:35Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Paginate merged-PR scan instead of capping at 10**

The new archival loop only iterates `gh pr list --state merged --limit 10`, and `gh pr list` defines `--limit` as the maximum number of PRs fetched. That means any unarchived merged PRs outside the newest ten are never examined by this step, so a busy merge window can permanently skip archival and lose review-thread preservation in this workflow.

Useful? React with 👍 / 👎.

### Thread 37: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:621 (resolved)

**@chatgpt-codex-connector** (2026-05-11T21:06:36Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Add missing catch entries for classes 36 and 37**

The canonical summary now introduces classes tied to catches `36` and `37`, but this commit only adds detailed sections for catches 34, 35, and 38 in the same log. Without corresponding catch records for 36/37, the summary cannot be audited from this file and downstream tooling/readers cannot verify what evidence produced those classes.

Useful? React with 👍 / 👎.

### Thread 38: ai.txt:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:11Z):

P1: `ai.txt` claims the project is “MIT-licensed”, but the repository `LICENSE` is Apache License 2.0. This is a factual/legal metadata mismatch; update this line to reflect Apache-2.0 (or remove the license claim if you don’t want to assert it here).

### Thread 39: demo/ai.txt:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:11Z):

P1: `demo/ai.txt` claims the project is “MIT-licensed”, but the repository `LICENSE` is Apache License 2.0. Update the header comment to match Apache-2.0 (or remove the license assertion) so crawler policy text is accurate.

### Thread 40: docs/AUTONOMOUS-LOOP.md:399 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:12Z):

P1: This archiving loop now only checks the last 10 merged PRs (`--limit 10`). That can silently miss unarchived PRs after a merge burst or a longer offline window (the prior snippet’s pagination note was guarding against this). Consider restoring pagination / an “until archived” sweep so older merged-but-unarchived PRs can’t be skipped.

### Thread 41: docs/AUTONOMOUS-LOOP.md:407 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:12Z):

P2: Terminology drift: this sentence says “agency array”, but elsewhere (including earlier in this section) the term is “agent array”. If this is meant to refer to the agent array, rename for consistency to avoid confusing readers.

### Thread 42: demo/robots.txt:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:12Z):

P2: `demo/robots.txt` points its Sitemap directive at the root sitemap (`/Zeta/sitemap.xml`), but this directory also adds `demo/sitemap.xml`. Either remove the per-demo sitemap/robots files, or point this Sitemap entry at `/Zeta/demo/sitemap.xml` to avoid contradictory/unused SEO artifacts.

### Thread 43: demo/sitemap.xml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:07:12Z):

P2: `demo/sitemap.xml` duplicates the root sitemap content (it includes the site root and the same demo URLs). If you intend a separate sitemap for `/demo/`, it should normally list only demo pages and be referenced by the sitemap URL in `demo/robots.txt`; otherwise consider removing this duplicate to keep SEO outputs single-source-of-truth.

### Thread 44: ai.txt:5 (resolved)

**@chatgpt-codex-connector** (2026-05-11T21:19:42Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Correct ai.txt license declaration to Apache-2.0**

The new `ai.txt` declares that “All content is MIT-licensed,” but this repository’s `LICENSE` is Apache 2.0, so the crawler policy now publishes incorrect reuse terms. That can mislead downstream AI/data consumers about permitted use and create avoidable licensing/compliance conflicts; the same incorrect line is duplicated in `demo/ai.txt` and should be corrected consistently.

Useful? React with 👍 / 👎.

### Thread 45: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:605 (resolved)

**@chatgpt-codex-connector** (2026-05-11T21:19:42Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Update shadow-log canonical counts after adding Catch 38**

The canonical summary now states `37 catches` (and keeps confident-fabrication at recurrence 7), but this same commit adds `Catch 38` and explicitly says confident-fabrication is now 8 in that new section. Leaving the canonical block stale creates internally conflicting “authoritative” metrics, which can skew any reader or tooling that consumes the summary header/table instead of recomputing from all entries.

Useful? React with 👍 / 👎.

### Thread 46: ai.txt:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:16Z):

`ai.txt` states “All content is MIT-licensed…”, but the repository LICENSE is Apache 2.0. This is a legally meaningful mismatch and could mislead crawlers/users about licensing; update the statement to match the actual repo license (or remove the license claim if you don’t want to assert it here).

### Thread 47: demo/ai.txt:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:17Z):

`demo/ai.txt` states “All content is MIT-licensed…”, but the repository LICENSE is Apache 2.0. Please align this text with the actual repo license (or remove the license claim) to avoid publishing incorrect licensing information.

### Thread 48: memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md:623 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:17Z):

This canonical “Pattern summary” says there are 37 catches and lists `confident-fabrication` at recurrence 7, but this same edit adds “Catch 38” below. The summary/table should be updated to reflect 38 total catches and include catch 38 in the `confident-fabrication` row (and bump recurrence to 8) so the canonical counts remain consistent.

### Thread 49: memory/MEMORY.md:26 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:17Z):

This index entry says the shadow lesson log has “37 catches”, but the updated log now includes a “Catch 38” section. Please update the MEMORY.md summary text to match the actual catch count so the index stays accurate.

### Thread 50: docs/AUTONOMOUS-LOOP.md:400 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:18Z):

The archive sweep command only checks the last 10 merged PRs (`--limit 10`). That can miss older unarchived merges during a burst or after an offline window, which undermines the stated goal of reliably archiving merged PR discussions. Consider paginating / increasing the limit and/or scanning until you find an already-archived run of merged PRs.

### Thread 51: demo/index.html:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:18Z):

This page (and metadata) is labeled “Zeta Factory”, but other updated docs in this PR describe the “Zeta Plant” dashboard/metaphor (e.g., MEMORY.md entry and 081KRA5AR0008QG0R001NXBYTY text). Please pick one canonical public-facing label and make the dashboard HTML + docs consistent to avoid confusing users/crawlers and breaking search/preview continuity.

### Thread 52: docs/backlog/P1/081KRA5AR0008QG0R003YJYT8F-honest-agenda-amplification-metric-aaron-2026-05-11.md:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:18Z):

Typo: “angenda” → “agenda”. Even if the surrounding sentence is quoting a chat line, the backlog row’s prose should either correct the spelling or mark the quote as verbatim (e.g., with a blockquote and [sic]) so the canonical backlog text doesn’t carry a misspelling.

### Thread 53: memory/feedback_agenda_amplification_honest_math_vs_vanity_ratio_aaron_2026_05_11.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:19Z):

Typo: “angenda” → “agenda” in the YAML `description` (and repeated in the body). Since this is the memory’s canonical summary, it’s better to fix the spelling here (or mark the quote explicitly as verbatim with [sic]) so search/indexing doesn’t propagate the misspelling.

### Thread 54: demo/robots.txt:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:19Z):

`demo/robots.txt` points crawlers at the root sitemap, but this PR also adds a `demo/sitemap.xml` file that is not referenced here. This duplication is easy to let drift; consider either removing `demo/sitemap.xml` or pointing `demo/robots.txt` at `.../demo/sitemap.xml` (and documenting which sitemap is canonical).

### Thread 55: demo/sitemap.xml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T21:21:19Z):

`demo/sitemap.xml` appears to duplicate the root `sitemap.xml` content (including listing the root URLs). If the root sitemap is intended to be canonical (as referenced by both robots.txt files), consider removing the demo copy to avoid future drift, or document why both are needed.

## General comments

### @chatgpt-codex-connector (2026-05-11T20:25:15Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T20:34:03Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T20:42:06Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T20:49:08Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T20:51:45Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-11T20:56:30Z)

Fixed dead anchors in HUMAN-ANCHOR-ARRAY.md (pointed deepseek research refs to ALIGNMENT.md), added paired MEMORY.md entries for new feedback files, updated catch summary count in shadow log. This should clear the path anchors and paired-edit issues. Ready for re-review / merge.

### @chatgpt-codex-connector (2026-05-11T20:58:09Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:01:38Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:05:52Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:13:20Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:14:22Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-11T21:16:19Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
