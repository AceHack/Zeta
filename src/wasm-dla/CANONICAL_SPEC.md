# Canonical DLA Spec — Byte-Lock v1

**Status:** DRAFT — written 2026-08-01 before porting any substrate.
**Purpose:** All 10 substrates must implement this exact algorithm so the byte-lock produces a meaningful conformance check (not a tautology).

---

## Audit Findings — Current Divergences

The 10 substrates currently split into **two incompatible families**:

### Family A — LCG PRNG (Knuth constants)

`prng_state = prng_state * 1664525 + 1013904223 (mod 2^32)`

| Substrate | Grid | Spawn rule | Walk rule | Boundary | Max steps |
|---|---|---|---|---|---|
| WAT | 128×128 | random position anywhere in grid (`prng % GRID_SIZE`) | 4-dir, clamp | clamp to [0, GRID_SIZE-1] | 10,000 per walker |
| Zig | 128×128 | random position anywhere in grid | 4-dir, clamp | clamp | 10,000 |
| C (emcc) | 128×128 | random position anywhere in grid | 4-dir, clamp | clamp | 10,000 |
| LLVM | 128×128 | (same as C) | 4-dir, clamp | clamp | 10,000 |
| ASC | 128×128 | random position anywhere in grid | 4-dir, clamp | clamp | 10,000 |
| Go | 128×128 | random position anywhere in grid | 4-dir, clamp | clamp | 10,000 |

**Note:** WAT uses `i32.rem_u` (unsigned remainder), others use signed `%`. For positive values these are identical.

### Family B — xorshift32 PRNG

`s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s >>> 0`

| Substrate | Grid | Spawn rule | Walk rule | Boundary | Max steps |
|---|---|---|---|---|---|
| Rust | 100×100 | circle spawn at `maxR + 3`, angle from xorshift | 4-dir, clamp | clamp | 20,000 |
| JS (useDLA) | 100×100 | circle spawn at `clusterRadius + 2`, angle from xorshift | 4-dir, clamp | clamp | `W*H*4` |
| JS (dla-meter) | 100×100 | circle spawn at `clusterRadius + 5`, angle from xorshift | **8-dir** (dx/dy ∈ {-1,0,1}), skip (0,0) | kill on boundary | `killR^2 * 4` |
| V8 bytecode | 128×128 | circle spawn (xorshift angle) | 4-dir, clamp | clamp | 50,000 |
| QuickJS bytecode | 128×128 | circle spawn (xorshift angle) | 4-dir, clamp | clamp | 50,000 |
| Lua 5.4 bytecode | 128×128 | circle spawn (xorshift-like, Lua `~` operator) | 4-dir, clamp | clamp | 50,000 |

**Additional divergences found:**

- Rust: `idx` uses `rem_euclid` (wraps negative coords) instead of clamp — different boundary behaviour
- Rust: `get_df` uses `sqrt(n) + 1` as radius proxy — different formula
- JS (dla-meter): 8-directional walk (diagonal moves allowed) — fundamentally different
- JS (useDLA): Tsirelson sticking probability `P(stick) = TSIRELSON * (1 + n_nbrs * 0.5)` — probabilistic, not deterministic
- WAT: `get_df` returns `N/R^2` ratio (not log ratio) — JS host must compute log
- Rust: grid is `u8` (1 byte per cell) vs others using `i32` (4 bytes per cell)

---

## Canonical Spec

### Rationale for choices

- **xorshift32** chosen over LCG: already used by the majority of bytecode substrates (V8, QuickJS, Lua) and the webdev JS oracles. Simpler to port WASM sources than to rewrite 3 bytecode sources.
- **128×128 grid** chosen over 100×100: used by WAT/Zig/C/LLVM/ASC/Go/V8/QuickJS/Lua. Only Rust and JS (useDLA/dla-meter) use 100×100.
- **Deterministic sticking** (no Tsirelson probability): the byte-lock requires deterministic output. Probabilistic sticking (useDLA) is incompatible with a byte-lock.
- **Circle spawn** chosen over random-anywhere spawn: more realistic DLA, used by Rust/bytecode substrates.
- **4-directional walk** chosen over 8-directional: used by all WASM substrates and bytecode substrates.
- **Clamp boundary** chosen over wrap/kill: simplest, used by most substrates.

### The Canonical Algorithm

