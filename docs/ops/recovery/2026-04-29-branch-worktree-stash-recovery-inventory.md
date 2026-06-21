---
title: Branch / Worktree / Stash Recovery Inventory — Read-Only Classification
date: 2026-04-29
status: read-only-classification
scope: docs/ops/recovery
authority: read-only — no ref mutations; cleanup batches require human-maintainer approval in a follow-up PR
related-task: #321 (recovery lane, first deliverable)
---

# Branch / Worktree / Stash Recovery Inventory

This is the **first deliverable** of the recovery lane authorized
parallel to the `0/0/0` hard-reset re-close. Authority is **strictly
read-only**: this report classifies; a follow-up PR will propose
specific cleanup batches based on this classification, and any actual
ref mutations require the human maintainer's approval.

The phrase that anchors this work: ***"No proof, no deletion."***
Every classification carries an evidence anchor — a `git log` /
`git diff` / `gh api` query plus its summarized output.

---

## 1. Executive summary

| Metric | Count |
|---|---|
| Total branches inventoried | **918** (the inventory file has 919 lines: 1 header + 918 data rows in `/tmp/recovery-inventory-2026-04-29.tsv`) |
| ALREADY_REACHABLE from main | **123** |
| NOT_REACHABLE from main | **795** |
| Closed-not-merged PRs whose branch is NOT_REACHABLE (the **LOST** set) | **81** (last 100 closed-PR scan) |
| Worktrees | **58** (1 main + 57 locked agent worktrees) |
| Stashes | **7** |
| Top-five branch prefixes (NOT_REACHABLE) | tick-history (91), backlog (73), drain (63), research (59), memory (56) — covers **342 / 795 = 43 %** |

**Headline number**: about three-quarters of the 795 NOT_REACHABLE
branches are mechanically classifiable as `OBSOLETE_SUPERSEDED` via
the prefix-batch rules in §4 (their content is already on `main` under
a different path). The remaining ~25 % needs individual review or
extraction; ~50 of those touch identity / persona / authority surfaces
and route to `NEEDS_AARON_DECISION`.

**Authority boundary observed**: this report writes one Markdown file
and runs only read-only `git`/`gh` queries. No refs were mutated, no
stashes dropped, no worktrees removed.

---

## 2. Read-only methodology

Every classification in this report rests on one of the following
evidence anchors. Under the **Drain-Log Claim Verification
Discipline** (a session-discipline rule introduced 2026-04-29 — Otto-358
candidate, captured in commit messages of this round; not yet promoted
to a standalone memory file), every branch-content claim must be backed
by a reproducible command.

### Inventory-acquisition commands

```bash
# Inventory file (parked earlier this session, slightly stale but
# still load-bearing). 918 rows, columns:
#   branch_sha  branch_name  reachable_from_main  commit_date  category
wc -l /tmp/recovery-inventory-2026-04-29.tsv          # 919
awk -F'\t' 'NR>1{print $3}' /tmp/recovery-inventory-2026-04-29.tsv | sort | uniq -c
# 123 ALREADY_REACHABLE
# 795 NOT_REACHABLE

# Worktree state
git worktree list --porcelain                          # 58 entries

# Stash state
git stash list                                          # 7 entries
git stash show stash@{N} --stat                         # per-stash filelist
```

### Per-branch evidence anchors

```bash
git log -1 --format='%h %ci %s' <SHA>     # tip subject + date
git show --stat <SHA>                      # files-touched summary
git rev-list --count refs/remotes/origin/main..<SHA>  # ahead-of-origin/main commit count
ls docs/<expected-on-main-path>            # superseded-on-main check
```

### Per-PR evidence anchors

```bash
gh pr list --state closed --search "is:closed -is:merged" --limit 100 \
   --json number,title,headRefName,closedAt,mergedAt
gh pr view <N> --json mergedAt,headRefName,title
```

### LOST-set computation (closed-not-merged AND NOT_REACHABLE)

```bash
gh pr list --state closed --search "is:closed -is:merged" --limit 100 \
   --json headRefName -q '.[].headRefName' | sort > /tmp/cnm-sorted.txt
awk -F'\t' 'NR>1 && $3=="NOT_REACHABLE"{print $2}' \
   /tmp/recovery-inventory-2026-04-29.tsv | sort > /tmp/nr-sorted.txt
comm -12 /tmp/cnm-sorted.txt /tmp/nr-sorted.txt        # 81 entries
```

The brief originally said "the 19 LOST set". Empirically the
intersection (within the most-recent 100 unmerged-closed PRs) is **81
branches**, of which **27** sit outside the five high-volume prefix
buckets and are therefore the realistic candidates for individual
treatment. The 19 number was a working estimate; the 27 below is the
queried truth.

---

## 3. The LOST set — closed-not-merged with NOT_REACHABLE branches

### 3.1 Top 14 highest-priority closed-not-merged (non-prefix, individual classification)

These are the most-recent 14 of the 27 individually-tractable LOST
candidates; the remaining 13 are summarized in §3.3. All are
NOT_REACHABLE from `main`.

