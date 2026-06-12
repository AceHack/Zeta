---
id: B-0033.1
zetaid: 081KR50HA0008QG0R002B3N54S
priority: P2
status: closed
closed: 2026-05-10
closed_by: ".claude/hooks/harness.ts shared harness module + README multi-hook architecture docs"
title: Claude Code hooks TS harness entrypoint + .claude/settings.json wiring stub (B-0033 atomic child)
tier: hygiene-tooling-and-discipline
effort: S
ask: smallest root for all Otto-discipline hooks (TS per Rule 0)
created: 2026-05-09
last_updated: 2026-05-10
depends_on: []
composes_with: [B-0033]
tags: [claude-code-hooks, ts-harness, settings-json, otto-discipline]
type: friction-reducer
---

# B-0033.1 — Claude Code hooks TS harness entrypoint

Atomic child of B-0033. TS entrypoint module + settings wiring stub. One bounded PR target. No prose docs beyond stub.

## Pre-start checklist

- **Prior-art search**: existing `.claude/hooks/verify-branch-pretooluse.ts` defines `HookInput`/`HookOutput` inline. No shared harness module existed. `.claude/settings.json` has one PreToolUse hook (Bash matcher). No tools/hooks/ directory. No skill covering hook harness patterns. No duplicate substrate found.
- **Dependency-restructure**: no `depends_on` chain. Composes with B-0033 (parent). Settings.json wiring for B-0033.2+ will follow B-0033.1's harness import pattern.

## Deliverables

- `.claude/hooks/harness.ts` — shared module: `HookInput`, `HookDecision`, `HookEventName`, `readHookInput()`, `deny()`, `allow()`
- `.claude/hooks/README.md` — extended with harness module docs + Otto-discipline hooks table + settings wiring pattern

## Focused checks

| Check | Result |
|---|---|
| `dotnet build -c Release` | ✅ 0 Warning(s), 0 Error(s) |
| `bunx tsc --noEmit` | ✅ clean |
