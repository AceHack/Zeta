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
pred SizeDoubling [maxCap : Int] {
  all l : Level |
    sum b : l.batches | b.size <= mul[2, cap[l.level, maxCap]]
}

fun cap [lvl : Int, base : Int] : Int {
  -- cap(i) = base * 2^i — approximated with up-to-4 shifts for the
  -- bounded model checker.
  lvl = 0 => base else
  lvl = 1 => mul[base, 2] else
  lvl = 2 => mul[base, 4] else
  lvl = 3 => mul[base, 8] else mul[base, 16]
}

// Safety predicate: every level respects the doubling cap.
check SizeDoublingHolds {
  SizeDoubling[1]
} for 4 but 8 Batch, 4 Level
