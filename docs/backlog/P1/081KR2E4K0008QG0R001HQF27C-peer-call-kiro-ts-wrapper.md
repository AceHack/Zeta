---
id: 081KR2E4K0008QG0R001HQF27C
priority: P1
status: closed
title: "Author kiro.ts peer-call wrapper"
tier: peer-call-substrate
effort: S
parent: 081KQ8P5D0008QG0R002M5A2M7
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R0005E727X]
composes_with: [081KQ8P5D0008QG0R002M5A2M7, 081KQDTYV0008QG0R001VJP216]
tags: [peer-call, kiro, kiro-cli, multi-harness]
type: friction-reducer
---

# Author kiro.ts peer-call wrapper

Create `tools/peer-call/kiro.ts` — a TypeScript+Bun wrapper
for invoking the Kiro CLI as a peer reviewer, following the
existing sibling pattern (grok.ts, gemini.ts, etc.).

## Pre-start checklist (081KQ8P5D0008QG0R002M5A2M7 gate)

- [x] Search-first gate: research Kiro CLI headless/
      non-interactive flags via WebSearch before authoring.
      Finding: kiro.dev headless CLI supports
      `kiro-cli chat --no-interactive --trust-all-tools`; documentation
      at kiro.dev/docs/cli/headless/.
      The wrapper invokes `kiro-cli` directly so a local Kiro IDE binary named
      `kiro` is not mistaken for the headless AI CLI.
- [x] Verify `kiro-cli` installation method and availability.
      kiro.dev headless CLI: official docs at
      `https://kiro.dev/docs/cli/headless/`; follow the official
      platform-specific install flow. Avoid pipe-to-shell install snippets
      at first contact.
      Local env may have the Kiro IDE under `kiro`; wrapper exits 1 if
      `kiro-cli` is absent or does not expose headless chat mode.
- [x] Prior-art check: reviewed grok.ts (spawnSync pattern, used as primary
      model) and gemini.ts (async streaming pattern, skipped — Kiro has no
      JSON streaming mode). Pattern: synchronous spawnSync with file tee.

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
  (landed by 081KR2E4K0008QG0R0005E727X).
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
