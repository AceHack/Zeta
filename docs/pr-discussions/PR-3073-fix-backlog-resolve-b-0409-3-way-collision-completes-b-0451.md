---
pr_number: 3073
title: "fix(backlog): resolve 081KRA5AR0008QG0R000Y6102S 3-way collision \u2014 completes 081KRFA460008QG0R00308W7FJ substrate-hygiene sweep"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T00:20:55Z"
merged_at: "2026-05-14T00:39:35Z"
closed_at: "2026-05-14T00:39:35Z"
head_ref: "fix/b0409-3way-collision-renumber-amara-and-wallet-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T00:55:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3073: fix(backlog): resolve 081KRA5AR0008QG0R000Y6102S 3-way collision — completes 081KRFA460008QG0R00308W7FJ substrate-hygiene sweep

## PR description

## Summary

Fifth and **FINAL** per-collision cleanup from the [081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) sweep. Three rows shared `id: 081KRA5AR0008QG0R000Y6102S`:

| Row | Filed | Scope |
|---|---|---|
| P1 wallet-immune-system | 2026-05-11 10:48 [#2709](https://github.com/Lucent-Financial-Group/Zeta/pull/2709) | Wallet immune system spec (L-effort) |
| P2 amara-persona-bootstrap | 2026-05-11 10:34 [#2704](https://github.com/Lucent-Financial-Group/Zeta/pull/2704) | 081KQDTYV0008QG0R0037YJPEX amara series atomic child |
| P2 peer-call-ts-audit | 2026-05-11 10:58 [#2706](https://github.com/Lucent-Financial-Group/Zeta/pull/2706) | 081KQDTYV0008QG0R001VJP216 peer-call series atomic child |

## Resolution: keep peer-call series at 081KRA5AR0008QG0R000Y6102S

Per external-references rule (canonical per [#3066](https://github.com/Lucent-Financial-Group/Zeta/pull/3066) procedure):

- [081KQDTYV0008QG0R001VJP216 frontmatter](docs/backlog/P2/081KQDTYV0008QG0R001VJP216-peer-call-architecture-refactor-script-per-cli-persona-flag-2026-04-30.md) has `children: [081KRA5AR0008QG0R000Y6102S, 081KRA5AR0008QG0R0035N4S6C, 081KRA5AR0008QG0R000C3P8KP, ...]` AND `depends_on: [081KRA5AR0008QG0R000Y6102S, 081KRA5AR0008QG0R0035N4S6C, ...]` — strongest references
- 081KQDTYV0008QG0R0037YJPEX has body-text mentions only (editable here)
- Wallet-immune-system has no incoming refs from other rows (composes_with 081KR2E4K0008QG0R00009QQJM/081KR2E4K0008QG0R000YH9DC6 point FROM the wallet row, not TO it)

→ Keep peer-call 081KRA5AR0008QG0R000Y6102S. Renumber others to **081KRA5AR0008QG0R0019Q33F7 + 081KRA5AR0008QG0R001JWYYHE** (bumped past PR #3070's 081KRHWGX0008QG0R000TVGDGV/0460/0461 reservation for 081KRFA460008QG0R002DG8KPZ slice 5+):

```
amara-persona-bootstrap 081KRA5AR0008QG0R000Y6102S → 081KRA5AR0008QG0R0019Q33F7  (completes amara series — 081KRA5AR0008QG0R0035N4S6C → 081KRA5AR0008QG0R000KKJRVA, 081KRA5AR0008QG0R000C3P8KP → 081KRA5AR0008QG0R001X4T9W7 already in PR #3069)
wallet-immune-system 081KRA5AR0008QG0R000Y6102S → 081KRA5AR0008QG0R001JWYYHE
```

## Chain remap

[#3069](https://github.com/Lucent-Financial-Group/Zeta/pull/3069) left `081KRA5AR0008QG0R000KKJRVA.depends_on: [081KRA5AR0008QG0R000Y6102S]` pointing at the soon-to-be-renumbered amara 081KRA5AR0008QG0R000Y6102S. This PR remaps it to `[081KRA5AR0008QG0R0019Q33F7]` (and updates the body-text reference per Codex+Copilot round-1 catch).

081KQDTYV0008QG0R0037YJPEX parent body §Decomposition section updated to point at new IDs.

## Empirical effect — CASCADE COMPLETE

```
$ bun tools/bg/audit-duplicate-row-ids.ts
audit-duplicate-row-ids: 561 rows with id field, no duplicate IDs
```

**Down from 12 duplicate-ID groups at session start to 0 on main.**

[081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) cleanup progress: **11/12 → 12/12 — sweep complete.**

## Session-arc cascade rounds

| Round | PR | What | Groups |
|---|---|---|---|
| 1 | [#3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053) | 081KRFA460008QG0R001SXP0C2 P1+P2 | 12 → 11 |
| 2 | [#3057](https://github.com/Lucent-Financial-Group/Zeta/pull/3057) | 081KRA5AR0008QG0R001JVT5FX | 11 → 10 |
| 3 | [#3058](https://github.com/Lucent-Financial-Group/Zeta/pull/3058) | 081KDVJT3E008QG0R003GV8BHV-4 batch | 10 → 6 |
| 4 | [#3065](https://github.com/Lucent-Financial-Group/Zeta/pull/3065) | 081KR2E4K0008QG0R000ARCH0X-0373 P2 batch | 6 → 3 |
| 5 | [#3069](https://github.com/Lucent-Financial-Group/Zeta/pull/3069) | 081KRA5AR0008QG0R0035N4S6C-081KRA5AR0008QG0R000C3P8KP amara batch | 3 → 1 |
| **6** | **(this PR)** | **081KRA5AR0008QG0R000Y6102S 3-way (final) → 081KRA5AR0008QG0R0019Q33F7/081KRA5AR0008QG0R001JWYYHE** | **1 → 0** |

## Round-1 reviewer catch already addressed

Initial commit on this branch picked 081KRHWGX0008QG0R000TVGDGV/081KRHWGX0008QG0R001E9KEJ1 (next-free at the time). PR #3070 then merged and reserved 081KRHWGX0008QG0R000TVGDGV/0460/0461 for 081KRFA460008QG0R002DG8KPZ. Bumped to 081KRA5AR0008QG0R0019Q33F7/081KRA5AR0008QG0R001JWYYHE in commit `13f285f`. Tick shards in this PR document both the initial plan and the bump.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:22:59Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `cc20e7c95b`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:23:40Z)

## Pull request overview

Resolves the final `081KRFA460008QG0R00308W7FJ` duplicate backlog-row ID collision by ensuring `id: 081KRA5AR0008QG0R000Y6102S` is uniquely owned by the peer-call series row (081KQDTYV0008QG0R001VJP216 child), and renumbering the other two colliding rows to new IDs while updating cross-references and the generated backlog index.

**Changes:**

- Renumbered the 081KQDTYV0008QG0R0037YJPEX child “amara persona bootstrap” from `081KRA5AR0008QG0R000Y6102S` → `081KRHWGX0008QG0R000TVGDGV` and recorded renumber provenance in frontmatter.
- Renumbered the wallet immune system row from `081KRA5AR0008QG0R000Y6102S` → `081KRHWGX0008QG0R001E9KEJ1` and recorded renumber provenance in frontmatter.
- Updated dependent references (e.g., 081KRA5AR0008QG0R000KKJRVA `depends_on`) and regenerated `docs/BACKLOG.md` to reflect the new IDs.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KRHWGX0008QG0R000TVGDGV-amara-persona-bootstrap-preamble-definition-ts-first-riven-2026-05-11.md | Updates `id` to `081KRHWGX0008QG0R000TVGDGV` and adds renumber provenance metadata. |
| docs/backlog/P2/081KRA5AR0008QG0R000KKJRVA-amara-ts-core-openai-api-invoke-flag-parity-ts-first-riven-2026-05-11.md | Remaps `depends_on`/`composes_with` to the renumbered preamble row (`081KRHWGX0008QG0R000TVGDGV`). |
| docs/backlog/P2/081KQDTYV0008QG0R0037YJPEX-amara-peer-call-headless-cli-bootstrap-end-courier-debt-2026-04-30.md | Updates decomposition section to reference `081KRHWGX0008QG0R000TVGDGV` and the new child set. |
| docs/backlog/P1/081KRHWGX0008QG0R001E9KEJ1-wallet-immune-system-vaccine-spread-poucc-spec.md | Updates `id` to `081KRHWGX0008QG0R001E9KEJ1`, adds `last_updated`, and records renumber provenance metadata. |
| docs/BACKLOG.md | Regenerates index entries to remove old `081KRA5AR0008QG0R000Y6102S` links and add `081KRHWGX0008QG0R001E9KEJ1`/`081KRHWGX0008QG0R000TVGDGV`. |
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:29:00Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `13f285fd59`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-14T00:29:06Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:29:10Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:30:54Z)

## Pull request overview

Copilot reviewed 7 out of 7 changed files in this pull request and generated 2 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:41:59Z)

## Pull request overview

Copilot reviewed 8 out of 8 changed files in this pull request and generated no new comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P1/081KRA5AR0008QG0R001JWYYHE-wallet-immune-system-vaccine-spread-poucc-spec.md:14**

* The `renumbered_reason` states there were "No incoming references to wallet-immune-081KRA5AR0008QG0R000Y6102S from other rows" (beyond composes_with 081KR2E4K0008QG0R00009QQJM/081KR2E4K0008QG0R000YH9DC6), but there are still backlog rows that reference `081KRA5AR0008QG0R000Y6102S` (e.g., `docs/backlog/P2/081KRA5AR0008QG0R003DVPANH-...` and `docs/backlog/P2/081KRA5AR0008QG0R0021SSM9R-...` both have `composes_with: [081KRA5AR0008QG0R000Y6102S]`). After this renumber, those references now resolve to the peer-call audit row, which is likely incorrect. Please either update those referencing rows to point at `081KRA5AR0008QG0R001JWYYHE` (if they meant the wallet row) and/or adjust this claim so it stays accurate.

</details>

## Review threads

### Thread 1: docs/backlog/P2/081KRA5AR0008QG0R000KKJRVA-amara-ts-core-openai-api-invoke-flag-parity-ts-first-riven-2026-05-11.md:13 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:22:59Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align renumbered dependency with task narrative references**

This row now depends on `081KRHWGX0008QG0R000TVGDGV`, but the task text still instructs implementers to use `081KRA5AR0008QG0R000Y6102S` as the preamble source; after this renumbering, `081KRA5AR0008QG0R000Y6102S` is a different peer-call audit item, so following the current instructions can pull the wrong artifact and break the 081KQDTYV0008QG0R0037YJPEX child-chain intent. Please update the in-body/evidence references in this file to `081KRHWGX0008QG0R000TVGDGV` so metadata and execution guidance stay consistent.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T00:29:05Z):

Fixed in commit `13f285fd`: body references updated to `081KRA5AR0008QG0R0019Q33F7` (renumbered from 081KRA5AR0008QG0R000Y6102S per 081KRFA460008QG0R00308W7FJ sweep). Both the prose and Evidence section are now consistent with the frontmatter `depends_on: [081KRA5AR0008QG0R0019Q33F7]`.

### Thread 2: docs/backlog/P2/081KRA5AR0008QG0R000KKJRVA-amara-ts-core-openai-api-invoke-flag-parity-ts-first-riven-2026-05-11.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:23:40Z):

The body text in this row still refers to the preamble coming from `081KRA5AR0008QG0R000Y6102S` (and the Evidence section lists `081KQDTYV0008QG0R0037YJPEX + 081KRA5AR0008QG0R000Y6102S`), but this PR renumbers that preamble row to `081KRHWGX0008QG0R000TVGDGV` and updates `depends_on`/`composes_with` accordingly. Please update the remaining in-body references so the row stays self-consistent and doesn’t send readers to the wrong backlog ID.

**@AceHack** (2026-05-14T00:29:10Z):

Fixed in commit `13f285fd`: body references updated to `081KRA5AR0008QG0R0019Q33F7` (renumbered from 081KRA5AR0008QG0R000Y6102S per 081KRFA460008QG0R00308W7FJ sweep). Both the prose and Evidence section are now consistent with the frontmatter `depends_on: [081KRA5AR0008QG0R0019Q33F7]`.

### Thread 3: docs/hygiene-history/ticks/2026/05/14/0223Z.md:36 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:29:00Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct stale renumber IDs in the tick history shard**

This shard still records `081KRA5AR0008QG0R000Y6102S -> 081KRHWGX0008QG0R000TVGDGV` / `081KRHWGX0008QG0R001E9KEJ1` and a `081KRA5AR0008QG0R000KKJRVA.depends_on -> 081KRHWGX0008QG0R000TVGDGV` remap, but this same commit actually renumbers the rows to `081KRA5AR0008QG0R0019Q33F7` and `081KRA5AR0008QG0R001JWYYHE` and updates `081KRA5AR0008QG0R000KKJRVA` to depend on `081KRA5AR0008QG0R0019Q33F7`. Leaving the old IDs in a durable hygiene-history artifact makes the cleanup provenance internally inconsistent and can mislead later audits or follow-on renumber work that uses tick shards as source-of-truth evidence.

Useful? React with 👍 / 👎.

### Thread 4: docs/hygiene-history/ticks/2026/05/14/0223Z.md:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:30:53Z):

Tick 0223Z describes the renumber as 081KRHWGX0008QG0R000TVGDGV/081KRHWGX0008QG0R001E9KEJ1 and the chain remap as 081KRA5AR0008QG0R000KKJRVA.depends_on → 081KRHWGX0008QG0R000TVGDGV, but this PR’s actual renumber/remap is to 081KRA5AR0008QG0R0019Q33F7/081KRA5AR0008QG0R001JWYYHE (see the updated backlog rows and the later 0238Z tick). Please update this tick shard to either reflect the final IDs/remap, or explicitly mark the 081KRHWGX0008QG0R000TVGDGV/081KRHWGX0008QG0R001E9KEJ1 plan as superseded (and point at Tick 0238Z) so the hygiene-history record doesn’t misstate what PR 3073 does.

### Thread 5: docs/hygiene-history/ticks/2026/05/14/0238Z.md:28 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:30:53Z):

The PR description (and earlier 0223Z tick shard) still references the intermediate renumber targets 081KRHWGX0008QG0R000TVGDGV/081KRHWGX0008QG0R001E9KEJ1, but the branch was bumped again to 081KRA5AR0008QG0R0019Q33F7/081KRA5AR0008QG0R001JWYYHE to avoid the PR-3070 reserved range. Please update the PR description to match the final IDs to prevent reviewers/readers from following the wrong remap instructions.

## General comments

### @chatgpt-codex-connector (2026-05-14T00:28:16Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
