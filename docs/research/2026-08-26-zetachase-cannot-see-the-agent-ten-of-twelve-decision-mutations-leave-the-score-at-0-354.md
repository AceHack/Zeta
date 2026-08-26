# ZetaChase cannot see the agent — 10 of 12 decision mutations leave the score at 0.354

**Date:** 2026-08-26 · **Status:** measured, single environment · **Instrument:** `play(agent="pixel", seed=4)`

Carved sentence:

> The ARC pixel agent's **test suite** is a good instrument and its **environment
> score** is not. Twelve mutations to the agent's decision machinery: the 121-test
> suite catches **12 of 12**; the environment score moves on **1 of 12**. Ten
> leave it at *exactly* 0.354. A number that survives disabling the ageing, the
> commit gate, the conservative ranking, the Kalman gain, and the inert-suppression
> release is not measuring the mechanism it is being read as measuring.

## The measurement

Each mutation applied alone to a clean tree, tests and score run, tree restored
via `git checkout --` before the next. Baseline 0.354 / 3 levels / 12-11-22.

**Measured at `CONSERVATIVE_K = 3.0`, i.e. before Addendum 3 changed it to 1.0.**
Re-run at k=1 the headline is unchanged — still **10 of 12 invisible on `chase`**,
which is the claim this doc is named for. One cell's value moved: the
agreement-sign flip scores 0.0 at k=1 rather than the 0.1157 recorded below. The
table is left as measured rather than quietly updated, because it is the evidence
for a claim made at a particular commit and rewriting it would make the two
addenda below unreadable.

| mutation | tests | environment score |
|---|---|---|
| no ageing (body election) | red | **0.354 — same** |
| rank by `mu`, not `mu − 3σ` | red | **0.354 — same** |
| commit gate always true | red | **0.354 — same** |
| commit gate never true | red | **0.354 — same** |
| latch: incumbent never yields | red | *crashed* (`AttributeError` in `_key`) |
| inert suppression never expires | red | **0.354 — same** |
| inert suppression released instantly | red | **0.354 — same** |
| agreement sign flipped | red | 0.1157 — **moved** |
| Kalman gain fixed at 0.5 | red | **0.354 — same** |
| ageing a no-op (all three sites) | red | **0.354 — same** |
| `conservative == mu` (width ignored) | red | **0.354 — same** |
| layer ageing removed | red | **0.354 — same** |

The crash is counted as neither: a crash is detected by anything and says nothing
about discrimination.

## Why — and why it is not a bug in the agent

Across 40 ticks of seed 4 the agent perceives **4 distinct components and exactly
one that ever moves**. The body election therefore has no competitor, so every
ranking rule elects the same component and ageing has nothing to demote it in
favour of. The one mutation that moves the score inverts the meaning of agreement
itself, which breaks the single-mover case too.

This is a property of the *environment*, not of the agent. ZetaChase was built to
exercise a perception ladder, and it does; it was never built to discriminate
between election policies, and it does not.

## The consequence, stated plainly

Every future ARC change graded by `environment_score` alone is, with ~92%
probability on this evidence, **ungraded**. That includes work already done: the
decay-constant conversion held the score at 0.354 across all three call sites,
and the honest reading of that is *"the instrument could not see it"*, not
*"the change was neutral"*. The falsifiers that did discriminate were all
hand-built decoy fixtures (`test_a_body_that_stops_moving_loses_the_election...`,
`test_the_dynamics_factor_releases_a_still_body_sooner_than_decay_does`),
constructed precisely because the environment could not pose the question.

## The cheapest fix that would change the table

A ZetaChase level with a **second mover** — a distractor that moves on its own, or
one that mirrors the commanded direction. That single addition puts a competitor
in the election and makes ageing, the latch, the commit gate and the staleness
horizon measurable on the real scorer rather than only in unit fixtures.

Not done here: it changes a shared benchmark and the pinned score, which is a
decision, not a cleanup.

## Pointers

