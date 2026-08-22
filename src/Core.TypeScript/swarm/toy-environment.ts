export type Cell = "empty" | "player" | "target" | "wall";

export interface ToyState {
  readonly width: number;
  readonly height: number;
  readonly grid: Cell[];
  readonly playerX: number;
  readonly playerY: number;
  readonly moves: number;
  readonly won: boolean;
  readonly causalMask: boolean[];
  readonly pheromoneField: Record<string, number>;
  readonly scarcity: number;
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

  const causalMask: boolean[] = new Array(width * height).fill(false);
  // Initial player position is always causally relevant
  causalMask[pY * width + pX] = true;

  return { 
    width, height, grid, playerX: pX, playerY: pY, moves: 0, won: false, causalMask,
    pheromoneField: {},
    scarcity: 0.0 // Initially no scarcity
  };
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
  const newCausalMask = [...state.causalMask];

  // The cell the player tried to move into is causally relevant (even if they bounced)
  newCausalMask[nIdx] = true;

  if (targetCell === "wall") {
    return { ...state, moves: state.moves + 1, causalMask: newCausalMask }; // Hit wall, no movement
  }

  const won = targetCell === "target";

  // New grid with player moved
  const newGrid = [...state.grid];
  newGrid[state.playerY * state.width + state.playerX] = "empty";
  if (!won) {
    newGrid[nIdx] = "player";
  }

  // Decay pheromones
  const newPheromones: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.pheromoneField)) {
    if (v > 0.01) newPheromones[k] = v * 0.9;
  }

  // Scarcity increases linearly with moves
  const newScarcity = Math.min(1.0, (state.moves + 1) / 100.0);

  return {
    ...state,
    grid: newGrid,
    playerX: nx,
    playerY: ny,
    moves: state.moves + 1,
    won,
    causalMask: newCausalMask,
    pheromoneField: newPheromones,
    scarcity: newScarcity
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

/** 
 * Playable Quote memory mapping erases the "soft regime" (irrelevant data) 
 * leaving only the "solid ground" causally evaluated memory. 
 */
export function mapPlayableQuoteMemory(state: ToyState): Uint8Array {
  const mem = mapToyToMemory(state);
  for (let i = 0; i < mem.length; i++) {
    if (!state.causalMask[i]) {
      mem[i] = 0; // Erase unaccessed/irrelevant memory
    }
  }
  return mem;
}

/** 
 * Tool-assisted ram write capability (Cheat Engine). 
 */
export function writeToyMemory(state: ToyState, idx: number, value: number): ToyState {
  if (idx < 0 || idx >= state.grid.length) return state;
  const newGrid = [...state.grid];
  switch (value) {
    case 0: newGrid[idx] = "empty"; break;
    case 1: newGrid[idx] = "player"; break;
    case 2: newGrid[idx] = "target"; break;
    case 3: newGrid[idx] = "wall"; break;
  }
  return { ...state, grid: newGrid };
}
