---
id: 081KR50HA0008QG0R002B3N54S
priority: P2
status: closed
closed: 2026-05-10
closed_by: ".claude/hooks/harness.ts shared harness module + README multi-hook architecture docs"
title: Claude Code hooks TS harness entrypoint + .claude/settings.json wiring stub (081KQ3HBZ0008QG0R0008RYCSX atomic child)
tier: hygiene-tooling-and-discipline
effort: S
ask: smallest root for all Otto-discipline hooks (TS per Rule 0)
created: 2026-05-09
last_updated: 2026-05-10
depends_on: []
composes_with: [081KQ3HBZ0008QG0R0008RYCSX]
tags: [claude-code-hooks, ts-harness, settings-json, otto-discipline]
type: friction-reducer
---

# 081KR50HA0008QG0R002B3N54S — Claude Code hooks TS harness entrypoint

Atomic child of 081KQ3HBZ0008QG0R0008RYCSX. TS entrypoint module + settings wiring stub. One bounded PR target. No prose docs beyond stub.

## Pre-start checklist

- **Prior-art search**: existing `.claude/hooks/verify-branch-pretooluse.ts` defines `HookInput`/`HookOutput` inline. No shared harness module existed. `.claude/settings.json` has one PreToolUse hook (Bash matcher). No tools/hooks/ directory. No skill covering hook harness patterns. No duplicate substrate found.
- **Dependency-restructure**: no `depends_on` chain. Composes with 081KQ3HBZ0008QG0R0008RYCSX (parent). Settings.json wiring for 081KR50HA0008QG0R0005ABWPH+ will follow 081KR50HA0008QG0R002B3N54S's harness import pattern.

## Deliverables

- `.claude/hooks/harness.ts` — shared module: `HookInput`, `HookDecision`, `HookEventName`, `readHookInput()`, `deny()`, `allow()`
- `.claude/hooks/README.md` — extended with harness module docs + Otto-discipline hooks table + settings wiring pattern

## Focused checks

| Check | Result |
|---|---|
| `dotnet build -c Release` | ✅ 0 Warning(s), 0 Error(s) |
| `bunx tsc --noEmit` | ✅ clean |
