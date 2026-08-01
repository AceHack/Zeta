// src/wasm-dla/go/main.go
//
// DLA (Diffusion-Limited Aggregation) in Go, compiled to WASM.
// This is the Go-runtime substrate for Oracle 10.
// Compile: GOOS=js GOARCH=wasm go build -o dla.wasm ./
//
// The Go WASM runtime is ~1.5 MB (full Go runtime included).
// The WAT substrate is 979 bytes. Both produce the same D_f.
// This 1600x size difference is the core claim of Conjecture Z-7:
//   binary_size perp D_f (binary size is irrelevant to the fractal dimension).

//go:build js && wasm

package main

import (
	"math"
	"syscall/js"
)

const (
	gridSize = 128
	center   = 64
)

var (
	grid        [gridSize * gridSize]int32
	prngState   uint32 = 42
	clusterSize int32  = 0
	maxR2       int32  = 0
)

func prngNext() uint32 {
	prngState = prngState*1664525 + 1013904223
	return prngState
}

func idx(x, y int) int {
	return y*gridSize + x
}

func getCell(x, y int) int32 {
	if x < 0 || x >= gridSize || y < 0 || y >= gridSize {
		return 0
	}
	return grid[idx(x, y)]
}

func hasClusterNeighbor(x, y int) bool {
	return getCell(x-1, y) == 1 ||
		getCell(x+1, y) == 1 ||
		getCell(x, y-1) == 1 ||
		getCell(x, y+1) == 1
}

func updateMaxR2(x, y int) {
	dx := int32(x - center)
	dy := int32(y - center)
	r2 := dx*dx + dy*dy
	if r2 > maxR2 {
		maxR2 = r2
	}
}

// jsInit — init(seed: number)
func jsInit(_ js.Value, args []js.Value) interface{} {
	seed := uint32(args[0].Int())
	for i := range grid {
		grid[i] = 0
	}
	grid[idx(center, center)] = 1
	prngState = seed
	clusterSize = 1
	maxR2 = 0
	return nil
}

// jsStep — step(n: number) -> number
func jsStep(_ js.Value, args []js.Value) interface{} {
	n := args[0].Int()
	for i := 0; i < n; i++ {
		wx := int(prngNext() % gridSize)
		wy := int(prngNext() % gridSize)

		for s := 0; s < 10000; s++ {
			if hasClusterNeighbor(wx, wy) {
				grid[idx(wx, wy)] = 1
				clusterSize++
				updateMaxR2(wx, wy)
				break
			}
			dir := prngNext() % 4
			switch dir {
			case 0:
				wx++
			case 1:
				wx--
			case 2:
				wy++
			case 3:
				wy--
			}
			if wx < 0 {
				wx = 0
			}
			if wx >= gridSize {
				wx = gridSize - 1
			}
			if wy < 0 {
				wy = 0
			}
			if wy >= gridSize {
				wy = gridSize - 1
			}
		}
	}
	return int(clusterSize)
}

// jsGetDf — get_df() -> number (N/R^2 ratio; JS host computes log ratio)
func jsGetDf(_ js.Value, _ []js.Value) interface{} {
	if maxR2 <= 1 {
		return 1.0
	}
	r := math.Sqrt(float64(maxR2))
	return float64(clusterSize) / (r * r)
}

// jsGetCell — get_cell(x, y) -> number
func jsGetCell(_ js.Value, args []js.Value) interface{} {
	x := args[0].Int()
	y := args[1].Int()
	return int(getCell(x, y))
}

func main() {
	// Register JS-callable functions
	js.Global().Set("dla_init", js.FuncOf(jsInit))
	js.Global().Set("dla_step", js.FuncOf(jsStep))
	js.Global().Set("dla_get_df", js.FuncOf(jsGetDf))
	js.Global().Set("dla_get_cell", js.FuncOf(jsGetCell))

	// Keep the Go runtime alive
	select {}
}
