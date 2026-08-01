// dla.rs — Rust DLA oracle for wasm32-unknown-unknown
// Compiled with: rustc --target wasm32-unknown-unknown -O -C opt-level=3 --crate-type cdylib
// Substrate: Rust stable (rustup), wasm32-unknown-unknown target, no_std not required
// Part of Conjecture Z-7: binary_size ⊥ D_f

const GRID_SIZE: usize = 100;
const N: usize = GRID_SIZE * GRID_SIZE;

static mut GRID: [u8; N] = [0u8; N];
static mut PRNG_STATE: u32 = 42;
static mut CLUSTER_SIZE: u32 = 0;
static mut MAX_R2: u32 = 0;

#[inline]
unsafe fn xorshift32() -> u32 {
    PRNG_STATE ^= PRNG_STATE << 13;
    PRNG_STATE ^= PRNG_STATE >> 17;
    PRNG_STATE ^= PRNG_STATE << 5;
    PRNG_STATE
}

#[inline]
unsafe fn idx(x: i32, y: i32) -> usize {
    ((y.rem_euclid(GRID_SIZE as i32)) as usize) * GRID_SIZE
        + ((x.rem_euclid(GRID_SIZE as i32)) as usize)
}

#[inline]
unsafe fn has_neighbor(x: i32, y: i32) -> bool {
    GRID[idx(x - 1, y)] != 0
        || GRID[idx(x + 1, y)] != 0
        || GRID[idx(x, y - 1)] != 0
        || GRID[idx(x, y + 1)] != 0
}

#[no_mangle]
pub unsafe extern "C" fn init(seed: u32) {
    PRNG_STATE = if seed == 0 { 42 } else { seed };
    GRID = [0u8; N];
    CLUSTER_SIZE = 0;
    MAX_R2 = 0;
    let cx = (GRID_SIZE / 2) as i32;
    let cy = (GRID_SIZE / 2) as i32;
    GRID[idx(cx, cy)] = 1;
    CLUSTER_SIZE = 1;
}

#[no_mangle]
pub unsafe extern "C" fn step(n: u32) -> u32 {
    let cx = (GRID_SIZE / 2) as i32;
    let cy = (GRID_SIZE / 2) as i32;
    let mut stuck = 0u32;
    let r_kill = (GRID_SIZE as i32 / 2) - 1;
    for _ in 0..n {
        // Spawn walker on a circle around the cluster
        let max_r = (MAX_R2 as f32).sqrt() as i32 + 3;
        let spawn_r = (max_r + 2).min(r_kill - 1);
        let angle_bits = xorshift32();
        let angle = (angle_bits as f32) * (6.283185307 / 4294967296.0);
        let mut wx = cx + (spawn_r as f32 * angle.cos()) as i32;
        let mut wy = cy + (spawn_r as f32 * angle.sin()) as i32;
        // Walk
        for _ in 0..20000 {
            let dx2 = (wx - cx) * (wx - cx);
            let dy2 = (wy - cy) * (wy - cy);
            if dx2 + dy2 > r_kill * r_kill {
                break;
            }
            if GRID[idx(wx, wy)] == 0 && has_neighbor(wx, wy) {
                GRID[idx(wx, wy)] = 1;
                CLUSTER_SIZE += 1;
                let r2 = (dx2 + dy2) as u32;
                if r2 > MAX_R2 { MAX_R2 = r2; }
                stuck += 1;
                break;
            }
            let dir = xorshift32() & 3;
            match dir {
                0 => wx += 1,
                1 => wx -= 1,
                2 => wy += 1,
                _ => wy -= 1,
            }
        }
    }
    stuck
}

#[no_mangle]
pub unsafe extern "C" fn get_cluster_size() -> u32 {
    CLUSTER_SIZE
}

#[no_mangle]
pub unsafe extern "C" fn get_cell(x: i32, y: i32) -> u32 {
    GRID[idx(x, y)] as u32
}

#[no_mangle]
pub unsafe extern "C" fn get_df() -> f64 {
    if CLUSTER_SIZE < 2 { return 0.0; }
    let n = CLUSTER_SIZE as f64;
    let r = (n).sqrt() + 1.0;
    (n.ln()) / (r.ln())
}
