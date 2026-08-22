import { assemble } from "../assembler";

export function buildArc3Rom(): Uint8Array {
  const code = [
    // --- INIT ---
    "LD V0, 32", // Player X (start at middle)
    "LD V1, 15", // Player Y

    // --- LEVEL 1: HOLLOW BOX REPLICATION ---
    "level_1:",
    "CLS",
    // Draw target shape on the left (X=10, Y=10)
    "LD I, shape_target",
    "LD V3, 10",
    "LD V4, 10",
    "DRW V3, V4, 4",

    "draw_loop:",
    // Draw cursor pixel (Etch-A-Sketch style, no erase)
    "LD I, shape_pixel",
    "DRW V0, V1, 1",

    "wait_input:",
    "LD VE, 1",
    
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
    
    "LD V2, 0x05",
    "SKNP V2",
    "ADD V0, 4",  // Lift brush
    
    "SNE V0, 62",
    "JMP level_2", // Submit / Next Level

    "JMP draw_loop",

    // --- LEVEL 2: SYMMETRY ---
    "level_2:",
    "CLS",
    // Draw asymmetric target on the left
    "LD I, shape_asym",
    "LD V3, 10",
    "LD V4, 10",
    "DRW V3, V4, 4",
    
    "LD V0, 40",
    "LD V1, 10",

    "draw_loop_2:",
    "LD I, shape_pixel",
    "DRW V0, V1, 1",
    
    "LD VE, 1",
    
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
    
    "LD V2, 0x05",
    "SKNP V2",
    "ADD V0, 4",  // Lift brush
    "SNE V0, 62",
    "JMP level_3", // Next Level (Inversion)
    
    "JMP draw_loop_2",

    // --- LEVEL 3: INVERSION ---
    "level_3:",
    "CLS",
    "LD I, shape_inv",
    "LD V3, 10",
    "LD V4, 10",
    "DRW V3, V4, 4",
    
    "LD V0, 40",
    "LD V1, 10",

    "draw_loop_3:",
    "LD I, shape_pixel",
    "DRW V0, V1, 1",
    
    "LD VE, 1",
    "LD V2, 0x02",
    "SKNP V2",
    "SUB V1, VE",

    "LD V2, 0x08",
    "SKNP V2",
    "ADD V1, VE",

    "LD V2, 0x04",
    "SKNP V2",
    "SUB V0, VE",

    "LD V2, 0x06",
    "SKNP V2",
    "ADD V0, VE",
    
    "LD V2, 0x05",
    "SKNP V2",
    "ADD V0, 4",
    "SNE V0, 62",
    "JMP level_4", // Next Level (Scale)
    
    "JMP draw_loop_3",

    // --- LEVEL 4: SCALE/DILATION ---
    "level_4:",
    "CLS",
    "LD I, shape_scale",
    "LD V3, 10",
    "LD V4, 10",
    "DRW V3, V4, 4",
    
    "LD V0, 40",
    "LD V1, 10",

    "draw_loop_4:",
    "LD I, shape_pixel",
    "DRW V0, V1, 1",
    
    "LD VE, 1",
    "LD V2, 0x02",
    "SKNP V2",
    "SUB V1, VE",

    "LD V2, 0x08",
    "SKNP V2",
    "ADD V1, VE",

    "LD V2, 0x04",
    "SKNP V2",
    "SUB V0, VE",

    "LD V2, 0x06",
    "SKNP V2",
    "ADD V0, VE",
    
    "LD V2, 0x05",
    "SKNP V2",
    "ADD V0, 4",
    "SNE V0, 62",
    "JMP level_1", // Loop back to Level 1
    
    "JMP draw_loop_4",

    // --- DATA SECTION ---
    "shape_pixel:",
    "BYTE 0x80", // 10000000

    "shape_target:",
    "BYTE 0xF0", // 11110000
    "BYTE 0x90", // 10010000
    "BYTE 0x90", // 10010000
    "BYTE 0xF0", // 11110000

    "shape_asym:",
    "BYTE 0x80", // 10000000
    "BYTE 0xC0", // 11000000
    "BYTE 0xE0", // 11100000
    "BYTE 0xF0", // 11110000

    "shape_inv:",
    "BYTE 0x00", // 00000000
    "BYTE 0x60", // 01100000
    "BYTE 0x60", // 01100000
    "BYTE 0x00", // 00000000

    "shape_scale:",
    "BYTE 0xC0", // 11000000
    "BYTE 0xC0", // 11000000
    "BYTE 0x00", // 00000000
    "BYTE 0x00", // 00000000
  ];

  return assemble(code);
}
