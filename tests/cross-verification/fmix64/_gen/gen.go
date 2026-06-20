// Independent Go oracle: compute MurmurHash3 fmix64 over the canonical inputs and
// emit go-output.json. Recomputes the finaliser from scratch (does not import the
// zeta port) so the cross-verification is a genuine independent oracle.
package main
import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
)
func fmix64(x uint64) uint64 {
	h := x
	h ^= h >> 33
	h *= 0xff51afd7ed558ccd
	h ^= h >> 33
	h *= 0xc4ceb9fe1a85ec53
	h ^= h >> 33
	return h
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
		out[in.id] = strconv.FormatUint(fmix64(in.x), 10)
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
