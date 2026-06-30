---
id: B-0326
priority: P1
status: open
title: "Author kiro.ts peer-call wrapper"
tier: peer-call-substrate
effort: S
parent: B-0065
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0325]
composes_with: [B-0065, B-0120]
tags: [peer-call, kiro, kiro-cli, multi-harness]
type: friction-reducer
---

# Author kiro.ts peer-call wrapper

Create `tools/peer-call/kiro.ts` — a TypeScript+Bun wrapper
for invoking the Kiro CLI as a peer reviewer, following the
existing sibling pattern (grok.ts, gemini.ts, etc.).

## Pre-start checklist (B-0065 gate)

- [ ] Otto-364 search-first: research Kiro CLI headless/
      non-interactive flags via WebSearch before authoring
- [ ] Verify `kiro` CLI installation method and availability
- [ ] Prior-art check: review grok.ts + gemini.ts patterns

## Scope

- Research Kiro CLI's non-interactive / headless mode flags.
  The wrapper cannot work without a `--print` or equivalent
  flag that produces stdout output without interactive UI.
  If no such mode exists at implementation time, document the
  gap and close this row as blocked-by-upstream.
- Author `tools/peer-call/kiro.ts` modelled on the closest
  existing sibling by CLI shape (likely gemini.ts if Kiro has
  its own standalone CLI, or grok.ts if it routes through
  cursor-agent).
- Wire `KIRO_SUBSTANTIVE_TRIGGERS` from `_firewall.ts`
  (landed by B-0325).
- AgencySignature preamble naming Kiro's role in the peer
  distribution. Kiro's default role: **specification peer** —
  spec-grounded second opinion, requirement-aware review.
- Standard flag surface: `--file`, `--context-cmd`,
  `--output-file`, `--allow-empty`, `--help`.
- Uniform exit codes (0/1/2/3) per README.md convention.

## Done-criteria

- [ ] `tools/peer-call/kiro.ts` exists and is executable
      via `bun tools/peer-call/kiro.ts --help`
- [ ] Firewall rejection works (exit 3 on empty prompt)
- [ ] `--allow-empty` bypass works
- [ ] `bun run typecheck` passes
- [ ] If Kiro CLI has no headless mode: row closed as
      blocked-by-upstream with documentation
