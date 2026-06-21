---
pr_number: 5131
title: "rule: verify-existing-substrate-before-authoring \u2014 sibling to dep-pin-search-first-authority (3-anchor empirical evidence 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:29:25Z"
merged_at: "2026-05-26T08:37:39Z"
closed_at: "2026-05-26T08:37:39Z"
head_ref: "otto-cli/rule-ext-verify-existing-substrate-before-authoring-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T12:13:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5131: rule: verify-existing-substrate-before-authoring — sibling to dep-pin-search-first-authority (3-anchor empirical evidence 2026-05-26)

## PR description

## Summary

Lands `.claude/rules/verify-existing-substrate-before-authoring.md` as the substrate-authoring-scope sibling to `.claude/rules/dep-pin-search-first-authority.md` (landed earlier today via PR #5126).

Empirically grounded in **3 same-root-cause failures from session 2026-05-26**:

- **Anchor 1**: cascade #4 ISO audit asserted training-data-default `boot/grub/grub.cfg` path (NixOS actually uses isolinux + refind). Blocked 4 ISO builds. Fixed via PR #5125. Covered by `dep-pin-search-first-authority.md`.
- **Anchor 2**: 081KSGS9H0008QG0R001Y9FB62 Ace section authored without reading `docs/agendas/ace-package-manager/AGENDA.md` + project memory + 7+ related backlog rows. The maintainer 2026-05-26: *"that is what ace has been since we first talked about it you just keep forgetting we have substantial backlog around this"*. Fixed via PR #5130.
- **Anchor 3**: 081KSGS9H0008QG0R001Y9FB62 hat/fork-negotiation NOT integrated into architecture even after Anchor 2 correction. The maintainer 2026-05-26: *"i'm assuming you have the hat / fork negoation for ace too"*. Fixed via PR #5130 follow-on commit.

## Same root cause class, different surface

All 3 anchors are "Otto-defaults-to-plausible-but-unverified" — at different surfaces:
- Version pins / path assertions → covered by `dep-pin-search-first-authority.md`
- NEW substrate authoring (backlog rows, rules, skills, agenda entries, architectural framings) → covered by THIS rule
- Existing-rule citation as alibi for action → covered by `fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`

Together the 3 rules cover the surfaces today's empirical evidence shows are vulnerable.

## Operational discipline (per the rule body)

4-step pass before authoring new substrate:
1. Grep across substrate surfaces (agendas + trajectories + backlog + rules + memory + research)
2. READ THE TOP HITS (not just list them)
3. Decide: existing-covers / partial / no-existing
4. Cite the search inline in the new substrate

Auto-loads at cold-boot per wake-time-substrate.

## Test plan

- [x] Single rule file added; no other surface modified
- [x] Cross-references to dep-pin + fighting-past-self + skill-router + grep-substrate-anchors compose cleanly
- [x] 3 empirical anchors preserved with verbatim maintainer quotes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:32:15Z)

## Pull request overview

Adds a new `.claude/rules/` wake-time substrate rule that formalizes a “search and read existing substrate before authoring new substrate” discipline, positioned as the substrate-authoring counterpart to `dep-pin-search-first-authority.md`.

**Changes:**
- Introduces `verify-existing-substrate-before-authoring.md` with a required pre-authoring inventory/search process and an inline checklist template.
- Captures three empirical anchors from 2026-05-26 to justify the rule and keep the motivating evidence present at cold-boot.
- Cross-references existing related rules to clarify composition across surfaces (dep pins, rule-citation failures, substrate authoring).

## Review threads

### Thread 1: .claude/rules/verify-existing-substrate-before-authoring.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:32:14Z):

The “Grep for the topic across substrate surfaces” snippet doesn’t actually grep agenda/trajectory *content* (it only filters directory names), and it also omits `.claude/skills/` even though skills are in-scope later in this rule. Consider switching to a content search over the authoritative files (e.g., `AGENDA.md`, trajectory `RESUME.md`, backlog markdown, rules, skills) so the inventory pass can’t miss substrate just because the directory/filename doesn’t contain the keyword.

### Thread 2: .claude/rules/verify-existing-substrate-before-authoring.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:32:14Z):

The search commands treat `topic` as a regex (`grep -E` / `grep -i`) and also use unquoted glob expansion (`memory/*${topic}*`), which can produce wrong matches or break when the topic contains regex metacharacters or spaces. If the intent is a literal keyword search, use fixed-string matching and a safer approach than `ls`+globs for hits (so the recommended process is reliable across topics).

### Thread 3: .claude/rules/verify-existing-substrate-before-authoring.md:162 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:32:15Z):

The markdown table under “The composition with dep-pin-search-first-authority” uses double leading pipes (`||`), which will render as an unintended empty first column in GitHub Markdown. Use standard table syntax with single leading pipes so the table displays with the intended two columns.

## General comments

### @chatgpt-codex-connector (2026-05-26T08:29:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
