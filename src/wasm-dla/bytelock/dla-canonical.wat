;; src/wasm-dla/bytelock/dla-canonical.wat
;;
;; Canonical DLA substrate — Byte-Lock v1
;; Spec: src/wasm-dla/CANONICAL_SPEC.md
;;
;; PRNG:   xorshift32  (s ^= s<<13; s ^= s>>>17; s ^= s<<5)
;; Grid:   128×128, u8 per cell
;; Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
;; Walk:   4-directional, clamp to [1, 126]
;; Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
;;
;; Memory layout:
;;   [0 .. 16384)       grid cells (u8, 1 byte per cell, row-major)
;;   [16384 .. 16388)   prng_state (i32)
;;   [16388 .. 16392)   cluster_size (i32)
;;   [16392 .. 16396)   max_r_bits (f32 stored as i32 bits)
;;   [16396 .. 19596)   trajectory (800 × i32 = 3200 bytes)
;;
;; Compile: wat2wasm dla-canonical.wat -o dla-canonical.wasm
;;
;; Constants:
;;   GRID_SIZE = 128, CENTER = 64, N_WALKERS = 800
;;   MAX_STEPS = 50000, SPAWN_CAP = 58, KILL_EXTRA = 8
;;   TWO_PI_F32 = 0x40C90FDB (IEEE 754 f32 for 2π)

