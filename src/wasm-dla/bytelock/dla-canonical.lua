-- src/wasm-dla/bytelock/dla-canonical.lua
--
-- Canonical DLA substrate — Byte-Lock v1 (Lua 5.4)
-- Spec: src/wasm-dla/CANONICAL_SPEC.md
--
-- PRNG:   xorshift32 (bitwise ops via Lua 5.4 integer arithmetic)
-- Grid:   128×128, integer array (0/1)
-- Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
-- Walk:   4-directional, clamp to [1, 126]
-- Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
--
-- Float precision: all trig uses single-precision via explicit f32 casts.
-- Lua 5.4 uses double (f64) by default; we truncate to f32 using a trick:
--   local function f32(x) return string.unpack("f", string.pack("f", x)) end
--
-- Compile:
--   luac5.4 -o dla-canonical.luac dla-canonical.lua
--
-- Run:
--   lua5.4 dla-canonical.lua [seed]

local GRID_SIZE  = 128
local CENTER     = 64
local N_WALKERS  = 800
local MAX_STEPS  = 50000
local SPAWN_CAP  = 58.0
local KILL_EXTRA = 8.0
local TWO_PI     = 6.2831855   -- nearest f32 to 2π (will be f32-cast below)

-- f32 cast: round-trip through IEEE 754 single precision
local function f32(x)
    return string.unpack("f", string.pack("f", x))
end

-- xorshift32 (Lua 5.4 integer bitwise ops, 32-bit mask)
local prng_state = 1
local MASK32 = 0xFFFFFFFF

local function xorshift32()
    local s = prng_state
    s = (s ~ (s << 13)) & MASK32
    s = (s ~ (s >> 17)) & MASK32
    s = (s ~ (s << 5))  & MASK32
    prng_state = s
    return s
end

-- Grid (flat array, 1-indexed in Lua but we use 0-based math)
local grid = {}
local trajectory = {}
local cluster_size = 0
local max_r = f32(1.0)

local function grid_idx(x, y)
    return y * GRID_SIZE + x + 1  -- +1 for 1-based Lua tables
end

local function get_cell(x, y)
    if x < 0 or x >= GRID_SIZE or y < 0 or y >= GRID_SIZE then return 0 end
    return grid[grid_idx(x, y)] or 0
end

local function has_neighbor(x, y)
    return get_cell(x-1, y) ~= 0 or get_cell(x+1, y) ~= 0 or
           get_cell(x, y-1) ~= 0 or get_cell(x, y+1) ~= 0
end

local function clamp(v, lo, hi)
    if v < lo then return lo end
    if v > hi then return hi end
    return v
end

-- JS Math.round semantics: round half away from zero
local function js_round(x)
    if x >= 0 then return math.floor(x + 0.5)
    else            return math.ceil(x - 0.5) end
end

local function init(seed)
    for i = 1, GRID_SIZE * GRID_SIZE do grid[i] = 0 end
    prng_state = (seed == 0) and 1 or (seed & MASK32)
    cluster_size = 1
    max_r = f32(1.0)
    grid[grid_idx(CENTER, CENTER)] = 1
    for i = 1, N_WALKERS do trajectory[i] = 0xFFFFFFFF end
end

local function run()
    for w = 1, N_WALKERS do
        local spawn_r = f32(math.min(f32(max_r + f32(3.0)), SPAWN_CAP))
        local angle_bits = xorshift32()
        local angle = f32(f32(angle_bits / 4294967296.0) * f32(TWO_PI))

        local wx = clamp(js_round(CENTER + f32(spawn_r * f32(math.cos(angle)))), 1, GRID_SIZE - 2)
        local wy = clamp(js_round(CENTER + f32(spawn_r * f32(math.sin(angle)))), 1, GRID_SIZE - 2)

        local kill_r  = f32(spawn_r + KILL_EXTRA)
        local kill_r2 = f32(kill_r * kill_r)

        local stuck = false
        for _step = 1, MAX_STEPS do
            if has_neighbor(wx, wy) then
                grid[grid_idx(wx, wy)] = 1
                cluster_size = cluster_size + 1
                local dx = f32(wx - CENTER)
                local dy = f32(wy - CENTER)
                local r  = f32(math.sqrt(f32(dx*dx + dy*dy)))
                if r > max_r then max_r = r end
                trajectory[w] = ((wx << 16) | wy) & MASK32
                stuck = true
                break
            end
            local dx = f32(wx - CENTER)
            local dy = f32(wy - CENTER)
            if f32(dx*dx + dy*dy) > kill_r2 then break end

            local dir = xorshift32() % 4
            if     dir == 0 then wx = clamp(wx + 1, 1, GRID_SIZE - 2)
            elseif dir == 1 then wx = clamp(wx - 1, 1, GRID_SIZE - 2)
            elseif dir == 2 then wy = clamp(wy + 1, 1, GRID_SIZE - 2)
            else                 wy = clamp(wy - 1, 1, GRID_SIZE - 2)
            end
        end
        -- trajectory[w] stays 0xFFFFFFFF if not stuck
    end
end

-- Bit-cast max_r to u32 (f32 IEEE 754 bits)
local function max_r_bits()
    return string.unpack("I4", string.pack("f", max_r))
end

-- CLI
local seed = tonumber(arg and arg[1]) or 42
init(seed)
run()

-- Output golden vector JSON
local traj_strs = {}
for i = 1, N_WALKERS do
    traj_strs[i] = string.format('"0x%08x"', trajectory[i])
end

io.write('{\n')
io.write(string.format('  "spec_version": "1",\n'))
io.write(string.format('  "seed": %d,\n', seed))
io.write(string.format('  "grid_size": %d,\n', GRID_SIZE))
io.write(string.format('  "n_walkers": %d,\n', N_WALKERS))
io.write('  "prng": "xorshift32",\n')
io.write('  "substrate": "lua54",\n')
io.write(string.format('  "cluster_size": %d,\n', cluster_size))
io.write(string.format('  "max_r_bits": %d,\n', max_r_bits()))
io.write('  "trajectory": [\n')
for i = 1, N_WALKERS do
    local comma = i < N_WALKERS and ',' or ''
    io.write(string.format('    %s%s\n', traj_strs[i], comma))
end
io.write('  ]\n')
io.write('}\n')
