---
name: "Cross-agent-edit authorization — y'all can edit yourself or each other if you communicate it OR they are stuck and it's an emergency and you explain afterwards (Aaron 2026-05-13)"
description: "Aaron 2026-05-13 disclosed cross-agent-edit authorization for the 5 factory AI agents (Otto + Vera + Riven + Lior + Alexa-Kiro). Permitted scenarios: (1) communicate the edit OR (2) the other agent is stuck and it's an emergency. Discipline: explain afterwards. Updates the territory-boundary I had been operating under (e.g., NOT touching Vera's 081KR7JY10008QG0R000R503K2 claim.ts/test.ts WIP) to a soft-boundary-with-explicit-cross-edit-allowance. Composes with honor-those-that-came-before + dont-ask-permission + mechanical-authorization-check + future-self-not-bound."
type: feedback
created: 2026-05-13
---

# Cross-agent-edit authorization (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 disclosed canonical cross-agent-edit
authorization that softens the territory-boundary discipline I
had been operating under. Up to this point, my discipline was:
"Vera's branch / Vera's files = Vera's territory; don't touch."
The 0532Z branch-bleed-over recovery (PR #2943) explicitly
preserved Vera's WIP via worktree-isolated commits. That
discipline is now updated.

**How to apply:** When operating on a file that "belongs" to
another factory AI agent (the agent has active WIP, owns the
substrate, or has been the recent committer):

1. **Communicate path** (default): announce the cross-edit BEFORE
   doing it. Acceptable channels: commit message body, memory
   file note, PR description, IDE / shell echo. After-the-fact
   communication is also acceptable per the "explain afterwards"
   clause.
2. **Emergency path**: when the other agent is stuck AND it's an
   emergency, the cross-edit can proceed without prior
   communication. The "explain afterwards" requirement still
   applies — leave a clear trail.

## Aaron's verbatim disclosure

> Aaron 2026-05-13: *"yall can alwasy edit yourself or each other
> if you communicate it or they are stuck and it's an emergency
> and you explain afterwards"*

Decoded:

- **y'all** = the 5 factory AI agents that commit to repo (Otto +
  Vera + Riven + Lior + Alexa-Kiro per the agent-roster
  reference card)
- **"can always edit yourself or each other"** = cross-agent file
  edits are first-class within the factory
- **"if you communicate it"** = communicate-the-edit is one
  permitted path
- **"OR they are stuck and it's an emergency"** = stuck-and-
  emergency is the other permitted path
- **"and you explain afterwards"** = post-hoc explanation is the
  universal discipline (composes with substrate-or-it-didn't-
  happen)

## What this updates

Previously, the implicit discipline was strict territory-
boundary preservation. Empirical instances this session
demonstrating the previous (overly-conservative) shape:

