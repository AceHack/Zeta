//! CHIP-9 — Rust conformer oracle. Mirrors `src/Core/Chip8Cow.fs` (the F# oracle that LOCKED the
//! treaty) and the TS/C# siblings: `Fn01` plane select (3 bits = RGB), per-selected-plane XOR draw
//! with VF collision, selective CLS; plane 0 (mono) in `display`, higher planes in `extra`
//! (canonical: zero ⇒ absent). Opcode subset sufficient for the treaty ROM.

use std::collections::{HashMap, HashSet};

pub const W: usize = 64;
pub const H: usize = 32;
const PROGRAM_START: usize = 0x200;

/// The CHIP-9 machine state (treaty-conformance subset).
pub struct Chip9 {
    pub mem: HashMap<usize, u8>,
    pub v: [u8; 16],
    pub i: usize,
    pub pc: usize,
    pub plane: u8,
    pub display: HashSet<usize>,
    pub extra: HashMap<usize, u8>,
}

impl Default for Chip9 {
    fn default() -> Self {
        Self::create()
    }
}

impl Chip9 {
    /// A fresh machine: plane mask 1 (mono is the zero case), PC at 0x200.
    pub fn create() -> Self {
        Chip9 {
            mem: HashMap::new(),
            v: [0; 16],
            i: 0,
            pc: PROGRAM_START,
            plane: 1,
            display: HashSet::new(),
            extra: HashMap::new(),
        }
    }

    /// Load a ROM at 0x200.
    pub fn load_rom(&mut self, rom: &[u8]) {
        for (idx, b) in rom.iter().enumerate() {
            self.mem.insert(PROGRAM_START + idx, *b);
        }
    }

    /// The full color mask at a pixel — bit 0 from `display`, bits 1-2 from `extra`.
    pub fn color_at(&self, x: usize, y: usize) -> u8 {
        let idx = (y % H) * W + (x % W);
        let mono = u8::from(self.display.contains(&idx));
        mono | self.extra.get(&idx).copied().unwrap_or(0)
    }

    /// Execute one instruction (treaty subset: 00E0, 6XNN, ANNN, DXYN, Fn01).
    pub fn step(&mut self) {
        let op = ((self.mem.get(&self.pc).copied().unwrap_or(0) as usize) << 8)
            | self.mem.get(&(self.pc + 1)).copied().unwrap_or(0) as usize;
        let x = (op & 0x0f00) >> 8;
        let n = op & 0x000f;
        let nn = (op & 0x00ff) as u8;
        let nnn = op & 0x0fff;
        self.pc += 2;

        match op & 0xf000 {
            0x0000 if op == 0x00e0 => self.clear_selected(),
            0x6000 => self.v[x] = nn,
            0xa000 => self.i = nnn,
            0xd000 => self.draw(x, (op & 0x00f0) >> 4, n),
            0xf000 if nn == 0x01 => self.plane = (x as u8) & 0b111,
            _ => {}
        }
    }

    fn clear_selected(&mut self) {
        if self.plane & 1 != 0 {
            self.display.clear();
        }
        let keep = !self.plane & 0b110;
        if keep == 0b110 {
            return;
        }
        let keys: Vec<usize> = self.extra.keys().copied().collect();
        for k in keys {
            let m2 = self.extra[&k] & keep;
            if m2 == 0 {
                self.extra.remove(&k);
            } else {
                self.extra.insert(k, m2);
            }
        }
    }

    fn draw(&mut self, x_reg: usize, y_reg: usize, n: usize) {
        let ox = self.v[x_reg] as usize % W;
        let oy = self.v[y_reg] as usize % H;
        let hi_sel = self.plane & 0b110;
        let mut collision = 0u8;

        for row in 0..n {
            let sprite = self.mem.get(&(self.i + row)).copied().unwrap_or(0);
            for col in 0..8 {
                if (sprite >> (7 - col)) & 1 != 1 {
                    continue;
                }
                let idx = ((oy + row) % H) * W + ((ox + col) % W);
                if self.plane & 1 != 0 && !self.display.insert(idx) {
                    self.display.remove(&idx);
                    collision = 1;
                }
                if hi_sel != 0 {
                    let cur = self.extra.get(&idx).copied().unwrap_or(0);
                    if cur & hi_sel != 0 {
                        collision = 1;
                    }
                    let nxt = cur ^ hi_sel;
                    if nxt == 0 {
                        self.extra.remove(&idx);
                    } else {
                        self.extra.insert(idx, nxt);
                    }
                }
            }
        }
        self.v[0xf] = collision;
    }
}
