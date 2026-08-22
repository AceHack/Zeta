/**
 * CHIP-8 Simple Assembler
 */

export function assemble(source: string[]): Uint8Array {
  const rom = new Uint8Array(source.length * 2);
  const labels = new Map<string, number>();

  // Pass 1: find labels
  let offset = 0;
  for (const line of source) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.endsWith(":")) {
      labels.set(trimmed.slice(0, -1), 0x200 + offset);
    } else {
      offset += 2;
    }
  }

  // Pass 2: assemble
  offset = 0;
  for (const line of source) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.endsWith(":")) continue;

    const parts = trimmed.replace(/,/g, "").split(/\s+/);
    const op = parts[0]!.toUpperCase();
    
    let w = 0;

    const getReg = (s: string) => parseInt(s.substring(1), 16);
    const getVal = (s: string) => s.startsWith("0x") ? parseInt(s, 16) : parseInt(s, 10);
    const getAddr = (s: string) => labels.has(s) ? labels.get(s)! : getVal(s);

    try {
      switch (op) {
        case "CLS": w = 0x00e0; break;
        case "RET": w = 0x00ee; break;
        case "JMP": w = 0x1000 | getAddr(parts[1]!); break;
        case "CALL": w = 0x2000 | getAddr(parts[1]!); break;
        case "SE":
          if (parts[2]!.startsWith("V")) w = 0x5000 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4);
          else w = 0x3000 | (getReg(parts[1]!) << 8) | getVal(parts[2]!);
          break;
        case "SNE":
          if (parts[2]!.startsWith("V")) w = 0x9000 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4);
          else w = 0x4000 | (getReg(parts[1]!) << 8) | getVal(parts[2]!);
          break;
        case "LD":
          if (parts[1] === "I") w = 0xa000 | getAddr(parts[2]!);
          else if (parts[1] === "DT") w = 0xf015 | (getReg(parts[2]!) << 8);
          else if (parts[1] === "ST") w = 0xf018 | (getReg(parts[2]!) << 8);
          else if (parts[1] === "F") w = 0xf029 | (getReg(parts[2]!) << 8);
          else if (parts[1] === "B") w = 0xf033 | (getReg(parts[2]!) << 8);
          else if (parts[1] === "[I]") w = 0xf055 | (getReg(parts[2]!) << 8);
          else if (parts[2] === "DT") w = 0xf007 | (getReg(parts[1]!) << 8);
          else if (parts[2] === "K") w = 0xf00a | (getReg(parts[1]!) << 8);
          else if (parts[2] === "[I]") w = 0xf065 | (getReg(parts[1]!) << 8);
          else if (parts[2]!.startsWith("V")) w = 0x8000 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4);
          else w = 0x6000 | (getReg(parts[1]!) << 8) | getVal(parts[2]!);
          break;
        case "ADD":
          if (parts[1] === "I") w = 0xf01e | (getReg(parts[2]!) << 8);
          else if (parts[2]!.startsWith("V")) w = 0x8004 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4);
          else w = 0x7000 | (getReg(parts[1]!) << 8) | getVal(parts[2]!);
          break;
        case "OR": w = 0x8001 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4); break;
        case "AND": w = 0x8002 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4); break;
        case "XOR": w = 0x8003 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4); break;
        case "SUB": w = 0x8005 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4); break;
        case "SHR": w = 0x8006 | (getReg(parts[1]!) << 8); break;
        case "SUBN": w = 0x8007 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4); break;
        case "SHL": w = 0x800e | (getReg(parts[1]!) << 8); break;
        case "RND": w = 0xc000 | (getReg(parts[1]!) << 8) | getVal(parts[2]!); break;
        case "DRW": w = 0xd000 | (getReg(parts[1]!) << 8) | (getReg(parts[2]!) << 4) | getVal(parts[3]!); break;
        case "SKP": w = 0xe09e | (getReg(parts[1]!) << 8); break;
        case "SKNP": w = 0xe0a1 | (getReg(parts[1]!) << 8); break;
        case "BYTE": w = getVal(parts[1]!); break; // arbitrary raw byte/word
        default:
          throw new Error(`Unknown opcode: ${op}`);
      }
    } catch (e) {
      throw new Error(`Failed to parse line: "${line}" - ${e}`);
    }

    rom[offset++] = (w & 0xff00) >> 8;
    rom[offset++] = (w & 0x00ff);
  }

  return rom.slice(0, offset);
}
