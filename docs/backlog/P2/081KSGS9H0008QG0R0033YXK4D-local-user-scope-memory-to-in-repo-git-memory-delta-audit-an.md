---
id: 081KSGS9H0008QG0R0033YXK4D
priority: P2
status: open
title: Local user-scope memory ↔ in-repo git-memory delta audit + migrate substrate-to-git as autonomous-loop sometimes-task — Otto-CLI background service uses idle ticks to audit ~/.claude/projects/<slug>/memory/ vs in-repo memory/ + migrates substantive substrate via PRs; token-bounded; substrate-honest classification per file
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - 081KSE6WT0008QG0R003CMCX84
  - 081KSGS9H0008QG0R00153CQ8B
  - 081KSGS9H0008QG0R0027HJZYH
tags: [memory-sync, local-vs-git, autonomous-loop, sometimes-task, substrate-or-it-didnt-happen, persistence-discipline, token-bounded-migration]
---

## Problem

The maintainer 2026-05-26 surfaced the substrate-persistence gap empirically:

> *"are you backloging that or just putting in in memories on this machine only?  how much in local memories are missing from git?"*

Empirical audit 2026-05-26 (Aaron's primary Mac):

- **841 files in local user-scope memory** at `/Users/acehack/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/` — visible only on THIS Mac, only to THIS Otto-CLI surface
- **1645 files in in-repo `memory/`** under `/Users/acehack/Documents/src/repos/Zeta/memory/` — git-canonical; visible to all maintainers + all agents + all clones
- **Newest local-only files dated 2026-05-25** (yesterday) — substantive substrate that DID NOT migrate to git:
  - `feedback_claude_code_session_jsonl_oversize_image_self_heal_recovery_pattern_classifier_blocks_claude_operator_runs_2026_05_25.md` (12KB — substrate-honest recovery substrate)
  - `feedback_simplest_first_then_add_complexity_only_when_simple_shape_demonstrably_doesnt_fit_aaron_mika_2026_05_25.md`
  - `feedback_announce_destructive_or_blocking_action_immediately_before_firing_it_aaron_2026_05_25.md`
  - `project_zeta_cluster_install_target_persona_first_time_cli_users_3_node_production_ready_easier_than_proxmox_aaron_2026_05_25.md`
  - `feedback_cold_boot_cascade_continues_independent_of_dotgit_clearance_5th_today_dotgit_recovered_named_dep_pr_4937_wait_ci_otto_cli_2026_05_25.md`

**Risk**: local-only substrate is lost if the Mac dies, invisible to other maintainers, doesn't survive fresh clones, doesn't compose with cross-Otto / cross-agent substrate (Alexa-Kiro, Riven-Cursor, Vera-Codex, Lior-Antigravity all read in-repo `memory/` but NOT local user-scope).

The maintainer's design direction:

> *"yes can you direct your background service on the local only memories as part of its natural loop sometimes as an option?"*

Implement as **autonomous-loop sometimes-task**: not every tick, but during idle ticks when the higher-priority work queue is empty, the autonomous-loop picks N local-only files + classifies them + migrates substantive ones to git via PR.

## Target

End-state: substantive substrate written to local user-scope memory automatically migrates to in-repo git over time (within hours-to-days, depending on how often idle ticks fire + how big the delta is). Operator never needs to remember "did that important learning land in git?" — the autonomous-loop sweeps continuously.

## Sub-targets

### Sub-target 1 — local-vs-git delta tool

`tools/memory/audit-local-vs-git-delta.ts`:

- Reads local user-scope memory dir (path derived from `process.env.HOME` + Claude Code project slug)
- Reads in-repo `memory/` recursively
- Computes set delta: files in local ONLY (not mirrored to git by name)
- Emits ranked candidate list: prioritize by file age, size, substrate-honest signals (`feedback_*` named files; `project_*` named files; explicit substrate-engineering content)
- Output format: JSON for programmatic consumption + Markdown for human reading

### Sub-target 2 — per-file classifier

`tools/memory/classify-memory-file.ts`:

- Reads a single local-only memory file
- Classifies as ONE OF:
  - **MIGRATE**: substantive substrate; should land in git as-is (or with minor frontmatter cleanup)
  - **SUPERSEDE**: in-repo `memory/CURRENT-*.md` already covers this content; local file is older snapshot; skip
  - **KEEP-LOCAL**: ephemeral / per-machine / sensitive content that doesn't belong in git
  - **NEEDS-OPERATOR-REVIEW**: ambiguous; flag for human disposition
- Token-bounded: emit classification + 1-paragraph rationale; no full content rewrites

### Sub-target 3 — autonomous-loop sometimes-task hook

Already partially landed in `docs/AUTONOMOUS-LOOP-PER-TICK.md` Step 3 (priority 4 — sometimes-task: local-memory ↔ git-memory delta audit + migrate). Implementation discipline:

- NOT every tick: invoke when higher-priority queue (steps 1-3) is empty AND operator is offline / unengaged
- Token-bounded: 1-3 candidate files per tick maximum (don't burn an entire tick on memory sync)
- Each MIGRATE: opens its own PR (one file per PR; small diffs; easier to review)
- KEEP-LOCAL + SUPERSEDE: log + skip
- NEEDS-OPERATOR-REVIEW: bus-publish + flag for next operator interaction

### Sub-target 4 — substrate-honest classification heuristics

Initial heuristics for MIGRATE-vs-KEEP-LOCAL:

| Pattern | Default classification |
|---|---|
| `feedback_*` (load-bearing learnings) | MIGRATE |
| `project_*` (project-context substrate) | MIGRATE |
| `aaron_*` / `mika_*` / persona-specific | MIGRATE to `memory/<persona>/<name>/` |
| `*_secret*` / `*_password*` / `*_key*` | KEEP-LOCAL (sensitive) |
| `*_local*` / `*_per_machine*` | KEEP-LOCAL (per-machine substrate) |
| Files with explicit `local-only: true` frontmatter | KEEP-LOCAL |
| Files with explicit `migrate: true` frontmatter | MIGRATE (operator-flagged) |
| Otherwise: NEEDS-OPERATOR-REVIEW | Conservative default; never silently migrate ambiguous content |

### Sub-target 5 — backfill the existing 841-file delta

One-time historical sweep: run sub-target 1 + sub-target 2 across ALL 841 local-only files; classify + emit a migration plan; operator reviews the plan + authorizes batch migration; autonomous-loop executes over multiple ticks until complete.

For the empirically-known recent batch (2026-05-25 files surfaced above): prioritize these in the first sweep — they're substantive substrate from yesterday's session that clearly belongs in git.

## Acceptance

- [ ] **Sub-target 1**: `tools/memory/audit-local-vs-git-delta.ts` lands; emits ranked candidate list
- [ ] **Sub-target 2**: `tools/memory/classify-memory-file.ts` lands; per-file classification with rationale
- [ ] **Sub-target 3**: per-tick discipline ([`docs/AUTONOMOUS-LOOP-PER-TICK.md`](../../AUTONOMOUS-LOOP-PER-TICK.md) Step 3 priority 4) — initial landing in this PR; autonomous-loop picks up at next cold-boot
- [ ] **Sub-target 4**: classification heuristics validated empirically on 50+ files
- [ ] **Sub-target 5**: one-time historical sweep of 841 local-only files; migration plan reviewed; batch executed
- [ ] **Empirical end-to-end**: substantive substrate written to local memory today migrates to git within N idle ticks (target N=24 = ~6 hours at current cron cadence)

## Composes with substrate

- **081KSE6WT0008QG0R003CMCX84** (composes; cluster IS the DIO; substrate-persistence across maintainers + agents is load-bearing; local-only memory breaks the DIO substrate)
- **081KSGS9H0008QG0R00153CQ8B** (composes; zero-dev-machine homelab persona end-state; operator's local Mac is conversational interface, not work substrate; substrate that lives only on the conversational-interface Mac is brittle)
- **081KSGS9H0008QG0R0027HJZYH** (composes; node self-registration substrate uses same pattern — local node writes substrate to git via per-node git-auth; this row is the operator-Mac analog)
- `.claude/rules/substrate-or-it-didnt-happen.md` (composes; local-only memory IS substrate-that-didn't-happen at cross-Otto / cross-maintainer scope; this row operationalizes the discipline at memory-sync scope)
- `.claude/rules/never-be-idle.md` (composes; sometimes-task fits the idle-tick fallback ladder)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (composes; memory-sync IS legitimate decomposition work; counts as counter-reset)
- `tools/memory/reindex-memory-md.ts` (existing tool; sub-target 1 audit-tool can reuse parts of it)
- `tools/hygiene/audit-memory-index-entry-lengths.ts` (existing memory-audit tool; same pattern)
- `tools/memory/validate-memory-parity.ts` (existing parity-validation tool; sub-target 2 classifier can compose with it)

## Out of scope

- Migration of OTHER persona surfaces' local-only memory (Alexa-Kiro, Riven-Cursor, Vera-Codex, Lior-Antigravity each have their own user-scope memory dirs) — each surface implements its own version of this audit if/when needed
- Bidirectional sync (git → local) — only local → git migration is in scope; the in-repo memory IS the canonical surface
- Per-maintainer-cluster sync (if multi-maintainer governance lands) — out of scope; single-maintainer-cluster substrate first
- Encryption / sensitive-substrate handling — KEEP-LOCAL classification handles the safety floor; encrypted-in-git substrate is separate future concern

## Origin

The maintainer 2026-05-26 during iter-5.2.2 session, after the substrate-persistence question:

> *"are you backloging that or just putting in in memories on this machine only? how much in local memories are missing from git?"*

→ empirical audit surfaced 841-local-vs-1645-in-repo + substantive 2026-05-25 substrate trapped locally

> *"yes can you direct your background service on the local only memories as part of its natural loop sometimes as an option?"*

→ design direction for autonomous-loop sometimes-task

Filing as P2 because:

1. **Substrate-honest urgency**: local-only substrate decay risk is real but not immediate (Mac is healthy, no imminent loss); P2 captures importance without forcing immediate work
2. **Composes with autonomous-loop existing discipline**: small additive change to `docs/AUTONOMOUS-LOOP-PER-TICK.md` per-tick discipline; doesn't require new harness substrate
3. **Token-bounded by design**: 1-3 files per tick keeps the cost low; sweeps complete over hours-to-days
4. **Operator-reviewable**: NEEDS-OPERATOR-REVIEW default + per-file PRs preserve operator authority over what migrates

Per the maintainer's 2026-05-26 *"going for right not fast"* discipline — the substrate-persistence concern is real; the sometimes-task design is correctly modest (don't try to boil the ocean in one tick); the historical-sweep sub-target 5 handles the existing-delta cleanup separately.
