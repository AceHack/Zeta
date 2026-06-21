/**
 * CHIP-9 (the Zeta color-extension dialect of CHIP-8) — TypeScript conformer oracle.
 * Mirrors src/Core/Chip8Cow.fs (the F# oracle that LOCKED the treaty): Fn01 plane select (3 bits =
 * RGB), per-selected-plane XOR draw with VF collision, selective CLS. Zero case structural: plane 0
 * (mono) lives in `display`; higher planes in `extra` (zero ⇒ absent). Subset sufficient for the
 * treaty ROM: 00E0, ANNN, 6XNN, DXYN, Fn01 — plus the FAULT TREATY (2026-06-12): 2NNN/00EE with
 * the fault register (recorded never fatal; first fault wins; refused CALL falls through).
 * TREATY: replaying ./golden-vectors.lines' rom must reproduce its 32×64 hex color grid exactly.
 */
export const W = 64;
export const H = 32;
const PROGRAM_START = 0x200;
export function create() {
    return {
        mem: new Map(),
        v: new Uint8Array(16),
        i: 0,
        pc: PROGRAM_START,
        plane: 1,
        display: new Map(),
        extra: new Map(),
        stack: [],
        fault: null,
    };
}
export function loadRom(rom, f) {
    rom.forEach((b, idx) => f.mem.set(PROGRAM_START + idx, b));
    return f;
}
export function colorAt(x, y, f) {
    const idx = (y % H) * W + (x % W);
    const mono = f.display.get(idx) ? 1 : 0;
    return mono | (f.extra.get(idx) ?? 0);
}
export function step(f) {
    const op = ((f.mem.get(f.pc) ?? 0) << 8) | (f.mem.get(f.pc + 1) ?? 0);
    const x = (op & 0x0f00) >> 8;
    const n = op & 0x000f;
    const nn = op & 0x00ff;
    const nnn = op & 0x0fff;
    f.pc += 2;
    switch (op & 0xf000) {
        case 0x0000:
            if (op === 0x00ee) {
                // FAULT TREATY: RET — pop, or record underflow (never fatal; first fault wins)
                const top = f.stack.pop();
                if (top !== undefined)
                    f.pc = top;
                else if (f.fault === null)
                    f.fault = "stack underflow: 00EE (RET) on empty stack";
            }
            else if (op === 0x00e0) {
                // selective CLS: clear only the SELECTED planes; canonical extra (zero ⇒ delete)
                if (f.plane & 1)
                    f.display.clear();
                const keep = ~f.plane & 0b110;
                if (keep !== 0b110) {
                    for (const [k, m] of [...f.extra]) {
                        const m2 = m & keep;
                        if (m2 === 0)
                            f.extra.delete(k);
                        else
                            f.extra.set(k, m2);
                    }
                }
            }
            break;
        case 0x2000:
            // FAULT TREATY: CALL — classic 16-frame cap; at depth 16 the CALL is REFUSED (fall through)
            if (f.stack.length >= 16) {
                if (f.fault === null)
                    f.fault = "stack overflow: CALL (2NNN) at depth 16 refused";
            }
            else {
                f.stack.push(f.pc);
                f.pc = nnn;
            }
            break;
        case 0x6000:
            f.v[x] = nn;
            break;
        case 0xa000:
            f.i = nnn;
            break;
        case 0xd000: {
            const ox = (f.v[x] ?? 0) % W;
            const oy = (f.v[(op & 0x00f0) >> 4] ?? 0) % H;
            const hiSel = f.plane & 0b110;
            let collision = 0;
            for (let row = 0; row < n; row++) {
                const sprite = f.mem.get(f.i + row) ?? 0;
                for (let col = 0; col < 8; col++) {
                    if (((sprite >> (7 - col)) & 1) === 1) {
                        // COSMAC VIP (B-1031): origin wraps (ox/oy above), pixels CLIP at right/bottom — not wrapped
                        const px = ox + col;
                        const py = oy + row;
                        if (px < W && py < H) {
                            const idx = py * W + px;
                            if (f.plane & 1) {
                                const cur = f.display.get(idx) ?? false;
                                if (cur)
                                    collision = 1;
                                f.display.set(idx, !cur);
                            }
                            if (hiSel !== 0) {
                                const cur = f.extra.get(idx) ?? 0;
                                if ((cur & hiSel) !== 0)
                                    collision = 1;
                                const nxt = cur ^ hiSel;
                                if (nxt === 0)
                                    f.extra.delete(idx);
                                else
                                    f.extra.set(idx, nxt);
                            }
                        }
                    }
                }
            }
            f.v[0xf] = collision;
            break;
        }
        case 0xf000:
            if (nn === 0x01)
                f.plane = x & 0b111; // Fn01: CHIP-9 plane select
            break;
        default:
            break;
    }
    return f;
}
