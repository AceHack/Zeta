---
id: B-0542
title: Background service clicks past stuck prompts on foreground Otto surfaces (3-surface BFT recovery node)
priority: P1
status: open
type: slice
parent: B-0539
created: 2026-05-15
ask: Aaron
effort: M
tags: [substrate, launchd, otto-bft, recovery, stuck-prompt]
depends_on: []
composes_with: [B-0539, B-0540, B-0541]
last_updated: 2026-05-15
---

## Why

Slice 3 of the Otto-BFT umbrella (B-0539). When a foreground Otto
session (Otto-CLI or Otto-Desktop) is hung waiting for human ack
on a stuck prompt (permission request, confirmation dialog,
classifier timeout, etc.), the work blocks until Aaron clicks
something — but Aaron may be asleep, away, or on another surface.

The Otto-launchd-background service (`com.zeta.claude-loop` plist,
runs every 60s) is the natural third node in the BFT triangle.
It already polls the repo state, fires tick logic, and runs with
Aaron's authorization for routine PR work. Extending it to
recognize and unblock stuck-prompt states on the foreground Ottos
would close the loop.

Per Aaron's phrasing: *"include your background service to click
past stuck prompts on both — you have your own internal BFT."*

## What

1. **Detect stuck-prompt state** on a foreground Otto:
   - Pattern: process is alive but hasn't emitted bus heartbeat in
     N minutes AND has not exited (so it's actually hung, not done)
   - Possible signals: stale heartbeat timestamps in
     `~/.local/share/zeta-broadcasts/<otto-surface>.md`, no recent
     PR activity, process still consuming small CPU (waiting on
     I/O, not crashed)

2. **Click-past mechanism**: needs an actuator that can interact
   with the foreground Claude Code / Claude Desktop UI from the
   launchd service. Options:
   - `osascript` to send keystrokes to the focused window
   - The same `osascript`-Chrome pattern Otto uses for Grok
     extraction (see `tools/save-ai-memory/extract-grok-conversation.ts`)
   - An MCP tool that exposes "ack the current prompt"
   - Direct file write to a known location the foreground Claude
     watches

3. **Safety**: don't auto-click destructive prompts. The launchd
   service should only ack KNOWN-SAFE prompts (e.g., "ack and
   continue"). Hard-refuse prompts should escalate to Aaron's
   actual attention via a bus envelope.

4. **Compose with B-0541's quorum** — the click-past action is
   triggered by the cross-surface quorum signal (B-0541), not by
   the background service's own scheduling.

## Operational notes

- The bg services suite has the infrastructure for the heartbeat
  monitoring side (PR #3017); the click-past actuator side is
  the new mechanism
- macOS-specific (`osascript`) — Windows/Linux variants would
  need their own actuators
- The "safety" constraint is load-bearing — the substrate-honest
  framing per `.claude/rules/methodology-hard-limits.md` is that
  automation should advance the work, not bypass legitimate
  human-gating

## Composes with

- B-0539 (umbrella)
- B-0540 (sibling — rule-level escalation)
- B-0541 (sibling — cross-surface bus detector that triggers the
  click-past)
- `~/Library/LaunchAgents/com.zeta.claude-loop.plist` (the launchd
  service this work extends)
- `.claude/bin/claude-loop-tick.ts` (the tick script that runs
  in the launchd context)
- `tools/save-ai-memory/extract-grok-conversation.ts` (worked
  example of osascript-driven UI interaction with safety
  discipline)
- `.claude/rules/methodology-hard-limits.md` (safety floor for
  what can be auto-acked vs what requires Aaron's attention)
