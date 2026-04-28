---
id: B-0065
priority: P1
status: open
title: Peer-call expansion — add kiro.sh + claude.sh (self) sibling scripts; the self-call enables cold-boot self-testing (Aaron 2026-04-28)
tier: peer-call-substrate
effort: M
ask: maintainer Aaron 2026-04-28 ("tools/peer-call/{gemini,codex,grok}.sh → kiro.sh and yourself this will help you testing youself from cold boot too")
created: 2026-04-28
last_updated: 2026-04-28
composes_with: [B-0060]
tags: [peer-call, multi-harness, kiro-cli, self-call, cold-boot-self-test, otto-347, cross-cli-verify]
---

# Peer-call expansion — kiro.sh + claude.sh (self)

Aaron 2026-04-28 expanded the `tools/peer-call/` script
roster:

> *"tools/peer-call/{gemini,codex,grok}.sh → kiro.sh and
> yourself this will help you testing youself from cold
> boot too"*

Two sibling scripts to add:

1. **`tools/peer-call/kiro.sh`** — wraps the kiro-cli for
   peer-call. Composes with the just-landed kiro-cli
   roster-add memory
   (`feedback_kiro_cli_added_to_agent_roster_aaron_2026_04_28.md`).
2. **`tools/peer-call/claude.sh`** — self-call script
   that invokes Claude Code from another Claude Code
   session (or any caller) for cross-verification AND
   cold-boot self-testing.

## Why the self-call is load-bearing

Aaron's specific framing: *"this will help you testing
youself from cold boot too."*

Cold-boot self-test is the single highest-leverage
verification surface the agent has access to. Otto-347
("would be good to ask another CLI") is the pattern when
single-CLI verification fails because the actor and the
verifier share the same rule-misreading. Self-call lets
the agent:

- **Spawn a fresh Claude Code instance** with no working-
  context bias, and ask it to evaluate the same artefact
  the in-session agent just produced.
- **Verify cold-boot behaviour** — does CLAUDE.md load
  correctly? Do all referenced docs exist? Does the
  agent reach the same conclusions as the in-session
  agent?
- **Catch substrate-decay** — if the in-session agent
  has drifted (per Otto-275-FOREVER + the cadenced re-read
  discipline), a fresh-boot peer can spot it.

This is the cross-CLI verify pattern that has been load-
bearing in this session — applied to Claude itself.

## Existing substrate

- **`tools/peer-call/grok.sh`** is the canonical pattern
  reference (the only script in the directory at the
  time of filing). 156 lines. Shape: `cursor-agent
  --print --model grok-4-20-thinking` invocation with
  `--file`, `--context-cmd`, `--json` flags + a
  preamble framing the call as a peer review.
- **Task #303** marked "completed" claiming gemini.sh +
  codex.sh shipped, but both files are absent at the
  time of filing on this branch — the task may have
  shipped to LFG main and not absorbed back, or the
  task was marked completed on speculation. **Phase 1
  prerequisite:** verify the gemini.sh + codex.sh
  status before authoring kiro.sh / claude.sh; either
  forward-port the missing pair from LFG OR re-author
  them parallel to the new scripts.

## Phase plan

### Phase 0 — gemini.sh + codex.sh status verification (S effort)

- Check LFG main for the existing scripts.
- If present: forward-port to AceHack so all four
  callers exist as siblings before adding kiro.sh +
  claude.sh.
- If absent: add to this row as additional Phase 1
  authoring work.

### Phase 1 — kiro.sh sibling caller (S effort)

- Verify kiro-cli installation method + invocation
  flags via `WebSearch` (Otto-247 version-currency).
- Author `tools/peer-call/kiro.sh` modelled on
  `grok.sh`'s shape:
  - `--print` / non-interactive flag
  - `--file` for code-context attachment
  - `--context-cmd` for shell-command attachment
  - `--json` for structured output
  - Preamble framing the call as peer review (per the
    four-ferry consensus + agent-not-bot discipline).

### Phase 2 — claude.sh self-call (M effort)

- Two sub-modes worth investigating:
  1. **API-mode** — invoke Claude API via Anthropic SDK
     (`anthropic.messages.create(...)`). Requires
     ANTHROPIC_API_KEY in env. Most reliable, no
     cold-boot fidelity (no CLAUDE.md / harness
     surface).
  2. **Subprocess-mode** — spawn `claude` CLI as
     subprocess with `--print` flag (similar to
     `cursor-agent --print` for grok.sh). Loads
     CLAUDE.md / harness surface = TRUE cold-boot
     self-test.

  Per Aaron's framing ("testing youself from cold
  boot"), subprocess-mode is the primary use case.
  API-mode is a fallback for environments without
  the CLI.

- **Cold-boot test scenarios** the script should
  support:
  - "Read CLAUDE.md and tell me what the wake-time
    floor is."
  - "Verify the file `<path>` exists and summarise its
    purpose without prior context."
  - "Apply the bulk-resolve-not-answer discipline to
    this batch of review threads and report which
    closures are form-1 / form-2 / form-3 / form-4."
  - "Read CURRENT-aaron.md and report what's currently
    in force without prior session context."

### Phase 3 — peer-call/README.md documenting the pattern (S effort)

- Add a `tools/peer-call/README.md` covering the shape
  + flags + preamble convention shared across all
  scripts.
- Document Aaron's "you are peers, not subordinates"
  discipline.
- Document the expected use cases (Otto-347 cross-CLI
  verify, four-ferry consensus, cold-boot self-test).

## Done-criteria

- [ ] Phase 0 verification: gemini.sh + codex.sh status
      in tree resolved (forward-port or author).
- [ ] `tools/peer-call/kiro.sh` lands with the same
      flag-shape as grok.sh + working invocation
      (verified manually).
- [ ] `tools/peer-call/claude.sh` lands with subprocess-
      mode + at least 2 cold-boot test scenarios
      (verified by running them).
- [ ] `tools/peer-call/README.md` documents the shared
      convention.

## Composes with

- **B-0064** — GitHub × Playwright integration; the
  Playwright runs may benefit from a peer-call
  validation pass.
- `feedback_kiro_cli_added_to_agent_roster_aaron_2026_04_28.md`
  — the roster-add this script makes operational.
- Otto-347 cross-CLI verify discipline — the
  motivation for these sibling callers.
- Otto-275-FOREVER (knowing-rule != applying-rule) —
  cold-boot self-test is the empirical check on the
  agent's own substrate-application.
- Task #303 (Sibling peer-call scripts) — marked
  completed but the on-disk reality is grok.sh-only
  on this branch; this row covers the resolution.
