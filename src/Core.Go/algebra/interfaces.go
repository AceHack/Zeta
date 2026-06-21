// Package algebra provides the full algebraic interface stack.
// GCF principle: richest shared structure + Go-specific extras (embedding, generics).
package algebra

// Group — identity + combine + inverse. Minimal structure for undo/retract.
type Group[T any] interface {
	Identity() T
	Combine(a, b T) T
	Inverse(a T) T
}

// Monoid — identity + combine. No inverse. The CRDT merge floor.
type Monoid[T any] interface {
	Identity() T
	Combine(a, b T) T
}

// JoinSemilattice — idempotent, commutative, associative join. Monotone growth.
type JoinSemilattice[T any] interface {
	Join(a, b T) T
}

// Lattice — join (LUB) + meet (GLB). Full lattice structure.
type Lattice[T any] interface {
	JoinSemilattice[T]
	Meet(a, b T) T
}

// Codec — encode/decode pair. The serialization contract.
type Codec[A any, B any] interface {
	Encode(a A) B
	Decode(b B) A
}

// Port — hexagonal boundary (read + write). Invariant on T.
type Port[T any] interface {
	Read() T
	Write(value T)
}

// ReadPort — read-only (covariant). Can widen output.
type ReadPort[T any] interface {
	Read() T
}

// WritePort — write-only (contravariant). Can narrow input.
type WritePort[T any] interface {
	Write(value T)
}

// ─── Instances ───────────────────────────────────────────────────────────

// AdditiveGroupInt64 — additive group over int64.
type AdditiveGroupInt64 struct{}

func (AdditiveGroupInt64) Identity() int64          { return 0 }
func (AdditiveGroupInt64) Combine(a, b int64) int64 { return a + b }
func (AdditiveGroupInt64) Inverse(a int64) int64    { return -a }

// MaxSemilatticeInt64 — max join-semilattice over int64.
type MaxSemilatticeInt64 struct{}

func (MaxSemilatticeInt64) Join(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// SetUnionMonoid — set union as a monoid (map[T]bool for Go sets).
type SetUnionMonoid[T comparable] struct{}

func (SetUnionMonoid[T]) Identity() map[T]bool { return make(map[T]bool) }
func (SetUnionMonoid[T]) Combine(a, b map[T]bool) map[T]bool {
	result := make(map[T]bool, len(a)+len(b))
	for k := range a {
		result[k] = true
	}
	for k := range b {
		result[k] = true
	}
	return result
}
