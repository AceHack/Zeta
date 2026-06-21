---
pr_number: 3937
title: "feat(routines): 081KRHWGX0008QG0R000E8BHQ9 and 081KRHWGX0008QG0R002S107P7 cloud-schedule schema definition"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T20:26:45Z"
merged_at: "2026-05-16T20:42:40Z"
closed_at: "2026-05-16T20:42:40Z"
head_ref: "feat/b-0507-b-0508-cloud-routines-schema"
base_ref: "main"
archived_at: "2026-05-16T20:57:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3937: feat(routines): 081KRHWGX0008QG0R000E8BHQ9 and 081KRHWGX0008QG0R002S107P7 cloud-schedule schema definition

## PR description

Delivers slice 1 and 2 of 081KRFA460008QG0R000CYBGKW (Cloud Routines).
- 081KRHWGX0008QG0R000E8BHQ9: Added research doc on cloud routines API, auth, and triggers.
- 081KRHWGX0008QG0R002S107P7: Added cloud-schedule.schema.json, updated install.ts with types, and updated tools/routines/README.md.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T20:29:28Z)

## Pull request overview

Lands slices 1 and 2 of 081KRFA460008QG0R000CYBGKW (Cloud Routines): a research doc capturing the Anthropic Cloud Routines API/auth/trigger surface, plus a schema and TypeScript types laying the groundwork for `cloud-schedule.json` files alongside the existing Desktop `schedule.json`.

**Changes:**
- Adds `tools/routines/cloud-schedule.schema.json` (taskId + trigger oneOf: scheduled/github_event/api, plus repos/connectors/notes).
- Exports `CloudTrigger` and `CloudScheduleResult` types from `tools/routines/install.ts` (no reader/consumer wired yet).
- Adds research doc and closes 081KRHWGX0008QG0R000E8BHQ9/081KRHWGX0008QG0R002S107P7 backlog rows; updates `tools/routines/README.md` to document `cloud-schedule.json`.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated 3 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| tools/routines/cloud-schedule.schema.json | New JSON Schema describing cloud routine config. |
| tools/routines/install.ts | Adds exported `CloudTrigger`/`CloudScheduleResult` types (not yet consumed). |
| tools/routines/README.md | Documents new `cloud-schedule.json` file. |
| docs/research/2026-05-14-cloud-routines-api-auth-registration-surface-b0507.md | 081KRHWGX0008QG0R000E8BHQ9 research write-up. |
| docs/backlog/P1/081KRHWGX0008QG0R000E8BHQ9-...md | Marks 081KRHWGX0008QG0R000E8BHQ9 closed; acceptance criteria checked. |
| docs/backlog/P1/081KRHWGX0008QG0R002S107P7-...md | Marks 081KRHWGX0008QG0R002S107P7 closed; acceptance criteria checked. |
</details>

### COMMENTED — @AceHack (2026-05-16T20:39:36Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T20:39:37Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T20:39:38Z)

_(no body)_

## Review threads

### Thread 1: docs/research/2026-05-14-cloud-routines-api-auth-registration-surface-b0507.md:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T20:29:28Z):

This authored research doc uses a date-prefixed filename (`2026-05-14-...md`), which matches the markdownlint ignore pattern `docs/research/2026-*-*.md`. Per `.markdownlint-cli2.jsonc:90-112`, that pattern is reserved for verbatim courier-protocol ferry absorbs whose lint violations are tolerated because reformatting would break verbatim preservation. This file is authored content (not a verbatim ferry absorb) and will silently skip lint coverage. Consider renaming to a non-date-prefix form (e.g., `cloud-routines-api-auth-registration-surface-b0507.md`) so the doc receives lint coverage.

**@AceHack** (2026-05-16T20:39:36Z):

Resolving no-op per markdownlint 081KQ8P5D0008QG0R002SBGJXX policy. `docs/research/2026-*-*.md` is intentionally broad per `.markdownlint-cli2.jsonc:85-114`: a 2026-05-10 narrowing attempt was empirically wrong (CI revealed 82+ legitimate verbatim-ferry date-prefixed files). Theoretical concern about authored-content silently skipping lint is acknowledged in the policy comment and explicitly accepted as the cost of verbatim-preservation. This authored research doc lands under the broad pattern by design, not by accident.

### Thread 2: tools/routines/cloud-schedule.schema.json:62 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T20:29:28Z):

The schema declares `repos` at two levels: once at the top level (line 56-62, "List of repositories accessible to the routine environment") and once inside the `github_event` trigger branch (line 36-42, "List of GitHub repositories to attach the trigger to"). These two `repos` arrays have different semantics but identical shape and name, which will be confusing to authors of `cloud-schedule.json` — it is unclear when both must be set, whether they must agree, and how a `scheduled` or `api` trigger interacts with top-level `repos`. Consider renaming one (e.g., top-level → `repoAccess` or `availableRepos`, or trigger-level → `triggerRepos`) or removing the duplication if the top-level field is intended to cover the trigger case.

**@AceHack** (2026-05-16T20:39:37Z):

Addressed in 0cbe4e0 via description disambiguation rather than rename. Trigger-scope `trigger.repos` (github_event webhook sources) and runtime-scope top-level `repos` (environment repo-access ACL) now spell out the distinction in their descriptions. Rename was the cleaner long-term choice but would have churned a freshly-authored schema for clarity that documentation supplies more cheaply.

### Thread 3: tools/routines/cloud-schedule.schema.json:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T20:29:28Z):

The schema's top-level `taskId` is `required`, but the exported `CloudScheduleResult` / `CloudTrigger` types do not surface it, and the research doc (lines 38-41) notes the schema should model "trigger" but does not mention a required `taskId`. Authors will hit a validation failure if they omit it, while the directory name already provides the same identity (`syncRoutine` derives taskId from the directory at install.ts:131). Either drop the `required` constraint on `taskId` (make it optional/derived) or document explicitly in the README that `cloud-schedule.json` must duplicate the directory name in `taskId`.

**@AceHack** (2026-05-16T20:39:38Z):

Addressed in 0cbe4e0. Relaxed `taskId` from required to optional and expanded the field description to name the containing directory as authoritative (install.ts:131 derives canonical taskId from `repoRoutinesDir/<id>`). The field is preserved for self-documentation and for cloud-side tooling that consumes `cloud-schedule.json` without filesystem layout (per the install.ts comment header). `CloudScheduleResult` deliberately omits taskId for the same reason.

## General comments

### @chatgpt-codex-connector (2026-05-16T20:26:49Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
