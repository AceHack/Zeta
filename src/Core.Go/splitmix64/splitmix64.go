// Package splitmix64 is the Go oracle for the SplitMix64 finaliser —
// Sebastiano Vigna's mixer (arXiv:1410.0530 §3; public-domain reference
// https://prng.di.unimi.it/splitmix64.c).
//
// It conforms to the F# canonical shape (src/Core/SplitMix64.fs) by agreeing
// on the shared seed (src/Core.TypeScript/splitmix64/golden-vectors.json) that
// the C#/F#/Rust/TS oracles also verify. Pure wrapping uint64 arithmetic — Go's
// unsigned integer operations wrap on overflow by default, matching the other
// oracles byte-for-byte.
package splitmix64

const (
	// GoldenRatio is floor(2^64 / phi) — Knuth TAOCP §6.4 multiplicative-hashing
	// constant. Same value Murmur3 final-mix and Fibonacci hashing use.
	GoldenRatio uint64 = 0x9E3779B97F4A7C15

	// VignaA is the first Vigna SplitMix64 finaliser multiplier (arXiv:1410.0530 §3).
	VignaA uint64 = 0xBF58476D1CE4E5B9

	// VignaB is the second Vigna SplitMix64 finaliser multiplier (arXiv:1410.0530 §3).
	VignaB uint64 = 0x94D049BB133111EB
)

// Mix applies the SplitMix64 finaliser to a 64-bit input (5 ops, no allocation).
func Mix(x uint64) uint64 {
	z := x * GoldenRatio
	z = (z ^ (z >> 30)) * VignaA
	z = (z ^ (z >> 27)) * VignaB
	return z ^ (z >> 31)
}
