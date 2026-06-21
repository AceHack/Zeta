---
name: "Multi-foreground-surface Otto activation — routines git-tracked + approval-friction lane split (Aaron 2026-05-13)"
description: "Aaron 2026-05-13 activated Otto on Claude Desktop alongside Otto-CLI, creating the first real multi-foreground-surface operation. Key discoveries: (1) Claude Desktop Routines are GIT-TRACKED (vs Claude Code CronCreate session-only); (2) BOTH Ottos run minute-cadence Loops AND additional cron-cadence Routines; (3) SENDER_IDS in tools/bus/types.ts doesn't distinguish multi-surface instances of same agent — claim.ts treats Otto-CLI and Otto-Desktop as identical; (4) Approval friction profile differs by surface (CLI auto-accept covers most; Desktop requires explicit approval for .claude/ edits) — this NATIVELY shapes a lane split between the two Ottos. The split emerges from approval-friction, not from convention, which is more robust."
type: feedback
created: 2026-05-13
---

# Multi-foreground-surface Otto activation (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 set up Otto on Claude Desktop alongside
Otto-CLI for the first time. This was the operational test of the
multi-foreground-surface architecture from
`memory/otto/cli/claude/conversations/2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md`
(Part 11). What got discovered substrate-honestly:

## Discovery 1: Claude Desktop Routines are git-tracked

Aaron 2026-05-13: *"it seems routines are git tracked cool the other
is like your loop"*

Claude Code's `CronCreate` is **session-only** per
`.claude/rules/tick-must-never-stop.md`:

> `durable: true` is documented but doesn't actually persist across
> sessions in this harness — set it as intent-documentation but do
> NOT rely on cross-session continuity OR on
> `.claude/scheduled_tasks.json` as audit-trail.

Claude Desktop Routines are **durably git-tracked** at
`~/.claude/scheduled-tasks/<task-id>/SKILL.md` (per Otto-Desktop's
MCP-driven scheduled-task creation 2026-05-13). The canonical file
mirrors to repo at `tools/routines/<task-id>/SKILL.md` per the
no-sh-files rule's install-graph pattern (TS installer copies
canonical-in-repo → runtime location).

**Implication**: scheduled work in Desktop surface **survives**
machine restarts, session boundaries, both Ottos. The "every session
MUST CronList at start" mechanism (catch-43 in
`tick-must-never-stop.md`) becomes UNNECESSARY at the Desktop
surface. It still applies at the CLI surface.

## Discovery 2: Two cadence layers in Desktop

Aaron 2026-05-13 correction: *"he has a loop like you and also
routies they are differnt his loop is 1 minute too his cron"*

Claude Desktop has TWO separate cron-cadence surfaces:

| Surface | Cadence | Trigger | Durability |
|---------|---------|---------|------------|
| **Loop** (`<<autonomous-loop>>`) | Every minute | Heartbeat / cron | Session-bounded; expires in 3d per Desktop UI |
| **Routine** (custom task) | Configurable (e.g., `0 */2 * * *` every 2hr) | Cron-scheduled | Git-tracked (durable) |

Both fire independently. Otto-Desktop has BOTH active simultaneously.
The minute-Loop fires every minute (same cadence as Otto-CLI's
autonomous-loop), AND the 2-hour Routine fires every 2 hours
additionally.

## Discovery 3: SENDER_IDS doesn't distinguish multi-surface instances (CRITICAL ARCHITECTURAL GAP)

