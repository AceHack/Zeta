import type { Frame } from "./chip8";

export interface CheatTable {
  frozenAddresses: Map<number, number>; // address -> fixed byte value
}

export function createCheatTable(): CheatTable {
  return {
    frozenAddresses: new Map(),
  };
}

export function applyCheatTable(frame: Frame, table: CheatTable): void {
  for (const [address, value] of table.frozenAddresses.entries()) {
    // If the emulator attempts to change this address, the cheat engine will force it back
    // to the frozen value at the start of every cycle.
    frame.mem.set(address, value & 0xff);
    
    // Also mark as causally modified by the cheat engine so the orbit detector sees it
    frame.causalMask[address] = true;
  }
}

/**
 * Injects raw hex code into memory at the specified address.
 * Hex string should be in the format "1220AABB..." (no 0x prefix, even length)
 */
export function injectCode(frame: Frame, address: number, hexString: string): void {
  // Clean up input from LLM
  hexString = hexString.replace(/^0x/i, "");
  if (hexString.length % 2 !== 0) {
    hexString = "0" + hexString;
  }
  
  for (let i = 0; i < hexString.length; i += 2) {
    const byte = parseInt(hexString.substring(i, i + 2), 16);
    frame.mem.set(address + (i / 2), byte);
    frame.causalMask[address + (i / 2)] = true;
  }
}