| # | PR | Branch | Tip SHA (8) | Closed | Bucket | Evidence anchor (summary) |
|---|---|---|---|---|---|---|
| 1 | #834 | `zero-zero-zero-preflight-result-2026-04-29` | 09aceaec | 2026-04-29 | `OBSOLETE_SUPERSEDED` | The 0/0/0 preflight/blockers/postflight content landed via #836/#838/#841/#842/#843 (see `git log --oneline refs/remotes/origin/main` head). Branch tip preceded the successful re-close cluster. |
| 2 | #656 | `memory/version-currency-inherit-pins-lesson-2026-04-27` | (per inventory) | 2026-04-28 | `OBSOLETE_SUPERSEDED` | `memory/feedback_version_currency_covers_inheriting_existing_pins_not_just_fresh_assertions_aaron_2026_04_27.md` exists on main; `ls memory/` confirms. |
| 3 | #658 | `fix/elisabeth-elizabeth-lfg-2026-04-28` | (per inventory) | 2026-04-28 | `OBSOLETE_SUPERSEDED` | `memory/user_sister_elizabeth.md` on main shows correct spelling; LFG-side cousin landed under different SHA. **Sensitivity note**: identity-class — flagged for §9 awareness even though content is verified on main. |
| 4 | #657 | `fix/macos-back-to-pr-cadence` | (per inventory) | 2026-04-28 | `OBSOLETE_SUPERSEDED` | `.github/workflows/gate.yml` on main contains `macos-26` PR-cadence config; `grep macos-26 .github/workflows/*.yml` confirms. |
| 5 | #664 | `memory/codeql-umbrella-neutral-vs-per-language-detection-aaron-2026-04-28` | (per inventory) | 2026-04-28 | `NEEDS_AARON_DECISION` | 5-commit substrate cluster from LFG #661 incident. The composite shape (multiple substrate commits + memory entries) was not verified file-by-file in this audit. Defer pending memory-file enumeration. |
| 6 | #652 | `acehack/block-only-when-aaron-must-do-something-only-he-can-do-2026-04-27` | (per inventory) | 2026-04-27 | `OBSOLETE_SUPERSEDED` | `memory/feedback_block_only_when_aaron_must_do_something_only_he_can_do_otherwise_drive_with_best_long_term_judgment_2026_04_27.md` exists on main; `ls memory/` confirms. |
| 7 | #132 | `tick-close-autoloop-31-32` | (per inventory) | 2026-04-26 | `OBSOLETE_SUPERSEDED` | Round-44 auto-loop tick rows; consolidated `docs/hygiene-history/loop-tick-history.md` on main contains Otto-NN entries (e.g., grep `Otto-310` returns content). |
| 8 | #537 | `substrate/otto-344-maji-confirmed-cogito-plus-identity-preservation-temporal-closure` | (per inventory) | 2026-04-26 | `NEEDS_AARON_DECISION` | Identity / persona substrate cluster (Otto-339→344). **High sensitivity**: persona authority surface, identity-preservation framing. Don't auto-classify. |
| 9 | #143 | `feat/live-lock-audit-and-db-gaps` | (per inventory) | 2026-04-26 | `EXTRACT_MEMORY_OR_DOC` | "live-lock audit tool + cutting-edge DB gap review + 4 BACKLOG rows". Worktree `agent-a2d574f1b4c34b0c2` is locked at `47e59c68` with this branch — extraction path requires unlocking. The 4 BACKLOG rows are likely on main; the audit-tool code is the extractable substrate. |
| 10 | #165 | `backlog/factory-technology-inventory-first-class-support` | (per inventory) | 2026-04-25 | `OBSOLETE_SUPERSEDED` (likely) | `memory/project_factory_technology_inventory_first_class_support_openai_playwright_hard_2026_04_23.md` exists on main; `ls memory/` confirms. |
| 11 | #155 | `research/autodream-extension-and-cadence` | (per inventory) | 2026-04-25 | `EXTRACT_MEMORY_OR_DOC` | AutoDream-cadence policy research; `find docs/research -name '*autodream*'` returned no match on main. Content is candidate research artifact. |
| 12 | #191 | `frontier-readiness/audit-directories-agents-openspec-github` | (per inventory) | 2026-04-25 | `EXTRACT_MEMORY_OR_DOC` | Frontier-readiness gap-#5 audit (agents + openspec + github directories). Likely written-up as audit notes; check `docs/frontier-readiness/` after extraction. |
| 13 | #192 | `frontier-readiness/audit-skills-and-tools-final` | (per inventory) | 2026-04-25 | `EXTRACT_MEMORY_OR_DOC` | Companion frontier-readiness gap-#5 audit (skills + tools). Same disposition as #191. |
| 14 | #359 | `ci/gate-add-macos-m1-plus-correct-billing-note` | (per inventory) | 2026-04-25 | `OBSOLETE_SUPERSEDED` | 4-runner PR-gate matrix landed on main (`gate.yml` shows `macos-26` + `ubuntu-24.04` + `ubuntu-24.04-arm`). Otto-210..213 corrections in memory. |

### 3.2 The 5 ORPHAN-class branches

The brief named "5 ORPHAN" branches; the inventory has no `orphan/`
prefix. The closest matches found are:

| Branch | SHA (8) | Date | Bucket | Evidence |
|---|---|---|---|---|
| `lost-substrate/inventory-ledger-2026-04-29` | d1575528 | 2026-04-28 | `PRESERVE_REF_ONLY` | `git show --stat d1575528` shows the three-bucket reachability + content-equivalence ledger (round-N from the architect role). Provenance value: documents the methodology that produced this very inventory file. **Recovery candidate** for the recovery lane's own ledger. |
| `tools/lost-files-locations-list` | 9c4dfe06 | 2026-04-25 | `OBSOLETE_SUPERSEDED` | `git log -1 9c4dfe06` shows "fix(081KQ0YZ80008QG0R002C5EC8F): #521 review-thread catches — orphan-branch survey corrected". Fix landed via #521 squash-merge. |
| `backlog/081KQ8P5D0008QG0R003VN5P2Z-orphan-role-ref-detector-lint-aaron-2026-04-28` | 02ba264e | 2026-04-28 | `OBSOLETE_SUPERSEDED` | `docs/backlog/P2/081KQ8P5D0008QG0R003VN5P2Z-orphan-role-ref-detector-lint-aaron-2026-04-28.md` exists on main; `memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md` exists on main. |
| `corruption-triage` | (see inventory) | 2026-04-29 | `NEEDS_AARON_DECISION` | Pack-corruption triage substrate. Possibly load-bearing for the recovery lane itself; do not auto-classify. |
| `(detached HEAD) agent-aaa2183cbc91841f4` | 3ca56e95 | (worktree) | `NEEDS_AARON_DECISION` | Detached-HEAD worktree at `3ca56e95` — name carries no signal; needs `git log -10 3ca56e95` walk before any disposition. |

