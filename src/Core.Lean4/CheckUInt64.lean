import Std.Tactic.BVDecide

theorem uint64_zero_xor (x : UInt64) : 0 ^^^ x = x := by
  bv_decide
