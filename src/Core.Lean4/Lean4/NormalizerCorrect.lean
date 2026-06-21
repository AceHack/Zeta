/-
  NormalizerCorrect.lean — Lean 4 proof oracle: ZetaIrNormalizer correctness.
  
  Proves that the ZetaIrNormalizer (which lowers the 6-op v4 grammar into the
  4-op minimal generating set {mul, add, xshrxor, xrotxor}) strictly preserves
  denotation over UInt64.
  
  This elevates the normalizer's correctness from property-tested (FsCheck)
  to formally verified (Lean 4), matching the rigor of the rest of Face-3.
-/
import Std.Tactic.BVDecide

namespace Zeta.NormalizerCorrect

-- ═══ The zeta-ir-v4 term algebra ══════════════════════════════════════════════

/-- The 6 operations of the zeta-ir-v4 grammar. -/
inductive Op where
  | mul     (k : UInt64)
  | add     (k : UInt64)
  | xorshr  (s : Nat)
  | rotl    (r : Nat)
  | xrotxor (rs : List Nat)
  | xshrxor (ss : List Nat)
  deriving Repr, BEq, DecidableEq

-- ═══ `evalOp`: Denotation over UInt64 ═════════════════════════════════════════

/-- Left rotate a UInt64 by `k` bits. -/
def rotl64 (x : UInt64) (k : Nat) : UInt64 :=
  let k' := UInt64.ofNat (k % 64)
  if k' = 0 then x else (x <<< k') ||| (x >>> (64 - k'))

/-- The denotation of a single v4 op over UInt64. -/
def evalOp (op : Op) (state : UInt64) : UInt64 :=
  match op with
  | .mul k => state * k
  | .add k => state + k
  | .xorshr s => state ^^^ (state >>> (UInt64.ofNat s))
  | .rotl r => rotl64 state r
  | .xrotxor rs =>
      let folded := rs.foldl (fun acc r => acc ^^^ rotl64 state r) 0
      state ^^^ folded
  | .xshrxor ss =>
      let folded := ss.foldl (fun acc s => acc ^^^ (state >>> (UInt64.ofNat s))) 0
      state ^^^ folded

-- ═══ `normalizeOp`: The Lowering Function ═════════════════════════════════════

/-- Lowers a v4 op into the 4-op minimal generating set. -/
def normalizeOp (op : Op) : Op :=
  match op with
  | .xorshr s => .xshrxor [s]
  | .rotl r => .xrotxor [0, r]
  | _ => op

-- ═══ Proofs ═══════════════════════════════════════════════════════════════════

/-- `xorshr` reduction preserves denotation. -/
theorem eval_normalize_xorshr (s : Nat) (state : UInt64) :
    evalOp (Op.xshrxor [s]) state = evalOp (Op.xorshr s) state := by
  dsimp [evalOp, List.foldl]
  bv_decide

/-- `rotl` reduction preserves denotation. -/
theorem eval_normalize_rotl (r : Nat) (state : UInt64) :
    evalOp (Op.xrotxor [0, r]) state = evalOp (Op.rotl r) state := by
  dsimp [evalOp, List.foldl, rotl64]
  bv_decide

/-- The normalizer strictly preserves denotation over UInt64 for all ops. -/
theorem normalizeOp_preserves_eval (op : Op) (state : UInt64) :
    evalOp (normalizeOp op) state = evalOp op state := by
  cases op
  case mul k => rfl
  case add k => rfl
  case xorshr s => exact eval_normalize_xorshr s state
  case rotl r => exact eval_normalize_rotl r state
  case xrotxor rs => rfl
  case xshrxor ss => rfl

end Zeta.NormalizerCorrect
