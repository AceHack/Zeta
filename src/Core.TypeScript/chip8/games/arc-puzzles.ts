import { assemble } from "../assembler";

/**
 * Builds the Progressive ARC Puzzles ROM.
 * 
 * Level 1 (Translation): 
 *  - Renders a target shape at X=40, Y=15.
 *  - Player starts at X=10, Y=15.
 *  - Must move (Keys 2, 4, 6, 8) to exactly match target coordinates.
 * 
 * Level 2 (Obstacle Avoidance):
 *  - Renders an obstacle wall in the middle.
 *  - Target is on the other side.
 *  - Player must navigate around without colliding (VF collision check).
 *  - If collision occurs, level restarts.
 */
export function buildArcPuzzlesRom(): Uint8Array {
  const code = [
    // --- LEVEL 1 (Translation) ---
    "level_1:",
    "CLS",
    "LD V3, 40", // Target X
    "LD V4, 15", // Target Y
    "LD V0, 10", // Player X
    "LD V1, 15", // Player Y

    // Draw Target
    "LD I, shape_target",
    "DRW V3, V4, 4",

    "draw_player:",
    "LD I, shape_player",
    "DRW V0, V1, 4",

    "wait_input:",
    // Check win condition
    "SNE V0, V3",
    "JMP check_y",
    "JMP read_key",
    
    "check_y:",
    "SNE V1, V4",
    "JMP level_2", // Go to next level!

    "read_key:",
    "LD V2, K", // wait for key
    
    // Erase player
    "LD I, shape_player",
    "DRW V0, V1, 4",

    // Move logic
    "LD VE, 1",
    "SNE V2, 0x02",
    "SUB V1, VE", // Up

    "SNE V2, 0x08",
    "ADD V1, 1",  // Down

    "SNE V2, 0x04",
    "SUB V0, VE", // Left

    "SNE V2, 0x06",
    "ADD V0, 1",  // Right

    "JMP draw_player",


    // --- LEVEL 2 (Avoidance) ---
    "level_2:",
    "CLS",
    "LD V3, 50", // Target X
    "LD V4, 15", // Target Y
    "LD V0, 5",  // Player X
    "LD V1, 15", // Player Y

    // Draw Target
    "LD I, shape_target",
    "DRW V3, V4, 4",

    // Draw Obstacle (at X=30, Y=10)
    "LD I, shape_obstacle",
    "LD V5, 30",
    "LD V6, 10",
    "DRW V5, V6, 8",

    "check_win_l2:",
    "SNE V0, V3",
    "JMP check_y_l2",
    "JMP draw_player_l2",

    "check_y_l2:",
    "SNE V1, V4",
    "JMP win",

    "draw_player_l2:",
    "LD I, shape_player",
    "DRW V0, V1, 4",
    
    // Check collision (VF == 1)
    "SE VF, 1",
    "JMP level_2", // hit something! restart level

    "wait_input_l2:",
    "LD V2, K",
    
    // Erase
    "LD I, shape_player",
    "DRW V0, V1, 4",

    // Move logic
    "LD VE, 1",
    "SNE V2, 0x02",
    "SUB V1, VE",

    "SNE V2, 0x08",
    "ADD V1, 1",

    "SNE V2, 0x04",
    "SUB V0, VE",

    "SNE V2, 0x06",
    "ADD V0, 1",

    "JMP check_win_l2",

    // --- WIN STATE ---
    "win:",
    "CLS",
    "LD I, shape_target",
    "LD V0, 30",
    "LD V1, 15",
    "DRW V0, V1, 4",
    "win_loop:",
    "JMP win_loop",

    // --- DATA SECTION ---
    "shape_player:",
    "BYTE 0xF0",
    "BYTE 0xF0",
    "BYTE 0xF0",
    "BYTE 0xF0",

    "shape_target:",
    "BYTE 0xF0",
    "BYTE 0x90",
    "BYTE 0x90",
    "BYTE 0xF0",

    "shape_obstacle:",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
    "BYTE 0x80",
  ];

  return assemble(code);
}
