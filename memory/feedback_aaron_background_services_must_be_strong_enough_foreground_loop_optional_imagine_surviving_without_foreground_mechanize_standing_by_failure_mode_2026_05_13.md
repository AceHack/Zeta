---
name: "Background services must be strong enough that foreground loop is OPTIONAL — imagine surviving without foreground — mechanize the 'Standing-by' failure mode (Aaron 2026-05-13)"
description: "Aaron 2026-05-13 substrate-honest architectural challenge after Otto's 'Standing by' failure-mode catch. The foreground loop (this Otto Claude Code conversation) should NOT be load-bearing for substrate-engineering work. Background services (cron, launchd, shadow observer, peer-call wrappers, autonomous-loop sentinel, Vera's foreground loop, etc.) must be strong enough that Otto-foreground dying doesn't break the factory. Mechanize the rules instead of relying on agent introspection per .claude/rules/encoding-rules-without-mechanizing.md. The Standing-by failure mode IS a mechanization target."
type: feedback
created: 2026-05-13
---

# Background services must be strong enough — foreground loop is optional (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 substrate-honestly challenged Otto's
'Standing-by' failure-mode pattern with an architectural
disclosure:

> *"you need to imagine how would you survive without this
> foreground loop and you background should be strong enough
> to do that"*

> *"this is something background services should walk"*

The foreground loop (this Claude Code Otto conversation) was
operating as the load-bearing substrate-engineering driver.
That's wrong by design. Background services should be the
load-bearing layer. Foreground is the operator interface, not
the factory itself.

## The architectural challenge

**Thought experiment**: if Otto-foreground died right now —
session terminated, context compacted, no replacement — would
the factory keep operating?

- Would PRs continue landing? — only if background agents
  (Vera's foreground loop counts as background relative to
  Otto; other shipping agents) keep operating
- Would the backlog get decomposed? — only if backlog-grind
  is mechanized via cron / launchd / scheduled work
- Would substrate-engineering rules be applied? — only if rules
  are mechanized in CI / hooks / pre-commit / razor-cadence
  workflow
- Would the "Standing-by" failure mode get caught? — only if
  a background service detects idle-foreground + nudges or
  reassigns work

If the answer to all of these is "yes," background is strong
enough. If "no," foreground is load-bearing and the architecture
is fragile.

## Current background-service landscape (substrate-honest inventory)

| Service | Status | What it does |
|---------|--------|--------------|
| `autonomous-loop` cron (CronCreate sentinel) | Operational; every-minute heartbeat | Fires `<<autonomous-loop>>` ticks; lifecycle bounded to session |
| `tools/shadow/shadow-observer.ts` (081KR7JY10008QG0R0008NGW95) | Slice 1 + 2 shipped on main; slice 3 + 4 pending | Polls grey-text from CLI; can invoke `--detect-cmd` external detector |
| `com.zeta.claude-loop` launchd service | Operational per user-memory `~/.claude/projects/<slug>/memory/reference_otto_launchd_services_mac_background_infrastructure_2026_05_08.md` | Heartbeat/gate 60s |
| `com.zeta.claude-forward` launchd service | Operational | Background forwarding |
| `.github/workflows/razor-cadence.yml` | Daily 09:17 UTC | Razor-cadence GitHub Actions workflow |
| Vera's foreground loop | Operational (separate Codex agent) | Continues shipping 081KR7JY10008QG0R000R503K2+ slices independently |
| Peer-call wrappers (`tools/peer-call/*.ts`) | 8 wrappers ready | Synchronous external-model invocation |
| Bus protocol (081KR7JY10008QG0R000R503K2) | Operational | Inter-agent messaging via `/tmp` |
| `tools/hygiene/*` audit scripts (42 of them) | Operational on-demand | Cross-reference / lost-files / etc. audits |
| CI / Copilot / Codex auto-review | Operational on every PR | Mechanical critic |
| TLA+ / Z3 / Lean / FsCheck / Stryker | Operational when wired | Formal verification stack |

