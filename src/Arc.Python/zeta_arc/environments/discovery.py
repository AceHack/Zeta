"""ZetaDiscovery — levels where WHAT WINNING MEANS is not announced.

WHY THIS IS A SEPARATE ENVIRONMENT FROM ZetaChase, and why that matters.

`ZetaChase` teaches NAVIGATION. All three of its levels share one win
condition — reach the goal — and only the obstacles change. An agent that has
learned "walk to the other blob" clears the whole ladder. That is a retro-game
lesson: the objective is given, and the skill is executing it.

ARC withholds the objective. What ends a level is not stated at the start, and
finding it out is half the task — it takes deliberate experiment, and the
lesson is often counter-intuitive on purpose. A curriculum built only of
ZetaChase-shaped rungs cannot teach that, however many rungs it has.

So these levels break the rule the previous ones taught:

  LEVEL 0 — SEQUENCE. There is a goal-looking thing and a key. Stepping onto
  the goal does NOTHING until the key has been touched. The agent that walks
  straight to the goal, as every earlier level rewarded, gets no response and
  must notice the absence and go look elsewhere.

  LEVEL 1 — SURFACE FEATURE. There are two candidates. The one that LOOKS like
  every previous goal — same colour, tagged `goal` — is inert. The odd-coloured
  one ends the level. The feature that predicted the objective for three levels
  stops predicting it.

SEPARATE, NOT APPENDED, and this is deliberate rather than tidy: appending
these to `ZetaChase` would make the scored ladder unclearable and turn the
lane's CI smoke step red. The scored episode measures navigation and should
keep measuring exactly that. These are a different measurement.

THE HONEST STATE, recorded rather than implied: no agent we have clears these.
The pixel agent has no mechanism for "I did the thing and nothing happened, so
try something else" — it routes to the nearest non-self component and keeps
routing. That is the frontier, and `tests/test_discovery.py` measures it rather
than hiding it. What the tests DO establish is that the difficulty is
discovery and not impossibility: a scripted solver that is told the rule clears
both levels well inside the budget.

Register: Zeta-authored, for developing against the toolkit. NOT an ARC Prize
environment; scores here say nothing about any leaderboard.
"""

from __future__ import annotations

from arcengine import ARCBaseGame, GameAction, Level, Sprite

from zeta_arc.environments.chase import (
    _MOVES,
    CELL,
    COLOR_AGENT,
    COLOR_GOAL,
    GRID,
    _block,
)

#: A colour used by no earlier level, so "the odd one" is odd by construction.
COLOR_PRIZE = 6
#: The key is its own colour too — it must not read as a goal or as a wall.
COLOR_KEY = 3

#: Per-level: which tag ends the level, and which tag (if any) must be touched
#: first. The RULE IS DATA, so a level's lesson is legible here rather than
#: buried in a branch — and so adding a rung does not mean editing `step`.
_RULES: tuple[tuple[str, str | None], ...] = (
    ("goal", "key"),  # level 0: sequence — the goal is inert until the key
    ("prize", None),  # level 1: surface feature — the goal-coloured thing is a decoy
)

#: (agent, winning-target, other-object) start cells per level. Fixed, not
#: sampled: a benchmark whose start moves between runs cannot be replayed.
_LAYOUT: tuple[tuple[tuple[int, int], tuple[int, int], tuple[int, int]], ...] = (
    ((1, 1), (6, 6), (1, 6)),  # agent, goal, key
    ((1, 1), (6, 6), (6, 1)),  # agent, prize, decoy
)

#: Distractors on the sequence level, and the reason the level is a rung at all.
#:
#: WITHOUT THEM THE LEVEL IS FREE, measured three times. A two-object gate is
#: solved by ANY policy that keeps moving between the two objects — the pixel
#: agent's nearest-first router cleared it in 24 actions, and cleared it again
#: at 27 when the layout was rearranged so proximity pointed the wrong way.
#: Adding more objects does not help either: "touch everything, then the goal"
#: is a general solution to any gate, whatever the object count.
#:
#: So a wrong touch has to COST something, and here it costs the gate: standing
#: on a distractor clears what you have collected. Now "touch everything" fails
#: by construction and the agent has to work out WHICH object is the gate —
#: which is the experiment the level exists to demand. The cost is bounded, so
#: this stays discoverable: three candidates, and a wrong guess costs a walk,
#: not the episode.
#:
#: PLACED OFF THE DIRECT PATHS, deliberately. (1, 3) sat on the straight line
#: from the agent to the key, which made the level unsolvable by a solver that
#: knew the rule perfectly — it was forced through a distractor on the way. A
#: rung that cannot be cleared even with the answer in hand is a wall, and it
#: would have looked exactly like a hard lesson from the outside. The question
#: this level asks is WHICH object is the gate, not how to navigate around
#: hazards; conflating the two would measure the wrong thing.
_DISTRACTORS: tuple[tuple[int, int], ...] = ((6, 1), (3, 3))