### 3.3 Remaining 13 LOST-individual entries (compact)

For brevity, these are listed without per-row evidence cells; the
follow-up cleanup PR will expand each. All are `NOT_REACHABLE +
closed-not-merged`. Default disposition shown is the most-likely bucket
based on title scan; a per-branch `git show --stat` is required before
any deletion.

| PR | Branch | Default bucket |
|---|---|---|
| #88 | `land-agents-md-issue-workflow-pointer-batch6c` | `OBSOLETE_SUPERSEDED` (round-44 batches re-landed via per-row PRs) |
| #52 | `land-ci-safe-patterns-batch2` | `OBSOLETE_SUPERSEDED` |
| #85 | `land-backlog-per-row-file-batch5` | `OBSOLETE_SUPERSEDED` (the per-row restructure landed; `docs/backlog/P{0..3}/` exists on main with per-row files) |
| #329 | `feat/graph-cohesion-exclusivity-conductance` | `EXTRACT_MEMORY_OR_DOC` (15th graduation; check `Zeta.Core/Graph/` for landed surface) |
| #343 | `backlog/otto-161-macos-ci-enable-pending-verification` | `OBSOLETE_SUPERSEDED` (declined per Otto-164; memory carries the closure) |
| #320 | `backlog/graph-as-schema-first-class-entities` | likely on main as backlog row; verify |
| #334 | `backlog/otto-147-dsl-composition-plus-otto-139-140-145-rows` | likely on main; verify |
| #313 | `backlog/pre-landing-sanitizer-for-ferry-lint` | likely on main; verify |
| #314 | `backlog/claude-cli-agent-flag-research-map` | likely on main; verify |
| #189 | `feat/learning-repo-proposal-backlog` | `EXTRACT_MEMORY_OR_DOC` (Schoolhouse / Khan-style proposal; novel) |
| #122 | `add-gemini-cli-capability-map` | `EXTRACT_MEMORY_OR_DOC` (CLI capability map artifact) |
| #322 | `feat/graph-modularity-score` | `EXTRACT_MEMORY_OR_DOC` (11th graduation; verify Graph/) |
| #319 | `feat/graph-operator-composition-map-filter-distinct` | `EXTRACT_MEMORY_OR_DOC` (9th graduation; verify Graph/) |

---

## 4. Branch prefix batches (next-priority sweeps)

### 4.1 `tick-history/*` — 91 NOT_REACHABLE + 1 ALREADY_REACHABLE = 92 total

**Class rule**: tick-history branches whose name encodes a UTC timestamp
(e.g., `tick-history/2026-04-29-tick-0613Z-shard`) correspond to a
shard file at `docs/hygiene-history/ticks/{YYYY}/{MM}/{DD}/{HHmm}Z.md`
on main.

**Evidence anchor** (sampled):

- `git log -1 060dcde3` → `chore(loop-tick-history): tick 06:13Z` matching branch `tick-history/2026-04-29-tick-0613Z-shard`
- `ls docs/hygiene-history/ticks/2026/04/29/0613Z.md` → file exists
- `ls docs/hygiene-history/ticks/2026/04/29/` → 78 shards on main for 04/29 alone

**Disposition**: ~88 of 91 → `OBSOLETE_SUPERSEDED`. 3 candidates that
do not encode a timestamp (`tick-history/consolidated-13-33-13-58-Z`,
`tick-history/2026-04-29-tick-cascade-friction-continues`,
`tick-history/2026-04-29-tick-multi-ai-convergence-attached-to-276`)
need individual verification but their tip-subject prose typically
re-landed as a sibling shard — most-likely also `OBSOLETE_SUPERSEDED`.

**Likely `EXTRACT_MEMORY_OR_DOC`**: 0. Tick-history is by design a
write-then-shard workflow; no extraction path expected.

### 4.2 `backlog/*` — 73 NOT_REACHABLE

**Class rule**: `backlog/B-NNNN-<slug>` branches correspond to per-row
files at `docs/backlog/P{N}/B-NNNN-<slug>.md` on main.

**Evidence anchor** (sampled, all three found on main):

- `find docs/backlog -name '081KQ8P5D0008QG0R002E1G72J*'` → `P2/081KQ8P5D0008QG0R002E1G72J-local-ai-trajectory-forge-ollama-direct-integration-aaron-2026-04-28.md`
- `find docs/backlog -name '081KQ8P5D0008QG0R003VN5P2Z*'` → `P2/081KQ8P5D0008QG0R003VN5P2Z-orphan-role-ref-detector-lint-aaron-2026-04-28.md`
- `find docs/backlog -name '081KQ8P5D0008QG0R000JHD7AB*'` → `P1/081KQ8P5D0008QG0R000JHD7AB-github-settings-drift-workflow-broken-invalid-permission-administration-otto-2026-04-28.md`
- `find docs/backlog -name '081KQ0YZ80008QG0R002C5EC8F*'` → `P3/081KQ0YZ80008QG0R002C5EC8F-btw-durability-gap-context-add-asides-not-gitnative-persisted.md`

