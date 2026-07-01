---
id: 081KWFYQDET08QG0R003CFV97T
type: task
state: backlog
priority: P2
slug: git-native-self-check-hooks-committed-githooks-dir-core-hook
title: "Git-native self-check hooks: committed githooks/ dir (core.hooksPath) runs preflight:quick pre-push in every writer clone — self-verification before emit, not a gate"
created: 2026-07-01T23:02:49.050Z
depends_on: []
composes_with: []
---

# Git-native self-check hooks: committed githooks/ dir (core.hooksPath) runs preflight:quick pre-push in every writer clone — self-verification before emit, not a gate

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KWFYQDET08QG0R003CFV97T-*.md` glob. -->

## Origin

Aaron 2026-07-01 (Cowork session, after two fix-forward rounds cleared preflight reds
on main): *"maybe something like commit hooks or something gets powerful enough over
time where agents don't do read that often — they pre-check themselves."*

The three-stage verification evolution: **gates** (central, blocking others — rejected
by design, see the no-PR-gates direction) -> **fix-forward** (peers repair after the
fact — today's model, spends peer attention) -> **self-check** (writer verifies in its
own loop before emit — this item). A hook in a writer's OWN clone blocks nobody: it is
wait-free at the fleet level, self-discipline at the clone level.

## Evidence (2026-07-01, one day)

Three preflight reds landed on main within ~24h (aa7141c39 MD032/MD047; #9057 two
future-path dangling refs; #9066 missing db/ wikilink anchor) — each repaired
fix-forward (a8a7189, #9064, #9068). All three would have been caught pre-push by
`bun run preflight:quick` (seconds, already exists) running in the writer's clone.

## Prior art / existing substrate (start-gate search logged)

- `.claude/hooks/` — harness-level pre-tool-use hooks incl. `check-md032-pretooluse.ts`;
  Claude-only, opt-in via `.claude/settings.json`, does NOT cover other harnesses' loops.
- `hooks/` — .NET runtime hooks (different concept, not git hooks).
- `.git/hooks/` — samples only; no committed hooks dir, no `core.hooksPath` wiring in
  `.mise.toml`/`package.json`/setup scripts.
- `src/Core.TypeScript/hygiene/preflight.ts` — the check itself (`preflight:quick` =
  lints + tsc, fast; `preflight` = + dotnet build/test).
- External: git `core.hooksPath` (git 2.9+); husky/lefthook patterns (JS ecosystem) —
  we need no dependency, a committed `githooks/pre-push` + one `git config` line suffices.

## Scope (Rodney-razored minimal)

1. `githooks/pre-push` — runs `bun run preflight:quick`; on failure prints the summary
   and exits non-zero (the WRITER's push aborts; nobody else is blocked). Escape hatch:
   `ZETA_SKIP_PREFLIGHT=1 git push` (self-check, not a gate — the writer stays sovereign).
2. Wire-up: one line in the clone-setup path (setup scripts / `.mise.toml` task / docs):
   `git config core.hooksPath githooks`. Opt-in per clone; document in AGENTS.md
   clone-per-writer section.
3. Cross-harness by construction: git-layer, so Claude/Codex/Cursor/Gemini/Kiro loops
   all get it — unlike `.claude/hooks/`.

## Acceptance

- A writer clone with `core.hooksPath=githooks` cannot push a preflight:quick-red tree
  without the explicit skip env var; the hook adds <30s to push on a warm bun cache.
- The three 2026-07-01 red classes (markdownlint, auto-vivify dangling, tsc) reproduce
  as blocked-at-push in a test clone.
- No ruleset/branch-protection change anywhere (stays no-gates).

## Falsifier

If hook adoption across writer clones does not measurably reduce red-on-main rate
(fix-forward commits per week), the hook is friction without value — remove the wiring.
