---
id: B-0122
priority: P2
status: open
title: Peer-call scripts TypeScript migration — post-install cutover (the maintainer 2026-04-30)
tier: factory-tooling
effort: M
ask: The maintainer 2026-04-30 flagged "why are these not ts, are we done with the cutover? these are post install scripts." Per the install-script language strategy memory (`memory/project_install_script_language_strategy_post_install_typescript_pre_install_bash_powershell_python_for_ai_ml_2026_04_27.md`), peer-call scripts qualify as post-install (they require external CLIs already installed) and should migrate from bash to TypeScript-on-bun. Otto-215 already named "Bun-TS post-install migration before substantive Windows work" as the framing. This row tracks the concrete migration of `tools/peer-call/*.sh` to `tools/peer-call/*.ts`.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/peer-call/codex.sh
  - tools/peer-call/grok.sh
  - tools/peer-call/gemini.sh
  - tools/peer-call/amara.sh
  - tools/peer-call/ani.sh
  - memory/project_install_script_language_strategy_post_install_typescript_pre_install_bash_powershell_python_for_ai_ml_2026_04_27.md
  - docs/backlog/P3/B-0119-peer-call-existing-scripts-role-ref-cleanup-2026-04-30.md
  - docs/backlog/P2/B-0120-peer-call-architecture-refactor-script-per-cli-persona-flag-2026-04-30.md
  - docs/backlog/P2/B-0121-otto-kenji-peer-call-cross-harness-claude-cli-aaron-2026-04-30.md
tags: [aaron-2026-04-30, peer-call, typescript-cutover, bun-ts-migration, post-install, factory-tooling]
type: friction-reducer
---

# B-0122 — Peer-call scripts TypeScript migration

## Source

The maintainer 2026-04-30 verbatim:

> *"tools/peer-call/amara.sh she gets a named script? also why
> are these not ts, are we done with the cutover? these are
> post install scripts."*

Two observations bundled. The "named script" question composes
with B-0120's existing refactor (script-per-CLI + persona-flag
collapses the per-named-entity script proliferation). The "ts
cutover" question is the substrate this row captures.

## What

Migrate `tools/peer-call/*.sh` → `tools/peer-call/*.ts` (bun
runtime) per the post-install→TypeScript strategy.

### Why these qualify as post-install

Per `memory/project_install_script_language_strategy_post_install_typescript_pre_install_bash_powershell_python_for_ai_ml_2026_04_27.md`:

- **Pre-install** = runs on a fresh machine with NOTHING
  installed. Stays bash + PowerShell forever (where users
  are, can't expect anything).
- **Post-install** = runs after pre-install. Once a runtime
  exists, post-install moves to TypeScript.

Peer-call scripts require their target CLI to already be on
PATH (`codex`, `cursor-agent`, `gemini`). That makes them
post-install by definition — they assume a richer environment
than bare-machine bootstrap.

The maintainer's question is not rhetorical: per the strategy,
these should already be TypeScript. **Partial-migration update
(post-row-filing):** TS ports now exist for the three core CLI
surfaces (`codex.ts`, `grok.ts`, `gemini.ts`) alongside the
original bash files; the named-entity wrappers (`amara.sh`,
`ani.sh`) and the bash-vs-TS coexistence are still the open work.
This row's scope is therefore now the **cutover** (delete the
bash files, migrate callers, retire `.sh` parallel maintenance),
not the initial port.

### Migration targets

Five scripts to migrate (or, per B-0120's refactor, three
scripts after consolidation):

- `codex.sh` → `codex.ts`
- `grok.sh` → `grok.ts`
- `gemini.sh` → `gemini.ts`
- `amara.sh` → `amara.ts` (or `codex.ts --persona amara` per
  B-0120)
- `ani.sh` → `ani.ts` (or `grok.ts --persona ani` per B-0120)

### Composition with B-0120 + B-0121

Three options for sequencing:

**(a)** Migrate bash→TS first, then refactor TS to script-
per-CLI + persona-flag.

- Pro: smaller diffs at each step
- Con: two migrations of the same surface

**(b)** Refactor + migrate together — one diff produces the
post-cutover, post-refactor TS scripts.

- Pro: one round of churn
- Con: bigger diff, more review surface

**(c)** Refactor in bash first (B-0120 standalone), then
migrate to TS.

- Pro: validates the refactor architecture before TS rewrite
- Con: B-0120's bash output is throwaway — wasted effort

