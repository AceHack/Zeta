// Package algebra provides the sparse statevector quantum simulator.
// Support grows ONLY by actual uncertainty — same cost model as AmplitudeEmu.
//
// Key property: permutation ops (mul, xorshr, join) NEVER grow support.
// Only branch (Hadamard-like) ops fork — support grows by exactly 1 bit per branch.
package algebra

import "math"

// Complex amplitude.
type ComplexAmp struct {
	Re, Im float64
}

func (c ComplexAmp) MagnitudeSq() float64 { return c.Re*c.Re + c.Im*c.Im }
func (c ComplexAmp) Scale(s float64) ComplexAmp { return ComplexAmp{c.Re * s, c.Im * s} }
func (c ComplexAmp) Add(other ComplexAmp) ComplexAmp {
	return ComplexAmp{c.Re + other.Re, c.Im + other.Im}
}

var (
	ComplexZero = ComplexAmp{0, 0}
	ComplexOne  = ComplexAmp{1, 0}
)

const eps = 1e-12

// SparseQuantumSim — hash-map of basis-state → complex amplitude.
// The "bit-growing quantum" lane — O(support), not O(2^n).
type SparseQuantumSim struct {
	state map[uint64]ComplexAmp
	width int
	mask  uint64
}

// NewSparseQuantumSim creates a simulator for the given register width.
func NewSparseQuantumSim(width int) *SparseQuantumSim {
	var mask uint64
	if width >= 64 {
		mask = ^uint64(0)
	} else {
		mask = (1 << width) - 1
	}
	return &SparseQuantumSim{
		state: make(map[uint64]ComplexAmp),
		width: width,
		mask:  mask,
	}
}

// Support returns the number of basis states with nonzero amplitude.
func (s *SparseQuantumSim) Support() int { return len(s.state) }

// Initialize sets the simulator to a single basis state.
func (s *SparseQuantumSim) Initialize(basisState uint64) {
	s.state = map[uint64]ComplexAmp{basisState & s.mask: ComplexOne}
}

// ApplyMul applies mul(k) — permutation. No growth.
func (s *SparseQuantumSim) ApplyMul(k uint64) {
	next := make(map[uint64]ComplexAmp, len(s.state))
	for key, amp := range s.state {
		newKey := (key * k) & s.mask
		next[newKey] = next[newKey].Add(amp)
	}
	prune(next)
	s.state = next
}

// ApplyXorShr applies xorshr(shift) — permutation (bijective). No growth.
func (s *SparseQuantumSim) ApplyXorShr(shift int) {
	next := make(map[uint64]ComplexAmp, len(s.state))
	for key, amp := range s.state {
		newKey := (key ^ (key >> shift)) & s.mask
		next[newKey] = next[newKey].Add(amp)
	}
	prune(next)
	s.state = next
}

// ApplyBranch applies branch(bit) — fork. Support grows by 1 bit.
func (s *SparseQuantumSim) ApplyBranch(bit int) {
	scale := 1.0 / math.Sqrt2
	next := make(map[uint64]ComplexAmp, len(s.state)*2)
	for key, amp := range s.state {
		scaled := amp.Scale(scale)
		flipped := (key ^ (1 << bit)) & s.mask
		next[key] = next[key].Add(scaled)
		next[flipped] = next[flipped].Add(scaled)
	}
	prune(next)
	s.state = next
}

// ApplyJoin applies join(control, target) — CNOT. No growth.
func (s *SparseQuantumSim) ApplyJoin(control, target int) {
	next := make(map[uint64]ComplexAmp, len(s.state))
	for key, amp := range s.state {
		controlSet := (key>>control)&1 == 1
		newKey := key
		if controlSet {
			newKey = (key ^ (1 << target)) & s.mask
		}
		next[newKey] = next[newKey].Add(amp)
	}
	prune(next)
	s.state = next
}

// Measure collapses to a single basis state. For support=1 (deterministic), returns that state.
func (s *SparseQuantumSim) Measure() uint64 {
	if len(s.state) == 0 {
		return 0
	}
	for key := range s.state {
		return key // For deterministic (support=1), this is the only state
	}
	return 0
}

// GetAmplitude returns the amplitude for a specific basis state.
func (s *SparseQuantumSim) GetAmplitude(basisState uint64) ComplexAmp {
	if amp, ok := s.state[basisState&s.mask]; ok {
		return amp
	}
	return ComplexZero
}

func prune(state map[uint64]ComplexAmp) {
	for key, amp := range state {
		if amp.MagnitudeSq() < eps*eps {
			delete(state, key)
		}
	}
}
