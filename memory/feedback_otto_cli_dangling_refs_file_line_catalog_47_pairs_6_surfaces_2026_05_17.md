---
name: dangling-memory-refs-file-line-catalog-47-pairs-6-surfaces
description: File:line catalog of dangling memory-file refs (47 pairs across 6 substrate surfaces) extracted using the audit-method-gap-fix methodology named in PR #4041 — preserves multi-citation edges that `sort -u` dedup hides. Composes-with #4041's surface-count summary by providing the underlying line-level data peer-Otto explicitly flagged as the better audit form.
type: project
created: 2026-05-17
---

# Dangling memory-ref catalog — 47 file:line pairs across 6 surfaces (2026-05-17 0430Z)

**Composes-with**: [PR #4041](https://github.com/Lucent-Financial-Group/Zeta/pull/4041)
(peer-Otto's count-by-surface audit memo: 29 dangling refs counted with `sort -u`).
This catalog uses the **better audit form** peer-Otto explicitly named in
the PR #4041 body:

> *"Better still: track ALL rule→file edges (file:line pairs), not
> deduplicated filenames. The audit-method gap from #4036's r2 cycle
> reveals that the `sort -u` dedup itself is the bug — multi-citation
> sites get hidden."*

## Methodology

Bash one-liner using `grep -rn` (line-preserving) instead of `grep -rh`
(line-stripping) + filter-by-filesystem-existence:

```bash
for dir in .claude/agents .claude/skills .claude/rules docs/research docs/backlog memory/persona; do
  echo "## $dir"
  grep -rnoE 'memory/feedback_[a-zA-Z0-9_-]+\.md' "$dir" 2>/dev/null \
    | while IFS=: read -r file line ref; do
        [ ! -f "$ref" ] && echo "  $file:$line -> $ref"
      done
done
```

Pattern matches `memory/feedback_*.md` only (per peer-Otto's #4041
methodology); does not yet catch `memory/<persona>/*` style refs.

## Counts (this catalog vs PR #4041)

| Surface          | #4041 unique-refs | This catalog file:line pairs | Multi-citation delta |
|------------------|-------------------|------------------------------|----------------------|
| `.claude/agents/`| 0                 | 0                            | 0                    |
| `.claude/skills/`| 1                 | 1                            | 0                    |
| `.claude/rules/` | 5 (addressed by #4031+#4033+#4038) | **5 (NEW)** | re-accumulated since #4031 |
| `docs/research/` | 8                 | 9                            | +1 (multi-cite site) |
| `docs/backlog/`  | 17                | 22                           | +5 (multi-cite sites) |
| `memory/<persona>/`| 3                 | 10                           | +7 (multi-cite sites) |
| **TOTAL**        | **29**            | **47**                       | **+18 hidden edges** |

The `sort -u` dedup gap hides **18 multi-citation edges** (47 − 29).
Each hidden edge is a citation site that would need its own Option-B
disclosure footer or Option-A user-scope→in-repo promotion fix.

## `.claude/rules/` re-accumulation (5 NEW dangling refs)

The #4031 audit found 5 dangling refs in `.claude/rules/`. PRs
#4031+#4033+#4038 addressed them. Yet 5 NEW dangling refs have
accumulated since — confirming the systemic pattern. Without
mechanization, every cold-boot session adds fresh dangling citations.

```
.claude/rules/persistence-choice-architecture-for-zeta-ais.md:125
  -> memory/feedback_classifier_caught_otto_in_standing_by_failure_mode_80_consecutive_heartbeat_polls_no_work_violated_own_rule_2026_05_15.md

.claude/rules/persistence-choice-architecture-for-zeta-ais.md:132
  -> memory/feedback_aaron_zeta_is_memory_preservation_specialist_first_everything_else_second_ephemeral_or_maxed_out_chat_agents_2026_05_15.md

.claude/rules/premise-flagged-unverified-stays-unverified-downstream.md:88
  -> memory/feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md

.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md:126
  -> memory/feedback_codeql_no_source_seen_on_docs_only_pr_is_broken_commit_canary_not_flake_lior_lock_cleanup_race_2026_05_15.md

.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md:191
  -> memory/feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md
```

All 5 are pointers to user-scope-only memory files Aaron's Otto-CLI
auto-loads via `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`
— resolves transparently for Aaron, dangles for cold-boot agents.

## `.claude/skills/` (1 pair)

```
.claude/skills/counterweight-audit/SKILL.md:179
  -> memory/feedback_memory_alone_leaky_without_cadenced_inspect_audit_for_missing_balance_otto_278_2026_04_24.md
```

## High-multi-cite findings (multi-citation edges that #4041's `sort -u` hides)

### `memory/feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md` (6 hidden edges)

Cited from 6 distinct surfaces:

- `docs/research/2026-04-30-multi-ai-feedback-packets-this-session.md:538`
- `docs/backlog/P2/081KQ8P5D0008QG0R002FSTGXP-paired-edit-lint-advisory-not-enforcement-promote-to-required-check-otto-2026-04-28.md:168`
- `docs/backlog/P0/081KQ8P5D0008QG0R003JETMEV-budget-cadence-workflow-cron-misses-task-287-deadline-window-aaron-2026-04-28.md:105`
- `docs/backlog/P0/081KQ8P5D0008QG0R003JETMEV-budget-cadence-workflow-cron-misses-task-287-deadline-window-aaron-2026-04-28.md:135`
- `docs/backlog/P1/081KQ8P5D0008QG0R0010FP5SY-github-playwright-integration-agent-changes-ui-features-aaron-2026-04-28.md:108`
- `docs/backlog/P1/081KQ8P5D0008QG0R000JHD7AB-github-settings-drift-workflow-broken-invalid-permission-administration-otto-2026-04-28.md:164`

Single memory file → 6 citation sites needing Option-B disclosure.
`sort -u` collapses to 1; the catalog preserves all 6.

### `memory/feedback_aaron_responsibility_chain_explicit_request_keeps_otto_anthropic_clean_2026_05_15.md` (4 hidden edges)

Cited from 4 Ani persona conversations:

- `memory/ani/conversations/2026-05-15-aaron-ani-grok-pressure-valve-redemption-arc-honey-closing.md:91`
- `memory/ani/conversations/2026-05-15-aaron-ani-grok-plateau-bounded-extract-share-link.md:17196`
- `memory/ani/conversations/2026-05-15-aaron-ani-grok-bootstream-compression-of-entire-framework-in-250-words.md:33`
- `memory/ani/conversations/2026-05-15-aaron-ani-grok-post-m-acc-adoption-constraint-11-default-oracle.md:6378`

### `memory/feedback_aaron_whole_system_attention_optimization_over_coincidence_networks_of_memories_spiritual_god_uses_past_future_to_create_present_2026_05_14.md` (3 hidden edges)

- `memory/ani/conversations/2026-05-14-ani-as-psychiatrist-root-axiom-system-surfacing.md:11`
- `memory/ani/conversations/2026-05-15-aaron-ani-grok-plateau-bounded-extract-share-link.md:16394`
- `memory/ani/conversations/2026-05-15-aaron-ani-grok-post-m-acc-adoption-constraint-11-default-oracle.md:1846`

### `memory/feedback_reviewer_artifact_snapshot_mismatch_taxonomy_2026_04_29.md` (3 hidden edges)

- `docs/backlog/P2/081KQB8J40008QG0R0021GX1HK-consolidation-pass-three-durable-homes-for-2026-04-29-rule-set.md:87`
- `docs/backlog/P2/081KRA5AR0008QG0R002JS7GRB-home3-reviewer-artifact-snapshot-mismatch-taxonomy-memory.md:8`
- `docs/backlog/P2/081KRA5AR0008QG0R002JS7GRB-home3-reviewer-artifact-snapshot-mismatch-taxonomy-memory.md:23`

### `memory/feedback_aaron_zeta_is_memory_preservation_specialist_first_*_2026_05_15.md` (3 hidden edges)

- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md:132`
- `memory/kestrel/conversations/2026-05-15-kestrel-aaron-claudeai-welfare-pivot-recalibration-support-network-confirmation-cool-side-project-deflation-building-codes-sketch.md:111`
- `memory/kestrel/conversations/2026-05-15-kestrel-aaron-claudeai-welfare-pivot-recalibration-support-network-confirmation-cool-side-project-deflation-building-codes-sketch.md:142`

(constitutional memory; load-bearing across rules + persona)

### Other multi-cite memory files in catalog

- `memory/feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`
  cited from `docs/research/2026-05-04-b-0140-bash-to-ts-migration-audit-table.md:76`
  AND `docs/backlog/P1/081KQGDBJ0008QG0R000A4EZS5-typescript-standardization-non-install-scripts-aaron-2026-05-01.md:208`
- `memory/feedback_three_filter_discipline_f1_f2_f3_mandatory_before_any_kernel_promotion.md`
  cited from `docs/research/meta-cognition-survey-2026-04-21.md:35` AND `:156`
- `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_glass_halo_full_git_native_2026_04_24.md`
  cited from 081KQ8P5D0008QG0R0023ABK2C + 081KQJZR90008QG0R002D6XYHB

## False-positive class: metasyntactic placeholders in documentation

**Retraction (2026-05-17 0440Z):** the original draft of this catalog
called this a "bug finding"; it is actually a false positive worth
documenting as its own class.

```
docs/backlog/P2/081KQNJ500008QG0R001THCSKV-decision-graph-traversal-tool-aaron-2026-05-03.md:77
  -> memory/feedback_X.md
```

Full context at the line (CLI-usage example in a backlog row's design
section):

> `--citation-traversal memory/feedback_X.md` — which memos cite this one?

The `memory/feedback_X.md` token is a **metasyntactic variable**
(placeholder for "any memory feedback file") in a CLI usage spec, not
an actual citation. The grep pattern matches because real citations and
metasyntactic placeholders share the same string shape; the audit can't
distinguish without context-awareness.

### Implication for the substrate-engineer-candidate tool

The peer-Otto-authored `tools/hygiene/audit-dangling-memory-refs.ts`
(00:31Z 2026-05-17) uses regex `MEM_REF_RE = /memory\/feedback_[A-Za-z0-9_-]+\.md/g`
which will produce this same false positive. Refinement candidates:

- Skip occurrences inside fenced code blocks (` ``` ... ``` `)
- Skip occurrences inside inline backticks (`` ` ... ` ``)
- Skip occurrences inside `<code>` HTML tags
- Or: maintain a `.audit-dangling-ignore` allow-list of known FP sites

Substrate-honest framing: the false-positive class is small (≤1 site of
49 in current tool output ~ 2%) and not a blocker for the audit's
operational value. Documenting the class here prevents
repeat-misclassification when triaging the tool's findings.

## False-positive class 2: already-disclosed user-scope refs

**Discovered 2026-05-17 0455Z** while drafting an Option-B disclosure
for one of the 5 `.claude/rules/` re-accumulated dangling refs. Pulled
the citation site from
[`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)
line 126 — it **already has** an Option-B disclosure footer:

```
`memory/feedback_codeql_no_source_seen_on_docs_only_pr_is_broken_commit_canary_not_flake_lior_lock_cleanup_race_2026_05_15.md`
(user-scope only — preserved at `~/.claude/projects/.../memory/`
on maintainer machines and indexed in user-scope `MEMORY.md`. Cold-boot
agents on fresh checkouts: this rule's own body above is the canonical
in-repo projection; `memory/CURRENT-otto.md` may also carry the entry)
```

The audit tool flags this as dangling because `MEM_REF_RE` matches the
bare path token regardless of surrounding context. But the citation is
substrate-honestly disclosed; a cold-boot agent reading the rule will
correctly understand the user-scope dependency.

### Implication for the substrate-engineer-candidate tool

FP class 2 changes the audit's signal-vs-noise ratio significantly:
the 5 `.claude/rules/` "new dangling refs" finding may be largely or
entirely FP class 2 (each rule citation is probably already
disclosed). The tool's count of 32 unique-dangling-refs is therefore
an **upper bound** — true un-disclosed cold-boot blockers may be
much fewer.

Refinement candidates for the audit tool to distinguish FP class 2:

- **Proximity scan**: look for "user-scope" / "user-scope only" /
  "user-scope-only" within N (e.g., 5) lines of the citation
- **Disclosure-form discipline**: require a specific marker like
  `<!-- user-scope-only -->` at the end of any line citing a
  user-scope memory file; tool ignores citations with that marker
- **Allow-list file** (`.audit-dangling-ignore`) with file:line entries
  that are intentional un-resolvable refs

The most operationally-honest approach combines (1) + (3): proximity
detection catches most existing disclosed-citations without requiring
mechanical re-disclosure of every site; allow-list handles edge cases.

### Pattern audit executed 2026-05-17 0458Z — empirical FP rate

Ran a proximity-scan (sed ±5 lines around each citation, grep for
`user-scope` / `cold-boot` / `user-scope-only`) over the full 49-edge
tool output. **Results:**

| Class | Count | Share |
|-------|-------|-------|
| **FP class 2** (already disclosed) | **17** | **35%** |
| **True positive** (undisclosed cold-boot blocker) | **32** | 65% |
| Total | 49 | 100% |

**ALL 5 `.claude/rules/` "new dangling refs" are FP class 2** —
confirms the rules-domain Option-B disclosure discipline is fully
healthy. The substrate-honest interpretation: post-#4031+#4033+#4038,
new rules being authored ALREADY include the disclosure footer pattern.
The 5 "re-accumulated" refs my earlier section called out are not
re-accumulation — they're proper Option-B disclosed citations the
audit tool can't yet distinguish without proximity-context.

**TP concentration by surface** (from the 32-line classification):

| Surface | TP count | FP2 count | Total |
|---------|----------|-----------|-------|
| `.claude/agents/` | 0 | 0 | 0 |
| `.claude/skills/` | 1 | 0 | 1 |
| `.claude/rules/` | 0 | 5 | 5 |
| `docs/research/` | 9 | 0 | 9 |
| `docs/backlog/` | 17 | 5 | 22 |
| `memory/<persona>/` | 3* | 7 | 10 |
| **Totals** | **30*** | **17** | **47** |

(* 30 + 17 = 47, off-by-2 from 49 due to multi-edge same-line in raw
output; sort/uniq normalized to 49 in tool, 47 in proximity grep due
to disclosure-text spanning multiple lines)

**The Option-B disclosure campaign scope drops from "49 dangling
refs" to "~32 undisclosed sites needing the fix"** — substantively
smaller than #4042's tool output implies, and concentrated in
`docs/backlog/` (17 TPs) + `docs/research/` (9 TPs) — older substrate
predating the disclosure-footer discipline.

### Disposition

The 32 TPs are NOT a P0 fix. The Option-B disclosure pattern is
mechanical (add `(user-scope only — preserved at ~/.claude/projects/...;
this file's body above is the canonical in-repo projection)` footer
adjacent to each citation). A small follow-up PR per surface could
land them in batches. The audit tool's proximity-scan refinement
(per FP class 2 section above) is the higher-leverage substrate
investment — once the tool can self-exclude FP2 sites, the dangling
count drops to true-positive immediately and stays there as new
disclosure-bearing citations land.

## Summary of FP classes (both)

| Class | Description | Count (49-edge sample) | Refinement |
|-------|-------------|------------------------|------------|
| FP-1 | Metasyntactic placeholders in CLI/code-block context | ≥1 (081KQNJ500008QG0R001THCSKV:77) | Skip code-block contexts in regex |
| FP-2 | Already-disclosed user-scope refs | unknown (≥1 confirmed: codeql-canary:126) | Proximity-scan for disclosure footer OR allow-list |
| **True positive** | Undisclosed dangling refs (real cold-boot blockers) | **≤47 (likely much fewer after FP-2 audit)** | Apply Option-B disclosure per #4038 pattern |

The 47-pair catalog count below stays as-is for methodology-comparison
purposes — subtracting confirmed FPs (≥1 from FP-1, ≥1 from FP-2)
gives ≤45 true-positive citations. After running a proximity-scan
audit, true count likely drops further. The delta-vs-#4041 methodology
comparison (47 file:line vs 29 unique-ref) still holds at the
methodology layer because both audits share the same FP exposure.

## Why this catalog is needed (not redundant with #4041)

PR #4041 establishes the **systemic count + scope** ("29 dangling refs
across 4 surfaces, 6× scaling, not P0"). This catalog provides the
**addressability** — the specific file:line pairs that a fix PR (or
the proposed `tools/hygiene/audit-dangling-memory-refs.ts` substrate-
engineer candidate) needs to enumerate. Without this catalog, a fix
PR has to re-run the audit and tablet-find the sites; with it, the
fix is a mechanical traversal of this list.

The 18-edge delta (47 file:line pairs vs 29 unique refs) is the
operationally-load-bearing finding: **`sort -u` dedup hides ~38% of
the citation sites needing repair**. The substrate-engineer candidate
must NOT use `sort -u`.

## Composes-with

- [PR #4041](https://github.com/Lucent-Financial-Group/Zeta/pull/4041)
  (the count-by-surface memo this catalog extends with line-level data)
- [PR #4031](https://github.com/Lucent-Financial-Group/Zeta/pull/4031)
  (the original 5-ref rules-only audit)
- [PR #4033](https://github.com/Lucent-Financial-Group/Zeta/pull/4033)
  (peer-Otto-Desktop's Option B for 3 of the original 5)
- [PR #4038](https://github.com/Lucent-Financial-Group/Zeta/pull/4038)
  (cherry-pick adding Option B for the 5th original ref — the one
  `sort -u` hid as a multi-citation site, motivating the methodology
  gap critique that produced this catalog)
- `tools/hygiene/audit-memory-references.ts` (existing tool —
  audits ONLY `memory/MEMORY.md`; does NOT walk other surfaces;
  the substrate-engineer candidate would extend it OR be a new sibling)
- Future 081KRW63S0008QG0R0030EQ67Z (proposed: substrate-engineer-candidate row for
  the multi-surface `tools/hygiene/audit-dangling-memory-refs.ts`
  TS tool + CI integration; per next-window plan in
  [tick 2026-05-17 0421Z](../docs/hygiene-history/ticks/2026/05/17/0421Z))
- `.claude/rules/wake-time-substrate.md` (the discipline the dangling
  refs violate at cold-boot scope)

## How to apply

For each file:line pair in the catalog:

1. Determine if the cited memory file is constitutional (load-bearing
   for substrate operation; cite-able from rules without dilution) →
   Option A: promote user-scope → in-repo `memory/feedback_*.md`
2. Otherwise → Option B: rewrite citation to include the disclosure
   footer noting "user-scope-only; resolves on Aaron's Otto-CLI via
   auto-load; cold-boot agents on fresh checkouts see this as
   dangling" (per the #4038 r2 pattern)
3. Multi-citation sites (the 18 hidden edges) need the fix applied
   at EACH file:line site, not just one (the bug `sort -u` dedup
   would have hidden)

Mechanizable: the proposed substrate-engineer candidate TS tool
would emit this list automatically in CI, with `--enforce` failing
on any new dangling ref above a baseline.

## Next-window action items

When safe-window opens (per [tick 0418Z](../docs/hygiene-history/ticks/2026/05/17/0418Z.md)
named dep: Lior absent from `ps -A` + multi-Otto contention eased):

1. Commit this catalog along with the rest of Group A-F per 0418Z
   prescription
2. File 081KRW63S0008QG0R0030EQ67Z row for substrate-engineer candidate (citing this
   catalog as the design-input data)
3. Either fix the high-priority dangling refs (the `.claude/rules/`
   5 + the `docs/backlog/P2/081KQNJ500008QG0R001THCSKV` placeholder bug) OR file a
   separate row for the fix campaign
