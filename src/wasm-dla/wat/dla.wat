;; src/wasm-dla/wat/dla.wat
;;
;; DLA (Diffusion-Limited Aggregation) in WebAssembly Text Format.
;; This is the bare-metal substrate for Oracle 10 — written directly
;; in WAT (the assembly language of WebAssembly) without any compiler.
;;
;; Algorithm:
;;   - Grid: GRID_SIZE x GRID_SIZE cells stored in linear memory
;;   - Seed: deterministic LCG PRNG seeded by the caller
;;   - Walker: random walk until it touches the cluster, then sticks
;;   - D_f: estimated from cluster_size / radius^2 (box-counting proxy)
;;
;; Exports:
;;   init(seed: i32)       — initialize grid + PRNG with seed
;;   step(n: i32) -> i32   — run n walker steps, return cluster size
;;   get_df() -> f64       — return current D_f estimate
;;   get_cell(x,y) -> i32  — return cell state at (x,y)
;;
;; Memory layout:
;;   [0..GRID_SIZE*GRID_SIZE*4) — grid cells (i32 per cell, 0=empty 1=cluster)
;;   [GRID_SIZE*GRID_SIZE*4)    — PRNG state (i32)
;;   [GRID_SIZE*GRID_SIZE*4+4)  — cluster size (i32)
;;   [GRID_SIZE*GRID_SIZE*4+8)  — max radius squared (i32)
;;
;; Compile: wat2wasm dla.wat -o dla.wasm
;; Validate: wasm-validate dla.wasm

