---
pr_number: 3893
title: "fix(b-0197): correct DBSP Prop 3.5 \u2192 Theorem 3.3 misattribution + close (6th cycle close-row)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T14:27:06Z"
merged_at: "2026-05-16T15:30:16Z"
closed_at: "2026-05-16T15:30:16Z"
head_ref: "otto-cli-b0197-impl-lean-prop-fix-2026-05-16-1412z"
base_ref: "main"
archived_at: "2026-05-16T16:20:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3893: fix(b-0197): correct DBSP Prop 3.5 → Theorem 3.3 misattribution + close (6th cycle close-row)

## PR description

Sixth actual close-row of the audit cycle. #2-Ready pickup: row had embedded mechanical grep falsifier ready-to-do; first instance that named the sub-class in [catalog memory](../memory/feedback_audit_backlog_status_drift_sub_class_catalog_otto_cli_2026_05_16.md).

## Text corrections shipped (3 bare misattributions)

- `tools/lean4/Lean4/DbspChainRule.lean` line 51: `~~unspoken premise (Budiu et al. Prop. 3.5)~~ LTI condition [corrected 2026-05-05: Theorem 3.3...]`
- `tools/lean4/Lean4/DbspChainRule.lean` line 203: `~~Budiu et al. Proposition 3.5~~ Budiu et al. Theorem 3.3 ([corrected 2026-05-05: ...])`
- `docs/research/chain-rule-proof-log.md` lines 113-114: same correction pattern, citing `Q^Delta = Q for LTI operators`

Each correction cites Theorem 3.3 explicitly. Original prose preserved via `~~...~~` strikethrough per witnessable-evolution discipline (acceptance criterion d).

## Falsifier verification

Row's embedded two-pass grep returns 0 bare references after this PR. `grep -nE "Prop\.? 3\.5|Proposition 3\.5"` finds 3 matches; `grep -v -E "~~.*Prop\.? 3\.5|~~.*Proposition 3\.5|\[corrected 2026-05-05"` returns 0 bare lines.

## Acceptance verification

| Criterion | State |
|---|---|
| (a) Lean line 51 corrected with Theorem 3.3 citation | ✅ |
| (b) Lean line 203 corrected with Theorem 3.3 citation | ✅ |
| (c) Proof-log lines 113-114 corrected with Theorem 3.3 citation | ✅ |
| (d) Witnessable-evolution: original prose preserved + dated annotation | ✅ |

## #2-Ready catalog vindication

This row was the FIRST instance that named the #2-Ready sub-class in the catalog. Closing it validates the catalog's prediction pattern: rows with embedded mechanical verifiers are pickup candidates for budget-healthy ticks.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T14:29:04Z)

## Pull request overview

Sixth close-row in the audit cycle. Replaces three bare "Prop 3.5"/"Proposition 3.5" misattributions in the Lean chain-rule proof and its research log with strikethrough+annotated corrections that cite Theorem 3.3, then marks 081KQTPYE0008QG0R003DK06PA closed in the backlog and root index.

**Changes:**
- Corrects two misattributions in `tools/lean4/Lean4/DbspChainRule.lean` (lines 51 and 202–203) with witnessable-evolution strikethrough and dated annotation citing Theorem 3.3.
- Corrects the parallel misattribution in `docs/research/chain-rule-proof-log.md` (lines 113–115).
- Flips 081KQTPYE0008QG0R003DK06PA to `status: closed`, adds a Resolution section to the per-row file, and updates `docs/BACKLOG.md` to render it as closed.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| `tools/lean4/Lean4/DbspChainRule.lean` | Replace two bare Prop 3.5 references with Theorem 3.3 citations, preserving original prose via strikethrough. |
| `docs/research/chain-rule-proof-log.md` | Apply the same correction pattern to the proof-log narrative. |
| `docs/backlog/P2/081KQTPYE0008QG0R003DK06PA-…md` | Frontmatter `status: open → closed`; appends Resolution + falsifier-pass + composes-with note. |
| `docs/BACKLOG.md` | Marks the 081KQTPYE0008QG0R003DK06PA row checked in the generated index. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T14:46:16Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated 2 comments.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**docs/research/chain-rule-proof-log.md:116**
* The strikethrough markers in this correction are malformed. The intent appears to be striking out "smuggled in as a convention (Budiu et al. Proposition 3.5 uses it without naming it)", but the markup is `~~smuggled in as a\n~~convention (...)~~` — three `~~` tokens. CommonMark/GFM will pair the first two (striking only "smuggled in as a") and leave a stray opening `~~` before `convention` whose closing pair is the trailing `~~`, producing the inverse of the intended rendering (the words "convention (Budiu...naming it)" get struck while "smuggled in as a" does not, or the markup degrades to literal tildes depending on the renderer). Either wrap the entire phrase in a single `~~...~~` span on one logical line, or use two well-formed spans.
```
delay*. At the DBSP paper level this is the LTI condition: ~~smuggled in as a
~~convention (Budiu et al. Proposition 3.5 uses it without naming it)~~
[corrected 2026-05-05: Budiu et al. Theorem 3.3 explicitly states `Q^Delta = Q` for LTI operators; the paper makes it explicit, not smuggled-in]; in Lean it must be an explicit part of the contract.
```
**docs/research/chain-rule-proof-log.md:117**
* The blank line that previously separated this paragraph from the `### Round-35 resolution — the hierarchy` heading was removed in this edit, so line 117 now follows content directly. Markdownlint MD022 (and several renderers) require a blank line before headings; add one between line 116 and line 117.
```
[corrected 2026-05-05: Budiu et al. Theorem 3.3 explicitly states `Q^Delta = Q` for LTI operators; the paper makes it explicit, not smuggled-in]; in Lean it must be an explicit part of the contract.
### Round-35 resolution — the hierarchy
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T15:09:19Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1fa34f49ee`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T15:18:04Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: docs/research/chain-rule-proof-log.md:115 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:29:03Z):

