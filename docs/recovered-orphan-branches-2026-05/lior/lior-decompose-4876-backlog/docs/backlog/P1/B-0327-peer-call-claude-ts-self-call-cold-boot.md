---
id: B-0327
priority: P1
status: open
title: "Author claude.ts self-call wrapper — subprocess mode for cold-boot self-testing"
tier: peer-call-substrate
effort: S
parent: B-0065
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0325]
composes_with: [B-0065, B-0121]
tags: [peer-call, claude, self-call, cold-boot-self-test, cross-cli-verify]
type: friction-reducer
---

# Author claude.ts self-call wrapper (subprocess mode)

Create `tools/peer-call/claude.ts` — a TypeScript+Bun wrapper
that spawns a fresh Claude Code CLI instance for cold-boot
self-testing and cross-verification.

## Why this is load-bearing

Aaron 2026-04-28: *"this will help you testing youself from
cold boot too."*

Cold-boot self-test is the single highest-leverage verification
surface the agent has access to. A fresh CLI instance loads
CLAUDE.md / AGENTS.md / harness surface from scratch with no
working-context bias — it catches substrate-decay, rule-drift,
and broken-pointer regressions that in-session verification
cannot (Otto-347 cross-CLI verify pattern).

## Distinction from B-0121

B-0121 (P2) covers making Otto + Kenji *externally callable*
by other harnesses (reverse direction). This row covers Otto
invoking *itself* for self-verification (forward direction,
same harness). The scripts may share a CLI surface (`claude`
CLI) but serve different purposes and carry different
preambles.

## Pre-start checklist (B-0065 gate)

- [ ] Otto-364 search-first: verify `claude` CLI headless
      flags (`--print` / `-p`) via WebSearch or `claude --help`
- [ ] Prior-art check: review codex.ts pattern (closest shape)
- [ ] Confirm subprocess mode produces true cold-boot (no
      inherited context from parent session)

## Scope

- Author `tools/peer-call/claude.ts` using subprocess mode:
  spawn `claude --print` (or the verified headless flag) as
  a child process.
- The spawned instance MUST load CLAUDE.md / harness surface
  from the repo — this is the cold-boot fidelity requirement.
  The parent session's context must NOT leak into the child.
- Wire `CLAUDE_SUBSTANTIVE_TRIGGERS` from `_firewall.ts`
  (landed by B-0325).
- AgencySignature preamble framing the call as self-test /
  cold-boot verification: *"You are a fresh Claude Code
  instance invoked by an in-session peer for cold-boot
  self-verification."*
- Standard flag surface: `--file`, `--context-cmd`,
  `--output-file`, `--allow-empty`, `--help`.
- Uniform exit codes (0/1/2/3) per README.md convention.
- Cold-boot test scenarios the script should support
  (via prompt content, not special flags):
  1. "Read CLAUDE.md and report the wake-time floor."
  2. "Verify file X exists and summarise its purpose."
  3. "Read CURRENT-aaron.md and report what's in force."

## Done-criteria

- [ ] `tools/peer-call/claude.ts` exists and is executable
      via `bun tools/peer-call/claude.ts --help`
- [ ] Subprocess mode spawns `claude --print` (or verified
      equivalent) — confirmed via smoke test
- [ ] Firewall rejection works (exit 3 on empty prompt)
- [ ] `--allow-empty` bypass works
- [ ] `bun run typecheck` passes
- [ ] At least one cold-boot scenario tested: spawn fresh
      instance, ask about CLAUDE.md content, verify response
      demonstrates independent cold-boot reading