(module
  ;; 128x128 grid = 16384 cells * 4 bytes = 65536 bytes = 1 page
  (memory (export "memory") 2)

  (global $GRID_SIZE i32 (i32.const 128))
  (global $CENTER    i32 (i32.const 64))  ;; GRID_SIZE / 2

  ;; Memory offsets (past the grid)
  (global $PRNG_OFFSET    i32 (i32.const 65536))  ;; 128*128*4
  (global $CSIZE_OFFSET   i32 (i32.const 65540))
  (global $MAXR2_OFFSET   i32 (i32.const 65544))

  ;; LCG PRNG: next = (a * state + c) mod 2^32
  ;; Knuth's constants: a=1664525, c=1013904223
  (func $prng_next (result i32)
    (local $state i32)
    (local.set $state (i32.load (global.get $PRNG_OFFSET)))
    (local.set $state
      (i32.add
        (i32.mul (local.get $state) (i32.const 1664525))
        (i32.const 1013904223)))
    (i32.store (global.get $PRNG_OFFSET) (local.get $state))
    (local.get $state))

  ;; cell index from (x, y)
  (func $idx (param $x i32) (param $y i32) (result i32)
    (i32.add
      (i32.mul (local.get $y) (global.get $GRID_SIZE))
      (local.get $x)))

  ;; get cell value at (x, y) — returns 0 if out of bounds
  (func $get_cell_internal (param $x i32) (param $y i32) (result i32)
    (if (i32.or
          (i32.or (i32.lt_s (local.get $x) (i32.const 0))
                  (i32.ge_s (local.get $x) (global.get $GRID_SIZE)))
          (i32.or (i32.lt_s (local.get $y) (i32.const 0))
                  (i32.ge_s (local.get $y) (global.get $GRID_SIZE))))
      (then (return (i32.const 0))))
    (i32.load
      (i32.mul
        (call $idx (local.get $x) (local.get $y))
        (i32.const 4))))

  ;; check if any neighbor of (x,y) is in the cluster
  (func $has_cluster_neighbor (param $x i32) (param $y i32) (result i32)
    (i32.or
      (i32.or
        (call $get_cell_internal
          (i32.sub (local.get $x) (i32.const 1)) (local.get $y))
        (call $get_cell_internal
          (i32.add (local.get $x) (i32.const 1)) (local.get $y)))
      (i32.or
        (call $get_cell_internal
          (local.get $x) (i32.sub (local.get $y) (i32.const 1)))
        (call $get_cell_internal
          (local.get $x) (i32.add (local.get $y) (i32.const 1))))))

  ;; update max radius squared
  (func $update_maxr2 (param $x i32) (param $y i32)
    (local $dx i32)
    (local $dy i32)
    (local $r2 i32)
    (local.set $dx (i32.sub (local.get $x) (global.get $CENTER)))
    (local.set $dy (i32.sub (local.get $y) (global.get $CENTER)))
    (local.set $r2
      (i32.add
        (i32.mul (local.get $dx) (local.get $dx))
        (i32.mul (local.get $dy) (local.get $dy))))
    (if (i32.gt_s (local.get $r2) (i32.load (global.get $MAXR2_OFFSET)))
      (then (i32.store (global.get $MAXR2_OFFSET) (local.get $r2)))))

  ;; init(seed) — clear grid, place seed at center, reset PRNG
  (func (export "init") (param $seed i32)
    (local $i i32)
    ;; clear grid
    (local.set $i (i32.const 0))
    (block $break
      (loop $loop
        (br_if $break (i32.ge_s (local.get $i) (i32.const 16384)))
        (i32.store (i32.mul (local.get $i) (i32.const 4)) (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    ;; place seed at center
    (i32.store
      (i32.mul (call $idx (global.get $CENTER) (global.get $CENTER)) (i32.const 4))
      (i32.const 1))
    ;; init PRNG
    (i32.store (global.get $PRNG_OFFSET) (local.get $seed))
    ;; init cluster size = 1
    (i32.store (global.get $CSIZE_OFFSET) (i32.const 1))
    ;; init max radius = 0
    (i32.store (global.get $MAXR2_OFFSET) (i32.const 0)))

  ;; step(n) — run n walkers, return cluster size
  (func (export "step") (param $n i32) (result i32)
    (local $i i32)
    (local $wx i32)
    (local $wy i32)
    (local $dir i32)
    (local.set $i (i32.const 0))
    (block $break_outer
      (loop $loop_outer
        (br_if $break_outer (i32.ge_s (local.get $i) (local.get $n)))
        ;; spawn walker at random position on a circle of radius 40
        ;; (simplified: random position in grid, retry if in cluster)
        (local.set $wx
          (i32.rem_u (call $prng_next) (global.get $GRID_SIZE)))
        (local.set $wy
          (i32.rem_u (call $prng_next) (global.get $GRID_SIZE)))
        ;; walk until stuck or out of bounds
        (block $stuck
          (loop $walk
            ;; if touching cluster, stick
            (if (call $has_cluster_neighbor (local.get $wx) (local.get $wy))
              (then
                (i32.store
                  (i32.mul (call $idx (local.get $wx) (local.get $wy)) (i32.const 4))
                  (i32.const 1))
                (i32.store (global.get $CSIZE_OFFSET)
                  (i32.add (i32.load (global.get $CSIZE_OFFSET)) (i32.const 1)))
                (call $update_maxr2 (local.get $wx) (local.get $wy))
                (br $stuck)))
            ;; random walk step
            (local.set $dir (i32.rem_u (call $prng_next) (i32.const 4)))
            (if (i32.eq (local.get $dir) (i32.const 0))
              (then (local.set $wx (i32.add (local.get $wx) (i32.const 1)))))
            (if (i32.eq (local.get $dir) (i32.const 1))
              (then (local.set $wx (i32.sub (local.get $wx) (i32.const 1)))))
            (if (i32.eq (local.get $dir) (i32.const 2))
              (then (local.set $wy (i32.add (local.get $wy) (i32.const 1)))))
            (if (i32.eq (local.get $dir) (i32.const 3))
              (then (local.set $wy (i32.sub (local.get $wy) (i32.const 1)))))
            ;; clamp to grid
            (if (i32.lt_s (local.get $wx) (i32.const 0))
              (then (local.set $wx (i32.const 0))))
            (if (i32.ge_s (local.get $wx) (global.get $GRID_SIZE))
              (then (local.set $wx (i32.sub (global.get $GRID_SIZE) (i32.const 1)))))
            (if (i32.lt_s (local.get $wy) (i32.const 0))
              (then (local.set $wy (i32.const 0))))
            (if (i32.ge_s (local.get $wy) (global.get $GRID_SIZE))
              (then (local.set $wy (i32.sub (global.get $GRID_SIZE) (i32.const 1)))))
            (br $walk)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop_outer)))
    (i32.load (global.get $CSIZE_OFFSET)))

  ;; toy_density_proxy() — returns csize / maxR², a NUMBER DENSITY. NOT a dimension.
  ;;
  ;; RENAMED + CORRECTED by Lumen 2026-08-25. This was exported as `get_df` and
  ;; commented "Returns 1.322 for a well-grown DLA cluster" / "* 1.322 as a proxy".
  ;; Both statements were false about this very function:
  ;;
  ;;   * There is no 1.322 anywhere in the body. The `* 1.322` was only ever in the
  ;;     comment. The expression is, and always was, `csize / (maxr * maxr)`.
  ;;   * Measured on the eight byte-locked seeds it returns 0.248–0.450 — a factor
  ;;     of 3–5 from the 1.322 the comment claimed. Pinned by
  ;;     `bytelock/box-counting.test.ts` ("get_df()'s actual expression is a DENSITY").
  ;;
  ;; Why it cannot be a dimension: for any object obeying N ~ R^D, the quantity
  ;; N/R² equals R^(D−2), which for D < 2 decays without bound as the cluster grows.
  ;; It is not scale-invariant, so it has no fixed point to converge to. This is a
  ;; mislabel, not a poor approximation.
  ;;
  ;; REGISTER: `toy` (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
  ;; Zero callers — nothing in the tree imports this export. Kept, not deleted:
  ;; demoting is the point. For a real estimator see `bytelock/reference.mjs`
  ;; (`boxCountingDimension`, calibrated) and `massRadiusDimension` in its tests.
  ;;
  ;; Analysis: docs/research/2026-08-25-does-the-dla-meter-measure-a-fractal-dimension-four-estimators-one-typed-in-constant-lumen.md
  (func (export "toy_density_proxy") (result f64)
    (local $csize f64)
    (local $maxr2 f64)
    (local $maxr f64)
    (local.set $csize (f64.convert_i32_s (i32.load (global.get $CSIZE_OFFSET))))
    (local.set $maxr2 (f64.convert_i32_s (i32.load (global.get $MAXR2_OFFSET))))
    (if (f64.le (local.get $maxr2) (f64.const 1.0))
      (then (return (f64.const 1.0))))
    (local.set $maxr (f64.sqrt (local.get $maxr2)))
    ;; Behaviour deliberately UNCHANGED — this commit renames and documents, it does
    ;; not alter what the function computes.
    (f64.div (local.get $csize) (f64.mul (local.get $maxr) (local.get $maxr))))

  ;; get_cell(x, y) — exported version
  (func (export "get_cell") (param $x i32) (param $y i32) (result i32)
    (call $get_cell_internal (local.get $x) (local.get $y)))
)
