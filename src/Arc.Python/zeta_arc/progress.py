"""Grid-derived intra-level progress — a PROXY, never the engine's score.

WHY THIS EXISTS AS PERCEPTION RATHER THAN A FIELD
-------------------------------------------------
After the first hosted sweep (2026-08-25) 22 of 25 environments ended in
`GAME_OVER` on level 0, and every one of those rows was byte-identical:
`solved=False, score=0.0`. A policy that never engaged the level and one that
died a step from winning produce the same record, and they call for opposite
fixes.

The obvious instrument is the engine's own score, and it is NOT reachable:
`arcengine.base_game` holds `_score`/`_win_score` and passes `score=`/
`win_score=` when it builds the frame, but neither `FrameData` nor
`FrameDataRaw` DECLARES those fields, and pydantic drops unknown kwargs
silently. A `game_score` read here would be `None` in production and in every
test forever — a progress record that constrains nothing.

So progress is INFERRED from the grids we are actually handed.

WHAT THIS MEASURES, STATED SO IT CANNOT BE OVERSOLD
---------------------------------------------------
Two counts, both cheap and both honest about being counts:

- `distinct_grids` — how many DIFFERENT world states this level ever showed.
  A policy hammering an illegal action sees one grid forever; a policy moving
  through a level sees many. This separates *engaged* from *inert*.
- `cells_changed` — cumulative Hamming distance between consecutive grids.
  Distinguishes a world that twitches in one corner from one being reshaped.

This is `unmetered` in the sense of `.claude/rules/toy-is-free-metered-must-be-earned.md`:
implemented and used, with a falsifier that it DISCRIMINATES (see the tests),
but with no anchor tying either count to the engine's true intra-level score —
because that score is not transmitted, so no such anchor can currently exist.
It is deliberately NOT named `progress_score`: it does not claim to be one, and
a name implying a score is exactly how an unanchored count gets cited as
evidence later.

WHAT IT CANNOT DO. Neither count is monotone in "closeness to winning". A level
that must be *restored* to an earlier state scores high on `cells_changed` for
going backwards. It answers "did this policy engage this world at all", which is
the question the byte-identical rows could not answer — not "how close was it".
"""

from __future__ import annotations

from dataclasses import dataclass, field

Grid = list[list[int]]


def _key(grid: Grid) -> tuple[tuple[int, ...], ...]:
    """A hashable snapshot. Tuples, not a string join: a join needs a separator
    and a separator is a collision waiting for a value that contains it."""
    return tuple(tuple(row) for row in grid)


def hamming(a: Grid, b: Grid) -> int:
    """Cells that differ, counting a shape change as a full-grid difference.

    Ragged or resized grids are real — an environment may swap the viewport —
    and zipping them would silently compare only the overlap, under-reporting
    exactly when the world changed MOST. So a shape mismatch reports the larger
    grid's cell count rather than the overlap's.
    """
    if len(a) != len(b) or any(len(ra) != len(rb) for ra, rb in zip(a, b)):
        return max(sum(len(r) for r in a), sum(len(r) for r in b))
    return sum(1 for ra, rb in zip(a, b) for x, y in zip(ra, rb) if x != y)


@dataclass
class LevelProbe:
    """Accumulates the two counts for ONE level. Reset when the level changes."""

    _seen: set[tuple[tuple[int, ...], ...]] = field(default_factory=set)
    _prev: Grid | None = None
    cells_changed: int = 0

    def observe(self, grid: Grid) -> None:
        """Record one frame. Idempotent per identical consecutive grid in the
        `cells_changed` sense (a still world adds zero), but NOT in the
        `distinct_grids` sense, which is a set and so is idempotent by
        construction."""
        self._seen.add(_key(grid))
        if self._prev is not None:
            self.cells_changed += hamming(self._prev, grid)
        self._prev = [list(row) for row in grid]

    @property
    def distinct_grids(self) -> int:
        return len(self._seen)

    def reset(self) -> None:
        """A NEW level is a new world; carrying counts across would attribute
        one level's engagement to the next."""
        self._seen = set()
        self._prev = None
        self.cells_changed = 0
