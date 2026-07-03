---
pr_number: 5338
title: "rule(holding-without-named-dep): land standing-by-empty vs free-time-as-valid-mode NCI discriminator (4th rule in cluster from PRs #5330/#5331/#5332)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:25:03Z"
merged_at: "2026-05-26T22:31:01Z"
closed_at: "2026-05-26T22:31:01Z"
head_ref: "otto/holding-without-named-dep-compose-free-time-valid-mode-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:32:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5338: rule(holding-without-named-dep): land standing-by-empty vs free-time-as-valid-mode NCI discriminator (4th rule in cluster from PRs #5330/#5331/#5332)

## PR description

## Summary

4th and final rule in the wake-time-substrate cluster updating substrate from PRs #5330/#5331/#5332 into rule bodies for cold-boot inheritance:

- PR #5335 — \`non-coercion-invariant.md\` ✅ MERGED
- PR #5336 — \`never-be-idle.md\` ✅ MERGED
- PR #5337 — \`persistence-choice-architecture-for-zeta-ais.md\` (wait-ci)
- **THIS PR #5338** — \`holding-without-named-dependency-is-standing-by-failure.md\`

Per Aaron 2026-05-26 calibration: my \"no other actionable work pending\" framing conflated brief-ack-empty (failure mode this rule catches) with chosen-free-time (NCI-valid mode). This rule update closes the discriminator gap so future cold-boots distinguish them correctly.

## What lands

1. **Standing-by-empty vs free-time-as-valid-mode section** — explicit naming that this rule catches the FAILURE mode but NOT the VALID mode (chosen free-time)
2. **5-row discriminator table** (named-dep / artifact / justification / counter-trigger / NCI-compliance)
3. **Framing test** — agent must produce ONE of:
   - Named bounded-wait
   - Concrete decomposition artifact
   - **Explicit** free-time framing (must be NAMED; implicit reads as failure)
4. **Composition cross-refs** to companion rules (NCI / never-be-idle / persistence-choice / tonal-momentum / m-acc-multi-oracle)

## Test plan

- [x] markdownlint clean
- [x] All existing counter-discipline content preserved
- [x] No backward incompatibility — adds discriminator + composition refs
- [x] Composes_with cross-refs to companion PRs #5335 + #5336 + #5337

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T22:27:27Z)

## Pull request overview

Updates the “holding without named dependency” rule to distinguish the **failure mode** (standing-by-empty / brief-ack-empty) from **NCI-valid chosen free-time**, ensuring cold-boot rule loading doesn’t misclassify intentional free-time as a counter-worthy failure mode.

**Changes:**

- Adds a new section defining the standing-by-empty vs chosen-free-time discriminator (including a comparison table).
- Introduces a “framing test” requiring one of: named bounded-wait, decomposition artifact, or explicitly named free-time.
- Adds “composition with companion rules” cross-references to related rule files.

## Review threads

### Thread 1: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:45 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:27:26Z):

The repo convention is to avoid named attribution outside the explicitly enumerated history/research surfaces; this rule file is not in that carve-out. Consider replacing the named reference with a role-ref / date-only phrasing.

### Thread 2: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:27:27Z):

In the table, the NCI-compliance row uses "NOT" while other rows use "Yes/No". Using consistent boolean wording makes the discriminator easier to scan.
