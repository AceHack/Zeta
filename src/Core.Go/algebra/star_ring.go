// Package algebra provides the *-ring interface and instances.
//
// A *-ring: a ring (Zero, One, Add, Mul, Negate) plus an involution (Conj).
// The soft-lane interpreter is generic over this interface — swap the instance,
// change the physics (real → Bayesian, complex → quantum).
package algebra

import "math"

// StarRing is the *-ring interface: Zero/One/Add/Mul/Negate + Conj.
type StarRing[T any] interface {
	Zero() T
	One() T
	Add(a, b T) T
	Mul(a, b T) T
	Negate(a T) T
	Conj(a T) T
	IsZero(a T) bool
}

// Complex represents a complex number (re + im*i).
type Complex struct {
	Re, Im float64
}

// RealRing implements StarRing[float64]. Conj = identity.
type RealRing struct{}

func (RealRing) Zero() float64          { return 0 }
func (RealRing) One() float64           { return 1 }
func (RealRing) Add(a, b float64) float64    { return a + b }
func (RealRing) Mul(a, b float64) float64    { return a * b }
func (RealRing) Negate(a float64) float64    { return -a }
func (RealRing) Conj(a float64) float64      { return a }
func (RealRing) IsZero(a float64) bool       { return math.Abs(a) < 1e-12 }

// ComplexRing implements StarRing[Complex]. Conj = complex conjugate.
type ComplexRing struct{}

func (ComplexRing) Zero() Complex          { return Complex{0, 0} }
func (ComplexRing) One() Complex           { return Complex{1, 0} }
func (ComplexRing) Add(a, b Complex) Complex {
	return Complex{a.Re + b.Re, a.Im + b.Im}
}
func (ComplexRing) Mul(a, b Complex) Complex {
	return Complex{a.Re*b.Re - a.Im*b.Im, a.Re*b.Im + a.Im*b.Re}
}
func (ComplexRing) Negate(a Complex) Complex { return Complex{-a.Re, -a.Im} }
func (ComplexRing) Conj(a Complex) Complex   { return Complex{a.Re, -a.Im} }
func (ComplexRing) IsZero(a Complex) bool {
	return a.Re*a.Re+a.Im*a.Im < 1e-12
}

// WEntry is a weighted entry: (key, weight) where weight is from a *-ring.
type WEntry[W any] struct {
	Key    uint64
	Weight W
}

// Consolidate sums weights of identical keys, drops zeros.
// This is where interference (complex) or mixture (real) happens.
func Consolidate[W any](ring StarRing[W], entries []WEntry[W]) []WEntry[W] {
	grouped := make([]WEntry[W], 0, len(entries))
	for _, e := range entries {
		found := false
		for i := range grouped {
			if grouped[i].Key == e.Key {
				grouped[i].Weight = ring.Add(grouped[i].Weight, e.Weight)
				found = true
				break
			}
		}
		if !found {
			grouped = append(grouped, WEntry[W]{Key: e.Key, Weight: e.Weight})
		}
	}
	result := make([]WEntry[W], 0, len(grouped))
	for _, g := range grouped {
		if !ring.IsZero(g.Weight) {
			result = append(result, g)
		}
	}
	return result
}

// Op represents one IR operation.
type Op struct {
	Kind string // "mul" or "xorshr"
	Val  uint64 // multiplier constant or shift amount
}

// SoftMix folds IR ops over a weighted ensemble. Ring-generic.
// Each op can FORK frames (1→N for branching ops). Support grows only
// by actual uncertainty, not by register width. For mul/xorshr (permutations),
// each frame maps 1→1. The "grows in bits by uncertainty" property.
func SoftMix[W any](ring StarRing[W], ops []Op, width int, input []WEntry[W]) []WEntry[W] {
	var mask uint64
	if width >= 64 {
		mask = ^uint64(0)
	} else {
		mask = (1 << width) - 1
	}
	ensemble := input
	for _, op := range ops {
		// flatMap: each frame can produce multiple output frames (fork).
		var stepped []WEntry[W]
		for _, e := range ensemble {
			switch op.Kind {
			case "mul":
				stepped = append(stepped, WEntry[W]{Key: (e.Key * op.Val) & mask, Weight: e.Weight})
			case "xorshr":
				stepped = append(stepped, WEntry[W]{Key: (e.Key ^ (e.Key >> op.Val)) & mask, Weight: e.Weight})
			case "branch":
				// Fork: two frames (grows support by 1 bit of uncertainty)
				stepped = append(stepped,
					WEntry[W]{Key: e.Key & mask, Weight: e.Weight},
					WEntry[W]{Key: (e.Key ^ (1 << op.Val)) & mask, Weight: e.Weight},
				)
			default:
				stepped = append(stepped, WEntry[W]{Key: e.Key, Weight: e.Weight})
			}
		}
		ensemble = Consolidate(ring, stepped)
	}
	return ensemble
}
