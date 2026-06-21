---
id: 081KR2E4K0008QG0R002S3FDXN
priority: P0
status: closed
title: "Mechanical authorization check — autonomous-loop tick-start integration"
effort: S
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQJZR90008QG0R000FTJ1TC
depends_on: [081KR2E4K0008QG0R00361ZCDR, 081KR2E4K0008QG0R003CF4YHE]
classification: closed
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [loop-integration, mechanical-check, authorization-source, typescript]
---

# 081KR2E4K0008QG0R002S3FDXN — Autonomous-loop tick-start integration

## What

Wire the mechanical authorization check into the autonomous-loop
tick-start path so the operative pace-authorization is surfaced
at every wake. The output appears in tick-history shard rows and
in the chat/console output.

## Acceptance criteria

1. At every tick start, runs: extractor (081KR2E4K0008QG0R0007CFSZ7) → resolver
   (081KR2E4K0008QG0R003CF4YHE) → prints operative authorization with timestamp +
   source + raw text.
2. Output format matches the two-layer print DX rule: raw
   structured JSON first, then labeled interpretation.
3. If `operative: null`, prints the never-idle default message
   from 081KR2E4K0008QG0R003CF4YHE's resolver output.
4. Does NOT gate work — the check surfaces information, it does
   not block or allow tick actions. The agent reads the output
   and applies it; the tool does not enforce.
5. Integrates with existing tick-start path in the autonomous-
   loop infrastructure (consult `docs/AUTONOMOUS-LOOP.md` for
   the current tick-start sequence).
6. Tick-history shard template includes an "operative-
   authorization" field populated by this check.
7. TypeScript, runs under Bun (Rule 0).

## Pre-start checklist

- [x] Prior-art search: searched `docs/AUTONOMOUS-LOOP.md` for
  current tick-start sequence (step 2, Check 0a/0b); searched
  `tools/authorization/` (found extractor + resolver landed);
  searched `tools/loop/` (no existing loop TS tools);
  grep for "check-authorization" across repo (no prior art)
- [x] Dependency walk: 081KR2E4K0008QG0R0007CFSZ7 extractor at
  `tools/authorization/pace-extractor.ts` (landed PR #2085);
  081KR2E4K0008QG0R003CF4YHE resolver at `tools/authorization/resolve-authorization.ts`
  (landed PR #2091); both verified on `origin/main` at 4c8590fe
- [x] Reciprocal pointers: 081KR2E4K0008QG0R0024JZ0CR not yet created (future
  tick-shard-template integration); 081KQJZR90008QG0R000FTJ1TC parent verified

## Composes with

- 081KQJZR90008QG0R000FTJ1TC (parent umbrella)
- 081KR2E4K0008QG0R00361ZCDR (skill body documents the integration contract)
- 081KR2E4K0008QG0R0007CFSZ7 (extractor)
- 081KR2E4K0008QG0R003CF4YHE (resolver)
- `docs/AUTONOMOUS-LOOP.md` (tick-start sequence)
- `memory/feedback_refresh_before_decide_invariant_two_layer_
  print_dx_claudeai_2026_05_01.md`