def _build_level(index: int) -> Level:
    (ax, ay), (tx, ty), (ox, oy) = _LAYOUT[index]
    win_tag, gate_tag = _RULES[index]

    # The winning target. On level 0 it is goal-coloured and goal-tagged, which
    # is the point: it looks exactly like what worked before and still does not
    # work yet. On level 1 it is the odd colour.
    win_colour = COLOR_GOAL if win_tag == "goal" else COLOR_PRIZE
    sprites: list[Sprite] = [
        Sprite(
            pixels=_block(win_colour),
            name=win_tag,
            x=tx * CELL,
            y=ty * CELL,
            tags=[win_tag],
            collidable=False,
        ),
    ]

    # The other object: a key to be found (level 0), or a decoy wearing the
    # goal's colour AND its tag (level 1). The decoy carries tag `goal`
    # deliberately — an agent that learned "go to the goal" is exactly the
    # agent this level is for, and `play.py`'s coordinate-reading `greedy`
    # baseline reads that tag, so it walks confidently to the wrong square.
    other_tag = gate_tag if gate_tag else "goal"
    other_colour = COLOR_KEY if gate_tag else COLOR_GOAL
    sprites.append(
        Sprite(
            pixels=_block(other_colour),
            name=other_tag,
            x=ox * CELL,
            y=oy * CELL,
            tags=[other_tag],
            collidable=False,
        )
    )

    # Distractors look like the key — same colour — so they cannot be told
    # apart by appearance, only by what happens when you touch them.
    if gate_tag:
        for i, (dx_, dy_) in enumerate(_DISTRACTORS):
            sprites.append(
                Sprite(
                    pixels=_block(COLOR_KEY),
                    name=f"distractor_{i}",
                    x=dx_ * CELL,
                    y=dy_ * CELL,
                    tags=["distractor"],
                    collidable=False,
                )
            )

    sprites.append(
        Sprite(
            pixels=_block(COLOR_AGENT),
            name="agent",
            x=ax * CELL,
            y=ay * CELL,
            tags=["agent"],
        )
    )
    return Level(
        sprites=sprites,
        grid_size=(GRID * CELL, GRID * CELL),
        name=f"discovery-{index}",
    )


class ZetaDiscovery(ARCBaseGame):
    """Reach the thing that ends the level — which is not the obvious thing."""

    def __init__(self, seed: int = 0) -> None:
        super().__init__(
            game_id="zeta-discovery",
            levels=[_build_level(i) for i in range(len(_RULES))],
            win_score=len(_RULES),
            # Plain ints, not GameAction members: `GameAction` is a plain Enum,
            # so members never `==` the ints the engine matches on. Same fix as
            # ZetaChase; see its comment for the measurement.
            available_actions=[a.value for a in _MOVES],
            seed=seed,
        )
        #: Tags touched on the CURRENT level. Cleared on every level change,
        #: because a gate satisfied in one world says nothing about the next.
        self._touched: set[str] = set()

    def _advance(self) -> None:
        self._touched.clear()
        self.next_level()

    def step(self) -> None:
        action_id = self.action.id
        if action_id == GameAction.RESET:
            self.handle_reset()
            self._touched.clear()
            self.complete_action()
            return

        delta = _MOVES.get(action_id)
        if delta is None:
            self.complete_action()
            return

        level = self.current_level
        agents = level.get_sprites_by_tag("agent")
        if not agents:
            self.complete_action()
            return
        agent = agents[0]

        dx, dy = delta
        nx, ny = agent.x + dx * CELL, agent.y + dy * CELL
        if not (0 <= nx <= (GRID - 1) * CELL and 0 <= ny <= (GRID - 1) * CELL):
            self.complete_action()
            return
        self.try_move_sprite(agent, dx * CELL, dy * CELL)

        win_tag, gate_tag = _RULES[self.level_index]

        # Record every tag the agent is now standing on. The gate is recorded
        # even when the agent does not know it is a gate — the world responds
        # to what you DID, not to what you meant.
        standing_on: set[str] = set()
        for sprite in level.get_sprites():
            if sprite.x == agent.x and sprite.y == agent.y:
                standing_on.update(sprite.tags)
        # A wrong touch costs the gate. This is what stops "visit everything"
        # from being a general solution — see `_DISTRACTORS`.
        if "distractor" in standing_on:
            self._touched.clear()
        else:
            self._touched.update(standing_on)

        # THE WIN NEEDS THE AGENT ON THE TARGET *NOW*, not merely to have been
        # there once. This distinction is the entire sequence lesson and I got
        # it wrong first: with a cumulative `win_tag in self._touched`, touching
        # the goal and THEN the key won the level without ever returning, so
        # order did not matter and the level taught nothing. Measured — the
        # pixel agent cleared it with a plain nearest-first walk, and cleared it
        # again when the layout was rearranged so proximity misled. A rung that
        # a policy with no notion of sequence clears in either arrangement is
        # not a sequence rung.
        if win_tag in standing_on and (gate_tag is None or gate_tag in self._touched):
            self._advance()

        self.complete_action()
