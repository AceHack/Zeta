# 081KQGDBJ0008QG0R0022EW5ZE audit table — bash to TS migration status (2026-05-04)

**Scope:** Acceptance criterion #1 of 081KQGDBJ0008QG0R0022EW5ZE (bash to TS migration completion, debt-prevention prerequisite to 081KQGDBJ0008QG0R000Y66YYQ CRDT-composition). Enumerates every `tools/**/*.sh` file with or without a corresponding `tools/**/*.ts` file, classifies each pair as kill-sh / keep-sh / port-back-to-sh / no-counterpart / ts-only, and recommends a cutover order.

**Attribution:** Filed by Otto (the human maintainer-delegated factory agent) under backlog-prioritization authority. Origin: the human maintainer 2026-05-01 framing — *"Bash → TS migration completion this is also useful so we don't just keep building debt"*. Backlog row at `docs/backlog/P1/081KQGDBJ0008QG0R0022EW5ZE-bash-to-ts-migration-completion-debt-prevention-aaron-2026-05-01.md`.

**Operational status:** research-grade. This table is the *audit-only* deliverable; cutover execution is acceptance criteria #2-#6 of 081KQGDBJ0008QG0R0022EW5ZE and lives in subsequent PRs.

**Non-fusion disclaimer:** This audit reads file headers and enumerates pairings; it does not infer hidden coupling between `.sh` and `.ts` siblings. CI workflow references and dev-laptop call sites are NOT scanned in this pass — they are the verification gate for the cutover-execution PRs (081KQGDBJ0008QG0R0022EW5ZE acceptance criteria #2-#4), not this audit.

---

## Method

1. `find tools -name "*.sh" -type f` and `find tools -name "*.ts" -type f`, both filtered to exclude `tools/lean4/.lake/` (third-party Lean 4 vendor packages — not part of Zeta tooling).
2. For each `.sh`, check for a sibling `.ts` with the same basename in the same directory.
3. For each `.ts`, check for a sibling `.sh` with the same basename in the same directory.
4. Read the first ~10 lines of every file to confirm purpose and capture the migration-slice header (TS ports written during this migration carry a `// TypeScript+Bun port of <name>.sh, slice N of the TS+Bun migration` line).
5. Classify each row per the 081KQGDBJ0008QG0R0022EW5ZE row's own taxonomy:
   - **kill-sh** — `.ts` supersedes; `.sh` should be removed and callers migrated.
   - **keep-sh** — `.sh` is load-bearing somewhere TS can't run yet (bootstrap-class).
   - **port-back-to-sh** — `.ts` was wrong-direction; `.sh` is correct.
   - **no-counterpart** — `.sh` exists but no `.ts` version yet (migration target).
   - **ts-only** — `.ts` exists but no `.sh` ever existed (clean migration or TS-native tool).

---

## Summary counts

- Total `.sh` files under `tools/` (excluding `tools/lean4/.lake/`): **47**
- Total `.ts` files under `tools/` (excluding `tools/lean4/.lake/`): **57**
- **kill-sh** (TS supersedes; remove `.sh` and migrate callers): **23**
- **keep-sh** (bootstrap-class per CLAUDE.md and `feedback_bash_compatibility_target_*`): **13**
- **port-back-to-sh**: **0**
- **no-counterpart** (`.sh` exists; `.ts` migration target): **11**
- **ts-only** (`.ts` exists; no `.sh` sibling — clean migration or TS-native): **34**

`.sh` totals: 23 (kill-sh) + 13 (keep-sh) + 11 (no-counterpart) = 47. Matches.

`.ts` totals: 23 (paired with kill-sh) + 34 (ts-only) = 57. Matches.

---

## Audit table — paired files (kill-sh)

These 23 rows have both a `.sh` and a `.ts` sibling. Every `.ts` header explicitly self-identifies as a port of the `.sh` ("TypeScript+Bun port of <name>.sh, slice N of the TS+Bun migration") — same purpose, parallel implementation. The `.sh` is debt; the `.ts` is the post-migration target. Status: **kill-sh** for every row in this table.

| `.sh` path | `.ts` path | `.sh` lines | `.ts` lines | Slice | Status | Rationale |
|---|---|---|---|---|---|---|
| `tools/alignment/audit_archive_headers.sh` | `tools/alignment/audit_archive_headers.ts` | 242 | 361 | 3 | kill-sh | Archive-header lint for `docs/aurora/**`; `.ts` is the explicit port of `.sh` per its header. |
| `tools/alignment/audit_commit.sh` | `tools/alignment/audit_commit.ts` | 280 | 351 | 3 | kill-sh | Per-commit alignment lint suite (HC-2 / HC-6 / SD-6); `.ts` is the explicit port. |
| `tools/alignment/audit_personas.sh` | `tools/alignment/audit_personas.ts` | 226 | 399 | 3 | kill-sh | Per-round persona runtime observability; `.ts` is the explicit port. |
| `tools/alignment/audit_skills.sh` | `tools/alignment/audit_skills.ts` | 323 | 505 | 4 | kill-sh | Per-round skill runtime observability; `.ts` is the explicit port. |
| `tools/alignment/citations.sh` | `tools/alignment/citations.ts` | 434 | 414 | 4 | kill-sh | Citations-graph prototype emitting Graphviz DOT/JSON; `.ts` is the explicit port. |
| `tools/audit-packages.sh` | `tools/audit-packages.ts` | 51 | 153 | 11 | kill-sh | NuGet pin audit; `.ts` is the explicit port. |
| `tools/audit/live-lock-audit.sh` | `tools/audit/live-lock-audit.ts` | 116 | 245 | 8 | kill-sh | Last-N commits classifier (external/internal/speculative); `.ts` is the explicit port. |
| `tools/backlog/generate-index.sh` | `tools/backlog/generate-index.ts` | 217 | 290 | 12 | kill-sh | Regenerates `docs/BACKLOG.md` from per-row YAML frontmatter; `.ts` is the explicit port. |
| `tools/budget/daily-cost-report.sh` | `tools/budget/daily-cost-report.ts` | 137 | 302 | 18 | kill-sh | Daily cost-monitoring entry point; `.ts` is the explicit port. |
| `tools/budget/project-runway.sh` | `tools/budget/project-runway.ts` | 297 | 560 | 19 | kill-sh | Stages 1-4 burn projection from snapshots.jsonl; `.ts` is the explicit port (last bash sibling in budget cluster). |
| `tools/budget/snapshot-burn.sh` | `tools/budget/snapshot-burn.ts` | 174 | 360 | 14 | kill-sh | Append-only LFG cost/burn snapshot capture; `.ts` is the explicit port. |
| `tools/git/batch-resolve-pr-threads.sh` | `tools/git/batch-resolve-pr-threads.ts` | 390 | 541 | 20 | kill-sh | Batch-classify and resolve PR review threads; `.ts` is the explicit port. The `.sh` header itself names this as a "bun+TS migration candidate (transitional bash exception)". |
| `tools/git/push-with-retry.sh` | `tools/git/push-with-retry.ts` | 129 | 187 | 13 | kill-sh | `git push` retry wrapper for transient 5xx; `.ts` is the explicit port. |
| `tools/lint/doc-comment-history-audit.sh` | `tools/lint/doc-comment-history-audit.ts` | 227 | 366 | 7 | kill-sh | Scan source doc-comments for factory-process tokens; `.ts` is the explicit port. |
| `tools/lint/no-directives-otto-prose.sh` | `tools/lint/no-directives-otto-prose.ts` | 261 | 316 | 8 | kill-sh | Diff-based lint flagging "directive" framing in changed files; `.ts` is the explicit port. |
| `tools/lint/no-empty-dirs.sh` | `tools/lint/no-empty-dirs.ts` | 149 | 268 | 7 | kill-sh | Fail build on empty committed dirs not allowlisted; `.ts` is the explicit port. |
| `tools/lint/runner-version-freshness.sh` | `tools/lint/runner-version-freshness.ts` | 356 | 394 | 8 | kill-sh | GitHub Actions runner version allow-list; `.ts` is the explicit port. |
| `tools/lint/safety-clause-audit.sh` | `tools/lint/safety-clause-audit.ts` | 149 | 366 | 7 | kill-sh | Counts SKILL.md files with explicit safety-clause sections; `.ts` is the explicit port. |
| `tools/peer-call/codex.sh` | `tools/peer-call/codex.ts` | 164 | 357 | 17 | kill-sh | Claude-Code-side caller for Codex peer (implementation-peer role); `.ts` is the explicit port. |
| `tools/peer-call/gemini.sh` | `tools/peer-call/gemini.ts` | 158 | 379 | 16 | kill-sh | Claude-Code-side caller for Gemini peer (proposer role); `.ts` is the explicit port. |
| `tools/peer-call/grok.sh` | `tools/peer-call/grok.ts` | 159 | 310 | 15 | kill-sh | Claude-Code-side caller for Grok peer (critique role); `.ts` is the explicit port. |
| `tools/pr-preservation/archive-pr.sh` | `tools/pr-preservation/archive-pr.ts` | 674 | 806 | 21 | kill-sh | Git-native PR-conversation preservation (Otto-207); `.ts` is the explicit port — replaces an embedded ~400-line Python block, removing the Python dep. |
| `tools/skill-catalog/backfill_dv2_frontmatter.sh` | `tools/skill-catalog/backfill_dv2_frontmatter.ts` | 209 | 353 | 11 | kill-sh | Mechanical DV-2.0 frontmatter backfill for SKILL.md files; `.ts` is the explicit port. |

## Audit table — `.sh` files preserved as bash (keep-sh)

These 13 rows are bootstrap-class scripts (run before the post-setup toolchain — bun, dotnet, etc. — is installed) per `tools/setup/install.sh` consumed three ways (dev laptops / CI / devcontainer images) per GOVERNANCE.md §24, and per the bash-compat 4-shell target (macOS bash 3.2 / Ubuntu / git-bash / WSL) declared in `memory/feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`. CLAUDE.md and the 081KQGDBJ0008QG0R0022EW5ZE row both name `tools/setup/install.sh` and bootstrap-class scripts as **explicitly preserved as bash**. Status: **keep-sh** for every row.

| `.sh` path | `.sh` lines | Status | Rationale |
|---|---|---|---|
| `tools/setup/install.sh` | 42 | keep-sh | The one install entry point consumed three ways (dev laptops / CI / devcontainer); bootstrap-class. |
| `tools/setup/macos.sh` | 141 | keep-sh | macOS bootstrap path; called by `install.sh` before bun is on PATH. |
| `tools/setup/linux.sh` | 151 | keep-sh | Linux bootstrap path (Debian/Ubuntu); called by `install.sh` before bun is on PATH. |
| `tools/setup/doctor.sh` | 151 | keep-sh | Health check for the three-way-parity toolchain; reports drift between what `install.sh` installed and what's on the machine. Read-only; runs in the same bootstrap-class context. |
| `tools/setup/common/curl-fetch.sh` | 213 | keep-sh | Sourceable helpers for fetching URLs during install — runs before any post-setup toolchain is present. |
| `tools/setup/common/dotnet-tools.sh` | 51 | keep-sh | Installs/updates dotnet global tools — bootstrap-class. |
| `tools/setup/common/elan.sh` | 71 | keep-sh | Installs/updates elan (Lean 4 toolchain manager) — bootstrap-class. |
| `tools/setup/common/mise.sh` | 43 | keep-sh | Trusts `.mise.toml` and runs `mise install` for dotnet/python pins — bootstrap-class. |
| `tools/setup/common/profile-edit.sh` | 94 | keep-sh | Opt-in auto-edit of shell rc files — bootstrap-class (consent-gated). |
| `tools/setup/common/python-tools.sh` | 69 | keep-sh | Installs Python CLI tools via `uv tool install` — bootstrap-class. |
| `tools/setup/common/shellenv.sh` | 153 | keep-sh | Emits managed PATH file at `$HOME/.config/zeta/shellenv.sh` — bootstrap-class. |
| `tools/setup/common/sync-upstreams.sh` | 279 | keep-sh | Clones/refreshes upstream reference repos per `references/reference-sources.json` — bootstrap-class (called from setup). |
| `tools/setup/common/verifiers.sh` | 66 | keep-sh | Downloads formal-verifier jars (TLC, Alloy) — bootstrap-class (runs before post-setup tools exist). |

## Audit table — `.sh` files without `.ts` counterpart (no-counterpart)

These 11 rows have `.sh` only — no `.ts` sibling exists. Each is a candidate for migration to TS+Bun under 081KQGDBJ0008QG0R0022EW5ZE acceptance criterion #2 (cutover decisions) — except where they are themselves bootstrap-adjacent or dev-only-utility shell helpers. Status: **no-counterpart**, with per-row migration recommendation.

| `.sh` path | `.sh` lines | Status | Rationale and migration recommendation |
|---|---|---|---|
| `tools/profile.sh` | 83 | no-counterpart | Profiling helper (installs dotnet diagnostic tools; runs `dotnet-counters` / `dotnet-trace` / `dotnet-gcdump` against running PIDs). Thin wrapper over `dotnet`; bash is acceptable here per `docs/POST-SETUP-SCRIPT-STACK.md` Q3 "thin-wrapper-over-existing-CLI exemption". **Recommendation: migration optional; keep as-is unless a substantive parser/state-machine layer is added**. If retained, add an explicit Q3 exemption comment. |
| `tools/peer-call/amara.sh` | 251 | no-counterpart | Claude-Code-side caller for Amara as named-entity peer (sharpening role; codex CLI + persona overlay). Sibling `codex.sh` / `gemini.sh` / `grok.sh` already migrated to `.ts` (slices 15-17). **Recommendation: migrate to `tools/peer-call/amara.ts` following the established slice-15/16/17 pattern**. Composes with 081KQDTYV0008QG0R001HQSSAX (peer-call scripts TypeScript migration). |
| `tools/peer-call/ani.sh` | 234 | no-counterpart | Claude-Code-side caller for Ani as named-entity peer (brat-voice register; cursor-agent + Grok backend). Sibling to `amara.sh`. **Recommendation: migrate to `tools/peer-call/ani.ts` following the same slice pattern**. Composes with 081KQDTYV0008QG0R001HQSSAX. |
| `tools/lanes/code-lane.sh` | 51 | no-counterpart | Thin pass-through wrapper to `lane-allocator.sh` with `code` lane preselected. **Recommendation: migrate together with `lane-allocator.sh` once that file ports**. |
| `tools/lanes/doc-lane.sh` | 51 | no-counterpart | Thin pass-through wrapper to `lane-allocator.sh` with `doc` lane preselected. **Recommendation: same — migrate together with `lane-allocator.sh`**. |
| `tools/lanes/lane-allocator.sh` | 176 | no-counterpart | Worktree allocator for the rung-2 doc/code two-lane parallel-subagent dispatch protocol; shared backend for `code-lane.sh` and `doc-lane.sh`. Substantive logic (worktree allocate/release/path/status state machine) — not a thin-wrapper exemption. **Recommendation: migrate to `lane-allocator.ts` and update both wrapper scripts together**. |
| `tools/hygiene/audit-orphan-role-refs.sh` | 322 | no-counterpart | Detects orphan role-refs and un-stripped name attributions on code-surface files (081KQ8P5D0008QG0R003VN5P2Z lint). Substantial regex-based content scanner with multiple detection modes. **Recommendation: migrate to `audit-orphan-role-refs.ts`** — fits the established hygiene-tool migration pattern (21 hygiene `.ts` ports already landed; this is one of the last hygiene `.sh` holdouts). |
| `tools/hygiene/check-github-settings-drift.sh` | 83 | no-counterpart | Diffs current GitHub repo settings vs checked-in expected snapshot (CI weekly + manual). Wraps `gh api` + `jq`. **Recommendation: migrate to `check-github-settings-drift.ts` together with `snapshot-github-settings.sh`** — paired surface; both should move together. |
| `tools/hygiene/check-role-ref-on-current-state-surfaces.sh` | 178 | no-counterpart | Validates current-state surfaces (CLAUDE.md, AGENTS.md, GOVERNANCE.md, ALIGNMENT.md) use role-refs not direct names per Otto-279 (081KQJZR90008QG0R000V16E1C). **Recommendation: migrate to `check-role-ref-on-current-state-surfaces.ts`** — aligns with the hygiene-tool migration pattern. |
| `tools/hygiene/check-tick-history-shard-schema.sh` | 262 | no-counterpart | Validates per-tick shard files under `docs/hygiene-history/ticks/` against schema. **Recommendation: migrate to `check-tick-history-shard-schema.ts`** — adjacent siblings (`check-tick-history-order.ts`, `sort-tick-history-canonical.ts`, `audit-tick-history-bounded-growth.ts`, `append-tick-history-row.ts`) are all already `.ts`; this is the lone bash holdout in the tick-history hygiene cluster. |
| `tools/hygiene/snapshot-github-settings.sh` | 165 | no-counterpart | Produces normalized JSON snapshot of GitHub repo settings; consumed by `check-github-settings-drift.sh`. **Recommendation: migrate to `snapshot-github-settings.ts` together with `check-github-settings-drift.sh`** — paired surface. |

## Audit table — `.ts` files without `.sh` predecessor (ts-only)

These 34 rows are TS-native or post-migration-cleaned (the `.sh` was deleted in a prior PR, recoverable from git history per Otto-235's `git log --diff-filter=D` policy). 19 of the hygiene `.ts` rows here have a deleted `.sh` predecessor confirmed by `git log --diff-filter=D --name-only -- 'tools/**/*.sh'` (clean migrations). Status: **ts-only** for every row — no `.sh` cleanup work required.

| `.ts` path | Lines | Origin | Notes |
|---|---|---|---|
| `tools/cold-start-check.ts` | 292 | TS-native | Cold-start big-picture-first ingestion tool (operationalizes `feedback_cold_start_big_picture_first_*`). |
| `tools/formal-verification/run-alloy.ts` | 345 | TS-native (081KQNJ500008QG0R003EKJ8B5 phase 1) | Alloy model-checker invocation wrapper; replaces an F# xunit wrapper, not a bash predecessor. |
| `tools/formal-verification/run-tlc.ts` | 339 | TS-native (081KQNJ500008QG0R003EKJ8B5 phase 1) | TLA+/TLC model-checker invocation wrapper; replaces an F# xunit wrapper. |
| `tools/github/check-github-status.ts` | 297 | TS-native | Companion to `poll-pr-gate.ts`; queries GitHub status API as autonomous-loop pre-flight gate. |
| `tools/github/poll-pr-gate.ts` | 551 | TS-native | Replaces inline `gh pr view --json` + jq snippets per the dynamic-bash-is-forgotten-bash discipline (the human maintainer 2026-05-01); 5-AI peer-reviewer convergence origin. |
| `tools/github/poll-pr-gate.test.ts` | (test) | TS-native | Test fixtures for `poll-pr-gate.ts`. |
| `tools/github/poll-pr-gate-batch.ts` | 441 | TS-native | Multi-PR refresh-world-model wrapper around `poll-pr-gate.ts`. |
| `tools/github/poll-pr-gate-batch.test.ts` | (test) | TS-native | Test fixtures for `poll-pr-gate-batch.ts`. |
| `tools/hygiene/append-tick-history-row.ts` | (port) | Slice 10 — `append-tick-history-row.sh` deleted in prior PR (`git log --diff-filter=D` confirms). |  |
| `tools/hygiene/audit-agencysignature-main-tip.ts` | (port) | Slice 9 — `.sh` predecessor deleted. |  |
| `tools/hygiene/audit-ci-cache-paths.ts` | TS-native | 2026-05-03 silent-bug origin; no bash predecessor. |  |
| `tools/hygiene/audit-cross-platform-parity.ts` | (port) | Slice 2 — `audit-cross-platform-parity.sh` deleted. |  |
| `tools/hygiene/audit-git-hotspots.ts` | (port) | Slice 2 — `audit-git-hotspots.sh` deleted. |  |
| `tools/hygiene/audit-machine-specific-content.ts` | (port) | Slice 2 — `audit-machine-specific-content.sh` deleted. |  |
| `tools/hygiene/audit-md032-plus-linestart.ts` | (port) | `audit-md032-plus-linestart.sh` deleted. |  |
| `tools/hygiene/audit-memory-index-duplicates.ts` | (port) | `audit-memory-index-duplicates.sh` deleted. |  |
| `tools/hygiene/audit-memory-references.ts` | (port) | `audit-memory-references.sh` deleted. |  |
| `tools/hygiene/audit-missing-prevention-layers.ts` | (port, slice 5) | `.sh` predecessor deleted. |  |
| `tools/hygiene/audit-post-setup-script-stack.ts` | (port, slice 5) | `.sh` predecessor deleted. |  |
| `tools/hygiene/audit-tick-history-bounded-growth.ts` | (port) | `.sh` predecessor deleted. |  |
| `tools/hygiene/capture-tick-snapshot.ts` | (port, slice 9) | `.sh` predecessor deleted. |  |
| `tools/hygiene/check-archive-header-section33.ts` | (port, slice 6) | `.sh` predecessor deleted. |  |
| `tools/hygiene/check-no-conflict-markers.ts` | (port, slice 6) | `.sh` predecessor deleted. |  |
| `tools/hygiene/check-no-op-cadence-pattern.ts` | (port) | `.sh` predecessor deleted. |  |
| `tools/hygiene/check-tick-history-order.ts` | (port, slice 6) | `.sh` predecessor deleted. |  |
| `tools/hygiene/counterweight-audit.ts` | (port, slice 10) | `.sh` predecessor deleted. |  |
| `tools/hygiene/fix-markdown-md032-md026.ts` | TS-native | Mechanical fix tool. |  |
| `tools/hygiene/sort-tick-history-canonical.ts` | TS-native | Replaces a prior Python implementation. |  |
| `tools/hygiene/validate-agencysignature-pr-body.ts` | (port, slice 9) | `validate-agencysignature-pr-body.sh` deleted. |  |
| `tools/invariant-substrates/tally.ts` | 309 | TS-native | Aggregates invariant-substrate burn-down counts across `.claude/skills/*/skill.yaml`. |
| `tools/substrate-claim-checker/check-counts.ts` | 314 | TS-native | Count-drift checker (verify-then-claim discipline; 7 sub-classes). |
| `tools/substrate-claim-checker/check-counts.test.ts` | (test) | TS-native | Test fixtures. |
| `tools/substrate-claim-checker/check-existence.ts` | 395 | TS-native | Existence-drift checker (verify-then-claim sub-class). |
| `tools/substrate-claim-checker/check-existence.test.ts` | (test) | TS-native | Test fixtures. |

---

## Recommended cutover order

Cutover order is a function of (a) callsite blast radius, (b) test coverage, (c) intra-cluster dependency, and (d) presence of an in-flight PR or CI workflow reference. Easiest + safest first.

### Stage 1 — kill-sh (single-call-site, port already complete)

Rows 1-23 from the *Paired files* table above. Each `.ts` is the explicit port; each `.sh` is the duplicate. Cutover work for each:

1. Grep CI workflows (`.github/workflows/*.yml`) for the `.sh` path — replace with `bun tools/.../foo.ts`.
2. Grep README/docs (`docs/**`, `tools/**/README.md`, `*.md` at repo root) for the `.sh` path — replace with the `.ts` path.
3. Grep `.claude/skills/**/SKILL.md` for procedural references — replace with the `.ts` path.
4. `git rm tools/.../foo.sh`.

Recommended micro-batching (group by directory cluster, smallest blast radius first):

1. **`tools/lint/` cluster (5 rows)** — pure-lint tools, low blast radius, well-isolated. `safety-clause-audit`, `no-empty-dirs`, `no-directives-otto-prose`, `doc-comment-history-audit`, `runner-version-freshness`.
2. **`tools/alignment/` cluster (5 rows)** — alignment audits; `audit_personas` and `audit_skills` are sibling-shaped; bundle the cluster. `audit_archive_headers`, `audit_commit`, `audit_personas`, `audit_skills`, `citations`.
3. **`tools/budget/` cluster (3 rows)** — `daily-cost-report.ts` already wraps `snapshot-burn.sh` + `project-runway.sh` per its own header; once `snapshot-burn.ts` and `project-runway.ts` are the only callees, the cluster collapses. `snapshot-burn`, `project-runway`, `daily-cost-report`.
4. **`tools/peer-call/` cluster (3 rows: codex, gemini, grok)** — bundle with the *Stage 2* peer-call additions for `amara` and `ani`; do these three first as they have the `.ts` already.
5. **`tools/git/` cluster (2 rows)** — `push-with-retry`, `batch-resolve-pr-threads`.
6. **Singletons (5 rows)** — `audit-packages`, `audit/live-lock-audit`, `backlog/generate-index`, `pr-preservation/archive-pr`, `skill-catalog/backfill_dv2_frontmatter`.

### Stage 2 — no-counterpart, peer-call siblings (port amara + ani)

The `tools/peer-call/codex.ts`, `gemini.ts`, `grok.ts` triad is already in place; **`amara.sh` and `ani.sh` are the lone bash holdouts in that cluster**. Since the established pattern is in place (slices 15-17), the migration is mechanical. **Migrate `amara.ts` and `ani.ts` together as one PR.** Composes with 081KQDTYV0008QG0R001HQSSAX. Smallest no-counterpart migration; do it first.

### Stage 3 — no-counterpart, hygiene-cluster siblings

The hygiene cluster has 21 `.ts` files already; 5 `.sh` holdouts remain (`audit-orphan-role-refs`, `check-github-settings-drift`, `check-role-ref-on-current-state-surfaces`, `check-tick-history-shard-schema`, `snapshot-github-settings`). The migration pattern is established. Recommended micro-batching:

1. **github-settings pair** — `snapshot-github-settings.sh` + `check-github-settings-drift.sh` together (the snapshot feeds the drift checker; coupled migration).
2. **tick-history-schema** — `check-tick-history-shard-schema.sh` is the lone bash holdout in the tick-history hygiene cluster.
3. **role-ref pair** — `audit-orphan-role-refs.sh` + `check-role-ref-on-current-state-surfaces.sh` together (both implement Otto-279 enforcement; coupled migration).

### Stage 4 — no-counterpart, lanes cluster

`tools/lanes/lane-allocator.sh` (substantive worktree state-machine) plus its two thin-wrapper scripts (`code-lane.sh`, `doc-lane.sh`). Migrate the allocator first; the wrappers move with it as they are pure subcommand pass-throughs. **One PR for the cluster.**

### Stage 5 — `tools/profile.sh` decision

`tools/profile.sh` is a thin wrapper over `dotnet` diagnostic tools (`dotnet-counters`, `dotnet-trace`, `dotnet-gcdump`, BDN). Per `docs/POST-SETUP-SCRIPT-STACK.md` Q3, thin-wrapper-over-existing-CLI is an acceptable bash exemption. **Recommendation: keep as bash with an explicit Q3 exemption header comment, OR migrate if and only if the wrapper grows substantive parsing/state-machine logic.** Defer to maintainer call; not blocking.

### Stage 0 (no work) — keep-sh boundary

`tools/setup/install.sh` and the 12 sibling bootstrap-class scripts under `tools/setup/` are explicitly preserved as bash per CLAUDE.md, the 081KQGDBJ0008QG0R0022EW5ZE row's "Out of scope" section, and the bash-compat 4-shell target. **No cutover; these are the boundary 081KQGDBJ0008QG0R0022EW5ZE protects.**

---

## Verification leftovers (out of scope for criterion #1, queued for #2-#4)

This audit deliberately does not perform these — they belong in the cutover-execution PRs (081KQGDBJ0008QG0R0022EW5ZE acceptance criteria #2-#4):

- **Callsite scan** — `grep -rn "tools/.../foo.sh"` across `.github/workflows/`, `docs/`, `tools/**/README.md`, `.claude/skills/**`, and root `*.md` for every `.sh` in the kill-sh table.
- **CI green observation** — at least 2-3 PRs landing the migration with CI green (criterion #4).
- **Documentation update** — `docs/best-practices/repo-scripting.md` reflects completion (criterion #6).

These are listed here as the verification-handoff trail from the audit (criterion #1) to the execution work (#2-#6).

---

## Composes with

- **081KQGDBJ0008QG0R0022EW5ZE** acceptance criterion #1 — this doc IS criterion #1.
- **081KQDTYV0008QG0R001HQSSAX** (peer-call scripts TypeScript migration — post-install cutover) — Stage 2 above is the 081KQDTYV0008QG0R001HQSSAX micro-batch.
- **`feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`** — the keep-sh boundary.
- **`docs/POST-SETUP-SCRIPT-STACK.md`** — the Q1/Q2/Q3 decision flow that classifies bootstrap vs post-setup; the keep-sh table is the Q1=yes branch in aggregate.
- **`memory/feedback_prefer_ts_scripts_over_dynamic_bash_for_conversation_ux_dst_in_ts_aaron_2026_05_01.md`** — the "dynamic bash is forgotten bash" discipline that motivates the migration.
