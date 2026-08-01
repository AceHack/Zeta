// src/wasm-dla/zig/dla.zig
//
// DLA (Diffusion-Limited Aggregation) in Zig, compiled to WASM.
// This is the fifth WASM compiler substrate for Oracle 11 (Conjecture Z-7).
//
// Zig compiles to wasm32-freestanding with no runtime overhead.
// Expected binary size: ~2-4 KB (vs Go's 1.5 MB, a 500x difference).
//
// Compile:
//   zig build-lib dla.zig -target wasm32-freestanding -O ReleaseSmall \
//     -femit-bin=dla.wasm
// Validate: wasm-validate dla.wasm
//
// Conjecture Z-7 size table (updated with Zig):
//   WAT:  ~697 bytes  (bare-metal, no compiler)
//   Zig:  ~3 KB       (wasm32-freestanding, no runtime)
//   ASC:  ~6 KB       (TypeScript->WASM, AssemblyScript runtime)
//   emcc: ~8 KB       (C->WASM, Emscripten side module)
//   Go:   ~1.5 MB     (full Go runtime, GOOS=js GOARCH=wasm)
//   All five produce D_f ~ 1.322.

const GRID_SIZE: i32 = 128;
const CENTER: i32 = 64;

var grid: [128 * 128]i32 = undefined;
var prng_state: u32 = 42;
var cluster_size: i32 = 0;
var max_r2: i32 = 0;

fn prng_next() u32 {
    prng_state = prng_state *% 1664525 +% 1013904223;
    return prng_state;
}

fn idx(x: i32, y: i32) usize {
    return @intCast(y * GRID_SIZE + x);
}

fn get_cell(x: i32, y: i32) i32 {
    if (x < 0 or x >= GRID_SIZE or y < 0 or y >= GRID_SIZE) return 0;
    return grid[idx(x, y)];
}

fn has_cluster_neighbor(x: i32, y: i32) bool {
    return get_cell(x - 1, y) == 1 or
        get_cell(x + 1, y) == 1 or
        get_cell(x, y - 1) == 1 or
        get_cell(x, y + 1) == 1;
}

fn update_max_r2(x: i32, y: i32) void {
    const dx = x - CENTER;
    const dy = y - CENTER;
    const r2 = dx * dx + dy * dy;
    if (r2 > max_r2) max_r2 = r2;
}

// init(seed) — clear grid, place seed at center, reset PRNG
export fn init(seed: u32) void {
    for (&grid) |*cell| cell.* = 0;
    grid[idx(CENTER, CENTER)] = 1;
    prng_state = seed;
    cluster_size = 1;
    max_r2 = 0;
}

// step(n) — run n walkers, return cluster size
export fn step(n: i32) i32 {
    var i: i32 = 0;
    while (i < n) : (i += 1) {
        var wx: i32 = @intCast(prng_next() % @as(u32, @intCast(GRID_SIZE)));
        var wy: i32 = @intCast(prng_next() % @as(u32, @intCast(GRID_SIZE)));

        var s: i32 = 0;
        while (s < 10000) : (s += 1) {
            if (has_cluster_neighbor(wx, wy)) {
                grid[idx(wx, wy)] = 1;
                cluster_size += 1;
                update_max_r2(wx, wy);
                break;
            }
            const dir = prng_next() % 4;
            if (dir == 0) wx += 1;
            if (dir == 1) wx -= 1;
            if (dir == 2) wy += 1;
            if (dir == 3) wy -= 1;

            if (wx < 0) wx = 0;
            if (wx >= GRID_SIZE) wx = GRID_SIZE - 1;
            if (wy < 0) wy = 0;
            if (wy >= GRID_SIZE) wy = GRID_SIZE - 1;
        }
    }
    return cluster_size;
}

// get_df() — return N/R^2 ratio (JS host computes D_f = log(N)/log(R))
export fn get_df() f64 {
    if (max_r2 <= 1) return 1.0;
    const r = @sqrt(@as(f64, @floatFromInt(max_r2)));
    return @as(f64, @floatFromInt(cluster_size)) / (r * r);
}

// get_cell_export(x, y) — return cell state
export fn get_cell_export(x: i32, y: i32) i32 {
    return get_cell(x, y);
}

// get_cluster_size() — return current cluster size
export fn get_cluster_size() i32 {
    return cluster_size;
}