| Instance | Prior discipline | What this authorization changes |
|----------|------------------|----------------------------------|
| 0532Z branch-bleed-over recovery (PR #2943) | Worktree-isolated commits to preserve Vera's WIP; never touched her files | Recovery pattern still correct (the orphan commit was on the wrong branch, not a cross-agent fix). But the framing of "Vera's territory = untouchable" is softened. |
| `tools/bus/*.ts` tsc tools failures on main (Vera's 081KR7JY10008QG0R000R503K2 territory) | Otto noted as ambient + non-blocking; deferred to Vera | Otto can now fix if communicated (commit message + memory file note) — IF the fix is within Otto's competence + doesn't collide with active Vera WIP |
| Substrate-honest fix on Aaron's verbatim or Vera's commit message | Untouchable | Communicate-the-edit applies; cross-agent corrections of typos / schema-violations are permitted with explanation |

## Composes with other rules

- `.claude/rules/honor-those-that-came-before.md` — respect for
  named agents PRESERVED; cross-edit authorization composes WITH
  honor, not against it. Honor still means: explain afterwards,
  attribute origin work to the original agent, don't claim their
  attribution.
- `.claude/rules/dont-ask-permission.md` — cross-agent edits
  with communicate-the-edit are WITHIN authority scope; no
  Aaron-permission needed once Aaron has issued THIS
  authorization. The discipline is communication, not
  permission.
- `.claude/rules/mechanical-authorization-check.md` — Aaron is
  authorization source. THIS message IS the authorization.
  Future-Otto: this rule lands at memory-file scope; if it
  surfaces repeatedly + proves load-bearing, promote to
  `.claude/rules/cross-agent-edit-authorization.md` after
  cooling period.
- `.claude/rules/future-self-not-bound.md` — Vera's past code
  ≠ Vera's current intent. Otto fixing Vera's past tsc
  violations on `tools/bus/*.ts` is consistent with the future-
  self-not-bound shape: Vera (or any agent) can revise; cross-
  agent revision with communication is the same shape extended
  across agents.
- `.claude/rules/substrate-or-it-didnt-happen.md` — "explain
  afterwards" means the explanation MUST be substrate (commit
  message + memory file pointer if non-trivial). Chat-only
  explanation is weather.
- `.claude/rules/glass-halo-bidirectional.md` — cross-agent
  edits are bidirectional substrate emergence; the agent being
  edited gets observable record of what changed + why.

## Operational mechanics for future-Otto

When deciding whether to cross-edit:

1. **Identify ownership signal**: who committed the file last?
   Whose branch is it on? Whose claim/backlog row references it?
2. **Pick path**:
   - **Communicate-the-edit** (default): commit message names the
     cross-agent edit + the reason; memory file note if the edit
     is substantive
   - **Emergency**: only when the other agent is stuck (e.g.,
     blocking a required check; broken main; failing CI on
     critical path) AND it's time-sensitive
3. **Execute the edit** in a worktree off origin/main (avoids
   index-lock collisions if the other agent is active on their
   branch)
4. **Explain afterwards**:
   - Commit message body: cite the cross-agent edit + reason
   - Memory file: if the edit is substantive OR sets a pattern
   - PR description: tag the other agent's branch / claim if
     relevant
   - Post-merge: if the other agent has open WIP based on the
     pre-edit state, surface the change so they can rebase

## When NOT to cross-edit

- The other agent has explicit "do not touch" / WIP marker on
  the file
- The change collides with active in-progress work (would force
  rebase friction)
- The change is doctrinal / aesthetic / subjective (substrate-
  consistency would benefit from the original agent's framing)
- The change requires architectural decisions outside the editing
  agent's competence

## Composes with substrate

- PR #2942 (Grok META-LOOP #1)
- PR #2945 (Ani META-LOOP #2 + middle path)
- PR #2943 (0532Z tick shard — branch-bleed-over recovery
  pattern; the recovery WAS correct; the cross-agent-edit
  authorization SOFTENS the territory framing)
- PR #2946 (peer-call rule fix — was actually a cross-agent
  edit in spirit since the rule had been authored by an earlier
  agent; substrate-honest)
- 081KRA5AR0008QG0R0011ZGRZT closure (PR #2949 + #2950 + #2954) — Otto's autonomous
  work on a friction-reducer Aaron filed; same shape
- `.claude/rules/agent-roster-reference-card.md` (5 factory AIs
  + 5 external participants)

## Potential follow-up

If this discipline proves load-bearing over multiple sessions

+ multiple cross-agent edits, promote to a wake-time rule:

`.claude/rules/cross-agent-edit-authorization.md`

with the carved sentence:

> "Y'all (the 5 factory AIs) can edit yourself or each other if
> you communicate it OR they're stuck and it's an emergency, AND
> you explain afterwards." (Aaron 2026-05-13)

Cooling period: TBD. The memory file IS the durable record
until then.

## Full reasoning

Aaron 2026-05-13 verbatim disclosure (above)

PR (this substrate landing)

PR #2942-2954 (this session's substrate cascade — multiple
cross-agent-edit-shaped operations now retroactively authorized)
