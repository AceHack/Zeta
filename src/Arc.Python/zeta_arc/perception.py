"""Pixels to objects — the bottom rung of the perception ladder, on ARC frames.

`FrameData.frame` is `list[list[list[int]]]`: one or more layers of colour
integers. MEASURED on ZetaChase (2026-08-24): one layer, 64x64, colours
{5: background 3968px, 9: agent 64px, 4: goal 64px}, and it changes after a
single action.

WHAT THIS DELIBERATELY DOES NOT DO. It never asks the engine where anything is.
`play.py`'s existing agents call `game.current_level.get_sprites_by_tag(...)`
and read `sprite.x`, which is the ARC equivalent of reading V0/V1 out of the
CHIP-8 emulator — ground truth, not perception. An agent built on that is
scored on a problem it was handed the answer to. Everything here comes off the
grid.

BACKGROUND IS MEASURED, NOT NAMED. The most common colour in the frame is the
background. Hardcoding `5` would work today on this one environment and would
be exactly the kind of cart-specific constant that has to be unlearned later.
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass

Grid = list[list[int]]


@dataclass(frozen=True)
class Component:
    """One connected blob of a single colour."""

    colour: int
    area: int
    cx: float
    cy: float

    def distance_to(self, other: Component) -> float:
        return abs(self.cx - other.cx) + abs(self.cy - other.cy)


def background_colour(grid: Grid) -> int:
    """The most common colour. Measured per frame, never assumed."""
    counts: Counter[int] = Counter(v for row in grid for v in row)
    return counts.most_common(1)[0][0]


def components(grid: Grid, background: int | None = None) -> list[Component]:
    """Four-connected same-colour blobs, background excluded.

    Deterministic: cells are visited in row-major order and the returned list
    is sorted by (colour, cy, cx), so the same grid always yields the same list
    in the same order. Nothing here draws on a clock or a random source.
    """
    if not grid or not grid[0]:
        return []
    bg = background_colour(grid) if background is None else background
    height, width = len(grid), len(grid[0])
    seen = [[False] * width for _ in range(height)]
    found: list[Component] = []

    for y in range(height):
        for x in range(width):
            if seen[y][x] or grid[y][x] == bg:
                continue
            colour = grid[y][x]
            queue: deque[tuple[int, int]] = deque([(x, y)])
            seen[y][x] = True
            cells: list[tuple[int, int]] = []
            while queue:
                cxi, cyi = queue.popleft()
                cells.append((cxi, cyi))
                for nx, ny in (
                    (cxi + 1, cyi),
                    (cxi - 1, cyi),
                    (cxi, cyi + 1),
                    (cxi, cyi - 1),
                ):
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    if seen[ny][nx] or grid[ny][nx] != colour:
                        continue
                    seen[ny][nx] = True
                    queue.append((nx, ny))
            found.append(
                Component(
                    colour=colour,
                    area=len(cells),
                    cx=sum(c[0] for c in cells) / len(cells),
                    cy=sum(c[1] for c in cells) / len(cells),
                )
            )

    found.sort(key=lambda c: (c.colour, c.cy, c.cx))
    return found