```
GRID_SIZE = 128
CENTER    = 64
N_WALKERS = 800   (reduced from 1200 to keep runtime reasonable across all substrates)

PRNG: xorshift32
  state is u32, initialized to seed (if seed == 0, use 1)
  next():
    s ^= s << 13
    s ^= s >>> 17   (logical right shift, not arithmetic)
    s ^= s << 5
    return s         (full u32, NOT divided by 0xffffffff)

Grid: 128 × 128 array of u8 (0 = empty, 1 = cluster)
  Indexed as: grid[y * GRID_SIZE + x]
  Initialized to all zeros.
  Seed cell: grid[CENTER * GRID_SIZE + CENTER] = 1

State:
  clusterSize: u32 = 1
  maxR: f32 = 1.0   (Euclidean radius, NOT squared)

Walker loop (repeat N_WALKERS times):
  1. Spawn:
     spawnR = min(maxR + 3, 58)   (58 = CENTER - 6, keeps walkers inside grid)
     angle_bits = prng.next()
     angle = (angle_bits / 4294967296.0) * 2 * PI   (float32 or float64, see note)
     wx = round(CENTER + spawnR * cos(angle))
     wy = round(CENTER + spawnR * sin(angle))
     wx = clamp(wx, 1, GRID_SIZE - 2)
     wy = clamp(wy, 1, GRID_SIZE - 2)
     killR2 = (spawnR + 8)^2

  2. Walk (up to 50,000 steps):
     Check 4-neighbors (left, right, up, down):
       if grid[wy * GRID_SIZE + (wx-1)] == 1 OR
          grid[wy * GRID_SIZE + (wx+1)] == 1 OR
          grid[(wy-1) * GRID_SIZE + wx] == 1 OR
          grid[(wy+1) * GRID_SIZE + wx] == 1:
         → STICK: grid[wy * GRID_SIZE + wx] = 1
                  clusterSize++
                  r = sqrt((wx - CENTER)^2 + (wy - CENTER)^2)
                  if r > maxR: maxR = r
                  break

     Check kill radius:
       dx = wx - CENTER; dy = wy - CENTER
       if dx*dx + dy*dy > killR2: break (walker escapes)

     Move:
       dir = prng.next() % 4
       0 → wx = min(wx + 1, GRID_SIZE - 2)
       1 → wx = max(wx - 1, 1)
       2 → wy = min(wy + 1, GRID_SIZE - 2)
       3 → wy = max(wy - 1, 1)

Output (the byte-lock target):
  A flat array of N_WALKERS u32 values:
    output[i] = (stick_x << 16) | stick_y   if walker i stuck
    output[i] = 0xFFFFFFFF                   if walker i escaped
  This is the "trajectory vector" — the sequence of stick events.
  It is deterministic given the seed and the above algorithm.

  Additionally export:
    clusterSize: u32
    maxR: f32 (as u32 bits via bit-cast, to avoid float formatting issues)
```

### Float precision note

`angle = (prng.next() / 4294967296.0) * 2 * PI`

- In WASM f32: `(f32(prng_bits) / 4294967296.0f32) * 6.2831855f32`
- In JS (f64): `(prng_bits / 4294967296) * Math.PI * 2`
- These will produce slightly different angles for the same seed due to f32 vs f64 precision.
- **Resolution:** All substrates use **f32** for the angle computation. WASM substrates are naturally f32. JS substrates must explicitly use `Math.fround()`.
- The walk itself uses only integer arithmetic (no floats after spawn), so only the spawn point can diverge.

### Golden vector format (hex-in-JSON)

```json
{
  "spec_version": "1",
  "seed": 42,
  "grid_size": 128,
  "n_walkers": 800,
  "prng": "xorshift32",
  "substrate": "reference-js",
  "cluster_size": 412,
  "max_r_bits": 1095761920,
  "trajectory": [
    "0x00400040",
    "0x00410041",
    "0xffffffff",
    ...
  ]
}
```
`max_r_bits` is the f32 bit representation of maxR, obtained via `Float32Array` view.
`trajectory` has exactly N_WALKERS entries (800 hex strings).

---

## Porting checklist

- [ ] Reference JS implementation (Node.js, no browser APIs)
- [ ] WAT — change PRNG from LCG to xorshift32; change spawn to circle; change output to trajectory vector
- [ ] Zig — change PRNG from LCG to xorshift32; change spawn to circle; change output
- [ ] C (emcc) — change PRNG; change spawn; change output
- [ ] LLVM (C source) — same as C
- [ ] ASC — change PRNG; change spawn; change output
- [ ] Go — change PRNG; change spawn; change output
- [ ] Rust — change grid to 128×128; change spawn to match; change output
- [ ] V8 bytecode (JS source) — update JS source to canonical spec; recompile
- [ ] QuickJS bytecode (JS source) — update JS source; recompile with qjsc
- [ ] Lua 5.4 bytecode — update Lua source; recompile with luac5.4
