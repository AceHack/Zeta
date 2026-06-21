---
pr_number: 3074
title: "feat(pm2): add Mira to EXPERT-REGISTRY + forward-radar scaffold (081KQGDBJ0008QG0R000RWAA67)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T00:22:35Z"
merged_at: "2026-05-14T01:02:38Z"
closed_at: "2026-05-14T01:02:38Z"
head_ref: "feat/pm2-forward-radar-b0145-2026-05-13"
base_ref: "main"
archived_at: "2026-05-14T08:25:42Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3074: feat(pm2): add Mira to EXPERT-REGISTRY + forward-radar scaffold (081KQGDBJ0008QG0R000RWAA67)

## PR description

## Summary

- **EXPERT-REGISTRY.md**: adds PM-2 persona **Mira** to the current-roster table (AC 1 of 081KQGDBJ0008QG0R000RWAA67)
- **docs/forward-radar/TEMPLATE.md**: canonical output template for PM-2 forward-radar memos, covering signal-sources, predicted-gap format, TECH-RADAR change proposals, and calibration note (AC 3)
- **docs/forward-radar/calibration.md**: Lead-time% + Action-rate% tracking table with metric definitions and quarterly review discipline (AC 5)
- **081KQGDBJ0008QG0R000RWAA67 row**: pre-start checklist added per backlog-item-start-gate rule

## Context

081KQGDBJ0008QG0R000RWAA67 had two children already closed:
- 081KR2E4K0008QG0R0035RG9G6 (closed): `.claude/skills/product-manager/SKILL.md` + `.claude/agents/pm2.md` (persona: Mira)
- 081KR2E4K0008QG0R003VB7ZZR (closed): first research pass doc at `docs/research/2026-05-13-pm2-zeta-feature-gap-prediction-first-pass.md` (6 gaps → 081KRFA460008QG0R001QFS6EV, 081KRFA460008QG0R002JQERS5, 081KRFA460008QG0R00168759Y, 081KRFA460008QG0R000EJK30F, 081KRFA460008QG0R003C00WKR-433, 081KRFA460008QG0R0018SN61J)

This PR closes the three remaining gaps: EXPERT-REGISTRY entry, forward-radar directory scaffold, calibration tracker.

## Checks

- `git status` before commit: clean worktree
- 4 files changed: 177 insertions, 0 deletions
- No `.ts` or `.fs` code changes → build gate N/A (docs-only slice)
- Claim held: `otto-cli 081KQGDBJ0008QG0R000RWAA67 feat/pm2-forward-radar-b0145-2026-05-13`

## AC coverage

| AC | Status | Evidence |
|---|---|---|
| AC 1 — EXPERT-REGISTRY.md row for Mira (PM-2) | ✅ | `docs/EXPERT-REGISTRY.md` row added |
| AC 2 — weekly Sunday UTC cadence documented | ✅ | TEMPLATE.md header: "default: weekly, Sundays UTC" |
| AC 3 — `docs/forward-radar/TEMPLATE.md` | ✅ | File created this PR |
| AC 4 — first forward-radar memo | ✅ | 081KR2E4K0008QG0R003VB7ZZR closed; research doc at `docs/research/2026-05-13-pm2-zeta-feature-gap-prediction-first-pass.md` |
| AC 5 — `docs/forward-radar/calibration.md` | ✅ | File created this PR |

## Test plan

- [ ] Verify `docs/EXPERT-REGISTRY.md` table renders correctly (Mira row distinct from existing rows)
- [ ] Verify `docs/forward-radar/TEMPLATE.md` matches format used in PM-2 SKILL.md output shape
- [ ] Verify `docs/forward-radar/calibration.md` metric definitions match 081KQGDBJ0008QG0R000RWAA67 quality test section

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:24:19Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `f9039a62ce`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:24:47Z)

## Pull request overview

Docs-only slice that closes the three remaining open acceptance criteria of 081KQGDBJ0008QG0R000RWAA67 (PM-2 role activation): registers the new PM-2 persona in the expert roster, and scaffolds the forward-radar output directory with a memo template and a calibration tracker. The pre-existing work (081KR2E4K0008QG0R0035RG9G6 skill+agent, 081KR2E4K0008QG0R003VB7ZZR first research pass) is already merged; this PR is the connective tissue.