(module
  ;; ── Imported trig (host provides cos/sin for f32) ─────────────────────────
  ;; WAT has no built-in f32.cos/sin; we import them from the JS host.
  ;; The host must provide: { math: { cos_f32: (f32) => f32, sin_f32: (f32) => f32 } }
  (import "math" "cos_f32" (func $cos_f32 (param f32) (result f32)))
  (import "math" "sin_f32" (func $sin_f32 (param f32) (result f32)))

  ;; 2 pages = 131072 bytes — plenty for grid + state + trajectory
  (memory (export "memory") 2)

  ;; ── Memory offsets ────────────────────────────────────────────────────────
  (global $PRNG_OFF    i32 (i32.const 16384))
  (global $CSIZE_OFF   i32 (i32.const 16388))
  (global $MAXR_OFF    i32 (i32.const 16392))   ;; f32 bits
  (global $TRAJ_OFF    i32 (i32.const 16396))   ;; 800 × i32

  ;; ── Constants ─────────────────────────────────────────────────────────────
  (global $GRID_SIZE   i32 (i32.const 128))
  (global $CENTER      i32 (i32.const 64))
  (global $N_WALKERS   i32 (i32.const 800))
  (global $MAX_STEPS   i32 (i32.const 50000))
  (global $SPAWN_CAP   f32 (f32.const 58.0))
  (global $KILL_EXTRA  f32 (f32.const 8.0))
  (global $TWO_PI      f32 (f32.const 6.2831855))   ;; nearest f32 to 2π

  ;; ── xorshift32 ────────────────────────────────────────────────────────────
  (func $xorshift32 (result i32)
    (local $s i32)
    (local.set $s (i32.load (global.get $PRNG_OFF)))
    ;; s ^= s << 13
    (local.set $s (i32.xor (local.get $s) (i32.shl  (local.get $s) (i32.const 13))))
    ;; s ^= s >>> 17  (logical right shift)
    (local.set $s (i32.xor (local.get $s) (i32.shr_u (local.get $s) (i32.const 17))))
    ;; s ^= s << 5
    (local.set $s (i32.xor (local.get $s) (i32.shl  (local.get $s) (i32.const 5))))
    (i32.store (global.get $PRNG_OFF) (local.get $s))
    (local.get $s))

  ;; ── Grid helpers ──────────────────────────────────────────────────────────
  (func $grid_idx (param $x i32) (param $y i32) (result i32)
    (i32.add (i32.mul (local.get $y) (global.get $GRID_SIZE)) (local.get $x)))

  (func $get_cell (param $x i32) (param $y i32) (result i32)
    (if (i32.or
          (i32.or (i32.lt_s (local.get $x) (i32.const 0))
                  (i32.ge_s (local.get $x) (global.get $GRID_SIZE)))
          (i32.or (i32.lt_s (local.get $y) (i32.const 0))
                  (i32.ge_s (local.get $y) (global.get $GRID_SIZE))))
      (then (return (i32.const 0))))
    (i32.load8_u (call $grid_idx (local.get $x) (local.get $y))))

  (func $set_cell (param $x i32) (param $y i32)
    (i32.store8 (call $grid_idx (local.get $x) (local.get $y)) (i32.const 1)))

  (func $has_neighbor (param $x i32) (param $y i32) (result i32)
    (i32.or
      (i32.or
        (call $get_cell (i32.sub (local.get $x) (i32.const 1)) (local.get $y))
        (call $get_cell (i32.add (local.get $x) (i32.const 1)) (local.get $y)))
      (i32.or
        (call $get_cell (local.get $x) (i32.sub (local.get $y) (i32.const 1)))
        (call $get_cell (local.get $x) (i32.add (local.get $y) (i32.const 1))))))

  ;; ── clamp(v, lo, hi) ──────────────────────────────────────────────────────
  (func $clamp (param $v i32) (param $lo i32) (param $hi i32) (result i32)
    (if (i32.lt_s (local.get $v) (local.get $lo))
      (then (return (local.get $lo))))
    (if (i32.gt_s (local.get $v) (local.get $hi))
      (then (return (local.get $hi))))
    (local.get $v))

  ;; ── init(seed) ────────────────────────────────────────────────────────────
  (func (export "init") (param $seed i32)
    (local $i i32)
    ;; Clear grid (16384 bytes)
    (local.set $i (i32.const 0))
    (block $brk (loop $lp
      (br_if $brk (i32.ge_s (local.get $i) (i32.const 16384)))
      (i32.store8 (local.get $i) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    ;; Place seed cell at center
    (call $set_cell (global.get $CENTER) (global.get $CENTER))
    ;; Init PRNG (seed=0 → use 1)
    (i32.store (global.get $PRNG_OFF)
      (select (local.get $seed) (i32.const 1) (i32.ne (local.get $seed) (i32.const 0))))
    ;; cluster_size = 1
    (i32.store (global.get $CSIZE_OFF) (i32.const 1))
    ;; maxR = 1.0 (f32 bits = 0x3F800000)
    (i32.store (global.get $MAXR_OFF) (i32.const 0x3F800000))
    ;; Clear trajectory (800 × 4 bytes)
    (local.set $i (i32.const 0))
    (block $brk2 (loop $lp2
      (br_if $brk2 (i32.ge_s (local.get $i) (i32.const 800)))
      (i32.store
        (i32.add (global.get $TRAJ_OFF) (i32.mul (local.get $i) (i32.const 4)))
        (i32.const 0xFFFFFFFF))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp2))))

  ;; ── run() — run all N_WALKERS, populate trajectory ────────────────────────
  (func (export "run")
    (local $w i32)          ;; walker index
    (local $spawnR f32)
    (local $angleBits i32)
    (local $angle f32)
    (local $wx i32)
    (local $wy i32)
    (local $killR2 f32)
    (local $step i32)
    (local $dir i32)
    (local $dx i32)
    (local $dy i32)
    (local $r f32)
    (local $maxR f32)
    (local $csize i32)
    (local $dist2 f32)

    (local.set $w (i32.const 0))
    (block $outer_brk
      (loop $outer
        (br_if $outer_brk (i32.ge_s (local.get $w) (global.get $N_WALKERS)))

        ;; Load current maxR (f32 bits → f32)
        (local.set $maxR (f32.reinterpret_i32 (i32.load (global.get $MAXR_OFF))))

        ;; spawnR = min(maxR + 3, SPAWN_CAP)
        (local.set $spawnR
          (f32.min
            (f32.add (local.get $maxR) (f32.const 3.0))
            (global.get $SPAWN_CAP)))

        ;; angle = (xorshift32 / 2^32) * TWO_PI  — all f32
        (local.set $angleBits (call $xorshift32))
        (local.set $angle
          (f32.mul
            (f32.div
              (f32.convert_i32_u (local.get $angleBits))
              (f32.const 4294967296.0))
            (global.get $TWO_PI)))

        ;; wx = round(CENTER + spawnR * cos(angle))
        ;; wy = round(CENTER + spawnR * sin(angle))
        ;; WAT has no f32.cos/sin — use the JS import
        ;; We call the imported cos/sin functions
        (local.set $wx
          (call $clamp
            (i32.trunc_f32_s
              (f32.nearest
                (f32.add
                  (f32.convert_i32_s (global.get $CENTER))
                  (f32.mul (local.get $spawnR) (call $cos_f32 (local.get $angle))))))
            (i32.const 1) (i32.const 126)))
        (local.set $wy
          (call $clamp
            (i32.trunc_f32_s
              (f32.nearest
                (f32.add
                  (f32.convert_i32_s (global.get $CENTER))
                  (f32.mul (local.get $spawnR) (call $sin_f32 (local.get $angle))))))
            (i32.const 1) (i32.const 126)))

        ;; killR2 = (spawnR + KILL_EXTRA)^2
        (local.set $killR2
          (f32.mul
            (f32.add (local.get $spawnR) (global.get $KILL_EXTRA))
            (f32.add (local.get $spawnR) (global.get $KILL_EXTRA))))

        ;; Walk loop
        (local.set $step (i32.const 0))
        (block $stuck_or_escaped
          (loop $walk
            (br_if $stuck_or_escaped (i32.ge_s (local.get $step) (global.get $MAX_STEPS)))

            ;; Check 4-neighbors
            (if (call $has_neighbor (local.get $wx) (local.get $wy))
              (then
                ;; Stick
                (call $set_cell (local.get $wx) (local.get $wy))
                ;; cluster_size++
                (local.set $csize (i32.add (i32.load (global.get $CSIZE_OFF)) (i32.const 1)))
                (i32.store (global.get $CSIZE_OFF) (local.get $csize))
                ;; update maxR
                (local.set $dx (i32.sub (local.get $wx) (global.get $CENTER)))
                (local.set $dy (i32.sub (local.get $wy) (global.get $CENTER)))
                (local.set $r
                  (f32.sqrt
                    (f32.add
                      (f32.mul (f32.convert_i32_s (local.get $dx)) (f32.convert_i32_s (local.get $dx)))
                      (f32.mul (f32.convert_i32_s (local.get $dy)) (f32.convert_i32_s (local.get $dy))))))
                (if (f32.gt (local.get $r) (local.get $maxR))
                  (then
                    (local.set $maxR (local.get $r))
                    (i32.store (global.get $MAXR_OFF) (i32.reinterpret_f32 (local.get $r)))))
                ;; Write trajectory entry: (wx << 16) | wy
                (i32.store
                  (i32.add (global.get $TRAJ_OFF) (i32.mul (local.get $w) (i32.const 4)))
                  (i32.or
                    (i32.shl (local.get $wx) (i32.const 16))
                    (local.get $wy)))
                (br $stuck_or_escaped)))

            ;; Kill radius check
            (local.set $dx (i32.sub (local.get $wx) (global.get $CENTER)))
            (local.set $dy (i32.sub (local.get $wy) (global.get $CENTER)))
            (local.set $dist2
              (f32.add
                (f32.mul (f32.convert_i32_s (local.get $dx)) (f32.convert_i32_s (local.get $dx)))
                (f32.mul (f32.convert_i32_s (local.get $dy)) (f32.convert_i32_s (local.get $dy)))))
            (if (f32.gt (local.get $dist2) (local.get $killR2))
              (then (br $stuck_or_escaped)))

            ;; Move
            (local.set $dir (i32.rem_u (call $xorshift32) (i32.const 4)))
            (if (i32.eq (local.get $dir) (i32.const 0))
              (then (local.set $wx (call $clamp (i32.add (local.get $wx) (i32.const 1)) (i32.const 1) (i32.const 126)))))
            (if (i32.eq (local.get $dir) (i32.const 1))
              (then (local.set $wx (call $clamp (i32.sub (local.get $wx) (i32.const 1)) (i32.const 1) (i32.const 126)))))
            (if (i32.eq (local.get $dir) (i32.const 2))
              (then (local.set $wy (call $clamp (i32.add (local.get $wy) (i32.const 1)) (i32.const 1) (i32.const 126)))))
            (if (i32.eq (local.get $dir) (i32.const 3))
              (then (local.set $wy (call $clamp (i32.sub (local.get $wy) (i32.const 1)) (i32.const 1) (i32.const 126)))))

            (local.set $step (i32.add (local.get $step) (i32.const 1)))
            (br $walk)))

        ;; trajectory[w] remains 0xFFFFFFFF if escaped (set during init)
        (local.set $w (i32.add (local.get $w) (i32.const 1)))
                (br $outer)))
  )  ;; end func run

  ;; ── Exported accessors ────────────────────────────────────────────────────
  (func (export "get_cluster_size") (result i32)
    (i32.load (global.get $CSIZE_OFF)))

  (func (export "get_max_r_bits") (result i32)
    (i32.load (global.get $MAXR_OFF)))

  ;; get_trajectory_entry(i) → trajectory[i]
  (func (export "get_trajectory_entry") (param $i i32) (result i32)
    (i32.load
      (i32.add (global.get $TRAJ_OFF) (i32.mul (local.get $i) (i32.const 4)))))

)