- `src/Arc.Python/zeta_arc/agent.py` — the machinery under test; `_elect_self`, `_update_evidence`, the inert leak
- `src/Arc.Python/tests/test_pixel_agent.py` §"the decoy world: what ZetaChase cannot ask" — the hand-built falsifiers and the measurement that forced them
- `src/Arc.Python/zeta_arc/dynamics.py` — the primitive the conversion runs on
- `workitems/done/2026/08/081M0YSD5VA087G0R000W2Q9QW-*` — the conversion whose score-neutrality this reinterprets
- [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) — a falsifier that cannot fail is not a falsifier; this is that rule pointed at a benchmark

---

# Addendum — the second mover was built and run, and it found a defect in the conversion

The section above predicted that a second mover "would change the table". The
prediction was tested in a scratch variant before recommending the work, and it
holds — **but the newly-visible result is that the ageing is HURTING.**

Nothing in the repo was modified. `chase._build_level` was wrapped to add one
`decoy` sprite moving on a fixed `right, right, left, left` cycle, independent
of the commanded action, and `zeta_arc.play.ZetaChase` pointed at the subclass.
The agent now perceives **2 movers instead of 1**, and scores **0.1936**.

## Discrimination roughly sextuples

Same twelve mutations, same protocol:

| environment | movers | mutations that MOVE the score | invisible |
|---|---|---|---|
| ZetaChase | 1 | 1 of 11 (~9%) | 10 |
| two-mover variant | 2 | 6 of 11 (~55%) | 5 |

*(the latch mutation crashes on both and is excluded from the denominator)*

Newly visible, and they are precisely the mechanisms the decay→dynamics
conversion introduced: ageing (0.2659), conservative ranking (0.0), Kalman gain
(0.085), ageing-as-no-op everywhere (0.2659).

## The uncomfortable row

> **Removing the body ageing IMPROVES the two-mover score: 0.1936 → 0.2659.**

Reproduced directly, outside the sweep harness. The gain is almost entirely
level 1 — the WALL level — at 17 actions down to 11.

The mechanism was checked, not assumed:

| | body-identity flips | frames holding the DECOY as self |
|---|---|---|
| ageing ON (shipped) | 8 | 8 |
| ageing OFF | 4 | 2 |

Ageing doubles the identity flips and quadruples the frames the agent mistakes
the decoy for itself. The reason is intrinsic and not a quirk of the decoy:

> **This agent learns walls by BUMPING them, and a bump is a frame where the
> body does not move. Ageing reads that as staleness and demotes the true body
> — while a distractor that moves every frame keeps its confidence. The agent's
> own wall-learning strategy is what makes it periodically unobservable, and the
> ageing penalises exactly that.**

`EVIDENCE_DECAY` never had this failure, because it only touched components that
MOVED — the same `continue` that produced its welded-on defect also spared a
blocked body. The conversion fixed one failure and introduced its dual.

## What this does NOT establish

Single decoy design, single seed, scratch code that is not in the repo. A decoy
that moves every frame is the worst case for ageing, and a real environment may
not have one. What generalises is the *mechanism* (bump ⇒ unobserved ⇒ demoted),
not the magnitude.

The suggested repair, unimplemented and unmeasured: do not age on a frame whose
command was REFUSED. A blocked body is not stale evidence — it is explained
absence, and the two are different. That is a design change to landed work and
needs its own falsifier.

## Honest status of the conversion

The three-site decay→dynamics conversion is **not** validated by "score
unchanged at 0.354" — that was the blind instrument. On the one benchmark that
can see it, the conservative ranking and the Kalman gain earn their keep
decisively (removing either takes the agent to 0.0, i.e. solving nothing), and
the ageing costs score. Mixed, measured, and previously invisible.

---

# Addendum 2 — the suggested repair was tested and is WRONG

Addendum 1 proposed: *"do not age on a frame whose command was REFUSED. A blocked
body is not stale evidence — it is explained absence."* That was written as an
unimplemented suggestion. It has now been implemented and measured, and it must
not be shipped.

**The candidate:** exempt the incumbent `_self_key` from ageing on any frame
where it did not move.

| | ZetaChase | two-mover | flips | decoy-held |
|---|---|---|---|---|
| shipped (age everything) | 0.354 | 0.1936 | 8 | 8 |
| ageing removed entirely | 0.354 | 0.2659 | 4 | 2 |
| **candidate repair** | 0.354 | **0.2659** | 4 | 4 |

