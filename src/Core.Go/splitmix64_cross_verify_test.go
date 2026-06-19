package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"zeta/splitmix64"
)

// splitMix64Seed mirrors the shared golden seed at
// src/Core.TypeScript/splitmix64/golden-vectors.json. uint64 exceeds JSON's
// exact number range, so x and result are decimal strings parsed to uint64.
type splitMix64Seed struct {
	Mix []struct {
		X      string `json:"x"`
		Result string `json:"result"`
	} `json:"mix"`
}

func loadSplitMix64Seed(t *testing.T) splitMix64Seed {
	t.Helper()
	repoRoot := findRepoRoot()
	seedPath := filepath.Join(
		repoRoot, "src", "Core.TypeScript", "splitmix64", "golden-vectors.json",
	)
	data, err := os.ReadFile(seedPath)
	if err != nil {
		t.Fatalf("failed to read splitmix64 golden seed: %v", err)
	}
	var seed splitMix64Seed
	if err := json.Unmarshal(data, &seed); err != nil {
		t.Fatalf("failed to unmarshal splitmix64 golden seed: %v", err)
	}
	if len(seed.Mix) == 0 {
		t.Fatal("splitmix64 golden seed has no mix vectors")
	}
	return seed
}

// TestCrossVerifySplitMix64 replays the shared golden seed through the Go
// oracle. The C#/F#/Rust/TS/Python oracles replay the same file; agreement
// here is the cross-language treaty for Zeta's DST RNG.
func TestCrossVerifySplitMix64(t *testing.T) {
	seed := loadSplitMix64Seed(t)
	for _, v := range seed.Mix {
		x, err := strconv.ParseUint(v.X, 10, 64)
		if err != nil {
			t.Fatalf("parse x %q: %v", v.X, err)
		}
		expected, err := strconv.ParseUint(v.Result, 10, 64)
		if err != nil {
			t.Fatalf("parse result %q: %v", v.Result, err)
		}
		if got := splitmix64.Mix(x); got != expected {
			t.Errorf("Mix(%d) = %d, want %d", x, got, expected)
		}
	}
}
