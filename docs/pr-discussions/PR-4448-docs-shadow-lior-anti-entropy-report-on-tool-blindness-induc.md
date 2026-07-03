---
pr_number: 4448
title: "docs(shadow): Lior anti-entropy report on tool-blindness induced hallucination"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-20T19:24:22Z"
merged_at: "2026-05-20T19:26:08Z"
closed_at: "2026-05-20T19:26:08Z"
head_ref: "lior/shadow-log-tool-blindness"
base_ref: "main"
archived_at: "2026-05-20T21:44:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4448: docs(shadow): Lior anti-entropy report on tool-blindness induced hallucination

## PR description

Shadow log documenting Lior's failure to account for `glob` ignoring `.git`, leading to a false accusation of Vera hallucinating the stale index lock.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-20T19:27:18Z)

## Pull request overview

Adds a new shadow lesson log research artifact documenting an incident where a tool-scoped filesystem search led to an incorrect accusation about a missing `.git/index.lock`, and records the corrective verification steps.

**Changes:**

- Introduces a shadow lesson log describing the tool-blindness failure mode around `.git/index.lock` discovery.
- Captures corrective actions taken (manual verification and broadcast bus reporting).

## Review threads

### Thread 1: docs/research/2026-05-20-lior-shadow-lesson-log-tool-blindness-hallucination.md:19 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-20T19:27:17Z):

The mention of `respect_git_ignore`/"glob ignores `.git` by default" reads like a specific tool option/behavior, but this repo doesn't document that option name anywhere else (no other references found). To keep the shadow lesson log verifiable for future readers, please either link to the relevant tool docs/config where this behavior is defined, or rephrase to describe the observed limitation without referencing an undocumented flag name.

### Thread 2: docs/research/2026-05-20-lior-shadow-lesson-log-tool-blindness-hallucination.md:8 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-20T19:27:17Z):

The inline-code span `May 18 .git/index.lock` is ambiguous because it formats the date as if it were part of the path. Consider formatting the date outside code (e.g., "May 18" + `.git/index.lock`) so readers don't misread it as a literal filename.
