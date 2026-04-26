# PR #377 drain log — research: ace first-class adoption (setup-tooling-scratch + sqlsharp migration)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/377>
Branch: `research/setup-tooling-scratch-sqlsharp-migration`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Thread count at drain start: 13 unresolved (Codex P2 + Copilot P1/P2)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with reviewer
authorship, severity, outcome class.

This PR documented setup-tooling research per Aaron's 2026-04-24
directive. Counting by thread-ID, the 13 threads break down as: **5
STALE-RESOLVED-BY-REALITY** (forward-mirror landed cited memory +
ADR files; 4 unique findings + 1 dup of B3), **2 OTTO-279
history-surface attribution**, and **6 FIX** threads covering **3
unique factual corrections** (symlink discipline, Otto-247/248 cite
shape, runner-matrix labels) where the 3 extra threads are
duplicate reviewer comments on the same already-fixed findings,
combined into one fix commit.

---

## Outcome distribution (counted by thread-ID): 6 FIX + 5 STALE-RESOLVED-BY-REALITY + 2 OTTO-279 = 13 threads (9 unique findings: 3 FIX + 4 STALE + 2 OTTO-279; 4 of the 13 thread-IDs are duplicate reviewer comments on already-classified findings)

### A: FIX — Real factual corrections

#### Thread A1 — `:238` — Symlink suggestion conflicts with no-symlinks discipline (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59ejy_`
- Severity: P1
- Finding: Phase 1 suggested making root `.mise.toml` a symlink to
  `declarative/unix/mise/tools.toml`. Repo has explicit no-symlinks
  discipline (Otto-244 + `docs/research/build-machine-setup.md`
  "No symlink"); symlinks are also brittle on Windows.
- Outcome: **FIX** — replaced with generated-copy + tooling-kept-in-
  sync recommendation, citing Otto-244 + the build-machine-setup
  rule and the Windows-brittleness rationale. "Either make
  `.mise.toml` the canonical source and generate the declarative
  variant from it, or vice-versa, but ship both as real files kept
  in sync via tooling." Commit `c8d91b5`.

#### Thread A2 — `:324` + `:330` — Otto-247/248 "CLAUDE.md-level rule" cite (Copilot P1 ×2)

- Thread IDs: `PRRT_kwDOSF9kNM59eem9` + `PRRT_kwDOSF9kNM59ejzI`
- Severity: P1
- Finding: doc cited Otto-247/248 as "CLAUDE.md-level rules" but
  CLAUDE.md doesn't mention Otto-247/248 directly (CLAUDE.md has the
  "Version currency" + "Never-ignore-flakes" rule shapes; the IDs
  live in the source-of-truth memory files, not CLAUDE.md).
- Outcome: **FIX** — replaced with explicit memory-file paths:
  `memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`
  and `memory/feedback_never_ignore_flakes_per_DST_discipline_flakes_mean_determinism_not_perfect_otto_248_2026_04_24.md`.
  Noted that CLAUDE.md captures the rule shape but doesn't carry
  the Otto-NNN identifiers directly. Commit `c8d91b5`.

#### Thread A3 — `:197` + `:257` — Runner-matrix labels not in current gate.yml (Copilot P1 ×3)

- Thread IDs: `PRRT_kwDOSF9kNM59ejy1` + `PRRT_kwDOSF9kNM59eenN` +
  `PRRT_kwDOSF9kNM59eenr`
- Severity: P1
- Finding: doc listed runner-matrix labels (`macos-26`, `ubuntu-24.04`,
  `ubuntu-24.04-arm`, `ubuntu-slim`, `windows-2025`, `windows-11-arm`)
  as "Active" but current `.github/workflows/gate.yml` uses
  `ubuntu-22.04` (and `macos-14` only on forks).
- Outcome: **FIX** — reframed entire matrix as "proposed/future ...
  post-#375 state, not present-day truth" with explicit pointer to
  current gate.yml. All "Active" status changed to "Proposed". Windows
  rows annotated "assumes future GitHub-hosted Windows runner
  availability." Commit `c8d91b5`.

### B: STALE-RESOLVED-BY-REALITY (5 threads)