It recovers the full score gain. It also **fails
`test_a_body_that_stops_moving_loses_the_election_to_one_that_is_moving`** — the
decoy falsifier written during the conversion — on the first run.

That failure is the whole point, and it names the tension exactly:

> **"The incumbent did not move" is indistinguishable from "the incumbent is a
> wall I wrongly elected."** Ageing a non-moving body demotes it when it was
> merely blocked; not ageing it welds on a wrong election. Both defects are
> real, and this repair simply swaps which one you get.

The discriminator cannot be a single frame, because a single frame genuinely does
not contain it. What separates a blocked body from a wrong election is that a
real body moves *sometimes* — which is a statement about a distribution over
frames, not about the frame in hand. Any correct repair has to be built from
that, and the tempting shortcuts are:

- **age the incumbent at a reduced rate** — works in principle, but the fraction
  is a hand-picked constant, i.e. exactly what this whole conversion removed. It
  would have to be derived from a stated horizon like every other knob here.
- **exempt only on a detected bump** — `_note_blocked_cell` gives a real bump
  signal, but it cannot fire until `_step_px` is known, and `_step_px` is learned
  only from a successful move. That is the same bootstrap trap already documented
  in `_note_inert_action`, so the repair is unavailable exactly when the agent is
  most confused.

Neither is attempted here. What is established is narrower and firmer: the
obvious repair is measurably wrong, and the falsifier that catches it already
exists.

---

# Appendix — SUPERSEDED: the two-mover source, now shipped as `ZetaChaseDecoy`

**This appendix is superseded and kept only as provenance.** The variant now
ships as `ZetaChaseDecoy` in `zeta_arc/environments/chase.py`, reachable as
`play(environment="chase-decoy")`, and the in-repo version reproduces every
number above exactly (5 of 12 mutations invisible, against 10 on `chase`).

The framing that delayed it was mine and was wrong: this was recorded as a
decision — *"it changes a shared benchmark and its pinned score, which is your
call"* — when the variant only had to be ADDED. `ZetaChase` is byte-for-byte
unchanged, `play()` defaults to `"chase"`, and 0.354 still pins. There was no
trade to make.

The scratch source below monkeypatched `chase._build_level` and pointed
`zeta_arc.play.ZetaChase` at a subclass. The shipped version uses a
`_level_builder` staticmethod hook instead, because monkeypatching the module
global made the wrapper call itself and recursed 1000 deep. Prefer the shipped
code; this is kept so the measurements above remain reproducible as run.

```python
"""SCRATCH — does a second mover make the scorer able to see the agent?

Nothing in the repo is modified. `chase._build_level` is wrapped to add one
DECOY sprite that moves on its own fixed cycle, independent of the commanded
action; `zeta_arc.play.ZetaChase` is pointed at the subclass for the duration.

A decoy that moved WITH the command would be a second body and would make the
task ambiguous. One on an independent cycle is a distractor: a real competitor
in the body election that the agent must learn to reject.
"""
from __future__ import annotations

from arcengine import Sprite

import zeta_arc.environments.chase as chase
from zeta_arc.environments.chase import CELL, GRID, ZetaChase, _block, _WALLS

COLOR_DECOY = 7
#: Fixed and seed-independent, so DST replay is unaffected: right, right, left,
#: left. It never agrees with a command for more than one frame in a row.
_DECOY_CYCLE = ((1, 0), (1, 0), (-1, 0), (-1, 0))

_original_build_level = chase._build_level


def _build_level_with_decoy(index: int):
    level = _original_build_level(index)
    occupied = {(s.x // CELL, s.y // CELL) for s in level.get_sprites()}
    for cy in range(GRID - 1, -1, -1):
        for cx in range(GRID):
            if (cx, cy) not in occupied:
                level.add_sprite(
                    Sprite(
                        pixels=_block(COLOR_DECOY),
                        name="decoy",
                        x=cx * CELL,
                        y=cy * CELL,
                        tags=["decoy"],
                        collidable=False,
                    )
                )
                return level
    return level


class ZetaChaseTwoMover(ZetaChase):
    """ZetaChase plus one independently-moving distractor."""

    def __init__(self, seed: int = 0) -> None:
        chase._build_level = _build_level_with_decoy
        try:
            super().__init__(seed=seed)
        finally:
            chase._build_level = _original_build_level
        self._decoy_tick = 0

    def step(self) -> None:
        super().step()
        decoys = self.current_level.get_sprites_by_tag("decoy")
        if not decoys:
            return
        decoy = decoys[0]
        dx, dy = _DECOY_CYCLE[self._decoy_tick % len(_DECOY_CYCLE)]
        self._decoy_tick += 1
        nx, ny = decoy.x + dx * CELL, decoy.y + dy * CELL
        if 0 <= nx <= (GRID - 1) * CELL and 0 <= ny <= (GRID - 1) * CELL:
            self.try_move_sprite(decoy, dx * CELL, dy * CELL)
```

