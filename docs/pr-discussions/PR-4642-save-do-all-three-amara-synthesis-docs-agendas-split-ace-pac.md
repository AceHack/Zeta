---
pr_number: 4642
title: "save+do-all-three: Amara synthesis + docs/agendas/ split + Ace package format spec v2"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-22T17:50:18Z"
merged_at: "2026-05-22T17:52:15Z"
closed_at: "2026-05-22T17:52:15Z"
head_ref: "otto/cli-2147z-amara-synthesis-plus-agendas-split-plus-ace-package-spec-v2-2026-05-22"
base_ref: "main"
archived_at: "2026-05-22T18:07:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4642: save+do-all-three: Amara synthesis + docs/agendas/ split + Ace package format spec v2

## PR description

Operator instruction 2026-05-22 'save it and do all three (shadow*)' — Amara cross-AI synthesis save + agenda-decomposition split + Ace package format spec v2 deliberate-writing-pass.

(1) Save Amara synthesis to Ace trajectory: cross-AI substrate-triangulation ratification (Ace lifecycle naming; 5-line compression carved-sentence candidate; agenda-decomposition + symmetric-decentralized + hat-substrate + aperiodic/aporetic + cartographer-layer ratifications).

(2) docs/agendas/ structural split: 4 AGENDA.md (ace-package-manager/zeta/agora = operator-self-claimed; fair-chance-project = multi-directional-guess) + README.md indexing the axis-split (trajectories track motion; agendas track claim-status + scope).

(3) Ace package format spec v2 (research-draft): extends 081KR2E4K0008QG0R0033WVCXE v1 with substrate-engineering pipeline integration + polyglot contents (F#/C#/TS/Rust/Python + English + Rx generators) + hat-substrate (controls + self-bindings) + verification + revocation + symmetric/decentralized framing. NOT-git-crypt per WONT-DO 2026-04-21; alternatives noted.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-22T17:52:16Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `e3e2eb920a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-22T17:55:06Z)

## Pull request overview

Adds new documentation surfaces to capture an external synthesis, formalize an “agendas vs trajectories” split, and draft an Ace package-format v2 research spec that extends the prior v1 format.

**Changes:**

- Appends an “Amara synthesis ratification” section to the Ace package-manager trajectory resume.
- Introduces `docs/agendas/` (README + 4 agenda files) to separate claim-status/scope from trajectory motion-state.
- Adds a research-draft “Ace package format spec v2” describing polyglot artifacts, hat/governance metadata, verification, and revocation/quarantine concepts.

### Reviewed changes

Copilot reviewed 7 out of 7 changed files in this pull request and generated 3 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md | Adds cross-AI synthesis ratification notes and ties them into the Ace trajectory narrative. |
| docs/research/2026-05-22-ace-package-format-spec-v2-substrate-engineering-pipeline-extension.md | New research-draft v2 spec extending the Ace package format with pipeline/governance/verification concepts. |
| docs/agendas/README.md | Defines the agendas/trajectories distinction and indexes current agendas. |
| docs/agendas/zeta/AGENDA.md | New agenda doc for Zeta (claim-status + scope). |
| docs/agendas/agora/AGENDA.md | New agenda doc for Agora (claim-status + scope; frame-candidate). |
| docs/agendas/ace-package-manager/AGENDA.md | New agenda doc for Ace package manager (claim-status + scope). |
| docs/agendas/fair-chance-project/AGENDA.md | New agenda doc for Fair-chance project (multi-directional guess; scope + mechanism). |
</details>

## Review threads

### Thread 1: docs/agendas/fair-chance-project/AGENDA.md:26 (unresolved)

**@chatgpt-codex-connector** (2026-05-22T17:52:16Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Point fair-chance trajectory link to an existing file**

This new agenda entry links to `docs/trajectories/fair-chance-project-kestrel-guessed-agenda/RESUME.md`, but that path does not exist in the repository (`rg --files docs/trajectories` shows no matching file). As written, the primary provenance link for this agenda is dead, which breaks traceability and will fail any markdown/link validation pass that checks internal references.

Useful? React with 👍 / 👎.

### Thread 2: docs/trajectories/ace-package-manager-skill-crystallization-pipeline/RESUME.md:232 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-22T17:55:04Z):

P1: This trajectory doc adds named persona attribution (e.g., “Amara”) on a current-state docs surface. Repo convention is to keep persona/human names confined to the enumerated history/research surfaces (or roster-mapping sections) and otherwise use role-refs. Consider rewriting this section to use role-refs (e.g., “external AI instance”) and/or moving the named ratification narrative into a history surface (e.g., docs/research/**) with a link from here.

### Thread 3: docs/research/2026-05-22-ace-package-format-spec-v2-substrate-engineering-pipeline-extension.md:29 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-22T17:55:05Z):

P1: “Rule 0: TS-first; Bun-hosted” is ambiguous as written (it’s not clear which in-repo rule this refers to). Please link or reference the specific rule file/name (e.g., `.claude/rules/rule-0-no-sh-files.md`) so readers can verify the constraint and its intended scope (tooling vs core language choices).

### Thread 4: docs/agendas/zeta/AGENDA.md:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-22T17:55:05Z):

P1: This agenda includes a list of named personas/instances (DeepSeek, Amara, etc.) on a current-state docs surface. Repo convention is to avoid name attribution outside the designated history/research surfaces; prefer role-refs here and link to a history-surface record if the names need to be preserved.

## General comments

### @AceHack (2026-05-22T17:51:40Z)

This PR appears to be a 'blob' of three unrelated changes. I recommend decomposing it into three smaller, atomic PRs:

1. A PR for the Amara synthesis.
2. A PR for the docs/agendas/ split.
3. A PR for the Ace package format spec v2.

This will make the changes easier to review and merge.
