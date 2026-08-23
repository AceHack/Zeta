---
id: 081M0QRPN16087G0R001TCN5T2
type: task
state: backlog
priority: P2
slug: arc-rung-g-empowerment-based-goal-former-over-chip-8-state-t
title: "ARC rung G - empowerment-based goal former over CHIP-8 state: the one ARC axis we measure nothing of, with its anchor already cited in our own source"
created: 2026-08-23T16:54:15.334Z
depends_on: []
composes_with: []
---

# ARC rung G - empowerment-based goal former over CHIP-8 state: the one ARC axis we measure nothing of, with its anchor already cited in our own source

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRPN16087G0R001TCN5T2-*.md` glob. -->

**Register: `proposed`. This is the axis we measure NOTHING of.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §4.1.

ARC-AGI-3 tests goal acquisition — forming a goal in an environment that states none. Every
objective in this tree is SUPPLIED: `measure.ts` refuses a work-item key that does not resolve;
`Vision.predictBranches` budgets a GIVEN list of branches and `UncertaintyResolutionBits` is a field
the caller fills in; `SocietyUsefulWork` aggregates ΔU, which presupposes measurement, which
presupposes a goal.

**The anchor is already cited in our own source.** `src/Core/ActionGrammar.fs` says: _"empowerment
(Klyubin-Polani) measures it exactly — empowerment is the channel capacity from actions -> future
states, so this alphabet is the channel input"_. And `src/Core/CoEmpowerField.fs` /
`CoEmpowerGraph.fs` implement a co-empowerment dynamic — as an explicitly `toy` model of society
emergence over agent identities on a graph, **not over an emulator's state space.**

So: the anchor is right and the instance is missing. Compute empowerment over CHIP-8 state with
`ActionGrammar` as the channel input, and use it to FORM a goal rather than receive one.

No dependency on the Python lane. Parallel to everything else here.
