// Independent Go hand-port oracle for Pelle Evensen's `nasam` mixer.
// Re-implements the public-domain reference FROM SCRATCH — a genuine N-way peer.
// uint64 arithmetic wraps mod 2^64 natively.
// Reference: https://mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
package main

import (
	"encoding/json"
	"fmt"
	"math/bits"
	"os"
	"path/filepath"
)

func nasam(x uint64) uint64 {
	x ^= bits.RotateLeft64(x, -25) ^ bits.RotateLeft64(x, -47) // RotateLeft64(x,-r) == ror(x,r)
	x *= 0x9E6C63D0676A9A99
	x ^= (x >> 23) ^ (x >> 51)
	x *= 0x9E6D62D06F6A9A9B
	x ^= (x >> 23) ^ (x >> 51)
	return x
}

func main() {
	type kv struct {
		id string
		x  uint64
	}
	inputs := []kv{
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

	// preserve insertion order
	pairs := [][2]string{{"_source", "hand-port-go"}}
	for _, kvp := range inputs {
		pairs = append(pairs, [2]string{kvp.id, fmt.Sprintf("%d", nasam(kvp.x))})
	}
	var b []byte
	b = append(b, '{', '\n')
	for i, p := range pairs {
		kj, _ := json.Marshal(p[0])
		vj, _ := json.Marshal(p[1])
		b = append(b, []byte("  ")...)
		b = append(b, kj...)
		b = append(b, ':', ' ')
		b = append(b, vj...)
		if i != len(pairs)-1 {
			b = append(b, ',')
		}
		b = append(b, '\n')
	}
	b = append(b, '}', '\n')

	wd, _ := os.Getwd()
	target := filepath.Join(wd, "go-output.json")
	if err := os.WriteFile(target, b, 0o644); err != nil {
		panic(err)
	}
	fmt.Println("wrote go-output.json (hand-port)")
}
