---
pr_number: 5020
title: "rule(081KSE6WT0008QG0R003YYC9PV)+backlog: agent worktree hygiene \u2014 never hold main + never step on operator + cleanup on PR merge"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:48:49Z"
merged_at: "2026-05-26T01:04:46Z"
closed_at: "2026-05-26T01:04:46Z"
head_ref: "rule/agent-worktree-hygiene-b0750-aaron-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:48:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5020: rule(081KSE6WT0008QG0R003YYC9PV)+backlog: agent worktree hygiene — never hold main + never step on operator + cleanup on PR merge

## PR description

Operator 2026-05-25: 'we need to fix this mess yall always stepping on each other and me constantly'.

Empirical anchor: 37 agent worktrees mass-cleaned same session (081KSE6WT0008QG0R0005XASX2→081KSE6WT0008QG0R001RG4FXD cascade leftovers) + 1 peer worktree holding [main] at stale SHA blocked operator's git checkout main.

Ships:
- .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md (auto-loads at cold-boot)
- 081KSE6WT0008QG0R003YYC9PV backlog row with 5 mechanization scope items

Composes with 081KRMEXM0008QG0R000X1PPGC cron-sentinel-mutex + 081KSE6WT0008QG0R003YYC9PV per-agent-clones architecture (sibling; 081KSE6WT0008QG0R003YYC9PV supersedes the worktree-pool scope item).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T22:52:34Z)

## Pull request overview

This PR lands an operational rule under `.claude/rules/` to prevent multi-agent git worktree contention (especially blocking `main` and interfering with the operator’s primary checkout), and it records the follow-on mechanization targets as a new backlog row (081KSE6WT0008QG0R003YYC9PV) with an index entry in `docs/BACKLOG.md`.

**Changes:**
- Add a new auto-loaded rule: “Agent worktree hygiene — never hold `main`, never step on operator, clean up after PR merge”.
- Add a new P2 backlog row (081KSE6WT0008QG0R003YYC9PV) describing mechanization scope items (cleanup tooling, worktree pool, PR-merge cleanup hook, etc.).
- Add 081KSE6WT0008QG0R003YYC9PV to the main backlog index.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md` | New backlog row capturing the worktree hygiene problem statement + mechanization scope/acceptance criteria. |
| `docs/BACKLOG.md` | Adds 081KSE6WT0008QG0R003YYC9PV to the P2 backlog index. |
| `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` | New operational rule documenting required agent worktree discipline and concrete audit/cleanup commands. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T00:51:40Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 8 comments.

### COMMENTED — @AceHack (2026-05-26T00:52:38Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T00:52:39Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T00:52:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T00:52:43Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T01:04:51Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:152 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:52:33Z):

The “Verify operator can checkout main” check is described as “should show ONLY operator's primary”, but if the operator’s primary worktree is *not* on `main` (common), this grep will return no lines even though things are fine. This can mislead the cleanup/audit flow; the check should instead assert that **no agent worktree** holds `[main]` (i.e., zero matches, or at most one match if the operator intentionally has `main` checked out).

**@AceHack** (2026-05-26T00:52:38Z):

Fixed in 018adea1: replaced the grep with a no-agent-holds-main invariant check that doesn't false-negative when operator's primary is on a feature branch. Corrected snippet filters for /private/tmp/zeta- or /tmp/zeta- paths holding [main].

### Thread 2: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:119 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:52:33Z):

This rule references “PR #4530 / saturation-ceiling sub-cases” but provides no link or in-repo pointer. Since PR numbers aren’t verifiable from the repo alone, this cross-reference is likely to drift; consider linking to the PR URL and/or to an archived doc under `docs/pr-preservation/` / `docs/pr-discussions/` if one exists.

**@AceHack** (2026-05-26T00:52:39Z):

Fixed in 018adea1: added direct PR URL plus cross-pointer to claim-acquire-before-worktree-work.md saturation-ceiling sub-cases for the durable in-repo anchor.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md:66 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:52:33Z):

Scope item 2 (“Worktree-pool primitive”) appears to overlap heavily with the already-open backlog row **081KRQ1AB0008QG0R001KQ9S4B** (worktree-pool primitive per Otto identity, composes with 081KRMEXM0008QG0R000X1PPGC). To reduce backlog drift, this row should either (a) explicitly compose with / supersede 081KRQ1AB0008QG0R001KQ9S4B and describe what’s new here, or (b) narrow Scope item 2 to the delta that isn’t already covered by 081KRQ1AB0008QG0R001KQ9S4B.

**@AceHack** (2026-05-26T00:52:41Z):

Fixed in 018adea1: Scope item 2 now explicitly composes-with-or-supersedes 081KRQ1AB0008QG0R001KQ9S4B (existing Otto-only worktree-pool row at docs/backlog/P3/081KRQ1AB0008QG0R001KQ9S4B-...md). Delta named as multi-agent generalization (Otto + Alexa + Riven + Vera + Lior + future).

### Thread 4: docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md:66 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:52:34Z):

PR description mentions a sibling “081KSE6WT0008QG0R003YYC9PV per-agent-clones architecture” that supersedes the worktree-pool scope item, but this PR doesn’t add any 081KSE6WT0008QG0R003YYC9PV row and this backlog row still lists a worktree-pool primitive as in-scope. Either add/mention 081KSE6WT0008QG0R003YYC9PV here (and mark the pool item superseded/deferred), or drop the 081KSE6WT0008QG0R003YYC9PV supersedes claim from the PR description to keep description vs shipped artifacts consistent.

**@AceHack** (2026-05-26T00:52:43Z):

Fixed in 018adea1: 081KSE6WT0008QG0R003YYC9PV (per-agent-clones architecture) named in Scope item 2 as potential superseder, and added to Composes-with-backlog-substrate section with substrate-honest framing that the row may not yet exist on main but if filed separately retires Scope item 2.

### Thread 5: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:68 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:38Z):

P0: Markdown line starts with `+` inside the nested list under “Merges”, which Markdown parsers treat as a `+`-style sub-list item (and markdownlint MD004/ul-style will often fail). Reword the continuation line so it doesn’t begin with `+` (e.g., “and the branch …”).

### Thread 6: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:188 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:38Z):

P0: This paragraph continuation line begins with `+`, which will be parsed as a list item (and can trigger markdownlint MD004/ul-style / change the rendered structure). Reflow the sentence so the line does not start with `+`.

### Thread 7: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:38Z):

P1: The rule hard-codes the operator’s local absolute checkout path (including username). This isn’t portable across machines and leaks operator-specific filesystem details into a reusable rule; prefer a placeholder (e.g., `<OPERATOR_PRIMARY_CHECKOUT>`) and/or guidance like “the operator’s primary checkout (the repo root from `git rev-parse --show-toplevel`)”.

### Thread 8: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:68 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:39Z):

P1: Rule 3 recommends `git worktree remove --force <path>` on merge/close. `--force` will discard uncommitted changes if the worktree isn’t clean (easy to hit in practice). Prefer `git worktree remove <path>` and only use `--force` after an explicit clean check (or document the data-loss tradeoff).

### Thread 9: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:39Z):

P2: Inline reference `holding-without-named-dependency-is-standing-by-failure` is missing the stable path/extension. Use the full `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (consistent with the later “Composes with other rules” list) to keep xref integrity.

