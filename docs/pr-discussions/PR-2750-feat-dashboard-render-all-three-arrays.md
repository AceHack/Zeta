---
pr_number: 2750
title: "feat(dashboard): render all three arrays"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:29:08Z"
merged_at: "2026-05-11T20:33:09Z"
closed_at: "2026-05-11T20:33:09Z"
head_ref: "feat/b-0416-dashboard-three-arrays"
base_ref: "main"
archived_at: "2026-05-11T21:19:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2750: feat(dashboard): render all three arrays

## PR description

Added tabs for Agent Array, Human Anchor Array, and External Reviewers, rendering data directly into the WOW UI.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:35:37Z)

## Pull request overview

Adds a tabbed navigation to the static WOW dashboard so it can render the Agent Array, Human Anchor Array, and External Reviewers as separate views, alongside documenting the Human Anchor Array and archiving several recent PR discussions.

**Changes:**

- Introduces nav tabs + two new tab panels (“Human Anchors”, “External Reviewers”) and renders static anchor/reviewer lists in `demo/index.html`.
- Adds a new `docs/HUMAN-ANCHOR-ARRAY.md` document describing the Human Anchor Array and the “Three Arrays”.
- Adds new PR discussion archive entries under `docs/pr-discussions/` and appends new catch logs in the shadow lesson log memory file.

### Reviewed changes

Copilot reviewed 8 out of 8 changed files in this pull request and generated 9 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| memory/feedback_shadow_lesson_log_otto_catches_2026_05_07.md | Appends Catch 34/35 entries to the shadow lesson log. |
| docs/pr-discussions/PR-2745-feat-b-0402-integrate-pr-preservation-script-into-lior-backg.md | Adds a new PR discussion archive entry for PR #2745. |
| docs/pr-discussions/PR-2743-feat-b-0401-lior-s-wow-ui-glassmorphism-upgrade-for-dashboar.md | Adds a new PR discussion archive entry for PR #2743. |
| docs/pr-discussions/PR-2742-feat-b-0414-metrics-json-generator-agent-readable-dashboard.md | Adds a new PR discussion archive entry for PR #2742. |
| docs/pr-discussions/PR-2741-feat-backlog-b-0414-dashboard-v0-2-agent-json-dual-pm-perspe.md | Adds a new PR discussion archive entry for PR #2741. |
| docs/HUMAN-ANCHOR-ARRAY.md | Introduces the Human Anchor Array doc + “Three Arrays” definitions. |
| demo/index.html | Adds tabs and static rendering for Human Anchors + External Reviewers alongside existing dashboard content. |
</details>


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**demo/index.html:842**

* P0 (operational_implications): `loadDashboard()` makes 3 unauthenticated GitHub API requests per refresh (`commits`, `pulls?state=open`, `pulls?state=closed`). With the current auto-refresh behavior elsewhere in this file, this will exceed GitHub’s 60-requests/hour unauthenticated limit and cause frequent 403/rate-limit failures. Consider increasing the interval, adding an auth token, and/or implementing rate-limit-aware backoff/caching (ideally consuming a pre-generated `demo/metrics.json` instead of hitting the API directly).
```
        async function loadDashboard() {
            try {
                const [commits, openPRs, closedPRs] = await Promise.all([
                    apiFetch(`${API}/commits?per_page=100`),
                    apiFetch(`${API}/pulls?state=open&per_page=50`),
                    apiFetch(`${API}/pulls?state=closed&sort=updated&direction=desc&per_page=50`)
                ]);
```
</details>

## Review threads

### Thread 1: demo/index.html:561 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:35Z):

P1 (accessibility): The tab UI uses `<div class="nav-tab" onclick=...>` elements, which are not keyboard-focusable by default and don’t expose button/tab semantics to assistive tech. Use semantic controls (`<button>`, or `role="tab"` + `tabindex="0"` + keyboard handlers + `aria-selected`/`aria-controls`) so tabs can be operated without a mouse.

### Thread 2: demo/index.html:618 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:35Z):

P1 (accessibility): `<ul id="agent-list">` contains a `<div class="loading-state">` child, which is invalid list markup and can confuse screen readers/CSS list semantics. Replace the placeholder with an `<li>` or change the container element to a `<div>` if the children aren’t list items.

### Thread 3: demo/index.html:628 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:36Z):

P1 (accessibility): `<ul id="pr-list">` contains a `<div class="loading-state">` child, which is invalid inside a list. Use an `<li>` placeholder instead, or change the container element to a `<div>` to match the intended semantics.

### Thread 4: demo/index.html:707 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:36Z):

P1 (codebase_conventions): This current-state UI surface (`demo/index.html`) hard-codes contributor/persona first-names in `AGENT_MAP` (and later in the anchor/reviewer arrays). Per the “No name attribution in code, docs, or skills” operational rule, current-state surfaces should use role-refs instead of names (docs/AGENT-BEST-PRACTICES.md:671-728). Please switch these identifiers to role-based labels (e.g., `human-maintainer`, `agent-claude-code`, `agent-grok`, etc.) and keep any name↔role mapping on an allowed history surface if needed.

### Thread 5: demo/index.html:610 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:36Z):

P2 (maintainability): This inline layout style makes the page harder to keep consistent over time (spacing/layout changes require editing HTML). Prefer a CSS class for this flex+gap column so layout is centralized in the stylesheet.

### Thread 6: docs/HUMAN-ANCHOR-ARRAY.md:6 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:36Z):

P1 (codebase_conventions): This file is a current-state doc under `docs/`, but it contains many direct person names. Repo operational standing rule is that names belong only on the enumerated history/research surfaces and elsewhere should use role-refs (docs/AGENT-BEST-PRACTICES.md:671-728). Either (a) move this content to an allowed history/research surface, or (b) rewrite it using role-refs / non-attributed labels so it matches the convention.

### Thread 7: docs/pr-discussions/PR-2745-feat-b-0402-integrate-pr-preservation-script-into-lior-backg.md:6 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:37Z):

P1 (codebase_conventions): `docs/pr-discussions/**` is being used as a PR conversation archive (and is even markdownlint-ignored), but the “No name attribution…” operational rule’s explicit history-surface allowlist does not currently include `docs/pr-discussions/**` (docs/AGENT-BEST-PRACTICES.md:671-710). As written, that makes the names in this archive (e.g., `author: "AceHack"`) a rule violation. Either add `docs/pr-discussions/**` to the allowlist, or relocate archives under an already-allowed history surface.

### Thread 8: docs/HUMAN-ANCHOR-ARRAY.md:17 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:37Z):

P1 (documentation): Several “Anchor file” paths here don’t exist in the repo, so the table can’t be followed as-written. For example `src/Zeta.Core/` isn’t present (repo has `src/Core/`), and `tools/tlaplus/` isn’t present (TLA+ content appears under `tools/tla/`). Please update these paths to real locations so the cross-references are reliable.

### Thread 9: demo/index.html:715 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:35:37Z):

P1 (documentation): The CS anchors list uses placeholder/nonexistent paths (e.g., `src/Zeta.Core/`, `.claude/rules/...greenfield.md`, `tools/tlaplus/`). Since these are displayed as concrete “anchor” locations, please change them to the actual repo paths (`src/Core/`, `.claude/rules/all-complexity-is-accidental-in-greenfield.md`, `tools/tla/` etc.) to avoid misleading readers.

## General comments

### @chatgpt-codex-connector (2026-05-11T20:29:12Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