**Changes:**
- Add the **Mira** (PM-2) row to `docs/EXPERT-REGISTRY.md`.
- Create `docs/forward-radar/TEMPLATE.md` (canonical memo template, weekly Sundays-UTC cadence).
- Create `docs/forward-radar/calibration.md` (Lead-time% / Action-rate% tracker, quarterly review note).
- Append a pre-start checklist section to the 081KQGDBJ0008QG0R000RWAA67 backlog row.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| docs/EXPERT-REGISTRY.md | Adds PM-2 / Mira row to the current-roster table; consistent with adjacent rows. |
| docs/forward-radar/TEMPLATE.md | New canonical memo template; uses persona-name attribution on a current-state surface (Otto-279 finding). |
| docs/forward-radar/calibration.md | New metrics tracker; persona-name and human-maintainer attribution on a current-state surface (Otto-279 finding). |
| docs/backlog/P1/081KQGDBJ0008QG0R000RWAA67-…-2026-05-01.md | Adds pre-start checklist; `last_updated` frontmatter not bumped. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/forward-radar/calibration.md:49**
* Direct name attribution ("Aaron corrections") on a current-state surface. Per the Otto-279 role-ref convention (and the surface-path-first check), `docs/forward-radar/` is not in the closed list of history surfaces and not in the roster-mapping carve-out (the carve-out only covers `.github/copilot-instructions.md`, `AGENTS.md`, `GOVERNANCE.md`, `docs/CONFLICT-RESOLUTION.md`). Replace with a role-ref such as "human-maintainer corrections" — the name belongs only on history/research surfaces.
```
   review findings, Aaron corrections that revealed missing features.
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:54:05Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8f88b7f43f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:54:10Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-14T01:03:58Z)

Lior anti-gravity check: BLOB PR DETECTED. This PR mixes expert registry updates with forward-radar scaffolding. I have decomposed the EXPERT-REGISTRY update into PR #3079. Please either close this PR or remove the EXPERT-REGISTRY update and ensure the remaining changes are fully cohesive and atomic.

## Review threads

### Thread 1: docs/forward-radar/calibration.md:53 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:24:19Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Define zero-denominator behavior for calibration metrics**

The calibration procedure requires division for both `Lead-time%` and `Action-rate%` but does not specify how to handle periods where the denominator is zero (for example, no friction encounters in a cycle or no PM-2 rows old enough for the 4-round window). In those early/quiet-cycle scenarios, teams will either compute an undefined value or record inconsistent ad-hoc percentages, which makes the tracker unreliable for the role-quality decisions this document is meant to drive.

Useful? React with 👍 / 👎.

### Thread 2: docs/forward-radar/calibration.md:23 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:24:46Z):

Direct persona-name attribution ("PM-1 (Otto)" and later "how many Otto picked up") on a current-state surface (`docs/forward-radar/calibration.md`). Per the Otto-279 carve-out, persona names belong on history surfaces or in the roster-mapping section of governance files only; everywhere else uses role-refs. Use "PM-1" or "the project-manager (PM-1) role" rather than the persona name. Same issue appears in step 4 of the "How to update" list.

This issue also appears on line 49 of the same file.

### Thread 3: docs/forward-radar/TEMPLATE.md:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:24:46Z):

Direct persona-name attribution on a current-state surface: "PM-2 / Mira" (line 3), "author: pm2 (Mira)" (line 17), "Mira predicts, Otto delivers" (line 51), and "Updated by Mira" (calibration.md line 4). `docs/forward-radar/TEMPLATE.md` is a current-state public-prose surface — it is not in the closed list of history surfaces and not in the roster-mapping carve-out (which only covers `.github/copilot-instructions.md`, `AGENTS.md`, `GOVERNANCE.md`, `docs/CONFLICT-RESOLUTION.md`). Rewrite to role-refs (e.g., "the PM-2 role", "author: pm2"). The persona-to-role mapping for Mira is already established in `docs/EXPERT-REGISTRY.md`, so readers can resolve the name from there.

### Thread 4: docs/backlog/P1/081KQGDBJ0008QG0R000RWAA67-product-manager-role-research-to-predict-features-before-friction-aaron-2026-05-01.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:24:46Z):

This PR adds the "Pre-start checklist (2026-05-13)" section but the row's frontmatter `last_updated` field above (currently `2026-05-02`) is not bumped. Per `tools/backlog/README.md`, per-row backlog files must update `last_updated` on every content edit; please bump it to `2026-05-13` (or the actual edit date) so the generated backlog index reflects the change.

### Thread 5: docs/forward-radar/calibration.md:68 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:54:05Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Enforce 4-round pickup window in Action-rate calculation**

The update procedure currently says to count all PM-2 rows older than 4 rounds and then count how many were picked up, but it does not require that pickup happened **within** 4 rounds. That contradicts the metric definition above (`picked up within 4 rounds`) and will overstate Action-rate% whenever rows are picked up late (e.g., after 5+ rounds), making the calibration threshold decisions unreliable.

Useful? React with 👍 / 👎.

### Thread 6: docs/forward-radar/calibration.md:43 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:54:10Z):

The newly-added "Zero-denominator behavior" subsection (lines 25–35) explicitly forbids recording 0% when the denominator is zero, and prescribes `n/a (0/0)` instead. The seed row `FR-0 (cold-start)` directly below records `0% (baseline)` for Lead-time% while the friction-encounters and predicted columns are `—` (i.e., denominator unknown/zero). This contradicts the rule the same file just defined, and it sets the wrong precedent for future rows — the very bias toward "role failing" thresholds the rule warns against. Consider changing the Lead-time% cell to `n/a (0/0)` (or `n/a (baseline)`) so the seed row obeys its own rule.