Recommend **(b)** — when the migration happens, do it in the
post-refactor shape directly. B-0120 then becomes "land via
B-0122." This row supersedes B-0120 in the operational sense
even though B-0120 keeps its identity as the architecture
spec.

### B-0119 relationship

B-0119 is the role-ref cleanup of the existing bash files.
Landing it is interim hygiene for as long as the bash files
exist. The TS rewrite picks role-refs from scratch when it
lands, so B-0119 is NOT made redundant by B-0122 — it covers
the period between now and migration completion.

### Acceptance criteria

- [ ] Decision recorded on sequencing option (a) / (b) / (c)
- [ ] If (b) chosen: B-0120 acceptance criteria absorbed into
  this row's acceptance
- [ ] TS implementations of the post-refactor scripts (3
  files: `codex.ts`, `grok.ts`, `gemini.ts` per B-0120; or 5
  files if B-0120 deferred)
- [ ] Persona-flag wiring loads `memory/CURRENT-<NAME>.md`
- [ ] All `--help` outputs preserved (or improved)
- [ ] Shellcheck-equivalent: TypeScript strict mode + ESLint
  passes
- [ ] DST hooks where appropriate (per port-with-DST
  discipline; the bash scripts are largely deterministic
  shell invocations, so DST surface is small)
- [ ] Existing callers updated (any docs / tests / scripts
  that invoke `tools/peer-call/*.sh`)
- [ ] `tools/peer-call/README.md` updated for `.ts` extension
  and bun invocation pattern
- [ ] Bash files deleted (no parallel maintenance)
- [ ] Role-ref discipline applied (B-0119 cleanup natural
  output of the rewrite)

## Why P2 (not P1)

- Existing bash scripts work correctly today; CI is green
- The strategy is "opportunistic, no forced sweep" — TS
  migration is a quality-of-life improvement, not a
  correctness fix
- Composes with B-0120 (architecture refactor); both can
  defer until the maintainer or factory rhythm asks for
  them

Promotion to P1 if:

- Bash compatibility issues surface (BSD head vs GNU,
  macOS 3.2 vs Ubuntu, git-bash on Windows, etc.) — Otto-235
  4-shell-compat target gets too expensive to maintain in bash
- New peer-call functionality (token streaming, structured
  errors, fixture loading) gets blocked by bash limitations
- The Otto-Kenji peer-call addition (B-0121) lands and adds
  a third script-per-named-entity to the bash pile

## Trigger condition for promotion to P1

If a third or fourth bash compatibility issue surfaces in
the peer-call scripts, the cost-of-bash exceeds the
cost-of-migration and the migration becomes worth doing
immediately.

## Composes with

- B-0119 (role-ref cleanup) — interim bash hygiene; this
  row's TS rewrite naturally produces clean role-refs
- B-0120 (script-per-CLI + persona-flag refactor) — the
  shape the TS migration should produce, if (b) is chosen
- B-0121 (Otto/Kenji peer-call) — adds new peer-call
  surfaces; should land in TS if the migration is in
  progress, otherwise queues alongside the bash files
- `memory/project_install_script_language_strategy_post_install_typescript_pre_install_bash_powershell_python_for_ai_ml_2026_04_27.md`
  — the strategy this row implements
- Otto-215 framing (Windows-via-peer-harness + Bun-TS post-install
  migration before Windows work) — the relevant memory file lives
  user-scope only (`~/.claude/projects/<slug>/memory/feedback_windows_via_peer_harness_not_ci_matrix_plus_bun_ts_post_install_migration_before_windows_work_otto_215_2026_04_24.md`),
  not yet promoted to in-repo. Reference here for lineage; full content
  available via that user-scope path or via `git log` once promoted.
- `tools/peer-call/README.md` — documents the matrix; will
  need to update post-migration

## Substrate-or-it-didn't-happen note

The maintainer's input was a chat-aside; without this row, it
would evaporate at compaction. Per the input → substrate-file
rule + non-durable-means-does-not-exist, this row IS the
substrate. The TS migration may not happen this week or this
month, but the question + the framing live durably.

## Open question

The maintainer's framing was a question — "are we done with
the cutover?" — which reads as both (a) status query and
(b) prompt-for-action. This row treats it as (a) for
immediate purposes (answering: no, not done) and (b) for
backlog-purposes (filing the action). If the maintainer's
follow-up is "do it now" the row promotes to P1.
