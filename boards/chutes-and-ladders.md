# boards/chutes-and-ladders — the up/down board

The **Chutes & Ladders** board (US; UK "Snakes & Ladders") — the **space the up/down moves play over**:
`ladders/` (climb up) + `chutes/` (drop down), and the `escalator/` running **both ways** continuously over
it. The board *is* the space (a DAG / a grid of cells); a move is a jump on it; the seed's **bootstrap
up-and-down** is a walk across it.

- **Cells** = states; **ladders** = bounded up-jumps (shape F climb); **chutes** = bounded down-jumps
  (shape A fall, landing on `ground/`, never D⁰).
- **One board among many** (`boards/`): selected by a **discriminator / lens / polarization** — this is the
  *chutes-and-ladders* board; other boards (other spaces, other games/treaties) sit beside it.
- The **bob/weave/tie/???** weave-sizes are how you move/reconcile across boards (the escalator).

## Pointers

- `boards/README.md` (the never-one principle) · `chutes/` + `ladders/` + `escalator/` · `ground/` (the
  floor) · bootstrap up-and-down (the seed walking the board).
