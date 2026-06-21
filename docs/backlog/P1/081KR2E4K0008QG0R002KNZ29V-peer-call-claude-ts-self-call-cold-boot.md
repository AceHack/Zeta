---
id: 081KR2E4K0008QG0R002KNZ29V
priority: P1
status: closed
title: "Author claude.ts self-call wrapper — subprocess mode for cold-boot self-testing"
tier: peer-call-substrate
effort: S
parent: 081KQ8P5D0008QG0R002M5A2M7
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R0005E727X]
composes_with: [081KQ8P5D0008QG0R002M5A2M7, 081KQDTYV0008QG0R003VB4K1V]
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

## Distinction from 081KQDTYV0008QG0R003VB4K1V

081KQDTYV0008QG0R003VB4K1V (P2) covers making Otto + Kenji *externally callable*
by other harnesses (reverse direction). This row covers Otto
invoking *itself* for self-verification (forward direction,
same harness). The scripts may share a CLI surface (`claude`
CLI) but serve different purposes and carry different
preambles.

## Pre-start checklist (081KQ8P5D0008QG0R002M5A2M7 gate)

- [x] Otto-364 search-first: verify `claude` CLI headless
      flags (`--print` / `-p`) via `claude --help` (2026-05-09):
      confirmed `--print` / `-p` is the non-interactive flag;
      trust dialog skipped automatically in --print mode;
      `--tools` limits available tools; `--no-session-persistence`
      disables session carry-over.
- [x] Prior-art check: reviewed kiro.ts (most recent, added 081KR2E4K0008QG0R001HQF27C)
      and codex.ts as closest shapes. Followed kiro.ts structure
      verbatim; adapted CLI invocation and preamble for self-call.
- [x] Subprocess mode produces true cold-boot: confirmed via live
      test (`--allow-empty`); spawned child independently read CLAUDE.md
      and verified the claude.ts implementation without inherited context.

## Scope

- Author `tools/peer-call/claude.ts` using subprocess mode:
  spawn `claude --print` (or the verified headless flag) as
  a child process.
- The spawned instance MUST load CLAUDE.md / harness surface
  from the repo — this is the cold-boot fidelity requirement.
  The parent session's context must NOT leak into the child.
- Wire `CLAUDE_SUBSTANTIVE_TRIGGERS` from `_firewall.ts`
  (landed by 081KR2E4K0008QG0R0005E727X).
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
  3. "Read memory/CURRENT-aaron.md and report what's in force."

## Done-criteria

- [x] `tools/peer-call/claude.ts` exists and is executable
      via `bun tools/peer-call/claude.ts --help`
- [x] Subprocess mode spawns `claude --print` (or verified
      equivalent) — confirmed via smoke test
- [x] Firewall rejection works (exit 3 on empty prompt)
- [x] `--allow-empty` bypass works
- [x] `bun run typecheck` passes
- [x] At least one cold-boot scenario tested: spawn fresh
      instance, ask about CLAUDE.md content, verify response
      demonstrates independent cold-boot reading
