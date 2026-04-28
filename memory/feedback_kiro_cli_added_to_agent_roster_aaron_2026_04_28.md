---
name: kiro-cli added to the agent / CLI roster (Aaron 2026-04-28)
description: Aaron 2026-04-28 expanded the CLI / harness roster with kiro-cli — a new entry alongside Claude Code, Codex, Cursor, Gemini, Grok. Verify-currency-via-WebSearch per Otto-247 before asserting kiro-cli capabilities; treat the inventory as growing list, not a closed set. Composes with the multi-harness peer-call pattern (`tools/peer-call/{gemini,codex,grok}.sh`) — kiro-cli should get a sibling caller script when the integration matures.
type: reference
---

# kiro-cli added to roster

**What:** kiro-cli is now part of this factory's known
agent / CLI / harness roster as of 2026-04-28.

**Why this matters:**

- **Multi-harness pattern.** The factory already has
  named-agent peer-callers for Gemini, Codex, and Grok
  (`tools/peer-call/{gemini,codex,grok}.sh` per task
  #303). kiro-cli is a candidate for the same pattern
  once integration matures — sibling
  `tools/peer-call/kiro.sh` if the workflow stabilises.
- **Cross-CLI verify is load-bearing.** Per Otto-347
  ("would be good to ask another CLI"), having more
  harnesses available means more options for cross-CLI
  verification when single-CLI verify fails (the
  same-substrate-verifier failure mode named in
  `feedback_claude_md_cadenced_reread_for_long_running_sessions_2026_04_28.md`).
- **Roster is growing, not closed.** This memory is a
  reference pointer + reminder to apply Otto-247
  (version-currency, always WebSearch first) before
  asserting kiro-cli features / capabilities / pricing.

## How to use this reference

When the agent considers:

- proposing a new peer-call workflow,
- attributing a fix to a specific CLI in commit messages,
- documenting the harness inventory at
  `docs/HARNESS-SURFACES.md`,
- or citing harness-specific behaviour in a memory or ADR,

include kiro-cli alongside the existing entries.
Verify any concrete claim about kiro-cli (model
identifier, pricing, integration capabilities,
publisher) via `WebSearch` before asserting it; the
training-data cutoff makes default knowledge stale.

## Maintainer framing (verbatim)

> *"i aslo added the kiro-cli now too to your agent/cli
> roster"*  — Aaron 2026-04-28.

## Composes with

- `tools/peer-call/grok.sh` (existing sibling caller on
  AceHack main as of 2026-04-28). `tools/peer-call/codex.sh`
  + `tools/peer-call/gemini.sh` were added via PR #28
  (merged on AceHack main 2026-04-28T09:04Z) but are not
  yet rebased into PR #72's branch — verify post-rebase
  before relying on them. kiro.sh would be a parallel-shape
  addition.
- Otto-247 version-currency rule (WebSearch before
  asserting CLI versions / capabilities).
- Otto-347 cross-CLI verify (more harnesses = more
  cross-verify options).
- `feedback_cli_tooling_update_codex_cursor_chatgpt_5_5_grok_4_3_beta_better_reasoning_x_access_2026_04_27.md`
  (the prior CLI-roster update; kiro-cli is the next
  entry in the same series).