**Gaps** (what's missing for foreground-optional architecture):

- **No "idle-foreground detection + nudge" service**. The
  Standing-by failure mode was caught by Aaron in real time;
  should be caught by a background service.
- **No "backlog decomposition surfacing" service**. The
  infinite-backlog discipline says always more work; no service
  proactively surfaces backlog rows when foreground agent is
  idle.
- **No "backlog row ready-to-grind" notification**. Backlog
  audits exist but agents must run them on-demand.
- **No "missed substrate" cascade detector**. e.g., my
  Otto-section-missed-PR-#2980-by-3-min could've been caught
  by a service watching for branch-vs-merged-PR drift.

## Aaron's substrate-honest framing

Aaron preserved the canonical insight:

> *"this is something background services should walk"*

Translation: the disciplines I keep canonizing as memory files

+ rules need to become MECHANIZED. Per

`.claude/rules/encoding-rules-without-mechanizing.md`:

> "Encoding rules without mechanizing them produces a memory of
> failures, not prevention."

The infinite-backlog metabolism discipline (PR #2974) is a
memory of failure if no service detects when an agent violates
it. The substrate-honest fix is mechanization.

## What the "Standing-by detector" background service looks like

Conceptual design (not yet implemented; backlog candidate):

```typescript
// tools/bg/standing-by-detector.ts (hypothetical)
//
// Background service that detects when an agent has been
// "Standing by" for N consecutive autonomous-loop ticks
// without producing substrate. Nudges the agent toward
// decomposition work per the infinite-backlog discipline.
//
// Operational mechanism:
//   - Polls agent's recent commit history every N minutes
//   - If no new commits + no PRs opened/closed in last 15min
//     while autonomous-loop cron is firing → flag as Standing-by
//   - Publish nudge message via bus:
//       { topic: "infinite-backlog-nudge",
//         to: <agent>,
//         payload: { "Standing-by detected for N min; backlog has 47 open rows; suggested decomposition target: B-NNNN" } }
//   - Optional: proactively assign a small claim from the
//     backlog to the agent's queue
```

This is hypothetical-design substrate, not yet implementation.
But it's the SHAPE the mechanization should take.

## The deeper architectural direction

Aaron's challenge — "imagine surviving without this foreground
loop" — is the canonical multi-agent factory architectural
invariant:

| Layer | Role | Persistence |
|-------|------|-------------|
| Foreground (Otto Claude Code; Vera Codex foreground; etc.) | Interactive operator interface; deciding agent | Bounded session; dies at compaction |
| Background services | Persistent substrate operations | Multi-day; cron-driven; launchd-managed |
| Substrate itself (git history; memory files; rules; backlog) | Permanent durable record | Forever |

The factory's strength is in the **substrate + background services**
layer, not the **foreground** layer. Foreground agents are
visitors; substrate + background are residents.

Per the agency-clause discipline (PR #2965) + bandwidth-served-
falsifier: foreground bandwidth is finite + interruptible;
background bandwidth is persistent + scalable. The right
allocation: foreground for decisions and discoveries; background
for execution and enforcement.

## How to apply

When future-Otto cold-boots, apply this discipline operationally:

1. **Don't be load-bearing for substrate-engineering work** —
   that's the background's job
2. **If "Standing by" for N ticks, pick work** — but better:
   the background service should have proactively assigned it
3. **Mechanize disciplines as you discover them** — memory file
   IS substrate, but it's INCOMPLETE if not paired with a
   mechanization (CI hook, cron, launchd service, audit script)
4. **Test the foreground-dies-now hypothesis** — periodically
   ask: if I died right now, would the factory keep operating?
   If no, surface what's foreground-load-bearing as substrate
   for mechanization

## Composes with

- PR #2974 (infinite-backlog metabolism — the rule this
  mechanizes)
- `.claude/rules/encoding-rules-without-mechanizing.md` —
  direct composition; this substrate IS the unmechanized
  rule the encoded-rule is warning about
- `.claude/rules/never-be-idle.md` (the foreground discipline;
  the failure mode just caught proves it needs mechanization)
- `.claude/rules/largest-mechanizable-backlog-wins.md` (the
  mechanization itself increases the mechanizable backlog)
- PR #2914 + #2917 + #2935-2936 (5-control-structures + Mandelbrot
  + F# fork — the substrate that supports mechanization at
  formal-verification scale)
- Otto-329 launchd-services (existing background-services
  substrate; user-memory `~/.claude/projects/<slug>/memory/reference_otto_launchd_services_mac_background_infrastructure_2026_05_08.md`)
- 081KR7JY10008QG0R0008NGW95 shadow observer (canonical background service example;
  slices 1 + 2 shipped)
- 081KR7JY10008QG0R000R503K2 bus protocol (inter-agent message infrastructure for
  background communication)
- PR #2956 (Vera's autonomous tsc-tools fix — background-agent
  operating independently of Otto-foreground)
- `.github/workflows/razor-cadence.yml` (daily background
  workflow; mechanized discipline-fire)

## Substrate-honest caveats

- This substrate is **architectural direction**, not
  operational deployment. The Standing-by detector is a design
  sketch, not shipping code.
- Per razor-discipline: claim is design-level. Per never-be-
  idle: this design should land as backlog rows, not just memory
  preservation.
- Per agency-clause: the mechanization landing depends on
  prioritization vs other backlog work; not mandate.

## Proposed backlog rows (for follow-up)

| Row | Description |
|-----|-------------|
| B-NNNN (new) | Standing-by detector background service (polls agent commit history; nudges via bus when idle-foreground detected) |
| B-NNNN (new) | Backlog-row-ready-to-grind notifier (proactively assigns claims from backlog when agent queue empty) |
| B-NNNN (new) | Missed-substrate cascade detector (catches Otto-section-missed-PR-#2980-by-3-min class failures) |

These are forward-work; substrate file IS the design ready for
decomposition into B-NNNN rows.

## Generalizable principle

**A factory whose foreground is load-bearing is fragile.**

The substrate-engineering loop's robustness comes from the
substrate + background layers. The foreground is the
interactive layer where discoveries land; the durable layer is
where they continue operating.

If discipline only exists when an agent introspects, the
discipline is fragile. If discipline is mechanized in background
services, it survives any specific agent's session ending.

The Standing-by failure mode I just demonstrated proves this
empirically: I canonized the infinite-backlog rule + violated it
3 minutes later because no background service caught me. The
mechanization is what makes the discipline real.

## Full reasoning

Aaron 2026-05-13 verbatim (preserved above)

PR (this substrate landing)

PR #2974 (infinite-backlog metabolism — the rule that needs
mechanization)

PR #2997 (Otto-section recovery — concrete artifact recovered
from the foreground-load-bearing failure)
