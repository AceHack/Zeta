// Independent Go oracle: compute SplitMix64 over the canonical inputs and emit
// go-output.json. Recomputes the mixer from scratch (does not import the zeta
// port) so the cross-verification is a genuine independent oracle.
package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
)

func mix(x uint64) uint64 {
	z := x * 0x9E3779B97F4A7C15
	z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9
	z = (z ^ (z >> 27)) * 0x94D049BB133111EB
	return z ^ (z >> 31)
}

func main() {
	inputs := []struct {
		id string
		x  uint64
	}{
		{"x-0", 0},
		{"x-1", 1},
		{"x-2", 2},
		{"x-10", 10},
		{"x-255", 255},
		{"x-u64max", 18446744073709551615},
		{"x-golden", 11400714819323198485},
		{"x-2pow63", 9223372036854775808},
		{"x-12345678901234567890", 12345678901234567890},
		{"x-1e18", 1000000000000000000},
	}
	out := map[string]string{}
	for _, in := range inputs {
		out[in.id] = strconv.FormatUint(mix(in.x), 10)
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
