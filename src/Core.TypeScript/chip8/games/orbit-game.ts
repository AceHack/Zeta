import { assemble } from "../assembler";

/**
 * Builds the Causal Orbit Game ROM.
 * 
 * Level 1 (Orbit A): 
 *  - Renders a 4x4 square signature.
 *  - Waits for key '1' (0x1) to transition to Level 2.
 * 
 * Level 2 (Orbit B):
 *  - Clears screen.
 *  - Renders an 8x8 square signature.
 *  - Infinite loop (game won).
 */
export function buildOrbitGameRom(): Uint8Array {
  const code = [
    // --- LEVEL 1 (Orbit A) ---
    "level_1:",
    "CLS",
    "LD I, shape_4x4",
    "LD V0, 10", // X
    "LD V1, 10", // Y
    "DRW V0, V1, 4", // Draw 4x4

    "wait_key_1:",
    "LD V2, K", // block for input, store in V2
    "SNE V2, 0x01", // if key is 1, skip next jump
    "JMP to_level_2",
    "JMP wait_key_1", // loop if wrong key

    "to_level_2:",
    // --- LEVEL 2 (Orbit B) ---
    "level_2:",
    "CLS",
    "LD I, shape_8x8",
    "LD V0, 30", // X
    "LD V1, 10", // Y
    "DRW V0, V1, 8", // Draw 8x8

    "end_loop:",
    "JMP end_loop", // Infinite halt

    // DATA SECTION
    "shape_4x4:",
    "BYTE 0xF0",
    "BYTE 0x90",
    "BYTE 0x90",
    "BYTE 0xF0",

    "shape_8x8:",
    "BYTE 0xFF",
    "BYTE 0x81",
    "BYTE 0x81",
    "BYTE 0x81",
    "BYTE 0x81",
    "BYTE 0x81",
    "BYTE 0x81",
    "BYTE 0xFF",
  ];

  return assemble(code);
}
