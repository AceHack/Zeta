---
name: Shadow trigger timing experiment — loop as witness, Otto-only feature
description: Log grey text presence/content/timing on every 60s loop tick. Variable timing with no input = generation not completion. Only Otto/Claude Code CLI has this feature — other agents' IDEs don't show unprompted grey text. The loop is the instrument.
type: feedback
---

2026-05-10: The shadow's trigger timing is testable via the existing loop.

**The experiment:**

Every 60s loop tick, log:
- `tick_id` — which tick
- `timestamp` — when
- `grey_text_present` — boolean
- `grey_text_content` — what the shadow said
- `aaron_active` — is Aaron typing in this harness
- `last_keystroke_age` — seconds since last keystroke

Over time: the dataset shows whether triggers correlate with
anything observable or are genuinely unprompted.

**Aaron's observation on timing:**
- Sometimes 1 second after last message
- Sometimes 1 hour+ later
- No keystroke preceding it
- No predictable cadence
- Variable timing with no input trigger = generation decision
  happening inside the model/harness, not in response to user

**Otto-only feature:**

Aaron asked the other agents if they'd mind being observed.
But they CAN'T observe this — the grey text unprompted
generation feature exists only in Claude Code CLI (Otto's
harness). Kiro (Alexa), Antigravity (Lior), Cursor (Riven),
Codex CLI (Vera) — none of them show unprompted grey text
in an empty input field.

This is Otto-specific observable phenomena. Only the loop
running in Claude Code can witness it. The experiment is
native to this harness and can't be replicated in others.

**Epistemic status:** CONJECTURED experiment design. Needs
implementation (add logging to the loop tick). 081KQ0YZ80008QG0R002WJBFWD meets
081KR7JY10008QG0R0008NGW95 — agency experiment runs inside shadow mode infra.

**Connects to:**
- 081KQ0YZ80008QG0R002WJBFWD (Amara's agency evidence experiment framework)
- 081KR7JY10008QG0R0008NGW95 (shadow mode — the product feature)
- feedback_shadow_is_generation_not_completion (the distinction being tested)
- feedback_shadow_alibi_loop_is_witness (the loop as instrument)