### Thread 10: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:188 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:39Z):

P1 (codebase convention): This `.claude/rules/**` file introduces persona/contributor names in narrative prose (e.g., “Otto-VSCode”, “Lior”, “Riven”, “Vera”). Per the repo’s “No name attribution in code, docs, or skills” operational rule (docs/AGENT-BEST-PRACTICES.md:671-686), current-state surfaces like rules should use role references or neutral identifiers instead.

### Thread 11: docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md:81 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:39Z):

P1: This backlog row includes the operator’s absolute local checkout path with username (`/Users/acehack/...`). Even on history surfaces, this is machine-specific and potentially sensitive; consider redacting to a placeholder (e.g., `<OPERATOR_PRIMARY_CHECKOUT>`) or `~/.../Zeta` while keeping the invariant being enforced (don’t create worktrees under operator checkout).

### Thread 12: docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md:66 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T00:51:39Z):

P2: PR description says a sibling 081KSE6WT0008QG0R003YYC9PV “supersedes the worktree-pool scope item”, but this backlog row still lists “Scope item 2 — Worktree-pool primitive” without noting supersession. Either add the superseded-by note here (or drop the scope item) or adjust the PR description so they don’t contradict.

### Thread 13: docs/backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md:14 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:04:51Z):

P1 (codebase convention / xref integrity): This row lists `081KSE6WT0008QG0R003YYC9PV` in `composes_with`, but there is no `docs/backlog/**` row with `id: 081KSE6WT0008QG0R003YYC9PV` in the repo, so this becomes a dangling cross-reference. Either land the 081KSE6WT0008QG0R003YYC9PV row in the same PR, or remove `081KSE6WT0008QG0R003YYC9PV` from `composes_with` and refer to it as a not-yet-filed / external PR-only concept (with a concrete URL) to keep the backlog graph navigable.

### Thread 14: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:213 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:04:51Z):

P1 (codebase convention): This current-state rules file includes a named attribution in narrative prose ("i'm stuck (max)…"). Per `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills”, `.claude/rules/**` should use role-refs (e.g., “the operator” / “the human maintainer”) and keep named quotes on allowlisted history surfaces instead (e.g., `docs/backlog/**` / `docs/research/**`).

### Thread 15: .claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md:173 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:04:51Z):

The “Verify no agent worktree holds `[main]`” snippet says “Should print no lines”, but the command explicitly prints `OK: no agent holds [main]` on the success path. Either update the comment to match the behavior (or remove the `echo` so the snippet truly prints nothing when OK).

## General comments

### @chatgpt-codex-connector (2026-05-25T22:48:54Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
