// src/wasm-dla/bytelock/dla-canonical.zig
//
// Canonical DLA substrate — Byte-Lock v2 (Zig)
// Spec: src/wasm-dla/CANONICAL_SPEC.md
//
// PRNG:   xorshift32
// Grid:   128×128, u8 per cell
// Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
// Walk:   4-directional, clamp to [1, 126]
// Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
//
// Compile (ONE step — `build-exe` links a complete module; Zig ships its own linker):
//   zig build-exe dla-canonical.zig -target wasm32-freestanding -O ReleaseSmall \
//     -fno-entry \
//     --export=init --export=run \
//     --export=get_cluster_size --export=get_max_r_bits --export=get_trajectory_entry \
//     -femit-bin=dla-canonical-zig.wasm
//
// DO NOT USE `zig build-lib` HERE. It emits an `ar` archive (`!<arch>`, `21 3c 61 72`)
// under the same name the runner expects a module at, and needs an external `wasm-ld` to
// finish. That trap fired: the archive was committed as `dla-canonical-zig.wasm` and this
// substrate loaded in no run for two weeks while still counting toward the executed total.
// Zig 0.13.0 (pinned in .mise.toml) with the command above produces a 1,314-byte module
// that agrees with the reference at seeds 1, 42, 100, 999.
//
// WHY NO @min / @round:
//   Zig 0.13 on wasm32-freestanding emits calls to fminf and roundf as host imports
//   rather than compiling them to WASM f32.min / f32.nearest instructions.
//   We implement both inline to keep the import list to {cos_f32, sin_f32} only,
//   matching the WAT and C substrates exactly.

const GRID_SIZE: i32 = 128;
const CENTER: i32 = 64;
const N_WALKERS: i32 = 800;
const MAX_STEPS: i32 = 50_000;
const SPAWN_CAP: f32 = 58.0;
const KILL_EXTRA: f32 = 8.0;
const TWO_PI: f32 = 6.2831855;

var grid: [128 * 128]u8 = undefined;
var prng_state: u32 = 1;
var cluster_size: i32 = 0;
var max_r: f32 = 1.0;
var trajectory: [800]u32 = undefined;

// Imported from host (same interface as WAT substrate)
extern fn cos_f32(x: f32) f32;
extern fn sin_f32(x: f32) f32;

// Inline min — avoids fminf host import on wasm32-freestanding
inline fn f32_min(a: f32, b: f32) f32 {
    return if (a < b) a else b;
}

// JS Math.round semantics: round half away from zero.
// Avoids roundf host import on wasm32-freestanding.
inline fn js_round(x: f32) i32 {
    return @intFromFloat(if (x >= 0.0) x + 0.5 else x - 0.5);
}

fn xorshift32() u32 {
    prng_state ^= prng_state << 13;
    prng_state ^= prng_state >> 17;
    prng_state ^= prng_state << 5;
    return prng_state;
}

fn grid_idx(x: i32, y: i32) usize {
    return @intCast(y * GRID_SIZE + x);
}

fn get_cell(x: i32, y: i32) u8 {
    if (x < 0 or x >= GRID_SIZE or y < 0 or y >= GRID_SIZE) return 0;
    return grid[grid_idx(x, y)];
}

fn has_neighbor(x: i32, y: i32) bool {
    return get_cell(x - 1, y) != 0 or
        get_cell(x + 1, y) != 0 or
        get_cell(x, y - 1) != 0 or
        get_cell(x, y + 1) != 0;
}

fn clamp(v: i32, lo: i32, hi: i32) i32 {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

export fn init(seed: u32) void {
    for (&grid) |*c| c.* = 0;
    prng_state = if (seed == 0) 1 else seed;
    cluster_size = 1;
    max_r = 1.0;
    grid[grid_idx(CENTER, CENTER)] = 1;
    for (&trajectory) |*t| t.* = 0xFFFFFFFF;
}

export fn run() void {
    var w: i32 = 0;
    while (w < N_WALKERS) : (w += 1) {
        // Spawn on circle at min(maxR + 3, SPAWN_CAP)
        const spawn_r: f32 = f32_min(max_r + 3.0, SPAWN_CAP);
        const angle_bits: u32 = xorshift32();
        const angle: f32 = (@as(f32, @floatFromInt(angle_bits)) / 4294967296.0) * TWO_PI;
        var wx: i32 = clamp(
            js_round(@as(f32, @floatFromInt(CENTER)) + spawn_r * cos_f32(angle)),
            1, GRID_SIZE - 2,
        );
        var wy: i32 = clamp(
            js_round(@as(f32, @floatFromInt(CENTER)) + spawn_r * sin_f32(angle)),
            1, GRID_SIZE - 2,
        );
        const kill_r: f32 = spawn_r + KILL_EXTRA;
        const kill_r2: f32 = kill_r * kill_r;

        var step: i32 = 0;
        while (step < MAX_STEPS) : (step += 1) {
            if (has_neighbor(wx, wy)) {
                // Stick
                grid[grid_idx(wx, wy)] = 1;
                cluster_size += 1;
                const dx: f32 = @floatFromInt(wx - CENTER);
                const dy: f32 = @floatFromInt(wy - CENTER);
                const r: f32 = @sqrt(dx * dx + dy * dy);
                if (r > max_r) max_r = r;
                trajectory[@intCast(w)] = (@as(u32, @intCast(wx)) << 16) | @as(u32, @intCast(wy));
                break;
            }
            // Kill radius check
            const dx: f32 = @floatFromInt(wx - CENTER);
            const dy: f32 = @floatFromInt(wy - CENTER);
            if (dx * dx + dy * dy > kill_r2) break;
            // 4-directional walk
            const dir: u32 = xorshift32() % 4;
            switch (dir) {
                0 => wx = clamp(wx + 1, 1, GRID_SIZE - 2),
                1 => wx = clamp(wx - 1, 1, GRID_SIZE - 2),
                2 => wy = clamp(wy + 1, 1, GRID_SIZE - 2),
                else => wy = clamp(wy - 1, 1, GRID_SIZE - 2),
            }
        }
        // trajectory[w] stays 0xFFFFFFFF if walker did not stick
    }
}

export fn get_cluster_size() i32 {
    return cluster_size;
}

export fn get_max_r_bits() u32 {
    return @bitCast(max_r);
}

export fn get_trajectory_entry(i: i32) u32 {
    return trajectory[@intCast(i)];
}