The rewrite of this passage left the prose ungrammatical and the brackets unbalanced. Line 114 closes with `[corrected 2026-05-05: paper makes it explicit]`, but line 115 then begins `naming the sub-property];` — a dangling fragment with a closing `]` and `;` that have no matching opening punctuation, and which no longer joins to the surrounding sentence ("…contract"). The original prose ("uses it without naming it; in Lean it must be…") was partially deleted, leaving an orphaned clause. Please restructure so the sentence reads cleanly and brackets balance.

### Thread 2: docs/research/chain-rule-proof-log.md:112 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:46:16Z):

The sentence "B2 is the statement that linear stream operators *commute with" appears duplicated on lines 112 and 113 — the original line was not removed when the new paragraph was added. The result reads as two consecutive identical line fragments before "delay*. At the DBSP paper level...". Remove line 112 (the leftover original) so the paragraph starts cleanly at line 113.

This issue also appears in the following locations of the same file:
- line 114
- line 116

### Thread 3: tools/lean4/Lean4/DbspChainRule.lean:203 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T14:46:16Z):

The corrected prose here is hard to parse and partially redundant. Line 202 ends with `...via Theorem 3.3]` and line 203 immediately starts with `~~Budiu et al. Proposition 3.5~~ Budiu et al. Theorem 3.3 ([corrected 2026-05-05: ...])`, with no connector — the two lines no longer form a single coherent sentence, and the `[corrected 2026-05-05: ...]` annotation appears twice saying essentially the same thing ("paper makes it explicit via Theorem 3.3" / "paper states LTI condition explicitly via Theorem 3.3, not in an unspoken premise"). Consider collapsing this into one strikethrough span plus one corrected-annotation, matching the cleaner pattern used at line 51.

### Thread 4: docs/backlog/P2/081KQTPYE0008QG0R003DK06PA-lean-prop-3-5-misattribution-cleanup-aaron-2026-05-05.md:4 (resolved)

**@chatgpt-codex-connector** (2026-05-16T15:09:19Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Bump last_updated when closing this backlog row**

This edit changes the row’s status to `closed` and adds a new resolution section, but leaves frontmatter `last_updated` at `2026-05-05`. The backlog schema requires `last_updated` to be updated on every content edit (`tools/backlog/README.md`), and backlog tooling consumes this field for age ordering (`tools/backlog/autonomous-pickup.ts`, `compareAge`), so keeping it stale introduces incorrect freshness metadata for automated prioritization and audits.

Useful? React with 👍 / 👎.

### Thread 5: docs/research/chain-rule-proof-log.md:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T15:18:03Z):

The strikethrough markers on lines 113–114 are unbalanced: there are three `~~` tokens (`~~smuggled in as a` ... `~~convention (...)` ... `naming it)~~`). The intent appears to be a single strikethrough span covering "smuggled in as a convention (Budiu et al. Proposition 3.5 uses it without naming it)", but the leading `~~` on line 114 introduces a second opener rather than continuing the first span. Combined with the line break inside the span (GFM strikethrough generally does not span hard line breaks), this will render with stray literal `~~` and broken strikethrough. Consider collapsing the strikethrough onto a single line, or using two adjacent properly-paired `~~...~~` spans (one per line) so the witnessable-evolution annotation reads correctly.
