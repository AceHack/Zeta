import { assemble } from "../assembler";

export function buildMutualSimRom(): Uint8Array {
  const code = [
    // --- INIT ---
    // V0: Player X
    // V1: Player Y
    // V3: AI X
    // V4: AI Y
    // V6: Role Timer (Decrements)
    // V7: AI Speed Timer (Decrements)
    // V8: Phase (0 = AI Hunts, 1 = AI Flees)
    
    "init:",
    "LD V0, 10",
    "LD V1, 15",
    "LD V3, 50",
    "LD V4, 15",
    "LD V6, 255", // Swap timer
    "LD V7, 3",   // AI speed
    "LD V8, 0",   // AI starts as Cat (Hunter)
    
    "CLS",
    // Draw Environment Threat (Wall 1)
    "LD I, shape_wall",
    "LD VA, 32",
    "LD VB, 10",
    "DRW VA, VB, 4",
    // Draw Environment Threat (Wall 2)
    "LD VA, 32",
    "LD VB, 20",
    "DRW VA, VB, 4",

    // Initial Draw
    "LD I, shape_p",
    "DRW V0, V1, 2",
    "LD I, shape_ai",
    "DRW V3, V4, 4",

    "main_loop:",
    
    // -- TIMERS --
    "LD VE, 1",
    "SUB V6, VE",
    "SE V6, 0",
    "JMP timer_done",
    // Swap Roles!
    "LD V6, 255", // Reset swap timer
    "XOR V8, VE", // Toggle V8 between 0 and 1
    "timer_done:",
    
    // -- PLAYER MOVEMENT --
    // Erase Player
    "LD I, shape_p",
    "DRW V0, V1, 2",
    
    "LD VA, V0", // Save old X
    "LD VB, V1", // Save old Y
    
    // Input Handling
    "LD V2, 0x02",
    "SKNP V2",
    "SUB V1, VE", // Up

    "LD V2, 0x08",
    "SKNP V2",
    "ADD V1, VE", // Down

    "LD V2, 0x04",
    "SKNP V2",
    "SUB V0, VE", // Left

    "LD V2, 0x06",
    "SKNP V2",
    "ADD V0, VE", // Right

    // Draw Player at new pos
    "DRW V0, V1, 2",
    "SNE VF, 1", // If VF == 1, collision!
    "JMP p_collide",
    "JMP ai_logic",

    "p_collide:",
    // Undo move
    "DRW V0, V1, 2", // Erase from new pos
    "LD V0, VA",
    "LD V1, VB",
    "DRW V0, V1, 2", // Draw at old pos

    "ai_logic:",
    "LD VE, 1",
    "SUB V7, VE",
    "SE V7, 0",
    "JMP frame_end", // Skip AI move if timer not 0
    "LD V7, 3", // Reset AI speed timer
    
    // Erase AI
    "LD I, shape_ai",
    "DRW V3, V4, 4",
    
    "LD VA, V3", // Save old X
    "LD VB, V4", // Save old Y

    // X Axis Logic
    "LD VC, V3",
    "SUB VC, V0",
    "SE VF, 1",
    "JMP ai_move_right",

    "ai_move_left:",
    "SNE V8, 1",
    "JMP ai_do_right",
    "ai_do_left:",
    "LD VE, 1",
    "SUB V3, VE",
    "JMP ai_x_done",

    "ai_move_right:",
    "SNE V8, 1",
    "JMP ai_do_left",
    "ai_do_right:",
    "LD VE, 1",
    "ADD V3, VE",

    "ai_x_done:",
    
    // Y Axis Logic
    "LD VC, V4",
    "SUB VC, V1",
    "SE VF, 1",
    "JMP ai_move_down", // V4 < V1 -> move down

    "ai_move_up:",
    "SNE V8, 1",
    "JMP ai_do_down",
    "ai_do_up:",
    "LD VE, 1",
    "SUB V4, VE",
    "JMP ai_y_done",

    "ai_move_down:",
    "SNE V8, 1",
    "JMP ai_do_up",
    "ai_do_down:",
    "LD VE, 1",
    "ADD V4, VE",

    "ai_y_done:",
    
    // Draw AI at new pos
    "LD I, shape_ai",
    "DRW V3, V4, 4",
    "SNE VF, 1",
    "JMP ai_collide",
    "JMP frame_end",

    "ai_collide:",
    // Collision happened! Reset game entirely.
    "JMP init",

    "frame_end:",
    "JMP main_loop",


    // --- DATA SECTION ---
    // Player is a solid 2x2 square
    "shape_p:",
    "BYTE 0xC0", // 11000000
    "BYTE 0xC0", // 11000000

    // AI is a hollow 4x4 square
    "shape_ai:",
    "BYTE 0xF0", // 11110000
    "BYTE 0x90", // 10010000
    "BYTE 0x90", // 10010000
    "BYTE 0xF0", // 11110000

    // Wall is 4x4 solid
    "shape_wall:",
    "BYTE 0xF0", // 11110000
    "BYTE 0xF0", // 11110000
    "BYTE 0xF0", // 11110000
    "BYTE 0xF0", // 11110000
  ];

  return assemble(code);
}
