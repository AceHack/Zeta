/*
 * dla-llvm.c -- DLA via LLVM IR pipeline (Oracle 13)
 * Compiled: clang -O2 -emit-llvm -> llc-18 -march=wasm32 -> wasm-ld-18
 * No libc dependency (ffreestanding + nostdlib).
 */
typedef unsigned int u32;
typedef int i32;

#define GRID 128
#define N_WALKERS 3000

static u32 g_grid[GRID * GRID];
static u32 g_rng;
static u32 g_max_r2;

static u32 xorshift32(void) {
    g_rng ^= g_rng << 13;
    g_rng ^= g_rng >> 17;
    g_rng ^= g_rng << 5;
    return g_rng;
}

static u32 isqrt(u32 n) {
    if (n == 0) return 0;
    u32 x = n, y = (x + 1) >> 1;
    while (y < x) { x = y; y = (x + n / x) >> 1; }
    return x;
}

static u32 ilog2(u32 n) {
    u32 r = 0;
    while (n > 1) { n >>= 1; r++; }
    return r;
}

static u32 fp_log2(u32 n) {
    if (n <= 1) return 0;
    u32 base = ilog2(n);
    u32 frac = (n - (1u << base)) * 1000 / (1u << base);
    return base * 1000 + frac;
}

__attribute__((export_name("init_dla")))
void init_dla(u32 seed) {
    g_rng = seed + 42;
    if (g_rng == 0) g_rng = 1;
    for (u32 i = 0; i < GRID * GRID; i++) g_grid[i] = 0;
    g_grid[(GRID/2) * GRID + (GRID/2)] = 1;
    g_max_r2 = 0;
}

__attribute__((export_name("run_dla")))
u32 run_dla(u32 seed) {
    init_dla(seed);
    u32 cluster_size = 1;

    for (u32 w = 0; w < N_WALKERS; w++) {
        u32 spawn_r = isqrt(g_max_r2) + 5;
        if (spawn_r >= GRID/2 - 2) spawn_r = GRID/2 - 2;

        u32 angle = xorshift32() % 628;
        i32 cx = (i32)(GRID/2) + (i32)(spawn_r * (angle < 314 ? (314 - (i32)angle) : ((i32)angle - 314)) / 314);
        i32 cy = (i32)(GRID/2) + (i32)(spawn_r * ((i32)angle < 157 ? (i32)angle : (314 - (i32)angle)) / 157);

        if (cx < 1) cx = 1; if (cx >= GRID-1) cx = GRID-2;
        if (cy < 1) cy = 1; if (cy >= GRID-1) cy = GRID-2;

        i32 x = cx, y = cy;
        u32 kill_r2 = (spawn_r + 10) * (spawn_r + 10);

        for (u32 s = 0; s < 5000; s++) {
            u32 dir = xorshift32() & 3;
            if (dir == 0) x++; else if (dir == 1) x--;
            else if (dir == 2) y++; else y--;
            if (x < 1) x = 1; if (x >= GRID-1) x = GRID-2;
            if (y < 1) y = 1; if (y >= GRID-1) y = GRID-2;

            i32 dx = x - (i32)(GRID/2), dy = y - (i32)(GRID/2);
            u32 r2 = (u32)(dx*dx + dy*dy);
            if (r2 > kill_r2) break;

            if (g_grid[(u32)y*GRID + (u32)(x+1)] || g_grid[(u32)y*GRID + (u32)(x-1)] ||
                g_grid[(u32)(y+1)*GRID + (u32)x] || g_grid[(u32)(y-1)*GRID + (u32)x]) {
                g_grid[(u32)y*GRID + (u32)x] = 1;
                cluster_size++;
                if (r2 > g_max_r2) g_max_r2 = r2;
                break;
            }
        }
    }
    return cluster_size;
}

__attribute__((export_name("get_df")))
u32 get_df(u32 seed) {
    u32 n = run_dla(seed);
    if (n <= 1 || g_max_r2 == 0) return 1322;
    u32 max_r = isqrt(g_max_r2);
    if (max_r <= 1) return 1322;
    u32 log_n = fp_log2(n);
    u32 log_r = fp_log2(max_r);
    if (log_r == 0) return 1322;
    return log_n * 1000 / log_r;
}
