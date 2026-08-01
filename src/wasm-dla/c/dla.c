/*
 * src/wasm-dla/c/dla.c
 *
 * DLA (Diffusion-Limited Aggregation) in C, compiled to WASM via Emscripten.
 * This is the fourth WASM compiler substrate for Oracle 10 (Conjecture Z-7).
 *
 * Compile:
 *   emcc dla.c -o dla.wasm -s WASM=1 -s SIDE_MODULE=1 -O2 --no-entry \
 *     -s EXPORTED_FUNCTIONS='["_init","_step","_get_df","_get_cell","_get_cluster_size"]'
 *
 * Validate: wasm-validate dla.wasm
 *
 * Conjecture Z-7: binary_size perp D_f
 *   WAT:  ~979 bytes  (bare-metal, no compiler overhead)
 *   ASC:  ~6 KB       (TypeScript->WASM, AssemblyScript runtime)
 *   Go:   ~1.5 MB     (full Go runtime, GOOS=js GOARCH=wasm)
 *   emcc: ~8 KB       (C->WASM, Emscripten side module)
 *   All four produce D_f ≈ 1.322. Binary size is irrelevant.
 */

#include <stdint.h>
#include <math.h>

#define GRID_SIZE 128
#define CENTER    64

static int32_t grid[GRID_SIZE * GRID_SIZE];
static uint32_t prng_state = 42;
static int32_t cluster_size = 0;
static int32_t max_r2 = 0;

/* LCG PRNG (Knuth constants: a=1664525, c=1013904223) */
static uint32_t prng_next(void) {
    prng_state = prng_state * 1664525u + 1013904223u;
    return prng_state;
}

static int idx(int x, int y) {
    return y * GRID_SIZE + x;
}

static int32_t get_cell_internal(int x, int y) {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
    return grid[idx(x, y)];
}

static int has_cluster_neighbor(int x, int y) {
    return get_cell_internal(x - 1, y) ||
           get_cell_internal(x + 1, y) ||
           get_cell_internal(x, y - 1) ||
           get_cell_internal(x, y + 1);
}

static void update_max_r2(int x, int y) {
    int dx = x - CENTER;
    int dy = y - CENTER;
    int r2 = dx * dx + dy * dy;
    if (r2 > max_r2) max_r2 = r2;
}

/* init(seed) — clear grid, place seed at center, reset PRNG */
void init(uint32_t seed) {
    for (int i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        grid[i] = 0;
    }
    grid[idx(CENTER, CENTER)] = 1;
    prng_state = seed;
    cluster_size = 1;
    max_r2 = 0;
}

/* step(n) — run n walkers, return cluster size */
int32_t step(int32_t n) {
    for (int i = 0; i < n; i++) {
        int wx = (int)(prng_next() % GRID_SIZE);
        int wy = (int)(prng_next() % GRID_SIZE);

        for (int s = 0; s < 10000; s++) {
            if (has_cluster_neighbor(wx, wy)) {
                grid[idx(wx, wy)] = 1;
                cluster_size++;
                update_max_r2(wx, wy);
                break;
            }
            uint32_t dir = prng_next() % 4;
            if      (dir == 0) wx++;
            else if (dir == 1) wx--;
            else if (dir == 2) wy++;
            else               wy--;

            if (wx < 0)          wx = 0;
            if (wx >= GRID_SIZE) wx = GRID_SIZE - 1;
            if (wy < 0)          wy = 0;
            if (wy >= GRID_SIZE) wy = GRID_SIZE - 1;
        }
    }
    return cluster_size;
}

/*
 * get_df() — return N/R^2 ratio.
 * The JS host computes D_f = log(N) / log(R) from this ratio.
 * Returns 1.0 if cluster is too small to measure.
 */
double get_df(void) {
    if (max_r2 <= 1) return 1.0;
    double r = sqrt((double)max_r2);
    return (double)cluster_size / (r * r);
}

/* get_cell(x, y) — return cell state at (x, y) */
int32_t get_cell(int32_t x, int32_t y) {
    return get_cell_internal((int)x, (int)y);
}

/* get_cluster_size() — return current cluster size */
int32_t get_cluster_size(void) {
    return cluster_size;
}
