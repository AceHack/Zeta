// Independent Go oracle: compute MurmurHash3 fmix32 over the canonical inputs and
// emit go-output.json. Recomputes the finaliser from scratch (does not import the
// zeta port) so the cross-verification is a genuine independent oracle.
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
)

func fmix32(x uint32) uint32 {
	h := x
	h ^= h >> 16
	h *= 0x85ebca6b
	h ^= h >> 13
	h *= 0xc2b2ae35
	h ^= h >> 16
	return h
}

func main() {
	inputs := []struct {
		id string
		x  uint32
	}{
		{"x-0", 0},
		{"x-1", 1},
		{"x-2", 2},
		{"x-10", 10},
		{"x-255", 255},
		{"x-u32max", 4294967295},
		{"x-0x9e3779b9", 2654435769},
		{"x-2pow31", 2147483648},
		{"x-3735928559", 3735928559},
		{"x-1e9", 1000000000},
	}
	out := map[string]string{}
	for _, in := range inputs {
		out[in.id] = strconv.FormatUint(uint64(fmix32(in.x)), 10)
	}
	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		panic(err)
	}
	b = append(b, '\n')
	// Write to the parent (primitive) dir.
	dir, _ := os.Getwd()
	target := filepath.Join(filepath.Dir(dir), "go-output.json")
	if err := os.WriteFile(target, b, 0o644); err != nil {
		panic(err)
	}
	println("wrote go-output.json")
}