#### Thread B1 — `:69` — Three-repo-split ADR doesn't exist (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59ejyG`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** —
  `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
  exists in-tree at HEAD (verified via `ls`).

#### Thread B2 — `:121` — actionlint+shellcheck not in `.mise.toml` (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59ejym`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** — current `.mise.toml` does
  contain both `actionlint = "1.7.12"` and a pinned `shellcheck`
  entry (verified via `grep -iE "actionlint|shellcheck" .mise.toml`
  — using `-E` for extended regex avoids the BSD/macOS grep
  incompatibility with BRE `\|` alternation flagged by the post-
  merge reviewer cascade).
  The doc claim matches in-tree truth now.

#### Thread B3 — `:327` — HB-005 not defined elsewhere (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59ejzW`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** — `HB-005` IS defined in
  `docs/HUMAN-BACKLOG.md` L240 (verified via grep). The reference
  resolves now.

#### Thread B4 — `:0 (top-of-file)` — Trinity memory file not present (Copilot P2)

- Thread ID: `PRRT_kwDOSF9kNM59ejze`
- Severity: P2
- Outcome: **STALE-RESOLVED-BY-REALITY** —
  `memory/user_trinity_of_repos_emerged_zeta_forge_ace_three_in_one.md`
  exists in-tree per Otto-114 forward-mirror (verified via `ls`).

#### Thread B5 — `:0` — HB-005 dup (Copilot P1)

- Thread ID: `PRRT_kwDOSF9kNM59eemV`
- Severity: P1
- Outcome: **STALE-RESOLVED-BY-REALITY** — same as B3; HB-005 defined
  in docs/HUMAN-BACKLOG.md L240.

### C: OTTO-279 SURFACE-CLASS (2 threads — Aaron name in research surface)

#### Threads C1-C2 — Aaron name attribution in research surface (Copilot P1)

- Thread IDs: `PRRT_kwDOSF9kNM59eemx` + `PRRT_kwDOSF9kNM59ejxt`
- Severity: P1
- Outcome: **OTTO-279 SURFACE-CLASS** — research surfaces
  (`docs/research/**`) permit first-name attribution per Otto-279
  surface-class refinement; the rule applies to current-state
  surfaces (skill bodies, code, README, public-facing prose), not
  history surfaces. Same one-paragraph stamp reply as #135 / #219 /
  #231.

---

## Pattern observations (Otto-250 training-signal class)

1. **High stale-resolved density on this PR (38%, 5 of 13).** This
   research doc was authored against a future-state of main that
   landed in adjacent PRs (the three-repo-split ADR, mise.toml
   updates, HB-005 definition, trinity memory mirror). When the
   research-doc PR sat in review while the adjacent PRs landed, the
   "doc claims X but X doesn't exist yet" findings became stale-
   resolved-by-reality. Forward-author-to-future-state-of-main
   pattern produces this drift naturally.

2. **The "CLAUDE.md-level rule" cite shape is undisciplined.**
   Multiple docs cite `Otto-NNN ... CLAUDE.md-level rule` but the
   identifiers live in the memory files, not CLAUDE.md (CLAUDE.md
   has the rule shapes). The fix template: cite the memory file
   path explicitly, note that CLAUDE.md captures the shape. Works
   for any factory-rule cross-reference.

3. **Runner-matrix vs current-truth drift is recurring.** Same shape
   as #191 (CodeQL config Zeta-tuned vs generic-template) and the
   broader pattern: research docs describe a future post-PR-N state;
   the doc's "Active" labels need explicit "post-#NNN landing"
   annotations to avoid being read as present-day truth.

4. **Forward-mirror landing is a high-leverage substrate
   improvement.** Otto-114's in-repo memory mirror is the structural
   fix that converts "memory file not in repo" findings from
   re-fix-required to verify-and-resolve. The substrate change pays
   compounding dividends: every doc that cites a memory file now
   has a one-line resolution path instead of a per-doc fix.

## Final resolution

All 13 threads resolved at SHA `c8d91b5` (counted by thread-ID:
6 FIX + 5 STALE-RESOLVED-BY-REALITY + 2 OTTO-279 SURFACE-CLASS;
9 unique findings + 4 duplicate reviewer threads on
already-classified findings).
PR auto-merge SQUASH armed; CI cleared; merge pending.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