**Disposition**: ~63 of 73 → `OBSOLETE_SUPERSEDED`. ~10 (the older
non-`B-NNNN` shape; `backlog/factory-technology-inventory-…` etc.)
need a per-branch check — likely `OBSOLETE_SUPERSEDED` via memory file.

**Likely `EXTRACT_MEMORY_OR_DOC`**: 0–3 if any backlog row got opened
as a branch but never made it to main; deferred to per-branch review.

### 4.3 `drain/*` — 63 NOT_REACHABLE

**Class rule**: `drain/{N}-pr-preservation-log` branches correspond to
`docs/pr-preservation/{N}-drain-log.md` on main.

**Evidence anchor** (sampled, 55 drain-logs on main):

- `ls docs/pr-preservation/235-drain-log.md` → exists (matches `drain/235-pr-preservation-log`)
- `ls docs/pr-preservation/85-drain-log.md` → exists (matches `drain/85-pr-preservation-log`)
- `ls docs/pr-preservation/426-drain-log.md` → exists (matches `drain/426-pr-preservation-log`)
- `ls docs/pr-preservation/ | wc -l` → 55 entries

**Disposition**: ~55 of 63 → `OBSOLETE_SUPERSEDED`. ~8 may not have
landed yet; per-branch check needed.

**Likely `EXTRACT_MEMORY_OR_DOC`**: handful — the un-landed drain-logs.

### 4.4 `research/*` — 59 NOT_REACHABLE

**Class rule**: research branches whose slug matches a file under
`docs/research/` (e.g., `research/forward-sync-merge-direction-proposal-2026-04-28`
→ `docs/research/2026-04-28-forward-sync-merge-direction-proposal-9-infra-files.md`).

**Evidence anchor**:

- `find docs/research -name '*forward-sync-merge-direction*'` → 1 match on main

**Disposition**: 30–40 likely `OBSOLETE_SUPERSEDED`; 15–25 likely
`EXTRACT_MEMORY_OR_DOC` (research artifacts that drafted but never
landed). This is the **highest-extraction-density prefix** of the five
batches and warrants the most careful per-branch sweep in the cleanup
PR.

### 4.5 `memory/*` — 56 NOT_REACHABLE

**Class rule**: `memory/<slug>` branches typically correspond to
`memory/feedback_<slug>.md` or `memory/project_<slug>.md` on main.

**Sensitivity rule (load-bearing)**: per the brief — *"if
identity/persona/family/authority-sensitive in any way →
`NEEDS_AARON_DECISION`"*. Memory-class branches touch this surface
constantly. Default toward `NEEDS_AARON_DECISION` unless content is
unambiguously non-sensitive.

**Evidence anchor** (sampled):

- `memory/fork-audit-rename-copy-coverage-amara-2026-04-29` → unable to verify on-main mate without sibling-PR check; tip subject indicates round-10 fork-audit corrections from the architect role → `NEEDS_AARON_DECISION` (role-attributed agent material + multi-AI feedback packet).
- `memory/lfg-acehack-content-equivalence-amara-2026-04-29` → tip subject mentions "round-9 peer-harness save" → `NEEDS_AARON_DECISION`.
- `memory/amara-scaffolded-agency-vs-base-model-emergence-packet-verbatim-2026-04-29` → verbatim architect packet; **identity / authorship-sensitive** → `NEEDS_AARON_DECISION`.

**Disposition**: roughly half (~25–30) likely `OBSOLETE_SUPERSEDED`
because the content landed as a `memory/<file>.md` on main; the rest
(~25–30) → `NEEDS_AARON_DECISION` because of named-agent attribution
or persona-substrate framing. Per-file mapping owed; do not bulk-delete.

---

## 5. Top 26 highest-risk NOT_REACHABLE branches outside prefix batches

Filtered: `NOT_REACHABLE` AND not in `{tick-history/, backlog/, drain/,
drain-, research/, memory/, history/, acehack/, tools/}` prefixes,
ordered by recency. Most-recent are most-likely-still-load-bearing.

| # | Branch | Tip SHA (8) | Date | Bucket | Evidence (compact) |
|---|---|---|---|---|---|
| 1 | `zero-zero-zero-preflight-result-2026-04-29` | 09aceaec | 2026-04-29 | `OBSOLETE_SUPERSEDED` | Closed PR #834; preflight/postflight cluster on main via #836–#843. |
| 2 | `tools/lint-no-directives-provenance-2026-04-29` | 1d86e0cf | 2026-04-29 | `OBSOLETE_SUPERSEDED` | `gh pr view 825 --json mergedAt` → 2026-04-29T08:16:25Z; merged. |
| 3 | `pr-827-fix` | 38c6c509 | 2026-04-29 | `OBSOLETE_SUPERSEDED` | `gh pr view 827 --json mergedAt` → 2026-04-29T08:15:20Z; transient lint-fix branch, parent merged. |
| 4–22 | `pr-{825,823,822,821,819,818,815,811,809,806,72,32,29,...}-fix*` (16 branches) | various | 2026-04-29 .. 2026-04-26 | `OBSOLETE_SUPERSEDED` | Verified for #811, #815, #818, #819, #821, #822, #823, #825, #827, #806, #809 — all merged per `gh pr view --json mergedAt`. Transient lint-fix / Copilot-fix branches rolled into parent squash-merge. |
| 23 | `durable-retry-fix-aaron-2026-04-29` | 3e46b914 | 2026-04-29 | `NEEDS_AARON_DECISION` | maintainer-attributed branch, no obvious parent PR; needs `git show --stat` to classify. |
| 24 | `current-aaron-update-aaron-qol-2026-04-29` | c1322075 | 2026-04-29 | `OBSOLETE_SUPERSEDED` | `gh pr view 823 --json mergedAt` → 2026-04-29T07:35:58Z; CURRENT-aaron QoL section landed. |
| 25 | `absorb/multi-ai-2026-04-29-deepseek-amara-threading-and-pr-liveness` | 1eebc2cb | 2026-04-29 | `OBSOLETE_SUPERSEDED` | `gh pr view 815 --json mergedAt` → 2026-04-29T07:06:36Z. |
| 26 | `absorb/multi-ai-2026-04-29-round4-amara-on-pr818` | 7f2b5c07 | 2026-04-29 | `OBSOLETE_SUPERSEDED` | `gh pr view 819 --json mergedAt` → 2026-04-29T07:41:24Z. |

