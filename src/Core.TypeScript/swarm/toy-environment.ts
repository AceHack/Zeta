export type Cell = "empty" | "player" | "target" | "wall";

export interface ToyState {
  readonly width: number;
  readonly height: number;
  readonly grid: Cell[];
  readonly playerX: number;
  readonly playerY: number;
  readonly moves: number;
  readonly won: boolean;
}

export type ToyAction = "move_up" | "move_down" | "move_left" | "move_right";

export function createLevel(width: number, height: number, layout: string[]): ToyState {
  const grid: Cell[] = new Array(width * height).fill("empty");
  let pX = 0, pY = 0;
  
  for (let y = 0; y < height; y++) {
    const row = layout[y] || "";
    for (let x = 0; x < width; x++) {
      const char = row[x] || ".";
      const idx = y * width + x;
      if (char === "#") grid[idx] = "wall";
      else if (char === "T") grid[idx] = "target";
      else if (char === "P") {
        grid[idx] = "player";
        pX = x;
        pY = y;
      }
    }
  }

  return { width, height, grid, playerX: pX, playerY: pY, moves: 0, won: false };
}

export function stepToy(state: ToyState, action: ToyAction): ToyState {
  if (state.won) return state; // Terminal state

  let dx = 0, dy = 0;
  if (action === "move_up") dy = -1;
  if (action === "move_down") dy = 1;
  if (action === "move_left") dx = -1;
  if (action === "move_right") dx = 1;

  const nx = state.playerX + dx;
  const ny = state.playerY + dy;

  if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) {
    return { ...state, moves: state.moves + 1 }; // Hit boundary, no movement
  }

  const nIdx = ny * state.width + nx;
  const targetCell = state.grid[nIdx];

  if (targetCell === "wall") {
    return { ...state, moves: state.moves + 1 }; // Hit wall, no movement
  }

  const won = targetCell === "target";

  // New grid with player moved
  const newGrid = [...state.grid];
  newGrid[state.playerY * state.width + state.playerX] = "empty";
  if (!won) {
    newGrid[nIdx] = "player";
  }

  return {
    ...state,
    grid: newGrid,
    playerX: nx,
    playerY: ny,
    moves: state.moves + 1,
    won
  };
}

/** The CheatEngine memory maps the 2D game grid into a 1D sequence of bytes. */
export function mapToyToMemory(state: ToyState): Uint8Array {
  const mem = new Uint8Array(state.grid.length);
  for (let i = 0; i < state.grid.length; i++) {
    switch (state.grid[i]) {
      case "empty": mem[i] = 0; break;
      case "player": mem[i] = 1; break;
      case "target": mem[i] = 2; break;
      case "wall": mem[i] = 3; break;
    }
  }
  return mem;
}
