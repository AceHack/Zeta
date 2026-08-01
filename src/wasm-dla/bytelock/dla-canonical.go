// src/wasm-dla/bytelock/dla-canonical.go
//
// Canonical DLA substrate — Byte-Lock v1 (Go)
// Spec: src/wasm-dla/CANONICAL_SPEC.md
//
// PRNG:   xorshift32
// Grid:   128×128, uint8 per cell
// Spawn:  circle at min(maxR + 3, 58), angle from xorshift32 / 2^32 * 2π
// Walk:   4-directional, clamp to [1, 126]
// Output: trajectory[] = (stick_x << 16) | stick_y, or 0xFFFFFFFF if escaped
//
// Compile:
//   GOOS=js GOARCH=wasm go build -o dla-canonical-go.wasm ./

//go:build js && wasm

package main

import (
	"math"
	"syscall/js"
)

const (
	gridSize  = 128
	center    = 64
	nWalkers  = 800
	maxSteps  = 50000
	spawnCap  = 58.0
	killExtra = 8.0
	twoPi     = 6.2831855
)

var (
	grid        [gridSize * gridSize]uint8
	prngState   uint32 = 1
	clusterSize int32  = 0
	maxR        float32 = 1.0
	trajectory  [nWalkers]uint32
)

func xorshift32() uint32 {
	prngState ^= prngState << 13
	prngState ^= prngState >> 17
	prngState ^= prngState << 5
	return prngState
}

func gridIdx(x, y int) int {
	return y*gridSize + x
}

func getCell(x, y int) uint8 {
	if x < 0 || x >= gridSize || y < 0 || y >= gridSize {
		return 0
	}
	return grid[gridIdx(x, y)]
}

func hasNeighbor(x, y int) bool {
	return getCell(x-1, y) != 0 || getCell(x+1, y) != 0 ||
		getCell(x, y-1) != 0 || getCell(x, y+1) != 0
}

func clamp(v, lo, hi int) int {
	if v < lo { return lo }
	if v > hi { return hi }
	return v
}

// JS Math.round semantics: round half away from zero
func jsRound(x float32) int {
	if x >= 0 {
		return int(x + 0.5)
	}
	return int(x - 0.5)
}

func jsInit(_ js.Value, args []js.Value) interface{} {
	seed := uint32(args[0].Int())
	for i := range grid { grid[i] = 0 }
	if seed == 0 { prngState = 1 } else { prngState = seed }
	clusterSize = 1
	maxR = 1.0
	grid[gridIdx(center, center)] = 1
	for i := range trajectory { trajectory[i] = 0xFFFFFFFF }
	return nil
}

func jsRun(_ js.Value, _ []js.Value) interface{} {
	for w := 0; w < nWalkers; w++ {
		spawnR := float32(maxR) + 3.0
		if spawnR > spawnCap { spawnR = spawnCap }

		angleBits := xorshift32()
		angle := float32(float64(angleBits)/4294967296.0) * twoPi

		wx := clamp(jsRound(float32(center)+spawnR*float32(math.Cos(float64(angle)))), 1, gridSize-2)
		wy := clamp(jsRound(float32(center)+spawnR*float32(math.Sin(float64(angle)))), 1, gridSize-2)

		killR  := spawnR + killExtra
		killR2 := killR * killR

		done := false
		for step := 0; step < maxSteps && !done; step++ {
			if hasNeighbor(wx, wy) {
				grid[gridIdx(wx, wy)] = 1
				clusterSize++
				dx := float32(wx - center)
				dy := float32(wy - center)
				r  := float32(math.Sqrt(float64(dx*dx + dy*dy)))
				if r > maxR { maxR = r }
				trajectory[w] = (uint32(wx) << 16) | uint32(wy)
				done = true
				break
			}
			dx := float32(wx - center)
			dy := float32(wy - center)
			if dx*dx+dy*dy > killR2 { break }

			dir := xorshift32() % 4
			switch dir {
			case 0: wx = clamp(wx+1, 1, gridSize-2)
			case 1: wx = clamp(wx-1, 1, gridSize-2)
			case 2: wy = clamp(wy+1, 1, gridSize-2)
			default: wy = clamp(wy-1, 1, gridSize-2)
			}
		}
	}
	return nil
}

func jsGetClusterSize(_ js.Value, _ []js.Value) interface{} {
	return int(clusterSize)
}

func jsGetMaxRBits(_ js.Value, _ []js.Value) interface{} {
	// Return f32 bits as int (JS will treat as int32)
	bits := math.Float32bits(maxR)
	return int(bits)
}

func jsGetTrajectoryEntry(_ js.Value, args []js.Value) interface{} {
	i := args[0].Int()
	return int(trajectory[i])
}

func main() {
	js.Global().Set("dla_init",                 js.FuncOf(jsInit))
	js.Global().Set("dla_run",                  js.FuncOf(jsRun))
	js.Global().Set("dla_get_cluster_size",     js.FuncOf(jsGetClusterSize))
	js.Global().Set("dla_get_max_r_bits",       js.FuncOf(jsGetMaxRBits))
	js.Global().Set("dla_get_trajectory_entry", js.FuncOf(jsGetTrajectoryEntry))
	select {}
}
