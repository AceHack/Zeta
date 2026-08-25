"""The frame seam: two frame types, one grid, and an action space read off the wire.

WHY THIS FILE EXISTS AT ALL. The toolkit hands back TWO different frame types
depending on which door you came through, and they disagree about what a frame
IS:

    `FrameData`     `.frame : list[list[list[int]]]`   — `perform_action(raw=False)`
    `FrameDataRaw`  `.frame : List[ndarray]`           — `perform_action(raw=True)`

`driver.py` takes the first door (we hold our own game object). Every hosted
environment takes the second, because `LocalEnvironmentWrapper.step` passes
`raw=True` unconditionally (`local_wrapper.py:238`). So an agent written
against our environments is handed nested lists, and the SAME agent pointed at
a hosted environment is handed numpy arrays.

That difference is quiet, which is what makes it worth a file. `components()`
would not crash on an ndarray — it would iterate, and return `Component`s whose
`colour` is an `np.int64`. Those compare equal to ints, hash equal to ints, and
then `_key()` multiplies one by 100003 and gets a numpy scalar that silently
overflows at 2**63 instead of promoting. A wrong answer with no exception, on
the hosted path only, discovered by a score that is bad for no visible reason.
So the conversion is explicit, here, once.

THE ACTION SPACE IS ONLY KNOWABLE FROM A FRAME. Worth stating because it
settles a design question rather than describing a helper: `EnvironmentInfo`
(`arc_agi/models.py:17`) carries `game_id`, `title`, `tags`, `level_tags`,
`baseline_actions` — and NO action-space field. There is no way to ask what
actions an environment accepts before playing it. `available_actions` on a live
frame is the only source.

Two consequences, both real:

  - An agent whose action set is fixed at construction cannot play a roster it
    has not already played. Reading the offered set per frame is not a nicety.
  - Any pre-play classification of environments into "keyboard" and "click"
    is inferred from `tags`, and TAGS ARE NOT AN ACTION SPACE. Planning a
    curriculum on that ordering would be planning on a coincidence — the count
    matching is not the identification (`numerology-vs-number-theory.md`).

The offered set can also CHANGE BETWEEN FRAMES; nothing promises otherwise, and
ZetaDiscovery's own levels differ in what they need. So it is re-read every
frame rather than cached from the reset.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Protocol, runtime_checkable

from arcengine import GameAction

from zeta_arc.perception import Grid


@runtime_checkable
class Frame(Protocol):
    """What both frame types have in common, and all this package needs.

    Declared structurally rather than as a union of the two concrete classes so
    that a third frame type — the toolkit is pre-1.0 — satisfies it by having
    the fields rather than by being added to a list here.
    """

    state: Any
    available_actions: list[int]


def grid_of(frame: Any) -> Grid:
    """The first layer of a frame, as plain nested `int` lists.

    Returns `[]` for an empty frame, which is a real state rather than an
    error: the toolkit returns frames with no layers (`is_empty()` exists for
    exactly this), and a level's first frame can arrive before anything is
    drawn.

    `int(v)` rather than `.tolist()` on purpose — it is one path for both frame
    types, and it is total: a `list[list[int]]` row and an `ndarray` row both
    iterate to scalars that `int()` accepts. Converting only when the input is
    an ndarray would leave the nested-list path untested against the case where
    a future toolkit version returns something else again.
    """
    layers = getattr(frame, "frame", None)
    if layers is None or len(layers) == 0:
        return []
    return [[int(v) for v in row] for row in layers[0]]


def offered_actions(frame: Any) -> list[GameAction]:
    """The actions this frame says are legal, in ascending id order.

    UNKNOWN IDS ARE DROPPED, and the dropping is ours to do. `GameAction.from_id`
    RAISES `ValueError` on an id it does not know (`arcengine/enums.py:93`) —
    checked, because the first version of this docstring said it returned `None`,
    which is what the loop above it looks like it does until you read the line
    after the loop. A `[from_id(i) for i in raw]` therefore kills the whole
    episode on one unrecognised id, so the `try` is load-bearing rather than
    defensive.

    Leniency is the right call here on a pre-1.0 toolkit: a server-side
    `ACTION8` should cost us the one action we cannot form, not the run. Nothing
    is destroyed by it either — `frame.available_actions` still carries the raw
    id, so a caller that wants to be strict can be.

    Ascending order is a determinism requirement, not tidiness: a policy that
    picks "the first offered action" must pick the same one on a replay, and
    `available_actions` is a list whose order the environment chooses.
    """
    raw: Sequence[int] = getattr(frame, "available_actions", None) or []
    found: list[GameAction] = []
    for i in raw:
        try:
            found.append(GameAction.from_id(int(i)))
        except ValueError:
            continue
    return sorted(found, key=lambda a: a.value)


def is_click(action: GameAction) -> bool:
    """Does this action carry a coordinate?

    Asks the ENGINE (`is_complex()` — `ACTION6` is the one `ComplexAction`),
    never `action == GameAction.ACTION6`. If the toolkit ever adds a second
    coordinate-valued action, the equality check silently treats it as a
    button and sends a click with no coordinate; this one picks it up.
    """
    return bool(action.is_complex())
