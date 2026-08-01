// src/wasm-dla/bytelock/dla-canonical.rs
//
// Canonical DLA substrate — Byte-Lock v1 (Rust)
// Spec: src/wasm-dla/CANONICAL_SPEC.md
//
// PRNG:   xorshift32
// Grid:   128×128, u8 per cell
// Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
// Walk:   4-directional, clamp to [1, 126]
// Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
//
// Compile:
//   rustc --target wasm32-unknown-unknown -O -C opt-level=3 \
//     --crate-type cdylib -o dla-canonical-rust.wasm dla-canonical.rs

#![no_std]
#![allow(non_upper_case_globals)]

const GRID_SIZE: usize = 128;
const CENTER: i32 = 64;
const N_WALKERS: usize = 800;
const MAX_STEPS: i32 = 50_000;
const SPAWN_CAP: f32 = 58.0;
const KILL_EXTRA: f32 = 8.0;
const TWO_PI: f32 = 6.2831855;

// Host-provided trig
extern "C" {
    fn cos_f32(x: f32) -> f32;
    fn sin_f32(x: f32) -> f32;
}

static mut GRID: [u8; GRID_SIZE * GRID_SIZE] = [0u8; GRID_SIZE * GRID_SIZE];
static mut PRNG_STATE: u32 = 1;
static mut CLUSTER_SIZE: i32 = 0;
static mut MAX_R: f32 = 1.0;
static mut TRAJECTORY: [u32; N_WALKERS] = [0xFFFFFFFF; N_WALKERS];

#[inline]
unsafe fn xorshift32() -> u32 {
    PRNG_STATE ^= PRNG_STATE << 13;
    PRNG_STATE ^= PRNG_STATE >> 17;
    PRNG_STATE ^= PRNG_STATE << 5;
    PRNG_STATE
}

#[inline]
fn grid_idx(x: i32, y: i32) -> usize {
    (y as usize) * GRID_SIZE + (x as usize)
}

#[inline]
unsafe fn get_cell(x: i32, y: i32) -> u8 {
    if x < 0 || x >= GRID_SIZE as i32 || y < 0 || y >= GRID_SIZE as i32 {
        return 0;
    }
    GRID[grid_idx(x, y)]
}

#[inline]
unsafe fn has_neighbor(x: i32, y: i32) -> bool {
    get_cell(x - 1, y) != 0 || get_cell(x + 1, y) != 0 ||
    get_cell(x, y - 1) != 0 || get_cell(x, y + 1) != 0
}

#[inline]
fn clamp(v: i32, lo: i32, hi: i32) -> i32 {
    if v < lo { lo } else if v > hi { hi } else { v }
}

// JS Math.round semantics: round half away from zero
#[inline]
fn js_round(x: f32) -> i32 {
    if x >= 0.0 { (x + 0.5) as i32 } else { (x - 0.5) as i32 }
}

// Panic handler required for no_std
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub unsafe extern "C" fn init(seed: u32) {
    for c in GRID.iter_mut() { *c = 0; }
    PRNG_STATE = if seed == 0 { 1 } else { seed };
    CLUSTER_SIZE = 1;
    MAX_R = 1.0;
    GRID[grid_idx(CENTER, CENTER)] = 1;
    for t in TRAJECTORY.iter_mut() { *t = 0xFFFFFFFF; }
}

#[no_mangle]
pub unsafe extern "C" fn run() {
    for w in 0..N_WALKERS {
        let spawn_r: f32 = (MAX_R + 3.0_f32).min(SPAWN_CAP);
        let angle_bits: u32 = xorshift32();
        let angle: f32 = (angle_bits as f32 / 4294967296.0_f32) * TWO_PI;

        let mut wx: i32 = clamp(
            js_round(CENTER as f32 + spawn_r * cos_f32(angle)),
            1, GRID_SIZE as i32 - 2,
        );
        let mut wy: i32 = clamp(
            js_round(CENTER as f32 + spawn_r * sin_f32(angle)),
            1, GRID_SIZE as i32 - 2,
        );

        let kill_r: f32 = spawn_r + KILL_EXTRA;
        let kill_r2: f32 = kill_r * kill_r;

        let mut done = false;
        for _ in 0..MAX_STEPS {
            if has_neighbor(wx, wy) {
                GRID[grid_idx(wx, wy)] = 1;
                CLUSTER_SIZE += 1;
                let dx = (wx - CENTER) as f32;
                let dy = (wy - CENTER) as f32;
                let r = libm_sqrtf(dx * dx + dy * dy);
                if r > MAX_R { MAX_R = r; }
                TRAJECTORY[w] = ((wx as u32) << 16) | (wy as u32);
                done = true;
                break;
            }
            let dx = (wx - CENTER) as f32;
            let dy = (wy - CENTER) as f32;
            if dx * dx + dy * dy > kill_r2 { break; }

            let dir = xorshift32() % 4;
            match dir {
                0 => wx = clamp(wx + 1, 1, GRID_SIZE as i32 - 2),
                1 => wx = clamp(wx - 1, 1, GRID_SIZE as i32 - 2),
                2 => wy = clamp(wy + 1, 1, GRID_SIZE as i32 - 2),
                _ => wy = clamp(wy - 1, 1, GRID_SIZE as i32 - 2),
            }
        }
        let _ = done; // trajectory[w] stays 0xFFFFFFFF if not stuck
    }
}

// Correctly-rounded f32 sqrt via the WASM f32.sqrt instruction.
//
// WHY NOT NEWTON-RAPHSON:
//   3-iteration NR is ~1 ULP off from the IEEE 754 correctly-rounded value at
//   certain inputs (e.g. sqrt(738.0) diverges at seed=3 by exactly 1 ULP).
//   The WASM spec (§4.3.2) requires f32.sqrt to be correctly rounded to nearest,
//   matching JavaScript's Math.fround(Math.sqrt(x)) which uses hardware sqrtss.
//   Using NR caused Rust to diverge from all other substrates at 27/100 seeds
//   in the 100-seed corpus run on 2026-08-01.
//
// The intrinsic core::arch::wasm32::f32x4_sqrt compiles to a single f32.sqrt
// instruction, which is correctly-rounded on all conformant WASM runtimes.
#[inline(always)]
fn libm_sqrtf(x: f32) -> f32 {
    #[cfg(target_arch = "wasm32")]
    {
        // SAFETY: wasm32 target only; f32.sqrt is correctly-rounded per WASM spec §4.3.2
        unsafe {
            use core::arch::wasm32;
            let v = wasm32::f32x4(x, 0.0, 0.0, 0.0);
            let s = wasm32::f32x4_sqrt(v);
            wasm32::f32x4_extract_lane::<0>(s)
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        if x <= 0.0 { return 0.0; }
        x.sqrt()
    }
}

#[no_mangle]
pub unsafe extern "C" fn get_cluster_size() -> i32 { CLUSTER_SIZE }

#[no_mangle]
pub unsafe extern "C" fn get_max_r_bits() -> u32 { MAX_R.to_bits() }

#[no_mangle]
pub unsafe extern "C" fn get_trajectory_entry(i: i32) -> u32 { TRAJECTORY[i as usize] }
