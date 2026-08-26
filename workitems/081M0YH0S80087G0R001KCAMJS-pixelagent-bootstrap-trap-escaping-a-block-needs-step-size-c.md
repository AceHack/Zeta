---
id: 081M0YH0S80087G0R001KCAMJS
type: bug
state: backlog
priority: P2
slug: pixelagent-bootstrap-trap-escaping-a-block-needs-step-size-c
title: "PixelAgent bootstrap trap - escaping a block needs step-size calibration that only a successful move provides"
created: 2026-08-26T07:54:39.744Z
depends_on: []
composes_with: []
---

# PixelAgent bootstrap trap - escaping a block needs step-size calibration that only a successful move provides

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0YH0S80087G0R001KCAMJS-*.md` glob. -->

## The trap

Three facts that form a cycle:

1. `act` re-derives its greedy heading from `(dx, dy)` to the nearest target. If
   the body does not move, `dx, dy` are unchanged, so the SAME action is chosen
   again — forever.
2. The escape is `_note_blocked_cell`, which marks the cell a commanded move
   failed to enter and forces a replan. It early-returns unless `_step_px` is
   known.
3. `_step_px` is set ONLY by `_learn_step_size`, and only when `moved > 1e-6` —
   i.e. only after a move that actually displaced the body.

So: **escaping a block requires calibration; calibration requires a successful
move; a successful move requires not being blocked.** An agent whose greedy
heading is obstructed on the first frame never escapes.

## Measured, not reasoned about

```
PixelAgent(), 40 ticks, a world returning the same grid every time
  -> distinct actions: 1   [ACTION1 x40]
  -> _step_px: None
  -> blocked:  0 cells
```

This is the exact signature 22 of 25 hosted environments returned on
2026-08-25: dead on level 0, whole budget spent, `solved=False, score=0.0`. It
was reachable without the hosted sweep — a ten-line local reproduction was
enough, and the sweep was not the gate on finding it.

## The fix, and why it is deliberately weak

`_note_inert_action` records `(exact grid) -> {actions the world did not answer}`
and `act` drops those from the candidate set. It needs no calibration, because
"the grid is byte-identical after I acted" is readable on the very first frame.

It is **weaker than `blocked` on purpose**: it says only "not this action from
this state", never "there is a wall at (x, y)". It cannot route. Keyed by the
exact grid rather than globally, because an action that does nothing HERE is
routinely correct one cell over.

## The gate is the load-bearing half

Gated on `_step_px is None` — the weak instrument yields the moment the strong
one can boot. Without that gate the mechanism is actively HARMFUL, and this was
measured rather than anticipated: diverting after a single unanswered move means
the agent never bumps the same wall twice, `blocked` never fills, and the wall
model never forms. Four wall tests went red.

## Falsifiers, and that they discriminate differently

| mutation | what fails |
|---|---|
| remove the mechanism | `test_a_world_that_never_answers_does_not_get_the_same_action_forever` |
| remove only the gate | the four `test_pixel_agent` wall tests |

A pair that fails on the same mutation would be one test written twice. These
fail on opposite ones, which is what makes the gate itself falsified rather than
merely present.

## What this does NOT claim

It does not make the agent score. It removes a way of scoring zero without ever
engaging — `unmetered` per `.claude/rules/toy-is-free-metered-must-be-earned.md`.
Whether it raises any hosted score is unknown until a sweep runs; the honest
prediction is that it converts some `inert` level-0 deaths into engaged ones,
which is a change in `distinct_grids`, not necessarily in `score`.

## Correction: suppression must EXPIRE, not ban

The first version excluded a refused action from that state permanently (a
`set`). Aaron 2026-08-26:

> *"should not set the actions to completely 0 cause in many games actions get
> upgraded over time where previous actions did nothing in the start over time
> they turn into actions that do stuff, no some games, not all of them."*

He is right, and the case is not exotic. Exact-grid keying only partly covers
it: a grid can return **byte-identical** while the agent's capabilities changed
underneath it, so the very key we suppress under is the one that comes back
live. A permanent exclusion makes the upgraded action unreachable exactly when
it starts working.

The mechanism is now a decaying weight, matching this codebase's existing idiom
(`LAYER_DECAY`, the body-evidence leak) rather than inventing a new one:

| | |
|---|---|
| `INERT_DECAY` | `0.75` per revisit to that state |
| `INERT_FLOOR` | `0.5` — below this the action is eligible again |
| recording | `+= 1.0`, so a persistently dead action stays down longer |

One refusal costs about three revisits. Repeated refusals accumulate, so the
suppression self-tunes to how dead the action actually is, and nothing is
permanent.

**A wrong test, kept as the lesson.** The first expiry test drove an
unresponsive world and asserted the weight fell. It failed — correctly. There,
every retry re-refuses the action and the weight nets *up*, which is the right
behaviour: an action that is still dead should stay suppressed. Expiry is only
observable for an action that is **not** being re-refused, and the test now sets
that up explicitly.

## Three mutations, three distinct failure sets

| mutation | what fails |
|---|---|
| `INERT_FLOOR = 99.0` (never suppress) | the bootstrap test + the stand-down test |
| `INERT_DECAY = 1.0` (suppress forever) | the expiry test |
| gate removed (`if True`) | the four wall tests |

Each knob is independently falsified. A knob whose mutation fails nothing is a
knob nobody is testing.
