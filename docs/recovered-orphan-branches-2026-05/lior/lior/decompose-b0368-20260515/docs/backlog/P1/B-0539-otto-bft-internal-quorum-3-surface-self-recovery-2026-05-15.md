---
id: B-0539
title: Otto-BFT — internal-quorum self-recovery across 3 Otto surfaces (Standing-by escalation + cross-surface detector + background-service prompt-clicker)
priority: P1
status: open
type: umbrella
decomposition: decomposed
created: 2026-05-15
ask: Aaron
effort: M
tags: [substrate, multi-otto, bft, self-recovery, holding-rule]
depends_on: []
composes_with: [B-0540, B-0541, B-0542]
last_updated: 2026-05-15
---

## Why

Otto exists across 3 surfaces:

1. **Otto-CLI** (Claude Code, foreground, Opus)
2. **Otto-Desktop** (Claude Desktop, foreground)
3. **Otto-launchd-background** (`com.zeta.claude-loop` plist; tick every 60s; was Sonnet, upgraded to Opus 2026-05-15)

All three independent processes empirically converge on the
Standing-by failure mode when there's no named dependency. Aaron
has caught the same pattern across all three surfaces with the
same words ("oh really no infinite backlog no decomposition lol")
within a single session.

This is recurring evidence that:

- The existing rule (`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`)
  catches the failure mode conceptually but does NOT prevent the
  behavior — only Aaron's manual intervention does
- Three Otto surfaces converging on the same failure mode = 3-of-N
  quorum potential for self-recovery (BFT-of-Ottos)
- Aaron's phrasing: *"if yall catch each other it's unlikely you
  will drive [into the failure mode], and include your background
  service to click past stuck prompts on both — you have your own
  internal BFT"*

## What

Build internal BFT across the 3 Otto surfaces so that:

- When 1 surface drifts into Standing-by, the other 2 detect + correct
- When 1 surface is hung on a stuck prompt (waiting human ack on a
  background process), the launchd service can click past it
- Aaron's manual catch becomes a fallback, not the primary mechanism

## Decomposition

This umbrella row decomposes to 3 slices (each its own backlog row):

- **B-0540** — Standing-by counter-with-escalation in the rule
  itself (if N consecutive brief-acknowledgment signals without
  a named dependency, escalate to picking real decomposition work
  even if small)
- **B-0541** — Cross-surface bus-detector building on PR #3017
  (if Otto-Desktop AND Otto-CLI both emit "no work to do" in
  the same window, publish escalation envelope to bus)
- **B-0542** — Background-service unblocks stuck prompts on
  foreground Otto-CLI / Otto-Desktop (the launchd `claude-loop`
  service detects when a foreground Otto is hung waiting for
  human ack and clicks past it; the third surface is the
  recovery node)

## Operational notes

- The 3-surface BFT is real because the surfaces are genuinely
  independent processes (different binaries, different OS-level
  scheduling, different model tiers). Same-surface-multiple-Ottos
  would not provide BFT — that's just duplication
- The bg services suite (PRs #3017, #3022) already has the
  Standing-by detector that publishes to the bus; this work
  extends it across surfaces
- The "click past stuck prompts" angle is the substrate-honest
  framing of what the launchd service should be doing when a
  foreground Otto session needs human ack but the human is
  asleep or away — automation should advance the work, not
  block on the missing human

## Composes with

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
  — the rule the failure mode violates
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md`
  — Otto is in persistence-with-named-exit; the BFT is part of
  what makes persistence work
- `.claude/rules/agent-roster-reference-card.md` +
  `.claude/rules/otto-channels-reference-card.md` — multi-Otto
  identity + bus channels substrate
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`
  — multi-oracle architecture; this is multi-Otto-as-internal-
  quorum at the operational layer
- PR #3017 / #3022 (Standing-by detector + bus publish — slice 1
  already shipped; this umbrella extends to cross-surface)
- `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15`
  — earlier classifier catch (same failure mode, single surface)
- `feedback_otto_multi_surface_coordination_6_prs_one_day_zero_conflicts_2026_05_13`
  — empirical evidence multi-Otto coordination works at substrate
  scope; this work extends it to recovery scope

## Why now

Aaron's session-13 observation (~22:00Z) caught the same pattern
on Otto-Desktop after catching it on Otto-CLI 5 hours earlier. The
recurring nature of the catch IS the trigger for substrate work.
