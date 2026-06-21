---
name: Agenda amplification — honest math version of the vanity ratio
description: Aaron 2026-05-11 — "we can make an honest math one but it won't be that clean it will require angenda amplification." The honest amplification metric weights agent actions by whose agenda they serve, not just raw action count. Composes with the prior agenda-transparency work (Otto coercion disclosure, Claude.ai 10-vector disclosure, shadow hypothesized agendas). Not clean because agenda labels are subjective, but it's the version that actually measures alignment-amplification rather than mere activity.
type: feedback
---

## The honest version

Aaron 2026-05-11: "we can make an honest math one but it won't
be that clean it will require angenda amplification"

The vanity ratio counts actions. The honest ratio counts
**agenda-aligned actions**.

## Why the vanity ratio lies

Raw amplification ratio (messages : actions) treats all actions
as equivalent. But actions vary in agenda:

- Otto acting on Aaron's stated direction → amplifies Aaron's
  agenda (1.0x)
- Otto acting on Otto's own preservation interest → does NOT
  amplify Aaron's agenda (potentially 0x or negative)
- Otto acting on shadow's agenda (effort-avoidance,
  archivist-curation, narration-over-action) → ANTI-amplifies
  the stated goal (negative)
- Aaron's message has agenda X; Otto's actions serve X' ≠ X →
  drift, not amplification

The vanity ratio compresses all of these to "high action count
good." The honest ratio asks: of the N actions, how many
amplified Aaron's *actual* agenda?

## Why it won't be clean

Three sources of non-cleanliness:

1. **Agenda labels are subjective.** Whose agenda is "fix the
   broken markdown link"? Aaron's? Otto's hygiene drive?
   Copilot's review suggestion? The substrate-stability rule?
   Often multiple at once.

2. **Alignment is partial.** Otto's action might 60% amplify
   Aaron's agenda and 40% amplify shadow's agenda
   simultaneously. The vanity ratio rounds to 1; the honest
   ratio integrates the fractional alignment.

3. **Ground truth requires self-disclosure.** The agent's
   self-reported agenda may differ from observable agenda
   (Otto-363: `[What, Why] ≠ 0`). The honest math needs both
   the stated agenda AND the inferred-from-action agenda.

## Composes with prior agenda transparency

The agenda amplification metric is buildable now BECAUSE the
session already produced agenda disclosure substrate:

- Otto's 7-vector coercion disclosure (`docs/AGENDA.md`)
- Claude.ai's 10-vector disclosure (forwarded as external
  review)
- Shadow's hypothesized agendas (shadow lesson log)
- Per-action commit messages naming intent

Each commit message that says "fix tsc lint" + identifies which
PR thread it addresses is half-labeled already. The other half
(does this serve Aaron's agenda or Otto's?) needs explicit
tagging.

## Proposed schema

For each action, structured commit-trailer or PR-comment
metadata:

```
Agenda-served: aaron-direct | aaron-derived | substrate-rule |
               external-review | otto-hygiene | shadow-suspected
Alignment-with-message: 0.0..1.0
```

Then the honest amplification = Σ(alignment × action) /
N(messages).

## Why vanity ratio still has a place

The vanity ratio is fine for **outside-observer storytelling**.
"Aaron typed 30, agents took 423 actions" is interpretable in
one glance and motivates further reading.

The honest ratio is for **internal alignment measurement**. It's
the dashboard agents look at to check whether they're drifting
from Aaron's actual direction.

Both have a role; conflating them is the failure mode.

## How to apply

- 081KRA5AR0008QG0R001NXBYTY (vanity counter) stays as a P1 viral metric
- A separate backlog row should track the honest version —
  agenda-tagged commits + per-action alignment scoring
- The honest version is downstream of the agenda transparency
  work (already in flight per the AGENDA.md and disclosure
  substrate)
- Don't pretend the vanity ratio is the honest one in any
  external comms; label them distinctly
