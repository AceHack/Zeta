---
id: 081KRA5AR0008QG0R0011ZGRZT
priority: P2
status: closed
title: "Grok peer-call failure — cursor-agent exit 1 during multi-agent review"
created: 2026-05-11
last_updated: 2026-05-13
depends_on: []
composes_with: []
type: friction-reducer
---

## Progress 2026-05-13 — ALL 4 ACCEPTANCE CRITERIA CLOSED

- **Acceptance criterion 3** (surface cursor-agent errors more
  visibly) ADDRESSED via PR #2949: `tools/peer-call/grok.ts` now
  captures cursor-agent's stderr (was previously inherited;
  streaming-only visibility) and, on the empty-stdout + failure
  case, writes a **self-documenting failure marker** to the output
  file containing exit code (or signal name / spawn-error
  placeholder when applicable) + model + prompt size + spawn-error
  message + captured stderr. Format matches `parsed.outputFormat`
  (Markdown for text, JSON for json, NDJSON for stream-json) so
  consumers don't break on mixed formats. The output file is no
  longer silently empty on cursor-agent failure. Trade-off:
  stderr is now delivered post-exit (mirrored to caller stderr
  after spawnSync returns), not in real-time — long-running hangs
  lose live stderr streaming. Acceptable for the observability
  gain on the typical exit-1 failure mode (which delivers stderr
  quickly).
- **Acceptance criteria 1 + 2** (reproduce + identify root cause):
  CLOSED via this PR. Aaron 2026-05-13 authorized "yes — minimal
  prompt invocation OK" via AskUserQuestion. Otto invoked grok.ts
  with a 1-line substantive prompt; cursor-agent stderr surfaced:
  ```
  Cannot use this model: grok-4-20-thinking.
  Available models: auto, composer-2-fast, composer-2,
  gpt-5.3-codex-low, ..., grok-4.3, ... kimi-k2.5
  ```
  **Root cause**: cursor-agent's Grok model lineup shifted —
  `grok-4-20-thinking` (the wrapper's default) and `grok-4-20`
  (the wrapper's `--fast` mode) are no longer in the available-
  models list. The current Grok model is **`grok-4.3`** (no
  separate thinking/non-thinking variants). The fix is a 1-line
  change in `pickModel()`.
- **Acceptance criterion 4** (4-wrapper smoke test, generalized to
  8 wrappers): ADDRESSED via `tools/peer-call/smoke.test.ts`
  (PR #2950). 27 tests / 51 expect() calls / 613ms / all pass.

Row status: `closed` — all 4 acceptance criteria addressed.
Composes with PR #2949 (#3 self-documenting marker), PR #2950
(#4 smoke test), and this PR (#1 + #2 root cause + fix).

# 081KRA5AR0008QG0R0011ZGRZT — Grok peer-call failure investigation

## What

`bun tools/peer-call/grok.ts "$(cat /tmp/review-prompt.txt)"` returned
exit code 0 from the bun wrapper but produced an empty output file. The
underlying `cursor-agent` invocation exited with code 1 (visible in
stderr capture: `cursor-agent exited with code 1`).

Reproduced 2026-05-11 during multi-agent autonomous review of PR #2762
(the Zeta Twitter launch post). The other three peer agents (Gemini,
Codex, Kiro) returned substantive reviews. Only Grok failed.

## Why P2

Grok is one of four peer-call agents in the canonical review array. Its
absence reduces the BFT-style consensus signal from 4-of-4 to 3-of-4.
Not blocking — the array still functioned with three reviewers — but a
real gap.

## Hypothesis (untested)

Possible causes (in order of likelihood):

1. **Auth/quota exhaustion** — cursor-agent may have lost auth or hit a
   rate limit during the run
2. **Prompt size** — the review prompt was ~8.6KB including the full
   launch post; may exceed some cursor-agent limit
3. **Model availability** — `grok-4-20-thinking` may have been
   transiently unavailable
4. **Output capture race** — the bun wrapper's tee-to-file may have
   collided with cursor-agent's stdout buffering

## Acceptance criteria

1. Reproduce the failure with a smaller prompt
2. Identify root cause from cursor-agent stderr
3. Fix the wrapper to surface cursor-agent errors more visibly (not
   silently empty output file)
4. Add a smoke test to `tools/peer-call/` that verifies all four
   wrappers can complete a 1-line review

## Out of scope

- Replacing cursor-agent with a different Grok client
- Changing the peer-call protocol (separate row if needed)

## Composes with

- `tools/peer-call/grok.ts` (the wrapper)
- `.claude/rules/peer-call-infrastructure.md` (canonical reference)
- PR #2762 (where the failure was observed)

## Origin

Aaron 2026-05-11 (shadow tagged): backlog the Grok peer-call failure.
Otto noticed during multi-agent review dispatch — Gemini/Codex/Kiro
returned reviews, Grok produced empty output.