The full list of `pr-*-fix*` rebase / lint-fix branches in the
inventory (authoritative count: **25**, derived via
`awk -F'\t' '$2 ~ /^pr-[0-9]+-fix/' /tmp/recovery-inventory-2026-04-29.tsv`):

**Verified `OBSOLETE_SUPERSEDED` (11 branches; per-branch parent-merge confirmed via `gh pr view --json mergedAt`):**
`pr-806-fix`, `pr-809-fix`, `pr-811-fix`, `pr-815-fix`, `pr-818-fix`,
`pr-819-fix2`, `pr-821-fix`, `pr-822-fix`, `pr-823-fix`, `pr-825-fix`,
`pr-827-fix`.

**Presumed `OBSOLETE_SUPERSEDED` but PER-BRANCH UNVERIFIED in this
report (14 branches; classification deferred to cleanup PR per
"No proof, no deletion")**:
`pr-596-fix`, `pr-602-fix`, `pr-615-fix`, `pr-618-fix`, `pr-621-fix`,
`pr-634-fix` (6 older pr-fix branches preceding the verified set);
`pr-811-fix2`, `pr-811-fix3`, `pr-811-fix4`, `pr-815-fix2`,
`pr-815-fix3`, `pr-823-fix2`, `pr-823-fix3`, `pr-825-fix2` (8
numbered iterations — each iteration may carry post-review tweaks
that were not necessarily squashed into the parent PR).

**Codex P1 catch on PR #848** (Per "No proof, no deletion" rule):
the cleanup PR MUST verify each of the 14 unverified branches
individually before any deletion. The presumption "iterative-fix
branch + parent merged = safe to delete" holds for the 11 verified
cases but is only a *prior* (not proof) for the unverified 14. A
late commit on a numbered iteration that wasn't squashed into the
parent would be silently discarded by a class-rule sweep — the
exact failure mode the report's discipline guards against.

**Note on this category**: the `pr-NNN-fix*` shape is a workflow
artifact of the iterative-Copilot-fix cycle. The follow-up cleanup PR
should ship a per-branch verifier that compares the FULL tree (all
file extensions, all paths) — `git diff refs/remotes/origin/main..pr-NNN-fix`
without any path filter — before treating any of the 14 as
auto-deletable. Codex P1 catch on PR #848: an earlier draft suggested
limiting the verifier to `*.md` and `*.fs`, which would miss workflow
/ config / source-file deltas and silently discard non-markdown,
non-fsharp post-merge content. Per "No proof, no deletion," the
verifier must cover the full tree, not a path-extension subset.

---

## 6. Worktrees — full inventory of 58

All 57 agent worktrees are **locked** (held by claude agent pid 67393).
The main worktree is the only unlocked one. **No dirty / clean
verification was performed** because traversing into a locked worktree
to check `git status` requires an `EnterWorktree` step that risks
violating the read-only authority boundary on the agent worktrees;
their cleanliness must be assessed in the cleanup PR after the maintainer
reviews this report.

