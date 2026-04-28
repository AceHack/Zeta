# AceHack -> LFG cherry-pick audit (option-c sync) -- 2026-04-26

**Status:** in-flight (loop agent)

**Authorising directive:** the human maintainer 2026-04-26

> "lets do c to be careful, we can do them in batches if you
> want but don't miss anyting. acehack is older so there might
> be major refactoris to get older ideas into the newer ideas."

> "double check the superseded always for PRs when you decide
> that, would be good to ask another cli"

**Diagnostic baseline (verified 2026-04-26):**

- `git rev-list --count acehack/main..origin/main` -> **453**
  (LFG ahead of AceHack)
- `git rev-list --count origin/main..acehack/main` -> **60**
  (AceHack-unique commits to audit)

**Discipline (Otto-347, mandatory):**

For every commit I classify as `SUPERSEDED-DISCARD` below, I
spawn a fresh subagent (or another CLI) to re-diagnose cold
before the discard lands. KEEP if the 2nd agent disagrees or
returns UNCLEAR. Record both audits inline in the
"2nd-agent audit" column.

## Tier definitions

| Tier | Action |
|------|--------|
| `MISSING-LANDS` | Target file does not exist on LFG -> bring forward as-is or with light architecture reconciliation. Lowest risk; no supersede call. |
| `EXISTS-MERGE` | Target exists on LFG; AceHack content adds substantive substrate not on LFG -> rewrite into current architecture. Per-file content audit required. |
| `SUPERSEDED-DISCARD` | Target exists on LFG; AceHack content equivalent or already absorbed downstream -> discard. **Otto-347 2nd-agent verify required before this lands.** |
| `TICK-HISTORY-SKIP` | Tick-history append-row -> per Otto-229 these are append-only, do NOT cherry-pick (each writer's own surface). |
| `META` | Markdownlint / formatting / commit-message-only -> low-stakes, single-agent classification fine. |

## The 60 AceHack-unique commits

Listed newest-first as `git log` produced them; classification
shown in the right column. Where 2nd-agent verify is required
(`SUPERSEDED-DISCARD`), the verify state is logged inline.

| # | Hash | Commit | Tier | Notes / 2nd-agent audit |
|---|------|--------|------|-------------------------|
| 1 | 2aabb0d | fix: AceHack markdownlint debt -- unblocks PR #12 CI (#13) | META | Markdownlint-only across BACKLOG + marketing + research; bundles into batch-1 alongside the file-creation commits. |
| 2 | 5b2f1ac | research: AceHack/LFG cost-parity audit -- Otto-61/62 directive (#11) | MISSING-LANDS | `docs/research/acehack-lfg-cost-parity-audit-2026-04-23.md` not on LFG. |
| 3 | 943dbb5 | human-backlog: HB-003 -- github-settings baseline drift decision needed | EXISTS-MERGE | `docs/HUMAN-BACKLOG.md` exists on LFG; need diff to decide if HB-003 already present. |
| 4 | a99feef | BACKLOG: meta-section pointer to ISSUES-INDEX.md | EXISTS-MERGE | BACKLOG.md heavy-churn; may have been migrated to per-row format. |
| 5 | d6ded51 | docs: land ISSUES-INDEX.md -- git-native record of LFG issues #55-82 | EXISTS-MERGE | LFG already has `docs/ISSUES-INDEX.md`; check content equivalence. |
| 6 | fab9c4b | marketing: market-research draft companion to positioning draft | MISSING-LANDS | File missing on LFG. |
| 7 | 3258147 | security+BACKLOG: anomaly-detection capability row + prompt-injection corpora observational index | MISSING-LANDS | `docs/security/KNOWN-PROMPT-INJECTION-CORPORA-INDEX.md` missing on LFG; BACKLOG portion is EXISTS-MERGE. |
| 8 | 9df4d8b | BACKLOG: meta-cognition row -- retract third-order ceiling | EXISTS-MERGE | BACKLOG row only. |
| 9 | 8b6faf1 | BACKLOG: meta-cognition as first-class factory discipline | EXISTS-MERGE | BACKLOG row only. |
| 10 | 8e66e44 | BACKLOG: superfluid + persistable* + shape-shifter + actor-model + team-wide own-goals | EXISTS-MERGE | BACKLOG row only. |
| 11 | 1f2a682 | research: Aaron Knative contributor history -- welcome-pole yin-yang | MISSING-LANDS | File missing on LFG. |
| 12 | 341f17c | research: OSS contributor-handling lessons from Aaron's bitcoin/bitcoin#33298 | MISSING-LANDS | File missing on LFG. |
| 13 | ab72470 | research: Actor Model operational-resonance | MISSING-LANDS | File missing on LFG. |
| 14 | 4177691 | research: Layer 5 (sixth same-day revision) -- fully async agentic AI | MISSING-LANDS | `capture-everything-and-witnessable-evolution-2026-04-21.md` missing. |
| 15 | e8a96fd | research: capture-everything + witnessable self-directed evolution | MISSING-LANDS | Same file as #14; squash into one commit when bringing forward. |
| 16 | fd0ac50 | backlog: capture-everything round | EXISTS-MERGE | BACKLOG row only. |
| 17 | dfeec06 | marketing: docs/marketing/ retractable-drafts subtree + first positioning draft | MISSING-LANDS | `docs/marketing/` missing on LFG. |
| 18 | 8535e6b | backlog: all-schools-all-subjects P2 row + PR/marketing recalibration | EXISTS-MERGE | BACKLOG row only. |
| 19 | 3a2ba5c | research: yin-yang composition-discipline sweep over operational-resonance | MISSING-LANDS | File missing on LFG. |
| 20 | a3837d0 | backlog: economics/history P2 + PR/marketing P3 rows | EXISTS-MERGE | BACKLOG row only. |
| 21 | 2eef721 | backlog: 3/4-color theorem + mystery-schools/comparative-religion rows | EXISTS-MERGE | BACKLOG row only. |
| 22 | 5ca0584 | research: save-state-as-runtime-retractibility absorb note | MISSING-LANDS | File missing on LFG. |
| 23 | 17f38fb | fix: repoRoot discovery uses AppContext.BaseDirectory, not CWD | EXISTS-MERGE | Code change on `tests/Tests.FSharp/Formal/{Alloy,Tlc}.Runner.Tests.fs`. **Otto-347 verify** before classifying — current LFG impl may already use AppContext.BaseDirectory. |
| 24 | bab4ae1 | backlog: Lean reflection row | EXISTS-MERGE | BACKLOG row only. |
| 25 | 9c7f374 | backlog: two research rows | EXISTS-MERGE | BACKLOG row only. |
| 26 | 180f110 | backlog: P3 emulator-ideas-absorption row | EXISTS-MERGE | BACKLOG row only. |
| 27 | 993d6c2 | Round 44: decode grey-area -> grey hat | EXISTS-MERGE | BACKLOG row only. |
| 28 | 70d21c8 | Round 44: Pop-culture/media research track | EXISTS-MERGE | BACKLOG row only. |
| 29 | 177a981 | Round 44: fix SUPPLY-CHAIN-SAFE-PATTERNS curl\|bash self-contradiction (Copilot P0) | EXISTS-MERGE | **Otto-347 verify** -- LFG may already have the fix. |
| 30 | 7c5dc3c | fix(backlog): MD029 renumber + plant flag #12 | META | Markdownlint-only. |
| 31 | 1767008 | backlog: plant 11 CTF flags on unclaimed-edge territory | EXISTS-MERGE | BACKLOG row only. |
| 32 | 5990166 | backlog: add mythology + occult + AI-ethics research tracks | EXISTS-MERGE | BACKLOG row only. |
| 33 | b0e6ee1 | backlog: add etymology + epistemology research track | EXISTS-MERGE | BACKLOG row only. |
| 34 | aaee920 | fix: resolve markdownlint MD032/MD029 violations on PR #54 | META + MISSING-LANDS | `.claude/skills/github-repo-transfer/SKILL.md` + `docs/GITHUB-REPO-TRANSFER.md` missing on LFG. |
| 35 | df611cc | fix: drop dead span_seconds + *_epoch vars from project-runway.sh | MISSING-LANDS | `tools/budget/project-runway.sh` missing on LFG. |
| 36 | c91f004 | Round 44: land held kernel-domain glossary + belief-propagation BACKLOG row | EXISTS-MERGE | GLOSSARY + BACKLOG; check current GLOSSARY for kernel-domain. |
| 37 | db10ffb | Round 44: first fire of FACTORY-HYGIENE row #51 + follow-up BACKLOG rows | EXISTS-MERGE | hygiene-history + BACKLOG. |
| 38 | 0f22dc6 | Round 44: github-repo-transfer absorption | MISSING-LANDS | Multiple missing-on-LFG files. |
| 39 | 05ece84 | Round 44: Aaron 3-directive absorption (graceful-degradation + multi-SUT + offline-capable) | TICK-HISTORY-SKIP + EXISTS-MERGE | tick-history row (skip per Otto-229); BACKLOG row (merge). |
| 40 | 5f91369 | Round 44: project-runway.sh companion to budget-tracking substrate | MISSING-LANDS + TICK-HISTORY-SKIP | Budget tooling missing on LFG; tick row skip. |
| 41 | fcb7c3d | Round 44: evidence-based LFG budget-tracking substrate (N=1 baseline) | MISSING-LANDS + TICK-HISTORY-SKIP | `docs/budget-history/snapshots.jsonl` + `tools/budget/snapshot-burn.sh` missing on LFG. |
| 42 | 41d2bb6 | Round 44: ADR -- three-repo split (Zeta + Forge + ace) | EXISTS-MERGE | LFG has the ADR; check content. |
| 43 | 6593ead | Round 44: tick-history -- no-invent-vocabulary rule + 3-surfaces correction | TICK-HISTORY-SKIP | tick-history append-only. |
| 44 | 268100a | Round 44: UPSTREAM-RHYTHM.md -- 3 surfaces, not 2 | EXISTS-MERGE | LFG has UPSTREAM-RHYTHM.md; check content. |
| 45 | 2d1ca77 | Round 44: drop invented primary/dev-surface labels | EXISTS-MERGE | UPSTREAM-RHYTHM revision. |
| 46 | 174cdd2 | Round 44: clarify upstream = LFG (primary), AceHack = fork (dev-surface) | EXISTS-MERGE | UPSTREAM-RHYTHM revision. |
| 47 | 601a719 | Social-preview SVG + UI-only surface-map entry (#9) | MISSING-LANDS + EXISTS-MERGE | SVG missing on LFG; surface-map exists. |
| 48 | 16850ba | Round 44: scope update -- LFG is primary, AceHack is cost-opt dev-surface | EXISTS-MERGE | UPSTREAM-RHYTHM revision. |
| 49 | 0cd9d06 | Clean up pre-existing markdownlint violations (#10) | META | Markdownlint sweep across docs/. |
| 50 | d49a20e | Round 44: tick-history -- ruleset audit + budget-in-source policy | TICK-HISTORY-SKIP | tick-history append-only. |
| 51 | 4e01d78 | Round 44: ruleset audit findings on branch-protection row | EXISTS-MERGE | BACKLOG row; **Otto-347 verify** -- PR #589 Phase 4 may have absorbed. |
| 52 | 3f64431 | Round 44: tick-history -- SVG social-preview + markdownlint pre-existing-debt | TICK-HISTORY-SKIP | tick-history append-only. |
| 53 | cf660b8 | Round 44: surface-map-drift smell -- hygiene #50 + map-completeness BACKLOG (#8) | EXISTS-MERGE | Hygiene + BACKLOG + research-doc revision. |
| 54 | 5b64a3e | batch 6b/6: factory-level docs absorb -- 20 docs/*.md updates (#7) | EXISTS-MERGE | 20 docs touched; case-by-case. |
| 55 | cfb9044 | batch 6a/6: skill tune-up absorb -- 11 SKILL.md updates (#6) | EXISTS-MERGE | 11 SKILL.md updates; case-by-case. |
| 56 | 2941a7e | docs: file HB-002 -- four open questions blocking BACKLOG-per-row migration (#5) | EXISTS-MERGE | HUMAN-BACKLOG row. |
| 57 | c0cab2a | Round 44: ADR draft -- BACKLOG.md per-row-file restructure (P0 preventive for R45) (#4) | EXISTS-MERGE | LFG has the ADR; check content. |
| 58 | ebbc794 | docs: scout LFG-only capabilities; add 6th direct-to-LFG exception; P3 BACKLOG row (#3) | EXISTS-MERGE | UPSTREAM-RHYTHM + research-scout doc + BACKLOG. |
| 59 | 4a28b18 | docs: add UPSTREAM-RHYTHM.md -- Zeta's fork-first batched PR cadence (#2) | EXISTS-MERGE | UPSTREAM-RHYTHM exists on LFG. |
| 60 | b626436 | Round 44: GitHub surfaces + agent issue workflow -- batch 4 of 6 (#1) | EXISTS-MERGE | Multiple files exist on LFG. |

## Tier counts

- `MISSING-LANDS` (or includes-MISSING): **17 commits / 13 unique files** -- batch-1 (this PR's scope)
- `EXISTS-MERGE`: **38 commits** -- batches 2..N (per-commit content audit + Otto-347 verify)
- `TICK-HISTORY-SKIP`: **6 commits** -- skipped per Otto-229
- `META` (markdownlint-only): **4 commits** -- absorbed into batch-1 where they touch missing files; otherwise discardable as no-substantive-change (low-stakes META class allowed by Otto-347)
- **None classified `SUPERSEDED-DISCARD` yet** -- that classification only fires after explicit Otto-347 2nd-agent verify; no commit has reached that state.

## Batch-1 plan -- MISSING-LANDS (this PR)

Bring 13 missing files to LFG main as a single landing PR.
Pure additions; no supersession risk.

**Files to bring forward:**

1. `docs/research/acehack-lfg-cost-parity-audit-2026-04-23.md`
2. `docs/marketing/README.md`
3. `docs/marketing/positioning-draft-2026-04-21.md`
4. `docs/marketing/market-research-draft-2026-04-21.md`
5. `docs/security/KNOWN-PROMPT-INJECTION-CORPORA-INDEX.md`
6. `docs/research/aaron-knative-contributor-history-witnessable-good-standing-2026-04-21.md`
7. `docs/research/oss-contributor-handling-lessons-from-aaron-2026-04-21.md`
8. `docs/research/actor-model-hewitt-meijer-akka-orleans-service-fabric-2026-04-21.md`
9. `docs/research/capture-everything-and-witnessable-evolution-2026-04-21.md`
10. `docs/research/yin-yang-composition-discipline-sweep-2026-04-21.md`
11. `docs/research/save-state-as-retractibility-absorb-2026-04-21.md`
12. `docs/assets/social-preview.svg`
13. `docs/budget-history/README.md` + `tools/budget/project-runway.sh` + `tools/budget/snapshot-burn.sh`
14. `.claude/skills/github-repo-transfer/SKILL.md` + `docs/GITHUB-REPO-TRANSFER.md`

**Architecture-reconciliation light-touch (per the human
maintainer's "older ideas into newer ideas" framing):**

- Path-existence check only (already done).
- Header-discipline check per `GOVERNANCE.md` §33 if any
  reference external-conversation imports. Add the four
  required header fields if missing.
- `docs/AGENT-BEST-PRACTICES.md` BP-NN citations: leave
  intact; rule-IDs stable across LFG.
- Name-attribution per Otto-237/Otto-279: research surface
  is HISTORY-class -> first-name attribution allowed; no
  scrub.

**Otto-347 verify on batch-1:** **NOT REQUIRED** for
MISSING-LANDS commits (no supersede classification; pure
addition). The discipline applies to batches 2+ where
commits touch files that already exist on LFG.

## Batches 2..N -- EXISTS-MERGE

Approach: per-commit content audit. For each commit:

1. `git diff <commit>^..<commit> -- <touched-files>`
2. Compare against current LFG state of touched files.
3. Decide: is the AceHack content additive (merge), already
   present (META/SUPERSEDED), or in conflict (rewrite).
4. If decision is `SUPERSEDED-DISCARD`: spawn fresh
   subagent to verify per Otto-347.

Splitting into batches by surface for tractability:

- **Batch-2**: BACKLOG-row-only commits (commits 8-10, 16,
  18, 20-21, 24-28, 31-33). Likely consolidate to "BACKLOG
  row absorption" with current per-row-file architecture.
- **Batch-3**: UPSTREAM-RHYTHM revisions (commits 44-46,
  48, 58-59). Likely already absorbed into LFG version.
- **Batch-4**: Code/test fixes (commit 23 repoRoot, 29
  curl|bash). Otto-347 verify required.
- **Batch-5**: Round-44 doc absorbs (commits 53-55, 60). 20
  docs / 11 SKILL.md updates -- subagent-friendly, Otto-347
  verify required at each touch.
- **Batch-6**: ADR + HUMAN-BACKLOG (commits 42, 56-57).

## Tick-history surface skipped

Per Otto-229, tick-history rows are append-only and per-writer.
AceHack tick-history rows do NOT cherry-pick into LFG main;
each writer owns its own surface. Six commits skipped:

- 6593ead, 39 (partial 05ece84), 40 (partial 5f91369), 41
  (partial fcb7c3d), 50 (d49a20e), 52 (3f64431).

The non-tick-history portions of commits 39/40/41 still
land in EXISTS-MERGE / MISSING-LANDS as classified.

## Audit log

| Date | Action | Notes |
|------|--------|-------|
| 2026-04-26 | Doc created; 60 commits classified | Loop-agent preliminary; batch-1 ready to land. Batches 2..N awaiting Otto-347 2nd-agent verify dispatch. |
