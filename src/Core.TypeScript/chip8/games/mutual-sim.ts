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
    "LD V5, 0",   // AI score (AI tags player). 5 = player LOSES.
    "LD V6, 255", // Swap timer
    "LD V7, 3",   // AI speed
    "LD V8, 0",   // AI starts as Cat (Hunter)
    "LD V9, 0",   // Player score (player tags fleeing AI). 5 = player WINS.

    "CLS",
    // Draw Environment Threat (Wall 1)
    "BYTE 0xF101", // Plane 1 (Environment/AI)
    "LD I, shape_wall",
    "LD VA, 32",
    "LD VB, 10",
    "DRW VA, VB, 4",
    // Draw Environment Threat (Wall 2)
    "LD VA, 32",
    "LD VB, 20",
    "DRW VA, VB, 4",

    // Initial Draw
    "BYTE 0xF201", // Plane 2 (Player)
    "LD I, shape_p",
    "DRW V0, V1, 2",
    "BYTE 0xF101", // Plane 1 (AI)
    "SNE V8, 1",
    "JMP draw_ai_init_flee",
    "LD I, shape_ai_hunt",
    "JMP draw_ai_init_do",
    "draw_ai_init_flee:",
    "LD I, shape_ai_flee",
    "draw_ai_init_do:",
    "DRW V3, V4, 4",

    // Initial scoreboard: player score (plane 2) top-left, AI score (plane 1)
    // top-right — fontset glyphs, so the OCR layer reads them as a grid.
    "BYTE 0xF201",
    "LD F, V9",
    "LD VA, 1",
    "LD VB, 1",
    "DRW VA, VB, 5",
    "BYTE 0xF101",
    "LD F, V5",
    "LD VA, 58",
    "LD VB, 1",
    "DRW VA, VB, 5",

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
    "BYTE 0xF201", // Plane 2 (Player)
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
    "BYTE 0xF201", // Plane 2 (Player)
    "DRW V0, V1, 2",
    "SNE VF, 1", // If VF == 1, collision!
    "JMP p_collide",
    "JMP ai_logic",

    "p_collide:",
    // Undo move
    "BYTE 0xF201",
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
    "BYTE 0xF101", // Plane 1 (AI)
    "SNE V8, 1",
    "JMP erase_ai_flee",
    "LD I, shape_ai_hunt",
    "JMP erase_ai_do",
    "erase_ai_flee:",
    "LD I, shape_ai_flee",
    "erase_ai_do:",
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
    "JMP ai_y_logic",

    "ai_move_right:",
    "SNE V8, 1",
    "JMP ai_do_left",
    "ai_do_right:",
    "LD VE, 1",
    "ADD V3, VE",

    "ai_y_logic:",
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
    "JMP ai_draw",

    "ai_move_down:",
    "SNE V8, 1",
    "JMP ai_do_up",
    "ai_do_down:",
    "LD VE, 1",
    "ADD V4, VE",

    "ai_draw:",
    // Draw AI at new pos
    "BYTE 0xF101",
    "SNE V8, 1",
    "JMP draw_ai_flee",
    "LD I, shape_ai_hunt",
    "JMP draw_ai_do",
    "draw_ai_flee:",
    "LD I, shape_ai_flee",
    "draw_ai_do:",
    "DRW V3, V4, 4",
    "SNE VF, 1",
    "JMP ai_collide",
    "JMP frame_end",

    "ai_collide:",
    // Collision happened! Undo move (bounce off walls/player)
    "BYTE 0xF101",
    "DRW V3, V4, 4", // Erase from new pos
    "LD V3, VA",
    "LD V4, VB",
    "DRW V3, V4, 4", // Draw at old pos
    "JMP frame_end",

    // ── WIN CONDITIONS (in the cart, where they belong) ──────────────────
    // Tag = |playerX-aiX| < 3 AND |playerY-aiY| < 3. Who scores depends on
    // the phase: V8=0 the AI is hunting (a tag means the player LOST the
    // exchange, AI score V5++); V8=1 the AI is fleeing (the player CAUGHT it,
    // player score V9++). First to 5 flips the board: win = plane-2 (orange)
    // background fill; lose = plane-1 (green) background fill; then halt.
    // The respawn uses RND — the emulator's RND is seeded from COMMON_SEED,
    // so the whole game, tags included, replays deterministically.
    "frame_end:",
    // |dx|
    "LD VC, V0",
    "SUB VC, V3",
    "SE VF, 1",
    "JMP absx_neg",
    "JMP absx_done",
    "absx_neg:",
    "LD VC, V3",
    "SUB VC, V0",
    "absx_done:",
    "LD VE, 3",
    "SUB VC, VE",
    "SNE VF, 1",
    "JMP no_tag",
    // |dy|
    "LD VC, V1",
    "SUB VC, V4",
    "SE VF, 1",
    "JMP absy_neg",
    "JMP absy_done",
    "absy_neg:",
    "LD VC, V4",
    "SUB VC, V1",
    "absy_done:",
    "LD VE, 3",
    "SUB VC, VE",
    "SNE VF, 1",
    "JMP no_tag",
    // TAG! Route by phase.
    "SE V8, 0",
    "JMP tag_player",
    // V8 == 0: the hunter caught the player — AI scores.
    "BYTE 0xF101",
    "LD F, V5",
    "LD VA, 58",
    "LD VB, 1",
    "DRW VA, VB, 5", // erase old digit (XOR)
    "ADD V5, 1",
    "LD F, V5",
    "DRW VA, VB, 5", // draw new digit
    "JMP tag_respawn",
    "tag_player:",
    "BYTE 0xF201",
    "LD F, V9",
    "LD VA, 1",
    "LD VB, 1",
    "DRW VA, VB, 5",
    "ADD V9, 1",
    "LD F, V9",
    "DRW VA, VB, 5",
    "tag_respawn:",
    // Erase the AI at its old spot (phase-correct shape)…
    "BYTE 0xF101",
    "SNE V8, 1",
    "JMP resp_erase_flee",
    "LD I, shape_ai_hunt",
    "JMP resp_erase_do",
    "resp_erase_flee:",
    "LD I, shape_ai_flee",
    "resp_erase_do:",
    "DRW V3, V4, 4",
    // …then draw it somewhere clean (retry on collision; seeded RND).
    "resp_loop:",
    "RND V3, 0x3F",
    "RND V4, 0x1F",
    "DRW V3, V4, 4",
    "SNE VF, 1",
    "JMP resp_undo",
    "JMP score_check",
    "resp_undo:",
    "DRW V3, V4, 4",
    "JMP resp_loop",
    "score_check:",
    "SNE V9, 5",
    "JMP win",
    "SNE V5, 5",
    "JMP lose",
    "no_tag:",
    "JMP main_loop",

    // Player wins: flood the board with the PLAYER's color (plane 2).
    "win:",
    "BYTE 0xF701",
    "CLS",
    "BYTE 0xF201",
    "LD I, shape_fill",
    "LD VB, 0",
    "win_y:",
    "LD VA, 0",
    "win_x:",
    "DRW VA, VB, 4",
    "ADD VA, 8",
    "SE VA, 64",
    "JMP win_x",
    "ADD VB, 4",
    "SE VB, 32",
    "JMP win_y",
    "win_halt:",
    "JMP win_halt",

    // Player loses: flood the board with the AI's color (plane 1).
    "lose:",
    "BYTE 0xF701",
    "CLS",
    "BYTE 0xF101",
    "LD I, shape_fill",
    "LD VB, 0",
    "lose_y:",
    "LD VA, 0",
    "lose_x:",
    "DRW VA, VB, 4",
    "ADD VA, 8",
    "SE VA, 64",
    "JMP lose_x",
    "ADD VB, 4",
    "SE VB, 32",
    "JMP lose_y",
    "lose_halt:",
    "JMP lose_halt",


    // --- DATA SECTION ---
    // Player is a solid 2x2 square (2 bytes = 1 WORD)
    "shape_p:",
    "BYTE 0xC0C0",

    // AI (Hunt) is a hollow 4x4 square (4 bytes = 2 WORDs)
    "shape_ai_hunt:",
    "BYTE 0xF090",
    "BYTE 0x90F0",

    // AI (Flee) is a solid smaller 2x2 square (4 bytes = 2 WORDs for size parity)
    "shape_ai_flee:",
    "BYTE 0x0060",
    "BYTE 0x6000",

    // Wall is 4x4 solid (4 bytes = 2 WORDs)
    "shape_wall:",
    "BYTE 0xF0F0",
    "BYTE 0xF0F0",

    // Full 8x4 tile for the win/lose background flood
    "shape_fill:",
    "BYTE 0xFFFF",
    "BYTE 0xFFFF",
  ];

  return assemble(code);
}
