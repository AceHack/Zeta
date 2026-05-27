---
pr_number: 5108
title: "preserve(mika): Aaron + Mika 2026-05-26 homelab-first gh-auth-login device-registration substrate; production bootstrap-key-rotation deferred (informs B-0794 iter-5.4)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T06:06:23Z"
merged_at: "2026-05-26T06:12:10Z"
closed_at: "2026-05-26T06:12:10Z"
head_ref: "otto-cli/preserve-mika-homelab-gh-auth-registration-substrate-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5108: preserve(mika): Aaron + Mika 2026-05-26 homelab-first gh-auth-login device-registration substrate; production bootstrap-key-rotation deferred (informs B-0794 iter-5.4)

## PR description

Verbatim Mika preservation. Architectural lock-in: HOMELAB MODE FIRST (gh auth login interactive; no shipped keys); PROD MODE LATER (narrow bootstrap key + rotate to per-node identity). Different USBs / different flakes / different audiences. Aaron standing direction: 'we should do it like this for gh and device registration the simple homelab way first but like prod later'. Directly informs B-0794 iter-5.4 implementation. Per substrate-or-it-didn't-happen + agent-roster-reference-card (Mika = external Grok-native co-originator).

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T06:08:43Z)

## Pull request overview

This PR preserves a Mika/Aaron conversation as durable memory substrate for the homelab-first GitHub-auth device registration direction feeding B-0794 iter-5.4.

**Changes:**
- Adds a verbatim conversation archive for the 2026-05-26 homelab-first registration decision.
- Captures homelab vs production bootstrap-mode implications.
- Links the conversation to B-0794 and the iter-5.x USB-installer roadmap.

## Review threads

### Thread 1: memory/persona/mika/conversations/2026-05-26-aaron-mika-grok-homelab-first-gh-auth-login-device-registration-no-shipped-keys-vs-prod-bootstrap-key-rotation.md:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:08:43Z):

P1: This new memory/conversation file skips the YAML frontmatter block used by the surrounding persona conversation archives and required by the memory format standard (`memory/project_memory_format_standard.md:16-27`). Add frontmatter before the H1 with at least retrievable `name`, `description`, and conversation metadata so indexing/validation can discover this preservation entry consistently.

### Thread 2: memory/persona/mika/conversations/2026-05-26-aaron-mika-grok-homelab-first-gh-auth-login-device-registration-no-shipped-keys-vs-prod-bootstrap-key-rotation.md:136 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T06:08:43Z):

P1: These backlog cross-references mark B-0792, B-0793, and B-0794 as `MERGED`, but the row files currently have `status: open` (`docs/backlog/P1/B-0792-...md:4`, `B-0793-...md:4`, and `B-0794-...md:4`). Reconcile the wording with the backlog state, or update the row statuses if the intended meaning is that the backlog items are complete.

## General comments

### @chatgpt-codex-connector (2026-05-26T06:06:28Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
