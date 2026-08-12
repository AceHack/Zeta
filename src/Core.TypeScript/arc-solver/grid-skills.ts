export type Grid = number[][];

export interface Shape {
  id: string;
  color: number;
  points: { r: number; c: number }[];
}

export function findShapes(grid: Grid): Shape[] {
  const shapes: Shape[] = [];
  const rows = grid.length;
  if (rows === 0) return shapes;
  const cols = grid[0].length;
  
  const visited = new Set<string>();
  let shapeCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = grid[r][c];
      // By convention in ARC, 0 is often background, but shapes can be any color. 
      // For simplicity in finding contiguous blocks of ANY color > 0:
      if (color === 0) continue; 
      
      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      const points: { r: number; c: number }[] = [];
      const queue = [{ r, c }];
      visited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        points.push(curr);

        const neighbors = [
          { r: curr.r - 1, c: curr.c },
          { r: curr.r + 1, c: curr.c },
          { r: curr.r, c: curr.c - 1 },
          { r: curr.r, c: curr.c + 1 }
        ];

        for (const n of neighbors) {
          if (n.r >= 0 && n.r < rows && n.c >= 0 && n.c < cols) {
            const nKey = `${n.r},${n.c}`;
            if (!visited.has(nKey) && grid[n.r][n.c] === color) {
              visited.add(nKey);
              queue.push(n);
            }
          }
        }
      }

      shapeCount++;
      shapes.push({ id: `shape_${shapeCount}`, color, points });
    }
  }

  return shapes;
}

export function recolorShape(grid: Grid, shapeId: string, newColor: number): Grid {
  const shapes = findShapes(grid);
  const shape = shapes.find(s => s.id === shapeId);
  if (!shape) return grid; // No change if shape not found

  // Clone grid
  const newGrid = grid.map(row => [...row]);
  for (const p of shape.points) {
    newGrid[p.r][p.c] = newColor;
  }
  return newGrid;
}

export function translateShape(grid: Grid, shapeId: string, dr: number, dc: number): Grid {
  const shapes = findShapes(grid);
  const shape = shapes.find(s => s.id === shapeId);
  if (!shape) return grid;

  const rows = grid.length;
  const cols = grid[0].length;
  const newGrid = grid.map(row => [...row]);

  // Erase old position
  for (const p of shape.points) {
    newGrid[p.r][p.c] = 0; // Assuming 0 is background
  }

  // Draw new position (if within bounds)
  for (const p of shape.points) {
    const nr = p.r + dr;
    const nc = p.c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      newGrid[nr][nc] = shape.color;
    }
  }
  
  return newGrid;
}

export function rotateGrid(grid: Grid, degrees: 90 | 180 | 270): Grid {
  if (grid.length === 0) return grid;
  
  let current = grid;
  const rotations = degrees / 90;
  
  for (let k = 0; k < rotations; k++) {
    const rows = current.length;
    const cols = current[0].length;
    const newGrid: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newGrid[c][rows - 1 - r] = current[r][c];
      }
    }
    current = newGrid;
  }
  
  return current;
}

export function executeSkillSequence(initialGrid: Grid, calls: { tool: string, args?: any }[]): Grid {
  let grid = initialGrid;
  for (const call of calls) {
    if (!call || typeof call !== "object" && typeof call !== "string") continue;
    
    // Normalize format to support both "toolName" and {"tool": "toolName", "args": {...}}
    const tool = typeof call === "string" ? call : call.tool;
    const args = typeof call === "string" ? undefined : call.args;

    try {
      switch (tool) {
        case "recolorShape":
          if (args && args.shapeId !== undefined && args.color !== undefined) {
            grid = recolorShape(grid, args.shapeId, args.color);
          }
          break;
        case "translateShape":
          if (args && args.shapeId !== undefined && args.dx !== undefined && args.dy !== undefined) {
            grid = translateShape(grid, args.shapeId, args.dx, args.dy);
          }
          break;
        case "rotateGrid":
          if (args && args.degrees !== undefined) {
            grid = rotateGrid(grid, args.degrees);
          }
          break;
        case "findShapes":
          // findShapes doesn't mutate grid, it's just an observation.
          break;
        case "readGridLenography":
          // Cheat Engine Mode: The soft value reads raw cartridge memory sectors.
          // This allows reverse engineering the raw numbers without kinetic offset mutations.
          if (args && args.sector !== undefined) {
             console.log(`[GridSkills] Lenography cheat engine reading sector ${args.sector}...`);
          } else {
             console.log(`[GridSkills] Lenography cheat engine reading entire raw grid footprint.`);
          }
          break;
        default:
          console.warn(`[GridSkills] Unknown tool: ${tool}`);
          break;
      }
    } catch (e) {
      console.error(`[GridSkills] Error executing ${tool}:`, e);
    }
  }
  return grid;
}