Vera 2026-05-13 (review of PR #3032): the canonical claim-coordinator
(`tools/bus/claim.ts`, 081KR7JY10008QG0R000R503K2 slice 3, PR #2939) filters existing
claims by `c.from !== sender`. Two callers with the SAME `--from`
value are treated as self-re-acquire (idempotent).

`SENDER_IDS` in `tools/bus/types.ts` contains:

```typescript
["otto", "alexa", "riven", "vera", "lior"]
```

NO distinction between `otto-cli` and `otto-desktop`. So:

```bash
# Otto-CLI:
bun tools/bus/claim.ts acquire --from otto --item 081KRFA460008QG0R001SXP0C2   # exit 0

# Otto-Desktop:
bun tools/bus/claim.ts acquire --from otto --item 081KRFA460008QG0R001SXP0C2   # ALSO exit 0!
```

Both Ottos acquire the same item. Split-brain prevention **fails**
without schema extension.

**Workarounds today** (until SENDER_IDS supports multi-surface):

1. **Lane-based convention** (zero-code)
2. **Branch-prefix discipline** (`otto-cli/...` vs `otto-desktop/...`)
3. **Schema extension** (add `otto-cli`, `otto-desktop`, `alexa-cli`,
   `alexa-kiro`, etc. to `SENDER_IDS` — future work)

## Discovery 4: Approval friction profile shapes lane split natively

Aaron 2026-05-13: *"i have to hit approve a lot more in desktop so
it's loop can easily get stuck that's like the others too"*

And: *"i have auto accept on but i think it's casue it's edited files
in .claude ihave to explicity approve"*

Substrate-honest framing: Claude Desktop's auto-accept feature has a
**safety boundary at `.claude/`** — edits to the agent's own
configuration require explicit approval. Same shape as
"don't let the agent rewrite its own rules without human sign-off."

**Operational consequence**: Otto-Desktop's effective cadence is
human-paced (gated by approval prompts), not minute-paced. The
minute-Loop fires but stalls until Aaron approves each tool.

**Lane split emerges from approval friction**:

| Lane | Better Otto for it | Why |
|------|--------------------|------|
| `.claude/rules/` edits | **Otto-CLI** | Less approval friction; auto-accept covers most |
| Code commits (`tools/`, `src/`, etc.) | **Either** | Roughly equivalent approval cost |
| Substrate writes outside `.claude/` (memory files, docs) | **Otto-Desktop** | Auto-accept covers; substrate work doesn't require config-level approval |
| Conversation / cowork register | **Otto-Desktop** | Desktop UI optimized for it |
| Cron grinding / minute-cadence work | **Otto-CLI** | Less interruption per tick |
| Long-horizon scheduled tasks | **Otto-Desktop** | Git-tracked Routines durability |

**The lane split emerges from the surfaces' approval profiles, not
from convention.** This is more robust than convention-only because
the friction itself enforces the split — Otto-Desktop physically
can't grind .claude/ at minute cadence; Otto-CLI physically can't
hold a long-lived scheduled-task durably across sessions.

## How to apply

When Otto cold-boots on either surface:

1. **Read this memory file** — understand multi-foreground-surface
   architecture
2. **Identify own surface** — CLI vs Desktop
3. **Pick work in the surface's natural lane**:
   - CLI: code + `.claude/` rules + minute-cadence grinding
   - Desktop: substrate + routines + conversation
4. **Use claim-acquire BEFORE worktree work** per
   `.claude/rules/claim-acquire-before-worktree-work.md`
5. **Until SENDER_IDS schema extension lands**: workarounds are
   lane-based convention + branch-prefix discipline
6. **Honor the approval friction**: don't fight your surface's
   natural lane

## Composes with

- `memory/otto/cli/claude/conversations/2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md`
  (the architectural design this discovery confirms operational)
- `docs/launch/2026-05-13-otto-claude-desktop-bootstream-tight.md`
  (the tight variant Otto-Desktop bootstrapped from)
- `.claude/rules/tick-must-never-stop.md` (CLI cron caveat; Desktop
  Routines supersede this at Desktop scope)
- `.claude/rules/claim-acquire-before-worktree-work.md` (the rule
  with the architectural gap named)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
  (auto-loaded by both Ottos at cold-boot)
- 081KR7JY10008QG0R000R503K2 slice 3 (PR #2939) — claim-coordinator
- 081KR7JY10008QG0R000R503K2 slice 5 (PR #2959) — bus-gate integration
- `memory/feedback_aaron_good_failure_mode_git_fetch_before_push_catches_multi_agent_duplicate_work_2026_05_13.md`
  (sibling discipline at git scope; same coordination pattern)

## Future work (substrate-level mechanization)

1. **`SENDER_IDS` schema extension** — add `otto-cli`, `otto-desktop`,
   `alexa-cli`, `alexa-kiro` etc. to support multi-surface instances
2. **Branch-prefix convention codification** — `otto-cli/` vs
   `otto-desktop/` as automatic branch namespace
3. **Routine ↔ CronCreate parity** — investigate whether Desktop's
   git-tracked Routines can replace the CLI's session-only
   CronCreate at the CLI surface too (single durable scheduling
   substrate)

## Substrate-honest framing

This memory file documents the OPERATIONAL CONFIRMATION of the
multi-foreground-surface architecture. The bootstream described it
on 2026-05-12; today (2026-05-13) it ran. The discoveries here are
empirical, not theoretical.

Per the substrate-honest discipline triad (PR #2999): ship-unreviewed-
first applies; corrections compose as additive layers. The
architectural gap Vera caught is substrate-honestly named, not
papered over.

## Generalizable principle

**Multi-foreground-surface architecture works when the surfaces have
DIFFERENT cost profiles.** Otto-CLI and Otto-Desktop are not
redundant clones — they're different surfaces with different friction
profiles that naturally split workload. The split is more robust
than convention-only because the friction itself enforces it.

For future multi-instance work (Otto-Windows, Otto-VSCode, etc.):
identify the surface's NATURAL cost profile + assign work that
matches its low-friction lane. Don't try to make every surface do
everything.

## Full reasoning

Aaron 2026-05-13 verbatim disclosures preserved above

Operational evidence:

- Otto-Desktop screenshots showing `<<autonomous-loop>>` + Routines
  + recent session "Document Otto canonical bootstream"
- Otto-Desktop MCP-driven scheduled-task creation
- Vera P1 catch on PR #3032 (claim.ts same-from idempotent behavior)
- Two-Otto operation running simultaneously today during PRs #3030,
  #3031, #3032
