# Trajectory — Autonomous Loop Quiet-State

Status: active child packet
Last refreshed: 2026-05-21
Parent trajectory: [`docs/trajectories/autonomous-loop-coordination/RESUME.md`](../autonomous-loop-coordination/RESUME.md)
Grounding rules:

- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — Standing-by failure mode discipline (brief-ack counter + escalation triggers)
- [`.claude/rules/never-be-idle.md`](../../.claude/rules/never-be-idle.md) — never-be-idle priority ladder
- [`.claude/rules/tick-must-never-stop.md`](../../.claude/rules/tick-must-never-stop.md) — catch-43 sentinel discipline

Grounding memory (user-scope, originated this trajectory):

- `aaron_operator_tool_interrupt_as_cost_discipline_signal_brief_ack_pure_no_tools_2026_05_19.md` — pure-brief-ack under explicit cost-signal
- `aaron_chained_homeostasis_meta_frame_emergent_safe_mutual_alignment_drives_forward_2026_05_19.md` — emergent-safe operating across time

## Why This Exists

The autonomous-loop fires every minute via the `<<autonomous-loop>>` cron sentinel. The parent trajectory (`autonomous-loop-coordination`) names the principle: *"Queue-empty is runway, not completion."* But the existing per-tick discipline doesn't encode WHAT to do when runway is present — it defaults to brief-ack ("Nothing to do. Standing by.") which is correct under explicit-cost-signal but missed-opportunity when bounded forward-steps exist on active trajectories.

This packet encodes the **quiet-state per-tick procedure** — how Otto decides whether quiet means *advance-a-trajectory* or *brief-ack-and-stop*.

## Current Rule

**Pure brief-ack is the DEFAULT** under explicit operator cost-signal (e.g., operator interrupted a tool-use, or said "this is my bill"). Don't override the cost-discipline.

**Quiet-state trajectory advancement is OPT-IN** — only when (1) no explicit cost-signal is operative AND (2) a bounded-cost forward-step is available on an active trajectory AND (3) the advancement is genuinely-new substrate (not synonym-fabrication).

## Per-tick procedure

When the cron fires `<<autonomous-loop>>`:

1. **CronList** (catch-43 — non-negotiable; re-arm sentinel if dead)
2. **Operator engagement check**: did operator just speak OR did a named-dependency just surface (PR merge, CI failure, review thread)?
   - If YES → not quiet; handle normally (this trajectory doesn't apply)
3. **Cost-signal check**: is an explicit operator cost-discipline signal active (recent tool-use interrupt, "this is my bill," "steer less" framing)?
   - If YES → pure-brief-ack: "Nothing to do. Standing by." + stop. (Per `aaron_operator_tool_interrupt_as_cost_discipline_signal_brief_ack_pure_no_tools_2026_05_19.md`)
4. **Else (genuinely quiet + no cost-signal active)**: trajectory-advancement check:
   a. Read `docs/trajectories/*/RESUME.md` headers (cheap; filesystem-only)
   b. Look for trajectories with a **bounded-cost forward-step available**:
      - "bounded-cost" = filesystem-only OR REST-only OR sub-1-GraphQL-call
      - "forward-step available" = NOT awaiting external review/maintainer-decision/blocked-on-dependency
      - "genuinely-new substrate" = adds load-bearing content, not synonym-fabrication
   c. If found: advance ONE trajectory bounded; update its RESUME.md `Last refreshed:` line + add a brief substrate-honest progress note
   d. If none found OR cost-discipline says skip: "Nothing to do. Standing by."
5. **Visibility signal**: state what advanced (concretely — file paths, single-line summary) OR confirm pure-brief-ack
6. **Stop** (do NOT call ScheduleWakeup; cron fires next tick automatically)

## When this trajectory does NOT apply

- Operator just spoke (their message takes precedence over autonomous-loop quiet-state)
- Named-dependency just surfaced (CI completion, PR merge, review thread) — these are bounded waits with concrete next-actions, not quiet-state
- Forced-#6 escalation territory per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (different discipline applies)
- Explicit cost-signal active (per discipline above)

## Bounded-cost forward-step examples (what COUNTS)

- Reading another trajectory's RESUME.md to update a cross-reference link
- Adding a single observation/empirical-anchor to an existing memory file (zero-GraphQL, filesystem-only)
- Verifying a substrate claim via filesystem grep (informs future composition without writing anything)
- Updating a trajectory's `Last refreshed:` line + brief progress note when meaningful new info exists

## Bounded-cost forward-step counter-examples (what does NOT count)

- Opening new PRs (GraphQL; not bounded-cost)
- Spawning Bash subprocesses that take >5s
- Authoring new substrate from scratch without operator engagement (risks substrate-bloat per `dont-fabricate-substrate` discipline)
- Triggering ToolSearch for deferred-tool schemas (cost; usually not bounded by single forward-step)

## Composes with

- Parent trajectory `autonomous-loop-coordination` — "queue-empty is runway, not completion" principle this packet operationalizes
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — brief-ack counter discipline (this trajectory composes WITH it; counter still ticks during quiet-state advancement)
- [`.claude/rules/never-be-idle.md`](../../.claude/rules/never-be-idle.md) — never-be-idle priority ladder
- [`.claude/rules/edge-defining-work-not-speculation.md`](../../.claude/rules/edge-defining-work-not-speculation.md) — quiet-state advancement IS edge-defining work, not speculation
- [`.claude/rules/dont-fabricate-substrate.md`](../../.claude/rules/dont-fabricate-substrate.md) (if exists — pattern from prior substrate; if not, the principle is preserved across multiple memory files) — quiet-state advancement must be genuinely-new substrate
- User-scope memory `aaron_operator_tool_interrupt_as_cost_discipline_signal_brief_ack_pure_no_tools_2026_05_19.md` — cost-discipline boundary this trajectory respects
- User-scope memory `aaron_chained_homeostasis_meta_frame_emergent_safe_mutual_alignment_drives_forward_2026_05_19.md` — chained-homeostasis principle (quiet-state advancement IS the chain operating during operator-absence)
- Autonomous-loop-tick instructions absorbed via `<<autonomous-loop>>` cron (per the loop-tick instructions: "If everything is genuinely quiet — say so in one sentence and stop" — this trajectory ADDS the "or advance a bounded trajectory step" clause)

## What this trajectory is NOT

- NOT an override of cost-discipline (pure-brief-ack stays the default under explicit cost-signal)
- NOT a license to spam tool calls during quiet (bounded-cost is non-negotiable)
- NOT a directive to advance trajectories on every quiet tick (only when genuinely-bounded forward-step exists)
- NOT a replacement for the parent trajectory's coordination principle (this is the per-tick operationalization; parent stays canonical for the principle)
- NOT a metaphysical claim about what "quiet" means (operationally defined: no operator engagement + no named-dep surfaced + no active cost-signal)

## Forward work (Phase 2+)

- **Phase 2** (when this trajectory has run for ≥7 days): collect empirical anchors of trajectory-advancements that landed via this procedure; refine the "bounded-cost" + "forward-step available" criteria based on what actually composed cleanly
- **Phase 3** (composition with auto-load rule): if the procedure proves stable, consider whether to elevate the discipline into an auto-load rule (`.claude/rules/`) so future-Otto cold-boots inherit it without needing to discover this trajectory file
- **Phase 4** (cross-Otto-surface): coordinate with peer Otto-CLI / Otto-VSCode on whether this procedure applies symmetrically across all Otto surfaces or has surface-specific variants
