package algebra

import "testing"

func TestAdditiveGroupIdentity(t *testing.T) {
	g := AdditiveGroupInt64{}
	if g.Combine(5, g.Identity()) != 5 {
		t.Error("identity should be neutral")
	}
	if g.Combine(g.Identity(), 5) != 5 {
		t.Error("identity should be neutral (left)")
	}
}

func TestAdditiveGroupInverse(t *testing.T) {
	g := AdditiveGroupInt64{}
	if g.Combine(7, g.Inverse(7)) != g.Identity() {
		t.Error("inverse should undo combine")
	}
}

func TestAdditiveGroupAssociativity(t *testing.T) {
	g := AdditiveGroupInt64{}
	if g.Combine(g.Combine(1, 2), 3) != g.Combine(1, g.Combine(2, 3)) {
		t.Error("combine should be associative")
	}
}

func TestMaxSemilatticeJoin(t *testing.T) {
	l := MaxSemilatticeInt64{}
	if l.Join(3, 7) != 7 {
		t.Error("join should be max")
	}
	if l.Join(7, 3) != 7 {
		t.Error("join should be commutative")
	}
}

func TestMaxSemilatticeIdempotent(t *testing.T) {
	l := MaxSemilatticeInt64{}
	if l.Join(5, 5) != 5 {
		t.Error("join should be idempotent")
	}
}

func TestSetUnionMonoid(t *testing.T) {
	m := SetUnionMonoid[string]{}
	empty := m.Identity()
	if len(empty) != 0 {
		t.Error("identity should be empty set")
	}

	a := map[string]bool{"x": true, "y": true}
	b := map[string]bool{"y": true, "z": true}
	c := m.Combine(a, b)
	if len(c) != 3 || !c["x"] || !c["y"] || !c["z"] {
		t.Error("combine should be union")
	}
}
