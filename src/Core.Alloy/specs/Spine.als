// Alloy structural model of the LSM Spine. Complements the TLA+
// behavioural specs — Alloy is better for *structural* invariants
// (tree shapes, bucket counts, key exclusivity), TLA+ for temporal.
//
// Run via:  java -jar tools/alloy/alloy.jar docs/Spine.als
// Or through the Alloy Analyzer GUI.

module Spine

abstract sig Level {
  level: Int,         -- level index, 0 at bottom
  batches: set Batch  -- batches currently at this level
}

sig Batch {
  size: Int,          -- element count
  origin: Level       -- which level this batch lives on
}

// Structural invariant #1: batches point back at their level.
fact BatchBelongsToOrigin {
  all b : Batch | b in b.origin.batches
}

// Structural invariant #2: level indices are unique.
fact UniqueLevels {
  all disj l1, l2 : Level | l1.level != l2.level
}

// Structural invariant #3: size doubles with level.
// `batches at level i` each have size ≤ 2 * capacity(i-1), etc.
// Expressed as: the total size at level i ≤ 2 * cap(i).
//
// Parens grouping: the comparison happens AFTER the sum — `sum b
// : l.batches | b.size` returns an Int (total batch size at the
// level); the result is then compared against the doubling cap.
// Without the parens, Alloy 6.2.0 parses the body of `sum` as
// `b.size <= mul[...]` (Boolean) and reports a type error.
pred SizeDoubling [maxCap : Int] {
  all l : Level |
    (sum b : l.batches | b.size) <= mul[2, cap[l.level, maxCap]]
}

fun cap [lvl : Int, base : Int] : Int {
  -- cap(i) = base * 2^i — approximated with up-to-4 shifts for the
  -- bounded model checker.
  lvl = 0 => base else
  lvl = 1 => mul[base, 2] else
  lvl = 2 => mul[base, 4] else
  lvl = 3 => mul[base, 8] else mul[base, 16]
}

// Constrain the spine model to instances where every batch has a
// non-negative size. Without this fact, Alloy's default semantics
// allow Batch.size to be any Int (including very large or negative
// values), which lets the model checker construct pathological
// instances that violate SizeDoubling trivially. Real LSM spines
// have non-negative element counts.
fact NonNegativeBatchSizes {
  all b : Batch | b.size >= 0
}

// Demonstrate that an LSM-spine instance respecting the size-
// doubling cap exists. `run` returns SAT when the model checker
// can construct such an instance; that's the desired outcome
// (existence proof for the constructive semantics — does the
// spec admit valid models?).
run SizeDoublingAdmitsInstance {
  SizeDoubling[1]
  some Level
  some Batch
} for 4 but 8 Batch, 4 Level, 7 Int
