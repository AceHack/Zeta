/*
 * src/wasm-dla/bytelock/dla-canonical.c
 *
 * Canonical DLA substrate — Byte-Lock v1
 * Spec: src/wasm-dla/CANONICAL_SPEC.md
 *
 * PRNG:   xorshift32
 * Grid:   128×128, uint8_t per cell
 * Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
 * Walk:   4-directional, clamp to [1, 126]
 * Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
 *
 * Compile (Emscripten, standalone WASM):
 *   emcc dla-canonical.c -o dla-canonical-emcc.wasm \
 *     -O2 -s WASM=1 -s STANDALONE_WASM=1 --no-entry -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
 *     -s EXPORTED_FUNCTIONS='["_init","_run","_get_cluster_size","_get_max_r_bits","_get_trajectory_entry"]'
 *
 *   This line said SIDE_MODULE=1 until 2026-08-17, which on emcc 5.0.7 builds a relocatable
 *   module the byte-lock harness cannot instantiate. `build-substrates.mjs` carries the detail.
 *
 * Compile (LLVM direct):
 *   clang -target wasm32 -O2 -nostdlib -Wl,--no-entry \
 *     -Wl,--export=init -Wl,--export=run \
 *     -Wl,--export=get_cluster_size -Wl,--export=get_max_r_bits \
 *     -Wl,--export=get_trajectory_entry \
 *     -Wl,--import-undefined \
 *     dla-canonical.c -o dla-canonical-llvm.wasm
 *
 * Note: cos/sin are imported from the host (no libm in standalone WASM).
 */

#include <stdint.h>

/* Host-provided trig (imported from JS host) */
extern float cos_f32(float x);
extern float sin_f32(float x);

#define GRID_SIZE  128
#define CENTER     64
#define N_WALKERS  800
#define MAX_STEPS  50000
#define SPAWN_CAP  58.0f
#define KILL_EXTRA 8.0f
#define TWO_PI     6.2831855f

static uint8_t  grid[GRID_SIZE * GRID_SIZE];
static uint32_t prng_state = 1;
static int32_t  cluster_size = 0;
static float    max_r = 1.0f;
static uint32_t trajectory[N_WALKERS];

static uint32_t xorshift32(void) {
    prng_state ^= prng_state << 13;
    prng_state ^= prng_state >> 17;
    prng_state ^= prng_state << 5;
    return prng_state;
}

static int grid_idx(int x, int y) {
    return y * GRID_SIZE + x;
}

static int get_cell(int x, int y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
    return grid[grid_idx(x, y)];
}

static int has_neighbor(int x, int y) {
    return get_cell(x - 1, y) || get_cell(x + 1, y) ||
           get_cell(x, y - 1) || get_cell(x, y + 1);
}

static int clamp(int v, int lo, int hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

/* Nearest-integer rounding (round half away from zero, matching JS Math.round) */
static int js_round(float x) {
    return (int)(x >= 0.0f ? x + 0.5f : x - 0.5f);
}

void init(uint32_t seed) {
    int i;
    for (i = 0; i < GRID_SIZE * GRID_SIZE; i++) grid[i] = 0;
    prng_state = (seed == 0) ? 1 : seed;
    cluster_size = 1;
    max_r = 1.0f;
    grid[grid_idx(CENTER, CENTER)] = 1;
    for (i = 0; i < N_WALKERS; i++) trajectory[i] = 0xFFFFFFFF;
}

void run(void) {
    int w;
    for (w = 0; w < N_WALKERS; w++) {
        float spawn_r = max_r + 3.0f;
        if (spawn_r > SPAWN_CAP) spawn_r = SPAWN_CAP;

        uint32_t angle_bits = xorshift32();
        float angle = ((float)angle_bits / 4294967296.0f) * TWO_PI;

        int wx = clamp(js_round((float)CENTER + spawn_r * cos_f32(angle)), 1, GRID_SIZE - 2);
        int wy = clamp(js_round((float)CENTER + spawn_r * sin_f32(angle)), 1, GRID_SIZE - 2);

        float kill_r  = spawn_r + KILL_EXTRA;
        float kill_r2 = kill_r * kill_r;

        int step;
        int done = 0;
        for (step = 0; step < MAX_STEPS && !done; step++) {
            if (has_neighbor(wx, wy)) {
                grid[grid_idx(wx, wy)] = 1;
                cluster_size++;
                float dx = (float)(wx - CENTER);
                float dy = (float)(wy - CENTER);
                float r  = __builtin_sqrtf(dx * dx + dy * dy);
                if (r > max_r) max_r = r;
                trajectory[w] = ((uint32_t)wx << 16) | (uint32_t)wy;
                done = 1;
                break;
            }
            float dx = (float)(wx - CENTER);
            float dy = (float)(wy - CENTER);
            if (dx * dx + dy * dy > kill_r2) break;

            uint32_t dir = xorshift32() % 4;
            if      (dir == 0) wx = clamp(wx + 1, 1, GRID_SIZE - 2);
            else if (dir == 1) wx = clamp(wx - 1, 1, GRID_SIZE - 2);
            else if (dir == 2) wy = clamp(wy + 1, 1, GRID_SIZE - 2);
            else               wy = clamp(wy - 1, 1, GRID_SIZE - 2);
        }
        /* trajectory[w] stays 0xFFFFFFFF if not stuck */
    }
}

int32_t  get_cluster_size(void)             { return cluster_size; }
uint32_t get_max_r_bits(void)               { uint32_t b; __builtin_memcpy(&b, &max_r, 4); return b; }
uint32_t get_trajectory_entry(int32_t i)    { return trajectory[i]; }
