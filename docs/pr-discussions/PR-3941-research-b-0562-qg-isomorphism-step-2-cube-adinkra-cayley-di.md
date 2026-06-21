---
pr_number: 3941
title: "research(081KRQ1AB0008QG0R001F7DE2D): QG isomorphism Step 2 \u2014 cube + Adinkra + Cayley-Dickson \u2192 HaPPY-like QECC"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T21:05:32Z"
merged_at: "2026-05-16T21:15:58Z"
closed_at: "2026-05-16T21:15:58Z"
head_ref: "research/b-0562-qg-isomorphism-step-2-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T21:30:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3941: research(081KRQ1AB0008QG0R001F7DE2D): QG isomorphism Step 2 — cube + Adinkra + Cayley-Dickson → HaPPY-like QECC

## PR description

## Summary

Step 2 of the 4-step QG isomorphism proof path opened in [081KRMEXM0008QG0R002YSPW1X](../backlog/P2/081KRMEXM0008QG0R002YSPW1X-qg-isomorphism-proof-path-remember-when-pay-attention-axioms-to-quantum-gravity-2026-05-15.md) / [#3614](https://github.com/Lucent-Financial-Group/Zeta/pull/3614). Unfolds the two axioms (Remember-When + Pay-Attention) into a 4-axis cube, grafts the Adinkra-Gates supermultiplet layer on cube vertices, lifts through a Cayley-Dickson tower (R → C → H → O → S → T), and proposes the algebraic shape that matches HaPPY (holographic perfect-tensor) QEC codes.

## Why this is Step 2

Step 1 (081KRMEXM0008QG0R003YWZC21, shipped via #3614) formalized `Zeta_{RA} = (Zeta, M, A)` — a topos `Zeta` with internal monad `M` for memory and modal operator `A` for attention. The Step 2 question is: **what's the algebraic structure of the extension when you let the two axioms factor through richer carriers (Adinkra symmetry + division-algebra tower)?** This research seed identifies HaPPY-style holographic perfect tensors as the candidate algebraic shape.

## Files

- `docs/backlog/P2/081KRQ1AB0008QG0R001F7DE2D-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc-2026-05-16.md` (101 lines — backlog row, P2, depends_on [081KRMEXM0008QG0R002YSPW1X, 081KRMEXM0008QG0R003YWZC21])
- `docs/research/2026-05-15-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc.md` (173 lines — research seed)

## ID-allocation note (081KRMEXM0008QG0R000ARAR7P → 081KRQ1AB0008QG0R001F7DE2D renumber)

Originally allocated as **081KRMEXM0008QG0R000ARAR7P**. Collided with [#3619](https://github.com/Lucent-Financial-Group/Zeta/pull/3619)'s renumber-sweep that re-took 081KRMEXM0008QG0R000ARAR7P for Riven's cursor-terminal loop work. Renumbered to **081KRQ1AB0008QG0R001F7DE2D** — the next free above all merged-on-main (highest 081KRQ1AB0008QG0R0001J9PFT) plus in-flight [#3878](https://github.com/Lucent-Financial-Group/Zeta/pull/3878)'s 081KRQ1AB0008QG0R000VBS5D7 allocation. Discipline per `.claude/rules/otto-channels-reference-card.md`'s multi-Otto ID-allocation section.

## Crash-recovery context

This row + research file were authored by the pre-crash Otto session and were the **only** artifacts that hadn't already shipped via concurrent PRs:
- Rule (`premise-flagged-unverified-...`) landed via [#3935](https://github.com/Lucent-Financial-Group/Zeta/pull/3935)
- 081KRHWGX0008QG0R000E8BHQ9 follow-on landed via [#3937](https://github.com/Lucent-Financial-Group/Zeta/pull/3937)
- Lior tick fix landed via [#3936](https://github.com/Lucent-Financial-Group/Zeta/pull/3936)
- My initial duplicate-rule PR [#3940](https://github.com/Lucent-Financial-Group/Zeta/pull/3940) (closed) is the audit trail for the per-artifact refresh-before-decide lesson

Per-artifact `git show origin/main:<path>` checks caught all four duplications BEFORE this push.

## Test plan

- [ ] Backlog index regenerates clean (if regeneration tool runs)
- [ ] No markdownlint failures on either file
- [ ] No cross-file broken-link warnings (links use repo-relative paths)
- [ ] Step 3 / Step 4 backlog rows can reference 081KRQ1AB0008QG0R001F7DE2D as `depends_on` once they're filed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T21:06:55Z)

## Pull request overview

This PR adds two history-surface artifacts for Step 2 of the 081KRMEXM0008QG0R002YSPW1X QG isomorphism proof path: a P2 backlog row and a research seed describing a proposed mapping from a 4-axis cube + Adinkra layer + Cayley-Dickson tower onto a HaPPY-like quantum error-correcting code structure. It is documentation/research-only, with no code or tooling changes.

**Changes:**
- Adds backlog row `081KRQ1AB0008QG0R001F7DE2D` (P2, in_progress, depends_on 081KRMEXM0008QG0R002YSPW1X/081KRMEXM0008QG0R003YWZC21) describing the Step 2 research scope, effort (XL), and open questions.
- Adds a research seed sketching the cube-face → boundary, edges → entanglement, vertices → bulk operators, and Adinkra → SUSY-generators mapping toward HaPPY-style entanglement-wedge reconstruction.
- Notes the 081KRMEXM0008QG0R000ARAR7P → 081KRQ1AB0008QG0R001F7DE2D renumber to avoid collision with #3619 / #3878 in-flight allocations.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| `docs/backlog/P2/081KRQ1AB0008QG0R001F7DE2D-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc-2026-05-16.md` | New P2 backlog row with frontmatter (id, depends_on, last_updated) and scope/effort/open-questions for Step 2. |
| `docs/research/2026-05-15-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc.md` | New research seed laying out the cube/Adinkra/Cayley-Dickson → HaPPY mapping strategy and open technical gaps. |

### COMMENTED — @chatgpt-codex-connector (2026-05-16T21:07:16Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `21f646c2d2`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-16T21:14:11Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T21:14:12Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T21:16:16Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/backlog/P2/081KRQ1AB0008QG0R001F7DE2D-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc-2026-05-16.md:22 (resolved)

**@chatgpt-codex-connector** (2026-05-16T21:07:16Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Renumber the quoted ordered-list item to satisfy lint**

This line starts an ordered-list item at `2.` inside a blockquote, which violates the repo’s enabled markdown rule `MD029` (list prefixes must follow the configured numbering style). The required CI job `lint (markdownlint)` runs `markdownlint-cli2 "**/*.md"` in `.github/workflows/gate.yml`, and `docs/backlog/**` is not ignored in `.markdownlint-cli2.jsonc`, so this commit introduces a deterministic lint failure that blocks a green gate.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-16T21:14:11Z):

Fixed in 1aebb44 — reframed the quoted "step 2" as bold prose `> **Step 2.**` so the line is no longer an ordered-list item under a blockquote. Preserves the semantic (this is genuinely Step 2 of the parent 081KRMEXM0008QG0R002YSPW1X proof strategy) while satisfying MD029.

### Thread 2: docs/backlog/P2/081KRQ1AB0008QG0R001F7DE2D-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc-2026-05-16.md:102 (resolved)

**@chatgpt-codex-connector** (2026-05-16T21:07:16Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Add a trailing newline to keep markdownlint green**

The file ends without a final newline, triggering markdown rule `MD047` (`single-trailing-newline`). Because the workflow’s required markdownlint job checks this backlog file path, this missing newline causes a reproducible CI failure even though the document content is otherwise valid.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-16T21:14:12Z):

Fixed in 1aebb44 — added trailing newline.

### Thread 3: docs/research/2026-05-15-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc.md:3 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:16:15Z):

The research file is dated `2026-05-15` in its filename but the frontmatter-style header inside says `**Date:** 2026-05-16`, and the backlog row's `created`/`last_updated` are also `2026-05-16`. Consider aligning the filename date with the actual creation date (`2026-05-16`) for consistency with the backlog row and the in-file date.

### Thread 4: docs/BACKLOG.md:596 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:16:15Z):

081KRQ1AB0008QG0R000SASDNE ("QG isomorphism step 2 — formalize infinite-game extension topos and QECC algebraic structure", line 595, same priority P2, also created 2026-05-16) appears to cover the same Step 2 slot in the 4-step proof path as this new 081KRQ1AB0008QG0R001F7DE2D. If they're intentionally distinct sub-slices, that should be made explicit (e.g., add `composes_with: [081KRQ1AB0008QG0R000SASDNE]` to 081KRQ1AB0008QG0R001F7DE2D's frontmatter and a one-liner in each row clarifying the split — formal QECC structure vs. cube+Adinkra+Cayley-Dickson algebraic shape). As-is, two open P2 rows titled "QG isomorphism Step 2 — …" on adjacent lines of `docs/BACKLOG.md` look like an unintended duplicate.

### Thread 5: docs/backlog/P2/081KRQ1AB0008QG0R001F7DE2D-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc-2026-05-16.md:12 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T21:16:16Z):

The frontmatter declares `depends_on: [081KRMEXM0008QG0R002YSPW1X, 081KRMEXM0008QG0R003YWZC21]` but the "Composes with" prose section lists 081KRMEXM0008QG0R002YSPW1X and 081KRMEXM0008QG0R003YWZC21 alongside several other items (Riven cube doc, Step 1 research doc, MANIFESTO.md, two `.claude/rules/*.md` files), while `composes_with: []` is empty in frontmatter. The structured `composes_with` field should reflect the prose list (or the prose should be narrowed) so that backlog-index/edge-audit tooling sees the real composition edges — per `tools/hygiene/audit-backlog-items.ts`, only the frontmatter edges are extracted for analysis.