Run it against the current tree with:

```bash
ARC_BASE_URL=http://127.0.0.1:1 PYTHONPATH=<scratch-dir> \
  uv run --project src/Arc.Python python -c "
import zeta_arc.play as P
from twomover import ZetaChaseTwoMover
P.ZetaChase = ZetaChaseTwoMover
print(P.play(agent='pixel', seed=4)['environment_score'])"
```

Expected on this branch: `0.1936` (two-mover) against `0.354` (ZetaChase).

---

# Addendum 3 — the instrument answered on first use, and the answer was not the ageing

`ZetaChaseDecoy` shipped and was pointed at the open question. The ageing is not
the defect. **The width weight is.**

Instrumented at the exact frame the wrong candidate took the body on
`chase-decoy`:

| | mu | sigma2 | `3*sigma` | `mu - 3*sigma` |
|---|---|---|---|---|
| BODY | **+0.941** | 0.628 | 2.377 | −1.437 |
| DECOY | +0.295 | 0.322 | 1.702 | **−1.407** |

The body had three times the agreement and lost, because a 0.68 gap in the width
terms outvoted a 0.65 gap in the quantity being compared. The decoy moves every
frame and is therefore observed more often; under `k=3` that alone decided the
election. *"Who agrees with my commands"* had been silently replaced by *"who
moved most recently"*.

`CONSERVATIVE_K` is now 1.0. `chase-decoy` 0.1936 → **0.2659** — matching what
deleting the ageing achieved, without deleting it, and
`test_a_body_that_stops_moving_loses_the_election_to_one_that_is_moving` stays
green. That falsifier killed all three earlier candidates:

| candidate | chase-decoy | welded-on falsifier |
|---|---|---|
| ageing removed entirely | 0.2659 | **FAILS** |
| incumbent exempt from ageing | 0.2659 | **FAILS** |
| rank by plain mu + 1σ significance latch | **0.0** | fails, plus 4 more |
| **`CONSERVATIVE_K = 1.0`** | **0.2659** | **passes** |

## The prediction in Addendum 1 was wrong, and worth saying so

Addendum 1 diagnosed *"this agent learns walls by bumping, a bump is a frame
where the body does not move, ageing reads that as staleness."* Plausible, and
false. Measured: the true body's longest run without moving is **2 frames** on
both environments, while static components run 40–57. The body was never ageing
out. It was being outranked by a competitor whose width happened to be narrower.

## The cost, stated because it looks like a regression and is not

Re-running the same twelve mutations against `chase-decoy` at `k=1`:

| | baseline | invisible to the score |
|---|---|---|
| `k = 3.0` | 0.1936 | 5 of 12 |
| `k = 1.0` | 0.2659 | **7 of 12** |

Discrimination *dropped*. The two that went quiet are `no ageing (body)` and
`ageing is a no-op` — and the reading matters:

> At `k=3` those mutations moved the score **because the ageing was harmful**.
> Deleting a harmful mechanism shows up as an improvement. Now that the width no
> longer inverts the ranking, deleting the ageing changes nothing measurable.
> **The drop is a symptom of the defect being fixed, not of the instrument
> getting worse.**

It does leave the ageing in an honest and narrower position: it is
**score-neutral and falsifier-load-bearing**. It earns its place by preventing
the welded-on election, which is a correctness property, not by moving a number.
That is a legitimate way for a mechanism to justify itself, and it should be
stated rather than assumed — the earlier claim that the width "costs nothing"
was exactly that kind of unstated assumption, and it was false by 0.07.
