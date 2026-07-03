import sys
open('/home/ubuntu/lfg/Zeta/src/Core.Lean4/Lean4/CanonicalizerCorrect.lean', 'a').write("""\ntheorem fuseOps_preserves_eval (ops : List Op) (state : UInt64) :
    evalOps (fuseOps ops) state = evalOps ops state := by
  induction ops using WellFounded.induction with
  | ind ops ih =>
    match h : ops with
    | [] => rfl
    | Op.mul 1 :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.base _)) (evalOp (Op.mul 1) state)
      have h_fuse : fuseOps (Op.mul 1 :: rest) = fuseOps rest := by rfl
      rw [h_fuse, evalOps_cons, eval_mul_one]
      exact ih
    | Op.add 0 :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.base _)) (evalOp (Op.add 0) state)
      have h_fuse : fuseOps (Op.add 0 :: rest) = fuseOps rest := by rfl
      rw [h_fuse, evalOps_cons, eval_add_zero]
      exact ih
    | Op.xshrxor [] :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.base _)) (evalOp (Op.xshrxor []) state)
      have h_fuse : fuseOps (Op.xshrxor [] :: rest) = fuseOps rest := by rfl
      rw [h_fuse, evalOps_cons]
      exact ih
    | Op.xrotxor [] :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.base _)) (evalOp (Op.xrotxor []) state)
      have h_fuse : fuseOps (Op.xrotxor [] :: rest) = fuseOps rest := by rfl
      rw [h_fuse, evalOps_cons]
      exact ih
    | Op.mul 0 :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.base _)) (evalOp (Op.mul 0) state)
      have h_fuse : fuseOps (Op.mul 0 :: rest) = Op.mul 0 :: fuseOps rest := by rfl
      rw [h_fuse, evalOps_cons, evalOps_cons, eval_mul_zero, ←evalOps_cons]
      exact ih
    | Op.mul a :: Op.mul b :: rest =>
      have ih := ih (Op.mul (a * b) :: rest) (by exact Nat.lt.step (Nat.lt.base _)) state
      have h_fuse : fuseOps (Op.mul a :: Op.mul b :: rest) = fuseOps (Op.mul (a * b) :: rest) := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; contradiction
        next h => cases h; rfl
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => rename_i heq; injection heq with h1 h2; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x6 a b rest h1.symm h2.symm)
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, eval_mul_mul, ←evalOps_cons]
      exact ih
    | Op.add a :: Op.add b :: rest =>
      have ih := ih (Op.add (a + b) :: rest) (by exact Nat.lt.step (Nat.lt.base _)) state
      have h_fuse : fuseOps (Op.add a :: Op.add b :: rest) = fuseOps (Op.add (a + b) :: rest) := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; rfl
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => rename_i heq; injection heq with h1 h2; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x7 a b rest h1.symm h2.symm)
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, eval_add_add, ←evalOps_cons]
      exact ih
    | Op.mul a :: Op.add b :: Op.mul c :: tail =>
      have ih := ih (Op.mul (a * c) :: Op.add (b * c) :: tail) (by exact Nat.lt.step (Nat.lt.step (Nat.lt.base _))) state
      have h_fuse : fuseOps (Op.mul a :: Op.add b :: Op.mul c :: tail) = fuseOps (Op.mul (a * c) :: Op.add (b * c) :: tail) := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h; rfl
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => rename_i heq; injection heq with h1 h2; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x8 a b c tail h1.symm h2.symm)
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, evalOps_cons, eval_mul_add_mul, ←evalOps_cons, ←evalOps_cons]
      exact ih
    | Op.mul a :: Op.add b :: Op.add c :: tail =>
      have ih := ih (Op.mul a :: Op.add (b + c) :: tail) (by exact Nat.lt.step (Nat.lt.step (Nat.lt.base _))) state
      have h_fuse : fuseOps (Op.mul a :: Op.add b :: Op.add c :: tail) = fuseOps (Op.mul a :: Op.add (b + c) :: tail) := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h; rfl
        next h => cases h
        next h => cases h
        next h => rename_i heq; injection heq with h1 h2; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x9 a b c tail h1.symm h2.symm)
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, evalOps_cons, eval_mul_add_add, ←evalOps_cons, ←evalOps_cons]
      exact ih
    | Op.mul a :: Op.add b :: rest =>
      have ih := ih rest (by exact Nat.lt.step (Nat.lt.step (Nat.lt.base _))) (evalOp (Op.add b) (evalOp (Op.mul a) state))
      have h_fuse : fuseOps (Op.mul a :: Op.add b :: rest) = Op.mul a :: Op.add b :: fuseOps rest := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; contradiction
        next h => cases h
        next h => cases h
        next h => cases h; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x3 x1 x2 h2)
        next h => cases h; rename_i x1 x2 x3 x4 x5 x6 x7 x8 x9 x10 x11; exact False.elim (x4 x1 x2 h2)
        next h => cases h; rfl
        next h => cases h
        next h => cases h
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, evalOps_cons, ←evalOps_cons, ←evalOps_cons]
      exact ih
    | Op.xrotxor [1] :: Op.xrotxor [2] :: rest =>
      have ih := ih (Op.xrotxor [2, 1, 3] :: rest) (by exact Nat.lt.step (Nat.lt.base _)) state
      have h_fuse : fuseOps (Op.xrotxor [1] :: Op.xrotxor [2] :: rest) = fuseOps (Op.xrotxor [2, 1, 3] :: rest) := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h
        next h => cases h; rfl
        next h => cases h
        next h => cases h
      rw [h_fuse, evalOps_cons, evalOps_cons, eval_xrotxor_concrete, ←evalOps_cons]
      exact ih
    | head :: tail =>
      have ih := ih tail (by exact Nat.lt.step (Nat.lt.base _)) (evalOp head state)
      have h_fuse : fuseOps (head :: tail) = head :: fuseOps tail := by
        rw [fuseOps.eq_def]
        split
        next h => cases h
        next h => cases h; contradiction
        next h => cases h; contradiction
        next h => cases h; contradiction
        next h => cases h; contradiction
        next h => cases h; contradiction
        next h => cases h; rename_i x1 x2 x3; exact False.elim (x1 x2 x3 rfl rfl)
        next h => cases h; rename_i x1 x2 x3; exact False.elim (x2 x1 x2 rfl rfl)
        next h => cases h; rename_i x1 x2 x3 x4; exact False.elim (x3 x1 x2 x3 rfl rfl)
        next h => cases h; rename_i x1 x2 x3 x4; exact False.elim (x4 x1 x2 x3 rfl rfl)
        next h => cases h; rename_i x1 x2 x3; exact False.elim (x5 x1 x2 rfl rfl)
        next h => cases h; rename_i x1; exact False.elim (x6 x1 rfl rfl)
        next h => cases h; rfl
        next h => cases h
      rw [h_fuse, evalOps_cons, ←evalOps_cons]
      exact ih
end Zeta.CanonicalizerCorrect""")
