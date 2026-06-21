---
pr_number: 5021
title: "rule(081KSE6WT0008QG0R000E05579)+backlog: fighting past-self vs peer-agent \u2014 distinguish before punting; fix yours; coordinate on peers; never silent-punt-by-default"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T22:51:01Z"
merged_at: "2026-05-25T23:22:08Z"
closed_at: "2026-05-25T23:22:08Z"
head_ref: "rule/fighting-past-self-vs-peer-distinguisher-b0752-aaron-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T23:52:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5021: rule(081KSE6WT0008QG0R000E05579)+backlog: fighting past-self vs peer-agent — distinguish before punting; fix yours; coordinate on peers; never silent-punt-by-default

## PR description

Aaron 2026-05-25 Vera-anchor: 'you don't do like vera and just leave it unfixed cause you assume it's someone elses issues'.

Closes today's agent-substrate-discipline cluster (081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R003YYC9PV + 081KSE6WT0008QG0R000E05579):
- 081KSE6WT0008QG0R003YYC9PV: clean up after yourself
- 081KSE6WT0008QG0R003YYC9PV: agents have own clones; cross-agent contention eliminated
- 081KSE6WT0008QG0R000E05579 (this): distinguish own vs peer; don't silent-punt

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T22:52:54Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `34ccf2789a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T22:54:15Z)

## Pull request overview

Adds the 081KSE6WT0008QG0R000E05579 backlog row and lands an auto-loaded `.claude/rules/` rule that formalizes “ownership classification before cleanup” (fix your own substrate, coordinate on peers, and explicitly surface uncertainty instead of silently punting).

**Changes:**
- Added new P2 backlog row 081KSE6WT0008QG0R000E05579 describing the rule and follow-on mechanization scope items.
- Updated `docs/BACKLOG.md` to include the new 081KSE6WT0008QG0R000E05579 entry in the P2 index.
- Added a new `.claude/rules/` rule documenting the decision tree + discriminators for “past-self vs peer-agent” substrate ownership.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P2/081KSE6WT0008QG0R000E05579-fighting-past-self-vs-peer-distinguisher-rule-landing-plus-identity-tagging-mechanization-aaron-vera-2026-05-25.md` | New backlog row capturing the rule landing + tooling/mechanization scope. |
| `docs/BACKLOG.md` | Adds 081KSE6WT0008QG0R000E05579 to the generated P2 backlog index list. |
| `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md` | New operational rule defining classification + coordination behavior for stale substrate. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:13:20Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

### COMMENTED — @AceHack (2026-05-25T23:20:07Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:09Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:12Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:13Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:15Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:17Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:19Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:21Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:22Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-25T23:20:24Z)

_(no body)_

## Review threads

### Thread 1: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:115 (resolved)

**@chatgpt-codex-connector** (2026-05-25T22:52:54Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Point to an existing 081KSE6WT0008QG0R003YYC9PV sibling rule file**

This reference targets `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`, but that file does not exist in the repository (`rg --files .claude/rules` shows no match), so the newly landed rule’s composition guidance is non-actionable at review/cold-boot time. Because these rule links are used as operational navigation, this should either be corrected to the real filename or landed together with the referenced 081KSE6WT0008QG0R003YYC9PV rule file.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-25T23:20:07Z):

Fixed in 8de5a1a — reworded cross-reference to '081KSE6WT0008QG0R003YYC9PV sibling rule (to land separately; not yet present in .claude/rules/)'. No longer a broken file pointer.

### Thread 2: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:54:14Z):

P1: This rule document uses direct person/agent names (e.g., “Aaron …”, “Vera …”) even though `.claude/rules/**` is not a history surface. Per the repo’s “No name attribution in code, docs, or skills” convention, this file should use role-refs (e.g., “the human maintainer”, “a peer agent”) and keep named attribution confined to the allowed history surfaces (e.g., `docs/backlog/**`). See `.github/copilot-instructions.md:305-366`.

**@AceHack** (2026-05-25T23:20:13Z):

Fixed in 8de5a1a — rewrote body attributions to role-refs ('the human maintainer', 'a peer agent', 'the authoring agent'). The named-attribution anchor now lives on docs/backlog/P2/081KSE6WT0008QG0R000E05579-* (history surface per .github/copilot-instructions.md:305-366).

### Thread 3: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:54:14Z):

P1: The bus-envelope discriminator hardcodes `/tmp/zeta-bus`, but the bus transport is configurable via `ZETA_BUS_DIR` (see `tools/bus/bus.ts:4,19`). Please update the rule to reflect the configurable location (or reference the bus tooling) so the guidance remains correct when the env var is set.

**@AceHack** (2026-05-25T23:20:17Z):