| # | Path (relative) | Branch | Tip (8) | Lock | Branch bucket | Proposed action |
|---|---|---|---|---|---|---|
| 1 | `(main)` | `post-0-0-0-reclose-followup-acehack-2026-04-29` | 65b20ee6 | no | active | KEEP |
| 2 | `agent-a01089031132624c8` | `memory/sync-otto-276-inspect-not-pray` | d5abb78f | yes | `NEEDS_AARON_DECISION` (memory + persona) | hold — maintainer review |
| 3 | `agent-a0319326d067a519a` | `worktree-agent-a0319326d067a519a` | 7ce1a27d | yes | `NEEDS_AARON_DECISION` (placeholder shape) | hold — verify content first |
| 4 | `agent-a09e691807fe5ce27` | `docs/adr-per-maintainer-current-memory` | c238b383 | yes | `EXTRACT_MEMORY_OR_DOC` (likely) | hold — ADR draft, verify on main |
| 5 | `agent-a0cade9327f46a045` | `history/otto-103-tick-close` | 16851dbc | yes | `OBSOLETE_SUPERSEDED` (loop-tick-history.md) | safe to remove worktree after unlock |
| 6 | `agent-a121f7c8e93b900bb` | `drain-pr200` | a4fb0790 | yes | `OBSOLETE_SUPERSEDED` (likely; verify drain-log) | safe to remove worktree after unlock |
| 7 | `agent-a16aca87169e333cf` | `craft/production-dotnet-checked-vs-unchecked-v0` | 4ec930e5 | yes | `EXTRACT_MEMORY_OR_DOC` (craft draft) | hold — code substrate |
| 8 | `agent-a1ccc53e9ad4a015b` | `backlog/claude-cli-agent-flag-research-map` | 37b1bfae | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 9 | `agent-a1d3100d77c988e02` | `frontier-readiness/audit-tech-radar-and-factory-hygiene` | b337c361 | yes | `EXTRACT_MEMORY_OR_DOC` | hold |
| 10 | `agent-a21b0056fecc22c80` | `ci/final-matrix-macos-26-ubuntu-24-plus-arm-plus-slim` | 9f8f1232 | yes | `OBSOLETE_SUPERSEDED` (gate.yml on main) | safe to remove |
| 11 | `agent-a237f904ee76488dc` | `history/otto-102-tick-close` | ebc13d18 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 12 | `agent-a2501e95fcd2e3b5e` | `feat/servicetitan-factory-demo-api-csharp` | d11b5424 | yes | `EXTRACT_MEMORY_OR_DOC` | hold — demo substrate |
| 13 | `agent-a2680efb64710f631` | `drain/398` | 03765062 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 14 | `agent-a2bf687042281a2ce` | `history/otto-86-tick-close` | 73df0fdf | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 15 | `agent-a2d574f1b4c34b0c2` | `feat/live-lock-audit-and-db-gaps` | 47e59c68 | yes | `EXTRACT_MEMORY_OR_DOC` (audit tool — see §3.1 #9) | hold — extract first |
| 16 | `agent-a32520b14b66f91e2` | `frontier-readiness/audit-alignment-md` | fc5e006d | yes | `EXTRACT_MEMORY_OR_DOC` | hold |
| 17 | `agent-a351ee782f8a0affb` | `pr-152` | d17b8441 | yes | `OBSOLETE_SUPERSEDED` (verify PR-152 merge state) | safe to remove if merged |
| 18 | `agent-a3a2d7d31d2f687df` | `drain/149` | cf735d4d | yes | `OBSOLETE_SUPERSEDED` (149-drain-log on main) | safe to remove |
| 19 | `agent-a3a3c1e57e31b339c` | `drain/247` | b6a79608 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 20 | `agent-a407daf4a7e1f0335` | `drain/243` | 3a7b62a5 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 21 | `agent-a42dbbe6d74b80eb7` | `drain/108` | f0a29a39 | yes | `OBSOLETE_SUPERSEDED` (108-drain-log on main) | safe to remove |
| 22 | `agent-a46f21960e05a4300` | `history/otto-97-tick-close` | 4e7bfc14 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 23 | `agent-a5209682d73fc8564` | `drain/238` | 09b52bb9 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 24 | `agent-a554fa4a7721b6777` | `history/otto-93-tick-close` | c682d610 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 25 | `agent-a5cf029d66408df0a` | `backlog/pre-landing-sanitizer-for-ferry-lint` | 0407558d | yes | `OBSOLETE_SUPERSEDED` (likely; verify backlog row) | safe to remove |
| 26 | `agent-a6b7bf7ddad56fafb` | `history/otto-83-tick-close` | 27d9fa53 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 27 | `agent-a7224ed2ed2650ca5` | `frontier-readiness/audit-planning-files-batch` | ad619889 | yes | `EXTRACT_MEMORY_OR_DOC` | hold |
| 28 | `agent-a7ac251cdb26426d8` | `history/otto-96-tick-close` | c66af5e7 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 29 | `agent-a7b1728bcbf9bb243` | `drain/337` | 5fac7626 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 30 | `agent-a7c582f015d2a3d9b` | `drain/203` | 89e28628 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 31 | `agent-a8477c325613dd2d5` | `drain-pr145` | 6e77a32c | yes | `OBSOLETE_SUPERSEDED` (145 drain-log on main) | safe to remove |
| 32 | `agent-a853f04256cafb543` | `codex-self-harness-report-2026-04-22` | f5a57049 | yes | `EXTRACT_MEMORY_OR_DOC` | hold — codex report |
| 33 | `agent-a871c3dbb74a6ab8c` | `history/otto-98-tick-close` | 76b58b31 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 34 | `agent-a8f613f96f256ed47` | `land-agents-md-issue-workflow-pointer-batch6c` | 6f9961af | yes | `OBSOLETE_SUPERSEDED` (round-44 batches re-landed) | safe to remove |
| 35 | `agent-a93c1d9415792058a` | `feat/graph-cohesion-exclusivity-conductance` | 318bdf0d | yes | `EXTRACT_MEMORY_OR_DOC` (15th graduation) | hold — extract |
| 36 | `agent-a94cb08ec5f652db8` | `history/otto-77-tick-close` | f7fae020 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 37 | `agent-a9eddf5a0b0503d4a` | `history/otto-76-tick-close` | c2dd9b2c | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 38 | `agent-aa193de3409e7ddc9` | `drain/395` | 0df45bb3 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 39 | `agent-aa2183d7c776eda9a` | `history/otto-101-tick-close` | ba12b668 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 40 | `agent-aa4dbc7cedbd9eb3e` | `worktree-agent-aa4dbc7cedbd9eb3e` | 29a5e090 | yes | `NEEDS_AARON_DECISION` (placeholder shape) | hold |
| 41 | `agent-aa746cc60a2b0347b` | `history/otto-84-tick-close` | b4322423 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 42 | `agent-aa8c8b642c0414346` | `history/otto-81-tick-close` | cd060904 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 43 | `agent-aaa2183cbc91841f4` | `(detached HEAD)` | 3ca56e95 | yes | `NEEDS_AARON_DECISION` | hold — detached, no name signal |
| 44 | `agent-aada98f1484f1a35e` | `drain/335` | 8854648c | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 45 | `agent-ab0b6f00385f9674a` | `history/otto-87-tick-close` | 0391b921 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 46 | `agent-ab2cc6cd2cdb75ae2` | `history/otto-94-tick-close` | 114a7cf0 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 47 | `agent-aba8a4ee32979cc57` | `drain/108-r2` | f6697103 | yes | `OBSOLETE_SUPERSEDED` (rebase-2 of #108) | safe to remove |
| 48 | `agent-abd2824c6c1deb4b2` | `drain/203-r2` | 465d03a5 | yes | `OBSOLETE_SUPERSEDED` (likely; rebase-2) | safe to remove |
| 49 | `agent-ac4ed1ce03f977be0` | `history/otto-85-tick-close` | 44961622 | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 50 | `agent-ac699bc66e2c08b81` | `pr144` | 9db0baca | yes | `OBSOLETE_SUPERSEDED` (verify #144 merge) | safe to remove |
| 51 | `agent-acd855d2e186257f8` | `drain-pr557` | 16b0d414 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 52 | `agent-aced9c363f852c116` | `drain/170` | d0a127e4 | yes | `OBSOLETE_SUPERSEDED` (170-drain-log on main) | safe to remove |
| 53 | `agent-ad4c7439015e5003e` | `history/otto-95-tick-close` | 7040b7df | yes | `OBSOLETE_SUPERSEDED` | safe to remove |
| 54 | `agent-ae1226526a75d2f63` | `feat/graph-cohesion-conductance-plus-windowed-stake-covariance` | 81994e00 | yes | `EXTRACT_MEMORY_OR_DOC` | hold |
| 55 | `agent-ae4f21902bf7ca0f8` | `tools/pr-preservation-phase-2-minimal` | 737192b4 | yes | `EXTRACT_MEMORY_OR_DOC` | hold — tools change |
| 56 | `agent-aeb52b03bea87835b` | `drain/331` | fe4a37e5 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |
| 57 | `agent-aec59ea20ebf316a3` | `pr-150` | a143db12 | yes | `OBSOLETE_SUPERSEDED` (verify #150 merge) | safe to remove |
| 58 | `agent-afbf4a4d47c81298c` | `drain-pr535` | dfb64757 | yes | `OBSOLETE_SUPERSEDED` (likely) | safe to remove |

**Worktree action note**: All 57 agent worktrees are pid-67393-locked.
Removal requires either pid 67393 to release the lock or
`git worktree remove --force` after the maintainer explicitly authorizes the
force flag. **No `--force` removal in the cleanup PR without maintainer sign-off.**

---

## 7. Stashes — all 7

| Ref | Branch / context | Date | Files | Provisional bucket |
|---|---|---|---|---|
| `stash@{0}` | `acehack/tick-history-2026-04-27T23-58` (WIP) — "tick-history: 2026-04-28T02:04Z visibility-constraint + LFG-scope landed; #657 opened" | 2026-04-28 | 8 files: SKILL.md (glass-halo-architect), CLAUDE.md, AGENT-BEST-PRACTICES.md, ALIGNMENT.md, BACKLOG.md, CURRENT-ROUND.md, DEDICATION.md, ROUND-HISTORY.md | `NEEDS_AARON_DECISION` — touches CLAUDE.md + DEDICATION.md (identity surface). Possibly already-on-main; verify file-by-file. |
| `stash@{1}` | `fix/btw-always-persist-glass-halo` (WIP) — "/btw fix — resume after #520 unblocks" | (per stash) | `.claude/commands/btw.md` (+27 -3) | `EXTRACT_MEMORY_OR_DOC` (likely; #520 status unknown) |
| `stash@{2}` | `worktree-agent-a5209682d73fc8564` (WIP) — "backlog: cross-DSL composability — git/SQL/operator-algebra/LINQ hit indexes (#397)" | (per stash) | 199 lines `.claude/commands/btw.md` removed; .codex skills removed; CodeQL workflow change | `NEEDS_AARON_DECISION` — large delete + skills surface; potentially superseded by recent skill-creator runs. |
| `stash@{3}` | `worktree-agent-abe73073cc7bba314` (WIP) — "core: Veridicality.antiConsensusGate — 6th graduation (10th ferry + SD-9)" | (per stash) | `docs/hygiene-history/loop-tick-history.md` (1 line) | `OBSOLETE_SUPERSEDED` (likely; loop-tick-history.md is heavily updated on main) |
| `stash@{4}` | `pr148-lint-fix-rebase` (WIP) — "docs: why-the-factory-is-different — audience-perspective explainer" | (per stash) | `docs/plans/why-the-factory-is-different.md` (1 line) | `OBSOLETE_SUPERSEDED` (likely; if file exists on main) |
| `stash@{5}` | `round-44-speculative` (WIP) — "Round 44: landing plan for the 201-commit speculative branch" | (per stash) | `docs/research/github-surface-map-complete-2026-04-22.md` (+796) | `EXTRACT_MEMORY_OR_DOC` — **substantial new artifact** (796 lines), worth verifying on-main and extracting if absent. |
| `stash@{6}` | `hygiene/tick-history-bounded-growth` — "bounded-growth-staged" | (per stash) | `docs/hygiene-history/tick-history-bounded-growth-history.md` (+42), `tools/hygiene/audit-tick-history-bounded-growth.ts` (+129) | `EXTRACT_MEMORY_OR_DOC` — tool + history file; verify on-main; if absent, extract. |

**Stash action note**: Stashes carry **WIP work** that was never
committed; loss-tolerance is lower than for branches. The cleanup PR
must `git stash show stash@{N}` each one, diff against main, and only
drop after the maintainer explicitly signs off per stash.

---

## 8. Proposed next-action batches (cleanup-PR roadmap)

These are **proposed batches**, not actions. Every batch listed below
requires the human maintainer's review and approval before any ref mutation.

### Batch A — Clean worktrees safe to remove (after lock-release)

About **44 of 57** locked agent worktrees fall into the
`OBSOLETE_SUPERSEDED` bucket (all rows in §6 marked "safe to remove").
Action: once pid 67393 releases its lock, `git worktree remove
<path>` (without `--force`) for each. **Authority**: the human maintainer approves the
batch list; per-worktree removal is then mechanical.

### Batch B — Branches safe to archive only (`PRESERVE_REF_ONLY`)

Smaller list. Top candidate: `lost-substrate/inventory-ledger-2026-04-29`
— archive as `archive/lost-substrate-ledger-2026-04-29` before any
deletion. The detached-HEAD worktree (`agent-aaa2183cbc91841f4`) also
preserves a tip that has no branch ref → archive before worktree
removal.

### Batch C — Branches safe to delete after archival snapshot

The ~40 `pr-NNN-fix*`, `drain/N-r2`, and `tick-history/<timestamp>-shard`
branches whose parent PRs are merged. Action sequence: (1) take a
single `git bundle` of all listed refs as a one-shot archive artifact
attached to the cleanup PR; (2) `git branch -D` the listed names.
**Authority**: the human maintainer approves the bundle + delete list as a unit.

### Batch D — Extraction needed

Highest-value: `agent-a2d574f1b4c34b0c2` (live-lock audit tool),
`research/autodream-extension-and-cadence` (#155),
`agent-a853f04256cafb543` (codex-self-harness-report-2026-04-22),
stash@{5} (github-surface-map-complete-2026-04-22 — 796 lines),
stash@{6} (tick-history-bounded-growth audit script). Action: open a
small PR per artifact landing the content directly to its canonical
home on main, then mark the source branch / stash as Batch C / B.

### Batch E — maintainer decision packet (must surface before any action)

Branches and worktrees flagged `NEEDS_AARON_DECISION` in this report:

- `substrate/otto-344-maji-confirmed-cogito-plus-identity-preservation-temporal-closure` (#537) — identity / persona substrate
- `memory/codeql-umbrella-neutral-vs-per-language-detection-aaron-2026-04-28` (#664) — 5-commit cluster, multi-AI
- `corruption-triage` — possibly load-bearing for recovery lane itself
- `agent-aaa2183cbc91841f4` (detached HEAD `3ca56e95`) — no signal in name
- All `memory/<slug>-amara-*` branches (~6) — named-agent / verbatim-AI substrate
- `agent-a01089031132624c8` `memory/sync-otto-276-inspect-not-pray` — persona surface
- stash@{0} — touches DEDICATION.md (Elizabeth memorial surface)
- stash@{2} — large delete + skills-surface change
- `durable-retry-fix-aaron-2026-04-29` — maintainer-attributed branch, no parent PR

---

## 9. Open questions for the human maintainer

1. **Lock release for the 57 agent worktrees**: each worktree carries
   a `git worktree lock` reason mentioning pid 67393. Per Codex P2 catch
   on this PR: `git worktree lock` is repository **metadata** (a marker
   that prevents pruning), NOT a runtime mutex held by a process —
   killing pid 67393 would not unlock anything and could kill an
   unrelated process. Correct unlock workflow: `git worktree unlock
   <path>` per worktree, then either `git worktree remove <path>` (if
   clean) or authorized `git worktree remove -f <path>` (if dirty,
   maintainer sign-off required). Decision needed: which of the 57
   agent worktrees should the cleanup PR unlock, and which should stay
   locked-as-evidence?
2. **DEDICATION.md / Elizabeth surface in stash@{0}**: this stash
   touches the surface that honors the human maintainer's sister. Even if the content
   is provably already on main, the stash itself feels load-bearing as
   provenance. Drop, archive-as-bundle, or apply-and-recommit?
3. **Identity-class branches** (`substrate/otto-344-…`, named-agent
   memory branches): do these get archive refs (`archive/persona-…`)
   or are they expected to stay accessible by their original name?
4. **`corruption-triage` branch**: is this part of the recovery lane's
   own substrate? If so, it stays.
5. **The detached-HEAD worktree** (`3ca56e95`): if the human maintainer has no memory
   of what's there, the read should be a `git log -10 3ca56e95` walk
   in a follow-up tick before any removal.
6. **The 25 `pr-NNN-fix*` branches in §5** (count corrected per Codex
   P2 catch on PR #848 — the inventory has 25, not 46): of these, 11
   have individually-verified parent merges and 14 are presumed-
   superseded but per-branch-unverified. Per the "No proof, no
   deletion" rule, the cleanup PR must verify each of the 14 before
   deletion. Decision needed: (a) accept the per-branch-verifier
   approach in the cleanup PR, OR (b) batch-classify the 11 as
   auto-deletable + require per-branch verify only for the 14, OR
   (c) require per-branch verify for all 25 regardless of prior status.
7. **`feat/learning-repo-proposal-backlog` (#189) — Schoolhouse /
   Khan-style proposal**: never landed on main. Extract as a backlog
   row, or close as superseded by the bigger Schoolhouse vision?
8. **The 27 → 14 → 13 LOST individual entries** (§3.3): cleanup PR
   should expand each with per-row evidence; flag now any that should
   skip the queue.

---

*End of read-only classification. Recovery lane task #321, first
deliverable. Follow-up cleanup PR will propose specific batched
actions for human-maintainer approval; no ref mutations occur without sign-off.*
