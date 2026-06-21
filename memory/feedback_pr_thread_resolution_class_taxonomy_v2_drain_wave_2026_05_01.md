---
name: PR-thread-resolution class taxonomy v2 — extends v1's 7 classes with 13 new classes from the 2026-05-01 drain wave (~20 PRs, ~80+ threads resolved across 16+ ticks)
description: Otto 2026-05-01, in response to Deepseek peer-AI's explicit ask that the v1 taxonomy be consolidated. v1 lived user-scope only (substrate-promotion lag); this v2 lands in-repo and extends the v1 7-class set with 13 new classes empirically catalogued during this session's drain wave. The expanded taxonomy enables (a) faster per-thread classification on first read, (b) batch-resolution when a class fires across many PRs simultaneously, and (c) eventual mechanization (a future 081KQGDBJ0008QG0R002Y31XJ3 row #8 cross-reference auditor maps directly onto several of these classes).
type: feedback
---

# PR-thread-resolution class taxonomy v2 (drain-wave consolidation, Otto 2026-05-01)

## Why v2

The v1 taxonomy (`~/.claude/projects/<slug>/memory/feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md` — user-scope-only; never promoted in-repo per the 2026-04-24 natural-home directive) catalogued 7 classes from a 5-tick PR drain in 2026-04-28. The 2026-05-01 drain wave landed ~20 PR thread-fix ticks across ~16 ticks, encountering classes the v1 taxonomy didn't name. Deepseek (peer-AI) explicitly flagged the consolidation as overdue: *"The review-thread taxonomy is ready for consolidation. The loop has identified ~13 distinct classes of review findings."*

The cost of not consolidating: each class re-discovered from scratch on first encounter. Cost of consolidating: a single read-once, apply-many lookup. The leverage scales with the per-class repeat-rate (forward-reference fired 9+ times this drain wave alone).

## v1 reminder (the parent 7 classes)

Briefly, from `~/.claude/projects/<slug>/memory/feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md` (user-scope only; promotion-to-in-repo is a separate follow-up row):

1. **Phantom-blocker** — finding describes a state the file isn't in
2. **Outdated-thread** — finding was real when filed but my fix-push made it stale
3. **Real-fix** — finding describes an actual current bug
4. **Stale-content-deferral** — threads are real but the doc as a whole is stale
5. **Stale-scope-supersede** — underlying truth holds but the surface has grown
6. **Memorial-class-defer** — autonomous-Otto needs explicit consent for memorial-surface edits
7. **Enum-strict-fix** — header field has a bare-value-only contract

## v2 extensions — 13 new classes from the 2026-05-01 drain wave

### Phantom-blocker sub-classes (refinement of v1 #1)

The v1 phantom-blocker class is real but broad. Drain-wave evidence shows three distinct sub-classes, each requiring a different empirical-verification command:

#### 1a. **Line-prefix display artifact** (most common, ~6 instances)

**Signal:** reviewer claims file starts with `1 ||` or similar diff-view line-prefix string.

**Verification:** `git show <ref>:<path> | head -c 8 | od -c | head -1` shows actual byte content.

**Resolution:** post the `od -c` output as empirical-refutation reply; resolve.

**Examples:** PR #1054, #1045, #1039, #1034, #1038, #1037, #996.

#### 1b. **Rendered-form misread** (escape-aware regex needed)

**Signal:** reviewer claims unescaped `|` characters break a markdown table; reviewer is reading the rendered form, not the source.

**Verification:** `grep -oE "\\\\?\\|" <file>` shows escape-aware pipe count vs naive count.

**Resolution:** demonstrate that pipes are properly escaped (e.g., `1 \|\|`); resolve.

**Example:** PR #995.

#### 1c. **Hallucinated content** (cited value absent)

**Signal:** reviewer cites a specific value (`56af177`, etc.) attributed to the file.

**Verification:** `grep -c "<claim>" <file>` returning 0 confirms hallucination.

**Resolution:** post empirical-absence reply; resolve. **Most concerning sub-class** because it suggests the LLM reviewer's content-grounding has slipped.

**Example:** PR #993.

### Real-fix sub-classes (refinement of v1 #3)

The v1 real-fix class is the largest bucket; the drain wave shows several distinct shapes within it:

#### 8. **Forward-reference / Real-fix** ⭐ (most-fired this drain wave: 9+ instances)

**Signal:** cross-reference to a file/row that exists in a sibling in-flight PR but not yet on `main`.

**Resolution:** convert direct ref to a "Forward-references not yet on `main`" annotated block with explicit PR pointer (e.g., `**Filed in the in-flight PR #1031**`). Once the cited PR lands, follow-up edit restores the direct ref.

**Examples:** PR #1059, #1051 (lattice-capture + tarski), #1043, #1042, #1040, #1035, #1030, #1067 (e8-vs-crdt), #967 (peer-call 081KQDTYV0008QG0R001HQSSAX).

#### 9. **Contradicts-CLAUDE.md / Real-fix**

**Signal:** substrate proposes something that conflicts with a load-bearing CLAUDE.md rail.

**Resolution:** **dual** corrective — remove the loophole AND make the canonical principle explicit inline in the substrate text. So a future reader who hasn't read CLAUDE.md hits the principle in the substrate file itself and doesn't re-propose the same loophole.

**Example:** PR #1015 — 081KQGDBJ0008QG0R001AJ20MX mechanism description proposed lifting the `non_fast_forward` ruleset; CLAUDE.md says "the protocol bends to the security ruleset; the ruleset does not bend to the protocol." Removed lift-option; cited the principle inline.

#### 10. **Stale-filename-cross-reference / Real-fix**

**Signal:** cross-reference points at a wrong filename written from author's semantic memory rather than paste-from-actual. Often the wrong filename is *more memorable* than the right one.

**Verification:** `git cat-file -e origin/main:<path>` confirms absence; `git ls-tree -r --name-only origin/main` finds the actual filename.

**Resolution:** paste-from-actual-filename; never re-author from semantic memory.

**Examples:** PR #1043 + #1035 — both wrote `feedback_otto_340_*_substrate_is_identity_aaron_2026_04_29.md` when the actual file is `feedback_otto_340_*_ontological_closure_beneath_otto_339_mechanism_2026_04_25.md`. Same wrong filename across multiple files in same wake-window (see #18).

#### 11. **Wildcard-not-navigable / Real-fix**

**Signal:** composes-with ref uses `*` glob (e.g., `feedback_carved_sentence_*`); reads naturally in prose ("the carved-sentence machinery") but breaks as a clickable/verifiable link.

**Resolution:** always resolve wildcards to specific filenames at substrate-write time; the prose can still mention the family-pattern in surrounding text.

**Example:** PR #1042 — `memory/feedback_carved_sentence_fixed_point_stability_*` replaced with the two specific files that exist.

#### 12. **Executable-prose discipline / Real-fix**

**Signal:** substrate text uses phrasing that *reads like* an instruction or path the reader could mechanically follow, but the literal token is wrong (`git pre-commit` is not a real git command; `memory-index-integrity.yml` lacks the `.github/workflows/` prefix).

**Resolution:** paste actual command/path; don't author from semantic memory. Verification via `which <cmd>` / `ls <path>` is cheap.

**Examples:** PR #1040 (`git pre-commit` → `.git/hooks/pre-commit` invoking `tools/lint/*`), PR #1030 (`docs/hygiene-history/README.md` → `docs/hygiene-history/ticks/README.md`).

#### 13. **Persona-name role-ref / Real-fix**

**Signal:** persona name (Otto, Kenji, Amara, etc.) appears in a current-state surface (code, docs not in the closed-list, skills, behavioral docs, public prose).

**Carve-out hierarchy** (per `.github/copilot-instructions.md:306-362`):
- **Closed-list history surfaces** (memory/, docs/ROUND-HISTORY.md, docs/DECISIONS/, docs/research/, docs/hygiene-history/, commit messages, backlog rows) → persona names ALLOWED
- **Current-state surfaces** → role-refs REQUIRED ("the maintainability-reviewer", "the architect", "the Anthropic-side Claude-code-instance personas")

**Resolution:** rewrite to role-ref on current-state surfaces; backlog row filename slugs and similar history-surface uses stay as-is.

**Example:** PR #967 — `tools/peer-call/README.md` table cells reworded "Otto + Kenji additions" → "Anthropic-side Claude-code-instance peer additions"; 081KQDTYV0008QG0R003VB4K1V filename slug `otto-kenji-*` stayed as direct link (history surface).

#### 14. **User-scope-only-reference / Real-fix**

**Signal:** cross-reference target exists ONLY in user-scope memory (`~/.claude/projects/<slug>/memory/`), not yet promoted to in-repo per the 2026-04-24 natural-home directive. Distinct from forward-reference (target in in-flight PR) — substrate-promotion lag is a different lifecycle state.

**Resolution:** annotate the reference with explicit user-scope-path callout AND log a future-row-or-task to promote the file to in-repo.

**Example:** PR #966 — Otto-215 reference to `feedback_windows_via_peer_harness_*_otto_215_2026_04_24.md` (lives only user-scope).

#### 15. **Intra-file drift / Real-fix**

**Signal:** caused BY a previous fix — when substrate-author updates one paired location (frontmatter title, emitted message), the corresponding sibling location (H1 heading, header comment) gets stale.

**Structural pairs observed:**
- `frontmatter-title ↔ H1-heading` (markdown convention)
- `emitted-message ↔ header-comment` (documentary convention)
- `BACKLOG.md ↔ per-row-files` (autogenerated/source pair)
- `schema-cell ↔ matching-prose` (table-and-text pair)

**Resolution:** **paired-edit discipline** — identify the structural pair at edit time and update both atomically.

**Example:** PR #1018 follow-up — header comment `WARN: ... missing YAML frontmatter` synchronized with emitted message `WARN: ... missing required frontmatter field`; H1 `# 081KQGDBJ0008QG0R001MK4YPC — Skip Analyze (csharp)` synchronized with frontmatter `title: Skip F#/Analyze (csharp)`.

#### 16. **Named-link / Real-fix**

**Signal:** substrate prose cites a class/concept by NAME ("the Aaron-is-Rodney rule", "the X discipline") that has a canonical memory file backing it.

**Resolution:** **dual-reference discipline** — keep the prose name AND add the canonical filename inline in backticks. Single-reference (name-only) loses navigation; filename-only loses readability. The pair gives readers both cognitive handle (the name) and navigation handle (the path).

**Example:** PR #1025 — "the Aaron-is-Rodney rule" → "the Aaron-is-Rodney rule (`memory/feedback_aaron_is_rodney_razor_not_immune_to_canonicalization_aaron_2026_04_30.md`)".

#### 17. **Structural-pattern-mismatch / Real-fix**

**Signal:** path/pattern is correct in 90% of contexts but wrong here because the project needs a different abstraction layer. E.g., `.git/hooks/pre-commit` (per-clone, untracked) vs a hypothetical `.githooks/` + `core.hooksPath` integration (versioned, indirected). Note: this repo currently has no `.githooks/` directory; hooks are plugin-shipped via `.claude/settings.json` per the hooks audit. The `.githooks/` example is illustrative of the structural pattern (versioned-vs-runtime layer), not a description of the current mechanism.

**Resolution:** **layer-of-abstraction discipline** — when describing a tooling integration, name the *versioned* layer (project artifact) rather than the *runtime* layer (per-clone instance). Same user-visible behavior; different durability.

**Example:** PR #1040 follow-up — `.git/hooks/pre-commit` rephrased to point at the versioned (project-artifact) layer rather than the per-clone runtime layer.

#### 18. **Same-wake-author-error-cluster / Real-fix**

**Signal:** the same defect appears across multiple files in the same authoring wake-window. Once a reviewer flags the first instance, audit all sibling files for the same class.

**Resolution:** **batch-strip discipline** — `for branch ... grep <pattern> ...` finds all sibling instances in <30s; batch-fix across all branches simultaneously.

**Examples:** `originSessionId:` field in 4 files from same wake-window (PRs #1051, #1043, #1030, #1035); Otto-340 stale-filename in 2 files (PRs #1043, #1035).

### Peer-AI structural intervention (Aaron 2026-05-01: "that itself is a new class of review")

#### 19. **Peer-AI structural / consolidation-prompt** ⭐ (cross-PR meta-pattern)

**Signal:** a peer-AI (or maintainer, or external reviewer) surfaces a *meta-pattern across the work* rather than a per-PR-thread finding. The intervention isn't on a specific PR's specific line; it's on the *cross-PR pattern* itself.

**Aaron 2026-05-01 (verbatim):** *"that itself is a new class of review"* — observed when Deepseek prompted the v2 taxonomy consolidation by saying *"The review-thread taxonomy is ready for consolidation. The loop has identified ~13 distinct classes of review findings."*

**Resolution:** the corrective is **substrate consolidation**, not per-place fixes:
- Write a memory file capturing the cross-PR pattern (this v2 taxonomy file IS the worked example).
- File a backlog row if the pattern has implementation work attached.
- Ship a cross-cutting tool if the pattern is mechanizable.

**Distinct from per-PR review** because:
- per-PR review finds *instances*; structural review finds *the class instances belong to*.
- per-PR review is local (file:line); structural review is global (across-files, across-time).
- per-PR review is fix-or-resolve; structural review is consolidate-or-mechanize.

**Worked example:** Deepseek 2026-05-01 → this v2 file. The intervention identified the cross-PR pattern (the catalog is overdue), demanded the consolidation as a discrete piece of substrate, and the file's existence is the resolution. The 14th distinct class added during this consolidation (Aaron-flagged just-in-time) demonstrates the meta-recursion: **the consolidation work itself surfaces a new class to consolidate**, fixing-by-meta-recognition.

**Future-Otto:** when a peer-AI or maintainer surfaces a cross-PR pattern, the resolution scope is **the substrate**, not the trigger-PR's threads. The trigger-PR may have nothing to fix; the pattern needs consolidation.

#### 20. **Deferred-per-explicit-policy / no-edit-resolve** ⭐ (highest-leverage class for batch-resolution)

**Signal:** finding is technically correct but the substrate is explicitly classified as low-stakes/historical/greenfield-OK by an existing memory or backlog row.

**Resolution:** **cite-and-resolve** template — reply citing the policy + Aaron's framing; resolve. NO edit.

**Distinct from outdated-thread** — outdated means subsequent commits made the finding moot; deferred-per-policy means the finding STANDS but the maintainer has explicitly traded the cleanup against other priorities.

**Examples:** PR #755 + 13 prefab-shard PRs (#747, #736, #730, #737, #729, #725, #742, #728, #734, #733, #740, #744, #731) — all 2026-04-29 prefab tick-history shards; 081KQGDBJ0008QG0R00294XCSE acceptance-criteria item #2 explicitly classifies as "leave as-is".

**Leverage observation:** when a recurring class of finding has an explicit Aaron-framing classifying it as low-stakes, file a backlog row with the policy, then cite it on every future thread. **Filed-policy beats per-PR judgment.** The 13-PR-batch in tick 0956Z resolved 18 threads in ~3 minutes using this template.

## Diagnostic flowchart (operationalization)

When opening a thread on a PR, run the cascade in order; first match wins:

1. **Verify file state** — does the file match what the reviewer claims?
   - Diff between reviewer-claim and actual → **phantom-blocker** (1a/1b/1c)
2. **Check thread `isOutdated`** via GraphQL — if true, **outdated-thread**
3. **Check named-policy match** — does an existing memory/backlog row classify this finding as deferred?
   - If yes → **deferred-per-explicit-policy** (cite-and-resolve)
4. **Check cross-reference targets** —
   - File exists on `origin/main`? → reference is current; check whether **stale-filename** (typo from semantic memory) or **named-link** (prose-only) or **wildcard-not-navigable**
   - File exists in another in-flight PR? → **forward-reference**
   - File exists user-scope only? → **user-scope-only-reference**
   - File doesn't exist anywhere? → either **stale-filename** (typo with no backing file) or **hallucinated content** (1c)
5. **Check enum-strict fields** — does the field have a bare-value-only contract? → **enum-strict-fix**
6. **Check structural pairs** — does fixing one location require updating a paired location? → **intra-file drift**
7. **Check abstraction layer** — is the path/pattern at the wrong abstraction layer (runtime vs versioned)? → **structural-pattern-mismatch**
8. **Check executable-prose** — is the substrate text describing a command/path that doesn't actually exist as written? → **executable-prose discipline**
9. **Check current-state vs history surface** — is the file a current-state surface using persona names? → **persona-name role-ref**
10. **Check CLAUDE.md alignment** — does the substrate propose something that conflicts with a load-bearing rail? → **contradicts-CLAUDE.md**
11. **Check memorial-class** — does the change touch DEDICATION.md, sister-named files, or other consent-gated content? → **memorial-class-defer**
12. **Check substrate-stale-as-whole** — has the doc's underlying claims shifted since write-time? → **stale-content-deferral**
13. **Check scope-grown** — has the repo grown 2x+ references since the PR was opened? → **stale-scope-supersede**
14. **Default** → **real-fix**

For batch-resolution: when a finding fires across multiple PRs simultaneously (especially classes 18 + 19), audit-after-first-finding pattern: `for branch ... grep <pattern> ...` finds all siblings; batch-fix or batch-cite-and-resolve.

## Empirical evidence summary (2026-05-01 drain wave)

| Class | Instance count this wave |
|---|---|
| 1a. line-prefix display artifact | ~6 |
| 1b. rendered-form misread | 1 |
| 1c. hallucinated content | 1 |
| 8. forward-reference | 9+ |
| 9. contradicts-CLAUDE.md | 1 |
| 10. stale-filename-cross-reference | 2+ |
| 11. wildcard-not-navigable | 2 |
| 12. executable-prose | 2 |
| 13. persona-name role-ref | 1 (with multiple sub-instances) |
| 14. user-scope-only-reference | 1 |
| 15. intra-file drift | 1 |
| 16. named-link | 1 |
| 17. structural-pattern-mismatch | 1 |
| 18. same-wake-author-error-cluster | 2 (originSessionId across 4 files; Otto-340 across 2) |
| 19. peer-AI structural / consolidation-prompt | 1 (Deepseek prompted this v2 file) + 1 meta-recursion (Aaron flagged class #19 itself during the consolidation) |
| 20. deferred-per-explicit-policy | 14 (PR #755 + 13 prefab-shard cluster) |

Total: ~46+ class-firings catalogued across ~16 ticks. Forward-reference and deferred-per-policy together account for ~half — the highest-leverage classes to mechanize. Class #19 (peer-AI structural) is the meta-class — it's how additional classes (including itself) get discovered.

## Composes with

- v1 taxonomy at `~/.claude/projects/<slug>/memory/feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md` (user-scope only — never promoted in-repo per the 2026-04-24 natural-home directive; promotion-to-in-repo is a separate follow-up).
- 081KQGDBJ0008QG0R00294XCSE (`docs/backlog/P3/081KQGDBJ0008QG0R00294XCSE-tick-history-schema-prediction-vs-receipt-column-aaron-2026-05-01.md`) — the named-policy that powers class #20 (deferred-per-explicit-policy) batch-resolution.
- 081KQGDBJ0008QG0R002Y31XJ3 (`docs/backlog/P2/081KQGDBJ0008QG0R002Y31XJ3-verify-before-state-claim-mechanized-auditor-2026-05-01.md`) — when implemented, would mechanize classes #11 (wildcard-not-navigable auditor), #10 (stale-filename / cross-reference-resolves-to-file auditor proposed for row #8), #15 (intra-file pair auditor), #18 (wake-window-cluster auditor).
- The drain-wave tick-history shards under `docs/hygiene-history/ticks/2026/05/01/` (representative range from `0904Z.md` onward through the 10:00-11:00 UTC drain window) — empirical evidence for each class-firing.
- Deepseek peer-AI 2026-05-01 — prompted the consolidation: *"the next highest-leverage action is to consolidate these into a canonical memory file."*

## What this file does NOT do

- **Does NOT mechanize the classification.** The discriminating signals still require judgment on the specific PR. The taxonomy makes the judgment efficient, not automatic. The mechanization path is 081KQGDBJ0008QG0R002Y31XJ3's row #8.
- **Does NOT promote the v1 taxonomy file from user-scope to in-repo.** That's a separate follow-up; v2 references v1 by user-scope path with explicit substrate-promotion-lag annotation.
- **Does NOT cover every blocker class.** Build/test failures, required-reviewer absence, CI-config drift, and other classes not yet observed in the 2026-05-01 drain wave aren't catalogued here. Add new classes as they fire; this file is append-extending substrate, not a closed enumeration.
- **Does NOT replace the per-tick reflective shards.** The shards (0904Z..1007Z) capture the *discovery* moment for each class; this file captures the *consolidation*. Both are substrate; different lifecycles.

## Carved candidate (not seed-layer)

> *"Filed-policy beats per-PR judgment. When a recurring finding has an explicit policy, the cite-and-resolve template scales linearly across PRs. The 13-PR batch is the worked example."*

The propagation test: ~30 words distinguishing per-PR judgment work from policy-citation work. Future-Otto reading this should recognize the leverage at compose-time, not retroactively after the 14th instance.