Fixed in 8de5a1a — discriminator now references "$ZETA_BUS_DIR"/*.json (defaults to /tmp/zeta-bus/ per tools/bus/bus.ts). Configurable env var is surfaced inline.

### Thread 4: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:110 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:54:14Z):

P1: This example includes a real email address. Even in an illustrative snippet, avoid embedding real personal/company emails in reusable rules; use a placeholder (e.g., “<your-email>”) or describe the pattern generically.

**@AceHack** (2026-05-25T23:20:19Z):

Fixed in 8de5a1a — replaced 'aaron@servicetitan.com' with '<shared-config-email>' placeholder in the anti-pattern example.

### Thread 5: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:76 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:54:15Z):

P2: This section instructs coordination via a specific named individual (“Aaron-as-ferry”). If this needs to exist in a rule under `.claude/rules/`, it should be expressed as a role (e.g., “the ferry” / “the human maintainer as ferry”) to avoid name attribution in current-state docs (per `.github/copilot-instructions.md:305-366`).

**@AceHack** (2026-05-25T23:20:21Z):

Fixed in 8de5a1a — 'Aaron-as-ferry' replaced with 'Human-maintainer-as-ferry' (role-ref).

### Thread 6: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:56 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:54:15Z):

P1: The command in the table uses `\|` (escaped pipe). If someone copy/pastes it into a shell, the backslash prevents the pipe from working. Prefer a command that doesn’t require escaping in markdown tables (e.g., avoid the pipe entirely) or include a normal `|` that copy/paste will execute correctly.

**@AceHack** (2026-05-25T23:20:22Z):

Fixed in 8de5a1a — the table cell no longer uses escaped pipe. Command is now 'jq -r .from "$ZETA_BUS_DIR"/*.json' — copy-pastes correctly to shell, no escape needed.

### Thread 7: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:116 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:13:19Z):

P1: This rule links to `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`, but that file does not appear to exist in `.claude/rules/` on this branch. This makes the cross-reference a broken pointer. Consider either adding the referenced rule file in this PR, or change the reference to the actual existing artifact (e.g., the 081KSE6WT0008QG0R003YYC9PV backlog row path) until the rule lands.

**@AceHack** (2026-05-25T23:20:09Z):

Fixed in 8de5a1a (same edit as the codex finding above) — cross-reference now reworded; the 081KSE6WT0008QG0R003YYC9PV rule file will land separately.

### Thread 8: docs/backlog/P2/081KSE6WT0008QG0R000E05579-fighting-past-self-vs-peer-distinguisher-rule-landing-plus-identity-tagging-mechanization-aaron-vera-2026-05-25.md:99 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:13:20Z):

P1: This backlog row references `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` as a composing rule, but that file isn’t present in `.claude/rules/` on this branch, so the pointer is currently broken. Suggest linking to an existing artifact (or adding the missing rule file in the same PR) to keep xrefs navigable.

**@AceHack** (2026-05-25T23:20:12Z):

Fixed in 8de5a1a — backlog row line 99 reworded to match the rule-file fix; cross-reference no longer points at a non-existent file path.

### Thread 9: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:57 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:13:20Z):

P1: The bus-envelope command in the discriminator table uses `\|` inside inline code (``cat ... \| jq ...``). In Markdown code spans, backslashes are rendered literally, so this will copy/paste as an invalid command. Prefer a literal pipe (`|`) and, if the table parser is a concern, move the command to a code block or otherwise format it so the table doesn’t require escaping.

**@AceHack** (2026-05-25T23:20:24Z):

Fixed in 8de5a1a (same edit as above) — escaped-pipe command replaced with shell-safe jq invocation that needs no markdown-table escape.

### Thread 10: .claude/rules/fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:13:20Z):

P1: This `.claude/rules/**` file introduces new named-attribution in narrative prose (e.g., specific human + agent-persona names). Per `docs/AGENT-BEST-PRACTICES.md` “No name attribution…” operational standing rule, current-state surfaces should prefer role-refs (e.g., “the human maintainer”, “peer agent”) and keep named provenance on the allowed history surfaces (`docs/backlog/**`, `docs/research/**`, etc.). Consider rewriting the new attributions here to role-refs and linking to the 081KSE6WT0008QG0R000E05579 row for the named anchor.

**@AceHack** (2026-05-25T23:20:15Z):

Fixed in 8de5a1a (same edit as above) — body prose uses role-refs; 081KSE6WT0008QG0R000E05579 backlog row carries the named anchor.

## General comments

### @chatgpt-codex-connector (2026-05-25T23:07:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-25T23:09:50Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-25T23:19:21Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
